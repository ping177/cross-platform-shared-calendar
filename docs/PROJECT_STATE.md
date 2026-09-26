# Project

跨系统共享日历

## Repo path

`/Users/wp/Projects/跨系统共享日历`

## Current version

v0.1.14

## Current status

v0.1.14「回顾」`BACKEND PRODUCTION PASS / FRONTEND PRE-DEPLOY GATE PASS / READY FOR AUTHORIZED PUSH / PRODUCTION FRONTEND NOT DEPLOYED`。产品与验收契约见 [v0.1.14 规格](./v0.1.14_STRUCTURED_CHECKIN_SPEC.md)。原 Slice 1 backend 与 date chronology forward fix 均已在 Production 应用并通过 postflight；本地真实账号验收产生的 4 个测试 rounds / 7 个 entries 已按 exact IDs 单独清理，Production Review 数据保持 0/0 clean initial state。Slice 2–4、集成、两轮 acceptance fixes 与最终 frontend pre-deploy gate 本地 `PASS`；Production 用户可见前端仍为 v0.1.13，v0.1.14 整体尚未关闭。

## Latest completed

v0.1.14 Frontend Pre-deploy / Push Gate 本地 `PASS`：整体审查 `origin/main...HEAD` 的 7-commit stack，确认最终 UI 使用 `review_date` chronology、同日唯一、authoritative count、日期驱动的上一份计划与内部-only `round_no`。Gate 发现日期更正成功后刚创建详情不会立即刷新上一份计划，已用一个 bounded frontend fix 修正并加入先红后绿回归。Production 只读核对两张表、RLS/policies、五个 RPC 精确签名/定义/ACL 与数据 0 rounds / 0 entries / 2 enabled Review modules；无写入或 cleanup。Review targeted Node 39/39、完整 Node 313/313、Project State gate 19/19、build、diff-check、secret/copy/parity scans 与 production dependency audit（0 vulnerabilities）均通过；既有 521.79 kB bundle warning 不阻断。未 push、deploy 或操作真实账号。

v0.1.14 Date Chronology Production backend rollout `PASS`：cleanup 前只读复核确认唯一 4 个验收 rounds / 7 个 entries，随后按用户授权在独立事务中 exact-ID 删除并通过 FK cascade 清理 entries；两条 enabled Review module rows 与既有核心数据保持不变。SHA-256 `7adf5a8dfa34c0bfca8ab05b7b2467bcfe088d262c50213d6e24fbae939cb82f` 的 exact forward patch 通过自身 `BEGIN/COMMIT` 应用一次，exit code 0。postflight 确认 `unique(space_id, round_no)` 与 `unique(space_id, review_date)` 并存，create/correct duplicate-date 语义和 date-driven previous-plan RPC 与 canonical 一致，三者均为 authenticated-only EXECUTE；Review RLS 未变、数据保持 0/0，Space/member/module/Event/Task/reminder 计数和指纹前后一致。未部署或 push frontend，也未创建 Production fixtures。

v0.1.14 第二轮 acceptance fix 本地 `PASS`：`review_date` 成为业务时间轴，新增同 Space 同日唯一约束；create/date-correction 在既有 Space 锁内拒绝占用日期。previous-plan 改为窄只读 RPC 后端确定严格更早日期中的最近一篇，只返回本人 plan/null，无本人 entry 或空 plan 不 fallback。`round_no` 保持内部不可变序列和游标。新 pgTAP 41/41、完整 DB 12 files/546、Review concurrency 4/4、lifecycle concurrency 9/9、targeted Node 21/21、full Node 312/312、build PASS。patch 只应用本地测试库，未触碰 Production。

v0.1.14 authenticated acceptance feedback fix 本地 `PASS`：移除历史、详情、无障碍名称与日期弹窗中的可见「第 N 次」，日期成为可见身份；历史新增 RLS 下当前 Space 的 authoritative exact count「共 N 篇回顾」，分页不以已加载行数或游标局部计数覆盖；参考文案统一为「上一份计划」。该第一轮节点当时保留 `round_no - 1`，现已由上方第二轮 date chronology 语义 supersede。Focused Node 11/11、完整 Node 305/305、build PASS。没有 Production 写入/部署、依赖或 Codex 登录操作。刷新页面回首页记录为后续 UX 事项，本轮未修复。

v0.1.14 前端 integration / pre-deploy review 本地 `PASS`：核对 Hub → 单 Space 历史/新建 → 服务端 canonical id 详情 → 本人编辑/对方只读 → 日期更正/返回排序；修复底部导航离开详情时绕过未保存草稿确认的问题。构建产物指向已关联的 Production backend；Production 只读核对四个回顾写 RPC、模块开关、函数授权、表列与 RLS，未发现前端依赖未部署能力。Focused Node 7/7、完整 Node 302/302、build、diff-check 与生产依赖安全审计 PASS。未进行真实账号/设备验收、Production 写入、前端部署或 push。

