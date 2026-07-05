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
