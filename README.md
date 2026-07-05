# Focus Task

A GNOME Shell extension to help users stay focused on current tasks and track time.

This repository was created from `ai-proj-template`, a template for AI-assisted
projects with an explicit design process, quality gates, testing expectations,
and review discipline.

## Start a New Project From This Template

```bash
git clone <template-repo-url> focus-task
cd focus-task
./scripts/init-project.sh \
  --name "Focus Task" \
  --slug "focus-task" \
  --description "A GNOME Shell extension to help users stay focused on current tasks and track time." \
  --author "Illya Yalovyy" \
  --email "yalovoy@gmail.com"
```

Then edit the project-specific sections in this file, `docs/PROCESS.md`,
`docs/TESTING.md`, and `AGENTS.md`.

## Project Workflow

The default workflow is intentionally simple:

1. Write or update the user task / problem statement.
2. Create an RFC for broad, irreversible, cross-cutting, or dependency-adding
   changes.
3. Implement in small reviewable steps.
4. Add tests at the layer where the risk lives.
5. Run `./scripts/quality.sh`.
6. Review for behavior, regressions, secrets, and maintainability before merge.

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
├── scripts/
│   ├── init-project.sh          # Placeholder replacement for new projects
│   └── quality.sh               # Generic local quality gate
└── .github/workflows/quality.yml
```

## Quality Gate

Run the local quality gate before asking for review:

```bash
./scripts/quality.sh
```

The script detects common stacks and runs the relevant checks:

- Rust: `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test`
- Node: `npm ci` when needed, then `npm run lint`, `npm test`, `npm run build`
  if those scripts exist
- Python: `python -m pytest` when `pytest` is available and tests exist
- Shell: `bash -n scripts/*.sh`

Project-specific checks belong in executable files under `scripts/quality.d/`.

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
