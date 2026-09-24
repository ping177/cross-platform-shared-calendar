# Development Log

# 2026-09-24 - v0.1.11 Slice 1 Final Review and Local Desktop Acceptance — PASS

- User-run local authenticated desktop acceptance passed: default Calendar; only `日历 / 空间 / 我的` visible and no Home; Personal and existing Shared Space list/current marker/create/join entries; Shared ↔ Personal list→Hub→Calendar flows; members, invite and Tasks module; remembered selection without cross-Space data leakage; Open/Completed Tasks and disable/re-enable with original data intact; My display-name edit/refresh persistence (original name restored), this-device notifications, logout, refresh-still-logged-out and relogin without old navigation/Space state leakage. Codex did not operate authenticated sessions.
- Full Slice 1 diff review found a single navigation owner in `CalendarApp`, concrete `selectedSpaceId`, one mounted current-Space business subtree, existing request guards and Realtime teardown, and no Task/Event query, recurrence, Reminder or module-permission rewrite. No Home, aggregation, Calendar filter, global create, backend/schema/RPC, dependency or unrelated cleanup was added. Full Node tests 213/213, `npm run build`, `git diff --check` and Project State structure/scope checks passed.
- iPhone Safari three-tab navigation, installed PWA navigation, mobile safe area, last-content clearance, Event/Task Sheet clearance and iPhone Personal ↔ Shared navigation are `POST_DEPLOY_MOBILE_ACCEPTANCE_PENDING`; none is marked PASS. This is not a pre-commit implementation blocker. Production still serves v0.1.10. No commit, push or deployment was performed; Slice 1 remains open pending authorized rollout and post-deploy mobile acceptance.

# 2026-09-24 - v0.1.11 Slice 1 Navigation Foundation — Local Automated Pass

- Implemented the approved three-entry `日历 / 空间 / 我的` shell. `CalendarApp` is the sole owner of top-level and Space-domain navigation, concrete `selectedSpaceId`, and the minimal Calendar date/view state. Calendar remains single-Space; the old SpaceSelector Sheet and duplicate Calendar/Hub switch entries were replaced by a Space page. Space list/create/join validates membership and enters Hub; Hub Calendar action preserves the selected Space. Tasks/Completed and Event/Task business queries, request guards, Realtime and Sheets retain their existing contracts.
- My now contains current-user display-name editing, this-device notification settings, and existing Push cleanup plus logout. The member Sheet remains a member list. Mobile nav uses 48px touch targets, safe-area bottom spacing, content padding and a lower z-index than business Sheets. No Home, aggregation, filter, global create, Task Calendar projection, backend/schema/RPC, dependency or unrelated product module was added.
- Full Node tests 213/213 and `npm run build` passed. Frontend target matches the linked Production Supabase project; linked read-only checks confirmed required tables, all 11 frontend RPC names, RLS and Event/Task Realtime publication. Static layout review passed; user-run authenticated 320px/iPhone/PWA and A/B behavior remain pending. No commit, push or deployment was performed. v0.1.10 remains the Production version; next stop is `MANUAL_AUTH_ACCEPTANCE_CHECKPOINT`.

# 2026-09-24 - v0.1.11 Navigation + Aggregation Design Freeze

- The user accepted the read-only `V011_SCOPE_READY` audit and froze the four-slice navigation/aggregation scope in `docs/v0.1.11_NAVIGATION_AGGREGATION_SPEC.md`. Five final corrections cover no temporary Home in Slice 1, Personal + existing Shared acceptance without making a test Space, zero-valid-Task-target handling, active-view-only aggregate Realtime, and canonical Event/Task detail navigation.
- Governance only: no business code, SQL/schema, dependency, Production, authenticated session, commit or push action. v0.1.10 remains `CLOSED / PASS`; v0.1.11 is `DESIGN FROZEN / IMPLEMENTATION NOT STARTED`. Next action: Slice 1 implementation planning/review.

# 2026-09-24 - v0.1.10 Final Closeout — CLOSED / PASS

- User-run Slice 3 authenticated Production acceptance passed. Personal Space owner disabled Tasks after preparing Open and Completed rows; the business entry and count disappeared while module controls remained, and re-enable restored both rows with their contents/status. Edit, complete, reopen, and delete worked after re-enable. Shared owner disable/re-enable preserved Tasks; Shared member had no toggle and saw the updated state after refresh/re-entry. Personal and Shared module state remained isolated, and iPhone/PWA controls behaved as expected.
- Known characteristic / future consideration: `space_modules` has no Realtime publication. An already-open Shared member page may temporarily retain the old Tasks entry after an owner disables Tasks. Refresh/re-entry updates the UI; database policy rejects writes immediately. This did not fail acceptance and does not reopen v0.1.10. No module Realtime backend change was made.
- v0.1.10 is `CLOSED / PASS`: Slice 1 `PRODUCTION BACKEND ROLLOUT PASS`, Slice 2 `CLOSED / PASS`, Slice 3 `CLOSED / PASS`. Delivery includes Personal Space and multi-space membership foundations, explicit selected/current Space switching, Personal Event/Task behavior, Shared create/join continuation, Tasks enable/disable with data preservation and owner-only toggle, Chinese Task UI copy, Production backend/frontend rollout, authenticated A/B acceptance, and iPhone/PWA acceptance. Shared remains capped at two members; cross-Space aggregation, final four-destination navigation, global `+`, Lists / Important Dates / Review, and module-state Realtime remain out of scope. v0.1.11 is `NOT STARTED`; next action is its Navigation + Aggregation scope / architecture audit.
- User performed all authenticated acceptance. Codex did not operate Magic Link / OTP or user sessions. No business code, backend/schema/RLS/RPC, dependency, or Production data/configuration was changed for this documentation closeout.

# 2026-09-24 - v0.1.10 Slice 3 Controlled Frontend Rollout — Unauthenticated Verified

- Final scope and Project State pre-push review passed. Focused Node 20/20, full Node 212/212, `npm run build`, and `git diff --check` passed. Implementation commit `d14b73f898b3015564960a91c4e17035ee0f8272` was normally pushed to `origin/main` with the required Project-State-Review trailer; no backend/schema/RLS/RPC, dependency, or module Realtime change was included.
- GitHub/Vercel Production deployment `6630561119` completed successfully from that exact commit. The public Production URL returned HTTP 200, its unauthenticated login entry rendered, and the active JS/CSS assets returned HTTP 200. The active JS contained Tasks module state/toggle, disabled-state, and Chinese Task UI markers, confirming the Slice 2 bundle is no longer the active entry point. No authenticated browser or PWA session was used.
- A linked Production read-only aggregate found 4 Spaces: 4 `tasks=true`, 0 `tasks=false`, and 0 missing Tasks rows. No unexpectedly disabled Space was found. The frontend deploy performed no module toggle; authenticated Production module-toggle acceptance is `NOT STARTED`, and v0.1.10 remains open. Users must close/refresh old tabs and fully restart PWA runtimes before manual acceptance because old Slice 2 JS still exposes the Tasks business entry when a module is disabled.

# 2026-09-24 - v0.1.10 Slice 3 Bounded Review Corrections — Final Review Pending

- Added a component-active gate to `TasksArea`: cleanup deactivates it before request invalidation, new Task reads and each pagination step check it, and delayed mutation completion skips reload and parent Task state updates after unmount. Existing active-component reload and request-generation behavior remain.
- Mapped Task-domain backend messages, including lowercase `task` / `tasks`, module-disabled and permission failures, to Chinese UI copy. Unknown non-Task messages retain the existing fallback behavior. Focused delayed-completion and error-copy coverage was added.
- Focused Node 20/20 and full Node 212/212 PASS; `npm run build` PASS. `git diff --check` PASS. These are local/static checks; Slice 3 remains `LOCAL VERIFIED / REVIEW PENDING`, with Production rollout and authenticated acceptance `NOT STARTED`. No backend/schema/RLS/RPC, dependency, Production session/toggle, deploy, commit, or push changed.

# 2026-09-24 - v0.1.10 Slice 3 Local Frontend Implementation — Review Checkpoint

- Added a current-Space Tasks module read with `loading / enabled / disabled / error` states. Only `tasks=true` opens the business UI; absent/false rows are disabled, and read failures remain unknown with a retry. The selected Space component and request guard prevent late module responses from crossing a switch.
- The Space Hub now shows one module-management row after members/invite controls. Personal and Shared owners can use the existing owner-authorized `set_space_module_enabled` RPC; Shared members see read-only state. The Tasks business entry and count appear only when enabled. Closing or losing known state exits Tasks/Completed, unmounts Task Sheet and clears local Task state without deleting database rows. Toggle RPC failure retains known state; successful RPC followed by read failure enters unknown. Re-enabling reloads historical Tasks.
- Changed user-facing Task/Tasks labels, accessibility labels, loading text, and Task-specific errors to Chinese. Internal types, identifiers, table names, and filenames remain unchanged. No module Realtime publication, backend/schema/RLS/RPC, dependency, future-module UI, or navigation redesign changed.
- Focused Node tests 19/19 PASS; full Node suite 211/211 PASS; `npm run build` and `git diff --check` PASS. Tests are pure/static and do not constitute real authenticated acceptance. Slice 3 Production frontend rollout and authenticated Production acceptance are `NOT STARTED`; the full v0.1.10 foundation remains open. Other members' already-open pages refresh/re-enter to see a toggle; the database still rejects disabled Task writes. No Production toggle, login/session operation, commit, push, or deploy occurred.

# 2026-09-24 - v0.1.10 Slice 2 Authenticated Production Acceptance — CLOSED / PASS

- The user completed real A/B authenticated acceptance in Production browsers and on iPhone/PWA. A and B each received their Personal Space at first authenticated bootstrap and initially remained in their original Shared Space. Personal Spaces were mutually invisible; A/B Shared ↔ Personal switching, refresh restoration of valid selected Space, and user-isolated remembered selections passed.
- Personal Events passed create, edit, delete, and Shared Space isolation with no “我的 / 对方 / 共同” selector. Personal Tasks passed create, edit, complete, Completed Tasks list, reopen, delete, and Shared Space isolation with no assignment selector. B's Personal Event and Task behavior passed. Shared Event and Task regression passed.
- A/B Realtime, rapid Shared ↔ Personal switching, Calendar/Tasks/members Space isolation, Shared create/join entry points, 320px layout, and iPhone/PWA smoke passed. No random Space selection, stale response repopulation, cross-Space Realtime, white screen, or endless loading was observed.
- Two cases were N/A, not failures: `N/A — current modal/sheet UI prevents Space switching while the sheet is open`; and `N/A — no current acceptance account has two Shared Spaces`. Existing selectedSpaceId-to-sheet reset/close behavior remains defensive protection. Local automated selection logic remains the available evidence for multiple Shared Spaces; no extra real Shared Space was created.
- The manual acceptance was user-performed. Codex did not handle Magic Link/OTP, enter credentials, or control an authenticated user session. Slice 2 is `CLOSED / PASS`; authenticated Production acceptance and frontend rollout are `PASS`; Slice 3 remains `NOT STARTED`. This does not close the entire v0.1.10 foundation.

# 2026-09-24 - v0.1.10 Slice 2 Controlled Frontend Rollout — Unauthenticated Verified

- Final pre-commit review found only the 19 expected Slice 2 implementation, test, and process-documentation files; no backend/schema/RLS/RPC, dependency, Slice 3, navigation, aggregation, or unrelated change. Focused Node 19/19, full Node 204/204, `npm run build`, and `git diff --check` passed. Implementation commit `d7e13e1d81472bfee956920e232c443f15f042e5` with `Project-State-Review: updated` was normally pushed to `origin/main`.
- GitHub/Vercel Production deployment `6619734326` completed successfully for that exact implementation SHA. The Production URL `https://cross-platform-shared-calendar.vercel.app/` returned HTTP 200 and its unauthenticated page showed the email login entry. Its JS and CSS assets returned HTTP 200; the active JS contained the Slice 2 space-switch and Personal bootstrap identifiers, confirming the v0.1.9 bundle is no longer the active entry point. The individual deployment URL requires Vercel authentication, so source attribution uses the successful GitHub deployment record plus public alias/asset evidence.
- The linked Production database read-only post-deployment query returned 2 Spaces, 3 memberships, and 0 Personal Spaces, unchanged from the earlier count baseline. No Production authenticated session, `ensure_personal_space()` invocation, Personal Space creation, or bulk backfill occurred. Authenticated A/B, Realtime, mobile, and PWA acceptance remain `NOT STARTED`; the user must close old tabs/PWA runtimes and reopen Production before testing. Once a Personal Space is created, v0.1.9 is not a safe rollback target for that account. Slice 2 remains open at `MANUAL_AUTH_ACCEPTANCE_CHECKPOINT`.

# 2026-09-24 - v0.1.10 Slice 2 Bootstrap Degradation Correction — Review Checkpoint

