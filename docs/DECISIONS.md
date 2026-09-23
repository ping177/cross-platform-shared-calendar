# Decisions

## v0.1 Product Shape

- v0.1 is a Web/PWA, not a native iOS or Android app.
- "Cross-platform" means the app works in iOS Safari and Android Chrome. It does not mean bidirectional sync with Apple Calendar or Google Calendar.
- The backend uses Supabase Auth, Supabase Postgres, Supabase RLS, and Supabase Realtime.

## Data Model

- Event ownership uses stable fields: `scope + owner_user_id`.
- The app does not store relative viewpoint values such as `mine`, `partner`, or `shared` for event ownership.
- UI labels like "我的", "对方的", and "共同的" are derived from the current user and `owner_user_id`.
- Both space members can read personal events, but only `owner_user_id` can update or delete them.
- Both space members can update or delete shared events.
- Members may create a personal event for their partner; after creation, only the assigned owner can manage it.
- Existing events cannot change `space_id`, `created_by`, `scope`, or `owner_user_id`.
- Frontend read-only behavior is for usability; RLS and database triggers remain the final permission boundary.

## Space Membership

- Creating a space, joining by invite code, and rotating invite codes are handled by RPC functions so the operations complete atomically.
- RLS remains enabled, and RPC functions perform explicit membership and capacity checks.

## v0.1.4 Member Identity

- v0.1.4 only uses the existing global `profiles.display_name`; it does not add `space_members.nickname`.
- `display_name` is nullable for compatibility. A non-null value is trimmed and limited to 1–20 characters; the UI safely falls back to 「成员」 when it is absent or invalid.
- New users receive a profile with `display_name = null`. Neither Auth metadata nor email/email prefix is used as a public default, to avoid unintended identity disclosure.
- A space member may update only their own global display name under the existing `profiles_update_self` RLS policy. No profile, space-member, or event RLS policy is broadened.
- Personal event labels show the stored owner’s member display name; shared event labels remain 「共同」. Labels never participate in permission checks.
- Name saves reload the local member list. v0.1.4 does not subscribe to profile or member Realtime changes; other devices see a changed name after refresh, re-entry, or session restoration.
- Reconsider `space_members.nickname` only if multi-space support and real per-space naming needs are introduced.

## v0.1.5 Email OTP

- Passwordless login uses Email OTP instead of Magic Link. Users enter the 8-digit code in the active browser or PWA container.
- This removes the Magic Link dependency on mail-client, browser, and standalone-PWA return handling. It does not merge Safari and standalone PWA session storage.
- The existing Supabase client, `getSession()`, and `onAuthStateChange()` remain the session architecture. No database, schema, RLS, event, or membership behavior changes.

## v0.1.7.3 Recurring Event Editing Semantics

- Recurring source events remain the baseline; projected occurrence rows are not materialized. `occurrence_date` is the scheduled local date in the source recurrence-rule timezone and is the stable occurrence mutation identity.
- **Only this event:** use `event_occurrence_exceptions` through a database RPC. An only-this edit never directly updates the source event; an only-this delete writes a `deleted` exception.
- **Delete all recurring events:** delete the complete logical series lineage: root segment, every child segment, and their exceptions. This matches the product meaning of deleting the whole recurring series.
- **Logical-series deletion UI:** defer it. Keep `delete_logical_series` as a permission-checked backend RPC, but do not expose a frontend entry point until a separately approved high-impact deletion UX provides explicit copy and safeguards.
- **This and following:** use a series split. The old segment receives an exclusive `recurrence_until` cutoff; the child keeps the same `series_id` and sets `parent_event_id` to the old segment ID.
- **Final split exception handling:** future exceptions migrate from the old segment to the child, a split-day override is consumed by the child baseline, and a split-day deletion is rejected. This supersedes the earlier design rule that a split never migrates exceptions.
- **Recurring mutations:** the frontend must not compose `update + insert + delete` requests for an occurrence operation. It calls a permission-checked database RPC so locks, validation, and writes are one transaction.
- Only-this does not currently support an `all_day` override. The override contract is limited to `starts_at`, `ends_at`, `title`, and `description` until a separately approved projection change expands it.

## v0.1.8 Mobile Push Reminder Architecture Freeze

