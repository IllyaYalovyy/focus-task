export const ActivityKind = Object.freeze({
    TASK: 'task',
    BREAK: 'break',
    INTERRUPTION: 'interruption',
});

function requireNonEmptyString(value, fieldName) {
    if (typeof value !== 'string' || value.trim() === '')
        throw new Error(`${fieldName} must be a non-empty string`);

    return value.trim();
}

function optionalTrimmedString(value) {
    if (value === undefined || value === null)
        return null;

    if (typeof value !== 'string')
        throw new Error('optional text fields must be strings when provided');

    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
}

function requireIsoTimestamp(value, fieldName) {
    if (typeof value !== 'string')
        throw new Error(`${fieldName} must be a valid ISO timestamp`);

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value)
        throw new Error(`${fieldName} must be a valid ISO timestamp`);

    return value;
}

function requireReportDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
        throw new Error('report date must be a YYYY-MM-DD date');

    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value)
        throw new Error('report date must be a YYYY-MM-DD date');

    return value;
}

function requireTaskList(taskList) {
    if (!Array.isArray(taskList))
        throw new Error('task list must be an array');

    return taskList.map(task => {
        if (!task || task.kind !== ActivityKind.TASK)
            throw new Error('task list entries must be task activities');

        return createTaskActivity(task);
    });
}

function hasTaskId(taskList, taskId) {
    return taskList.some(task => task.id === taskId);
}

function hasTaskName(taskList, taskName, ignoredTaskId = null) {
    return taskList.some(task => task.id !== ignoredTaskId && task.name === taskName);
}

function findTaskById(taskList, taskId) {
    return taskList.find(task => task.id === taskId) ?? null;
}

function requireTaskActivity(activity, fieldName) {
    if (!activity || activity.kind !== ActivityKind.TASK)
        throw new Error(`${fieldName} must be a task activity`);

    return createTaskActivity(activity);
}

function requireModeledActivity(activity, fieldName) {
    if (!activity || typeof activity !== 'object')
        throw new Error(`${fieldName} must be a modeled activity`);

    if (activity.kind === ActivityKind.TASK)
        return createTaskActivity(activity);

    if (activity.kind === ActivityKind.BREAK)
        return createBreakActivity(activity);

    if (activity.kind === ActivityKind.INTERRUPTION)
        return createInterruptionActivity(activity);

    throw new Error(`${fieldName} must be a modeled activity`);
}

function createTrackedSessionFromPersisted(session, fieldName = 'session') {
    if (!session || typeof session !== 'object')
        throw new Error(`${fieldName} must be a tracked session`);

    const activity = requireModeledActivity(session.activity, `${fieldName} activity`);
    const startedAt = requireIsoTimestamp(session.startedAt, 'startedAt');
    const endedAt = session.endedAt === null
        ? null
        : requireIsoTimestamp(session.endedAt, 'endedAt');

    if (endedAt !== null && Date.parse(endedAt) < Date.parse(startedAt))
        throw new Error('endedAt must be greater than or equal to startedAt');

    const restoredSession = {
        id: requireNonEmptyString(session.id, 'session id'),
        activity,
        startedAt,
        endedAt,
    };

    if (session.resumesActivity !== undefined)
        restoredSession.resumesActivity = requireTaskActivity(
            session.resumesActivity,
            'resumesActivity',
        );

    return Object.freeze(restoredSession);
}

function createActivity({id, kind, name, comment}) {
    const activity = {
        id: requireNonEmptyString(id, 'activity id'),
        kind,
        name: requireNonEmptyString(name, 'activity name'),
    };

    const trimmedComment = optionalTrimmedString(comment);
    if (trimmedComment !== null)
        activity.comment = trimmedComment;

    return Object.freeze(activity);
}

export function createTaskActivity({id, name}) {
    return createActivity({
        id,
        kind: ActivityKind.TASK,
        name,
    });
}

export function createTaskList(tasks = []) {
    const taskList = requireTaskList(tasks);
    const seenIds = new Set();
    const seenNames = new Set();

    for (const task of taskList) {
        if (seenIds.has(task.id))
            throw new Error('task id already exists');

        if (seenNames.has(task.name))
            throw new Error('task name already exists');

        seenIds.add(task.id);
        seenNames.add(task.name);
    }

    return Object.freeze([...taskList]);
}

export function addTaskToList(taskList, taskInput) {
    const tasks = requireTaskList(taskList);
    const task = createTaskActivity(taskInput);

    if (hasTaskId(tasks, task.id))
        throw new Error('task id already exists');

    if (hasTaskName(tasks, task.name))
        throw new Error('task name already exists');

    return createTaskList([...tasks, task]);
}