- Corrected authenticated bootstrap so a temporary `ensure_personal_space()` failure still leads to a read-only membership-visible Space list. A valid existing Shared Space stays usable under the unchanged remembered-selection → Shared → Personal priority, with a non-blocking Personal initialization warning and explicit retry. A list failure or no valid Space still blocks with retry. The retry calls only the controlled idempotent RPC, refreshes Spaces, and preserves a valid current Shared selection even when device storage is unavailable; an already-readable Personal Space resolves an ambiguous RPC response. No frontend Space/member insert or automatic retry was added.
- Added a narrow rollout exception to `AGENTS.md` and `docs/TESTING.md`: this Slice must deploy the compatible frontend before real-account bootstrap can create a second membership incompatible with v0.1.9's one-Space lookup. Local/static checks, environment alignment, code review, explicit Git/deployment authorization, unauthenticated asset verification, and old tab/PWA refresh precede user-run authenticated acceptance. The ordinary backend-first/local-frontend acceptance rule remains the default.
- Focused frontend Node tests 19/19, full Node suite 204/204, `npm run build`, and `git diff --check` PASS. Verification used mocks/static rendering only; authenticated Production acceptance and Production frontend rollout remain `NOT STARTED`. This correction did not use a Production authenticated session, call Production ensure, create/backfill a Personal Space, change backend/schema/RLS/RPC, install dependencies, commit, push, or deploy.

# 2026-09-23 - v0.1.10 Slice 2 Local Frontend Implementation — Review Checkpoint

- Replaced the one-Space loader with a membership-validated `spaces[] + selectedSpaceId` session contract. Authenticated bootstrap calls the idempotent `ensure_personal_space()` RPC once per successful frontend session before listing Spaces; a failed RPC shows an explicit retry state. Device selection is keyed by user ID and revalidated against current membership. Existing Shared users default to their oldest Shared Space; Personal-only users default to Personal Space. Opening the selector refreshes membership without invoking ensure again.
- A bounded selector lists Personal and Shared Spaces and exposes the existing Shared create/join RPCs. Their returned Space ID is selected only after it appears in a refreshed membership-visible list. Current-space content is keyed by `selectedSpaceId`: switching unmounts the old sheets and Space-local state, releases Event/Task Realtime channels, and invalidates pending member/Event/Task requests. Personal Event creation fixes personal scope and current owner; Personal Task creation uses null assignment, and both forms hide the Shared-only selectors. Personal Hub/Calendar omit invite controls. Shared Event/Task and two-member behavior remain unchanged.
- Focused Node tests cover bootstrap/selection/user isolation, ensure failure and retry, Shared create/join, request invalidation across Shared A → Personal → Shared B, Personal/Shared payload semantics, and static server-rendered UI. Focused 14/14, full Node 199/199, `npm run build`, and `git diff --check` PASS. This is local/static verification only. Authenticated Production acceptance = `NOT STARTED`; Production frontend rollout = `NOT STARTED`. No Production session/RPC call, Personal Space creation/backfill, backend/schema/RLS/Edge change, dependency, commit, push, or deployment occurred.

# 2026-09-23 - v0.1.10 Slice 1 Production Backend Rollout — PASS

- Reconfirmed the linked Production project `ximazjhxvmktpcdbypka` (`cross-platform-shared-calendar`, ACTIVE_HEALTHY), clean `main` at `f5adb32610c88b927e787284302080a92ca7cfc9`, and the absence of partial v0.1.10 objects. The final guarded forward patch ran once as its own `BEGIN` / `COMMIT` transaction, without repair or a second execution.
- Just-in-time and immediate postflight counts matched: 2 Spaces, 3 memberships, 13 Events, 0 Tasks. Aggregate MD5 fingerprints for Space identity, membership identity, Event identity, Task identity, and invite data were unchanged. Existing data invariants remained clear. Both old Spaces are `shared` with `tasks=true`; Personal Space count is 0 and no backfill occurred.
- Production catalog verified removal of `one_space_per_user_idx`, valid partial Personal unique index, `space_modules` PK/FK/check/RLS, member SELECT without direct client writes, owner-only module RPC, Personal membership/Event guards, compatible Shared create/join/rotate signatures and two-member cap, Task mutation RLS with historical SELECT, and unchanged Event/Task Realtime publication. Anonymous PostgREST probes recognized both new RPCs and returned `401 / 42501` (execute denied), confirming schema visibility without creating data. The existing Vercel page returned HTTP 200.
- The deployed v0.1.9 frontend remains the user-visible capability; its single-Space loader is safe while each current user has one Shared membership and no Personal Space exists. Production had no Task rows, so historical Task disable/re-enable behavior was not exercised there; local regression covers it. No frontend, Vercel, Edge Function, Reminder, recurrence, Personal creation/backfill, or secret change was made. Slice 2 is next.

# 2026-09-23 - v0.1.10 Slice 1 Local Backend Foundation — Complete

- Implemented the frozen multi-Space data and permission foundation in `supabase/schema.sql` and one guarded forward patch. Existing Spaces remain Shared; the one-user-one-Space index is removed; Personal Space uses a partial creator unique index, sole-owner membership guard, immutable kind/creator/invite code, and an authenticated, idempotent `ensure_personal_space()` RPC. Shared create/join RPCs permit membership in other Spaces while preserving the target's two-member cap and join lock.
- Added Space-level module rows with Tasks enabled for existing and new Spaces, absent future modules disabled, member SELECT, and an owner-only Tasks toggle RPC. Task SELECT remains available when disabled; RLS blocks insert/update/delete, including status and assignment changes. Personal Space Events are restricted to personal scope and the Space owner; Shared Event meaning and Task identity/authorization remain intact.
- The initial local test database run caught a membership-trigger DELETE return bug; corrected it so Shared membership deletion works while Personal owner deletion remains blocked. Security review also closed the direct Personal invite-code update path. Final focused migration replay used two disposable PostgreSQL databases: the exact v0.1.9 schema from commit `08bec32f` plus representative old Spaces/Events/Tasks, and the current fresh-install schema. The final forward patch ran exactly once on the old baseline with no repair. Full-row snapshots proved existing Space/member/Event/Task data unchanged, the old Space became Shared with Tasks enabled, and no Personal row appeared. Transactional behavior checks passed; 210 relevant schema/RPC/RLS/trigger/privilege catalog records matched fresh install. Real concurrent ensure calls were not executed; the transaction advisory lock and partial unique index remain the concurrency guard. Focused pgTAP 58/58, full DB 330/330, Node 185/185, build, and diff hygiene passed. Slice 1 is `COMPLETE / LOCAL VERIFIED`; Production preflight/rollout and Slices 2–3 have not started.

# 2026-09-23 - v0.1.10 Scope / Architecture Freeze

- Closed the repository-first Personal Space, Multi-space, and Module Enablement scope review as `CLOSED / READY FOR IMPLEMENTATION`. v0.1.10 implementation remains `NOT STARTED`; v0.1.9 remains `CLOSED / PASS` and the latest accepted Production capability.
- Froze partial Personal Space uniqueness (`UNIQUE(created_by) WHERE kind = 'personal'`), sole-owner membership enforcement, Personal Event/Task semantics, the existing Shared two-member limit, explicit selected-Space isolation, and Space-level Tasks enablement with preserved historical SELECT and blocked mutations while disabled. The detailed contract and three implementation slices are in `docs/SHARED_LIFE_ARCHITECTURE.md`.
- Froze staged rollout: backend capability may go first, but no automatic Personal Space creation or bulk backfill precedes compatible frontend readiness. The new frontend later calls idempotent `ensure_personal_space()` per user; older-account bulk backfill is considered only after real authenticated acceptance. This repository audit did not verify Production schema/index/RPC/RLS; preflight and rollout have not started.
- Updated governance/architecture docs only. No business code, SQL/schema, dependencies, Production, or external project files changed. Docs-only verification: `git diff --check`; no build or runtime test was needed.

# 2026-09-23 - v0.1.9 Shared Tasks MVP Final Closeout

- User-reported Production acceptance passed after the Vercel frontend deployment: Production page and existing Calendar worked; `👥 共享空间 · {space.name} ›` opened Space Hub → Tasks. Desktop A/B sessions saw Shared Task creation and title/assignment/due-date edits without refresh. Shared status transitions worked for either member; assigned transitions worked only for the assignee, with disabled controls for the other member. A member could reassign to self and then complete. Complete, Reopen, and confirmed Delete synchronized; Completed page worked.
- User-reported iPhone Production smoke passed for Tasks, Create/Edit Sheet, assignment and due date. No material horizontal overflow or control obstruction was observed. Slice 1/2/3 are `CLOSED / PASS`; v0.1.9 is the latest accepted user-visible Production capability. This closeout changes governance docs only; no application, database, Reminder, Event, or Production configuration change.
- v0.1.10 scope/design is next; implementation has not started. User-visible `Task / Tasks` copy is deferred for a Chinese “任务” pass at the start of v0.1.10, without renaming internal identifiers or adding full i18n.
- Closeout verification: focused existing Task Node/schema-contract tests 16/16 PASS; full existing Node suite 185/185 PASS; `npm run build` PASS; `git diff --check` PASS. No new test harness or database check was needed for documentation-only changes.

# 2026-09-23 - v0.1.9 Slice 3 Rollout Authorization

- User explicitly authorized the reviewed Slice 2 frontend rollout on `main`. Slice 3 is `ROLLOUT AUTHORIZED / IN PROGRESS`; Vercel deployment readiness and user-run Production acceptance are pending. v0.1.8 remains the latest accepted user-visible Production capability.
- Pre-push plan: create this minimal docs-only state update, push `main` normally, verify remote alignment, and stop at `PRODUCTION_MANUAL_ACCEPTANCE_CHECKPOINT`. No schema/RLS, business code, dependency, or authenticated browser change is part of this update.

# 2026-09-23 - v0.1.9 Slice 2 Manual Acceptance and Local Closeout

- User-run real A/B browser acceptance passed after the status-ownership correction and clearer Space entry. The `👥 共享空间 · {space.name} ›` control led Calendar → Space Hub → Tasks and returning preserved the date and Today/Week/Month view. A-created Shared Tasks and A edits to title, assignee, and due date reached B without refresh; Complete, Reopen, and Delete also synchronized. Delete required confirmation, and a non-creator current member could edit and delete.
- Shared Tasks allowed either member to Complete/Reopen. For Tasks assigned to B, A could neither Complete nor Reopen, while B could; A could take over via reassignment and then Complete in a second action. The same-UPDATE bypass is covered by the focused DB test. At 320px, Hub, Tasks, and Create/Edit Sheets passed; extreme-width Space-name ellipsis is accepted.
- Slice 2 is `IMPLEMENTED / MANUAL AUTH ACCEPTANCE PASS`; Slice 3 remains `NOT STARTED`. Production has the Task foundation and corrective backend patch, while Vercel/frontend Production remains at the accepted v0.1.8 capability. This closeout only records evidence and performs final verification/commit; no frontend deployment or push occurs.
- Final verification re-ran the actual repository checks: focused Task Node/schema-contract 16/16, focused Task foundation pgTAP 58/58, focused status-ownership pgTAP 15/15, full Node 185/185, full local DB regressions 272/272, `npm run build` PASS, and `git diff --check` PASS. Scope review found only the approved Slice 2, corrective SQL/tests, and related governance files.

# 2026-09-23 - v0.1.9 Slice 2 Shared Space Entry Discoverability Fix

- Real manual acceptance found the Calendar header Space name could be mistaken for a Calendar title. Changed only that existing button to a compact `Users` icon + `共享空间 · {space.name}` + chevron pill, preserving the real Space name and the existing Space Hub click handler.
- The button retains its 44px minimum touch height and truncates only the dynamic name at narrow widths. Calendar selected date and Today/Week/Month view state remain in the mounted Calendar component across Hub navigation. No Task CRUD/Realtime/status ownership, schema/RLS, Production backend, Vercel deployment, dependency, commit, or push change was made in this fix.
- Verification: existing Node suite 185/185 passed, `npm run build` passed, and `git diff --check` passed. Source review confirmed the original Hub click handler and parent-owned Calendar date/view state; 320px width is bounded by flex shrink and name truncation. User-run authenticated browser re-acceptance remains pending.

# 2026-09-23 - v0.1.9 Slice 2 Task Status Ownership Correction

