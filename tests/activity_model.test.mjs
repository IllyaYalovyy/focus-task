import test from 'node:test';
import assert from 'node:assert/strict';

import {
    ActivityKind,
    addTaskToList,
    createBreakActivity,
    createInterruptionActivity,
    createTaskList,
    createTaskActivity,
    createTrackerState,
    endTrackedSession,
    generateDailyReport,
    getTrackedSessionDurationMs,
    removeTaskFromList,
    renameTaskInList,
    restoreTrackerState,
    resumePreviousTaskFromInterruption,
    resumePreviousTaskFromBreak,
    serializeTrackerState,
    startBreakSession,
    startInterruptionSession,
    startTrackedSession,
    switchActiveTask,
    switchToNextTask,
} from '../extension/activityModel.js';

test('models task, break, and interruption activities with stable identities', () => {
    assert.deepEqual(createTaskActivity({id: 'task-1', name: '  Write tests  '}), {
        id: 'task-1',
        kind: ActivityKind.TASK,
        name: 'Write tests',
    });

    assert.deepEqual(createBreakActivity({id: 'break-lunch', name: 'Lunch'}), {
        id: 'break-lunch',
        kind: ActivityKind.BREAK,
        name: 'Lunch',
    });

    assert.deepEqual(createInterruptionActivity({
        id: 'interrupt-1',
        name: 'Support request',
        comment: 'Customer escalation',
    }), {
        id: 'interrupt-1',
        kind: ActivityKind.INTERRUPTION,
        name: 'Support request',
        comment: 'Customer escalation',
    });
});

test('rejects activities without meaningful ids or names', () => {
    assert.throws(
        () => createTaskActivity({id: ' ', name: 'Write model'}),
        /activity id must be a non-empty string/,
    );

    assert.throws(
        () => createTaskActivity({id: 'task-1', name: ' '}),
        /activity name must be a non-empty string/,
    );
});

test('adds tasks to the current task list without mutating prior lists', () => {
    const emptyList = createTaskList();
    const firstList = addTaskToList(emptyList, {id: 'task-1', name: '  Write tests  '});
    const secondList = addTaskToList(firstList, {id: 'task-2', name: 'Review model'});

    assert.deepEqual(emptyList, []);
    assert.deepEqual(firstList, [
        {id: 'task-1', kind: ActivityKind.TASK, name: 'Write tests'},
    ]);
    assert.deepEqual(secondList, [
        {id: 'task-1', kind: ActivityKind.TASK, name: 'Write tests'},
        {id: 'task-2', kind: ActivityKind.TASK, name: 'Review model'},
    ]);
});

test('rejects duplicate current tasks by id or normalized name', () => {
    const taskList = addTaskToList(createTaskList(), {id: 'task-1', name: 'Write tests'});

    assert.throws(
        () => addTaskToList(taskList, {id: 'task-1', name: 'Review model'}),
        /task id already exists/,
    );

    assert.throws(
        () => addTaskToList(taskList, {id: 'task-2', name: '  Write tests  '}),
        /task name already exists/,
    );
});

test('renames a task in the current task list without changing its identity', () => {
    const taskList = addTaskToList(
        addTaskToList(createTaskList(), {id: 'task-1', name: 'Write tests'}),
        {id: 'task-2', name: 'Review model'},
    );

    const renamedList = renameTaskInList(taskList, 'task-1', '  Write activity model  ');

    assert.deepEqual(taskList[0], {id: 'task-1', kind: ActivityKind.TASK, name: 'Write tests'});
    assert.deepEqual(renamedList, [
        {id: 'task-1', kind: ActivityKind.TASK, name: 'Write activity model'},
        {id: 'task-2', kind: ActivityKind.TASK, name: 'Review model'},
    ]);
});

test('rejects current task list changes for unknown ids or duplicate names', () => {
    const taskList = addTaskToList(
        addTaskToList(createTaskList(), {id: 'task-1', name: 'Write tests'}),
        {id: 'task-2', name: 'Review model'},
    );

    assert.throws(
        () => renameTaskInList(taskList, 'missing-task', 'Draft docs'),
        /task id does not exist/,
    );

    assert.throws(
        () => renameTaskInList(taskList, 'task-2', '  Write tests  '),
        /task name already exists/,
    );

    assert.throws(
        () => removeTaskFromList(taskList, 'missing-task'),
        /task id does not exist/,
    );
});