v0.1.14 Slice 4 Responsive Detail + Date Correction + Previous Plan 本地 `PASS`：历史行与新建成功可进入详情；Personal 单列，Shared 桌面我/对方并排、手机切换且保留本人草稿。本人复用 Slice 2 editor；对方当轮 entry 只读、固定高度框内滚动。日期经已部署 `correct_review_date` 更正并用服务端结果更新；返回历史会重新读取排序。该 Slice 当时使用紧邻内部编号读取上一份计划，现已由第二轮 date chronology 修正替代。Focused Node、full Node、TypeScript/Vite build、diff-check PASS；该节点无 SQL/RLS/RPC、Production 写入/部署或真实账号验收。

v0.1.14 Slice 3 Module Entry + Space-scoped History & Create 本地 `PASS`：空间管理增加 owner-only 回顾开关；功能中心仅在存在已开启且当前可访问的 Space 时显示回顾。独立单 Space 选择、参与者快照状态映射、20 轮游标分页和日期可编辑的 `+` 新建复用现有 RLS 与 `create_review_round`。Focused Node、full Node、TypeScript/Vite build 与 diff-check PASS；无 SQL/RLS/RPC、依赖、Production/frontend 部署或真实账号验收。完整详情和上一轮计划属于 Slice 4。

v0.1.14 Slice 2 Entry Save & Filled Status 本地 `PASS`：新增本人 entry 的定向读取与复用已部署 save/mark RPC 的 data layer、四字段固定高度编辑组件、canonical 状态/dirty 分离和失败保留草稿。Focused Node 8/8、full Node 284/284、TypeScript/Vite build 与 diff-check 通过；没有组件测试框架，未进行组件自动交互或真实账号验收。无 SQL、Production frontend、依赖或导航变更。

v0.1.14 Slice 1 Production backend rollout `PASS`：已推送的唯一回顾 forward patch 在 Production 以自身 `BEGIN/COMMIT` 事务执行一次；两表、约束、索引、触发器、RLS/ACL、四个窄 RPC 与模块开关 postflight 通过。既有 Space、成员、模块、Event、Task、Reminder 的计数及全行指纹前后完全一致；回顾两表与 `review` 模块行均为 0。未部署回顾前端或执行真实账号验收。

v0.1.14 Slice 1 Backend Foundation 本地验证节点：canonical schema 与单份 forward patch 已准备；两表、participant 双条件读、四个窄 RPC、Space 锁与 review 模块开关完成。本地 DB 11 文件/505 项、回顾双会话 3/3、既有 lifecycle 双会话 9/9 PASS；该节点未改 Production。

v0.1.14 Slice 1 Production READ-ONLY preflight `PASS`：Production 与 v0.1.13 patch 前置结构兼容；回顾对象及 `review` 模块行均不存在；成员数据无 blocker；lifecycle 定义、RLS/ACL/RPC 边界、锁前置条件与 schema/patch parity 核对通过。未执行 Production 写入，blockers 为 `None`。

v0.1.14 回顾 Design Freeze：固定 Personal 单人 / Shared 创建时双人 participant snapshot、历史成员访问、Space 内编号、日期更正、四字段状态、模块开关和响应式 UI；形成五个 bounded implementation slices 与验收条件。仅文档变更，未实施功能。

v0.1.13 Final Regression + Closeout `CLOSED / PASS`：Slice 2 Production deployment `6662531970`（source `c08e9f1`）成功；公开入口及当前 JS/CSS 静态资源返回 HTTP 200，Production 四个 lifecycle RPC 的签名、search_path 与 authenticated-only EXECUTE 权限只读核对通过。用户报告真实账号、移动端及 PWA 验收全部通过。Focused Node 46/46、full Node 276/276、build、diff-check 均通过；Codex 未操作真实登录态。

v0.1.13 Slice 2 review 修正：leave/delete RPC 成功后先清除当前与持久化的 Space 选择并退出详情，再刷新空间列表；刷新失败也不恢复失效详情。remove/transfer 保留合法选择。Calendar/Task 的既有 eligibility 纠偏在目标失效时可回退默认值。Node 276/276、build、diff-check 通过；只读核对 Production RPC，无数据库变更或真实账号登录。

v0.1.13 Slice 2 本地前端实现：Shared owner/member 分别显示授权操作，Personal 不显示 lifecycle 操作；四个动作直接调用 Slice 1 RPC，带成员重验、确认与防重复提交，完成后刷新空间和详情。自动 Node 回归、build、diff-check 通过；未操作 Production、真实账号或 PWA。

v0.1.13 Slice 1 `CLOSED / PASS`：Slice 1B 只应用一份已审查 forward patch，Production postflight 核对四个 RPC、owner/capacity guard、Personal hard protection、18 项 TRUNCATE 拒绝和 reminder claim 结构。业务数据前后计数与指纹完全一致，5 条 sent 历史 orphan ledger 保留。Slice 1 本地 DB 388/388、双会话 9/9、Node 266/266、build 和 diff-check 均通过；Production 未创建测试数据，未部署前端。

