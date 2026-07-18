# Testing

## v0.1.7.3.1 Series Editing Database RPC Foundation

Verified locally on 2026-07-18 after applying the additive patch to the local Supabase test database only:

- Passed: `supabase test db --local supabase/tests/2026-07-18-v0.1.7.3-series-editing.test.sql` (15 pgTAP assertions). Coverage includes only-this override/delete, source-timezone candidate validation, non-member denial, split cutoff/child lineage/no exception migration, stale `updated_at` rejection, and logical-series deletion of root, child, and exceptions.
- Passed regression: `supabase test db --local supabase/tests/2026-07-18-v0.1.7.1-database-foundation.test.sql` (18 pgTAP assertions).
- Pending: Production preflight, one-time patch application, RLS/RPC verification, and authenticated Production smoke. No frontend/UI/Realtime integration is included in this database-only slice.

## v0.1.7.1 Recurrence Exceptions Database Foundation

Implemented locally on 2026-07-18, pending database execution:

- Added pgTAP coverage for migration structure, deleted/override exception insert and update, exception delete, and member/non-member RLS behavior in `supabase/tests/2026-07-18-v0.1.7.1-database-foundation.test.sql`.
- Pending: run `supabase test db --local supabase/tests/2026-07-18-v0.1.7.1-database-foundation.test.sql` after a local Supabase/Postgres instance is configured and the additive v0.1.7.1 patch has been applied there. The 2026-07-18 attempt failed to connect to local Postgres; no linked or Production test was attempted.
- The pgTAP prerequisite `permission denied for table events` is addressed in `supabase/schema.sql` by policy-matched `authenticated` table grants. Re-run locally to verify that existing RLS policies, rather than missing base privileges, control access.
- Passed: `node --test tests/recurrence.test.ts` (17 tests), `npm run build`, and `git diff --check`.

## Current Smoke-Test Status

- Passed: local production build.
- Passed: Supabase schema, RPC, RLS, and Realtime validation.
- Passed: two-user desktop flow for space creation/join and event create/update/delete.
- Passed: v0.1.1 personal owner-only management and non-owner read-only details.
- Passed: direct API enforcement for personal events and immutable event identity fields.
- Passed: third-user capacity rejection and non-member RLS read/write isolation.
- Passed: iOS Safari layout and add-to-home-screen behavior.
- Passed: Android Chrome layout and creation of a home-screen shortcut.
- Passed: v0.1.2 Vercel Production deployment and first-round HTTPS smoke testing.
- Passed: desktop User A Production Magic Link, session restoration, shared/personal CRUD, and same-account two-window Realtime.
- Passed: iPhone Production page, logged-out layout, manifest/icons, add-to-home-screen, and home-screen launch.
- Passed: User B Production Magic Link login.
- Passed: two-account Production shared Realtime create/update/delete.
- Passed: two-account Production personal-event owner/read-only permissions and Realtime propagation.
- Passed: authenticated iPhone User B Production login, mobile layout, shared CRUD, and desktop Realtime propagation.
- Passed: v0.1.3 local production build.
- Passed: v0.1.3 real-browser shared/personal event form UX smoke test.
- Passed: v0.1.3 all-day functional regression.
- Passed: Android Chrome Production compatibility smoke test on Xiaomi 14 / Android 16.
- Passed: Android Chrome Magic Link login, session restore, event CRUD, Realtime, permissions, and PWA home-screen flow.
- Passed: Supabase keep-alive Cron registration, unauthorized 401 check, and first scheduled Production invocation with HTTP 200.
- Passed: v0.1.4 local TypeScript/Vite production build and diff hygiene.
- Passed: v0.1.4 Production Supabase patch, constraint/trigger/RLS verification, and local two-account desktop smoke.
- Passed: v0.1.4 deployed-frontend two-account Production desktop smoke, including member identity, owner permissions, CRUD, and events Realtime.
- Passed: v0.1.4 Production iPhone Safari browser smoke and Android Chrome/PWA smoke.
- Pending: v0.1.4 new-user first-login behavior and the safe single-member-space scenario.
- Passed: v0.1.5 local Email OTP acceptance for existing/new users, new-user space creation, member display-name update, and existing-session regression.
- Passed: v0.1.5 Production acceptance on Desktop, iPhone Safari, iPhone standalone PWA, Android Chrome, and Android PWA.