export function renameTaskInList(taskList, taskId, name) {
    const tasks = requireTaskList(taskList);
    const validTaskId = requireNonEmptyString(taskId, 'task id');

    if (!hasTaskId(tasks, validTaskId))
        throw new Error('task id does not exist');

    const renamedTask = createTaskActivity({id: validTaskId, name});

    if (hasTaskName(tasks, renamedTask.name, validTaskId))
        throw new Error('task name already exists');

    return createTaskList(tasks.map(task => task.id === validTaskId ? renamedTask : task));
}

export function removeTaskFromList(taskList, taskId) {
    const tasks = requireTaskList(taskList);
    const validTaskId = requireNonEmptyString(taskId, 'task id');

    if (!hasTaskId(tasks, validTaskId))
        throw new Error('task id does not exist');

    return createTaskList(tasks.filter(task => task.id !== validTaskId));
}

export function createBreakActivity({id, name = 'Break'}) {
    return createActivity({
        id,
        kind: ActivityKind.BREAK,
        name,
    });
}

export function createInterruptionActivity({id, name = 'Interruption', comment = null}) {
    return createActivity({
        id,
        kind: ActivityKind.INTERRUPTION,
        name,
        comment,
    });
}

export function startTrackedSession({id, activity, startedAt}) {
    if (!activity || !Object.values(ActivityKind).includes(activity.kind))
        throw new Error('session activity must be a modeled activity');

    return Object.freeze({
        id: requireNonEmptyString(id, 'session id'),
        activity,
        startedAt: requireIsoTimestamp(startedAt, 'startedAt'),
        endedAt: null,
    });
}

export function endTrackedSession(session, endedAt) {
    if (!session || typeof session !== 'object')
        throw new Error('session must be a tracked session');

    if (session.endedAt !== null)
        throw new Error('session is already ended');

    const validEndedAt = requireIsoTimestamp(endedAt, 'endedAt');
    if (Date.parse(validEndedAt) < Date.parse(session.startedAt))
        throw new Error('endedAt must be greater than or equal to startedAt');

    return Object.freeze({
        ...session,
        endedAt: validEndedAt,
    });
}

export function getTrackedSessionDurationMs(session, now = null) {
    if (!session || typeof session !== 'object')
        throw new Error('session must be a tracked session');

    const endTimestamp = session.endedAt ?? requireIsoTimestamp(now, 'now');
    const durationMs = Date.parse(endTimestamp) - Date.parse(session.startedAt);

    if (durationMs < 0)
        throw new Error('session duration cannot be negative');

    return durationMs;
}

function getSessionOverlapMs(session, dayStartMs, dayEndMs, now) {
    const sessionStartMs = Date.parse(session.startedAt);
    const sessionEndMs = Date.parse(session.endedAt ?? now);
    const overlapStartMs = Math.max(sessionStartMs, dayStartMs);
    const overlapEndMs = Math.min(sessionEndMs, dayEndMs);

    return Math.max(0, overlapEndMs - overlapStartMs);
}

function createRunningActivitySummary(session) {
    return {
        sessionId: session.id,
        id: session.activity.id,
        kind: session.activity.kind,
        name: session.activity.name,
        startedAt: session.startedAt,
    };
}

function formatUtcDate(timestampMs) {
    return new Date(timestampMs).toISOString().slice(0, 10);
}

export function generateDailyReport(state, {date, now = new Date().toISOString()} = {}) {
    const reportDate = requireReportDate(date);
    const validNow = requireIsoTimestamp(now, 'now');
    const trackerState = createTrackerState(state);
    const dayStartMs = Date.parse(`${reportDate}T00:00:00.000Z`);
    const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;
    const activeSession = trackerState.activeSession;
    const reportSessions = activeSession === null
        ? trackerState.sessions
        : [...trackerState.sessions, activeSession];
    const tasksById = new Map();
    let breakTotalMs = 0;
    let interruptionTotalMs = 0;
    const interruptionComments = [];

    for (const session of reportSessions) {
        const overlapMs = getSessionOverlapMs(session, dayStartMs, dayEndMs, validNow);
        if (overlapMs === 0)
            continue;

        const isRunning = session.endedAt === null;
        if (session.activity.kind === ActivityKind.TASK) {
            const existingTask = tasksById.get(session.activity.id);
            tasksById.set(session.activity.id, {
                id: session.activity.id,
                name: session.activity.name,
                totalMs: (existingTask?.totalMs ?? 0) + overlapMs,
                isRunning: (existingTask?.isRunning ?? false) || isRunning,
            });
        } else if (session.activity.kind === ActivityKind.BREAK) {
            breakTotalMs += overlapMs;
        } else if (session.activity.kind === ActivityKind.INTERRUPTION) {
            interruptionTotalMs += overlapMs;

            if (session.activity.comment) {
                interruptionComments.push(Object.freeze({
                    sessionId: session.id,
                    activityId: session.activity.id,
                    comment: session.activity.comment,
                }));
            }
        }
    }

    const runningActivity = activeSession !== null
        && getSessionOverlapMs(activeSession, dayStartMs, dayEndMs, validNow) > 0
        ? createRunningActivitySummary(activeSession)
        : null;

    return Object.freeze({
        date: reportDate,
        tasks: Object.freeze([...tasksById.values()].map(task => Object.freeze(task))),
        breakTotalMs,
        interruptionTotalMs,
        interruptionComments: Object.freeze(interruptionComments),
        runningActivity: runningActivity === null ? null : Object.freeze(runningActivity),
    });
}