v0.1.13 Slice 1A 本地 backend 和窄 ACL recovery 完成：四个 lifecycle RPC、Shared owner/capacity guard、精确 Event 清理、reminder claim 并发锁；对三个应用角色撤销六个 lifecycle 相关表的 `TRUNCATE`。本地 DB 388/388、双会话 9/9、Node 266/266、构建和 diff 检查通过。

v0.1.12 — Module Hub + Space Management Navigation 已完成并 `CLOSED / PASS`。Production 部署了已验收的前端提交 `9847a0761e117234e10e219ec9c8d4bae25a850e`，最终自动回归与用户真实账号 Production / installed-PWA 验收通过。一级导航为 首页 / 日历 / 功能中心 / 我的；功能中心仅有任务，任务聚合各 eligible Space；我的 → 空间管理管理 Personal / Shared 详情。Space 仍是 canonical ownership boundary。统一 UI 视觉精修、未使用的 `MemberSheet.tsx`、`space_modules` Realtime 和 Calendar all-Space 创建留待后续，不阻塞本版本。

v0.1.12 Slice 3 已通过用户真实账号本地功能验收并 `CLOSED / PASS`。一级导航为 首页 / 日历 / 功能中心 / 我的；功能中心目前仅有任务，任务聚合与独立筛选已接入，旧 Space-first 日常任务路径已退役。最终代码 review 与自动校验通过；其后 Slice 4 Production / installed-PWA 验收亦通过。未用的 `MemberSheet.tsx` 待另行决定删除。

v0.1.12 Slice 2 My → Space Management → Space Detail 已通过用户真实账号功能验收并 `CLOSED / PASS`。涵盖 Personal/Shared 列表和详情、成员/角色、邀请码、Tasks 开关、create/join 复用、selectedSpaceId 管理职责及临时旧 Hub 过渡。UI视觉精修留待统一设计迭代，不阻塞本 Slice。Production 未变。

v0.1.12 Slice 1 Aggregate Tasks foundation 已验收为 `CLOSED / PASS`：eligible Tasks Space、独立 taskFilter 修正、完整跨 Space 读取与分页、沿用单 Space canonical 排序、Space 来源映射、stale-request 保护和 malformed module page fail-closed。仅增加数据层及测试，未接入可见 UI；不代表 v0.1.12 整体已关闭。

v0.1.11 — Navigation + Aggregation Experience 已完成并 `CLOSED / PASS`。首页“近期日程 +”和“需要处理的任务 +”分别直达对应创建表单；没有首页标题 Global `+` 或类型选择面板。用户报告 Desktop 与 Production installed PWA 验收通过，覆盖入口、Personal/Shared target 与归属、保存即时刷新、模块关闭安全、二次确认取消、关闭重开、防重复提交、布局、一级导航及现有日历/空间本地创建回归。目标空间安全、membership/module/member-derived state 重验、stale request 与 duplicate-submit protection 均保留。Production URL 在验收时对应前端提交 `f916dc0f0a1962facca44f4174241031b4f44bf2`。Dedicated final iPhone Safari acceptance 为 `NOT RUN`；未将其记为 PASS，也不是 blocker。

2026-09-25 roadmap re-freeze：v0.1.12 目标为 Module Hub + Space Management Navigation（功能中心 + 空间管理信息架构迁移）；当时仅进入 READ-ONLY 设计审查，此后 Slice 1、Slice 2 已关闭。原先在 Structured Review / Check-in 与 Shared Lists 之间择一作为 v0.1.13 的想法，已被后续 Space Lifecycle & Membership Safety 优先决策取代；其余远期模块顺序保持开放。

Slice 3 Home Aggregation is deployed to Vercel Production and `CLOSED / PASS` after local implementation, automated verification, and user-run desktop and Production device acceptance. Home aggregates membership-visible Event occurrences over three local calendar days and eligible open Tasks through seven future days plus undated; each section has five-row collapse/expand, source Space labels, canonical Sheets, independent error/retry and active-view bounded Realtime. User-run acceptance passed on desktop, Vercel Production, iPhone Safari, and installed PWA, including the four tabs and Home default; Personal/Shared Events and eligible Tasks; ordering, labels, inclusion/exclusion, expand/collapse and canonical Sheet interactions; module disable/re-enable; Home leave/return; A/B Event/Task Realtime; narrow viewport; and the Space → Tasks navigation fix. Only confirmed module `disabled` exits Tasks; `loading`/`error` keep the page with mutation gating and retry. The regression test failed before the fix and passes now. Production includes Slices 1–3. Independent Event/Task section error/retry is `NOT RUN / DIFFICULT TO SIMULATE SAFELY`; second Shared Space is `N/A / NOT RUN`, with no test Space created. No backend/schema/RPC or dependency change.

