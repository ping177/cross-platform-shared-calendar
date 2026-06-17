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