- Real A/B acceptance exposed the former frozen rule: A could complete a Task explicitly assigned to B. Revised the product rule so Shared Tasks allow any current member to complete/reopen, while Assigned Tasks allow only the current assignee. Ordinary title/due-date/assignment edits and delete remain collaborative; takeover requires a separate assignment UPDATE before status change.
- Added one BEFORE UPDATE Task trigger/function to fresh-install `supabase/schema.sql` and a small guarded corrective patch. The trigger checks `OLD.assigned_to_user_id` only when status changes, preventing a same-UPDATE reassignment plus completion bypass. Existing RLS, Task rows, Event, Reminder, recurrence, and RPCs were not changed. Frontend hides active Complete/Reopen controls for another member's assigned Task while retaining edit access; the DB trigger is authoritative.
- TDD: focused pgTAP reproduced 3 failing assertions before the correction, then passed 15/15. Full local DB regression 272/272, focused Task Node/source-contract 16/16, full Node 185/185, `npm run build`, and `git diff --check` passed. Production preflight confirmed the original Task foundation and absence of corrective objects; applied only the new patch. Postflight confirmed enabled trigger, expected function, unchanged existing schema fingerprint, and zero Task rows before/after. The 5175 frontend and linked Production backend remain aligned.
- Updated canonical scope, decision, testing, backlog, and project-state records. User-run authenticated re-acceptance remains pending; no Codex logged-in browser testing, frontend deploy, Vercel deploy, commit, push, reset, truncate, or Slice 3 work occurred. The separate Space entry discoverability defect remains for review after manual acceptance.

# 2026-09-23 - v0.1.9 Slice 1 Production Backend Alignment and Acceptance Gate

- The local 5175 Vite frontend was confirmed to target the same remote Production Supabase project as the linked CLI. The reviewed Slice 1 patch was unchanged from HEAD. Read-only Production preflight found PostgreSQL 17.6, all required Space/member prerequisites, no `public.tasks` or partial Task objects, and captured a non-Task public-schema fingerprint.
- Applied only `supabase/patches/2026-09-22-v0.1.9-shared-tasks-slice1.sql` to Production. Read-only postflight verified the nine-column Task table, six constraints including column-specific assignment FK, four member RLS policies, immutable identity and timestamp triggers, authenticated CRUD grant, list index, Realtime publication, `REPLICA IDENTITY FULL`, zero Task rows, and unchanged non-Task public-schema fingerprint. A zero-row unauthenticated PostgREST probe returned HTTP 200, confirming schema-cache readiness.
- Added the Authenticated Integration Readiness Gate, backend-first additive rollout rule, and user-owned real-account/browser/device acceptance to AGENTS, Testing, and Decisions. Slice 2 frontend is implemented locally with 8/8 focused Node tests, 182/182 full Node tests, build, and diff check previously passing; its authenticated manual acceptance remains pending. Record the Calendar header Space entry's weak discoverability as a UI defect to assess after this manual acceptance, without changing the UI now.
- No Slice 2 frontend code, reviewed SQL patch, Event/Reminder/recurrence foundation, Vercel deployment, secret, dependency, commit, or push changed in this step. v0.1.8 remains the latest accepted user-facing Production capability; Slice 3 has not started.

# 2026-09-23 - v0.1.9 Slice 2 UI Freeze (Docs Only)

- Inspected the existing Calendar shell: the current Space name is already in the header, while Member Sheet, InvitePanel, and mobile bottom Sheet patterns already exist. Froze that Space-name control as the only new Calendar entry into a minimal current Space Hub, with local-screen back navigation preserving the Calendar date/view and no routing or shell redesign.
- Froze the Hub's actual Space name, existing member/invite abilities, and one live Tasks count row; the Open Tasks page with due-date/null/stable ordering and a collapsed Completed count entry; and a separate all-Completed list with view/edit/reopen/delete. Defined create/edit Sheet fields, completion and reopen actions, confirmed deletion, member-name fallbacks, one-member behavior, 320px mobile layout, and two authenticated sessions' no-refresh Realtime acceptance sequence. The user reviewed and approved the UI Freeze. `profiles.display_name` takes priority; `我 / 对方` are contextual fallbacks for this two-member stage only, not a long-term identity model. Future Multi-space / multi-member UI uses generic member display logic.
- Updated `docs/v0.1.9_SHARED_TASKS_SPEC.md`, `docs/TESTING.md`, and `docs/PROJECT_STATE.md`. Final state is `V019_SLICE2_UI_FROZEN` / `V019_SLICE2_IMPLEMENTATION_NOT_STARTED`. No business code, SQL/schema/RLS, dependency, Production resource, deployment, or secret was changed or inspected. Docs-only verification: `git diff --check` passed.

# 2026-09-23 - Shared Life Architecture Docs-Only Freeze

- Froze the long-term `首页 / 日历 / 空间 / 我的` navigation, Personal and multiple Shared Spaces with single canonical ownership per object, per-Space Calendar core and optional module enablement, Space-backed and global/external Calendar Sources, and the privacy-confirmed future global create flow in `docs/SHARED_LIFE_ARCHITECTURE.md`. Review / Check-in is distinct structured content; voice technology and Task Archive remain deferred.
- Revised the directional roadmap to v0.1.10 Personal Space/Multi-space/module enablement, v0.1.11 navigation/aggregation, v0.1.12 Lists, v0.1.13 Important Dates, v0.1.14 Review, and v0.1.15 Calendar Sources. Native has a decision gate rather than an implementation version.
- Amended v0.1.9 Slice 2 to reach Tasks through the existing current Space and a bounded reusable Space Hub entry. The former top-level `Calendar / Tasks` switch is superseded. Slice 1 remains locally verified; Slice 2 remains not started and requires explicit approval of this amended UI scope.
- This change updates governance/design documentation only. Business code, SQL/schema/RLS, dependencies, Production, deployment, and the accepted v0.1.8 Reminder capability remain unchanged. `git diff --check` passed; runtime tests and build were not required for a docs-only freeze.

# 2026-09-22 - v0.1.9 Slice 1 Task Persistence and Authorization

- Implemented the local-only `public.tasks` foundation in both `supabase/schema.sql` and the additive `2026-09-22-v0.1.9-shared-tasks-slice1.sql` patch. The table contains exactly the nine frozen fields, deterministic title/status constraints, date-only `due_on`, shared timestamp handling, immutable `space_id` / `created_by`, direct authenticated CRUD grants, four member-scoped RLS policies, `REPLICA IDENTITY FULL`, and existing-publication Realtime membership. No Task CRUD RPC was added.
- Verified the actual local Supabase target is PostgreSQL 17.6 and selected the FK-native member-leave solution: `(space_id, assigned_to_user_id)` references `space_members(space_id, user_id)` with column-specific `ON DELETE SET NULL (assigned_to_user_id)`. Tests prove the Task and `space_id` survive while assignment becomes shared. The one list index is `(space_id, status, due_on, created_at, id)` to match the frozen stable order.
- Added focused pgTAP coverage for schema, constraints, owner/non-owner member creation, member/shared/cross-Space assignment, member removal, collaborative CRUD, former/non-member isolation, creator forgery, immutable identity, grants, and Realtime metadata, plus a bootstrap/patch source-contract test. TDD RED failed on the absent table/patch; GREEN passed 58/58 focused pgTAP, 257/257 full database regression, 14/14 schema-contract tests, and `git diff --check`.
- No frontend, `App.tsx`, Event, Reminder, recurrence, Multi-space, dependency, Production, Vercel, deployment, commit, or push change was made. Slice 2 remains not started and requires explicit approval after evidence review.

# 2026-09-22 - v0.1.9 Shared Tasks MVP Docs-Only Scope Freeze

- Froze `v0.1.9 — Shared Tasks MVP` as `SCOPE FROZEN / IMPLEMENTATION NOT STARTED`. Added the canonical specification covering Task/Event semantics, the one-table data contract, collaborative permission model, Realtime reuse, Calendar/Reminder boundaries, complexity budget, minimal UI, risks, deferred scope, acceptance criteria, and three bounded implementation slices.
- Froze creator attribution without creator-only permission; same-Space member or shared assignment as responsibility rather than access control; `open` / `completed`; optional date-only `due_on`; no completion audit; and assigned-member departure converting the Task to shared. The departure behavior is fixed while the smallest target-compatible FK action or narrowly scoped trigger remains a Slice 1 implementation decision.
- Recorded `MULTISPACE_NOT_REQUIRED_FOR_V019`. Tasks must persist explicit `space_id` and introduce no new one-space-only assumption, while Multi-space lifecycle, onboarding, selector, and broad RLS work remain separate future scope.
- Preserved the Calendar/Task boundary and left `v0.1.8 — Mobile Push Reminder` `CLOSED / PASS`. No Task Reminder, Event generation, Reminder persistence/sender/ledger/Cron/Web Push change, recurrence integration, or dual persistence was authorized.
- Updated README, Decisions, Backlog, Testing, and Project State to point to the canonical spec and make Slice 1 the next action only after explicit implementation approval. No application source, schema, SQL patch, RLS, dependency, configuration, Production resource, deployment, secret, or Slice 1 implementation changed; no push was performed.

# 2026-09-22 - v0.1.8 Final Cross-Platform Acceptance + Release Closeout

- Closed `v0.1.8 — Mobile Push Reminder` as `CLOSED / PASS`. Mac and iPhone Production Push / automatic Reminder acceptance were already PASS; Android final functional acceptance completed on Android Studio Emulator.
- Android emulator evidence passed for notification permission/subscription, `send-test-push`, ordinary automatic Event Reminder, audible notification, and presence in the Android notification shade. A heads-up/top-screen banner was not observed. This evidence is emulator-based, not physical Android hardware evidence; physical-device heads-up presentation remains an optional future revalidation and does not reopen v0.1.8. Notification-click PASS is not asserted because it was not independently confirmed in the supplied completion evidence.
- Final read-only health review found the Supabase Production project Healthy, 100% request success over the displayed recent window, and zero displayed Postgres or Edge Function warnings/errors. The already accepted `send-reminders` v2, `send-test-push` v4, one active scheduler, healthy recent Cron/HTTP results, zero stuck claims, zero duplicate delivery identities, and zero unexpected subscription disablement remain the canonical closeout state. No Production mutation, Function invocation, scheduler/Vault/secret change, business-code change, or new acceptance harness was performed.
- Retained the Web/PWA delivery-precision future consideration without changing semantic due, adding early dispatch, or redesigning the scheduler. Next action is to define / confirm v0.1.9 scope before implementation; this closeout does not define or implement v0.1.9.

# 2026-09-22 - v0.1.8 Slice 3 Production Acceptance + Governance Closeout

- Completed the bounded Slice 3 Production rollout. Applied only `supabase/patches/2026-09-22-v0.1.8-slice3-recurrence-reminders.sql` once; postflight confirmed nullable `occurrence_date`, `NULLS NOT DISTINCT` recurring identity, preserved ordinary ledger rows, RLS/ACL boundaries, the service-role-only hardened recurring claim, canonical Event timezone constraint, and split-marker inheritance. Deployed only `send-reminders` v2 with `verify_jwt=false`; the existing single once-per-minute scheduler, Vault secret, and `send-test-push` v4 remained unchanged.
- Production acceptance passed for the deployed frontend and automatic scheduler: normal recurring Reminder delivered to iPhone and Mac; only-this override inherited the Reminder and delivered automatically with effective title/schedule; only-this delete was excluded by the canonical recurrence and Reminder projections with zero ledger/claim/send; this-and-future split created exactly one child with inherited Reminder/timezone/rule, a fresh marker, exclusive parent cutoff, one logical identity, preserved prior override/delete semantics, and no catch-up delivery.
- Final health checks found `send-reminders` ACTIVE v2, exactly one active scheduler, 10/10 recent Cron runs and HTTP 200 responses, zero stuck claims, zero duplicate delivery identities, zero unexpected subscription disablement, and zero ledger rows created by the split. Focused all-day/timezone verification passed 26/26, including recurring same-day 08:00, previous-day 20:00, canonical timezone, DST gap/overlap, a non-1-hour transition, and a full date-line/day transition. A real next-day all-day Push wait was not required.
- Future consideration — Web/PWA Push delivery precision: semantic due calculation remains exact, while once-per-minute `pg_cron` + async `pg_net` + Web Push may occasionally add sub-minute to approximately one-minute visible delivery latency. The observed recurring example had semantic due 11:45 and claim/finalize around 11:46; this is not a due-calculation defect. v0.1.8 adds no `-60s` early-dispatch allowance and keeps ordinary/recurring timing under the same semantic rule. Revisit only if real-use feedback shows material UX impact or a future native iOS/Android app adopts OS-level local notification scheduling.
- Slice 3 is `CLOSED / PASS`. Overall v0.1.8 remains OPEN only for separately authorized final cross-platform / Android acceptance. No Android acceptance, v0.1.9 scope, runtime timing change, scheduler change, secret rotation, ledger deletion, or new feature was performed.

# 2026-09-22 - v0.1.8 Slice 3 Final Human/Code Review PASS

- Completed the final bounded read-only re-review after the long-duration projection correction. No BLOCKER / MAJOR / MINOR findings remain; Slice 3 local implementation, automated verification, and human/code review are PASS and the source is ready for the authorized commit/push closeout.
- Confirmed the correction remains isolated to the Reminder projection adapter: a non-mutating `ends_at = null` source view enters the one canonical recurrence engine, while original source identity/revisions/marker, exception revalidation, ordinary Reminder behavior, the 500-candidate guard, and calendar duration-overlap semantics remain unchanged. No second recurrence engine, dependency, queue/retry framework, product table, materialized occurrence table, Edge Function, or Cron job was added.
- Slice 3 remains not deployed. Production ordinary Reminder delivery/scheduler, Vault/Cron/secrets, deployed Functions, and Production data are unchanged; overall v0.1.8 remains OPEN and Android final cross-platform acceptance remains deferred. The next business action after source closeout is a separately authorized bounded Slice 3 Production rollout.