export function generateWeeklyReport(state, {weekStartDate, now = new Date().toISOString()} = {}) {
    const reportWeekStartDate = requireReportDate(weekStartDate);
    const validNow = requireIsoTimestamp(now, 'now');
    const trackerState = createTrackerState(state);
    const weekStartMs = Date.parse(`${reportWeekStartDate}T00:00:00.000Z`);
    const weekEndMs = weekStartMs + 7 * 24 * 60 * 60 * 1000;
    const days = [];
    const tasksById = new Map();
    const interruptionComments = [];
    let breakTotalMs = 0;
    let interruptionTotalMs = 0;

    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
        const date = formatUtcDate(weekStartMs + dayIndex * 24 * 60 * 60 * 1000);
        const dayReport = generateDailyReport(trackerState, {date, now: validNow});
        days.push(dayReport);
        breakTotalMs += dayReport.breakTotalMs;
        interruptionTotalMs += dayReport.interruptionTotalMs;

        for (const task of dayReport.tasks) {
            const existingTask = tasksById.get(task.id);
            tasksById.set(task.id, {
                id: task.id,
                name: task.name,
                totalMs: (existingTask?.totalMs ?? 0) + task.totalMs,
                isRunning: (existingTask?.isRunning ?? false) || task.isRunning,
            });
        }

        for (const comment of dayReport.interruptionComments) {
            interruptionComments.push(Object.freeze({
                ...comment,
                date,
            }));
        }
    }

    const activeSession = trackerState.activeSession;
    const runningActivity = activeSession !== null
        && getSessionOverlapMs(activeSession, weekStartMs, weekEndMs, validNow) > 0
        ? createRunningActivitySummary(activeSession)
        : null;
    const tasks = [...tasksById.values()].sort((left, right) => {
        if (right.totalMs !== left.totalMs)
            return right.totalMs - left.totalMs;

        return left.name.localeCompare(right.name);
    });

    return Object.freeze({
        weekStartDate: reportWeekStartDate,
        weekEndDate: formatUtcDate(weekStartMs + 6 * 24 * 60 * 60 * 1000),
        tasks: Object.freeze(tasks.map(task => Object.freeze(task))),
        breakTotalMs,
        interruptionTotalMs,
        interruptionComments: Object.freeze(interruptionComments),
        days: Object.freeze(days),
        runningActivity: runningActivity === null ? null : Object.freeze(runningActivity),
    });
}

export function createTrackerState({taskList = [], sessions = [], activeSession = null} = {}) {
    const tasks = createTaskList(taskList);

    if (!Array.isArray(sessions))
        throw new Error('persisted session history must be an array');

    const endedSessions = sessions.map(session => {
        const restoredSession = createTrackedSessionFromPersisted(session);

        if (restoredSession.endedAt === null)
            throw new Error('persisted session history entries must be ended');

        return restoredSession;
    });

    const restoredActiveSession = activeSession === null
        ? null
        : createTrackedSessionFromPersisted(activeSession, 'active session');

    if (restoredActiveSession !== null && restoredActiveSession.endedAt !== null)
        throw new Error('active session must be running');

    return Object.freeze({
        taskList: tasks,
        sessions: Object.freeze([...endedSessions]),
        activeSession: restoredActiveSession,
    });
}

function serializeActivity(activity) {
    return {...activity};
}

function serializeSession(session) {
    const serializedSession = {
        id: session.id,
        activity: serializeActivity(session.activity),
        startedAt: session.startedAt,
        endedAt: session.endedAt,
    };

    if (session.resumesActivity !== undefined)
        serializedSession.resumesActivity = serializeActivity(session.resumesActivity);

    return serializedSession;
}

