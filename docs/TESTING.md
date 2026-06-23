# Testing

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
- Pending: User B Production login and two-account Production Realtime.
- Pending: authenticated iPhone CRUD.
- Pending: Android Magic Link login.
- Pending: viewing, creating, editing, and deleting events after login on Android.
- Pending reason: further Magic Link tests are deferred to avoid consuming the Supabase default email-rate allowance, and the Android device is temporarily unavailable.

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
- Pending: User B Production login, two-account Production Realtime, authenticated iPhone CRUD, and authenticated Android CRUD.

## Local Build

- Run:

  ```bash
  npm run build
  ```

- Expected result: TypeScript and Vite production build pass.

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
