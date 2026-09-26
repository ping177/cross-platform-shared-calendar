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

- At the 2026-09-23 architecture freeze, first-level navigation was `首页 / 日历 / 空间 / 我的`: cross-module Home, Calendar time/source aggregation, Personal and Shared Spaces with modules, and personal account/device/settings respectively. That shipped navigation remains current until the separately frozen v0.1.12 migration below; the full navigation was not part of v0.1.9.
- Each user will have one genuinely private Personal Space and may join multiple Shared Spaces. Each business object has one canonical Space; views may aggregate Spaces. An Event marked `personal` inside a Shared Space remains visible to that Space's members and is distinct from Personal Space content.
- Each Space has Calendar as its core and may enable Tasks, Lists, Important Dates, structured Review / Check-in, Memo, or later modules. Enablement is per Space; disabling hides a module without deleting its data, and re-enabling restores visibility. Permanent data deletion is deferred; v0.1.10 enable/disable authority is frozen below.
- Calendar Sources may be Space-backed or global/external, including Chinese holidays and adjusted workdays, ICS, and later Google or Apple/System calendars. External sources need no owning Space; views may overlay or filter Space Calendars.
- The initial long-term creation model considered Event, Task, List, Important Date, and Memo; Wishlist is a List type. Slice 4's final product decision below supersedes the Home entry surface: the current Event and Task section actions each open their matching form directly. Each Home form has a selectable target, names it in the save action, and requires a second target confirmation before writing. Future module actions will be considered with their Home sections when implemented.
- Event and Task retain distinct semantics. Task due dates may later be projected read-only into Calendar. Review / Check-in is structured content with period, Focus, Wins, Problems, next plan, and historical continuity; voice input is a goal without a frozen technical approach. Task Archive is deferred; v0.1.9 Completed remains reopenable/deletable history without a new status.
- The original 2026-09-23 directional roadmap placed Lists at v0.1.12, Important Dates at v0.1.13, Review at v0.1.14, and Calendar Sources v1 at v0.1.15. This sequence is superseded by the 2026-09-25 roadmap re-freeze below; later module priorities and ordering are open to change based on real product use. Native remains a decision gate without a committed implementation version.

## v0.1.10 Personal Space / Multi-space / Module Enablement Scope Freeze — 2026-09-23

- Status at scope freeze: `CLOSED / READY FOR IMPLEMENTATION`. Final status: Slice 1 backend `PRODUCTION BACKEND ROLLOUT PASS`; Slice 2 `CLOSED / PASS`; Slice 3 `CLOSED / PASS` after user-run authenticated Production acceptance; v0.1.10 `CLOSED / PASS`. The full contract and accepted closeout state are in `docs/SHARED_LIFE_ARCHITECTURE.md` and `docs/TESTING.md`.
- Reuse `spaces / space_members`; `spaces.kind` is `personal | shared` with `shared` as the legacy default. The sole Personal Space per user uses **`UNIQUE(created_by) WHERE kind = 'personal'`**, never `UNIQUE(kind, created_by)`, so multiple Shared Spaces remain possible. Personal membership is exactly the creator as sole owner, enforced even against direct membership writes. `kind` and `created_by` cannot be client-mutated; Personal Spaces cannot be invite-joined, exited, or ordinarily deleted.
- Remove the one-user-one-space membership unique index while retaining `(space_id, user_id)` identity. Shared create RPC still creates Shared Spaces only; join checks duplicate membership in the target Space and retains the two-member limit. Shared Space three-plus-member support is deferred because existing Event UI assumes one other member.
- Personal Space Events are database-enforced `scope = 'personal'` with `owner_user_id = spaces.created_by`; their UI hides the audience selector. Shared Space `scope = 'personal'` retains its existing meaning. Personal Tasks retain the existing schema and authorization, hide assignment UI, and default new rows to `assigned_to_user_id = NULL`.
- Calendar is implicit and always enabled. `space_modules(space_id, module_key, enabled)` stores optional Space-level state; absent row means disabled. Existing Shared and new Personal/Shared Spaces have Tasks enabled by default; Lists, Important Dates, Review, and Memo default disabled. v0.1.10 exposes only the Tasks toggle. Disabling Tasks retains SELECT/history but blocks all Task mutation at the database boundary; re-enabling restores access to historical rows. Only Space owner may toggle through a controlled RPC; other members read state without direct table-write rights.
- One validated frontend `selectedSpaceId` drives Event, Task, members, modules, and Realtime. The client must prevent stale requests/subscriptions from crossing a switch. Existing users initially retain their old Shared Space; users without a Shared Space default to Personal Space. Current Space is not a unique profile/database attribute.
- Backend capability may deploy first, but no Personal Space auto-creation or bulk backfill occurs before compatible frontend readiness. The new frontend then uses an idempotent `ensure_personal_space()` per user; bulk backfill is considered only after real authenticated acceptance. Production schema/index/RPC/RLS preflight and postflight are required; the read-only repository audit did not establish Production state.
- Three slices: Data / permission foundation; Selected/current Space vertical flow; Tasks module enablement + user-visible `Task / Tasks` → “任务” UI text closeout, without full i18n. Preserve Event/Task identity, v0.1.9 Task authorization, v0.1.8 Reminder semantics, and recurrence. Full navigation, aggregation, global `+`, Calendar overlay, Lists/Important Dates/Review implementation, External Calendar Sources, UI redesign, Native App, and Shared Space three-plus-member support remain deferred.