# 2026-09-22 - v0.1.8 Slice 3 Long-Duration Projection Correction

- Human/code review found one blocker: Reminder projection passed the source Event duration into canonical calendar expansion, so a valid daily Event lasting more than 500 intervals could exhaust the unchanged candidate guard before the current due occurrence.
- Added the bounded Reminder-only correction in `send-reminders/recurring.ts`: a non-mutating source view with `ends_at = null` is used only for recurrence projection. The original source still supplies scheduled identity, snapshots, marker, recipient/audit context, and split lineage; canonical calendar expansion, the 500-candidate cap, due calculation, ordinary delivery, RPC/DB behavior, and scheduler remain unchanged.
- TDD reproduced the exact pre-fix error, then verified the same case returns two bounded candidates with one currently due occurrence and no projection error. Focused recurrence/Reminder passed 46/46; bounded recurring/recurrence/send-reminders/timezone/due checks passed 76/76; full Node passed 169/169; strict Deno checks for recurring projection, Reminder logic, and canonical recurrence passed; `npm run build` and `git diff --check` passed. The prior unchanged pgTAP result remains 199/199 and was not rerun because no DB file changed. Production, external project files, dependencies, commit, push, and deployment were untouched. Slice 3 remains OPEN pending final human/code re-review.

# 2026-09-22 - v0.1.8 Slice 3 Recurrence Reminder Local Implementation

- Completed the bounded local Slice 3 implementation after all four hard prechecks passed. Browser/Node/Deno share the canonical recurrence engine; no second recurrence/DST implementation, occurrence materialization, queue, retry framework, new Edge Function, Cron job, or dependency was added.
- Enabled event-level Reminder persistence/UI for recurring source Events while keeping only-this Reminder inherited/read-only. `send-reminders` now projects normal and effective override occurrences in a timezone/calendar-bounded window, omits deleted/cutoff occurrences, preserves current recipients/subscriptions, aborts source/exception overflow before claims/sends, and retains the existing 50-task/five-worker shared-sender pipeline.
- Added nullable ledger `occurrence_date` with `NULLS NOT DISTINCT` identity, preserving ordinary rows and distinguishing colliding recurring occurrences by logical series plus scheduled date. Added a service-role-only hardened recurring claim that atomically revalidates exact source/exception snapshots, membership/subscription, effective schedule marker, due/grace, and idempotency without SQL recurrence expansion. Split children now inherit Reminder/timezone and receive a fresh schedule marker.
- Automated verification passed: focused recurrence/Reminder 45/45; full Node 168/168; all six local pgTAP files 199/199; strict Deno checks; `npm run build`; and `git diff --check`. No Production, deployment, Vault/Cron/secret, external project file, commit, or push change occurred. Slice 3 is ready for human/code review but not closed; Android final acceptance remains deferred and overall v0.1.8 remains OPEN.

# 2026-09-22 - v0.1.8.2 P3C Automatic Scheduler E2E + Governance Closeout

- Enabled only `pg_cron` and `pg_net` in their canonical Production schemas after confirming exactly one Vault `REMINDER_CRON_SECRET` by name, zero existing Reminder jobs, `send-reminders` ACTIVE v1 / `verify_jwt=false`, and C1 PASS with zero claimed rows. Created exactly one active `send-reminders-every-minute` job on `* * * * *`; its exact stored command targets Production `send-reminders`, resolves the bearer from Vault only at execution time, uses a 120000 ms timeout, and contains neither plaintext secret nor service-role bearer. Unschedule-first remains the canonical containment rule.
- Automatic no-due scheduler verification passed with zero enabled ordinary Reminder candidates, zero delivery work, unchanged ledger/subscriptions, successful Cron execution, and HTTP 200 pg_net responses. No manual `send-reminders` invocation was used for the final automatic test.
- One disposable personal timed `Automatic Reminder E2E Test` Event was discovered by the scheduler and automatically delivered to both active subscriptions. iPhone and Mac both displayed the real Reminder. Ledger postflight confirmed exactly two rows across two distinct subscriptions and one due, all `sent`, with zero remaining `claimed`, zero `failed`, zero duplicate identities, and zero unexpected subscription disablement.
- Repeated scheduled invocations within the same due/grace window produced eight aggregate claim rejections across four idempotent responses, while total claimed/sent remained two and no extra row or Push was created. A bounded 120-minute postflight recorded 120/120 successful Cron runs and HTTP 200 responses, at most one run per minute, zero timeouts/errors, zero persistent claimed rows, and zero sensitive diagnostic markers.
- P3C is `CLOSED / PASS`; `v0.1.8.2` Slice A/B/C are now `CLOSED / PASS`. Overall v0.1.8 remains open for the already-frozen Slice 3 Recurrence Reminder Integration and later final cross-platform/Android acceptance. No code, SQL source, config, dependency, Function deployment, C1 change, secret rotation/value access, ledger deletion, subscription mutation, or Production test-data deletion occurred during this postflight/governance closeout.

# 2026-09-22 - v0.1.8.2 P3B send-reminders Production Manual E2E Closeout

- Completed the authorized P3B Production rollout on canonical project `ximazjhxvmktpcdbypka` with `send-reminders` ACTIVE and source-controlled `verify_jwt = false`; `send-test-push` remained ACTIVE v4 and reviewed-equivalent. The Edge `REMINDER_CRON_SECRET` was confirmed by name only; its value was never read or logged.
- Missing and invalid Bearer checks returned HTTP 401 before database work. The authorized no-due invocation returned HTTP 200 with zero eligible, claimed, sent, and failed work and no side effects.
- One disposable ordinary personal timed Event using `timed_10m_before` produced one recipient, two active subscriptions, two delivery tasks, two claims, and two sent results with zero failures or finalize errors. The iPhone received the real system notification with correct title/body/click behavior.
- Mac backend delivery also succeeded; visible presentation was initially suppressed while macOS Sleep/Focus was active. After that state was cleared, the existing `send-test-push` regression passed. This does not indicate a `send-reminders` delivery regression.
- A repeat invocation in the same due/grace window returned two claim rejections, zero new claims, zero sends, and no duplicate notification. Ledger postflight confirmed two finalized `sent` rows, zero remaining `claimed`, zero `failed`, zero duplicate identities, zero unexpected subscription disablement, and zero unexpected ledger rows.
- P3B is `CLOSED / PASS`. No disposable Event cleanup was performed through SQL and no ledger rows were deleted. Cron remains OFF; Vault, pg_cron, and pg_net remain untouched; P3C scheduler activation requires separate authorization.

# 2026-09-21 - v0.1.8.2 P3A C1 Production Foundation Final Closeout

- Applied exactly the reviewed `supabase/patches/2026-09-21-v0.1.8.2-reminder-delivery-acl-correction.sql` once to canonical Production project `ximazjhxvmktpcdbypka`; neither the original C1 patch nor any broad migration command was rerun. The transaction completed successfully and changed only the existing `public.reminder_deliveries` table ACL.
- Final effective privileges are the frozen contract: `service_role` SELECT / UPDATE allowed and INSERT / DELETE / TRUNCATE / REFERENCES / TRIGGER / MAINTAIN denied; anon/authenticated have no direct table privileges. The ledger remains at zero rows; 10 columns, five constraints, UUID primary key, unique idempotency key, zero foreign keys, enabled updated-at trigger, RLS, zero policies, and no Realtime publication all pass.
- The atomic claim function remains exactly one UUID-returning SECURITY DEFINER function with hardened `pg_catalog, pg_temp` search path, unchanged definition hash/body contract, service-role execute, and anon/authenticated execute denial. Events, Push subscriptions, and Space members column/constraint/index/policy/trigger/publication fingerprints were unchanged; all five Reminder persistence constraints and the schedule-marker trigger remain present.
- Phase 3 isolation remained intact: `send-test-push` is ACTIVE v3; `send-reminders`, `REMINDER_CRON_SECRET`, Vault Reminder secret, pg_cron, and pg_net remain absent; no Cron, claim invocation, Push, Event/test data, or subscription mutation occurred. `C1_PRODUCTION_FOUNDATION = PASS`; P3A is closed, Slice C remains open, and P3B requires separate authorization.

# 2026-09-21 - v0.1.8.2 P3A C1 ACL Corrective RCA

- Completed a read-only Production catalog RCA for `public.reminder_deliveries`. The table is owned by `postgres`; `service_role` is not owner or superuser, inherits no other role, and has no PUBLIC/other-role grant path. The `postgres` default table ACL for schema `public` grants all eight table privileges to `service_role`, which were materialized as direct ACL entries when C1 created the table. The original `GRANT SELECT, UPDATE` was additive and did not remove those existing privileges.
- Prepared the additive, table-local `supabase/patches/2026-09-21-v0.1.8.2-reminder-delivery-acl-correction.sql`. It revokes all table privileges from `service_role` and grants back only SELECT / UPDATE; it does not change rows, ownership, default/global privileges, RLS, function ACL, or any other object. The original deployed C1 patch remains unchanged at SHA-256 `81c40c715d6cd52cecc5f4f19835b6612ddafc7daaecdd1aa82d85b6bb6de629`.
- Expanded the existing C1 pgTAP contract from 63 to 67 assertions for denied TRUNCATE / REFERENCES / TRIGGER / MAINTAIN. Local RED reproduced exactly those four failures; applying the new patch to the local database only produced 67/67 PASS. Bounded human/code review passed with no findings: the transactionally ordered table-local revoke/re-grant is sufficient and default ACLs will not reapply to the existing table. Production was not modified; no deployment, function, secret, Vault, pg_cron, pg_net, Cron, Push, or business-data operation occurred.

# 2026-09-21 - v0.1.8.2 P3A Production C1 Foundation Stopped at ACL Gate

- Verified the canonical clean repository baseline and exact C1 patch SHA-256, then repeated Production catalog preflight against project `ximazjhxvmktpcdbypka`: C1 objects were absent, all required Slice B/Event/member/subscription prerequisites were present, Reminder extensions/secrets were absent, and structural fingerprints were captured without reading business rows.
- Applied only `supabase/patches/2026-09-21-v0.1.8.2-reminder-delivery.sql` once through `supabase db query --linked --file`. The ledger and atomic claim function were committed; the ledger remained empty; table columns/constraints/trigger/RLS/no-policy/no-Realtime checks passed; the function signature, hardened search path, SECURITY DEFINER, body contract, and service-role-only execute boundary passed; existing Event/push/member fingerprints remained unchanged.
- P3A stopped because Production granted `service_role` direct INSERT / DELETE / TRUNCATE and additional broad table privileges despite the reviewed SELECT / UPDATE-only contract. No privilege correction, patch rerun, cleanup, function deployment, secret, Vault, pg_cron, pg_net, Cron, Push invocation, test Event, or business-data mutation followed. `send-test-push` remains ACTIVE v3, `send-reminders` remains absent, and `C1_PRODUCTION_FOUNDATION = STOPPED / INVESTIGATION_REQUIRED` pending separate authorization.

# 2026-09-21 - v0.1.8.2 Phase 3 Repository Auth Configuration Preparation

- Added the minimal source-controlled `[functions.send-reminders] verify_jwt = false` configuration while preserving `[functions.send-test-push] verify_jwt = true`. This allows the future scheduler's custom bearer to reach the existing `send-reminders` application-auth boundary without relying on a one-off deployment flag.
- Reconfirmed that the exact `Authorization: Bearer <REMINDER_CRON_SECRET>` check runs before the authorized `run` callback creates the Supabase admin client or performs database work. No real secret was generated, read, printed, committed, or added to a frontend/VITE variable; the service-role key remains server-side database authorization rather than the scheduler bearer.
- Focused verification passed: `node --test tests/send-reminders.test.ts` (26/26), Deno checks for `send-reminders/logic.ts` and `send-reminders/index.ts`, and `npm run build`. Bounded human review passed with no findings. No function code, C1 SQL, schema/migration, shared sender, `send-test-push`, frontend, Service Worker, dependency, Production resource/data, deployment, secret, Vault, pg_cron, pg_net, Cron job, or push changed. C1 and `send-reminders` remain undeployed; Slice C remains open and the push authorization remains separate.

# 2026-09-21 - v0.1.8.2 C2 Phase 2 send-reminders Local Implementation