test('removes a task from the current task list without mutating prior lists', () => {
    const taskList = addTaskToList(
        addTaskToList(createTaskList(), {id: 'task-1', name: 'Write tests'}),
        {id: 'task-2', name: 'Review model'},
    );

    const remainingList = removeTaskFromList(taskList, 'task-1');

    assert.deepEqual(taskList, [
        {id: 'task-1', kind: ActivityKind.TASK, name: 'Write tests'},
        {id: 'task-2', kind: ActivityKind.TASK, name: 'Review model'},
    ]);
    assert.deepEqual(remainingList, [
        {id: 'task-2', kind: ActivityKind.TASK, name: 'Review model'},
    ]);
});

test('switches the active task by ending the current session and starting the selected task', () => {
    const taskList = addTaskToList(
        addTaskToList(createTaskList(), {id: 'task-1', name: 'Write tests'}),
        {id: 'task-2', name: 'Review model'},
    );
    const currentSession = startTrackedSession({
        id: 'session-1',
        activity: taskList[0],
        startedAt: '2026-07-05T16:00:00.000Z',
    });

    const switched = switchActiveTask(taskList, currentSession, {
        sessionId: 'session-2',
        taskId: 'task-2',
        switchedAt: '2026-07-05T16:25:00.000Z',
    });

    assert.deepEqual(switched.endedSession, {
        id: 'session-1',
        activity: {id: 'task-1', kind: ActivityKind.TASK, name: 'Write tests'},
        startedAt: '2026-07-05T16:00:00.000Z',
        endedAt: '2026-07-05T16:25:00.000Z',
    });
    assert.deepEqual(switched.activeSession, {
        id: 'session-2',
        activity: {id: 'task-2', kind: ActivityKind.TASK, name: 'Review model'},
        startedAt: '2026-07-05T16:25:00.000Z',
        endedAt: null,
    });
    assert.equal(currentSession.endedAt, null);
});

test('rejects switching to a task outside the current task list', () => {
    const taskList = addTaskToList(createTaskList(), {id: 'task-1', name: 'Write tests'});

    assert.throws(
        () => switchActiveTask(taskList, null, {
            sessionId: 'session-1',
            taskId: 'missing-task',
            switchedAt: '2026-07-05T16:00:00.000Z',
        }),
        /task id does not exist/,
    );
});

test('switches to the next task in current task list order', () => {
    const taskList = addTaskToList(
        addTaskToList(createTaskList(), {id: 'task-1', name: 'Write tests'}),
        {id: 'task-2', name: 'Review model'},
    );
    const currentSession = startTrackedSession({
        id: 'session-1',
        activity: taskList[0],
        startedAt: '2026-07-05T16:00:00.000Z',
    });

    const switched = switchToNextTask(taskList, currentSession, {
        sessionId: 'session-2',
        switchedAt: '2026-07-05T16:25:00.000Z',
    });

    assert.equal(switched.activeSession.activity.id, 'task-2');
    assert.equal(switched.endedSession.endedAt, '2026-07-05T16:25:00.000Z');

    const wrapped = switchToNextTask(taskList, switched.activeSession, {
        sessionId: 'session-3',
        switchedAt: '2026-07-05T16:40:00.000Z',
    });

    assert.equal(wrapped.activeSession.activity.id, 'task-1');
});

test('starts a break by pausing the current task for later resumption', () => {
    const task = createTaskActivity({id: 'task-1', name: 'Write model'});
    const currentSession = startTrackedSession({
        id: 'session-1',
        activity: task,
        startedAt: '2026-07-05T16:00:00.000Z',
    });

    const breakSwitch = startBreakSession(currentSession, {
        sessionId: 'session-2',
        breakId: 'break-1',
        name: 'Lunch',
        startedAt: '2026-07-05T16:25:00.000Z',
    });

    assert.deepEqual(breakSwitch.endedSession, {
        id: 'session-1',
        activity: task,
        startedAt: '2026-07-05T16:00:00.000Z',
        endedAt: '2026-07-05T16:25:00.000Z',
    });
    assert.deepEqual(breakSwitch.activeSession, {
        id: 'session-2',
        activity: {id: 'break-1', kind: ActivityKind.BREAK, name: 'Lunch'},
        startedAt: '2026-07-05T16:25:00.000Z',
        endedAt: null,
        resumesActivity: task,
    });
    assert.equal(currentSession.endedAt, null);
});