Slice 2 Aggregate Calendar is implemented under Option A: `all` has no create action; a single Space filter uses the existing Event Sheet with an explicit target and membership recheck. Complete Event/exception reads, per-Space members, canonical recurrence/edit reuse, fail-closed display and active-view Realtime passed automated checks and the read-only frontend/backend readiness gate. Implementation commit `0505091` is pushed to `origin/main`; local automated verification and user-run authenticated functional checks 1–10 are `PASS`, including Today/Week/Month navigation and current-period actions. User-run bounded Production smoke is `PASS`: Production runs the Slice 2 frontend; aggregate/source labels, all/single create behavior, Event open/edit context, date navigation/current-period actions, Hub → Calendar filter, rapid-filter stale-data isolation, and A/B Realtime create/update/delete passed. Slice 2 is `CLOSED / PASS`. Checks 11 iPhone Safari, 12 installed PWA and 13 final 320px device check are `DEFERRED / NOT RUN`; check 14 second Shared Space is `N/A / NOT RUN`. No Slice 2 backend rollout occurred; Slice 1 remains `CLOSED / PASS` in Production.

## Deployment

Status: public_deployed
Public URL: https://cross-platform-shared-calendar.vercel.app/
Provider: Vercel
Backend: Supabase Free
Backend rollout: v0.1.14 Slice 1 review foundation and date chronology forward patches applied and postflight verified; v0.1.13 lifecycle remains applied.
Notes: Vercel is the configured Production provider. Production backend now has same-Space/date uniqueness, duplicate-safe create/date correction and `get_my_previous_review_plan`; authenticated-only ACL and participant RLS postflight passed. Local acceptance test Review rows were removed by a separate exact-ID cleanup, leaving `review_rounds=0` and `review_entries=0` while two Review modules remain enabled. The user-visible frontend remains the accepted v0.1.13 baseline; local v0.1.14 frontend commits have not been pushed or deployed. Historical version-specific acceptance limits remain in DEVLOG/TESTING. `space_modules` remains outside Realtime; `send-test-push` remains ACTIVE v4 reviewed-equivalent and `send-reminders` ACTIVE v2 / `verify_jwt=false`. Vault, secrets and Cron were not changed.

## Version Index

- v0.1 — 共享日历 MVP
- v0.1-smoke-test — Supabase 验收
- v0.1.1 — 个人事件权限
- v0.1.2 — 公网部署验收
- v0.1.3 — 事件表单默认值
- v0.1.4 — 成员身份与空间成员
- v0.1.5 — Email OTP 登录 UX
- v0.1.6.1 — Recurring Events Foundation（migration + engine，Production patch 已执行）
- v0.1.6.2 — Recurring Events Calendar Integration（occurrence projection，未实现 recurrence UI）
- v0.1.6.3 — Recurring Events UI Implementation（source-series form，待最终浏览器/Realtime 验收）
- v0.1.7 — Recurrence Exceptions & Series Editing（设计完成，待人工 review）
- v0.1.7.1 — Recurrence Exceptions Database Foundation（Production prerequisites 已验证）
- v0.1.7.2 — Exception Expansion Engine（Production 已验证）
- v0.1.7.3 — Recurrence Editing Semantics Design（设计完成，待人工 review/implementation approval）
- v0.1.7.3.1 — Database RPC Foundation（Production patch + PostgREST schema cache 已验证）
- v0.1.7.3.2 — Frontend RPC Integration（only-this authenticated smoke 已通过）
- v0.1.7.3.3.1 — Split RPC Correctness Patch（final split / future-delete semantics 已验证）
- v0.1.7.3.3.2 — Frontend Scope Integration（Production Desktop 与 iPhone Standalone PWA recurrence smoke 已通过）
- v0.1.8 — Mobile Push Reminder（CLOSED / PASS）
- v0.1.8.1 — Push Infrastructure Foundation（CLOSED / PASS；Desktop + iPhone + Android Studio Emulator verified）
- v0.1.8.2 — Reminder Persistence + Ordinary Event Delivery（Slice A/B/C CLOSED / PASS；P3A C1、P3B manual E2E、P3C automatic scheduler E2E complete）
- v0.1.9 — Shared Tasks MVP（CLOSED / PASS；Slice 1/2/3 CLOSED / PASS；Production backend verified、frontend deployed and accepted）
- v0.1.10 — Personal Space + Multi-space + Module Enablement Foundation（CLOSED / PASS；Slice 1 PRODUCTION BACKEND ROLLOUT PASS；Slice 2 CLOSED / PASS；Slice 3 CLOSED / PASS）
- v0.1.11 — Navigation + Aggregation Experience（CLOSED / PASS；Slice 1–4 CLOSED / PASS；Production installed PWA acceptance PASS；dedicated final iPhone Safari acceptance NOT RUN）
- v0.1.12 — Module Hub + Space Management Navigation（CLOSED / PASS；Slice 1–4 CLOSED / PASS；Production / installed-PWA acceptance PASS）
- v0.1.13 — Space Lifecycle & Membership Safety（CLOSED / PASS；Slice 1/2 CLOSED / PASS；Production deployment、用户报告的 authenticated/mobile/PWA acceptance PASS）
- v0.1.14 — 回顾（原 Slice 1 backend 与 date chronology fix 均 Production APPLIED / POSTFLIGHT PASS；验收测试数据 cleanup 完成且 Review 数据 0/0；Slice 2–4、集成、两轮反馈修正及 frontend pre-deploy gate 本地 PASS；READY FOR AUTHORIZED PUSH，前端未 deploy，整体未关闭）