- Implemented the bounded `send-reminders` Edge orchestration with exact bearer authentication before database work, fixed-run context, stable `id` keyset scanning in pages of 100, an explicit 1001st-row abort, canonical Reminder due calculation, current-recipient resolution, and active-installation filtering. Candidate overflow returns a safe HTTP 409 aggregate response before membership, claim, or Push work.
- Added deterministic due/Event/recipient/subscription ordering and a hard 50-task cap, C1 atomic claim integration with the exact raw schedule marker, the existing shared Web Push sender, closed result-to-ledger mapping, 404/410 subscription retirement, exact-one-row finalize verification, five-worker concurrency, and a 95-second new-claim cutoff. Already-claimed work completes; there is no retry, queue, lease, recurring delivery, or compensation path.
- Used TDD throughout, including a review-found RED case proving that the runtime budget must be rechecked immediately before claim acquisition after asynchronous tag generation. Focused `send-reminders` coverage passed 26/26; the full Node suite passed 153/153; Deno checks passed for the orchestration logic, Edge entry, and shared sender; `npm run build` and `git diff --check` passed.
- Bounded human/code review passed with no BLOCKER / MAJOR / MINOR findings. The implementation is ready for local commit/push closeout, but remains not deployed; C1 Production objects remain undeployed, reminder Cron/Vault/`REMINDER_CRON_SECRET` remain unconfigured, and Slice C remains open.

# 2026-09-21 - v0.1.8.2 Due Calculator DST-Gap Performance Correction

- C2 Phase 2 pre-implementation review found that the frozen `zonedDateTimeToInstant()` gap fallback could perform 2161 minute probes per calculation. A 1000-call valid New York DST-gap benchmark exceeded the hosted Edge CPU budget, so `send-reminders` implementation remained stopped.
- Added focused characterization for ordinary local time, New York gap/overlap, the legal two-hour `Antarctica/Troll` gap, and the existing non-zero-millisecond fallback output. Existing Reminder previous-day/all-day and recurrence DST tests continue to lock their established outputs.
- Replaced only the proven forward-gap hot path with a bracketed binary search over the existing minute probe grid. Reminder kinds, due/recurrence/timezone contracts, gap first-valid-minute behavior, overlap earlier-instant behavior, and the legacy non-gap fallback remain unchanged; no cache, dependency, second timezone engine, SQL calculation, or broader refactor was added.
- The same-machine 1000-call benchmark improved from Deno `7099.71 ms` / Node `9950.7 ms` before the change to Deno `144.06 ms` / Node `142.47 ms` after it. A separate oracle comparison across 33 New York, Troll, Lord Howe, Chatham, and Apia cases, including non-zero milliseconds and gap sizes from 30 minutes to a full day, found zero output differences.
- Verification passed: focused timezone/Reminder/recurrence 38/38, full Node 127/127, Deno checks for timezone, due, benchmark, shared Web Push, and `send-test-push`, plus `npm run build` and final diff hygiene. C2 Phase 2 and `send-reminders` remain not started pending human review of this corrective patch.

# 2026-09-21 - v0.1.8.2 C2 Phase 1 Acceptance + Real-Device Closeout

- Human review passed after deploying only the refactored `send-test-push` Edge Function. Desktop Chrome/macOS returned `status = 201`, `delivered = true`, `provider = fcm.googleapis.com`, `gone = false`; the notification title/body and click behavior passed.
- iPhone installed PWA test push, actual notification delivery, title/body, click-to-open/focus behavior, and Desktop subscription isolation all passed.
- The repeated Desktop banner observation was read-only RCA-classified as pre-existing/non-blocking: the fixed `shared-calendar-test` tag and unchanged Service Worker behavior predate C2 Phase 1. No tag or `renotify` behavior changed.
- C2 Phase 1 is now `CLOSED / PASS`. `send-reminders`, candidate scanning, Cron, secrets, database changes, and C2 overall closeout remain unstarted/open. The next approved action is C2 Phase 2 `send-reminders` implementation planning after the Phase 1 commit is pushed.

# 2026-09-21 - v0.1.8.2 Slice C2 Phase 1 Shared Web Push Sender Extraction

- Confirmed TDD RED before production changes: the new shared sender and its source contract were absent. Added a focused `tests/web-push.test.ts` suite plus `send-test-push` regression/source assertions for the shared integration, CORS, auth/user scoping, installation targeting, fixed payload, 404/410 retirement, response shape, package pin, server-only boundary, and non-sensitive diagnostics.
- Added server-only `supabase/functions/_shared/web-push.ts` with the exact `@mmmike/web-push@1.3.0` transport, VAPID loading, existing HTTPS endpoint allowlist, hostname-only provider extraction, TTL 60, timeout 10000 ms, normal urgency, safe status capture, and the closed `delivered` / `subscription_gone` / `provider_rejected` / `network_timeout` / `network_error` / `invalid_sender_result` union. The explicit transport injection seam exists only for Node tests; no root/browser dependency or generic provider framework was added.
- Migrated `send-test-push` to the shared sender while retaining its CORS, OPTIONS/POST boundary, 4096-byte/JSON validation, JWT authentication, installation UUID validation, user-scoped lookup/disable, fixed test payload, and external `status` / `delivered` / `provider` / `gone` response contract. Logs/results contain no endpoint, subscription keys, VAPID values, payload body, raw provider body, or raw transport error.
- Automated verification passed: focused sender + test-push tests 29/29; full `node --test tests/*.test.ts tests/*.test.js` 123/123; Deno checks for the shared module and function entry; `npm run build`; and `git diff --check`. Real Desktop Chrome/macOS and iPhone installed-PWA test-push regression remains pending and requires a separately authorized deployment.
- Scope remained Phase 1 only: no `send-reminders`, candidate scan, delivery claim/ledger change, Cron, secret, Vault, database, Service Worker, Production deployment, commit, or push. Slice C2 and Slice C remain open.

# 2026-09-21 - v0.1.8.2 Slice C1 Minimal Delivery Ledger + Atomic Claim

- Implemented the approved local-only C1 boundary: one durable `reminder_deliveries` table, minimum `claimed` / `sent` / `failed` constraints, unique `(event_id, subscription_id, due_at)`, no Event/user/subscription foreign keys, and no Realtime publication. RLS is enabled; anon/authenticated have no table access; `service_role` receives only select/update table privileges and must use the atomic function for inserts.
- Added exactly one `SECURITY DEFINER` `claim_reminder_delivery(...)` function with a fixed `pg_catalog, pg_temp` search path and service-role-only execute. It captures `claim_now` once and uses one atomic `INSERT ... SELECT ... ON CONFLICT DO NOTHING RETURNING` to revalidate ordinary Reminder state, exact schedule marker, current shared/personal membership, active recipient-owned subscription, due bounds, and the ten-minute grace window.
- Established the precision contract that `reminder_schedule_changed_at` must round-trip at full PostgreSQL `timestamptz` precision. C1 does not calculate due time, mutate Events/subscriptions, send Push, create retries, or add an Edge Function/Cron/secret/provider integration.
- Confirmed TDD RED before implementation because the table/function were absent. Final C1 pgTAP passed 63/63; the complete local database suite passed 161/161 including Slice B 28/28. Four concurrent identical claims produced one UUID and one ledger row; sequential duplicate, rejection matrix, permissions, constraints, and audit survival all passed.
- Final code verification passed: Node 114/114, Slice A due 9/9, recurrence 25/25, both existing Deno checks, `npm run build`, and `git diff --check`. Docker Desktop exited once during regression startup; the existing local database container was restarted without reset, rebuild, or volume deletion.
- No dependency, frontend/business UI, sender, Edge Function, Cron, Vault, Production database, deployment, commit, or push changed. Slice C1 is implementation complete / under review; Slice C overall remains open.

# 2026-09-20 - v0.1.8.2 Slice B Production Human Acceptance + Governance Closeout

- Completed the user-owned Production browser acceptance for the deployed Slice B frontend — PASS. New timed reminders defaulted to 10 minutes before; new all-day reminders defaulted to 08:00; timed/all-day conversions, null preservation, timed 1-hour and all-day previous-day 20:00 presets, persistence, schedule edits, and disablement behaved as specified.
- Confirmed recurring reminders remain unavailable, title-only and description-only edits do not rewrite the schedule, ordinary schedule edits reopen without Reminder anomalies, A-created-B-owned personal Events remain read-only to A while B can edit, shared and own personal CRUD pass, and ordinary Event plus shared Reminder Realtime propagation pass.
- Historical ordinary Event browser coverage was N/A because Production had no pre-Slice-B ordinary fixture. The frozen historical `reminder_kind = null`, ordinary `time_zone = null`, no-auto-enable, recurring-timezone, constraint, trigger, RLS, ownership, and Realtime semantics were already covered by the disposable ordered-upgrade, Slice B pgTAP 28/28, and the complete database regression suite 98/98. Timezone detection failure and seconds/milliseconds preservation remain automated checks; the browser acceptance only verified visible schedule preservation for title/description edits.
- v0.1.8.2 Slice B is now `CLOSED / PASS`. No business code, SQL, database, Production data, Slice C implementation, or unrelated files changed during this governance closeout; only canonical project documentation was updated.

# 2026-09-20 - v0.1.8.2 Slice B Persistence + Event Mutation/UI

- Implemented the approved additive Event persistence contract: nullable `reminder_kind`, nullable canonical `time_zone`, DB-owned non-null `reminder_schedule_changed_at`, five minimum CHECK constraints, and one validation/schedule-marker trigger function + trigger. Added a guarded incremental patch and kept the canonical bootstrap schema aligned.
- Historical ordinary Events remain reminder/timezone null; historical recurring rows backfill timezone only from `recurrence_rule.time_zone`. The existing split RPC now copies source `events.time_zone` to its child without changing projection, cutoff, exception, or DST semantics.
- Added the small existing-sheet Reminder selector, timed/all-day defaults and visible conversion, recurring Reminder disablement, read-only presentation, canonical timezone preservation, and controlled capture failure. Timezone detection never falls back to UTC and failed capture performs no mutation.
- Ordinary Event updates now use a field-level payload builder. Title/description-only edits no longer resubmit schedule fields, unchanged `datetime-local` values preserve stored seconds/milliseconds, protected identity fields remain absent, and empty payloads skip the UPDATE.
- Recovered the local Docker/Supabase stack without reset or volume deletion. Disposable ordered-upgrade passed; Slice B pgTAP passed 28/28 and the complete database regression suite passed 98/98 after restoring the existing local v0.1.8.1 prerequisite.
- Production read-only preflight passed with no schema drift. Applied only `supabase/patches/2026-09-20-v0.1.8.2-reminder-persistence.sql`; postflight confirmed three columns, five constraints, marker function/trigger, historical-null policy, recurring timezone backfill, RLS/owner validation/Realtime preservation, and intact v0.1.8.1 Push infrastructure.
- Final verification passed: full Node suite 114/114, both Deno checks, `npm run build`, and `git diff --check`. The new static schema/migration contract passed 4/4. Slice B then passed the deployed-frontend Production human acceptance recorded above. Slice C did not start.

# 2026-09-20 - v0.1.8.2 Slice A Timezone Primitives + Reminder Due Calculator

- Extracted the existing recurrence timezone conversion and DST gap/overlap policy into runtime-neutral pure TypeScript under `supabase/functions/_shared/`; recurrence now imports the same implementation without changing its public behavior.
- Added the frozen `ReminderKind` type and one deterministic due calculator for all five timed and both all-day reminder kinds. The calculator rejects missing/invalid timezones and timed/all-day mismatches, treats null as disabled, uses Event-local calendar arithmetic for previous-day reminders, and has no `ends_at` input.
- Added DST characterization coverage for recurrence plus focused Reminder due tests. Targeted recurrence/Reminder verification passed 34/34 tests; the full repository Node suite passed 101/101; `npm run build` passed.
- Installed Deno 2.9.7 as a system verification tool through Homebrew; no project dependency or lockfile changed. `deno check` passed for both shared modules. The explicit `tsconfig.app.json` include now names only `time-zone.ts` and `reminder-due.ts`, preventing future server-only `_shared` modules from entering the frontend app typecheck.
- Final verification passed: targeted recurrence/Reminder tests 34/34, full Node suite 101/101, both Deno checks, `npm run build`, and `git diff --check`. Slice A implementation and cross-runtime verification are complete and awaiting final human review plus commit/push governance closeout; Slice B and Slice C have not started.
- No database schema, migration, Event UI, sender, Cron, Service Worker, Push Subscription, Supabase/Vercel configuration, dependency, deployment, commit, or push changed.

## 2026-09-19 - v0.1.8.2 Reminder Persistence + Ordinary Event Delivery Architecture Freeze

