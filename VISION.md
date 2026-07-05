# Focus Task Vision

## Motivation

Working on several tasks at the same time makes it difficult to stay focused and
give each task enough attention. Breaks, meetings, urgent requests, and other
interruptions make the problem worse because they hide where time went and make
it harder to resume the right work.

Focus Task is a GNOME Shell extension for a single user who wants a lightweight
way to track the current activity directly from the GNOME top bar. The extension
should help the user maintain a small set of active tasks, switch between them
intentionally, record breaks and interruptions, and review how the day was spent.

The mental model is similar to cooperative task scheduling in an operating
system: only one activity is active at a time, but the user can keep a queue of
current tasks and switch between them as context changes.

## Core Concepts

- **Current activity**: the activity that is currently receiving the user's
  attention. It can be a task, a break, an interruption, or idle time.
- **Task**: a named unit of work the user wants to track and return to later.
- **Break**: intentional time away from work, such as lunch, rest, or a short
  pause.
- **Interruption**: unplanned time caused by something outside the current task,
  such as a message, call, production issue, or quick request.
- **Idle time**: time when tracking is paused because the session is locked,
  suspended, or otherwise detected as away from the keyboard.
- **Daily report**: an aggregated summary of tasks, breaks, interruptions, and
  idle time for one calendar day.
- **Weekly report**: an aggregated summary of daily activity, including idle
  time, across one calendar week.

## MVP Use Cases

1. The extension shows the current activity in the GNOME top bar.
2. The user can see how long the current activity has been active.
3. The user can open the extension menu from the top bar.
4. The user can add a new current task by entering a task name.
5. The user can rename a task when the original name is unclear or too broad.
6. The user can remove a task from the current task list.
7. The user can switch to the next task in the current task list.
8. The user can switch directly to any task from the current task list.
9. The user can mark the current activity as a break.
10. The user can end a break and resume the previously active task.
11. The user can mark the current activity as an interruption.
12. The user can add an optional comment to an interruption.
13. The user can end an interruption and resume the interrupted task.
14. The user can see the current day's report.
15. The user can see a report for any previous day with recorded activity.
16. The user can see the current week's report.
17. The user can see a report for any previous week with recorded activity.
18. When the session locks, suspends, or is detected as idle, the extension stops
    the current activity and records the elapsed away time as idle.

## Daily Report Requirements

1. The daily report shows each task worked on during the day.
2. The daily report shows the total time spent on each task.
3. The daily report aggregates repeated work sessions for the same task.
4. The daily report shows total time spent on breaks.
5. The daily report shows total time spent on interruptions.
6. The daily report lists interruption comments when comments were provided.
7. The daily report shows total time spent idle.
8. The daily report makes it clear which activity is still running, if any.

## Weekly Report Requirements

1. The weekly report shows total time spent on each task across the selected
   week.
2. The weekly report aggregates repeated work sessions for the same task across
   multiple days.
3. The weekly report shows total time spent on breaks for the selected week.
4. The weekly report shows total time spent on interruptions for the selected
   week.
5. The weekly report shows total time spent idle for the selected week.
6. The weekly report provides a day-by-day breakdown so the user can see how the
   week was distributed.
7. The weekly report makes it easy to identify the most time-consuming tasks and
   the days with the highest interruption cost.
8. The weekly report uses a clear week boundary, such as the user's locale or a
   configurable week start day.

## Important Edge Cases

1. If the user switches tasks, the previous activity should stop and the new task
   should start immediately.
2. If the user starts a break or interruption while a task is active, the task
   should be paused and remembered for later resumption.
3. If GNOME Shell restarts, the extension should preserve enough state to avoid
   losing the current activity and the day's tracked time.
4. If the computer sleeps or the session is locked, the current activity should
   stop at the lock or suspend time and the away time should count as idle time,
   not as task, break, or interruption time. The extension should not
   automatically resume the previous task after idle time.
5. If the user removes a task that already has tracked time, historical report
   data should remain intact.
6. If the same task name is added more than once, the extension should avoid
   confusing duplicate entries.

## Non-Goals for the MVP

1. Focus Task is not a project management system.
2. Focus Task does not need team collaboration, cloud sync, accounts, or shared
   reports.
3. Focus Task does not need billing, invoicing, or client-facing timesheets.
4. Focus Task does not need automatic activity detection from open windows or
   applications in the MVP.
5. Focus Task should not require a separate desktop application for the MVP; the
   primary interaction should live in the GNOME Shell extension.