- `v0.1.8 — Mobile Push Reminder` is `CLOSED / PASS`. Slice 1 (`v0.1.8.1 — Push Infrastructure Foundation`) passed on Desktop Chrome/macOS, iPhone installed PWA, and Android Studio Emulator. Android evidence is emulator-based: permission/subscription and test Push passed; physical-device heads-up presentation was not validated.
- **Implementation status:** `v0.1.8.2 — Reminder Persistence + Ordinary Event Delivery` Slice A/B/C, Slice 3 Recurrence Reminder Integration, and final cross-platform acceptance are `CLOSED / PASS`. The reviewed long-duration correction changes only the Reminder projection adapter and leaves the canonical recurrence engine unchanged. DB patch, `send-reminders` v2, frontend rollout, scheduler health, ordinary regression, recurring override/delete/split behavior, Mac/iPhone automatic Push, and Android Emulator ordinary automatic Reminder passed acceptance. This freeze supersedes the earlier Option A `events.reminder_offset_minutes` decision.
- **Reminder persistence:** use one nullable event-level `events.reminder_kind`, with `timed_at_start`, `timed_10m_before`, `timed_30m_before`, `timed_1h_before`, `timed_previous_day_same_time`, `all_day_same_day_08`, and `all_day_previous_day_20`; `null` means no reminder. Do not create a JSON reminder config, multiple-reminder table, arbitrary-minute reminder, or per-user reminder preference.
- **Defaults and migration:** new timed events created by the v0.1.8.2 UI default to `timed_10m_before`; new all-day events default to `all_day_same_day_08`. The database default remains `null`, every historical Event migrates with `reminder_kind = null`, and rollout never silently enables reminders for existing data.
- **Canonical Event timezone:** add nullable `events.time_zone` containing an IANA timezone detected from the creating browser/PWA through standard `Intl` capability. Never hardcode one country/offset, never silently fall back to UTC when detection fails, and never silently rewrite an existing Event when a device later changes timezone. A required capture failure blocks the complete mutation with a controlled validation error. Historical ordinary Event timezone remains null rather than guessed; historical recurring sources may initialize it from their already-authoritative `recurrence_rule.time_zone`. A timezone-dependent reminder selected on a null-timezone Event establishes the canonical timezone from the current device. A recurring Event's `events.time_zone` and `recurrence_rule.time_zone` must agree.
- **Due semantics:** minute presets subtract real minutes from the effective start. `timed_previous_day_same_time` means the prior calendar day at the same wall-clock time in the Event timezone, using the existing recurrence DST conversion semantics rather than fixed 1440 minutes. All-day presets use effective Event date plus canonical timezone at 08:00 the same day or 20:00 the prior day. Multi-day reminders use only the range start; `ends_at` does not affect v0.1.8 due calculation.
- **Conversion and edits:** timed-to-all-day maps a non-null reminder to `all_day_same_day_08`; all-day-to-timed maps a non-null reminder to `timed_10m_before`; null remains null, and the UI must expose the resulting option. Start/date, all-day, reminder-kind, or timezone changes update the internal `reminder_schedule_changed_at` marker and derive a new current due; title/description/ends-at changes do not update that marker. Event mutations do not create, cancel, or otherwise maintain delivery rows.
- **Past due and grace:** creating, editing, enabling, or changing a reminder never immediately sends or compensates when the newly derived due is already past. The roughly ten-minute grace applies only to infrastructure delay and applies equally to timed and all-day reminders.
- **Current all-day boundary:** v0.1.8.2 accepts the existing all-day presentation flag plus effective date model and does not introduce date-only storage, exclusive-end semantics, or a new all-day recurrence representation. Implementation must stop and report if effective date plus canonical timezone cannot safely produce all-day 08:00.
- **Delivery channel:** use standards-based Web Push to system notifications. Email reminder delivery, SMS, Bark, notification inbox/history, snooze, sound customization, and native alarms are excluded. Existing Email OTP authentication is unrelated and remains unchanged.
- **Push client:** add a Service Worker that handles Push and notification clicks only. It must not add offline caching. Permission is requested only after an explicit user action; iPhone and Android installed PWAs are the primary mobile targets.
- **Subscription identity:** `push_subscriptions` binds a subscription to `user + installation`, not to a Space. One user may retain simultaneous iPhone, Android, and Desktop subscriptions. Endpoint, `p256dh`, `auth`, expiry/lifecycle state, and installation identity are stored per subscription.
- **Future multi-space compatibility:** a device subscription is reusable across every Space the user may join in a future multi-space model. v0.1.8 does not implement multi-space. Delivery resolves recipients at send time through `event.space_id` and current membership, so a multi-space schema upgrade must not require redesigning Push Subscription persistence.
- **Recipients:** a shared event reminder applies to every current active member of its Space, and the reminder UI must disclose this behavior. A personal event reminder applies only to the current `owner_user_id`. A user without an active subscription receives no device notification, and a former Space member must not receive a delivery.
- **Recurrence:** Production ordinary non-recurring and Slice 3 recurring delivery dynamically project due occurrences through the existing runtime-neutral recurrence engine using source Event + rule + cutoff + exceptions. Its timezone/calendar-bounded window covers every frozen Reminder kind and grace period, including moved-in overrides, without a second recurrence/DST algorithm or occurrence materialization.
- **Scheduling:** Supabase Cron invokes an Edge Function sender every minute. Normal target precision is about one minute. A simple configurable late-delivery grace window may compensate reminders missed within roughly ten minutes; reminders older than that window are not sent late. Web Push is best-effort and is not an Alarm Clock.
- **Future consideration — Web/PWA Push delivery precision:** semantic `due_at` remains exact. The accepted recurring E2E produced the exact ten-minute lead time (`11:45` due for an `11:55` start), while once-per-minute Cron plus asynchronous `pg_net` and Web Push claimed/finalized around `11:46`. This is scheduler/network/provider delivery latency, not a due-calculation defect. v0.1.8 does not add a `-60s` early-dispatch allowance, does not distinguish ordinary and recurring Reminder timing, and does not change Cron frequency or redesign the scheduler. Revisit only if real-use feedback shows material UX impact or a future native iOS/Android app adopts OS-level local notification scheduling.
- **Future consideration — physical Android heads-up presentation:** Android Studio Emulator functional delivery, sound, and notification-shade presence passed, but no heads-up banner was observed and physical Android hardware presentation was not validated. This may be casually revalidated later; it is not a release blocker and does not reopen v0.1.8.
- **Delivery ledger:** Slice C1 creates durable audit rows only for currently due, eligible ordinary Event/subscription pairs after atomic current-state revalidation. Event, recipient-user, and subscription IDs deliberately have no foreign keys so audit survives later lifecycle changes. The minimal lifecycle is `claimed` / `sent` / `failed`; there is no long-lived pending queue, mutation-time ledger cancellation, processing recovery, retry scheduler, or generic background-job abstraction. The ledger is server-only and the claim function is executable only by `service_role`.
- **C2 scan caps:** the future ordinary-Event candidate scan must abort the invocation before any claim or Push send if the enabled ordinary-Event scan exceeds 1000 rows. After eligibility is fully derived, delivery tasks are ordered deterministically by `due_at` ascending before applying the 50-task per-invocation cap. These bounds do not introduce a queue.
- **Schedule marker precision:** `claim_reminder_delivery` compares `p_expected_reminder_schedule_changed_at` to the current Event marker using exact PostgreSQL `timestamptz` equality. Future callers must round-trip the database value without JS date reformatting, precision truncation, or reconstruction; a lossy marker is stale and the claim returns null.
- **Idempotency:** the local Slice 3 ledger identity is `(logical_series_id/event_id, nullable occurrence_date, subscription_id, due_at)` with `NULLS NOT DISTINCT`. Ordinary rows keep `occurrence_date = NULL`, preserving their former identity and requiring no backfill; recurring rows use the stable scheduled `occurrence_date`, so two occurrences moved to the same due remain distinct across split lineage. `recipient_user_id` remains audit context. Provider failures are not automatically retried.
- **Recurring claim boundary:** recurring delivery uses a separate service-role-only `SECURITY DEFINER` claim with a hardened search path. It atomically revalidates exact source revision/Reminder marker, expected exception absence or exact override revision/type, current membership/subscription, effective schedule freshness, due/grace, and ledger uniqueness. SQL never expands recurrence; the trusted Edge caller supplies the canonical projection snapshot.
- **Occurrence schedule marker:** a normal occurrence uses the source `reminder_schedule_changed_at`. An only-this override contributes `exception.updated_at` only when its effective start differs from the canonical scheduled start; title/description-only overrides do not suppress a valid due. Split children inherit Reminder/timezone and receive their own insert-time marker to prevent newly-past catch-up.
- **Implementation slices:** deliver Push Infrastructure Foundation, Reminder Persistence + Ordinary Event Delivery, Recurrence Integration, then Production Validation + Canonical Closeout. Later roadmap versions remain directional and do not imply frozen architecture.
- **Web Push server dependency:** `@mmmike/web-push@1.3.0` remains pinned exactly at the Edge-function boundary and is loaded only by the server-only shared Web Push sender currently reused by `send-test-push`. No browser Web Push package or root npm dependency is added; the client uses the platform Service Worker, PushManager, Notification, and PushSubscription APIs directly.
- **Slice 1 security boundary:** authenticated clients register/disable only through `SECURITY DEFINER` RPCs whose identity comes from `auth.uid()`; clients receive no direct subscription-table privileges. The test sender accepts only an installation UUID, re-authenticates the JWT, scopes lookup and invalid-subscription retirement to that user, and allowlists current Chromium, Mozilla, and Apple push-service hosts before outbound delivery.
- **Slice 1 validation strategy:** retain safe test-sender diagnostics (`status`, `delivered`, hostname-only `provider`, `gone`) and treat retry, unsubscribe/resubscribe, then browser/PWA restart as first-line recovery for an accepted-but-not-displayed Push before deeper RCA. The initial Desktop Chrome subscription recovered after resubscription; no architecture, VAPID, Edge Function, or Service Worker blocker was found.
- **C2 Phase 1 acceptance note:** the deployed shared sender preserved the existing `send-test-push` response and notification behavior on Desktop Chrome/macOS and iPhone installed PWA. Repeated Desktop banners using the unchanged constant `shared-calendar-test` tag are pre-existing/non-blocking behavior; this Phase does not change the tag or add `renotify`.