## v0.1.11 Navigation + Aggregation Experience Design Freeze — 2026-09-24

- The accepted read-only audit is `V011_SCOPE_READY`; the canonical [v0.1.11 specification](./v0.1.11_NAVIGATION_AGGREGATION_SPEC.md) freezes four bounded slices: Navigation Foundation, Aggregate Calendar, Home Aggregation, and Global Create Safety. Design remains frozen. Slice 1 is `CLOSED / PASS` after automated verification, final review, desktop authenticated acceptance, Production frontend rollout, and iPhone Safari / installed PWA acceptance. Slice 2 is `CLOSED / PASS` after local automated verification, user-run local authenticated acceptance, Production frontend rollout and bounded Production smoke; the rollout made no backend/schema/RPC changes. Overall v0.1.11 remains `IN PROGRESS`; Slices 3–4 have not started.
- `selectedSpaceId` remains the concrete current Space, while Calendar uses an independent all/one-Space filter derived against validated memberships. Home aggregates all visible Spaces. Every aggregate item returns to its canonical Event/Task and corresponding Space context; no duplicate persistence, aggregate editor or backend service is introduced.
- Slice 1 exposes no temporary selected-Space Home. Aggregate Realtime exists only for the active view and tears down on exit/filter/membership/account changes. Personal plus the existing Shared Space suffices for acceptance; no extra Production Shared Space is created just for testing.
- Slice 4 Home Event and Task creation use the two section-specific actions recorded below. Each requires a visible, membership-valid target plus a second target confirmation. There is no silent Shared fallback; Task targets require an authoritative `tasks enabled=true` state, and zero valid targets means creation is unavailable before opening the Sheet. The authenticated integration readiness gate remains mandatory before real-account acceptance.
- Slice 2 Calendar `all` deliberately offers no Event create action. A single-Space filter creates only in that explicitly filtered Space, shows `保存到：<Space>`, and checks membership at Sheet open and submit. Hub → 查看日历 sets the single-Space filter while leaving `selectedSpaceId` unchanged. Slice 2 retains its own creation behavior and does not add the Slice 4 Home shortcuts.
- Slice 4 最终入口调整（2026-09-25）：首页“近期日程”和“需要处理的任务”区块标题右侧各有轻量 `+`，分别直接进入日程、任务创建；首页标题不设创建按钮，也没有类型选择面板。日历、空间、我的不增加此入口。未来模块完成后才考虑其所在首页区块的快捷创建。首页创建仍显示可选目标、写明目标的主按钮和同一表单内的第二次确认；日历单空间日程、空间任务本地入口维持直接保存。

## v0.1.11 Slice 4 Production Acceptance + Final Closeout — 2026-09-25

- 用户报告 Production installed PWA acceptance `PASS`。验收时 Production URL 对应 Slice 4 前端提交 `f916dc0f0a1962facca44f4174241031b4f44bf2`。结合此前 Desktop authenticated acceptance `PASS`，Slice 4 和 v0.1.11 更新为 `CLOSED / PASS`。
- 专门的 iPhone Safari 最终验收为 `NOT RUN`，没有推断或记录为 PASS；本次以 installed PWA 真实使用验收完成 Slice 4 移动端验收，因此 Safari 单独未测不是 blocker。Slice 3 独立 Event/Task 区块错误/重试仍为 `NOT RUN / DIFFICULT TO SIMULATE SAFELY`，也不是 closeout blocker。
- Slice 4 保持首页两项分开的直达创建入口及安全 contract：Personal Space 默认、不使用 `selectedSpaceId` 隐式定 target、用户可换 Space、Task 只能写入 Tasks-enabled Space、disabled Personal Tasks 不 fallback、提交前复验 membership/module/member-derived state、轻量二次确认、stale-request 与重复提交保护；现有 Calendar 单 Space 日程及 Space 内任务创建继续走本地直达路径。
- Production 部署和 PWA 验收属于前端；没有 Production backend、schema、RPC 或业务代码变更。