## v0.1.6.1 Recurring Events Foundation

Completed locally on 2026-07-17:

- Passed: `node --test tests/recurrence.test.ts` (10 tests). Coverage includes one-off projection, daily interval, weekly weekday selection and interval anchor, monthly numeric day and `last_day`, yearly date and leap day, invalid rule rejection, and the 500-candidate failure path.
- Passed: `npm run build` and `git diff --check`.
- Passed: static review confirms the new patch only adds nullable `events.recurrence_rule`, a recurrence validation function/trigger, and no RLS or Realtime changes.

Database acceptance completed against the linked Production Supabase project on 2026-07-17:

- Passed: preflight confirmed `recurrence_rule` was absent before migration; recorded baseline events triggers, four RLS policies, Realtime publication, and `FULL` replica identity.
- Passed: `supabase/patches/2026-07-17-v0.1.6.1-recurring-events-foundation.sql` applied successfully once.
- Passed: post-apply schema reports `events.recurrence_rule` as nullable `jsonb`; all four legacy events have `recurrence_rule = null`.
- Passed: existing `events_validate_owner` and `events_touch_updated_at` triggers remain, with only `events_validate_recurrence_rule` added. The four original RLS policies and `supabase_realtime` / `FULL` metadata are unchanged.
- Passed: rollback-only two-account RLS simulation: both members read/update a shared recurring event; the personal owner updates their event; the non-owner update affects zero rows. Final check confirmed no test events persisted.

Still required before UI integration or release:

- Verify live Realtime propagation of a committed `recurrence_rule` update between two separately authenticated subscribed clients. A 2026-07-17 automated attempt using two isolated email/password accounts stopped before subscription because Production requires email confirmation and issued no sessions. The temporary accounts were removed (zero temporary users/spaces remain). The database publication metadata alone is not end-to-end delivery proof; use two existing Email OTP-authenticated browser sessions for this check.
- Confirm timezone behavior in the supported browsers before claiming DST-zone support. No timezone dependency was added.

## v0.1.6.2 Calendar Integration

Completed locally on 2026-07-17:

- Passed: `CalendarViews` projects source `events` through `expandRecurringEvents()` for the active visible range before all Today, Week, and Month filtering/rendering.
- Passed: Today covers the selected local day, Week covers Monday through Sunday, and Month covers the full 42 visible grid cells. Existing duration intersection semantics remain applied to display occurrences.
- Passed: one-off source events project once; recurring display entries use `occurrence_id` keys and occurrence start/end values while source events remain the edit/delete identity.
- Passed: `node --test tests/recurrence.test.ts` (12 tests), including source-list projection and Today/Week/42-cell range construction; existing daily, weekly, monthly, yearly, range, and candidate-limit coverage remains green.
- Passed: `npm run build` and `git diff --check`.

Deferred by the v0.1.6.2 scope:

- No recurrence create/edit/delete UI, series-management copy, exception behavior, or single-occurrence operation has been added.
- Run the real two-client Realtime subscription check after recurrence UI is complete; source-row reload and re-projection are connected, but the prior authenticated-client transport checkpoint remains unobserved.

## v0.1.6.3 Recurrence UI Implementation

Completed locally on 2026-07-17:

- Passed: event-sheet recurrence controls serialize `null` for 不重复 and the supported v1 daily, weekly, monthly, and yearly shapes for source-event creates and updates.
- Passed: the browser timezone is obtained with native `Intl.DateTimeFormat().resolvedOptions().timeZone`; the existing rule parser rejects invalid interval, weekday, and yearly date combinations before the Supabase write.
- Passed: recurring source events are edited through the existing source ID. The sheet labels whole-series edit/delete behavior and has no single-occurrence, exception, or future-occurrence control.
- Passed: `node --test tests/recurrence.test.ts` (17 tests), including non-recurring/daily/weekly/monthly/yearly rule construction, saved-rule edit conversion, invalid selectors, source identity, range projection, and candidate limit behavior.
- Passed: `npm run build` and `git diff --check`.

