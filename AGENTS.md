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
- Version Index
- Deployment
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

## Version Governance

- New formal version tokens must be pure numeric canonical versions such as `v0.8`, `v0.8.2`, or a numeric corrective version such as `v0.6.6.1`.
- `Phase A`, `Phase B`, and `Phase C` are development-organization labels only; they never enter a version token or create a separate `Version Index` entry.
- `Version Index` records numeric versions / milestones only. Existing legacy pseudo-version entries are historical facts and must not be rewritten.
- Use the existing PCC canonicalization and validation contract; do not copy a parser into this repository or use an LLM to repair versions.

## Filesystem Data Governance

- Stable projectId: `cross-system-shared-calendar`.
- The current audit found no filesystem-level persistent project data. Do not create an empty `/Users/wp/Projects/_project-data/cross-system-shared-calendar/` root.
- If filesystem-level persistent runtime or user data is added in the future, its canonical root must be `/Users/wp/Projects/_project-data/cross-system-shared-calendar/`.
- Do not add long-lived data by default under repo-local `output/`, `data/`, `uploads/`, `storage/`, or similar paths without a governance review.
- Tests must use temporary or injected paths and must not write the real `_project-data` root.
- Supabase remains the canonical cloud business persistence; do not mirror Supabase data locally for filesystem governance.
- The project owns business schema, recurrence, and Realtime semantics. Project Command Center governance standardizes only filesystem-level data location and governance.

## Git Push Authorization and Project State Gate

- Never commit or push without the user's explicit confirmation. A passing Project State Push Gate does not grant that authorization.
- After push authorization and before every `git push`, review `Current version`, `Current status`, `Next Action`, `Blockers`, `Version Index`, and `Deployment` when the push affects it.
- Correct outdated facts only in the project's own development context; replace completed Next Action entries and remove resolved blockers. When there is no clear blocker, use exactly `暂无明确阻塞。`.
- Add a Version Index entry only for a new version or formal milestone. If review requires no `PROJECT_STATE.md` change, do not create a meaningless edit; use `Project-State-Review: verified-current`.
- When installed, the gate requires exactly one `Project-State-Review: updated` or `Project-State-Review: verified-current` trailer on each pushed branch tip. It compares only `docs/PROJECT_STATE.md` final trees and does not validate the document's factual content; tags require only a valid trailer on their target commit.

## Post-Push Project State Freshness Review

After an explicitly authorized `git push` returns success, perform a READ-ONLY Post-Push Project State Freshness Review. Review `Current version`, `Current status`, `Next Action`, and `Blockers`; review `Deployment` only when the just-completed operation affected deployment.

Keep Git observable facts separate from business truth. Only the operation that just completed successfully may establish a direct contradiction. Do not infer arbitrary free-text business truth from `HEAD == upstream`, a clean working tree, ahead/behind counts, commit messages, or `Project-State-Review` trailers. For example, a successful final push directly contradicts a `Next Action` that still says to perform that same final push, but it does not prove production acceptance or any other business action.

Return exactly one freshness result:

- `POST_PUSH_STATE_CURRENT`: the reviewed fields remain current. Do not modify files or create a commit.
- `POST_PUSH_STATE_REFRESH_REQUIRED`: the successful push made a reviewed field stale. Stop; do not automatically modify governance docs, commit, or push. Continue only after new explicit user authorization to refresh the project-state/docs and, separately, to commit and push them. After that closeout push succeeds, run the same READ-ONLY review again.

The `Project-State-Review: updated` and `Project-State-Review: verified-current` trailers remain part of the pre-push Project State Review contract only. They do not certify post-push freshness or business-state correctness.

This review is a human/Codex release-workflow step; it is not a Git hook, scheduler, automatic docs mutation, commit, push, or free-text inference engine.

When a stable next business action is already known, prefer making `Next Action` describe that action instead of creating or pushing the same commit that carries the text. This is guidance, not an absolute prohibition: a still-pending push may be honest business state before push, and the post-push review then determines whether a separately authorized docs closeout is required.

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
