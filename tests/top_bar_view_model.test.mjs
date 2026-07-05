import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createBreakActivity,
    createInterruptionActivity,
    createTaskActivity,
    createTrackerState,
    endTrackedSession,
    startTrackedSession,
} from '../extension/activityModel.js';
import {
    formatTopBarActivity,
    getBreakInterruptionMenuState,
    getReportMenuState,
} from '../extension/topBarViewModel.js';

test('shows the current task and elapsed time in the top bar', () => {
    const task = createTaskActivity({id: 'task-1', name: 'Write model'});
    const state = createTrackerState({
        taskList: [task],
        activeSession: startTrackedSession({
            id: 'session-1',
            activity: task,
            startedAt: '2026-07-05T10:00:00.000Z',
        }),
    });

    assert.equal(
        formatTopBarActivity(state, new Date('2026-07-05T11:05:00.000Z')),
        'Write model 1:05',
    );
});

test('shows break activity in the top bar when a break is current', () => {
    const breakActivity = createBreakActivity({id: 'break-1', name: 'Lunch'});
    const state = createTrackerState({
        activeSession: startTrackedSession({
            id: 'session-1',
            activity: breakActivity,
            startedAt: '2026-07-05T10:00:00.000Z',
        }),
    });

    assert.equal(
        formatTopBarActivity(state, new Date('2026-07-05T10:12:00.000Z')),
        'Lunch 0:12',
    );
});

test('shows a neutral top bar label when no activity is current', () => {
    assert.equal(formatTopBarActivity(createTrackerState(), new Date()), 'Focus Task');
});

test('enables break and interruption starts only while a task is active', () => {
    const task = createTaskActivity({id: 'task-1', name: 'Write model'});
    const taskState = createTrackerState({
        taskList: [task],
        activeSession: startTrackedSession({
            id: 'session-1',
            activity: task,
            startedAt: '2026-07-05T10:00:00.000Z',
        }),
    });
    const idleState = createTrackerState();

    assert.deepEqual(getBreakInterruptionMenuState(taskState), {
        canStartBreak: true,
        canStartInterruption: true,
        canEndBreak: false,
        canEndInterruption: false,
    });
    assert.deepEqual(getBreakInterruptionMenuState(idleState), {
        canStartBreak: false,
        canStartInterruption: false,
        canEndBreak: false,
        canEndInterruption: false,
    });
});

test('enables the matching resume control while break or interruption is active', () => {
    const breakState = createTrackerState({
        activeSession: startTrackedSession({
            id: 'session-1',
            activity: createBreakActivity({id: 'break-1'}),
            startedAt: '2026-07-05T10:00:00.000Z',
        }),
    });
    const interruptionState = createTrackerState({
        activeSession: startTrackedSession({
            id: 'session-2',
            activity: createInterruptionActivity({id: 'interruption-1'}),
            startedAt: '2026-07-05T10:00:00.000Z',
        }),
    });

    assert.deepEqual(getBreakInterruptionMenuState(breakState), {
        canStartBreak: false,
        canStartInterruption: false,
        canEndBreak: true,
        canEndInterruption: false,
    });
    assert.deepEqual(getBreakInterruptionMenuState(interruptionState), {
        canStartBreak: false,
        canStartInterruption: false,
        canEndBreak: false,
        canEndInterruption: true,
    });
});

test('formats daily and weekly report menu sections', () => {
    const writeTask = createTaskActivity({id: 'task-1', name: 'Write model'});
    const reviewTask = createTaskActivity({id: 'task-2', name: 'Review tests'});
    const state = createTrackerState({
        sessions: [
            endTrackedSession(startTrackedSession({
                id: 'session-1',
                activity: writeTask,
                startedAt: '2026-07-06T09:00:00.000Z',
            }), '2026-07-06T10:00:00.000Z'),
            endTrackedSession(startTrackedSession({
                id: 'session-2',
                activity: reviewTask,
                startedAt: '2026-07-08T08:00:00.000Z',
            }), '2026-07-08T08:30:00.000Z'),
            endTrackedSession(startTrackedSession({
                id: 'session-3',
                activity: createBreakActivity({id: 'break-1', name: 'Lunch'}),
                startedAt: '2026-07-08T08:30:00.000Z',
            }), '2026-07-08T08:45:00.000Z'),
            endTrackedSession(startTrackedSession({
                id: 'session-4',
                activity: createInterruptionActivity({
                    id: 'interrupt-1',
                    name: 'Support request',
                    comment: 'Customer escalation',
                }),
                startedAt: '2026-07-08T08:45:00.000Z',
            }), '2026-07-08T08:50:00.000Z'),
        ],
        activeSession: startTrackedSession({
            id: 'session-5',
            activity: writeTask,
            startedAt: '2026-07-08T09:00:00.000Z',
        }),
    });

    assert.deepEqual(
        getReportMenuState(state, new Date('2026-07-08T09:20:00.000Z')),
        {
            daily: {
                title: 'Daily Report 2026-07-08',
                lines: [
                    'Write model 0:20 (running)',
                    'Review tests 0:30',
                    'Breaks 0:15',
                    'Interruptions 0:05',
                    'Comment: Customer escalation',
                    'Running: Write model since 09:00 UTC',
                ],
            },
            weekly: {
                title: 'Weekly Report 2026-07-06 to 2026-07-12',
                lines: [
                    'Write model 1:20 (running)',
                    'Review tests 0:30',
                    'Breaks 0:15',
                    'Interruptions 0:05',
                    '2026-07-06 total 1:00',
                    '2026-07-08 total 1:10',
                    'Comment 2026-07-08: Customer escalation',
                    'Running: Write model since 2026-07-08 09:00 UTC',
                ],
            },
        },
    );
});