## v0.1.12 Module Hub + Space Management Navigation — Frozen Direction — 2026-09-25

- The v0.1.12 product direction is frozen as a module-first navigation migration from `首页 / 日历 / 空间 / 我的` to the semantic target `首页 / 日历 / 功能中心 / 我的`. The exact Chinese tab label may be confirmed during the read-only repo / product / architecture design review. The third destination opens modules directly rather than asking the user to choose a Space first. At the time of this roadmap freeze, implementation had not started; Slices 1–4 have since closed.
- Migrate only currently implemented optional modules. Tasks is the only implemented optional module and the first module to expose in 功能中心. Lists, Important Dates, Review / Check-in, Memo, and Wishlist do not get implemented or shown as placeholders; this direction adds no generic module framework or plugin system.
- Keep module enablement and a module page's view filter as separate semantics. `space_modules` remains per-Space configuration; the Tasks filter lists only Spaces with Tasks enabled. Disabling a module hides it from that Space's module entry while retaining its data. Each module owns its own filter; Calendar's `calendarFilter` stays independent and continues to support all Spaces or one Space. Do not add a global app-wide Space filter.
- “我的” target responsibilities are personal profile, Space management, and general settings. Space management may provide the Space list, create/join actions, and a Space detail surface for members, invitations, Space settings, and enabled-module controls. Module controls may be a section within Space details; a separate nested module-management page is not required. Slice 2 later delivered this management structure and is accepted `CLOSED / PASS`; visual refinement is deferred to a future unified design pass and is not a functional blocker.
- Space remains the canonical ownership boundary. Events, Tasks, Lists, Important Dates, and Review each belong to one canonical Space; `ownership ≠ view`. This migration changes navigation, aggregation, and view, not canonical ownership, persistence, or the Space schema.
- Preserve the v0.1.11 Home shortcuts: “近期日程 +” directly opens Event creation and “需要处理的任务 +” directly opens Task creation. Future module Home sections and shortcuts are decided when each module is actually implemented.

## v0.1.12 Final Production/PWA Acceptance + Closeout — 2026-09-25

- The user reported final authenticated Production and installed-PWA acceptance `PASS`. Slice 4 and v0.1.12 are `CLOSED / PASS`, with Slices 1–3 already closed. The accepted navigation is 首页 / 日历 / 功能中心 / 我的; 功能中心 contains only 任务, while 我的 → 空间管理 owns Personal/Shared Space detail. Space remains the canonical ownership boundary.
- Visual refinement, unused `MemberSheet.tsx`, `space_modules` Realtime, and Calendar all-Space creation stay deferred. v0.1.13 Space Lifecycle & Membership Safety is the next planned version; no lifecycle design or implementation is part of this closeout.

## v0.1.13 Slice 2 — Filter and Lifecycle State Contract

Slice 2 state review clarification: lifecycle operations do not synchronously set Calendar or Task filters. The existing canonical eligibility reconciliation may return `all` or another established valid default after their selected Space becomes ineligible. A successful leave/delete clears the management selection and detail before attempting the list refresh; remove/transfer retain the still-valid current Space.

### Final closeout — 2026-09-25

- v0.1.13 and Slices 1/2 are `CLOSED / PASS`. Slice 1 backend Production rollout/postflight and Slice 2 frontend Production deployment passed; the user reported authenticated, mobile and installed-PWA acceptance `PASS`. Codex did not operate the authenticated sessions or PWA.
- Future direction only: consider `Personal Event → Share / Projection` into another Space while the Event remains one canonical object owned by its source Space. A target Space may gain visibility through a projection, not a second canonical Event; leaving the target Shared Space must not affect the source Event. This is outside v0.1.13 and does not reserve schema or authorize implementation.
- Next Action is next-version product planning, including reprioritizing Structured Review / Check-in, Shared Lists and other candidates. No next feature is selected or started by this closeout.

## v0.1.13 Slice 1 — CLOSED / PASS