Still required for final acceptance:

- Use two existing independently authenticated Email OTP browser sessions to create/edit/delete a shared recurring source event, confirm all rendered occurrences update as a series, and observe the second client receive/reproject the source-row Realtime UPDATE.
- Run the same recurrence form smoke on supported narrow iPhone Safari and Android Chrome/PWA layouts, including DST-observing timezone behavior before claiming that support.

## v0.1.5 Email OTP

Supabase SMTP and the passwordless email template are configured to deliver `{{ .Token }}` as 8-digit Email OTP codes.

Production acceptance completed on 2026-07-15:

- Desktop, iPhone Safari, iPhone standalone PWA, Android Chrome, and Android PWA Email OTP login passed.
- Existing-user and new-user OTP login passed; a new user created a shared space successfully.
- The existing `profiles` trigger and display-name editing behavior passed after OTP login.
- Existing-session restoration/regression passed.
- iOS standalone PWA login now completes in the standalone container through OTP input, removing the previous Magic Link return limitation.

Future observation: monitor Production email delivery, resend/cooldown/error UX, and session restoration during normal use.

## v0.1.4 Member Identity & Space Members

For an existing environment, do not rerun `supabase/schema.sql`. Execute `supabase/patches/2026-07-11-v0.1.4-member-display-name.sql` only once per environment.

Static SQL review completed locally:

- The patch transactionally blocks concurrent profile writes, converts whitespace-only names to `null`, trims valid legacy values, and truncates legacy non-empty values to 20 characters before the check constraint is added.
- The constraint permits `null` and otherwise requires a trimmed 1–20-character name.
- `handle_new_user()` inserts `display_name = null`; it no longer reads Auth metadata, email, or email prefixes.
- Existing `profiles_select_same_space` and `profiles_update_self` policies are unchanged. No profile/member Realtime publication or subscription is added.

Verified against the current Production Supabase project on 2026-07-11:

- The v0.1.4 patch completed successfully. The three existing profiles needed no whitespace cleanup, trimming, or truncation.
- `profiles_display_name_format_check` exists; the post-patch data check returned zero edge-whitespace, over-limit, and empty values.
- `handle_new_user()` now writes `display_name = null`, keeps `SECURITY DEFINER`, `search_path = public`, the trigger return type, and `on conflict (id) do nothing`; it no longer reads Auth metadata or email data.
- The existing profiles, space-members, and events RLS policies were confirmed unchanged.

Verified in a local two-account desktop smoke test on 2026-07-11:

- A and B entered the same two-member space and each saw the correct 「成员 · 2」 list, current-user marker, and self-only edit control.
- Name editing, trim behavior, local immediate refresh, and refreshed second-session display passed; A/B name labels remained correct in event cards, owner choices, and details.
- Today, week, and month labels showed the concrete personal owner name or 「共同」; no deprecated relative event labels appeared.
- Shared, A-owned personal, and B-owned personal creation passed. Non-owners remained read-only, owners managed their personal events, and either member managed shared events.
- Shared and personal events propagated through the existing events Realtime create/update/delete flow. Temporary smoke events were deleted successfully after verification.
- Same-name owner regression also passed: ownership and editability continued to use user IDs, not display names.

Verified against the deployed Production frontend on 2026-07-14:

- Two-account desktop smoke passed: header member count, member sheet, current-user marker, self-only name editing, local immediate update, refreshed second-session update, today/week/month labels, shared/personal CRUD, owner-only personal access, same-name owner regression, and events Realtime create/update/delete.
- iPhone Safari browser smoke passed. The standalone PWA can be added to the home screen and its non-login UI checks passed, but it keeps a separate session and Magic Links normally open Safari rather than returning to the standalone app. Standalone authenticated login is therefore not verified and remains an iOS platform/Auth UX limitation outside v0.1.4.
- Android Chrome smoke passed. Android home-screen PWA existing-session use, browser-Gmail Magic Link completion, narrow layout, keyboard, member UI, shared/personal flow, and events Realtime passed.
- Android Gmail native-App limitation: its Magic Link does not return to the PWA. This is a cross-app handoff limitation, not a v0.1.4 application failure.
- Non-blocking browser observation: native `datetime-local` controls follow browser/system locale (Chrome 24-hour vs Safari 12-hour presentation); stored and rendered event times were correct.

