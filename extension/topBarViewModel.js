import {
    ActivityKind,
    createTrackerState,
    generateDailyReport,
    generateWeeklyReport,
    getTrackedSessionDurationMs,
} from './activityModel.js';

function formatElapsedDuration(durationMs) {
    const totalMinutes = Math.floor(durationMs / (60 * 1000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${hours}:${minutes.toString().padStart(2, '0')}`;
}

function formatUtcDate(date) {
    return date.toISOString().slice(0, 10);
}

function formatUtcTime(timestamp) {
    return timestamp.slice(11, 16);
}

function getUtcWeekStartDate(date) {
    const utcMidnightMs = Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
    );
    const dayOffset = (date.getUTCDay() + 6) % 7;

    return formatUtcDate(new Date(utcMidnightMs - dayOffset * 24 * 60 * 60 * 1000));
}

function formatTaskReportLine(task) {
    return [
        task.name,
        formatElapsedDuration(task.totalMs),
        task.isRunning ? '(running)' : null,
    ].filter(Boolean).join(' ');
}

function sortDailyTasks(left, right) {
    if (left.isRunning !== right.isRunning)
        return left.isRunning ? -1 : 1;

    if (right.totalMs !== left.totalMs)
        return right.totalMs - left.totalMs;

    return left.name.localeCompare(right.name);
}

function formatDailyReportLines(report) {
    const lines = report.tasks.length === 0
        ? ['No task time']
        : [...report.tasks].sort(sortDailyTasks).map(formatTaskReportLine);

    lines.push(`Breaks ${formatElapsedDuration(report.breakTotalMs)}`);
    lines.push(`Interruptions ${formatElapsedDuration(report.interruptionTotalMs)}`);

    for (const comment of report.interruptionComments)
        lines.push(`Comment: ${comment.comment}`);

    if (report.runningActivity !== null) {
        lines.push([
            `Running: ${report.runningActivity.name}`,
            `since ${formatUtcTime(report.runningActivity.startedAt)} UTC`,
        ].join(' '));
    }

    return lines;
}

function formatWeeklyReportLines(report) {
    const lines = report.tasks.length === 0
        ? ['No task time']
        : report.tasks.map(formatTaskReportLine);

    lines.push(`Breaks ${formatElapsedDuration(report.breakTotalMs)}`);
    lines.push(`Interruptions ${formatElapsedDuration(report.interruptionTotalMs)}`);

    for (const day of report.days) {
        const taskTotalMs = day.tasks.reduce((totalMs, task) => totalMs + task.totalMs, 0);
        const dayTotalMs = taskTotalMs + day.breakTotalMs + day.interruptionTotalMs;

        if (dayTotalMs > 0)
            lines.push(`${day.date} total ${formatElapsedDuration(dayTotalMs)}`);
    }

    for (const comment of report.interruptionComments)
        lines.push(`Comment ${comment.date}: ${comment.comment}`);

    if (report.runningActivity !== null) {
        lines.push([
            `Running: ${report.runningActivity.name}`,
            `since ${report.runningActivity.startedAt.slice(0, 10)}`,
            `${formatUtcTime(report.runningActivity.startedAt)} UTC`,
        ].join(' '));
    }

    return lines;
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

export function getReportMenuState(state, now = new Date()) {
    const trackerState = createTrackerState(state);
    const reportNow = now instanceof Date ? now : new Date(now);
    const nowIso = reportNow.toISOString();
    const reportDate = formatUtcDate(reportNow);
    const weekStartDate = getUtcWeekStartDate(reportNow);
    const dailyReport = generateDailyReport(trackerState, {
        date: reportDate,
        now: nowIso,
    });
    const weeklyReport = generateWeeklyReport(trackerState, {
        weekStartDate,
        now: nowIso,
    });

    return Object.freeze({
        daily: Object.freeze({
            title: `Daily Report ${dailyReport.date}`,
            lines: Object.freeze(formatDailyReportLines(dailyReport)),
        }),
        weekly: Object.freeze({
            title: `Weekly Report ${weeklyReport.weekStartDate} to ${weeklyReport.weekEndDate}`,
            lines: Object.freeze(formatWeeklyReportLines(weeklyReport)),
        }),
    });
}
