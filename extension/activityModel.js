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