export function serializeTrackerState(state) {
    const trackerState = createTrackerState(state);

    return {
        taskList: trackerState.taskList.map(serializeActivity),
        sessions: trackerState.sessions.map(serializeSession),
        activeSession: trackerState.activeSession === null
            ? null
            : serializeSession(trackerState.activeSession),
    };
}

export function restoreTrackerState(persistedState) {
    if (!persistedState || typeof persistedState !== 'object')
        throw new Error('persisted tracker state must be an object');

    return createTrackerState(persistedState);
}

export function switchActiveTask(taskList, currentSession, {sessionId, taskId, switchedAt}) {
    const tasks = requireTaskList(taskList);
    const validTaskId = requireNonEmptyString(taskId, 'task id');
    const nextTask = findTaskById(tasks, validTaskId);

    if (nextTask === null)
        throw new Error('task id does not exist');

    const activeSession = startTrackedSession({
        id: sessionId,
        activity: nextTask,
        startedAt: switchedAt,
    });

    return Object.freeze({
        endedSession: currentSession === null ? null : endTrackedSession(currentSession, switchedAt),
        activeSession,
    });
}

export function switchToNextTask(taskList, currentSession, {sessionId, switchedAt}) {
    const tasks = requireTaskList(taskList);

    if (tasks.length === 0)
        throw new Error('task list must contain at least one task');

    const currentTaskIndex = currentSession === null
        ? -1
        : tasks.findIndex(task => task.id === currentSession.activity?.id);
    const nextTask = tasks[(currentTaskIndex + 1) % tasks.length];

    return switchActiveTask(tasks, currentSession, {
        sessionId,
        taskId: nextTask.id,
        switchedAt,
    });
}

export function startBreakSession(currentSession, {sessionId, breakId, name = 'Break', startedAt}) {
    const breakSession = startTrackedSession({
        id: sessionId,
        activity: createBreakActivity({id: breakId, name}),
        startedAt,
    });

    const resumesActivity = currentSession === null
        ? null
        : requireTaskActivity(currentSession.activity, 'previous activity');

    return Object.freeze({
        endedSession: currentSession === null ? null : endTrackedSession(currentSession, startedAt),
        activeSession: resumesActivity === null
            ? breakSession
            : Object.freeze({...breakSession, resumesActivity}),
    });
}

export function startInterruptionSession(
    currentSession,
    {sessionId, interruptionId, name = 'Interruption', comment = null, startedAt},
) {
    const interruptionSession = startTrackedSession({
        id: sessionId,
        activity: createInterruptionActivity({id: interruptionId, name, comment}),
        startedAt,
    });

    const resumesActivity = currentSession === null
        ? null
        : requireTaskActivity(currentSession.activity, 'previous activity');

    return Object.freeze({
        endedSession: currentSession === null ? null : endTrackedSession(currentSession, startedAt),
        activeSession: resumesActivity === null
            ? interruptionSession
            : Object.freeze({...interruptionSession, resumesActivity}),
    });
}

export function resumePreviousTaskFromBreak(taskList, currentSession, {sessionId, resumedAt}) {
    const tasks = requireTaskList(taskList);

    if (!currentSession || currentSession.activity?.kind !== ActivityKind.BREAK)
        throw new Error('current session must be a break session');

    const previousActivity = currentSession.resumesActivity;
    if (!previousActivity)
        throw new Error('break session does not have a previous task to resume');

    const previousTask = requireTaskActivity(previousActivity, 'previous activity');
    const resumedTask = findTaskById(tasks, previousTask.id);

    if (resumedTask === null)
        throw new Error('task id does not exist');

    return Object.freeze({
        endedSession: endTrackedSession(currentSession, resumedAt),
        activeSession: startTrackedSession({
            id: sessionId,
            activity: resumedTask,
            startedAt: resumedAt,
        }),
    });
}

export function resumePreviousTaskFromInterruption(taskList, currentSession, {sessionId, resumedAt}) {
    const tasks = requireTaskList(taskList);

    if (!currentSession || currentSession.activity?.kind !== ActivityKind.INTERRUPTION)
        throw new Error('current session must be an interruption session');

    const previousActivity = currentSession.resumesActivity;
    if (!previousActivity)
        throw new Error('interruption session does not have a previous task to resume');

    const previousTask = requireTaskActivity(previousActivity, 'previous activity');
    const resumedTask = findTaskById(tasks, previousTask.id);

    if (resumedTask === null)
        throw new Error('task id does not exist');

    return Object.freeze({
        endedSession: endTrackedSession(currentSession, resumedAt),
        activeSession: startTrackedSession({
            id: sessionId,
            activity: resumedTask,
            startedAt: resumedAt,
        }),
    });
}