## v0.1.9 Shared Tasks MVP Scope Freeze and Slice 1 Foundation

- Status is `v0.1.9 CLOSED / PASS; SLICE 1/2/3 CLOSED / PASS`. The canonical detailed contract is `docs/v0.1.9_SHARED_TASKS_SPEC.md`; the backend was applied/postflight verified and the Vercel frontend passed user-run Desktop A/B and iPhone Production acceptance. v0.1.9 is the latest accepted user-facing Production capability.
- A Task means something that remains to be completed; an Event means when something happens. Every Task belongs to exactly one explicit Space, and a Task due date never creates or mutates an Event.
- `created_by` is immutable creator attribution only. Assignment identifies responsibility: null means shared; a current same-Space member ID owns status transitions while not restricting collaborative visibility, editing, reassignment, or deletion.
- Every current Space member may view, edit title/due date, reassign, and delete every Task. Shared Task complete/reopen is open to any current member; assigned Task complete/reopen belongs only to its current assignee. Former and non-members have no access. RLS plus a database trigger checking `OLD.assigned_to_user_id` remain authoritative.
- Status is exactly `open` or `completed`; v0.1.9 stores no completion actor, timestamp, or history. `due_on` is an optional PostgreSQL `date` with no time or timezone.
- v0.1.9 adds only `public.tasks` with `id`, `space_id`, `created_by`, `assigned_to_user_id`, `title`, `status`, `due_on`, `created_at`, and `updated_at`. It adds no Task scope, description, reminder, recurrence, priority, tags, ordering, JSON config, or Event foreign key.
- If an assigned member leaves the Space, the Task becomes shared. The actual local Supabase PostgreSQL 17.6 target supports the chosen composite FK `(space_id, assigned_to_user_id) → space_members(space_id, user_id)` with column-specific `ON DELETE SET NULL (assigned_to_user_id)`, so the Task and `space_id` survive without a cleanup trigger.
- The single list index is `(space_id, status, due_on, created_at, id)`, matching the frozen stable ordering including PostgreSQL ascending nulls-last behavior. Task CRUD remains direct PostgREST + RLS; no Task RPC was added.
- Task CRUD should use direct Supabase/PostgREST. Do not add Task CRUD RPCs without a demonstrated atomicity requirement. Realtime reuses the existing Space-filtered Supabase pattern and compatible filtered-delete replica identity.
- Decision: `MULTISPACE_NOT_REQUIRED_FOR_V019`. Explicit `space_id` keeps Task identity future-compatible; v0.1.9 does not change current membership lifecycle, add a Space selector, or implement Multi-space.
- Task Reminder is deferred. v0.1.9 does not modify Event Reminder persistence, sender, ledger, Cron, Web Push, recipients, or recurrence projection, and does not reopen v0.1.8.
- Implementation is bounded to Slice 1 persistence/authorization, amended Slice 2 current-Space CRUD/UI/Realtime, and separately authorized Slice 3 Production acceptance/closeout. The earlier top-level `Calendar / Tasks` switch is superseded by the minimum reusable current-Space / Space Hub entry. Slice 2 frontend passed user-run authenticated acceptance locally before the separately approved Vercel deployment and Production acceptance.
- **2026-09-23 status-ownership correction:** Real A/B acceptance found that A could complete a Task assigned to B under the former all-member status rule. The product rule now requires A to reassign B's Task to A first, then complete in a second UPDATE. A same-statement reassignment plus status transition is rejected against the old assignee. The small corrective trigger was applied to Production after local tests and postflight; existing Task RLS and ordinary collaborative edits remain unchanged. This does not close Slice 2 acceptance.

