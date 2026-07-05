# User Tasks

This file captures the user workflows the project must support. Treat it as a
test planning document, not marketing copy.

Each task should define:

- **Precondition** - what must be true before the user starts
- **Flow** - the sequence of user actions in the happy path
- **Outcome** - what the user observes when done
- **Interactions** - count of meaningful actions in the happy path
- **Regression coverage** - test name or reason coverage is manual

## UT-001: Manage Current Task List

**Precondition:** The extension has a current task list, which may be empty or
contain existing named tasks.

**Flow:**

1. Add a task by entering a meaningful task name.
2. Rename an existing task when its name is unclear.
3. Remove a task that no longer belongs in the current list.

**Outcome:** The current task list keeps stable task identities, stores trimmed
task names, preserves task order, rejects duplicate task ids or names, and makes
add, rename, and remove operations without mutating earlier list values.

**Interactions:** 3

**Regression coverage:**
`adds tasks to the current task list without mutating prior lists`, `rejects
duplicate current tasks by id or normalized name`, `renames a task in the
current task list without changing its identity`, `rejects current task list
changes for unknown ids or duplicate names`, `removes a task from the current
task list without mutating prior lists`

## UT-002: Switch Between Active Tasks

**Precondition:** The extension has a current task list containing at least one
task. It may also have a currently running task session.

**Flow:**

1. Switch directly to a selected task from the current task list.
2. Switch to the next task in current task list order.

**Outcome:** Switching ends the previously running session at the switch time,
starts a new session for the selected task at the same time, preserves immutable
session history, rejects unknown task ids, and wraps next-task switching from
the end of the list back to the first task.

**Interactions:** 2

**Regression coverage:**
`switches the active task by ending the current session and starting the
selected task`, `rejects switching to a task outside the current task list`,
`switches to the next task in current task list order`

## UT-003: Take a Break and Resume Work

**Precondition:** The extension has a current task list containing the active
task, and that task has a currently running session.

**Flow:**

1. Start a break while a task is active.
2. End the break.

**Outcome:** Starting the break ends the active task session at the break start
time, starts a break session at that same time, and stores the paused task
identity on the break session. Ending the break ends the break session at the
resume time and starts a new session for the paused task without mutating prior
session values.

**Interactions:** 2

**Regression coverage:**
`starts a break by pausing the current task for later resumption`, `ends a break
and resumes the previously active task`

## UT-004: Track an Interruption and Resume Work

**Precondition:** The extension has a current task list containing the active
task, and that task has a currently running session.

**Flow:**

1. Start an interruption while a task is active.
2. Optionally add a comment describing the interruption.
3. End the interruption.

**Outcome:** Starting the interruption ends the active task session at the
interruption start time, starts an interruption session at that same time,
stores an optional trimmed comment on the interruption activity when provided,
and stores the interrupted task identity on the interruption session. Ending the
interruption ends the interruption session at the resume time and starts a new
session for the interrupted task without mutating prior session values.

**Interactions:** 3

**Regression coverage:**
`starts an interruption by pausing the current task with an optional comment`,
`ends an interruption and resumes the previously active task`

## UT-005: Restore Tracking After Restart

**Precondition:** The extension has a current task list, completed tracked
sessions for the day, and may have an active task, break, or interruption
session when GNOME Shell restarts.

**Flow:**

1. Persist the tracker state before shutdown or restart.
2. Restore the tracker state after the extension starts again.

**Outcome:** The restored state preserves the current task list, completed
session history, active running session, and previous-task reference for a
running break or interruption. Invalid persisted state fails explicitly instead
of being silently accepted.

**Interactions:** 0

**Regression coverage:**
`restores tracker state from persisted JSON-safe values`, `rejects invalid
persisted tracker state`

## UT-006: Generate Daily Reports

**Precondition:** The extension has completed tracked sessions for the selected
day and may have an active running activity.

**Flow:**

1. Select the day to review.
2. Generate the daily report.

**Outcome:** The report aggregates repeated task sessions by task identity,
clips sessions to the selected UTC calendar day, shows total break,
interruption, and idle time, includes interruption comments when provided, and
identifies the running activity when it overlaps the selected day.

**Interactions:** 2

**Regression coverage:**
`generates a daily report with aggregated tasks, breaks, and interruptions`,
`generates a daily report that includes the running activity through now`,
`generates a daily report with idle time separate from work and breaks`,
`rejects invalid daily report inputs`

## UT-007: Generate Weekly Reports

**Precondition:** The extension has completed tracked sessions for the selected
week and may have an active running activity.

**Flow:**

1. Select the UTC week start date to review.
2. Generate the weekly report.

**Outcome:** The report aggregates repeated task sessions by task identity across
the selected seven-day UTC week, clips sessions to the week and each daily
breakdown, shows total break, interruption, and idle time, includes dated
interruption comments when provided, sorts weekly task totals by highest time
first, includes seven daily breakdowns, and identifies the running activity when
it overlaps the selected week.

**Interactions:** 2

**Regression coverage:**
`generates a weekly report with task totals and day breakdowns`, `rejects
invalid weekly report inputs`

## UT-008: Track Idle Time From Lock or Suspend

**Precondition:** The extension may have a task, break, interruption, or no
activity running when GNOME reports a lock, suspend, or idle event.

**Flow:**

1. Receive the lock, suspend, or idle event.
2. Stop the current activity at the event time when one is running.
3. Start an idle session at that same time.

**Outcome:** Time after the event is recorded as idle instead of task, break, or
interruption time. The prior activity is not stored for automatic resumption, so
the user must explicitly choose what to track after returning. Reports show idle
time separately from task, break, and interruption totals.

**Interactions:** 0

**Regression coverage:**
`starts idle by stopping the current activity without automatic resumption`,
`generates a daily report with idle time separate from work and breaks`,
`formats daily and weekly report menu sections`