Still pending:

- New-user first-login behavior with a newly created Auth account.
- The single-member-space UI path, which was intentionally not tested by removing a real member.

## Android Production Compatibility

- Date: 2026-07-06.
- Device: Xiaomi 14.
- Android version: 16.
- Browser: Chrome.
- URL: https://cross-platform-shared-calendar.vercel.app/.
- Network: mobile network.
- Test accounts: User A on desktop, User B on Android.
- Production page opened successfully.
- Android Chrome Magic Link login passed.
- Login session restore passed.
- Today, week, and month views passed.
- Mobile layout passed.
- New shared event default end time equals start time plus 1 hour.
- New personal event default end time equals start time plus 1 hour.
- Changing start time updates the end time while the end time has not been manually edited.
- Manually edited end time is not overwritten by later start-time changes.
- Editing existing shared and personal events does not reset the stored end time.
- Shared Realtime create, update, and delete passed.
- Personal read-only permission behavior passed.
- User A creating a personal event for User B transferred management permissions to User B as expected.
- Android Chrome add-to-home-screen passed.
- Home-screen PWA launch passed.
- Creating and deleting events from the PWA synced to desktop through Realtime.
- Issues found: none.
- Note: Android Chrome initially reported that it was still adding a previous site to the home screen; restarting Chrome resolved it. This was treated as a browser state issue, not a project bug.
- Conclusion: Android compatibility smoke test passed, including the previously pending authenticated Android CRUD, Realtime, and PWA compatibility scope.

## Supabase Restore Minimum Smoke Test

Run this if the Supabase Free project is restored after an inactivity pause:

- Production page opens.
- Magic Link login works.
- Session remains available after refresh.
- Calendar data can be read.
- Shared event create, edit, and delete work.
- Basic two-client Realtime sync works.

## Supabase Keep-Alive

- Endpoint: `/api/supabase-keepalive`.
- Schedule: daily Vercel Cron at `0 3 * * *`.
- Auth: `Authorization: Bearer <CRON_SECRET>`.
- Data access: three sequential anon-key, head-only reads from `spaces`.
- Expected unauthorized result: missing or incorrect bearer token returns `401`.
- Expected local missing-env result: correct token without required Supabase env vars returns `500` without printing env values.
- Expected success result after env setup: `200` with `{ "ok": true, "checks": 3 }`.
- Success response must not include query rows, space IDs, user data, Supabase keys, or `CRON_SECRET`.
- Production verification on 2026-07-09:
  - Passed: Cron Job registered for `/api/supabase-keepalive` at `0 3 * * *`.
  - Passed: unauthenticated browser request returned `401 unauthorized`.
  - Passed: first scheduled Production invocation returned HTTP 200.
- Vercel Dashboard checks after deploy:
  - `CRON_SECRET` is configured for Production.
  - The deployment includes `/api/supabase-keepalive`.
  - Continue checking Cron Jobs and Function logs to confirm later invocations return HTTP 200.
  - Function logs should show success/failure only and must not print secrets or query data.
- Supabase follow-up:
  - Confirm the project remains Active after several daily Cron runs and over longer periods.
  - The first successful invocation does not prove that the project can never be paused.
  - If the project still pauses, reassess whether a dedicated read-only RPC or Supabase Pro is needed.

## v0.1.3 Event Form UX Defaults

