# AGENTS.md

## AI/Codex Collaboration Rules

- Explain the implementation plan before modifying code.
- Confirm with the user before deleting files.
- Confirm with the user before installing new dependencies.
- Never commit `.env`, real secrets, Supabase service role keys, or other sensitive credentials.
- Do not force push, and do not push without explicit user confirmation.
- After each development task, report changed files, check commands, `git status`, and the commit hash when a commit is created.
- Update `docs/DEVLOG.md` after every important change.
- When database, RLS, or RPC behavior changes, update the SQL files and the related testing notes.
- Keep changes minimal and consistent with the existing project style.
- Avoid destructive Git commands unless explicitly requested and confirmed.

## Local Development Server

- This project uses fixed local port `5175` for Vite development.
- Do not use Vite's default `5173` port for this project.
- Browser acceptance testing should open `http://127.0.0.1:5175`.
- `http://localhost:5175` is also an accepted desktop local address.
- Keep dev ports explicit and stable, and use `strictPort: true` for Vite projects.
- Local APIs should prefer `127.0.0.1`.
- Do not silently change dev ports. If a dev port changes, mention that `project-command-center/config/projects.json` may also need updating.

## Project Command Center Compatibility

Before starting a task, read the relevant project context when available:

- `README.md`
- `docs/PROJECT_STATE.md`
- `docs/BACKLOG.md`
- `docs/DEVLOG.md`
- `docs/DECISIONS.md`
- `docs/TESTING.md` if present

If a file is missing, state that it is missing. Do not invent project state.

After any meaningful code, documentation, configuration, planning, testing, or deployment change, check whether `docs/PROJECT_STATE.md` needs updating.

Update `docs/PROJECT_STATE.md` when any of these changed:

- current version or phase
- current status
- latest completed work
- next recommended action
- blockers
- important context
- handoff prompt
- ports / environment assumptions
- deployment or verification status

Do not update `PROJECT_STATE.md` for trivial formatting-only changes unless the status actually changed.

`PROJECT_STATE.md` should keep stable headings that project-command-center can read:

- Current version
- Current status
- Latest completed
- Next Action
- Blockers
- Important Context
- Handoff Prompt

Git branch, latest commit, and working tree are live Git data in project-command-center and should not be treated as the source of truth from `PROJECT_STATE.md`.

When relevant, update the right documentation:

- `docs/DEVLOG.md` for completed work and verification notes
- `docs/BACKLOG.md` for scope, priority, or future task changes
- `docs/DECISIONS.md` for product, architecture, API, or workflow decisions
- `docs/PROJECT_STATE.md` for the current dashboard-facing state
- `docs/TESTING.md` for test strategy or smoke checklist changes, if present

Do not duplicate large amounts of content across docs. Keep `PROJECT_STATE.md` concise and dashboard-oriented.

## Verification and Final Reporting

Run the smallest relevant verification for the type of change:

- Vite / React code changes: `npm run build`
- Node syntax-sensitive files: `node --check` where applicable
- Python changes: `python -m py_compile` or the project test command where applicable
- docs-only changes: `git diff --check` is enough unless docs tooling exists

Do not run unnecessary heavy checks for docs-only changes.

At the end of each task, report:

- modified files
- whether business code changed
- whether external project files changed
- whether secrets were read or printed
- verification run and result
- git status summary
- whether `PROJECT_STATE.md` was updated or why it was not needed
- whether commit is recommended
- next suggested action
