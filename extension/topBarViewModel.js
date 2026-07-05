import {
    ActivityKind,
    createTrackerState,
    getTrackedSessionDurationMs,
} from './activityModel.js';

function formatElapsedDuration(durationMs) {
    const totalMinutes = Math.floor(durationMs / (60 * 1000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${hours}:${minutes.toString().padStart(2, '0')}`;
}

export function formatTopBarActivity(state, now = new Date()) {
    const trackerState = createTrackerState(state);

    if (trackerState.activeSession === null)
        return 'Focus Task';

    return [
        trackerState.activeSession.activity.name,
        formatElapsedDuration(getTrackedSessionDurationMs(
            trackerState.activeSession,
            now instanceof Date ? now.toISOString() : now,
        )),
    ].join(' ');
}

export function getBreakInterruptionMenuState(state) {
    const trackerState = createTrackerState(state);
    const activeKind = trackerState.activeSession?.activity?.kind ?? null;

    return Object.freeze({
        canStartBreak: activeKind === ActivityKind.TASK,
        canStartInterruption: activeKind === ActivityKind.TASK,
        canEndBreak: activeKind === ActivityKind.BREAK,
        canEndInterruption: activeKind === ActivityKind.INTERRUPTION,
    });
}