## Authenticated Integration and backend-first rollout — 2026-09-23

- Before requesting any real-login, A/B, Realtime, or authenticated mobile/PWA manual acceptance, Codex must verify the frontend's actual backend environment, the backend's required schema/RPC/Edge Function capabilities, and feature-version compatibility. A mismatch blocks manual acceptance.
- A reviewed, tested, backward-compatible additive backend change may reach Production first, followed by backend postflight and user-run real-account acceptance of the local new frontend against Production. Frontend commit/push and Vercel rollout wait until that acceptance passes and separate Git authorization is given.
- Frontend defects remain local; backend corrections require a new reviewed forward corrective migration. Applied Production migrations are not rewritten, and Production is not casually rolled back or reset. Breaking/destructive migrations require a separate rollout, compatibility, and rollback plan.
- Codex owns automated checks and environment alignment. The user owns Magic Link/OTP, A/B real-account, authenticated browser-session, and iPhone/Android/PWA acceptance in real browsers/devices. The 2026-09-23 Slice 1 Production Task foundation postflight passed; this is not Slice 2 or v0.1.9 user-facing Production acceptance.

## Shared Life Architecture Freeze — 2026-09-23

The canonical long-term model and roadmap are in [Shared Life Architecture Freeze](./SHARED_LIFE_ARCHITECTURE.md). This is a docs-only architecture decision, not an implementation or deployment milestone.