test('ends a break and resumes the previously active task', () => {
    const taskList = addTaskToList(createTaskList(), {id: 'task-1', name: 'Write model'});
    const breakSession = startBreakSession(startTrackedSession({
        id: 'session-1',
        activity: taskList[0],
        startedAt: '2026-07-05T16:00:00.000Z',
    }), {
        sessionId: 'session-2',
        breakId: 'break-1',
        startedAt: '2026-07-05T16:25:00.000Z',
    }).activeSession;

    const resumed = resumePreviousTaskFromBreak(taskList, breakSession, {
        sessionId: 'session-3',
        resumedAt: '2026-07-05T16:40:00.000Z',
    });

    assert.deepEqual(resumed.endedSession, {
        ...breakSession,
        endedAt: '2026-07-05T16:40:00.000Z',
    });
    assert.deepEqual(resumed.activeSession, {
        id: 'session-3',
        activity: {id: 'task-1', kind: ActivityKind.TASK, name: 'Write model'},
        startedAt: '2026-07-05T16:40:00.000Z',
        endedAt: null,
    });
});

test('starts an interruption by pausing the current task with an optional comment', () => {
    const task = createTaskActivity({id: 'task-1', name: 'Write model'});
    const currentSession = startTrackedSession({
        id: 'session-1',
        activity: task,
        startedAt: '2026-07-05T16:00:00.000Z',
    });

    const interruptionSwitch = startInterruptionSession(currentSession, {
        sessionId: 'session-2',
        interruptionId: 'interrupt-1',
        name: 'Support request',
        comment: '  Customer escalation  ',
        startedAt: '2026-07-05T16:25:00.000Z',
    });

    assert.deepEqual(interruptionSwitch.endedSession, {
        id: 'session-1',
        activity: task,
        startedAt: '2026-07-05T16:00:00.000Z',
        endedAt: '2026-07-05T16:25:00.000Z',
    });
    assert.deepEqual(interruptionSwitch.activeSession, {
        id: 'session-2',
        activity: {
            id: 'interrupt-1',
            kind: ActivityKind.INTERRUPTION,
            name: 'Support request',
            comment: 'Customer escalation',
        },
        startedAt: '2026-07-05T16:25:00.000Z',
        endedAt: null,
        resumesActivity: task,
    });
    assert.equal(currentSession.endedAt, null);
});

test('ends an interruption and resumes the previously active task', () => {
    const taskList = addTaskToList(createTaskList(), {id: 'task-1', name: 'Write model'});
    const interruptionSession = startInterruptionSession(startTrackedSession({
        id: 'session-1',
        activity: taskList[0],
        startedAt: '2026-07-05T16:00:00.000Z',
    }), {
        sessionId: 'session-2',
        interruptionId: 'interrupt-1',
        startedAt: '2026-07-05T16:25:00.000Z',
    }).activeSession;

    const resumed = resumePreviousTaskFromInterruption(taskList, interruptionSession, {
        sessionId: 'session-3',
        resumedAt: '2026-07-05T16:40:00.000Z',
    });

    assert.deepEqual(resumed.endedSession, {
        ...interruptionSession,
        endedAt: '2026-07-05T16:40:00.000Z',
    });
    assert.deepEqual(resumed.activeSession, {
        id: 'session-3',
        activity: {id: 'task-1', kind: ActivityKind.TASK, name: 'Write model'},
        startedAt: '2026-07-05T16:40:00.000Z',
        endedAt: null,
    });
});