- Completed a docs-only architecture / semantics freeze for v0.1.8.2; business code, SQL, migration, Cron, sender, delivery ledger, commit, and push remain untouched. Implementation planning is the next action.
- Superseded the earlier nullable `events.reminder_offset_minutes` proposal with one nullable event-level `events.reminder_kind`: timed at-start/10m/30m/1h/previous-local-day presets and all-day same-day 08:00 / previous-day 20:00 presets. No JSON reminder config, multiple-reminder table, custom minutes, or per-user reminder preference was approved.
- Froze new UI-created Event defaults as `timed_10m_before` for timed events and `all_day_same_day_08` for all-day events. The database default and all historical Events remain `reminder_kind = null`; rollout does not silently enable notifications.
- Froze nullable canonical IANA `events.time_zone`, automatically detected from the creating browser/PWA without a manual selector. Existing Events are never silently rewritten when a device timezone changes, and historical ordinary Event timezone remains null rather than guessed; historical recurring sources may initialize it from their already-authoritative recurrence-rule timezone. Recurring Event timezone must agree with `recurrence_rule.time_zone`.
- Froze timed previous-day semantics as the prior Event-local calendar day at the same wall-clock time, reusing canonical recurrence DST behavior rather than subtracting 1440 minutes. All-day due time uses effective date plus Event timezone; multi-day reminders use only the range start.
- Froze visible timed/all-day reminder conversion, stale pending cancellation, due-aware idempotency, no re-send for title/description edits, legitimate new delivery after a moved future due, past-due skip without immediate Push, and a roughly ten-minute grace used only for infrastructure delay.
- Kept Slice 2 limited to ordinary non-recurring delivery and kept recurrence projection/override/delete/split/cutoff/all-day/DST delivery for Slice 3. The current all-day representation is accepted without date-only or exclusive-end redesign; implementation must stop and report if it cannot safely derive canonical 08:00.
- Android installed PWA Push lifecycle acceptance remains deferred to final v0.1.8 cross-platform acceptance and is not a blocker. `git diff --check` is the only required verification for this docs-only change.

## 2026-09-19 - v0.1.8.1 Push Infrastructure Validation Closeout

- Closed Slice 1 as `CLOSED / PASS — Android final acceptance deferred`. iPhone installed PWA passed notification permission, subscription, test push, home-screen/background delivery, and lock-screen delivery. Desktop Chrome/macOS passed permission, local `Notification`, Service Worker `showNotification`, FCM acceptance, and final test-push delivery.
- Desktop initially had an abnormal/stale Push Subscription: FCM returned `201` with `delivered = true`, hostname-only provider `fcm.googleapis.com`, and `gone = false`, but Chrome displayed no Push notification. 「关闭通知 → 重新开启通知 → 重新订阅」restored delivery, with no evidence of a Push architecture, VAPID, Edge Function, or Service Worker blocker.
- Established first-line recovery for similar Push symptoms: retry, unsubscribe/resubscribe, then restart the browser/PWA before deeper RCA. Retained the safe sender diagnostic fields `status`, `delivered`, hostname-only `provider`, and `gone` because they distinguish provider acceptance from downstream browser delivery without exposing subscription or secret material.
- By product decision, Android installed PWA permission, subscription, foreground/background/closed-app delivery, notification click, and logout lifecycle are deferred together to final v0.1.8 cross-platform acceptance. This is a validation strategy, not a blocker, and Slice 2 may proceed only after its timed/all-day/multi-day reminder semantics are frozen. No Slice 2 implementation, commit, or push was performed.

## 2026-09-19 - v0.1.8.1 Sender Diagnostic Enhancement

- Added a minimal, non-sensitive `send-test-push` diagnostic contract without changing Push architecture, subscription persistence, VAPID configuration, payload, or client behavior. Accepted sends now return the actual upstream HTTP status, `delivered: true`, the provider hostname only, and `gone: false`; 404/410 retains current-installation disable behavior and returns `gone: true`.
- Other upstream non-2xx responses retain Edge HTTP 502 and return only status, provider hostname, delivery flags, and the stable `push_service_rejected` code. Network, crypto, and runtime failures retain the existing generic 500 response. The library logger callback extracts only a validated numeric status and never logs or returns its raw endpoint/body data.
- Added coverage for accepted 2xx, 404, 410, 401, 403, 429, 503, network/runtime failure, hostname-only providers, non-empty success JSON, and response secrecy. The full 90-test Node suite, production build, diff check, and Edge static/type check against the exact `@mmmike/web-push@1.3.0` declarations passed. No deploy, commit, push, cloud configuration, or Slice 2 work was performed.

## 2026-09-18 - v0.1.8.1 Push Infrastructure Foundation

- Implemented Slice 1 locally with status `IMPLEMENTED / VALIDATION PENDING`: a root-scope Push-only Service Worker, non-fatal registration, explicit notification-permission UI, stable random installation UUID, standard PushManager subscription lifecycle, current-installation test push, disable, and logout cleanup. No offline cache, reminder field, scheduler, Cron, recurrence delivery, or visual redesign was added.
- Added canonical `push_subscriptions` bootstrap SQL plus the additive `2026-09-18-v0.1.8.1-push-infrastructure.sql` patch. The table is unique by endpoint and by `(user_id, installation_id)`; authenticated clients have no direct table privileges and use `SECURITY DEFINER` register/disable RPCs bound to `auth.uid()`.
- Added `send-test-push`, with `@mmmike/web-push@1.3.0` pinned exactly as a function-only dependency. The function verifies the caller, accepts only `installation_id`, performs user-scoped lookup, sends a fixed non-sensitive payload using server-only VAPID secrets, allowlists known push-service hosts, and disables only a 404/410-gone subscription.
- Added deterministic client, Service Worker, SQL contract, and Edge logic/source tests. Twenty-one new Node tests and the production build passed. The 22-assertion pgTAP suite was added but could not run because the local Supabase database was not reachable; no Production database or business data was accessed.
- Pending manual work: apply the Supabase patch, configure VAPID secrets, deploy the Edge Function, configure `VITE_VAPID_PUBLIC_KEY` in Vercel and redeploy, then complete Desktop, iPhone installed-PWA, and Android installed-PWA notification smoke. No commit or push was created.

## 2026-09-18 - v0.1.8 Mobile Push Reminder Architecture Freeze

- Completed the docs-only Product Re-entry, Architecture Freeze, and canonical-state correction. Calendar Core and Recurring Events remain completed and Production validated; the current completed product version remains v0.1.7.3.3.2.
- Froze `v0.1.8 — Mobile Push Reminder` as the next approved product slice without implementing it. Delivery uses standards-based Web Push through a Push-only Service Worker; Email reminder delivery is not part of v0.1.8, while existing Email OTP authentication remains unchanged.
- Selected Option A: one nullable event-level `events.reminder_offset_minutes` with allowed values `0`, `10`, `30`, `60`, and `1440`; `null` means no reminder. Multiple reminders, arbitrary custom minutes, and per-user reminder preferences remain out of scope.
- Froze `push_subscriptions` as a `user + installation` model that supports multiple devices and does not bind subscriptions to a Space. This preserves compatibility with a future multi-space model without implementing multi-space now.
- Froze recipients as current active Space members for shared events and only the current `owner_user_id` for personal events, resolved dynamically at send time.
- Froze one-minute Supabase Cron + Edge Function sending, canonical dynamic recurrence projection, `reminder_deliveries`, roughly ten-minute late-delivery grace, and best-effort Web Push semantics.
- Corrected delivery idempotency to include canonical `due_at`: recurring `(logical_series_id, occurrence_key, subscription_id, due_at)` and one-off `(event_id, "once", subscription_id, due_at)`. Moving an event or changing its offset may produce a new legitimate delivery; unchanged due time cannot duplicate, including across a future split.
- Split implementation into Push Infrastructure Foundation, Reminder Persistence + Ordinary Event Delivery, Recurrence Integration, and Production Validation + Canonical Closeout. v0.1.9–v0.1.12 remain directional roadmap entries rather than frozen architecture.
- Corrected the canonical recurrence split semantics: future exceptions migrate to the child, a split-day override is consumed, and a split-day deletion is rejected.
- No business code, SQL, migration, patch, dependency, Vercel/Supabase configuration, secret, commit, or push changed.

## 2026-08-08 - Local Filesystem Data Governance Audit

- Completed the repo-local filesystem persistence audit for stable projectId `cross-system-shared-calendar`; the conclusion is `A. no persistent filesystem-local project data`.
- No migration is required, and `/Users/wp/Projects/_project-data/cross-system-shared-calendar/` was not created. Supabase remains the canonical cloud business persistence.
- Added the long-term governance rule to `AGENTS.md` and the filesystem test boundary to `docs/TESTING.md`; no business code, SQL, dependencies, or product state changed.
- No public internet, Supabase, or secrets were accessed during this audit.

## 2026-08-01

- 跨系统共享日历正在接入 Project State Push Gate；实现与测试已开始。
- 当前尚未安装、提交或推送，且未修改项目业务状态。

## 2026-07-19 - v0.1.7.3.3.2 Frontend Scope Integration

- Replaced the persistent occurrence scope control and expanded delete confirmation with a compact, mobile-first action chooser. Save offers 「仅修改当前事件 / 修改当前及未来事件 / 取消」; delete offers 「仅删除当前事件 / 删除当前及未来事件 / 取消」. The chooser does not discard the draft and does not expose any entire-series action.
- Diagnosed the local future-delete browser error without reading secrets: the database already contained `delete_occurrence_and_future(uuid, date, timestamptz)` from the existing correctness patch, but local PostgREST had a stale schema cache. Sent a local `NOTIFY pgrst, 'reload schema'`; logs confirmed a fresh cache with 15 functions. The reviewed v0.1.7.3.3.1 patch was subsequently applied once to Production and its PostgREST cache was reloaded; no SQL file changed.
- Added EventSheet-local occurrence scope selection with exactly 「仅此事件」and「此次及未来事件」. Ordinary event CRUD has no scope selector; recurrence-rule and all-day controls remain unavailable for occurrence edits.
- Only-this keeps `upsert_occurrence_override` / `delete_occurrence`. This-and-future now calls `split_recurring_event` / `delete_occurrence_and_future` using the final SQL parameter names, hydrated draft content, and source `all_day`, `recurrence_rule`, and `updated_at` values. The client does not compose split transactions locally.
- Recurring occurrence deletion now opens an in-sheet scope confirmation; busy controls prevent repeat submissions, and RPC or refresh errors retain the sheet and confirmation. `loadEvents()` now rejects after setting the page error; initial-load and Realtime callers explicitly handle that rejection, while successful mutations await the events-plus-exceptions refresh before closing.
- Added scope, payload, route, and split-projection Node regression coverage. Passed authenticated local UI smoke for only-this / this-and-future edit and delete, plus the action chooser. Final Production recurrence smoke passed on Desktop and iPhone Standalone PWA for all four supported actions: only-this and this-and-future edit/delete. iOS Standalone PWA cannot actively refresh itself due to an iOS system limitation; this is not an application defect. `delete_logical_series` remains a backend RPC with no frontend entry point, deliberately deferred pending a separately approved high-impact deletion UX slice.

## 2026-07-18 - v0.1.7.3.3.1 Split RPC Correctness Patch

- Added a targeted local-only database patch for Scheme A split correctness: exclusive scheduled-instant cutoff, finite `recurrence_until` inheritance, source recurrence-rule/all-day preservation, future exception migration, split-day override consumption, split-day deleted rejection, and selected-segment future deletion.
- Recurrence exception mutations now advance the source event revision for optimistic concurrency. Local bootstrap plus ordered-patch validation, 48 pgTAP assertions, 34 Node tests, and the production build passed. No Production patch, frontend scope UI, commit, or push was performed.

## 2026-07-18 - v0.1.7.3.2 Frontend RPC Integration

- Added an explicit `EventEditTarget` boundary so `CalendarOccurrence → EventEditTarget → EventSheet` preserves recurring occurrence identity, scheduled `occurrence_date`, and display metadata without making the sheet depend on the rendering projection.
- Occurrence drafts now hydrate title, description, `occurrence_starts_at`, `occurrence_ends_at`, and all-day state from the selected projection. The source event remains responsible for ID, ownership/permissions, recurrence rule, and series metadata. The hydration regression that showed the source event's original date/time for a future occurrence is covered by a 2026-07-18 → 2026-07-25 test; RPC keys, `p_occurrence_date`, and mutation semantics did not change.
- Only-this save calls `upsert_occurrence_override`; only-this delete calls `delete_occurrence`. Override data is limited to `title`, `description`, `starts_at`, and `ends_at`. Occurrence mode explains its scope and disables all-day and recurrence-rule edits; ordinary events retain their existing `events.update/delete` paths.
- Production preflight confirmed the v0.1.7.1 prerequisites, then applied `2026-07-18-v0.1.7.3-series-editing.sql` to project `ximazjhxvmktpcdbypka`. PostgREST schema cache was reloaded and `upsert_occurrence_override`, `delete_occurrence`, `split_recurring_event`, and `delete_logical_series` were verified. No Auth, SMTP, Realtime, Vercel, or unrelated database configuration changed.
- Authenticated localhost:5175 + Production Supabase smoke passed: occurrence hydration, only-this update, only-this delete, ordinary event edit/delete regression, and refreshed exception projection consistency. Local pure-function verification passed 34 tests; the existing 15-assertion v0.1.7.3.1 pgTAP suite passed; production build and diff hygiene passed.