- Confirm `npm run build` passes.
- Create a new shared event and confirm the default end time is the default start time plus 1 hour.
- Create a new personal event and confirm the default end time is the default start time plus 1 hour.
- Create a new event, change the start time before touching the end time, and confirm the end time follows the new start time plus 1 hour.
- Create a new event, manually change the end time, then change the start time, and confirm the manually chosen end time is not overwritten.
- Create a new all-day event without manually editing the end time and confirm there is no UI or save regression.
- Create or edit an all-day event after manually editing the end time and confirm the existing behavior of saving the user-entered end value is preserved.
- Edit an existing shared event and confirm the stored end time loads from the database and is not reset to start plus 1 hour.
- Edit an existing personal event and confirm the stored end time loads from the database and is not reset to start plus 1 hour.
- Confirm a non-owner personal event still opens as read-only, without save or delete controls.
- Confirm Realtime create, update, and delete propagation still works between two authenticated sessions.
- Confirm desktop local or Production smoke test passes.
- Confirm iPhone smoke test passes.

Verified in a real browser on 2026-06-24:

- New shared and personal events defaulted the end time to start plus 1 hour.
- New-event start changes kept the end time at start plus 1 hour until the end time was manually edited.
- After manually editing the end time, later start changes did not overwrite the end time.
- Existing shared and personal events kept their original end times when opened for editing.
- Non-owner personal events remained read-only.
- Realtime create, update, and delete continued to work.
- All-day functional regression passed; no UI or save abnormality was observed. Database-field behavior was protected by the save-payload logic, but this manual pass did not separately inspect the stored database field.

## v0.1.2 HTTPS Production

- Production URL: https://cross-platform-shared-calendar.vercel.app/
- Vercel deployment completed successfully.
- Confirm the Production page loads without a Supabase configuration error.
- Confirm `VITE_SUPABASE_URL` uses only the Supabase project base URL ending in `.supabase.co`; it must not contain `/rest/v1/`.
- Supabase Auth Site URL is configured to the Production URL.
- Redirect URLs include the Production URL with and without a trailing slash.
- Local redirects currently include `http://localhost:5175`.
- `http://192.168.10.6:5175` is retained only as a temporary LAN phone-test redirect, not as a stable deployment address.
- Verified desktop User A Magic Link login, logout, repeat login, and session restoration.
- Verified the post-login URL remains on the Production domain; an empty `/#` is acceptable.
- Verified User A shared event create, update, and delete operations, including correct state after refresh.
- Verified User A personal event create, update, and delete operations.
- Verified Realtime create, update, and delete propagation between two browser windows using User A.
- Verified `/manifest.webmanifest`, `/icons/icon-192.svg`, and `/icons/icon-512.svg` are accessible.
- Verified iPhone Safari can open the Production URL.
- Verified the app can be added to and launched from the iPhone home screen.
- Verified the logged-out iPhone layout displays the email login entry point correctly.
- Verified User B can log in to the Production URL via Magic Link from an incognito window and reach the calendar page.
- Verified A and B pages both remain normal after B login and show the same invite code, confirming they are in the same shared space.
- Verified two-account shared Realtime:
  - A creates `ab realtime create test`; B sees it without refreshing.
  - B edits it to `ab realtime edit test`; A sees the update without refreshing.
  - B deletes it; A sees it disappear without refreshing.
- Verified A-owned personal permissions and Realtime:
  - A creates `a personal readonly test`; B sees it without refreshing and it is labeled as the other person's event.
  - B opens it read-only, with no save button, no delete button, and non-editable title/time fields.
  - A edits it to `a personal owner edit test`; B sees the update without refreshing.
  - A deletes it; B sees it disappear without refreshing.
- Verified B-owned personal event creation from A's session:
  - A creates `b personal ownership test` as a personal event belonging to B.
  - B sees it without refreshing and it is labeled as mine.
  - A sees it as the other person's event and can only open it read-only, with no save/delete controls.
  - B can edit and delete it as owner.
  - After B deletes it, A sees it disappear automatically.
- Verified authenticated iPhone Production flow:
  - iPhone logs in with User B and ends on the Production domain.
  - iPhone reaches the calendar page with normal mobile layout.
  - iPhone B creates `iphone shared test`; desktop A sees it without refreshing.
  - iPhone B deletes it; desktop A sees it disappear without refreshing.
