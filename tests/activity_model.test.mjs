import test from 'node:test';
import assert from 'node:assert/strict';

import {
    ActivityKind,
    createBreakActivity,
    createInterruptionActivity,
    createTaskActivity,
    endTrackedSession,
    getTrackedSessionDurationMs,
    startTrackedSession,
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