## Last verified

2026-09-26

## Next Action

Next Action: 获得用户明确 Git push 授权后，push 当前 v0.1.14 本地 commit stack，由 Vercel 完成 Production deployment；确认静态 Production 资源已切换后，再由用户执行最小 authenticated date-chronology recheck。不要在 push/deploy 和最终复验前把 v0.1.14 标记为 deployed 或 CLOSED。

## Blockers

暂无明确阻塞。

## Important Context

- v0.1.14 Design Freeze 已同步第二轮 acceptance feedback：`review_date` 是业务时间轴且同 Space 同日唯一；上一份计划严格按日期上一篇、不 fallback；`round_no` 仅为内部技术序列。Production backend 已包含原 Slice 1 与 date chronology fix，相关约束、RPC、ACL、RLS postflight `PASS`；本地验收产生的 Review 测试数据已精确清理，当前为 0 rounds / 0 entries、两条 Review module enabled。用户此前已完成本地真实账号主要流程验收；本地 Slice 2–4、两轮反馈修正与 frontend pre-deploy gate 已通过，仍未 push/deploy，Production 前端没有回顾 UI，最终 backend/frontend combined date-chronology 最小复验待部署后执行。刷新页面回首页仍是后续 UX 事项。完整 contract 和验收条件只以 v0.1.14 规格为准。
- Git branch、latest commit、working tree 由 project-command-center 实时 Git 扫描读取；PROJECT_STATE.md 不作为这些字段的权威来源。
- Production URL: `https://cross-platform-shared-calendar.vercel.app/`.
- Supabase project status is currently Active, but Free Tier inactivity pause remains an operational risk.
- A Supabase pause may affect Auth, Database, RLS, and Realtime until the project is restored.
- Vercel Cron 每天调用 `/api/supabase-keepalive`；每次调用连续执行 3 次极轻量、只读、无业务副作用的数据库检查；首次 Production Cron 已返回 HTTP 200 并完成验证。
- Keep-alive is active, but its long-term effectiveness against inactivity pauses still requires observation.
- Continue using Supabase Cloud for now; do not upgrade to Pro or migrate the backend unless real usage requires it.
- README is the project entrypoint; detailed smoke checklists and production validation records live in `docs/TESTING.md`.
- Android compatibility smoke test is complete for Xiaomi 14 / Android 16 / Chrome on mobile network.
- v0.1 is a Web/PWA, not native iOS / Android.
- v0.1.9 canonical scope is `docs/v0.1.9_SHARED_TASKS_SPEC.md`; Slice 1 backend is Production applied/postflight verified, Slice 2 local UI passed user-run authenticated acceptance, and Slice 3 Production Desktop A/B plus iPhone smoke passed. All three slices are CLOSED / PASS.
- v0.1.10 is `CLOSED / PASS`: it reuses `spaces / space_members`, enforces sole-owner Personal Space with partial unique `UNIQUE(created_by) WHERE kind = 'personal'`, retains the Shared two-member limit, and keeps disabled Tasks history readable while blocking mutations. Calendar is always on; Tasks is the only v0.1.10 visible module toggle. Slice 1 / 2 / 3 passed their respective backend, frontend, and user acceptance gates. Production frontend now also includes the v0.1.11 Slice 1 navigation foundation; that rollout changed no backend/schema/RPC. Shared three-plus-member support remains deferred.
- v0.1.11 canonical scope is `docs/v0.1.11_NAVIGATION_AGGREGATION_SPEC.md`; overall and Slices 1–4 are `CLOSED / PASS`. Production installed PWA acceptance is user-reported `PASS`; dedicated final iPhone Safari acceptance is accurately recorded as `NOT RUN` and is not a blocker. Production includes the Slice 4 frontend from feature commit `f916dc0f0a1962facca44f4174241031b4f44bf2`. Slice 3 independent Event/Task section error/retry remains `NOT RUN / DIFFICULT TO SIMULATE SAFELY`; second Shared Space is `N/A / NOT RUN`. Dedicated Slice 2 device checks remain deferred as recorded above.
- Roadmap at the v0.1.13 closeout: v0.1.12 and v0.1.13 were `CLOSED / PASS`; v0.1.13 Slice 1/2, Production deployment, and user-reported authenticated/mobile/PWA acceptance were all `PASS`. The next-version planning checkpoint later selected v0.1.14「回顾」; its current state is recorded above. A future Personal Event share/projection direction may preserve one canonical Space owner while adding visibility elsewhere; it is not v0.1.13 scope and has no schema reservation.
- v0.1.10 backend rollout preserved existing Space/member/Event/Task row counts and identity/invite fingerprints. The user subsequently completed the first A/B authenticated acceptance; Personal Spaces are now created by the deployed Slice 2 bootstrap. The old v0.1.9 runtime is not a safe rollback target for an account with a Personal Space. Any older-account bulk backfill remains outside Slice 2 and requires a separate review. Production Task count was 0 at backend rollout, so historical Task disable/re-enable remains locally verified rather than Production-tested.
- v0.1.10 is closed with Shared Spaces retaining the two-member limit. It does not include cross-Space aggregation, final four-destination navigation, global `+`, Lists / Important Dates / Review implementation, or module-state Realtime. The observed member refresh behavior is a known characteristic and future consideration; it does not reopen v0.1.10.
- `V019_SLICE2_UI_FROZEN` / `SLICE 2 IMPLEMENTED / MANUAL AUTH ACCEPTANCE PASS`: Calendar header `共享空间 · {space.name}` opens the current Space Hub; its only module entry is Tasks. Open Tasks and separate Completed Tasks use the existing Space-scoped contract. Empty `profiles.display_name` may use contextual `我 / 对方` only in the current two-member v0.1.9 UI; this is not a durable partner identity, and future Multi-space / multi-member UI uses generic member display logic. Space-entry navigation and 320px layout passed user-run acceptance; extreme-width name ellipsis is accepted.
- Slice 1 uses direct PostgREST CRUD with four member-scoped RLS policies, no Task RPC, one exact-order list index, and a PostgreSQL 17.6-verified composite FK whose column-specific delete action clears only `assigned_to_user_id` when a member leaves.
- A Task is Space-scoped work that remains to be completed. Assignment does not restrict visibility, ordinary edits, reassignment, or deletion; null means shared. Shared status transitions belong to any current member, while assigned status transitions require the assignee from before the UPDATE. A takeover and completion require separate UPDATEs; RLS and the corrective DB trigger remain authoritative.
- Task status is only `open` / `completed`; `due_on` is optional date-only metadata. v0.1.9 has no completion audit, Task Reminder, recurrence, Task/Event dual persistence, Multi-space implementation, or UI overhaul.
- Multi-space decision is `MULTISPACE_NOT_REQUIRED_FOR_V019`. Task persistence must always use explicit `space_id` and introduce no new one-space-only assumption.
- Event ownership uses stable `scope + owner_user_id`; UI labels are derived from the current user.
- Personal events are visible to both members but only editable/deletable by the owner.
- Existing event identity fields must not change: `space_id`, `created_by`, `scope`, `owner_user_id`.
- Supabase RLS and database triggers remain the final permission boundary.
- v0.1.4 uses only `profiles.display_name`, which is nullable and constrained to trimmed 1–20-character values. UI fallback is 「成员」; shared remains 「共同」.
- New profiles default to a null display name, never an Auth metadata or email-derived public name.
- No `space_members.nickname`, no profile/member Realtime subscription, and no RLS policy changes were added. A name change updates the saving device immediately; other sessions refresh/re-enter to see it.
- The current Production Supabase patch and SQL/RLS verification passed on 2026-07-11. Local two-account desktop smoke and deployed-frontend Production desktop smoke passed.
- Resend SMTP + Supabase Auth passwordless template deliver 8-digit Email OTP in Production. Email OTP removes Magic Link return handling; Safari and standalone PWA retain separate session storage and each complete login directly with the code.
- New-user first-login, new-space creation, and profiles/display_name behavior passed in v0.1.5 Production acceptance. The single-member-space path remains intentionally unverified.
- v0.1.6 recurrence rules are source-event metadata only. Existing event identity fields remain immutable; no recurrence table, occurrence materialization, exception model, RLS change, Realtime configuration change, reminder, or notification work is included. v0.1.6.2 projects only the current Today/Week/Month visible range and uses occurrence IDs only as display keys; v0.1.6.3 writes recurrence rules only on source events and labels all recurring edits/deletes as whole-series actions.
- The original v0.1.7 design is in `docs/RECURRENCE_EXCEPTIONS_DESIGN.md`. Its exception foundation, projection, database RPCs, and v0.1.7.3.3.2 only-this / this-and-future UI are implemented. Logical-series deletion UI remains deliberately deferred; exception Realtime publication remains future work.
- v0.1.7.1 foundation is present in the local schema and its 18-test pgTAP suite passes. v0.1.7.2 has a compatible reader/projection implementation. v0.1.7.3.3.2 supports only-this and this-and-future mutation UI; logical-series deletion UI and exception Realtime publication/subscriptions remain deliberately deferred.
- v0.1.7.3 treats `series_id` as the logical root and `parent_event_id` as the immediate predecessor. The final split RPC moves future exceptions to the child, consumes a split-day override, rejects a split-day deletion, preserves source recurrence rule/all-day, and requires the child to start on the selected occurrence date. The actual exception schema uses `event_id`, `occurrence_date`, `exception_type`, and `override_data`; the v0.1.7.3.3.2 client relies on the RPC for all transaction work.
- Final Production recurrence smoke passed on Desktop and iPhone Standalone PWA for all four supported occurrence actions. iOS Standalone PWA cannot actively refresh itself due to an iOS system limitation; this is not an application defect.
- `supabase/config.toml` uses a stable local `project_id` and configures a local 8-digit Mailpit OTP template plus the port-5175 redirect URL. The local Docker/Supabase stack was recovered without reset or volume deletion; C1 pgTAP 63/63 and all database regressions 161/161 passed.
- The engine uses native `Intl` IANA timezone formatting/conversion and rejects invalid rule shapes at both client and database boundaries. It returns an explicit error instead of a partial result after 500 candidates.
- C2 Phase 2 pre-implementation review identified a reproducible DST-gap CPU blocker in the legacy 2161-point minute fallback. The corrective patch preserves the existing minute-grid outputs while using the fixed-point candidates to bracket and binary-search proven forward gaps. Same-machine 1000-call Deno improved from `7099.71 ms` to `144.06 ms`; human review passed and `DUE_CALCULATOR_CPU_BLOCKER = RESOLVED / PASS`.
- v0.1.8.2 supersedes the earlier `events.reminder_offset_minutes` proposal. One event-level nullable `events.reminder_kind` supports `timed_at_start`, `timed_10m_before`, `timed_30m_before`, `timed_1h_before`, `timed_previous_day_same_time`, `all_day_same_day_08`, and `all_day_previous_day_20`; `null` means no reminder. Multiple reminders, JSON reminder config, arbitrary custom minutes, and per-user reminder preferences remain outside this version.
- `events.time_zone` is the nullable canonical IANA timezone of the Event. New events detect it from the creating browser/PWA with standard `Intl` capability; later device timezone changes never silently rewrite an existing Event. Historical ordinary timezone remains null rather than guessed, while historical recurring sources may initialize it from their already-authoritative rule timezone. Recurring Event `time_zone` must equal `recurrence_rule.time_zone`, so there is only one authoritative timezone.
- New UI-created timed events default to `timed_10m_before`; new UI-created all-day events default to `all_day_same_day_08`. Database defaults and all historical events remain `reminder_kind = null`; historical ordinary Event timezone is not guessed or bulk-backfilled.
- Timed-to-all-day conversion maps a non-null timed reminder to `all_day_same_day_08`; all-day-to-timed maps a non-null all-day reminder to `timed_10m_before`; null remains null and the UI must show the resulting option. Multi-day reminders anchor only to the start and ignore `ends_at`.
- v0.1.8.1 Push Infrastructure is closed and passed on Desktop Chrome/macOS and iPhone installed PWA. `push_subscriptions` uses RPC-only authenticated browser writes, `send-test-push` owns server-side VAPID delivery, and the private key remains only in Supabase secrets. Safe diagnostics expose only upstream `status`, `delivered`, hostname-only `provider`, and `gone`. `@mmmike/web-push@1.3.0` remains an exact function-level dependency; no root/browser dependency was added.
- The initial Desktop Chrome subscription was abnormal/stale: FCM accepted the send (`201`, `delivered = true`) but no notification appeared. Closing notifications, unsubscribing, and creating a fresh subscription restored Desktop test-push delivery. For similar Push symptoms, try retry, unsubscribe/resubscribe, and browser/PWA restart before deeper RCA.
- Standard Web Push is the delivery channel. The Push Service Worker handles Push only and must not introduce offline caching. Desktop/macOS and iPhone acceptance passed. Android Studio Emulator permission/subscription, test Push, ordinary automatic Reminder, audible presentation, and notification-shade delivery passed; the supplied evidence does not establish physical-device heads-up behavior, and no notification-click PASS is asserted beyond the evidence provided.
- Push subscriptions bind to `user + installation`, never to a Space, and one user may retain multiple active device/browser subscriptions. This persistence model remains compatible with a future multi-space schema without implementing multi-space in v0.1.8.
- shared event reminders resolve current active Space members at send time; personal event reminders resolve only the current `owner_user_id`. A former member must not receive a delivery.
- v0.1.8 uses one active once-per-minute Supabase Cron + Edge Function sender. Slice 2 ordinary Event delivery and Slice 3 recurring delivery are closed in Production. Slice 3 dynamically projects recurring occurrences through canonical recurrence/exception semantics within a bounded timezone-aware window and does not materialize a future horizon.
- Slice 3 Reminder projection passes a non-mutating `ends_at = null` view to the canonical engine because Reminder due semantics depend only on effective occurrence start. The canonical calendar engine and its 500-candidate duration-overlap guard remain unchanged.
- Deployed Slice 3 extends ledger identity with nullable `occurrence_date`: ordinary rows keep NULL and retain `(event_id, subscription_id, due_at)` behavior through `NULLS NOT DISTINCT`; recurring rows use logical series ID plus scheduled occurrence date, subscription, and due. No queue, future rows, retry framework, or occurrence table was added.
- Slice C1 implementation, verification, human review, Production deployment, ACL correction, and final postflight are complete. The original patch created the empty durable ledger and atomic claim function; RCA isolated its ACL gate failure to the `postgres`/`public` default table ACL, and the reviewed table-local correction reduced `service_role` to SELECT / UPDATE only. `C1_PRODUCTION_FOUNDATION = PASS`. Audit rows intentionally have no Event/user/subscription foreign keys. The schedule marker must still round-trip at full PostgreSQL `timestamptz` precision.
- Slice C2 Phase 1 extracts Web Push sending into a server-only shared module with a closed safe result union and keeps `send-test-push` externally unchanged. Automated verification and Desktop/iPhone real-device regression passed after deploying only `send-test-push`. Repeated Desktop banners with the fixed `shared-calendar-test` tag are pre-existing/non-blocking; tag/renotify behavior remains unchanged. The later C2 scan must abort before claims/sends when enabled ordinary Events exceed 1000, and must sort eligible tasks by `due_at` ascending before capping at 50; no queue is added.
- Slice C2 Phase 2 `send-reminders` passed bounded human/code review with no BLOCKER / MAJOR / MINOR findings and completed P3B Production manual acceptance. It uses stable 100-row keyset pages plus an explicit 1001st-row probe, aborts overflow before recipient/claim/send work, preserves the raw C1 schedule marker, resolves current memberships and active subscriptions in batches, selects at most 50 tasks deterministically, uses five workers, and rechecks the 95-second budget immediately before claim acquisition. It adds no retry, lease, queue, recurring delivery, schema, or dependency. P3B delivered one iPhone Reminder, finalized two ledger rows, and passed idempotency; Mac visible delivery was initially suppressed by Sleep/Focus and later send-test-push regression passed after that state was cleared.
- P3C enabled only Vault, `pg_cron`, and `pg_net`, then created exactly one active once-per-minute scheduler whose stored command performs the `REMINDER_CRON_SECRET` Vault lookup at execution time. Automatic no-due and real iPhone/Mac Reminder delivery passed without manual invocation. Two subscription-specific ledger rows finalized as `sent`; repeated scheduler runs created no duplicate row or send. The canonical failure containment is to unschedule `send-reminders-every-minute` first, before diagnosis.
- A newly created/edited/enabled reminder whose derived `due_at` is already past is skipped without immediate Push or compensation. Normal target precision is about one minute; a roughly ten-minute grace window applies only to infrastructure delay. Web Push remains best-effort and is not an Alarm Clock.
- Future consideration — Web/PWA Push delivery precision: semantic Reminder due calculation remains exact, while once-per-minute `pg_cron` + async `pg_net` + Web Push may occasionally add sub-minute to approximately one-minute visible delivery latency. The observed recurring example had semantic due 11:45 and claim/finalize around 11:46; this is not a due-calculation defect. v0.1.8 adds no `-60s` early-dispatch allowance and keeps ordinary/recurring timing under the same semantic rule. Revisit only if real-use feedback shows material UX impact or a future native iOS/Android app adopts OS-level local notification scheduling.
- Future consideration — physical Android heads-up presentation: functional delivery passed on Android Studio Emulator, including sound and notification-shade presence, but no heads-up banner was observed and physical hardware presentation was not validated. This may be casually revalidated on a physical Android device later; it is non-blocking and does not reopen v0.1.8.
- v0.1.8 excludes Email reminder delivery, SMS, Bark, multiple reminders, arbitrary custom minutes, snooze, sound customization, notification inbox/history, native alarms, and per-user reminder preferences. Email OTP authentication remains unchanged.
- `v0.1.9 Shared Tasks` Slice 1/2/3 are CLOSED / PASS: backend applied/postflight verified, frontend deployed through Vercel, Desktop A/B Production acceptance and iPhone smoke passed. Roadmap: v0.1.10 Personal Space/Multi-space/module enablement; v0.1.11 navigation/aggregation; v0.1.12 Module Hub + Space Management Navigation; v0.1.13 Space Lifecycle & Membership Safety. Structured Review / Check-in and Shared Lists remain future candidates after lifecycle safety.

## Handoff Prompt

v0.1.13 Space Lifecycle & Membership Safety is `CLOSED / PASS`. v0.1.14 Production backend contains the original Slice 1 foundation plus the applied/postflight-verified date chronology fix; acceptance test Review data was cleaned separately and Production Review remains at 0/0 with two enabled module rows. Slice 2–4, integration, both acceptance fixes and the frontend pre-deploy gate are locally verified; the stack is ready for an explicitly authorized push but is not pushed/deployed. Next Action is user authorization to push, followed by Vercel Production deployment and a user-run minimal authenticated date-chronology recheck. Do not mark v0.1.14 closed or fix the separate refresh-to-home UX issue in this slice.