test('starts and ends tracked sessions without mutating the original session', () => {
    const activity = createTaskActivity({id: 'task-1', name: 'Write model'});
    const session = startTrackedSession({
        id: 'session-1',
        activity,
        startedAt: '2026-07-05T16:00:00.000Z',
    });

    assert.deepEqual(session, {
        id: 'session-1',
        activity,
        startedAt: '2026-07-05T16:00:00.000Z',
        endedAt: null,
    });

    const ended = endTrackedSession(session, '2026-07-05T16:25:00.000Z');

    assert.equal(session.endedAt, null);
    assert.equal(ended.endedAt, '2026-07-05T16:25:00.000Z');
    assert.equal(getTrackedSessionDurationMs(ended), 25 * 60 * 1000);
});

test('computes running session duration against an explicit clock value', () => {
    const session = startTrackedSession({
        id: 'session-1',
        activity: createBreakActivity({id: 'break-1'}),
        startedAt: '2026-07-05T16:00:00.000Z',
    });

    assert.equal(
        getTrackedSessionDurationMs(session, '2026-07-05T16:07:30.000Z'),
        7.5 * 60 * 1000,
    );
});

test('rejects sessions with invalid chronology', () => {
    const activity = createTaskActivity({id: 'task-1', name: 'Write model'});

    assert.throws(
        () => startTrackedSession({id: 'session-1', activity, startedAt: 'not a date'}),
        /startedAt must be a valid ISO timestamp/,
    );

    const session = startTrackedSession({
        id: 'session-1',
        activity,
        startedAt: '2026-07-05T16:00:00.000Z',
    });

    assert.throws(
        () => endTrackedSession(session, '2026-07-05T15:59:59.999Z'),
        /endedAt must be greater than or equal to startedAt/,
    );
});

test('restores tracker state from persisted JSON-safe values', () => {
    const taskList = addTaskToList(createTaskList(), {id: 'task-1', name: 'Write model'});
    const taskSession = startTrackedSession({
        id: 'session-1',
        activity: taskList[0],
        startedAt: '2026-07-05T16:00:00.000Z',
    });
    const breakSwitch = startBreakSession(taskSession, {
        sessionId: 'session-2',
        breakId: 'break-1',
        startedAt: '2026-07-05T16:25:00.000Z',
    });
    const state = createTrackerState({
        taskList,
        sessions: [breakSwitch.endedSession],
        activeSession: breakSwitch.activeSession,
    });
    const persisted = JSON.parse(JSON.stringify(serializeTrackerState(state)));

    const restored = restoreTrackerState(persisted);

    assert.deepEqual(restored, {
        taskList: [
            {id: 'task-1', kind: ActivityKind.TASK, name: 'Write model'},
        ],
        sessions: [{
            id: 'session-1',
            activity: {id: 'task-1', kind: ActivityKind.TASK, name: 'Write model'},
            startedAt: '2026-07-05T16:00:00.000Z',
            endedAt: '2026-07-05T16:25:00.000Z',
        }],
        activeSession: {
            id: 'session-2',
            activity: {id: 'break-1', kind: ActivityKind.BREAK, name: 'Break'},
            startedAt: '2026-07-05T16:25:00.000Z',
            endedAt: null,
            resumesActivity: {id: 'task-1', kind: ActivityKind.TASK, name: 'Write model'},
        },
    });
    assert.throws(
        () => restored.sessions.push(restored.activeSession),
        /Cannot add property/,
    );
});

test('rejects invalid persisted tracker state', () => {
    const task = createTaskActivity({id: 'task-1', name: 'Write model'});
    const activeSession = startTrackedSession({
        id: 'session-1',
        activity: task,
        startedAt: '2026-07-05T16:00:00.000Z',
    });

    assert.throws(
        () => restoreTrackerState({
            taskList: [{id: 'task-1', kind: ActivityKind.TASK, name: 'Write model'}],
            sessions: [activeSession],
            activeSession: null,
        }),
        /persisted session history entries must be ended/,
    );

    assert.throws(
        () => restoreTrackerState({
            taskList: [{id: 'task-1', kind: ActivityKind.TASK, name: 'Write model'}],
            sessions: [],
            activeSession: {...activeSession, endedAt: '2026-07-05T16:01:00.000Z'},
        }),
        /active session must be running/,
    );
});