The frozen backend design passed local verification and the Slice 1B Production rollout/postflight. At the Slice 1 closeout checkpoint, Slice 1 was `CLOSED / PASS` and Next Action was Slice 2 Space Detail lifecycle controls. The runtime invariant boundary covers `anon`, `authenticated`, and `service_role`; DB owner/postgres/migration administrators are outside it. These application roles must not bypass the owner/member/Event/Task lifecycle guards through legacy `TRUNCATE`, so Slice 1A revokes only that privilege on the six affected tables. Historical reminder ledger rows remain independent records. No general ACL framework, TRUNCATE trigger, or account-management capability is introduced; the only Production mutation was the reviewed Slice 1A forward patch. v0.1.13 overall is now `CLOSED / PASS`; see the final closeout above.

After v0.1.12 closeout, prioritize Space Lifecycle & Membership Safety before adding further Space-owned modules. Future candidate capabilities include leaving Shared Space, removing members, transferring ownership, and deleting Shared Space. Structured Review / Check-in and Shared Lists remain important candidates after lifecycle safety; do not assign versions beyond v0.1.13 yet.

At the original roadmap freeze, only these high-level safety principles were recorded; the later Slice 1A backend design and local implementation supersede that initial design status:

- Personal Space cannot be deleted or left.
- Owner exit must not create an ownerless Shared Space.
- Ownership transfer, member removal, leaving, and deletion require explicit permission and data-integrity design.
- Destructive multi-record operations should prefer atomic backend-owned behavior over fragile frontend mutation sequences.
- Shared Space deletion must be reviewed against all Space-owned canonical data; future modules must respect the eventual lifecycle contract.

## v0.1.14 回顾（Structured Check-in）Design Freeze — 2026-09-25

- v0.1.14 的产品语义于 2026-09-25 完成 docs-only 设计冻结；canonical 数据、权限、UI、slices 和验收契约见 [v0.1.14 规格](./v0.1.14_STRUCTURED_CHECKIN_SPEC.md)。此后 Slice 1 backend 完成 Production forward patch 与只读 postflight，Slice 2–4 前端、本地集成审查及 acceptance feedback fix 已实现并自动验证；Production 用户可见前端仍是 v0.1.13。
- 每轮回顾的 participant 在创建时以 `review_entries` 固定。读取和写入旧轮均要求当前 Space membership **及**该轮 participant 身份；leave/remove 保留历史 entry，但离开者失去访问权，新成员不能访问或补写旧轮，原 participant 重新加入后恢复旧轮访问。Personal 一人可创建；Shared 仅当前两名成员齐全时可创建，沿用现有两人上限。
- `round_no` 是每 Space 创建时固定的内部编号，创建 RPC 锁 Space 行后取 `max+1`，以唯一约束兜底；它不在历史、详情、无障碍名称或更正日期弹窗中向用户显示，不承担业务 chronology 或 previous-plan 关系。`review_date` 是业务时间轴，可由当前成员且该轮 participant 通过窄 RPC 更正，不改编号或参与者。
- 2026-09-26 第一轮真实账号验收后的 bounded 调整移除了用户可见序号、加入 RLS authoritative `共 N 篇回顾` 并统一「上一份计划」文案。第二轮反馈 supersede 了当时“同日多份允许、previous-plan 使用 `round_no-1`”的决定：现在数据库保证 `unique(space_id, review_date)`；同日新建/日期更正冲突明确拒绝；上一份计划严格取同 Space 中 `review_date` 小于当前日期的最近一篇。日期上的立即上一篇没有本人 entry 或 plan 为空时返回空态，不向更早日期 fallback。
- previous-plan 使用窄 `SECURITY DEFINER` 只读 RPC，因为 participant RLS 会隐藏未参加的真正上一篇，纯客户端查询可能错误跳到更早的可见回顾。RPC 先验证当前轮 membership + participant，再在后端确定真实上一篇，只返回调用者自己的 plan 或 `null`，不泄露隐藏 round 元数据或对方正文。
- 四个内容字段均可空；全空为未填写且不能标记。非空内容以服务端 content/filled revision 导出编辑中、已填写、有更新；相同内容重复保存不增加 revision。各人只能编辑、标记自己的 entry；无单次回顾删除。
- 沿用 `space_modules`：缺行/关闭时不进入正常回顾选择器、禁止写入、保留历史，重开恢复。只扩展 owner-only 模块开关，不加 Realtime、archive/read-only 旁路或通用框架。面向用户只称「回顾」。

## Future UX Consideration — Calendar Create Action

现有 Slice 2 冻结行为是：Calendar 选“全部空间”时没有日程创建 `+`，筛选单一 Space 时显示创建 `+`。未来可以重新评估这项行为；本次不改，也不重开 Slice 2。

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