## 2026-07-18 - v0.1.7.3.1 Database RPC Foundation

- Added the additive `2026-07-18-v0.1.7.3-series-editing.sql` patch. It provides permission-checked `SECURITY DEFINER` RPCs with fixed `search_path` for only-this override/delete, atomic split, and logical-series deletion. The RPCs validate scheduled occurrence dates in the source rule timezone, whitelist override fields, lock source rows, support optional `updated_at` optimistic concurrency, and retain exceptions on the original segment during a split.
- RPCs: `upsert_occurrence_override`, `delete_occurrence`, `split_recurring_event`, and `delete_logical_series`. Frontend scope selection and frontend RPC integration are not included.
- Added a 15-assertion pgTAP suite covering RPC availability, override/delete behavior, candidate and permission rejection, split lineage/cutoff/no-migration behavior, stale concurrency rejection, and root/child/exception logical-series deletion. Local verification passed this suite and the existing 18-assertion v0.1.7.1 foundation suite.
- The additive patch was applied only to the local Supabase test database for verification. No React/UI/frontend/Auth configuration, RLS policy, Production database, commit, or push changed.

## 2026-07-18 - v0.1.7.3 Recurrence Editing Semantics Design

- Added a design-only contract for recurring occurrence edit/delete scopes: only this event, this and following, current-segment editing, and logical-lineage deletion. It defines occurrence-context handoff, segment-local exception ownership, atomic split/end-from-here operations, RLS/RPC/Realtime requirements, and later test slices.
- Added deployment guidance: apply one reviewed incremental patch, verify database behavior, deploy a compatible frontend, then perform authenticated production smoke testing. `supabase/schema.sql` is explicitly documented as bootstrap/reference only, never as an existing-production migration.
- No application code, database schema, RLS, Auth, dependency, production service, commit, or push changed.

## 2026-07-18 - Local Supabase Email OTP Recovery

- Confirmed local Auth and Mailpit are healthy at the local API and Mailpit endpoints. The local stack reports only `imgproxy` and `pooler` as stopped; neither is required for Email OTP, Postgres, or the Vite calendar flow.
- Repaired local-only OTP alignment in `supabase/config.toml`: set the local Vite site/redirect URL to port 5175, configured an 8-digit OTP to match the existing Auth UI, and added a local Mailpit magic-link template that renders `{{ .Token }}` as the numeric code. Restarted the local Supabase stack without resetting the database.
- Service verification passed with a fake address only: `signInWithOtp` request, Mailpit receipt, 8-digit token extraction, `verifyOtp`, and an authenticated session response. Browser verification then passed at `http://127.0.0.1:5175`: entered the Mailpit code and reached the existing local Calendar space. A fake local test user was added to the existing isolated test space solely to make the Calendar route observable.
- No recurrence/business code, database schema, RLS, Production configuration, secrets, dependency, commit, or push changed. The earlier UI `{}` symptom was not reproduced after the local OTP template/length mismatch was corrected.

## 2026-07-18 - v0.1.7.2 Local Supabase Integration Verification

- Confirmed the local Supabase database/API stack is reachable. The local schema already contains the v0.1.7.1 exception foundation: all expected exception-table columns, uniqueness/FK/shape constraints, RLS enabled, and four inherited event-access policies.
- Passed `supabase test db --local supabase/tests/2026-07-18-v0.1.7.1-database-foundation.test.sql` (18 pgTAP tests). Created an isolated local weekly source with one deleted and one starts-at override exception; direct database reads returned both expected records.
- Started Vite with temporary local Supabase process configuration only; no `.env` file changed. The browser reached the login page, but local Email OTP returned an empty error object, so authenticated Calendar projection was not browser-verified. The Vite test process was stopped after verification.
- No schema, RLS, Auth configuration, business code, dependency, commit, push, or Production service was changed.

## 2026-07-18 - Local Supabase Authenticated Table Grants

- Added only the baseline table privileges required for `authenticated` requests to reach existing RLS policies: `profiles` (`SELECT, UPDATE`), `spaces` (`SELECT, UPDATE`), `space_members` (`SELECT`), and `events` (`SELECT, INSERT, UPDATE, DELETE`). The grants match the operations already covered by policies; no policy, business logic, public privilege, patch, or schema-design change was made.
- This fixes the local pgTAP prerequisite that previously failed with `permission denied for table events`. RLS and the existing owner/membership checks remain the final authorization boundary. Local verification remains pending Docker Desktop installation/startup.

## 2026-07-18 - Local Supabase CLI Configuration Repair

- Diagnosed the `Missing required field in config: project_id` failure: `supabase/config.toml` did not exist. Ran the local CLI initializer and set the generated project's stable local identifier to `cross-platform-shared-calendar`; the generated `supabase/.gitignore` ignores only Supabase transient files and local dotenv variants.
- `supabase start` no longer fails configuration parsing. It now stops at the environment prerequisite: Docker Desktop and the Docker CLI are not installed/running on this machine, so no local containers, patch, or database test were started. No `.env`, secret, access token, service key, linked project, or Production service was accessed.

## 2026-07-18 - v0.1.7.2 Exception Expansion Engine

- Added pure, exception-aware projection: recurring occurrences now use stable `${event_id}:${occurrence_date}` IDs, where `occurrence_date` is the scheduled local date in the recurrence rule timezone.
- `deleted` exceptions suppress their scheduled occurrence. `override` exceptions safely merge only `starts_at`, `ends_at`, `title`, and `description`; a starts-only override preserves the source duration and moved overrides can enter or leave the active range.
- `CalendarApp` now reads `event_occurrence_exceptions` for the loaded source event IDs and passes them into Today, Week, and Month projection. No mutation UI, Realtime subscription, SQL/RLS/Auth change, dependency, commit, or push was added.
- Passed: `node --test tests/recurrence.test.ts` (22 tests), `npm run build`, and `git diff --check`.

## 2026-07-18 - v0.1.7.1 Recurrence Exceptions Database Foundation

- Added the additive, un-applied `supabase/patches/2026-07-18-v0.1.7.1-database-foundation.sql`. It adds nullable `events.series_id`, `parent_event_id`, and `recurrence_until`; backfills only existing recurring roots; creates `event_occurrence_exceptions`; validates recurring-source/immutable event ownership; and grants inherited event RLS access without a new permission model.
- Added `supabase/tests/2026-07-18-v0.1.7.1-database-foundation.test.sql` for schema, exception insert/update/delete, shape constraint, and member/non-member RLS coverage. `supabase test db --local` could not connect because no local Postgres was available, so the patch was not applied to a local or Production environment.
- Passed: `node --test tests/recurrence.test.ts` (17 tests), `npm run build`, and `git diff --check`. No recurrence expansion, frontend/UI, Realtime, dependency, environment, legacy migration, commit, or push change was made.

## 2026-07-18 - v0.1.7 Recurrence Exceptions & Series Editing Design Started

- Added `docs/RECURRENCE_EXCEPTIONS_DESIGN.md` as the implementation-ready design for sparse occurrence overrides/deletions and source-series splitting. It defines all six edit/delete scopes, stable local-date occurrence keys, the proposed `event_occurrence_exceptions` table, lineage/cutoff additions, RLS/Realtime implications, atomic split semantics, exception-aware projection, mobile-first dialogs, migration sequencing, and future test/acceptance coverage.
- Key safety decisions are documented for human review: a split preserves historical source projection, exceptions remain segment-local, and deleting all recurring events removes the complete logical lineage.
- Human-review revision: the lineage fields are `series_id + parent_event_id`; exceptions always remain with their creating event segment and are never migrated to a split child. Editing/deleting this-and-following count-confirms and atomically clears only exceptions made unreachable by the old segment cutoff.
- This was a documentation-only design task. No `src/`, tests, SQL migration, Supabase configuration, frontend behavior, dependency, environment, commit, or push was changed.

## 2026-07-17 - v0.1.6.3 Recurrence UI Implementation

- Extended the existing source-event sheet with simple user-facing recurrence controls: 不重复, daily, weekly, monthly, and yearly; every recurring option has an interval, weekly selects weekdays, monthly selects a numeric day or month-end, and yearly selects month/day. No RRULE or JSON is exposed.
- The form derives a v1 `recurrence_rule` with the browser `Intl` timezone, validates it through the existing recurrence parser before a source-row insert/update, and writes `null` for a non-recurring event. No timezone dependency was added.
- Opening an occurrence already passes its source event to the sheet. Recurring edits now say “编辑整个重复日程”; save and delete explicitly apply to the whole series, while the delete operation continues to filter only by the source event ID. No exception or occurrence write path exists.
- Added recurrence-form conversion, validation, source-identity, and user-facing summary tests. `node --test tests/recurrence.test.ts` passed 17 tests, `npm run build` passed, and `git diff --check` passed.

## 2026-07-17 - v0.1.6.2 Calendar Integration

- Connected the existing read-only recurrence projection to calendar rendering. `CalendarViews` retains `events` as source-row state, derives the active Today/Week/42-cell Month range, then projects only that range into non-persisted occurrences before filtering and rendering.
- Event cards now use an occurrence ID for React keys and occurrence start/end values for displayed time. Card labels, permissions, and edit entry points retain the source event; a generated occurrence ID is never passed to an `events` write.
- Existing source-event Realtime reload behavior is unchanged. A source INSERT/UPDATE/DELETE replaces `events` state as before and automatically recomputes the visible occurrence projection; no subscription, RLS, schema, migration, or dependency change was made.
- Added projection/range tests. `node --test tests/recurrence.test.ts` passed 12 tests, `npm run build` passed, and `git diff --check` passed.

## 2026-07-17 - v0.1.6.1 Realtime Acceptance Attempt

- Started an end-to-end Realtime transport acceptance using two isolated temporary email/password accounts, a temporary shared space, and a shared event. The intended flow was: account B subscribes to `public.events` UPDATEs, account A updates `recurrence_rule`, then the received payload is checked for the event ID and rule value.
- The linked Production project requires email confirmation for password sign-up. Neither new account received an authenticated session, so no shared space, event, channel subscription, or UPDATE payload was created. This is an Auth-session prerequisite, not a migration, RLS, publication, or recurrence-rule validation failure.
- Deleted the two temporary unconfirmed Auth accounts and verified that zero temporary users and zero temporary spaces remain. No application source, database schema, RLS, Realtime configuration, or Auth configuration was changed.
- The live two-client Realtime acceptance remains pending. Complete it using two existing, independently authenticated sessions (for example, two Email OTP browser sessions) without changing the current Auth settings.

## 2026-07-17 - v0.1.6.1 Database Acceptance

- Linked the local Supabase CLI to the existing `cross-platform-shared-calendar` project and completed the documented preflight. Before migration, `events.recurrence_rule` was absent; the two original event triggers, four event RLS policies, `supabase_realtime` publication, and `FULL` replica identity were recorded as the baseline.
- Applied `2026-07-17-v0.1.6.1-recurring-events-foundation.sql` successfully through the Supabase Management API. Post-apply verification confirmed nullable `events.recurrence_rule jsonb`, the original two triggers plus only `events_validate_recurrence_rule`, unchanged event RLS policy definitions, and unchanged Realtime publication/identity.
- All four existing events remain legacy one-off rows with `recurrence_rule = null`; the temporary two-account acceptance transaction was rolled back and the final event count remained four.
- Two-account RLS simulation passed in a rollback-only transaction: both members could read/update a shared recurring event; the owner could update a personal recurring event; the non-owner update affected zero rows. No test events persisted.
- Functional Realtime delivery to a second subscribed authenticated client is still pending. Publication metadata is correct, but no claim is made until a real two-client subscription observes a `recurrence_rule` update.

## 2026-07-17 - v0.1.6.1 Recurring Events Foundation

- Added the additive `2026-07-17-v0.1.6.1-recurring-events-foundation.sql` patch and matching fresh-install schema support for nullable `events.recurrence_rule jsonb`. `null` preserves existing events as one-off events; no existing data backfill is required.
- Added a separate database trigger that validates the supported v1 daily, weekly, monthly, and yearly JSON shapes, including IANA timezone, bounded interval, strict weekly weekday ordering, monthly `last_day`, and valid yearly month/day combinations. Existing owner trigger, event identity fields, RLS policies, Realtime publication, and replica identity are unchanged.
- Added recurrence rule and display-occurrence TypeScript types plus a pure, read-only frontend expansion engine. It never writes Supabase rows, bounds each source event to 500 candidates, and returns an explicit error instead of partial occurrences.
- Added ten Node built-in unit tests for non-recurring events, all supported frequencies, monthly/yearly edge cases, invalid input, and the candidate limit. `node --test tests/recurrence.test.ts`, `npm run build`, and `git diff --check` passed locally.
- No dependency, environment variable, Auth, UI, event-form, reminder, notification, RLS, or Realtime change was made. The Supabase patch has not been executed; database/RLS/Realtime verification against an environment remains pending before UI integration.

## 2026-07-14 - v0.1.5 Email OTP Auth UX Improvement

