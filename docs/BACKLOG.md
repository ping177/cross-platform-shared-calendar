# Backlog

## 2026-10-15 Shared Space Event 协作权限 — BACKEND + USER A/B/PUSH PASS / FINAL PRODUCTION MOBILE PENDING

- 用户已确定全员可编辑、改同Space归属、确认删除；Personal私有，space_id/created_by不可变。普通/重复均已本地实施，整个logical series归属原子更正，内容scope保留；并非跨Space移动，不再将此前跨Space评估作为当前需求。
- 本地978/978、TS/Build/Deno与两路径数据库验证通过，详见DEVLOG/TESTING及 [rollout](./EVENT_COLLABORATION_ROLLOUT.md)。Production用户SQL及独立核验、Edge v5和原Cron恢复/两次自然健康调用已通过；实际本地5175目标对齐。用户核心A/B及真实Push A→B接收人已PASS；本轮前端Git/Vercel发布获授权，实际部署独立核验后仅待最终Production/Safari/PWA反馈，不能提前CLOSED；不新增版本。
- 当前回顾布局本地验收保留且未部署，原实现三文件指纹不变。筛选器A/B仍独立未决；本项通过Production验收后暂停常规开发、真实使用观察。

以下定向问题及只读评估为本轮前历史记录；当前批准范围以上方同Space协作规则为准。

## 2026-10-15 定向问题状态

- Production2204b30：用户确认Event/Task四项iPhone PWA验收PASS；新回顾创建局部布局/日期修复LOCAL PASS（968/968、TS/Build），等待用户视觉及后续真机验收，尚未发布，不提前整体CLOSED。
- 已有Event跨Space转移：READ-ONLY ASSESSED / NOT IMPLEMENTED。现有前端与数据库均固定归属；后续如授权，先明确普通/重复、共享转私有的授权和归属语义及提醒并发，再设计受控后端迁移/RPC，不能仅开放前端控件。不是创建功能回归，不自动进入开发。
- 筛选器统一A/B仍为独立未决事项；本轮不实施、不冻结。既有功能和Avatar保持，完成当前缺陷验收后暂停常规开发、真实使用观察。

以下为本轮接续前的历史检查点，旧Pending由上方用户报告更新。

## Final pre-trial corrective work — MAC ACCEPTED / IPHONE ACCEPTANCE PENDING

当前唯一发布范围：Event正文宽度/滚动边界、Event/Task日期WebKit外观/尺寸/左对齐，3项回归与治理；用户Mac本地视觉PASS，967/967及TS/Build通过，Git→Vercel发布已授权。iPhone Safari/PWA真实复验待完成，未CLOSED；上一版0fe85e8的FAIL为问题历史。Event已验收Space逻辑和五模块现有筛选器保持，筛选器统一A/B为独立未来决策，未实施或冻结。最终真机PASS后暂停常规开发、真实试用观察；用户报告数据清理完成，不重做。

## Prior observation plan — superseded by the final pre-trial UX exception

暂停常规功能开发，进入约两周真实使用观察（2026-10-14起，约至2026-10-28）；记录实际使用问题与未完整覆盖的边界，再决定是否需要后续修正。未来独立待办：整理测试数据，三个测试账号保留两个；保留账号选择与清理需另行确认，本轮不执行，也不是当前阻塞项。不创建新版本或启动新功能。

## Profile Card Compact + Avatar v1 / Space Rename — CLOSED / PASS

用户真实账号本地集成验收已通过：名称保存/取消；预设保存/刷新持久化；照片上传显示；同Space成员读取照片；切回预设后旧照片从Storage删除。12头像视觉已确认、猫F+02。用户已确认正式Production人工验收PASS，Avatar与Space Rename均CLOSED / PASS。未完整覆盖的跨设备、照片替换/默认恢复、真实失败/断网重试、退出最后共同Space后新签拒绝、5分钟续期与iOS/Android/PWA仍待记录；自动测试不替代人工证据。数据整理独立延期、不阻塞本次发布。

## v0.1.19 — Task Due-date Push Reminder — CLOSED / PASS

Four bounded tasks/review/automatic verification, Production exact SQL/postflight, ACTIVE v4/Cron compatibility and frontend publication/target alignment PASS. User local and final Production/installed-PWA acceptance PASS; user confirms real Task Push on 2026-10-07 evening, accepted as manual PASS. Aggregate read-only ledger/Cron corroboration and limitations are in TESTING. Contract: [v0.1.19 spec](./v0.1.19_TASK_REMINDERS_SPEC.md). Overall CLOSED / PASS; final docs REMOTE_SYNCED awaits separately authorized push verification.

Existing overflow throughput limitation remains recorded/outside scope; no second scheduler/framework or extra backend work. No need to repeat passed acceptance merely for docs closeout.

## v0.1.20 — Mobile Gesture Navigation — CLOSED / PASS

Two frozen scopes, focused review, full788/new35 Node and TypeScript/build PASS. Implementation pushed; Vercel Production/source SHA/formal assets/target verified. User confirms iPhone installed-PWA 13/13 manual PASS; multi-touch/cancellation and busy not separately manually checked, without a confirmed defect/blocker. Evidence and limits: TESTING; contract: [v0.1.20 specification](./v0.1.20_MOBILE_GESTURE_NAVIGATION_SPEC.md). Keep original navigation/buttons/state and deferred scope. Final closeout c316b60 was pushed and independently verified; its docs-only Production deployment succeeded. The later direction-freeze documents remain subject to separate push authorization.

## Next-stage work — Product Direction Freeze / 2026-10-09

