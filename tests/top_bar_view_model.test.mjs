import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createBreakActivity,
    createTaskActivity,
    createTrackerState,
    startTrackedSession,
} from '../extension/activityModel.js';
import {formatTopBarActivity} from '../extension/topBarViewModel.js';

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