- Replaced the AuthPage Magic Link UX with a two-step Email OTP UX: send code, enter an 8-digit numeric code, verify, change email, and resend after a 60-second cooldown.
- The existing `getSession()` and `onAuthStateChange()` flow remains the sole session state mechanism; successful OTP verification does not manually set session state.
- No dependencies, environment variables, database schema, SQL patches, RLS policies, event/space/member behavior, Realtime subscriptions, or secrets changed.
- Supabase SMTP and passwordless email template are configured to send `{{ .Token }}` as an OTP. Local acceptance passed for existing-user and new-user login, new-user space creation, member display-name update, and existing-session regression.
- Production acceptance completed on 2026-07-15: Resend SMTP + Supabase Auth Email OTP passed on Desktop, iPhone Safari, iPhone standalone PWA, Android Chrome, and Android PWA. Existing/new-user login, new-space creation, and profiles/display_name behavior passed.
- The iOS standalone PWA Magic Link return limitation is resolved for login UX: users authenticate by entering the code directly in the standalone PWA. Safari and standalone storage remain separate by platform design.
- Future work is observation only: monitor email delivery, resend/cooldown/error UX, and session restoration before considering further Auth UX changes.

## 2026-07-11 - v0.1.4 Member Identity & Space Members

- Added a standalone `2026-07-11-v0.1.4-member-display-name.sql` patch. It transactionally locks profile writes during migration, converts blank names to `null`, trims legacy names, deterministically truncates legacy non-empty names to 20 characters, adds the nullable trimmed 1–20-character constraint, and changes `handle_new_user()` to create a null display name.
- Synced the initial schema with the same profile constraint and privacy-safe new-user behavior. Existing RLS policies, RPCs, indexes, event fields, and Realtime publication were not changed.
- Added a compact member entry and bottom sheet. It lists the current member with 「（我）」, uses `joined_at` then `user_id` for deterministic member ordering, shows no invented second member in a one-member space, and only permits the current user to edit their own `profiles` row.
- Personal event cards, owner choices, and read-only details now show the member display name; shared events show 「共同」. Missing, blank, or invalid loaded names safely display 「成员」.
- A successful name save reloads members on the saving device. No `profiles` or `space_members` Realtime subscription was introduced; another device updates on refresh, re-entry, or session restoration.
- Initial local implementation verification: `npm run build` and `git diff --check` passed before Supabase SQL or browser smoke was performed.
- Follow-up verification: the v0.1.4 patch was executed successfully in the current Production Supabase project after a clean preflight. Constraint, normalization, new-user trigger, and unchanged RLS policy checks passed.
- Local two-account desktop smoke passed: member list and self-only editing, cross-session name refresh, personal/shared labels, same-name owner regression, owner-only personal permissions, shared permissions, and existing events Realtime create/update/delete. Temporary smoke events were removed after verification.
- Production acceptance follow-up on 2026-07-14: deployed two-account desktop smoke passed, including member sheet, self-only name editing, concrete owner labels, shared/personal CRUD, owner-only personal access, same-name owner regression, and events Realtime.
- Production iPhone Safari browser smoke passed. The standalone PWA requires its own session; Magic Links normally return to Safari rather than the standalone app because their storage is isolated. This known Auth/PWA UX limitation is out of v0.1.4 scope.
- Production Android Chrome and home-screen PWA smoke passed: existing session, browser-Gmail Magic Link completion, narrow layout, keyboard, member UI, shared/personal ownership flow, and events Realtime. A Magic Link opened from the Gmail native App does not return to the PWA; this is recorded as a cross-app handoff limitation rather than an application bug.
- No business code, Auth configuration, Supabase schema/RLS, Vercel configuration, dependencies, or secrets were changed during Production acceptance. The single-member path and a newly created-account first login remain untested.

## 2026-07-09

- Completed the first Production verification of the Supabase Free keep-alive.
- Confirmed the Vercel Cron Job is registered for `/api/supabase-keepalive` on the daily `0 3 * * *` schedule.
- Confirmed an unauthenticated browser request returns `401 unauthorized`.
- Confirmed the first scheduled Production Cron invocation returned HTTP 200, indicating that all three read-only Supabase checks completed successfully under the current Function contract.
- Supabase remains Active. Continued Cron success and long-term inactivity-pause prevention still require observation.
- This was a docs-only verification closure; no business code, Function or Cron configuration, environment variables, database schema, RLS, deployment configuration, or secrets were changed or exposed.

## 2026-07-08

- Recorded the Supabase Free Tier inactivity pause operational risk.
- Confirmed the current Supabase project status is Active.
- Documented that a future pause may affect Auth, Database, RLS, and Realtime until the project is restored.
- Implemented a minimal keep-alive path using daily Vercel Cron at `/api/supabase-keepalive`.
- Added a CRON_SECRET-protected Vercel Function that uses the existing Supabase anon key environment variables and performs three sequential head-only read checks against `spaces`.
- The Function does not use service role, does not write heartbeat data, does not modify business tables, and does not return query data.
- Current decision remains to continue using Supabase Cloud without upgrading to Pro or migrating the backend.
- Local checks covered build, type checking for the Function, unauthorized/error-path endpoint behavior, `vercel.json` JSON parsing, and diff hygiene; the first Production Cron verification was completed on 2026-07-09.
- No calendar business logic, database schema, RLS, Supabase/Vercel dashboard configuration, dependencies, or secrets were changed in the repository.

## 2026-07-06

- Completed Android compatibility smoke testing on Xiaomi 14 / Android 16 / Chrome over a mobile network.
- Verified the Production URL opens, Android Chrome Magic Link login works, and the session restores after login.
- Verified today, week, and month views plus mobile layout on Android Chrome.
- Verified v0.1.3 event form behavior on Android: shared/personal default end time, start-time follow behavior, manual end-time preservation, and existing shared/personal event end-time preservation.
- Verified shared Realtime create/update/delete, personal read-only permissions, and User A creating a personal event for User B with ownership transfer.
- Verified Android Chrome add-to-home-screen, home-screen PWA launch, and PWA event create/delete syncing to desktop.
- Found no project bugs. A temporary Chrome add-to-home-screen state message cleared after restarting Chrome and was treated as a browser state issue.
- Closed the previously pending Android authenticated CRUD, Realtime, and PWA compatibility verification scope.
- No business code, Supabase schema, RLS, Vercel configuration, package configuration, dependencies, or secrets were changed.

## 2026-06-26

- Completed a docs-only cleanup for project documentation boundaries.
- Simplified `README.md` testing content so detailed smoke checklists and production validation records live in `docs/TESTING.md`.
- Reorganized `docs/BACKLOG.md` into P0/P1/P2/P3 priority sections while preserving completed and deferred version history.
- Updated `docs/PROJECT_STATE.md` with the documentation cleanup as the latest completed handoff-relevant work.
- No business code, configuration, dependencies, database schema, RLS, deployment settings, or secrets were changed.

## 2026-06-24 - v0.1.3

- Started the event form UX defaults phase.
- New event drafts now prefill the end time as the start time plus 1 hour, using the same start `Date` as the calculation base.
- Changing the start time for a new event keeps the end time at start plus 1 hour until the user manually edits the end time.
- Existing event drafts still load `starts_at` and `ends_at` from the database and do not reset the end time to a new default.
- Editing existing events continues to update only content fields and does not change the v0.1.1 protected identity fields: `space_id`, `created_by`, `scope`, or `owner_user_id`.
- All-day compatibility: new all-day events whose end time was not manually edited save `ends_at` as `null`; if a user manually edits the end time, the existing form behavior of saving that value is preserved.
- Verified v0.1.3 in a real browser: shared and personal default end times, start/end follow behavior, manual end preservation, existing event end preservation, read-only personal events, Realtime create/update/delete, and all-day functional regression passed.
- No Supabase schema, RLS, Vercel, Supabase configuration, secret, Android pending, member display, anniversary, Todo, or service worker changes were made.

## 2026-06-23 - v0.1.2

- Deployed the current Vite app to Vercel at https://cross-platform-shared-calendar.vercel.app/.
- Configured the Supabase Auth Site URL and Redirect URLs for the Production URL while retaining local test redirects.
- Diagnosed the first Production Magic Link failure, `Invalid path specified in request URL`: the Vercel environment variable value was empty, and the Supabase URL had also previously been copied from the REST endpoint.
- Corrected `VITE_SUPABASE_URL` to the project base URL ending in `.supabase.co`, without `/rest/v1/`, and redeployed successfully.
- Verified the Production page loads without a Supabase configuration error.
- Verified desktop User A Magic Link login, logout and repeat login, Production-domain redirect, and session restoration. An empty `/#` after login is accepted.
- Verified User A shared and personal event create, update, and delete flows, including persistence after refresh.
- Verified Realtime create, update, and delete propagation between two windows for User A.
- Verified the manifest and both SVG icons are accessible.
- Verified iPhone Safari can open the Production URL, add the app to the home screen, and launch it from the home screen.
- Verified the logged-out iPhone layout and email login entry point.
- Follow-up smoke test: verified User B Production Magic Link login in an incognito window, with both A and B reaching the calendar page and seeing the same invite code for the shared space.
- Verified two-account Production Realtime for shared events: A created `ab realtime create test`, B received it without refresh, B edited it to `ab realtime edit test`, A received the update without refresh, and B deleted it with A seeing it disappear without refresh.
- Verified personal-event permissions and Realtime in Production: A-owned personal events are visible to B as read-only, owner edits/deletes propagate without refresh, and A-created B-owned personal events transfer management to B while A remains read-only.
- Verified iPhone authenticated Production flow with User B: Magic Link login, Production-domain redirect, calendar entry, mobile layout, shared event creation, desktop A Realtime receipt, and deletion propagation.
- Pending: Android authenticated CRUD.
- Pending Android testing is deferred because the Android device is temporarily unavailable.
- No application business logic changed for this deployment.

## 2026-06-20 - v0.1.1

- Implemented owner-only update/delete policies for personal events while keeping them visible to both members.
- Kept shared events editable and deletable by both space members.
- Added read-only personal-event details for the non-owner.
- Adjusted the event sheet so read-only details stay within the viewport and scroll correctly on desktop and mobile.
- Locked existing event identity fields: `space_id`, `created_by`, `scope`, and `owner_user_id`.
- Added a non-destructive v0.1.1 patch SQL for existing Supabase projects with smoke-test data.
- Added a preflight query that must return zero invalid scope/owner rows before applying the patch.
- Applied the patch after the preflight returned zero invalid rows.
- Verified desktop two-account read-only and owner-management behavior for personal events.
- Verified both members can still edit and delete shared events.
- Verified non-owner direct API updates/deletes affect zero personal-event rows.
- Verified the trigger rejects changes to all four event identity fields.
- Verified allowed personal/shared updates and deletes continue to propagate through Realtime; one stale browser subscription required a single refresh before the regression test.
- Android authenticated testing remains pending and is not part of this change.

## 2026-06-20

- Completed the available v0.1 Supabase smoke-test scope.
- Verified two-user space creation/join, the two-member capacity limit, invite-code rotation, and invalidation of old invite codes.
- Verified RLS blocks non-members from reading or writing space data.
- Verified Realtime create, update, and delete propagation between two authenticated sessions.
- Verified iOS Safari layout and add-to-home-screen behavior.
- Verified Android Chrome layout and creation of a home-screen shortcut.
- Pending: Android Magic Link login.
- Pending: viewing, creating, editing, and deleting events after login on Android.
- Android authenticated testing is deferred because the Android device is temporarily unavailable. Testing was also interrupted by Supabase's default email rate limit and an earlier incorrect Site URL configuration that pointed to `localhost:3000`.
- Next step after this stabilization commit: begin v0.1.1 personal-event permission corrections, then resume Android authenticated testing when the device is available.

## 2026-06-18

- Started real Supabase smoke testing.
- Executed `supabase/schema.sql` successfully in a new Supabase project.
- Fixed invite-code generation to call `extensions.gen_random_bytes` explicitly.
- Added a direct `space_members.user_id -> profiles.id` foreign key so PostgREST can resolve the member profile relationship.
- Added `events` to the `supabase_realtime` publication after confirming it was not enabled by default.
- Verified that User B receives a newly created shared event from User A without refreshing.
- Enabled `replica identity full` for `events` so filtered Realtime subscriptions receive enough data to process deletions.
- Verified cross-user event editing and deletion with live updates in the other user's session.
- Verified the two-member capacity limit and non-member RLS read/write isolation.

## 2026-06-17

- Project initialization completed.
- Technical stack: React + Vite + TypeScript + Tailwind + Supabase.
- v0.1 goal: a two-person shared calendar Web/PWA that works on iOS Safari and Android Chrome.
- First commit completed: `bbdde4f feat: initialize shared calendar MVP`.
- Production build passed with `npm run build`.
- Remote repository: `git@github.com:ping177/cross-platform-shared-calendar.git`.
- Next step: real Supabase integration and acceptance testing.