- First-level navigation is `首页 / 日历 / 空间 / 我的`: cross-module Home with future global create, Calendar time/source aggregation, Personal and Shared Spaces with modules, and personal account/device/settings respectively. The full navigation is not part of v0.1.9.
- Each user will have one genuinely private Personal Space and may join multiple Shared Spaces. Each business object has one canonical Space; views may aggregate Spaces. An Event marked `personal` inside a Shared Space remains visible to that Space's members and is distinct from Personal Space content.
- Each Space has Calendar as its core and may enable Tasks, Lists, Important Dates, structured Review / Check-in, Memo, or later modules. Enablement is per Space; disabling hides a module without deleting its data, and re-enabling restores visibility. Permanent data deletion is deferred; enable/disable authority remains open for v0.1.10 implementation design.
- Calendar Sources may be Space-backed or global/external, including Chinese holidays and adjusted workdays, ICS, and later Google or Apple/System calendars. External sources need no owning Space; views may overlay or filter Space Calendars.
- Future global create supports Event, Task, List, Important Date, and Memo; Wishlist is a List type. Default target follows a specific Space or sole Calendar Space filter, otherwise Personal Space. The form exposes a selectable target, the action names it, and a second target confirmation precedes the write.
- Event and Task retain distinct semantics. Task due dates may later be projected read-only into Calendar. Review / Check-in is structured content with period, Focus, Wins, Problems, next plan, and historical continuity; voice input is a goal without a frozen technical approach. Task Archive is deferred; v0.1.9 Completed remains reopenable/deletable history without a new status.
- Directional versions now place Personal Space/Multi-space/module enablement at v0.1.10, navigation/aggregation at v0.1.11, Lists at v0.1.12, Important Dates at v0.1.13, Review at v0.1.14, and Calendar Sources v1 at v0.1.15. Native remains a decision gate without a committed implementation version.

## PWA

- v0.1 includes basic PWA support with a manifest and mobile meta tags.
- v0.1 does not add complex service worker offline caching, to avoid stale-cache issues during testing.
- iOS Standalone PWA cannot actively refresh itself; treat that as an iOS system limitation rather than an application defect. Supported user-driven recurrence interactions were accepted in the final Production smoke.

## Supabase Free Operations

- Use a daily Vercel Cron keep-alive while the project remains on Supabase Free.
- The keep-alive uses the Supabase anon key and RLS-protected, head-only reads; it does not use service role or return business data.
- Do not add a heartbeat table or modify the database schema or RLS solely for keep-alive.
- Continue observing Cron results and Supabase Active status; reconsider Supabase Pro only if the project becomes a formal service that must remain online long term.

## Project Command Center Filesystem Data Governance

- Stable projectId is `cross-system-shared-calendar`.
- The 2026-08-08 filesystem persistence audit found no filesystem-level persistent project data, so the canonical `/Users/wp/Projects/_project-data/cross-system-shared-calendar/` directory is not currently required and no migration is required.
- Supabase remains the canonical cloud business persistence. Supabase data must not be mirrored locally for this filesystem governance boundary.
- If true filesystem-level persistent runtime or user data is introduced later, it must use `/Users/wp/Projects/_project-data/cross-system-shared-calendar/` as its canonical root after governance review.
