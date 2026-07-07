# Focus Task

A GNOME Shell extension to help users stay focused on current tasks and track time.

Focus Task adds a top-bar indicator for the activity that currently has your
attention. From the indicator menu, you can add tasks, switch between tasks,
record breaks and interruptions, and inspect daily and weekly time summaries.

## Requirements

- GNOME Shell 45, 46, 47, 48, or 49
- `gnome-extensions` for local packaging, installation, and enabling
- Node.js for the JavaScript test suite
- Python 3 for the scaffold regression tests

The extension UUID is `focus-task@yalovyy.com`.

## Repository Layout

```text
.
├── AGENTS.md                    # Instructions for AI coding agents
├── CONTRIBUTING.md              # Contributor rules and quality bar
├── designs/
│   ├── RFC-000-template.md      # Design proposal template
│   └── USER-TASKS.md            # User workflow inventory template
├── docs/
│   ├── PROCESS.md               # How work moves from idea to merge
│   ├── COMMITS.md               # Commit identity, staging, and message rules
│   ├── DESIGN-REVIEW.md         # RFC/design review rules
│   ├── REVIEW.md                # Review checklist and expectations
│   ├── TESTING.md               # Testing strategy template
│   ├── TEMPLATE-RATIONALE.md     # Practices carried over from source projects
│   ├── RELEASE.md               # Release checklist template
│   └── prompts/                 # Copy-ready AI prompts for common workflows
├── extension/
│   ├── activityModel.js         # Testable tracking and reporting domain logic
│   ├── extension.js             # GNOME Shell extension entry point
│   ├── metadata.json            # GNOME Shell extension manifest
│   └── topBarViewModel.js       # Testable top-bar/menu/report formatting
├── scripts/
│   ├── init-project.sh          # Placeholder replacement for new projects
│   └── quality.sh               # Generic local quality gate
├── tests/                       # Local regression tests
└── .github/workflows/quality.yml
```

## Verify

Run the full local quality gate before packaging or changing the extension:

```bash
./scripts/quality.sh
```

Focused checks are also available:

```bash
npm test
python3 -m unittest discover -s tests
```

The quality gate runs shell syntax checks, Node tests, and project-specific
extension scaffold checks.

## Build

Focus Task does not require a transpile step. The source under `extension/` is
the installable GNOME Shell extension.

To build a distributable extension bundle:

```bash
npm run build
```

That command creates `dist/` and then packages the extension with
`gnome-extensions pack`.

The equivalent manual commands are:

```bash
mkdir -p dist
cd extension
gnome-extensions pack --force --out-dir ../dist \
  --extra-source activityModel.js \
  --extra-source topBarViewModel.js \
  .
cd ..
```

Do not skip `mkdir -p dist`: GNOME Extensions CLI 49.8 can segfault when
`--out-dir` points at a directory that does not exist.

This creates:

```text
dist/focus-task@yalovyy.com.shell-extension.zip
```

## Install

Install the packaged extension for the current user:

```bash
gnome-extensions install --force dist/focus-task@yalovyy.com.shell-extension.zip
```

GNOME Shell needs to reload extension metadata before the extension can be
enabled.

On X11, press `Alt+F2`, type `r`, and press Enter.

On Wayland, log out and log back in.

Then enable the extension:

```bash
gnome-extensions enable focus-task@yalovyy.com
```

You can confirm that GNOME Shell sees the extension with:

```bash
gnome-extensions info focus-task@yalovyy.com
```

## Development Install

For local development, you can install directly from the working tree with a
symbolic link:

```bash
mkdir -p ~/.local/share/gnome-shell/extensions
ln -sfn "$PWD/extension" ~/.local/share/gnome-shell/extensions/focus-task@yalovyy.com
```

Reload GNOME Shell using the same X11 or Wayland steps above, then enable the
extension:

```bash
gnome-extensions enable focus-task@yalovyy.com
```

When developing this way, changes to GNOME Shell code usually require disabling
and enabling the extension again, or reloading the shell.

## Start Using Focus Task

After enabling the extension, the top bar shows `Focus Task` when no activity is
running. Open the top-bar menu to manage work:

1. Enter a task name in `Add Task...` and choose `Add`.
2. Open the task submenu and choose `Switch to` to start tracking that task.
3. Use `Switch to Next Task` to rotate through the current task list.
4. Use `Start Break` while a task is active to pause task time and track break
   time.
5. Use `End Break` to resume the interrupted task.
6. Use `Start Interruption` while a task is active to track unplanned work.
7. Use `End Interruption` to resume the interrupted task.
8. Use each task submenu to rename or remove that task from the current list.
9. Open `Daily Report` or `Weekly Report` in the menu to review tracked time.

The top-bar label shows the current activity name and elapsed time, for example:

```text
Write README 0:42
```

## Reports

Daily reports show task totals, break totals, interruption totals, idle totals,
interruption comments when present, and the currently running activity.

Weekly reports aggregate the same data across the selected week and include a
day-by-day breakdown for days that have tracked time.

## Current Runtime Notes

- The current implementation keeps tracker state in memory. Restarting GNOME
  Shell or logging out clears the current task list and session history.
- Report dates and times are calculated in UTC in the current implementation.
- Break and interruption comments are supported by the domain model and report
  formatting, but the current top-bar menu starts interruptions without a
  comment entry field.

## Design Documents

Use `designs/RFC-000-template.md` for changes that are hard to reverse, touch
multiple parts of the system, add dependencies, or change external behavior.

Use `designs/USER-TASKS.md` to keep user-facing workflows explicit and testable.

## AI Prompt Templates

Reusable prompts live in `docs/prompts/`:

- `task.md` - turn a request into a scoped task
- `rfc.md` - draft or revise an RFC
- `implement.md` - implement accepted work
- `review.md` - review a diff or branch
- `commit.md` - prepare a clean commit
