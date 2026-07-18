# Backlog

## P0 - Blocking Verification or Core Use

- Investigate any Magic Link, RLS, Realtime, or Production deployment regression that blocks the two-person calendar flow.

## P1 - Near-Term Product Polish

- v0.1.7.3.3 Split Recurring Event: add the approved “此次及未来事件” flow through `split_recurring_event`. It must cut off the old segment, create a child with `series_id` / `parent_event_id` lineage, use the modified occurrence as the future anchor, rebuild recurrence cadence, and separately verify timezone/DST behavior. Do not include logical-series deletion UI in this slice.
- Continue event create/edit UX polish after the v0.1.3 default end-time improvement.
- Establish a simple backup and restore flow for Supabase data.
- Occasionally check that Vercel Cron invocations continue to return HTTP 200 and that Supabase remains Active.

## P2 - Product Extensions

- Space member management and invitation experience improvements.
- Evaluate multi-member or multi-space expansion beyond the current two-person v0.1 model.
- Reconsider `space_members.nickname` only after multi-space support creates a real per-space naming need.
- Add lightweight reminders.
- Add anniversaries.
- Add countdowns.
- Add a shared Todo list.

## P3 - Long-Term Directions

- Re-evaluate Supabase Pro if the project becomes a formal service that must stay online long term.
- Native iOS / Android apps.
- App Store / Play Store distribution.
- Paid or account-tier model.
- External calendar import/export.
- External calendar sync options such as Apple Calendar, Google Calendar, or CalDAV.

## Completed and Deferred History

### v0.1-smoke-test

- Completed: real Supabase integration testing for the available v0.1 scope.
- Completed: two-user end-to-end flow, RLS/RPC checks, and Realtime checks across browser sessions.
- Completed: authenticated Android CRUD, Realtime, and PWA compatibility testing on Xiaomi 14 / Android 16 / Chrome.

### v0.1.1

- Completed: restrict personal event updates/deletes to `owner_user_id`.
- Completed: show non-owner personal events as read-only details.
- Completed: desktop two-account UI, RLS, direct API, trigger, and Realtime regression tests.
- Completed: deferred Android Magic Link and authenticated CRUD testing in the later Android compatibility smoke pass.

### v0.1.2

- Completed: deploy the current app to a stable Vercel HTTPS Production URL.
- Completed: configure the Production Site URL and allowed Redirect URLs in Supabase Auth.
- Completed: verify desktop User A Magic Link, session restoration, shared/personal CRUD, and same-account two-window Realtime in Production.
- Completed: verify Production manifest/icons and logged-out iPhone Safari add-to-home-screen behavior.
- Completed: verify User B Production Magic Link login.
- Completed: verify two-account Production shared Realtime create/update/delete.
- Completed: verify two-account Production personal-event owner/read-only permissions and Realtime propagation.
- Completed: verify authenticated iPhone User B Production login, mobile layout, shared CRUD, and desktop Realtime propagation.
- Completed: deferred authenticated Android CRUD, Realtime, and PWA compatibility testing in the later Android compatibility smoke pass.

### v0.1.3

- Completed: new event drafts prefill the end time as start time plus 1 hour for shared and personal events.
- Completed: new event end time follows start time changes until the user manually edits the end time.
- Completed: editing existing events preserves the stored end time instead of resetting it to a default.
- Completed: all-day compatibility keeps unedited new all-day event `ends_at` values null while preserving manually edited end values.
- Completed: implemented a minimal Supabase Free keep-alive using daily Vercel Cron and a CRON_SECRET-protected read-only Function.
- Completed: verified the Cron Job registration, unauthorized 401 response, and first scheduled Production invocation returning HTTP 200.

### v0.1.4

- Completed: global `profiles.display_name`, a compact member list, self-service name editing, and concrete personal-event owner labels.
- Completed: Production Supabase patch plus constraint, trigger, and unchanged-RLS verification; local and deployed two-account desktop member/permission/Realtime smoke.
- Completed: Production iPhone Safari browser smoke and Android Chrome/PWA smoke, including member labels, owner permissions, shared/personal CRUD, narrow layout, keyboard behavior, and events Realtime.
- Deferred: safe single-member-space and newly created-account first-login verification.
- Known limitation: iOS standalone PWA Magic Links return to Safari because storage is isolated; Android PWA Magic Links complete from browser Gmail but not from the Gmail native App. This is not addressed by v0.1.4.

### v0.1.5

- Completed repository implementation: Email OTP replaces Magic Link login so users enter an 8-digit code in their current browser or PWA container.
- Completed local acceptance: SMTP/template configuration plus existing-user and new-user OTP login, new-user space creation, member display-name update, and existing-session regression.
- Pending: desktop and mobile browser/PWA manual acceptance.