test('generates a daily report with aggregated tasks, breaks, and interruptions', () => {
    const writeTask = createTaskActivity({id: 'task-1', name: 'Write model'});
    const reviewTask = createTaskActivity({id: 'task-2', name: 'Review tests'});
    const sessions = [
        endTrackedSession(startTrackedSession({
            id: 'session-1',
            activity: writeTask,
            startedAt: '2026-07-05T09:00:00.000Z',
        }), '2026-07-05T09:25:00.000Z'),
        endTrackedSession(startTrackedSession({
            id: 'session-2',
            activity: createBreakActivity({id: 'break-1', name: 'Lunch'}),
            startedAt: '2026-07-05T09:25:00.000Z',
        }), '2026-07-05T09:40:00.000Z'),
        endTrackedSession(startTrackedSession({
            id: 'session-3',
            activity: writeTask,
            startedAt: '2026-07-05T09:40:00.000Z',
        }), '2026-07-05T10:00:00.000Z'),
        endTrackedSession(startTrackedSession({
            id: 'session-4',
            activity: createInterruptionActivity({
                id: 'interrupt-1',
                name: 'Support request',
                comment: 'Customer escalation',
            }),
            startedAt: '2026-07-05T10:00:00.000Z',
        }), '2026-07-05T10:05:00.000Z'),
        endTrackedSession(startTrackedSession({
            id: 'session-5',
            activity: reviewTask,
            startedAt: '2026-07-05T23:50:00.000Z',
        }), '2026-07-06T00:10:00.000Z'),
    ];

    const report = generateDailyReport(
        createTrackerState({sessions}),
        {date: '2026-07-05', now: '2026-07-05T12:00:00.000Z'},
    );

    assert.deepEqual(report, {
        date: '2026-07-05',
        tasks: [
            {
                id: 'task-1',
                name: 'Write model',
                totalMs: 45 * 60 * 1000,
                isRunning: false,
            },
            {
                id: 'task-2',
                name: 'Review tests',
                totalMs: 10 * 60 * 1000,
                isRunning: false,
            },
        ],
        breakTotalMs: 15 * 60 * 1000,
        interruptionTotalMs: 5 * 60 * 1000,
        interruptionComments: [{
            sessionId: 'session-4',
            activityId: 'interrupt-1',
            comment: 'Customer escalation',
        }],
        runningActivity: null,
    });
});

test('generates a daily report that includes the running activity through now', () => {
    const task = createTaskActivity({id: 'task-1', name: 'Write model'});
    const state = createTrackerState({
        sessions: [
            endTrackedSession(startTrackedSession({
                id: 'session-1',
                activity: task,
                startedAt: '2026-07-04T23:45:00.000Z',
            }), '2026-07-05T00:15:00.000Z'),
        ],
        activeSession: startTrackedSession({
            id: 'session-2',
            activity: task,
            startedAt: '2026-07-05T10:30:00.000Z',
        }),
    });

    const report = generateDailyReport(state, {
        date: '2026-07-05',
        now: '2026-07-05T11:00:00.000Z',
    });

    assert.deepEqual(report, {
        date: '2026-07-05',
        tasks: [{
            id: 'task-1',
            name: 'Write model',
            totalMs: 45 * 60 * 1000,
            isRunning: true,
        }],
        breakTotalMs: 0,
        interruptionTotalMs: 0,
        interruptionComments: [],
        runningActivity: {
            sessionId: 'session-2',
            id: 'task-1',
            kind: ActivityKind.TASK,
            name: 'Write model',
            startedAt: '2026-07-05T10:30:00.000Z',
        },
    });
});

test('rejects invalid daily report inputs', () => {
    const state = createTrackerState();

    assert.throws(
        () => generateDailyReport(state, {
            date: '2026-7-5',
            now: '2026-07-05T11:00:00.000Z',
        }),
        /report date must be a YYYY-MM-DD date/,
    );

    assert.throws(
        () => generateDailyReport(state, {
            date: '2026-07-05',
            now: 'not a date',
        }),
        /now must be a valid ISO timestamp/,
    );
});
