# Development Log

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
- Key safety decisions are documented for human review: a split preserves historical source projection, “entire series” applies to the selected current segment after a split, and exception cleanup must be count-confirmed rather than silent.
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