- Pending: authenticated Android CRUD because the Android device is temporarily unavailable.

## Local Build

- Run:

  ```bash
  npm run build
  ```

- Expected result: TypeScript and Vite production build pass.

## Local Development Server

- Run:

  ```bash
  npm run dev
  ```

- Expected result: Vite starts on fixed port `5175`.
- Browser acceptance testing should open `http://127.0.0.1:5175`.
- `http://localhost:5175` is also valid for desktop local testing.
- Do not use Vite's default `5173` port for this project.
- The dev script uses `--strictPort`, so startup should fail instead of falling back to another port when `5175` is occupied.

## Supabase Schema

- Execute `supabase/schema.sql` in the Supabase SQL Editor.
- Confirm tables, indexes, triggers, RLS policies, and RPC functions are created.
- Confirm RLS is enabled for `profiles`, `spaces`, `space_members`, and `events`.
- Confirm `public.generate_invite_code()` can create a code without a `gen_random_bytes` lookup error.
- Confirm PostgREST can query `space_members` with `profiles(display_name)` through the direct profile foreign key.
- Confirm `public.events` is included in the `supabase_realtime` publication.
- Confirm `public.events` uses `replica identity full` so filtered DELETE events include `space_id`.

For an existing environment, do not rerun the full schema. Before applying the v0.1.1 patch, run this preflight query:

```sql
select id, space_id, scope, owner_user_id
from public.events
where (scope = 'shared' and owner_user_id is not null)
   or (scope = 'personal' and owner_user_id is null);
```

- Expected result: zero rows.
- If any row is returned, stop and inspect the data before applying the patch.
- When preflight passes, execute `supabase/patches/2026-06-20-v0.1.1-personal-permissions.sql`.

## Magic Link

- Configure Supabase Auth redirect URLs for local development and deployment domains.
- Request a Magic Link from the login page.
- Open the email link on desktop and mobile.
- Confirm the app restores the Supabase session after redirect.

## Two-User Flow

- User A creates a shared space.
- User A copies the invite code.
- User B joins with the invite code.
- User A creates, edits, and deletes an event.
- User B creates, edits, and deletes an event.
- Confirm both users can see shared updates.
- Keep User B open while User A creates an event, and confirm it appears without refreshing.
- Delete the event in User B's session and confirm it disappears from User A's session without refreshing.
- Confirm "我的", "对方的", and "共同的" labels render correctly from each user's perspective.

## Personal Event Permissions

- User A creates a personal event owned by A.
- User B can view it and open a read-only detail sheet.
- User B does not see save or delete controls.
- The read-only detail sheet remains fully visible or scrollable within the viewport on desktop and mobile.
- User A can edit and delete it.
- User A creates a personal event owned by B.
- User A can only view it after creation; User B can edit and delete it.
- Either member can edit and delete a shared event.
- Allowed edits and deletes continue to propagate through Realtime.

## Direct API Permission Checks

- As User B, attempt to update and delete a personal event owned by User A.
- Expected result: RLS rejects the operation or affects zero rows; the stored event remains unchanged.
- As an authorized event manager, separately attempt to change `space_id`, `created_by`, `scope`, and `owner_user_id`.
- Expected result: the event validation trigger rejects each identity-field change.
- Verified on 2026-06-21: non-owner personal UPDATE/DELETE affected zero rows; all four identity-field updates raised the expected trigger errors.

## Space Capacity

- User C tries to join the already full space.
- Expected result: the join RPC returns a clear error and User C is not added.

## RLS Isolation

- A non-member attempts to read spaces, members, and events.
- Expected result: non-members cannot read or modify private space data.

## Mobile Browsers

- Test on iOS Safari.
- Test on Android Chrome.
- Confirm login, onboarding, event creation, event editing, event deletion, and calendar navigation work on narrow screens.

## PWA

- Open the app on mobile.
- Add it to the home screen.
- Launch from the home screen.
- Confirm the app opens with standalone PWA presentation where supported.
