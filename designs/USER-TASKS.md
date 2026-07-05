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