User-confirmed goals and canonical contract: [Product Direction Freeze](./DECISIONS.md#product-direction-freeze--2026-10-09). Complete/refined/reliable/practical shared-life PWA for the user and geographically separated family; formal AI-assisted product development portfolio. Keep Space/multi-member/sharing/reminder architecture despite lower personal usage. Commercialization is exploratory, not a completion gate.

1. Establish Figma ↔ Codex MCP and design the full application until the user is explicitly satisfied. Representative-page workflow validation is allowed; final coverage includes Home/Calendar/Tasks/Review/Lists/Important Dates/My/Space Management and major Sheets/forms.
2. Codex stages implementation of confirmed designs, preserving business logic and acceptance records.
3. Complete Chinese/English UI and internationalization.
4. Check security/privacy/account/access experience before external trials.
5. Family use and proportionate external trials.
6. Product demos, design artifacts, project explanation and resume/LinkedIn portfolio materials.

Keep four tabs, Home quick-add, Space ownership, Realtime, Push and existing interactions. Raise behavior-changing proposals separately before implementation. This round records direction only; no workflow configuration or UI implementation.

### Candidates — not approved development

Google/Outlook/Apple calendar aggregation and selective sharing; data export/user-owned backup/sensitive-content encryption; native App/commercial subscription/mainland-China deployment. Review remains optional, not a presumed commercial selling point. No dates or architecture promised. Market Validation / Commercialization Study remains exploratory and does not displace the frozen sequence.

## Deferred — Space Color System

Status: **Deferred; design and implementation not started.** The current six-color local calendar palette is accepted provisionally for Slice 4; its colors are known to be less vivid than desired. Do not interpret that acceptance as approval of the palette as a final user-customizable color system.

Future goal, to be scoped and designed separately:

- Let users choose an identification color for each Space and persist it with stable Space identity.
- Keep the chosen color consistent across day, week, and month views; adding or deleting another Space must not change an existing assignment.
- Design a brighter, clearly distinguishable yet professional default palette.
- Preserve the frozen calendar presentation: small colored dot, dark title, gray secondary text, transparent background.
- Design the color picker, default palette, persistence model, and any required migration before implementing them.

No color picker, persistence, database migration, or user-defined Space color is authorized by this backlog item. Slice 4 provisional acceptance and mobile/PWA/Production boundaries are recorded in PROJECT_STATE / DEVLOG.

## P0 - Blocking Verification or Core Use

- Investigate any Magic Link, RLS, Realtime, or Production deployment regression that blocks the two-person calendar flow.

## Non-Blocking Validation Follow-up

- Complete two-session Email OTP recurrence Realtime and supported-browser DST-zone coverage; this is not a v0.1.8 product-line blocker.

## v0.1.18 — 重要日 — CLOSED / PASS

Canonical contract: [v0.1.18 重要日 Specification](./v0.1.18_IMPORTANT_DATES_SPEC.md). Slice 1 core object flow and Slice 2 Date-level Push are CLOSED / PASS, including their previously recorded backend/frontend/Production acceptance. Slice 3 Home / Calendar projection is CLOSED / PASS; T1/T2/T3/T4 CLOSED / PASS, with user FINAL_MANUAL_REGRESSION = PASS. Detailed verification and rollout evidence stays in TESTING/PROJECT_STATE.

- Slice 3 T1 query/pure derivation and T2 own-object handoff: CLOSED / PASS (foundation automated acceptance and remote sync preserved).
- Slice 3 T3 Home projection: CLOSED / PASS (local automated + user authenticated local acceptance). Event/Task/Important Date return without Loading flash; single rows open their own Sheet directly on Home. Important Date top3/order/Space/refill/toggle/CRUD/Reminder/close/view-all/basic mobile PASS.
- Slice 3 T4 Calendar Important Date projection: FUNCTIONAL MANUAL PASS / RETENTION UX PASS. Calendar Event P0a retention: USER MANUAL PASS. Task P0b: AUTOMATED PASS; normal behavior included in the user-passed final manual regression. Independent feature-specific Event presentation slot; fresh canonical action authority. No hidden Event, materialized occurrence or second authority; shared exact target reader/editor and generation guards remain; obsolete T2 navigation is removed.

### Slice 3 Current implemented modules — stage interaction cleanup / PASS

The READ-ONLY interaction audit identified P0a/P0b and unreachable T2 navigation. P0a has user manual PASS; P0b local automated PASS, with normal filter/complete/reopen included in user FINAL_MANUAL_REGRESSION = PASS (no separate manual failure-simulation blocker). Stage P1 cleanup is implemented and locally verified: delete only zero-production-entry navigation controller/wiring/full-module pending/returnTo branches, migrate active target authority tests, keep shared exact reader/editor/guards and direct Sheets. Full Important Dates retained refresh wording, Event/Task basic keyboard/focus and ordinary Event delete confirmation are covered. Recurring Event scope confirmation, Task/Important Date delete confirmations and save→close lifecycle are intentionally preserved. No generic modal/cache/query/store/backend/Realtime framework.

This is **current implemented modules stage cleanup**, not permanent product-wide audit completion. After future major features, another whole-product interaction audit remains allowed. User FINAL_MANUAL_REGRESSION = PASS closes the current stage cleanup and Slice 3. Next product work is to be separately scoped; no further speculative cleanup or refactor is selected.

No additional Slice 3 Production/PWA-specific acceptance was performed for this closeout. Local final acceptance and normal Git remote sync do not establish deployment or those extra test results. Important Date active-view Realtime remains deferred; no new Production write is authorized by this backlog item.

## Latest Completed Product Slice

### v0.1.17 — Space-aware List Create Default — CLOSED / PASS

Implementation/automated verification, local authenticated acceptance, and user-reported Production/PWA acceptance on the deployed Vercel build all passed. Local acceptance confirmed explicit form-target ownership; Production/PWA checks confirmed the Personal default in 全部空间 and the current Space default under Personal and Shared filters. Android-specific acceptance was not reported. The frozen create-default convention is recorded in [Decisions](./DECISIONS.md). Important Dates v0.1.18 is CLOSED / PASS; current acceptance is recorded above.

### v0.1.9 — Shared Tasks MVP

Status: `CLOSED / PASS`. Slice 1/2/3 均 CLOSED / PASS；Production backend applied/postflight verified、Vercel frontend deployed/accepted、Desktop A/B Production acceptance PASS、iPhone Production smoke PASS。At the v0.1.9 milestone it was the latest accepted user-facing Production capability; later Production state is recorded in subsequent milestones. 详细范围和历史切片见下方 Current Frozen Product Scope。

### v0.1.8 — Mobile Push Reminder

Status: `v0.1.8 — Mobile Push Reminder` is `CLOSED / PASS`. Slice 1, ordinary Reminder Slice A/B/C, Slice 3 Recurrence Reminder Integration, and final cross-platform acceptance are complete. Mac/iPhone Production acceptance passed; Android Studio Emulator subscription, test Push, ordinary automatic Reminder, sound, and notification-shade delivery passed. Physical Android heads-up presentation was not validated and is non-blocking. v0.1.9 is the later accepted Production capability.

In scope:

- One event-level optional reminder stored as nullable `events.reminder_kind`; the earlier `events.reminder_offset_minutes` proposal is superseded.
- Fixed kinds: `timed_at_start`, `timed_10m_before`, `timed_30m_before`, `timed_1h_before`, `timed_previous_day_same_time`, `all_day_same_day_08`, and `all_day_previous_day_20`; `null` means no reminder.
- Nullable canonical IANA `events.time_zone`, automatically detected for new events from the creating browser/PWA and never silently changed merely because a device later changes timezone.
- UI-only new-event defaults: timed `timed_10m_before`; all-day `all_day_same_day_08`. Database default and every historical Event remain `null`; historical ordinary timezone is not guessed or bulk-backfilled.
- Timed previous-day reminders preserve Event-local wall-clock time through the canonical recurrence DST semantics. All-day reminders use effective Event date plus canonical timezone; multi-day reminders anchor only to the start.
- Standards-based Web Push system notifications for Desktop and installed iPhone/Android PWAs.
- `push_subscriptions` bound to `user + installation`, with multiple simultaneous device/browser subscriptions and no Space binding.
- `reminder_deliveries` with due-time-aware idempotency and delivery lifecycle state.
- shared event recipients resolved from current active Space membership at send time; personal event recipients limited to `owner_user_id`.
- Reminder UI copy states that a shared Event reminder notifies current Space members.
- Supabase Cron every minute, an Edge Function sender, and dynamic ordinary/recurring occurrence projection through the canonical recurrence semantics.
- Push-only Service Worker with no offline cache.
- Best-effort delivery with approximately one-minute normal target precision and a simple configurable late-delivery grace window of roughly ten minutes.

Explicitly out of scope:

- Email reminder delivery, SMS, and Bark.
- Multiple reminders or arbitrary custom-minute offsets.
- Per-user reminder preferences for the same shared event.
- Snooze, sound customization, and notification inbox/history.
- Native AlarmKit, AlarmManager, or other native alarm behavior.
- Queue, message broker, Redis, worker cluster, or another complex scheduler.
- Multi-space implementation.
- Shared Tasks, Shared Lists, Important Dates / Anniversaries, Tags / Color = Who, and UI/UX overhaul.
- Delete Logical Series UI.

Implementation slices:

1. **Push Infrastructure Foundation — CLOSED / PASS:** Push-only Service Worker, explicit permission flow, `user + installation` subscription persistence, multi-device lifecycle, logout/invalid-subscription handling, and an authenticated current-installation test-push path are implemented. Desktop Chrome/macOS and iPhone installed PWA validation passed. Android Studio Emulator permission/subscription and test Push passed; physical-device heads-up presentation was not validated. The initial Desktop subscription was abnormal/stale despite FCM `201`; unsubscribe/resubscribe restored delivery. This slice does not implement scheduler, event reminder persistence, or recurrence delivery.
2. **Reminder Persistence + Ordinary Event Delivery — CLOSED / PASS:** Slice A/B/C, Production foundation, manual E2E, and automatic once-per-minute scheduler E2E are complete.
3. **Recurrence Integration — CLOSED / PASS:** canonical bounded occurrence projection, override/delete/split/current-and-future semantics, Reminder/timezone inheritance, all-day/timezone/DST coverage, stale projection rejection, and recurrence-aware no-duplicate identity are deployed and accepted in Production. The bounded long-duration correction preserved the canonical recurrence engine. Normal recurring delivery, only-this override and delete, this-and-future split, scheduler health, and ordinary Reminder regression all passed without duplicate or stuck claims.
4. **Final Cross-Platform / Android Acceptance — CLOSED / PASS:** Mac and iPhone Production Push / automatic Reminder passed. Android Studio Emulator subscription, `send-test-push`, ordinary automatic Reminder, sound, and notification-shade delivery passed. Heads-up presentation was not observed or validated on physical Android hardware; this is non-blocking. The supplied evidence does not independently establish notification-click PASS, so none is claimed.

Idempotency freeze:

- Recurring: `(logical_series_id, occurrence_date, subscription_id, due_at)`.
- One-off: `(event_id, NULL occurrence_date, subscription_id, due_at)`; `NULLS NOT DISTINCT` preserves the former ordinary identity behavior.
- `due_at` is derived from effective start/date, `reminder_kind`, and canonical Event timezone. A changed effective start/date or preset may create a new legitimate delivery; unchanged `due_at` must not duplicate, including across a future split.

Future compatibility:

- Push Subscription persistence intentionally does not contain `space_id`. A future user may reuse one device subscription across Family, Travel, Friends, or other Spaces; deliveries continue to resolve recipients from `event.space_id` and current membership at send time.
- v0.1.8 does not implement multi-space.

## Current Frozen Product Scope

### v0.1.9 — Shared Tasks MVP

Status: `CLOSED / PASS; SLICE 1/2/3 CLOSED / PASS`. Production backend applied/verified, Vercel frontend deployed/accepted, Desktop A/B Production acceptance PASS, and iPhone Production smoke PASS. At that milestone, v0.1.9 was the latest accepted user-facing Production capability. Canonical Task scope: [v0.1.9 Shared Tasks Spec](./v0.1.9_SHARED_TASKS_SPEC.md); long-term model: [Shared Life Architecture Freeze](./SHARED_LIFE_ARCHITECTURE.md).

In scope:

- One Space-scoped `tasks` product table with creator attribution, same-Space member/shared assignment, title, `open` / `completed`, optional date-only `due_on`, and timestamps.
- Collaborative household permissions: all current Space members can view, edit title/due date, reassign, and delete Tasks. Shared Tasks may be completed/reopened by any current member; assigned Tasks only by the current assignee, enforced by a corrective DB trigger against the old assignment. A takeover requires reassignment and status change in separate UPDATEs.
- Assigned-member departure converts the assignment to shared through the locally verified composite FK with column-specific `ON DELETE SET NULL (assigned_to_user_id)`.
- Existing Supabase/PostgREST CRUD and Space-filtered Realtime patterns.
- A minimum current-Space / Space Hub entry to Tasks, open Tasks and separate Completed history, create/edit/delete confirmation, complete/reopen, assignment, and optional due date. The former top-level `Calendar / Tasks` switch is superseded.
- Decision `MULTISPACE_NOT_REQUIRED_FOR_V019`; explicit `space_id` preserves future compatibility without implementing Multi-space.

Implementation slices:

1. **Task persistence and authorization — PRODUCTION APPLIED / POSTFLIGHT VERIFIED:** schema/incremental patch, constraints, assignment/member-leave semantics, immutable identity, RLS/grants, Realtime/replica identity, and focused database tests. Backend foundation is now present in Production.
2. **Current-Space Tasks CRUD, UI, and Realtime — IMPLEMENTED / MANUAL AUTH ACCEPTANCE PASS:** frontend Task model, bounded Space Hub, CRUD, assignee-owned completion/reopen, assignment, due date, deterministic grouping/order, and user-run two-session validation. The status-ownership corrective backend patch is applied/postflight verified in Production. Calendar header Space-entry discoverability and 320px navigation passed. No Personal Space, Multi-space, module enablement, full navigation, aggregation, or global create.
3. **Production acceptance and closeout — CLOSED / PASS:** the compatible frontend was deployed through Vercel; user-run Desktop A/B and iPhone Production acceptance passed.

Explicitly deferred:

- Task Reminder, recurring Tasks, subtasks, priority, tags, comments, attachments, analytics, custom ordering, Shared Lists semantics, Event generation, Multi-space implementation, and UI/UX overhaul.
- Task Archive and an `archive` status; Completed Tasks remain in a separate history section with reopen and delete.
- `completed_at`, `completed_by`, completion history, description, Task scope, and Task/Event dual persistence.

## v0.1.10 Foundation — CLOSED / PASS

Status: Slice 1 `PRODUCTION BACKEND ROLLOUT PASS`; Slice 2 `CLOSED / PASS`; Slice 3 `CLOSED / PASS`; v0.1.10 `CLOSED / PASS`. User-run authenticated Production acceptance passed for Personal / Shared module toggles, data retention, member refresh behavior, cross-Space isolation, and iPhone/PWA. Canonical scope is in [Shared Life Architecture Freeze](./SHARED_LIFE_ARCHITECTURE.md).

1. **Slice 1 — Data / permission foundation — PRODUCTION BACKEND ROLLOUT PASS:** `spaces.kind`, partial personal-owner uniqueness, sole-owner membership invariant, removal of user-wide membership uniqueness, Shared create/join compatibility and two-member capacity, `space_modules`, owner-only toggle RPC, and database Task mutation guard. Local regression, Production preflight, single patch application, immediate data/catalog/permission postflight, and PostgREST visibility passed. Personal Space count was 0 at postflight; no automatic creation or bulk backfill occurred while the old frontend remains the accepted UI.
2. **Slice 2 — Selected/current Space vertical flow — CLOSED / PASS:** deployed frontend rollout and user-run A/B authenticated Production acceptance passed. The compatible frontend calls idempotent `ensure_personal_space()` per user, lists/switches member Spaces, keeps an explicit membership-validated `selectedSpaceId`, and scopes Event/Task/member data plus Realtime to it. Existing Shared Space remains the first-upgrade default; Personal Space is the fallback when no Shared Space exists. Old requests/subscriptions are guarded during switching. Sheet-open Space switching was N/A because the modal prevents operating the selector; Shared ↔ Shared was N/A because no current acceptance account has two Shared Spaces. Neither is a failure; no extra Space was created.
3. **Slice 3 — Tasks module enablement + UI text closeout — CLOSED / PASS:** user-run authenticated Production acceptance passed. Owners can disable/re-enable Tasks per Space; disabled history is preserved and restored. Members have read-only module state. User-visible `Task / Tasks` wording is Chinese “任务”; internal identifiers remain unchanged. iPhone/PWA acceptance passed.

Known characteristic / future consideration: `space_modules` has no Realtime publication. Already-open Shared member pages may show the previous module state until refresh/re-entry; database policy immediately rejects disabled Task writes. Consider module-state Realtime / immediate cross-client UI refresh only if real usage shows a need. This is not a blocker and does not reopen v0.1.10.

No Event/Task identity, v0.1.9 Task authorization, v0.1.8 Reminder, recurrence, or Production capability was redesigned in v0.1.10. The final four-destination navigation and cross-Space aggregation later shipped in v0.1.11; Home creation uses section-specific actions rather than a global title `+`. Shared Space three-plus-member support, Calendar multi-Space overlay, Lists / Important Dates / Review implementation, External Calendar Sources, UI redesign, and Native App remain later candidates whose priority and order may change with real product use.

## v0.1.11 Navigation + Aggregation Experience — CLOSED / PASS

Slice 1 Navigation Foundation is `CLOSED / PASS` after automated verification, final review, desktop authenticated acceptance, confirmed Production frontend rollout, and post-deploy iPhone Safari / installed PWA acceptance. The Production frontend shows `日历 / 空间 / 我的`. Slice 2 Aggregate Calendar is `CLOSED / PASS` after local implementation, automated verification, authenticated acceptance and user-run bounded Production smoke. Dedicated Slice 2 iPhone Safari, installed PWA and final 320px checks are `DEFERRED / NOT RUN`; second Shared Space coverage is `N/A / NOT RUN`. Slice 3 Home Aggregation is `CLOSED / PASS` after local implementation, automated verification, Vercel Production deployment, and user-run desktop, iPhone Safari and installed PWA acceptance. Slice 4 Home Quick Create / Global Create Safety is `CLOSED / PASS`; Production includes the Slice 4 frontend from feature commit `f916dc0f0a1962facca44f4174241031b4f44bf2`. User-reported Desktop and Production installed PWA acceptance passed. Dedicated final iPhone Safari acceptance is `NOT RUN`, not a blocker. Independent Slice 3 Event/Task section error/retry simulation remains `NOT RUN / DIFFICULT TO SIMULATE SAFELY`; second Shared Space coverage is `N/A / NOT RUN`. Overall v0.1.11 is `CLOSED / PASS`. The canonical scope and acceptance criteria are in [v0.1.11 Navigation + Aggregation Experience Specification](./v0.1.11_NAVIGATION_AGGREGATION_SPEC.md).

1. **Slice 1 — Navigation Foundation — CLOSED / PASS:** final shell, Space/Hub and My integration; no Event/Task aggregation, global create or user-visible Home until its final aggregate semantics exist.
2. **Slice 2 — Aggregate Calendar — CLOSED / PASS:** membership-visible Events, all/one-Space filter, Space/member attribution, recurrence/exceptions, complete reads, stale guards and bounded active-view Realtime. User-run bounded Production smoke passed for the deployed frontend, all/single create behavior, date navigation, Hub → Calendar filtering, rapid filter switching and A/B Realtime. No backend rollout was required. Dedicated device checks 11–13 are `DEFERRED / NOT RUN`; second Shared Space is `N/A / NOT RUN`.
3. **Slice 3 — Home Aggregation — CLOSED / PASS:** all-Space three-day Event and eligible Task summaries, authoritative Tasks-module filtering, canonical Sheets, bounded active-view Realtime and independent section errors. User-run desktop, Vercel Production, iPhone Safari and installed PWA acceptance passed, including Home/Event/Task flows, A/B Realtime, module disable/re-enable, narrow viewport and Space → Tasks regression retest. Independent Event/Task section error/retry simulation is `NOT RUN / DIFFICULT TO SIMULATE SAFELY`; second Shared Space is `N/A / NOT RUN`. No dashboard framework or global create.
4. **Slice 4 — Home Quick Create / Global Create Safety — CLOSED / PASS:** 首页“近期日程 +”直接新建日程，“需要处理的任务 +”直接新建任务。用户报告真实账号 Desktop 和 Production installed PWA 验收通过；确认 Personal 默认目标、主动选择 Shared、二次确认目标与实际归属、首页即时刷新、模块关闭安全、取消保留草稿且无写入、关闭重开清除确认状态、防重复提交、布局和导航回归，以及 Calendar/Space 原有本地创建路径。目标选择、安全 contract、保存前 membership/module/member-derived state 重读、stale request 与 duplicate-submit protection 均保留。Dedicated final iPhone Safari acceptance is `NOT RUN`; installed PWA acceptance is `PASS`, so Safari 单独验收不是 Slice 4 blocker。

Deferred beyond v0.1.11: due Task Calendar projection, multi-select/saved Calendar filters, Shared 3+ members, Lists/Wishlist UI, Important Dates, Review, Memo, external sources/中国节假日, module-state Realtime, generalized device/settings UI, Native App and major redesign.

## v0.1.12 — Module Hub + Space Management Navigation — CLOSED / PASS

The accepted product migrated `首页 / 日历 / 空间 / 我的` to `首页 / 日历 / 功能中心 / 我的`. Slice 1 Aggregate Tasks Foundation, Slice 2 My → Space Management → Space Detail, Slice 3 One-time Navigation Switch + Aggregate Tasks UI, and Slice 4 Final Regression + Production/PWA Acceptance are `CLOSED / PASS`. The user reported final authenticated Production and installed-PWA acceptance `PASS`. Slice 2 visual refinement is deferred to a later unified UI/design pass and is not a blocker.

- The third destination opens implemented modules directly. Tasks is currently the only implemented optional module and the only module to migrate in v0.1.12. Do not show placeholders for Lists, Important Dates, Review / Check-in, Memo, or Wishlist. Do not create a generic module framework or plugin system.
- Keep module enablement and the module's current Space view filter independent. `space_modules` remains per-Space configuration; the Tasks filter lists only Spaces where Tasks is enabled. Disabling a module does not delete its data. Each future module owns its own filter; Calendar's existing `calendarFilter` remains independent, with all-Space and single-Space modes. Do not add an app-wide Space filter.
- “我的” is directed toward personal profile, Space management, and general settings. Space management may include Space list/create/join/detail; Space details may show members, invitations, settings, and module switches. Module controls can be a section of Space details; another nested page is not required.
- Space remains the canonical ownership boundary (`ownership ≠ view`). This navigation/view change does not change persistence or Space schema. Preserve the v0.1.11 Home Event and Task quick-create actions as they are.
- Scope references: [v0.1.12 frozen direction](./DECISIONS.md) and [Shared Life Architecture](./SHARED_LIFE_ARCHITECTURE.md).

## v0.1.13 — Space Lifecycle & Membership Safety — CLOSED / PASS

Slice 1 backend 与 Slice 2 frontend 均 `CLOSED / PASS`。Slice 1A backend 与窄 ACL recovery 本地验证、Slice 1B Production patch/postflight、Slice 2 Production deployment，以及用户报告的真实账号、移动端和 installed-PWA acceptance 均已通过。最终 focused Node 46/46、full Node 276/276、build、diff-check 均通过。

This version covers Shared Space leave, member removal, ownership transfer, and hard delete before more Space-owned product modules. At its closeout, next-version product planning remained open; v0.1.14「回顾」has since received its own design freeze below.

The original roadmap carried these high-level safety principles; the Slice 1A backend design is now frozen and locally implemented:

- Personal Space cannot be deleted or left.
- Owner exit must not create an ownerless Shared Space.
- Ownership transfer, member removal, leaving, and deletion require explicit permission and data-integrity design.
- Destructive multi-record operations should use atomic backend-owned behavior rather than fragile frontend mutation sequences.
- Review Shared Space deletion against all Space-owned canonical data; future modules must honor the eventual lifecycle contract.

## v0.1.14 — 回顾（Structured Check-in）— CLOSED / PASS

Canonical contract: [v0.1.14 回顾规格](./v0.1.14_STRUCTURED_CHECKIN_SPEC.md)。Backend foundation 与 date chronology forward fix 均已在 Production 应用并通过 postflight；`review_date` 是业务时间轴，数据库保证同 Space 同日唯一，上一份计划严格按日期上一篇且不 fallback，`round_no` 仅保留内部技术语义。

Slice 1–4、integration、两轮 acceptance fixes、frontend pre-deploy gate、main push、Vercel Production deployment 与公开 smoke 均通过。用户报告最终 Production authenticated acceptance `PASS`，覆盖 Personal / Shared、双账号读写边界、entry 状态、历史/新建、previous-plan、日期更正与 chronology、同日拒绝、count、响应式和 dirty navigation。最终 3 个 Personal 测试 rounds / 3 entries 经 exact-ID transaction 清理，postflight 0/0，两条 Review module enabled，核心 fingerprints 无变化。刷新回首页问题已由 v0.1.14.1 解决；既有 >500 kB bundle warning 保留为 non-blocking follow-up；v0.1.14 正式关闭。

## v0.1.14.1 — Navigation Persistence — CLOSED / PASS

同一 browser/tab session 刷新恢复当前用户的有效页面位置；仅持久化页面与稳定 ID，保留既有 Auth、membership、module、Review participant 检查及独立筛选。实现、integration review、本地 authenticated acceptance、Production deployment/public smoke、用户 Production authenticated refresh acceptance 均 `PASS`。Production 无 Review 数据，Review Detail 数据场景未在本轮线上重测；自动 integration 与本地验收仍覆盖该路径。刷新回首页已解决；既有 >500 kB bundle warning 非阻塞。不包含 router、browser history、可分享深链、PWA cold-start 永久记忆或草稿持久化。当前 v0.1.15 Slices 1–2 均 `CLOSED / PASS`。

## v0.1.15 — Shared Lists — CLOSED / PASS

Canonical contract: [v0.1.15 Shared Lists Specification](./v0.1.15_SHARED_LISTS_SPEC.md). The read-only repository investigation was reviewed and accepted as the basis for this docs-only Design Freeze. Personal and Shared Space support, the three-table model, derived List completion, deterministic ordering, atomic Section/List deletion semantics, quick-add, module eligibility, Realtime, mobile item drag, concurrency boundaries, non-goals, tests, and implementation slices are frozen there.

Slices 1–4 and v0.1.15 are `CLOSED / PASS`. Final user acceptance covers desktop authenticated flows, dual-account Realtime, mobile/PWA Item drag and long-list auto-scroll. Full Node 356/356 and build passed. Stale reorder is `AUTOMATED PASS / MANUAL NOT REQUIRED`; Section drag is `DEFERRED / NON-BLOCKING`, and the existing bundle warning is non-blocking. No current blocker is recorded.

v0.1.16 and v0.1.17 are closed below. v0.1.18 重要日 is CLOSED / PASS: Slices 1–3 and Slice 3 T1–T4 closed; T4 functional/retention, P0a manual, P0b automated/final normal regression and current-modules stage cleanup PASS; user FINAL_MANUAL_REGRESSION = PASS.

## v0.1.16 — Module Entry Responsiveness / Data Flow Simplification — CLOSED / PASS

First authenticated Tasks re-entry acceptance FAILED: navigating to the Hub unmounted the view and discarded validated rows. The read-only RCA led to `V016_REENTRY_RETENTION_DESIGN_FROZEN` and bounded same-session display snapshots for Tasks, Review, and Lists. Implementation/automated verification, second local authenticated acceptance, and user-reported Production installed-PWA acceptance PASSED for all three; the repeated full-loading re-entry problem did not recur. Android-specific acceptance was not reported. Valid entry hints remove repeated Space/module discovery; module-specific canonical reads, invalidation, completeness, RLS, and view-owned Realtime rereads remain. First-entry latency was intentionally not redesigned and is non-blocking unless real use shows material impact. No generic data framework, backend change, or dependency was added.

## Directional Roadmap — Shared Life Architecture Frozen

The long-term relationships and v0.1.10 scope are frozen in [Shared Life Architecture Freeze](./SHARED_LIFE_ARCHITECTURE.md). Later version rows remain directional and require their own scope review.

- v0.1.9 — Shared Tasks; Slice 1/2/3 CLOSED / PASS; Production backend and frontend accepted.
- v0.1.10 — Personal Space + Multi-space + Module Enablement Foundation; Slice 1 `PRODUCTION BACKEND ROLLOUT PASS`, Slice 2/3 and overall `CLOSED / PASS`.
- v0.1.11 — Navigation + Aggregation Experience (`CLOSED / PASS / SLICE 1 CLOSED / PASS / SLICE 2 CLOSED / PASS / SLICE 3 CLOSED / PASS / SLICE 4 CLOSED / PASS`; Desktop and Production installed PWA acceptance `PASS`; dedicated final iPhone Safari acceptance `NOT RUN`).
- v0.1.12 — Module Hub + Space Management Navigation (CLOSED / PASS; Slices 1–4 CLOSED / PASS; Production and installed-PWA acceptance PASS).
- v0.1.13 — Space Lifecycle & Membership Safety (CLOSED / PASS; Slice 1/2 CLOSED / PASS; Production deployment and user-reported authenticated/mobile/PWA acceptance PASS).
- v0.1.14 — 回顾 (CLOSED / PASS; backend/date chronology, frontend deployment, public smoke, Production authenticated acceptance and final exact-ID cleanup PASS; Review 0/0 with two enabled module rows).
- v0.1.14.1 — Navigation Persistence (CLOSED / PASS; local and Production authenticated refresh acceptance PASS; no Review fixture created).
- v0.1.15 — Shared Lists (CLOSED / PASS; Slices 1–4 CLOSED / PASS; desktop, dual-account Realtime and mobile/PWA PASS; Section drag DEFERRED / NON-BLOCKING).
- v0.1.16 — Module Entry Responsiveness / Data Flow Simplification (CLOSED / PASS; automated, local authenticated desktop, and Production installed-PWA acceptance PASS; Android-specific acceptance not reported).
- v0.1.17 — Space-aware List create default (CLOSED / PASS; implementation/automated, local authenticated, and Production/PWA acceptance PASS; Android-specific acceptance not reported).
- v0.1.18 — 重要日 (CLOSED / PASS; Slices 1–3 and Slice 3 T1–T4 CLOSED / PASS; T4 functional + retention UX PASS; P0a manual PASS; P0b automated PASS and final normal regression PASS; current-modules stage cleanup PASS; FINAL_MANUAL_REGRESSION = PASS; no extra Production/PWA-specific PASS inferred).
- Later candidates without fixed versions/order: Calendar Sources v1, Memo, Photos / Memories, richer external Calendars, Task Archive, and other validated modules. These remain unselected and their priority may change based on real product use.
- Future direction only: consider projecting/sharing a Personal Event into another Space while keeping one canonical Event owner Space, avoiding duplicate canonical objects, and ensuring that leaving the target Shared Space does not affect the source Event. This is outside v0.1.13; do not implement or reserve schema for it in this version.
- Native: decision gate only; no committed implementation version.

## P1 - Near-Term Product Polish

- Continue event create/edit UX polish after the v0.1.3 default end-time improvement.
- Establish a simple backup and restore flow for Supabase data.
- Occasionally check that Vercel Cron invocations continue to return HTTP 200 and that Supabase remains Active.

## P2 - Product Extensions

- Deferred: do not add a `delete_logical_series` frontend entry point. The permission-checked backend RPC remains available for controlled operational use, but deleting an entire logical lineage is high-impact and needs a separately approved product/UX scope, including explicit copy and safeguards.
- Space member management and invitation experience improvements.
- Multi-space v0.1.10 scope is frozen above; do not bind Push Subscriptions to a Space.
- Reconsider `space_members.nickname` only after multi-space support creates a real per-space naming need.
- Countdown/count-up/anniversary displays are covered by the unified v0.1.18 Important Date contract; do not create separate countdown objects.

### Task due-date Push Reminder — selected for v0.1.19

The historical future direction is now the approved v0.1.19 contract above. Shared without assignee recipients are current Space members; historical null remains off. Local implementation is complete, but no deployment or Push acceptance is claimed. Use the spec and TESTING for current scope/status.

### 每轮自选参与成员的多人回顾 — Deferred / Design Pending

2026-10-11，只读仓库架构审计。**用户确认的未来方向只有：每次回顾自行选择参与的 Space 成员，不默认全员参与。** 未选实施版本、未批准数据迁移或权限变更；以下方案是可行性建议，非冻结决定。本轮未连接 Production 数据库、未修改 schema/migration/RPC/RLS，也未实施多人回顾。

#### 现状与限制（仓库静态事实）

| 审计项 | 当前实现及影响 |
| --- | --- |
| Round 结构/顺序 | `review_rounds` 保存 id、space_id、不可变 round_no、review_date、created_by、created_at；Space 内 round_no 和 review_date 分别唯一。展示按真实日期倒序，轮次身份不随日期修改而重排。没有全轮提交状态或独立参与者数组。 |
| Entry 与参与者 | `review_entries` 主键 `(review_id,user_id)`，四字段 focus/progress/problems/next_plan、content_revision/filled_revision/updated_at；每行同时代表该轮参与者快照。表没有固定两行的数量约束；user_id 不外键关联会级联删除的 membership，身份由创建 RPC 从当时成员集合生成且禁止改写。 |
| 固定人数创建 | `create_review_round(space_id,date)` 不接受选人参数；Personal 必须1名、Shared 必须2名，事务内为全部当时成员建立空 Entry。Space/module/actor 校验、Space 锁、日期去重和 max(round_no)+1 都在服务端。 |
| Space 的先决限制 | `join_space_by_invite_code`、`lock_space_membership_change` 和 deferred `check_shared_space_final_state` 均限制共享 Space 最多2人。不能仅改 Review 创建资格就实现3人以上。SpaceManagementPage 还用单个 otherMember 处理成员展示/操作；多人 Space 的邀请、移除、转让与其他业务回归必须作为独立前置范围。 |
| 前端固定两人 | review-history 的 canCreateReview、mapReviewHistory，review-detail 的 mapReviewDetail 精确要求 Personal1/Shared2；数据形状是 mine/other 或 own/other，详情两面板，Shared“两位成员”创建提示。收到3行会报不完整/不可用，不能直接放宽后端给旧前端使用。 |
| 阅读/可见性 | `can_read_review_round` 要求当前仍为该 Space 成员且有自己的 Entry；Round/Entry SELECT RLS 共用此检查。合格参与者可读整轮所有 Entry，包括他人已保存但未标记的草稿；未保存本地输入不在数据库。未参与者即使是 Space owner 也没有该轮读取资格。此处陈述现行规则，不替未来作隐私决定。 |
| 草稿/已填写/进度 | 保存仅真实字段变化时增加 content_revision，不自动标记；独立 mark RPC 要求非空，filled_revision 标记当前 revision，重复调用幂等。未填写/编辑中/已填写/有更新由内容及 revision 派生；没有持久化整轮完成状态或百分比。未来可从参与快照派生统计，但离开成员分母及“有更新”是否算完成待定。 |
| 写入及日期更正 | 表直接写入被撤销；save/mark 使用 auth.uid() 且只改本人。correct_review_date 同样共用 can_read_review_round；未来如扩展非参与者阅读，必须独立审查读、本人写及日期管理资格，避免放宽阅读连带授予日期更正。 |
| 加入/退出/历史 | leave/remove 删除 membership，不删除 Entry；退出者立即失去现行读写资格，仍在 Space 的原参与者可读其历史内容。新成员无旧轮 Entry，不能读取旧轮；同一 user_id 重新加入按现行检查可恢复原轮访问。删除 Space 会级联删除 Round/Entry。账号注销生命周期未由本次静态审计验证，user_id 无账号外键及 created_by 的账号外键需未来另行核对。 |
| 姓名/历史身份 | current space-members 读取当前成员及 profiles；profiles SELECT 仅本人或当前同 Space 身份，不能假定已退出者姓名可从现有接口读到。历史 UI 要有合法的参与者身份投影/安全回退；不能为了显示姓名自动扩大 profiles 可见性。 |
| 上一轮计划 | get_my_previous_review_plan 按真实日期先找 Space 紧邻上一轮，再取本人 next_plan；若本人没参加那一轮返回 null，不跳到更早“本人参加过”的轮次。不同轮选人后这将更常发生，保留原语义或改为上一轮本人参与需要确认；本轮不改。 |
| 列表/概览/数据完整性 | 历史 exact count、最新回顾概览受现行 RLS 限制，是本人可见轮次，不代表全 Space。未来非参与者读取会影响历史计数/概览/深链恢复；人数扩展还需检查每页20轮的 Entry 批量读取完整性及服务端行数上限，避免少读后把错误人数当完成比例。 |

依据：[Review foundation patch](../supabase/patches/2026-09-26-v0.1.14-review-foundation.sql)、[date chronology patch](../supabase/patches/2026-09-26-v0.1.14-review-date-chronology.sql)、[schema](../supabase/schema.sql) 中 Review 2057–2345、join_space 786–847、membership guards 1815–1864、leave/remove 1924–1967、profiles SELECT 1277–1284；[review-history](../src/lib/review-history.ts)、[review-detail](../src/lib/review-detail.ts)、[review-entry](../src/lib/review-entry.ts)、相应 `*-data.ts`、ReviewHistoryPage/ReviewDetailPage/ReviewEntryEditor/ReviewReadOnlyEntry、SpaceManagementPage/space-members/module-overview，以及既有 [回顾规格](./v0.1.14_STRUCTURED_CHECKIN_SPEC.md) 与 DECISIONS。SQL 文件代表仓库合同，本次没有核实线上实存结构。

#### 最小未来调整建议（未批准实施）

1. 先确认下列产品问题，并单独安排多人 Space 容量/生命周期扩展。Review 人数扩展不能绕过现行 Space 安全约束，也不能无范围地修改其他模块。
2. 若参与名单只在创建时确定且之后不变，可复用 Entry 行作名单快照，**不必先新增业务字段、第三张参与表或改四字段结构**。新增显式选择成员的创建 API：校验 actor、Space/module、非空/去重/人数界限、所有所选成员当前属同一 Space；在与成员变更一致的事务锁下原子创建 Round 和所选空 Entry。创建者是否必须被选待定。若需要创建后增删/替换/退出本轮，则另行设计参与关系生命周期、历史审计及权限，不能通过删除已填写 Entry 实现。
3. 把历史/详情的数据形状改为真实参与者数组，保留本人编辑和其他参与者只读、四字段、revision 状态、请求失效/刷新/返回与原导航；根据确认的权限再决定 own 是否可缺省。复用现有阅读/填写组件与视觉 tokens，调整名单、状态/进度布局及有界完整读取。无需引入新的填写业务状态、AI 字段或全轮提交工作流。
4. 旧 Personal1/Shared2 历史保留原 id/round_no/date、参与 user_id、四字段及 revision，不依据当前成员回填。若未来新增参与表，只能由每轮现存 Entry 生成原快照，不把新加入成员补进历史。
5. 保留/版本化旧双参数创建 API，避免旧调用在多人 Space 中静默创建全员回顾。仅增加新 RPC 不保证旧前端兼容：旧前端会拒绝多人历史。独立设计 backend/frontend 兼容 gate、功能启用边界及发布顺序；在用户另行授权前不迁移或部署。
6. 最小合理独立版本可限定为“创建时选名单 + 不变快照 + 本人四字段填写 + 实际参与者阅读/派生状态 + 旧历史兼容”；这只是建议，人数与读取规则须先确认。创建后改名单、退出本轮机制、新通知/提醒、全轮提交等不默认纳入。验收应覆盖3人以上不同轮名单、成员变更与创建并发、跨 Space 注入、直接 RPC/RLS、草稿可见性、重复保存/mark、日期与轮次、分页完整性、旧客户端和真实多账号设备；上线前需独立环境对齐。

#### 未冻结的产品决定与风险

- 非参与者可否知道某轮存在、日期/轮次、参与名单、填写进度，或阅读正文/已保存草稿？Space owner、创建者但未参与者是否例外？这些边界必须分别确认，不从“同 Space”推导全员可读。
- 谁能创建/选择名单、创建者是否必须参加、Shared 是否允许只选1人、最大人数及是否至少2人？同 Space 同日仅一轮是否继续沿用？不自行解除日期唯一约束。
- 创建后是否允许增删/替换参与者？已有内容如何保留，新加入者能读哪段历史、被移除者是否保留阅读权、谁有日期更正权？本次不采用任何未批准规则。
- 退出 Space/被移除/再次加入后的历史权限、显示姓名及进度分母如何处理？已填写后更新是否计入完成？需要明确快照与当前身份各自用途。
- 原“Space 紧邻上一轮本人计划”还是“最近本人参加的一轮计划”？未参加上一轮时的提示与隐私边界需确认，不自动检索更多历史。
- 主要风险：权限扩大泄露草稿/元数据、共用资格误授日期更正、选人与成员退出的竞态、旧前端不兼容、读取截断误判人数/统计、姓名投影越权、迁移误改旧参与者。上述均待独立设计及安全回归；不阻止本轮仅视觉的 Slice8 + 修正。

## P3 - Long-Term Directions

- Re-evaluate Supabase Pro if the project becomes a formal service that must stay online long term.
- Native iOS / Android app feasibility and distribution remain behind a decision gate, without an implementation version.
- Paid or account-tier model.
- External calendar import/export and richer Google, Apple/System, or CalDAV integration follow the Calendar Sources architecture but need separate scope.
- `Shared Life Space / 共享生活空间` is the frozen long-term architecture; the directional roadmap above does not by itself approve implementation.

## Completed and Deferred History

### v0.1.8.1

- Completed: Desktop Chrome/macOS permission, local notification, Service Worker notification, FCM acceptance, and final test push passed.
- Completed: iPhone installed PWA permission, subscription, test push, home-screen/background, and lock-screen delivery passed.
- Recovered browser state: the initial Desktop subscription accepted upstream delivery but did not display; unsubscribe/resubscribe restored delivery. Retry, unsubscribe/resubscribe, and browser/PWA restart are the first-line recovery steps for similar Push symptoms before deeper RCA.
- Deferred by validation strategy: Android installed PWA permission, subscription, foreground/background/closed-app delivery, notification click, and logout lifecycle move to final v0.1.8 cross-platform acceptance and do not block Slice 2.

### v0.1.7.3.3.2

- Completed: Production recurrence scope UI supports 「仅修改当前事件 / 修改当前及未来事件 / 仅删除当前事件 / 删除当前及未来事件」.
- Completed: final Production recurrence smoke passed on Desktop and iPhone Standalone PWA.
- Deferred by product decision: `delete_logical_series` remains a backend RPC with no UI entry point, because whole-lineage deletion is high-impact and needs a separately approved safeguard/UX slice.
- Known platform behavior: iOS Standalone PWA cannot actively refresh itself; this iOS system limitation is not a project defect.

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
