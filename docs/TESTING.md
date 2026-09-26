# Testing

## v0.1.14.1 Local Authenticated Refresh Acceptance — USER-REPORTED PASS

- 用户在本地真实浏览器确认 Calendar、Tasks、Review 相关页面、Space Detail 与其他已测深页刷新恢复，以及 logout → 另一账号登录不恢复前一账号深页，均 `PASS`。Codex 未驱动登录会话或重复人工测试。
- Production authenticated refresh acceptance 仍 `PENDING`。未验证 browser back/forward、可分享深链或 PWA 完全关闭后的恢复。此前 integration review 的 targeted 22/22、full Node 320/320、Project State gate 19/19、build PASS 仍为本次发布代码的自动证据；仅文档记录无需重跑完整测试。

## v0.1.14.1 Navigation Persistence Bounded Integration Review — PASS

- 临时 Auth 读取错误的 Review 详情回退测试先失败后通过；只有明确的 `ReviewUnavailableError` 才退出详情，其他读取错误显示重试且保留 sessionStorage 目标。
- 定向导航/Review/Space/Tasks：`node --test tests/navigation-persistence.test.ts tests/navigation.test.ts tests/task-navigation-regression.test.ts tests/review-detail-ui.test.ts tests/review-history-ui.test.ts tests/space-management.test.ts`，**22/22 PASS**。完整 `node --experimental-strip-types --test tests/*.test.ts tests/*.test.js`，**320/320 PASS**。Project State gate **19/19 PASS**；`npm run build` 与 `git diff --check` PASS。静态扫描未发现 Router/history/hash 导航、导航 localStorage、Review 草稿持久化、SQL 或依赖变更。
- 用户待执行的最小真实浏览器刷新验收：日历、任务、指定 Space 的回顾历史、回顾详情、Space Detail；再检查 logout 后登录不会恢复前一用户的深页。仅保证同一 browser/tab session 的刷新；不覆盖 PWA 完全关闭再启动或 browser history。

## v0.1.14.1 Navigation Persistence — LOCAL PASS / Manual Acceptance Pending

- `node --test tests/navigation-persistence.test.ts tests/navigation.test.ts tests/task-navigation-regression.test.ts tests/review-detail-ui.test.ts tests/review-history-ui.test.ts tests/space-management.test.ts`：**21/21 PASS**。定向测试覆盖 user-scoped sessionStorage、严格解析、异常存储、首页/日历/功能中心/我的、任务/已完成、回顾历史/详情、空间管理/详情、失效目标、Review eligibility 读取失败、dirty 取消与临时 `justCreated` 不持久化。新测试先红后绿。
- `node --experimental-strip-types --test tests/*.test.ts tests/*.test.js`：**319/319 PASS**。`node --test tests/project-state-push-gate.test.js`：**19/19 PASS**。`npm run build`：**PASS**，保留既有 >500 kB chunk warning。`git diff --check`：PASS。仓库无 lint script。
- 后续用户真实浏览器验收：在已登录的同一 tab 分别刷新首页、日历、功能中心、任务/已完成、回顾历史（指定 Space）、回顾详情、我的、空间管理、Space Detail；核对未保存内容不跨刷新保存、正常站内离开详情仍需确认、筛选互不影响。Codex 未操作 OTP、登录会话、iPhone 或 installed PWA。PWA 完全关闭后的页面记忆、browser history 与深链不在本版本承诺内。

## v0.1.14 回顾 Final Production Acceptance + Cleanup — CLOSED / PASS

- 用户执行并明确报告 Production authenticated acceptance **PASS**。覆盖 Review module enablement、ModuleHub 入口、Personal / Shared、双账号读写边界、本人编辑/对方只读、四种 entry 状态、history/create、previous-plan、日期更正、date chronology、same-day duplicate rejection、authoritative count、无用户可见轮次、desktop / 320px responsive behavior 与 unsaved-draft navigation protection。Codex 未操作用户登录 session；数据库 security/concurrency/lifecycle 结论仍来自既有自动测试和 Production postflight。
- Final date-chronology recheck **PASS**。三篇 Personal fixture 分别使用 2026-09-25、2026-09-26、2026-09-27 验证按日期排序、上一份计划和同日拒绝。随后 exact-ID transaction 在锁内重新验证全库 3 rounds / 3 entries、Space/日期/编号/participant metadata，删除集合与 whitelist 完全一致；FK cascade 后 rounds `3 → 0`、entries `3 → 0`，orphans 0、duplicate groups 0、三个 IDs remaining 0。
- Cleanup postflight：Shared 与 Personal Review module rows 仍为 enabled；spaces 4、memberships 5、modules 6、Events 4、Tasks 5、reminder deliveries 12，六组 aggregate fingerprints 前后一致。`UNIQUE(space_id, review_date)`、`UNIQUE(space_id, round_no)`、previous-plan RPC 与 create/correct date-conflict guards 仍存在。无其他 Production write、schema patch、deployment 或 repo change。
- Closeout 为 docs-only；没有重跑 full Node、DB regression、build 或 authenticated test。最终自动证据仍为 Review targeted Node **39/39**、full Node **313/313**、Project State gate **19/19**、build PASS、production dependency audit 0 vulnerabilities，以及此前记录的 DB/concurrency suites。

## v0.1.14 回顾 Frontend Production Deployment — Public Smoke PASS

- Normal `git push origin main` advanced `origin/main` from `f10d140` to `189f055`; the repository pre-push Project State hook passed. GitHub's exact-commit Vercel status for `189f055f350daae3fe118137e23c3bb938a748ea` was `success` with `Deployment has completed`.
- Unauthenticated Production smoke: root HTML **200**, current JS `/assets/index-CaBYwzOG.js` **200**, current CSS `/assets/index-BmUtdkZG.css` **200**, `/manifest.webmanifest` **200** with name `共享日历`. The deployed JS contains `回顾`, `上一份计划` and count-copy markers; the public login page does not show the missing-Supabase-environment error.
- A minimal Production read-only sanity confirmed 0 Review rounds / 0 entries / 2 enabled Review modules. No full Node/build rerun was performed because no code changed after the passing pre-deploy gate. No authenticated browser/PWA/device test, Magic Link/OTP, Review fixture, module mutation, Supabase write or full backend postflight was performed. User-run Production authenticated minimal recheck remains pending.

## v0.1.14 回顾 Frontend Pre-deploy / Push Gate — PASS

- Integrated review covered the seven local commits from `origin/main` through the date-chronology rollout record. A new focused regression proved that a successful date correction refreshes the just-created detail's date-driven previous-plan context; it failed before the bounded fix and passed after it.
- `node --experimental-strip-types --test tests/review-entry.test.ts tests/review-entry-data.test.ts tests/review-history.test.ts tests/review-history-data.test.ts tests/review-history-ui.test.ts tests/review-detail.test.ts tests/review-detail-data.test.ts tests/review-detail-ui.test.ts tests/navigation.test.ts tests/supabase-schema-review-date.test.ts`: **39/39 PASS**.
- `node --experimental-strip-types --test tests/*.test.ts tests/*.test.js`: **313/313 PASS**. `node --test tests/project-state-push-gate.test.js`: **19/19 PASS**. `npm run build`: **PASS** with the known 521.79 kB chunk warning. Production dependency audit: **0 vulnerabilities**. `git diff --check`, sensitive-value scan, old user-visible round-copy scan, Review debug/dev-address/Realtime scan and frontend/Production RPC parity checks: **PASS**. The repository has no lint script.
- Production read-only catalog/data check confirmed `review_rounds` / `review_entries`, RLS and participant policies; `create_review_round(uuid,date)`, `correct_review_date(uuid,date)`, `save_my_review_entry(uuid,text,text,text,text)`, `mark_my_review_filled(uuid)` and `get_my_previous_review_plan(uuid)` match the frontend and retain authenticated-only EXECUTE. Counts remain 0 rounds / 0 entries / 2 enabled Review modules. No Production write, cleanup, authenticated session, push or deployment occurred.
- Responsive review is static/SSR only: Shared desktop two-column, 320px mine/counterpart tabs with both panels mounted, Personal single column, fixed-height internal scrolling and bounded touch controls are covered by source/render tests. Final Production authenticated recheck remains user-run after deployment; refresh-to-home remains deferred.

## v0.1.14 回顾 Date Chronology Production Backend Rollout — PASS

- Pre-apply freshness: local patch SHA-256 `7adf5a8dfa34c0bfca8ab05b7b2467bcfe088d262c50213d6e24fbae939cb82f` matched HEAD; Production had 0 rounds, 0 entries, 0 duplicate groups, no date unique constraint or previous-plan RPC, the original create/correct definitions, and two enabled Review module rows. The preceding exact-ID acceptance-data cleanup removed 4 rounds / 7 entries and preserved all protected core fingerprints.
- Apply: `supabase db query --linked --file supabase/patches/2026-09-26-v0.1.14-review-date-chronology.sql --output json` completed once with exit code 0. The patch's own `BEGIN/COMMIT` remained intact; no SQL error, partial retry, ad-hoc correction, canonical schema replay, cleanup or Production fixture occurred.
- Catalog/security postflight: `review_rounds_space_review_date_key` is `UNIQUE(space_id, review_date)` and the existing `UNIQUE(space_id, round_no)` remains. Production create/correct/get-previous-plan definitions match the committed target semantics; each is `SECURITY DEFINER` with fixed `pg_catalog, pg_temp` search path, and the previous-plan function is `STABLE`. PUBLIC/anon/service-role EXECUTE are absent and authenticated EXECUTE is present. Review RLS remains enabled with the two participant SELECT policies unchanged.
- Data-safety postflight: rounds 0, entries 0, orphan entries 0, duplicate groups 0; both Review modules remain enabled. Spaces 4, memberships 5, all module rows 6, Events 4, Tasks 5 and reminder deliveries 12 retained their pre-apply counts and row fingerprints. No automated suites or frontend build were rerun because the deployed artifact was the already verified exact SQL patch and the repo change is documentation-only.
- Remaining gate: local frontend Slice 2–4, integration and both acceptance fixes are not pushed or deployed. After frontend pre-deploy/push review and Vercel rollout, the user must perform the minimal authenticated date-chronology recheck; this backend rollout does not mark v0.1.14 closed.

## v0.1.14 回顾 Date Chronology Acceptance Fix — Local PASS

- Forward patch: `supabase/patches/2026-09-26-v0.1.14-review-date-chronology.sql`（147 行，SHA-256 `7adf5a8dfa34c0bfca8ab05b7b2467bcfe088d262c50213d6e24fbae939cb82f`）。它在事务内先拒绝 existing duplicate dates，再增加 named unique constraint、替换 create/correct RPC 并新增窄 previous-plan read RPC；没有 delete、truncate、自动改日期或重编号。
- 新增 `supabase/tests/2026-09-26-v0.1.14-review-date-chronology.test.sql`：**41/41 PASS**。覆盖 named date unique constraint、RPC ACL/search_path；Personal/Shared 同日第二篇拒绝且 entries 不增加；跨 Space 同日、同 Space 不同日期；9/26 先建、9/25 后补、9/27 再建的日期关系；占用日期更正原子拒绝与空闲日期成功；日期更正动态关系；Personal/Space 隔离；direct insert 唯一约束；立即上一篇无本人 entry 或空 plan 时不 fallback；leave/rejoin 与非 participant 拒绝。
- `supabase test db --local`：**12 files / 546 pgTAP assertions PASS**。`python3 supabase/tests/review-foundation-concurrency.py`：**4/4 PASS**，覆盖同 Space 同日并发恰好一成一败、无孤立 entries；不同日期均成功且业务顺序按日期；两项既有 module toggle race。`python3 supabase/tests/space-lifecycle-concurrency.py`：**9/9 PASS**。
- Targeted Node（review detail/history UI+data 与 schema/patch contract）：**21/21 PASS**；完整 Node：**312/312 PASS**；`npm run build`：**PASS**，保留既有 >500 kB bundle warning。schema/patch changed-function parity、forward-only/no-cleanup 静态检查 PASS。仓库无 lint script。
- Forward patch 仅应用到本地测试库。Production 未执行 preflight、清理或 patch；由于真实账号验收可能留下同 Space 同日重复测试 rows，Production rollout 前必须只读列出 exact review IDs，由用户确认后另行 exact-ID cleanup，完成 postflight 后才能应用唯一约束 patch。

## v0.1.14 回顾 Authenticated Acceptance Feedback Fix — Local PASS

- 用户已完成本地真实账号广泛验收并反馈两项 bounded UX 调整。本轮自动覆盖历史/详情无可见 `round_no`、日期身份、无障碍名称、0/1/47 authoritative exact count、游标分页不覆盖总数、Space 切换清空旧总数、创建成功进入 canonical 详情，以及「上一份计划」文案。数据读取仍通过 `review_rounds` 既有 participant RLS；无 SQL/RPC 改动。
- `node --experimental-strip-types --test tests/review-history-data.test.ts tests/review-history-ui.test.ts tests/review-detail-ui.test.ts`：**11/11 PASS**。完整 Node suite：**305/305 PASS**。`npm run build`：**PASS**；Vite 保留既有 >500 kB bundle warning。仓库无 lint script。
- 本轮未操作真实登录态、Production 数据或设备；用户只需执行 tiny recheck：历史/详情无「第 N 次」、Space 总数准确、文案为「上一份计划」、新建后回到历史总数更新。刷新浏览器回首页是已记录的未来 UX 事项，不属于本修正验收。

## v0.1.14 回顾 Frontend Integration / Pre-deploy Review — Local PASS

- 基线为 `main` HEAD `b1bb24741e19512720fc0efdc6acc6ec40fa5d0c`，相对 `origin/main` 领先三份 Slice 2–4 提交且检查前工作区干净。审查 Hub、独立 Space 选择、日期/编号游标历史、新建 canonical id、详情、上一轮计划、本人编辑/对方只读、日期更正、返回刷新、过期请求与失权路径。发现并修复底部导航绕过 dirty 确认；回归测试先红后绿。
- `node --experimental-strip-types --test tests/navigation.test.ts tests/review-detail.test.ts tests/review-detail-ui.test.ts`：**7/7 PASS**；全量 Node：**302/302 PASS**；`npm run build` 与 `git diff --check`：**PASS**。构建产物已核对仅指向关联的 Production Supabase 目标；生产依赖官方 npm 安全审计为 **0 漏洞**。Vite 的 >500 kB bundle 警告仍在，未阻断构建。
- Production 只读查询核对 `create_review_round`、`save_my_review_entry`、`mark_my_review_filled`、`correct_review_date` 及 `set_space_module_enabled` 的参数/返回类型/EXECUTE，回顾两表的列、RLS、SELECT 策略和直接写权限，以及授权函数体中的当前成员+当轮 participant 与模块条件；与本地前端所用契约一致。未查询用户回顾正文或执行任何写入。无 authenticated 浏览器/320px/桌面/设备手动验收结论；该部分由用户在本地 5175 前端执行。

## v0.1.14 回顾 Slice 4 — Responsive Detail Local PASS

- `node --test tests/review-detail.test.ts tests/review-detail-data.test.ts tests/review-detail-ui.test.ts tests/review-history-ui.test.ts tests/navigation.test.ts`: **12/12 PASS**。覆盖 participant snapshot 的本人/对方映射、Personal 单列、Shared 移动切换两 panel 持续挂载与桌面双列、只读四字段固定高度/框内滚动、历史打开与刚创建临时导航区别、同 Space 精确 `round_no - 1` 上一轮计划（无轮、无本人 entry、空白均无计划）、日期 RPC 精确参数/服务端结果/拒绝传播、返回 dirty 确认逻辑。
- `node --test tests/*.test.ts tests/*.test.js`: **301/301 PASS**；`npm run build`（TypeScript + Vite）、`git diff --check`: **PASS**。Vite 仍提示 bundle >500 kB，构建成功。仓库无 lint 或 React 交互测试脚本；SSR/静态检查不构成真实浏览器、320px、账号或设备验收。
- 详情重新聚焦刷新 RLS 可见轮次与对方内容，不重载已挂载的本人 editor；若 canonical 读取证明已失去访问条件，则移除正文。本人多端并发没有 backend expected-revision 参数，前端不声称冲突检测。日期更正返回历史后由历史组件重新挂载并读取 canonical 日期排序。上一轮计划只在刚创建的临时导航上下文中显示，失败不阻断当前轮编辑。
- Slice 4 不改 SQL/RLS/RPC/DB tests，Production backend 保持 Slice 1 PASS；Slice 2–4 本地前端未 push、未部署，Production 前端仍为 v0.1.13、没有回顾 UI。真实账号与设备 acceptance 未开始；下一步先做完整前端 integration / pre-deploy review 和 backend compatibility gate。

## v0.1.14 回顾 Slice 3 — History / Create Frontend Local PASS

- `node --test tests/review-history.test.ts tests/review-history-data.test.ts tests/review-history-ui.test.ts tests/navigation.test.ts tests/task-navigation-regression.test.ts`: **12/12 PASS**。覆盖 review module eligibility、缺行/关闭、Shared 单成员历史与双成员创建门槛、独立选择与失效纠偏、participant snapshot 状态、Slice 2 状态 helper、20 轮日期/编号游标分页、去重、精确创建 RPC 参数及服务端返回、错误传播、过期请求 guard、模块 owner/member 控件、Hub/历史初始静态结构和 Tasks 路径回归。
- `node --test tests/*.test.ts tests/*.test.js`: **293/293 PASS**；`npm run build`（TypeScript + Vite）和 `git diff --check`: **PASS**。Vite 报告既有 bundle >500 kB 警告，构建成功；仓库无 lint 或 React 交互测试脚本。
- 本地静态/SSR 验证没有真实登录、浏览器点击链或设备结论。History SELECT 依赖已部署的 participant RLS；列表读取四项正文列仅为复用 canonical「全空」状态判断，不展示正文。分页以 `(review_date DESC, round_no DESC)` 唯一游标加载（Space 内 `round_no` 唯一），并对跨页 ID 去重。后台日期更正等并发重排可通过页面刷新获取 canonical 顺序。
- Slice 3 未改 SQL、RLS、RPC 或 DB tests；Production backend 保持 Slice 1 PASS，Production frontend 仍是 v0.1.13，v0.1.14 用户真实账号/移动/PWA acceptance 未开始。完整详情、上一轮计划、日期更正 UI 属于 Slice 4；其后 authenticated acceptance 前必须执行 frontend/backend compatibility gate。

## v0.1.14 回顾 Slice 2 — Entry Frontend Local PASS

- `node --test tests/review-entry.test.ts tests/review-entry-data.test.ts`: **8/8 PASS**。覆盖 persisted 四状态、空白/常见空白字符、null 与空串的可见草稿比较、编辑后还原的 dirty 清除、已知 backend 拒绝文案、本人 participant 读取、精确 save/mark RPC 参数、服务端 canonical revision/时间返回、backend error、登录变化及异常响应 fail-closed。本机 Supabase 只读 SELECT 还核对了普通空格、制表符、不换行空格和全角空格的 PostgreSQL `[:space:]` 分类。
- `node --test tests/*.test.ts tests/*.test.js`: **284/284 PASS**；`npm run build`（TypeScript + Vite）及 `git diff --check`: **PASS**。仓库无 lint 脚本，也无 React 组件交互测试框架；因此本 Slice 没有组件自动交互或浏览器验收结论。
- 自审确认没有 Review 直接表写入、客户端 revision 推算、自动保存或新 backend primitive；组件未挂到导航。Production backend 仍为 Slice 1 PASS，用户可见 Production 前端仍为 v0.1.13，v0.1.14 真实账号/设备验收未开始。后续正式详情接入前仍须做目标 backend compatibility gate。

## v0.1.14 回顾 Slice 1 — Production Backend Rollout / Postflight PASS

- Exact forward patch: `supabase/patches/2026-09-26-v0.1.14-review-foundation.sql`（306 行，SHA-256 `41cb53b1e7c373e82dcf372261047fe066d5a395851d019456903b6d8d3abf34`）。Pre-apply read-only freshness confirmed absent Review objects, unchanged lifecycle/module definitions, and the previously recorded data baseline. `supabase db query --linked --file` executed the committed file once inside its own `BEGIN/COMMIT` transaction, exit 0 with no SQL error.
- Read-only structure postflight: `review_rounds` / `review_entries` have the canonical columns/defaults; 8 constraints include positive and unique Space round numbering, participant primary key, revision bounds and required cascade FKs. Four indexes, three enabled identity/updated-at triggers, two SELECT policies and RLS on both tables match the patch. `review_entries.user_id` has no FK to cascading membership rows.
- ACL/RPC postflight: both tables have only `authenticated=SELECT` among application roles; anon and service_role have no direct Review table grant, and authenticated has no direct business write or TRUNCATE. The read helper and four write RPCs are `SECURITY DEFINER`, hardened `search_path`, and authenticated-only EXECUTE. Their function-body MD5s, both identity guard bodies, and the owner-only Tasks/Review module toggle body match the committed patch; no role-inheritance bypass was found. Module toggle retains its existing Tasks behavior and authenticated EXECUTE.
- Data comparison (pre-apply → postflight): Spaces **4→4**, memberships **5→5**, module rows **4→4**, Events **4→4**, Tasks **5→5**, reminder ledger rows **12→12**. Full-row MD5s were identical for Spaces `aed85fac9990b7bd21a1e8a7ac9a7083`, members `1ee9d2977ed5b63dddfc0a0431c1f9a5`, modules `3c7ac0cb0158f36f7e29388841f041f5`, Events `0d70932bf90dbf8607cbd9e0fef3be2d`, Tasks `ae266f6c38e6e20578b702adcaf2e7dc`, and reminder ledger `9285103ed2b4f055cc7f1dc03c667317`. Space invite fingerprint also matched. Review rounds, entries and `review` module rows remain **0**; no Production test data was created.
- Four existing lifecycle function fingerprints remained unchanged. Deployed create/read/write definitions retain Space advisory + row lock ordering, `max(round_no)+1` with unique fallback, current membership plus historical participant checks, own-entry mutation, module enablement, same-content revision stability and blank-entry mark rejection. Production mutation RPCs and lifecycle actions were not invoked for testing. The pre-existing `touch_updated_at()` `:=` syntax variant remains unchanged.
- Slice 1 Production backend: **PASS**. v0.1.14 frontend and authenticated/device acceptance: **NOT STARTED**; version overall remains in development. Slice 2 will reuse deployed `save_my_review_entry` and `mark_my_review_filled` rather than recreate backend primitives.

## v0.1.14 回顾 Slice 1 — Backend LOCAL PASS / Production Preflight PASS (pre-rollout checkpoint)

At this pre-rollout checkpoint, the canonical contract was [v0.1.14 回顾规格](./v0.1.14_STRUCTURED_CHECKIN_SPEC.md). The one-time forward patch had been applied only to the local Supabase test database; Production was still at the v0.1.13 backend baseline.

- `supabase test db --local`: **11 files / 505 pgTAP assertions PASS**. The new review file contributes **117 PASS** across schema/FKs/constraints, Personal and Shared eligibility, direct API ACL, RLS isolation, revisions/blank marking, date correction, module disable/re-enable, leave/remove/rejoin, transfer and Space deletion. Existing module and lifecycle regression files also pass.
- `python3 supabase/tests/review-foundation-concurrency.py`: **3/3 PASS** for concurrent create assigning rounds 1/2, disable-first rejecting create, and create-first retaining history before disable. `python3 supabase/tests/space-lifecycle-concurrency.py`: **9/9 PASS**.
- SQL review: the review foundation, module toggle and RPC ACL blocks in `schema.sql` and the forward patch match. The patch creates new objects and narrowly replaces `set_space_module_enabled`; it does not reset, truncate, backfill or delete existing business data. No frontend/build, Production write, or authenticated browser/device test was run for this backend-only slice; the Production read-only preflight is recorded below.

- Production READ-ONLY preflight: **PASS**. Production 的 v0.1.13 schema 与 patch assumptions 兼容；review tables/functions/policies/triggers/index 不存在，`space_modules` 已允许 `review` 且当前 review rows 为 0。4 个 Space、5 条成员关系无 owner/capacity/member anomaly；lifecycle definitions 与 repo canonical 一致。RLS/ACL/RPC boundaries、并发锁前置条件、existing-data safety、schema/patch parity 均通过，blockers 为 `None`。
- Preflight 只读记录：4 Spaces、5 memberships、4 Tasks-module rows、4 Events、5 Tasks、12 reminder ledger rows；Production 未发生写入，数据检查未发现 blocker。回顾 patch 尚未应用，Production backend 仍为 v0.1.13。
- Next checkpoint: 在 Slice 1 implementation 与 preflight 记录推送后，按独立授权应用唯一 forward patch 并执行 read-only Production postflight。前端和 authenticated/device acceptance 尚未开始。

Before any later real-login/two-account/mobile/PWA acceptance, run the frontend-target/backend-capability compatibility gate. The user performs authenticated/device acceptance.

## v0.1.13 Final Regression + Closeout — CLOSED / PASS

- Focused lifecycle/Space Management regressions: **46/46 PASS**. Full Node suite: **276/276 PASS**. `npm run build` and `git diff --check`: **PASS**.
- Read-only Production checks: Vercel deployment `6662531970` for source `c08e9f1bd2d583a65fb42d68588b531ca6e0216c` is `success`; the public entry and current JavaScript/CSS assets returned HTTP 200. Supabase catalog confirmed all four lifecycle RPC signatures and authenticated-only EXECUTE grants with hardened function configuration. No Production mutation occurred.
- **User-reported authenticated real-account, mobile and installed-PWA acceptance: PASS.** Codex did not operate login, OTP/Magic Link, authenticated sessions or PWA and did not repeat the user's acceptance.
- v0.1.13, Slice 1 and Slice 2 are `CLOSED / PASS`. No further real-account acceptance is requested by this closeout.

## v0.1.13 Slice 2 — State review correction

- New automated cases cover leave/delete success clearing selection and detail before a delayed/failed list refresh, persistent selection removal scoped to the current user, remove/transfer retaining detail, RPC rejection retaining selection pending canonical refresh, and Calendar/Task eligibility fallback for an invalid filter target. Focused Node: 46/46 PASS; full Node: 276/276 PASS; `npm run build` (TypeScript + Vite) and `git diff --check`: PASS.
- The lifecycle result path does not write Calendar or Task filters. Existing filter normalization may choose `all` when its target becomes ineligible. Real-account/device acceptance remains user-owned and pending.

## v0.1.13 Slice 2 — Local UI review checkpoint

- Focused Node 8/8 and full Node 271/271 pass. Tests cover Personal/Shared role controls, other-member target validation, four exact RPC names/arguments, canonical pre-submit recheck, stale/error rejection, confirmation and duplicate-submit guards, list/detail refresh, and absence of lifecycle filter mutation. Existing Space Management regression remains in the focused run. `npm run build` (TypeScript + Vite) and `git diff --check` pass.
- At this local review checkpoint, real-account acceptance was pending. Before that later acceptance, the four deployed RPC signatures/grants and backend alignment were checked read-only. The user subsequently reported all real-account, mobile and PWA acceptance passed; see the final closeout above. Codex did not operate any real-account session or PWA.

## v0.1.13 Slice 1 — CLOSED / PASS

- Local database: `supabase test db --local` passed all 10 files / 388 pgTAP tests, including lifecycle, existing Event/Task/recurrence/reminder/RLS regressions. `python3 supabase/tests/space-lifecycle-concurrency.py` passed 9/9 two-session orderings. `node --test tests/*.test.ts tests/*.test.js` passed 266/266; `npm run build` and `git diff --check` passed.
- ACL gate: `has_table_privilege` is false for `TRUNCATE` on `profiles`, `spaces`, `space_members`, `events`, `event_occurrence_exceptions`, and `tasks` for each of `anon`, `authenticated`, `service_role` (18 checks). Actual `TRUNCATE ... CASCADE` attempts as application roles fail with `42501`. Other privileges and unrelated table ACLs are unchanged.
- Slice 1B Production preflight passed: 4 Spaces, 5 members, zero owner/capacity/Event reference anomalies, expected dual membership FKs, four lifecycle RPCs absent, 5 sent historical orphan reminder rows, and aligned trigger/function/RLS/ACL state. Only the reviewed Slice 1A forward patch was applied.
- Production postflight passed: four authenticated-only lifecycle RPCs, restricted deletion helper, valid owner index, five enabled new triggers, 18 denied app-role TRUNCATE privileges, unchanged FK/RLS/policy state, and exact preflight/postflight counts and fingerprints for Space/member/Event/exception/Task/module/subscription/reminder data. All 12 reminder ledger rows, including 5 sent historical orphans, remain unchanged. Reminder scheduler has one active job, with 60 successful and zero failed runs in the previous 60 minutes. No Production test fixtures were created; Slice 2 UI and authenticated browser acceptance remain outside this rollout.
- Acceptance: `v0.1.13 Slice 1 — CLOSED / PASS`. Next Action: Slice 2 Space Detail lifecycle controls, beginning with the frontend/backend compatibility gate.

## v0.1.12 Slice 4 — Final Regression + Production/PWA Acceptance (CLOSED / PASS)

- Final release gate on accepted commit `9847a0761e117234e10e219ec9c8d4bae25a850e`: full applicable Node suite **266/266 PASS**, `npm run build` **PASS**, and `git diff --check` **PASS** with a clean tree. GitHub recorded the commit as the latest successful Vercel Production deployment. The public app shell, JavaScript, CSS, manifest, and service worker returned HTTP 200; the public bundle contained the new navigation and Tasks markers. The frontend target matched the previously verified Supabase host; no backend change or migration was required.
- **Final authenticated Production and installed-PWA acceptance: PASS (user-reported).** This closes Slice 4 and v0.1.12. Codex did not operate a real-login session or the installed PWA. Dedicated iPhone Safari acceptance is not separately claimed. The accepted structure is 首页 / 日历 / 功能中心 / 我的; 功能中心 contains only 任务; Tasks aggregate eligible Spaces with all/single filter, canonical actions and scoped Realtime; 我的 → 空间管理 provides Personal/Shared details. Space remains the canonical ownership boundary.
- Accepted deferred items: unified UI visual refinement, unused `MemberSheet.tsx` cleanup, `space_modules` Realtime, and Calendar all-Space create. They are not v0.1.12 blockers.

## v0.1.12 Slice 3 — One-time Navigation Switch + Aggregate Tasks UI (CLOSED / PASS)

- Automated scope: exactly four primary tabs with 功能中心 replacing 空间; Tasks-only Module Hub; independent eligible-Space taskFilter, invalid-filter normalization, complete all/single-Space Task reads, source `space_id` identity even for duplicate names, Open/Completed filter retention, Personal/single-Space create defaults and disabled-Personal safety, canonical Task actions, per-Space Realtime scope/cleanup, stale-response guard, old Hub retirement, and Home/Calendar/My regressions. Pre-closeout Slice 3 focused Node tests `24/24`, full Node suite `266/266`, form/UI retest `7/7`, post-review create tests `5/5`, `npm run build`, `git diff --check`, and unauthenticated local `5175` HTTP `200` passed. Final closeout rerun: focused tests `19/19`, full Node suite `266/266`, `npm run build`, and `git diff --check` all PASS. Static 320px/390px previews covered the four tabs, Hub, Task rows/filter, and Sheet; Production device behavior remains for Slice 4 acceptance.
- Read-only readiness gate: the local frontend target matches the linked Supabase project. The linked backend has Task and module tables, member SELECT, Task member CRUD guarded by Tasks enablement, the status-owner trigger, and Task Realtime publication with replica identity FULL. No schema, RPC, Edge Function, or backend deployment change is required. Codex did not operate a real-login session.
- **User-run local authenticated acceptance: PASS (user-reported).** The user verified the implemented Slice 3 functionality and reported it working. This closes Slice 3 functional acceptance; Codex did not operate the authenticated session. The accepted scope is 首页 / 日历 / 功能中心 / 我的; Tasks-only Hub; aggregate Personal/Shared Tasks, source labels, all/single eligible-Space filter shared by Open/Completed, safe create targets and canonical mutations, and preservation of Home, Calendar and My → Space Management.
- Slice 4 is `NEXT` for final regression, environment/deployment readiness, and Production/iPhone/PWA acceptance. No Slice 3 Production or device acceptance is claimed by the local PASS.

## v0.1.12 Slice 2 — My → Space Management → Space Detail (CLOSED / PASS)

- Automated scope: My entry and existing profile/notification/logout structure; Personal/Shared list and duplicate-name distinction; Personal/Shared detail boundaries, roles, invite controls and owner/member Tasks switch; management and legacy create/join reuse; selected Space separation from Calendar/Task filters; old four-tab and Hub regressions. Existing `space-selection`, `space-modules`, navigation, Task, Home and Calendar tests remain applicable. The v0.1.10 SQL test retains the disable → Task rows preserved → re-enable and owner/member authorization assertions.
- Local results: focused Node regressions **61/61 PASS**; full Node suite **261/261 PASS**; `npm run build` and `git diff --check` **PASS**. The existing Vite server serves this repository on fixed port `5175`; an unauthenticated `http://127.0.0.1:5175/` check returned **HTTP 200**. These are automated/static checks, not authenticated browser acceptance.
- Read-only backend gate: local frontend target matches linked Supabase. Linked catalog confirms `spaces`, `space_members`, `space_modules`, `tasks`, `ensure_personal_space()`, `create_space_with_invite(text)`, `join_space_by_invite_code(text)`, `rotate_invite_code(uuid)` and `set_space_module_enabled(uuid,text,boolean)` exist. Linked `space_members`/`space_modules` RLS, module SELECT and RPC EXECUTE grants, owner-only toggle guard, and Personal invite-code guard also passed. No backend change is required. No login, OTP, authenticated browser session or Production write was performed by Codex.
- **User-run authenticated acceptance: PASS (user-reported).** The accepted functional scope covers 我的 → 空间管理; Personal and Shared Space lists and details; member/role display; invitation-code behavior; Tasks module toggle; create/join reuse; `selectedSpaceId` limited to management/detail responsibility; and keeping the old Space Hub temporarily for the Slice 3 transition. No authenticated session was operated by Codex.
- UI visual refinement is intentionally deferred to a later unified UI/design pass and is not a Slice 2 blocker. Slice 2 is `CLOSED / PASS`; v0.1.12 remains `IN PROGRESS` with Slice 3 next.

## v0.1.11 Slice 4 — Home Quick Create / Global Create Safety (CLOSED / PASS)

- Automated verification: focused Slice 4 tests **10/10 PASS**; full applicable Node suite **246/246 PASS**; `npm run build` and `git diff --check` **PASS**. Previous unauthenticated local HTTP check on `http://127.0.0.1:5175/` returned **200**.
- 只读环境 gate：本地前端配置目标与 linked Supabase 项目一致；linked backend 中 `spaces`、`space_members`、`events`、`tasks`、`space_modules`、Personal 初始化及模块检查 RPC 存在。Event/Task/module RLS 开启，Event/Task insert policy、Event owner trigger、Task assignee 外键及模块 SELECT 权限已核实。现有 v0.1.10 后端能力与这次纯前端新增入口兼容；没有后端 rollout。检查只返回能力布尔值，没有输出环境变量、凭据或业务行。
- **用户报告真实账号 Desktop 本地验收 PASS：**首页标题无旧创建按钮；“近期日程 +”和“需要处理的任务 +”分别直达对应表单；日程与任务默认目标均为 Personal Space，并能主动切换 Space。日程、任务分别切换到 Shared Space 后，二次确认的目标、首页即时摘要、目标 Space 内对象和实际归属均正确。关闭 Personal Tasks 后没有自动转存 Shared，须主动选已启用任务模块的 Space。取消二次确认后草稿保留且没有记录；确认阶段关闭后重开没有残留确认状态；快速连续确认只产生一条记录。日历单 Space 日程 `+` 仍按当前筛选 Space 直接保存；空间任务“新建任务”仍在当前 Space 直接保存。结果由用户执行并报告，Codex 未操作真实登录态。
- **Production installed PWA acceptance: user-reported PASS.** The Production URL served the Slice 4 frontend at commit `f916dc0f0a1962facca44f4174241031b4f44bf2`. User confirmed the final Home entries and direct forms, successful Event and Task creation, Personal default and Shared target selection, correct confirmation and saved ownership, immediate Home refresh, normal layout, no evident safe-area/keyboard/overflow/blocking issue, normal top-level navigation, the single-Space Calendar Event `+` regression, and no white screen, hang, or obvious interaction regression. Codex did not operate the authenticated session or the installed PWA.
- **Dedicated final iPhone Safari acceptance: `NOT RUN`.** Do not mark Safari `PASS` or infer it from the installed PWA result. This is not a Slice 4 blocker; the user's final Production mobile acceptance was completed in installed PWA. No local 5175/LAN phone acceptance was performed.
- Combined with the Desktop results above, the user-reported manual acceptance for Slice 4 is `PASS`. The additional Desktop checks include disabled Tasks with no Shared fallback, cancel without a write while retaining the draft, close/reopen clearing confirmation state, duplicate-submit protection, and direct local Calendar/Space create regressions.

## v0.1.11 Slice 3 — Home Aggregation (CLOSED / PASS)

- Focused Home tests cover the three local calendar days, same-day all-day ordering, old recurring sources, moved-in override, only-this deletion, this-and-future child identity, a later-Space read failure, Task overdue/today/seven-day/undated ordering and assignment exclusions, disabled/missing/error module handling, plus section loading/empty/error and five-row expand/collapse. The navigation regression covers the module re-read state/render sequence and Tasks/Completed fallback contract. Existing calendar-refresh tests cover reused dirty-read, burst, pause/stop and retry guards.
- Final applicable Node suite `node --test --test-reporter=tap tests/*.test.ts tests/*.test.js`: **236/236 PASS**. `npm run build` and `git diff --check`: **PASS**. Environment alignment passed earlier for this frontend-only Slice; no backend rollout is needed.
- User-reported authenticated manual acceptance: **PASS** on desktop, Vercel Production, iPhone Safari, and installed PWA. The four tabs, Home default, Home leave/return, narrow viewport, and Space → Tasks navigation fix passed.
- Event acceptance: **PASS** for Personal + Shared aggregation and source Space labels; three-day window; same-day all-day-before-timed ordering; five-item default with expand/collapse; Home Event opening the canonical Event Sheet; ordinary Event editing; and the existing recurrence flow.
- Task acceptance: **PASS** for eligible cross-Space aggregation and ordering (overdue → today → future within seven days → no due date); no-due inclusion; assigned-to-other and >7-day exclusion; five-item default with expand/collapse; Home Task opening the canonical Task Sheet; editing/completing; and Tasks module disable/re-enable. A/B Event and Task Realtime passed.
- Production deployment and device acceptance: **PASS** (user-reported); Production includes Slice 3. Codex did not operate authenticated sessions or perform the user-run browser/device acceptance.
- **NOT RUN / DIFFICULT TO SIMULATE SAFELY:** independent Event/Task section error/retry under real backend/network failures; no failure was deliberately induced. Second Shared Space is **N/A / NOT RUN**; no extra Space was created. These are unrun coverage, not PASS claims or blockers.

## v0.1.11 Slice 2 — Aggregate Calendar (CLOSED / PASS)

- Focused Node tests cover all/one filter and `selectedSpaceId` separation, Personal/Shared labels and member context, same-title/time Event identity, multi-page Event reads, bounded/multi-page exception batches, duplicate/count/Space checks, fail-closed aggregate reads, mixed-Space recurrence/only-this override/delete/this-and-future, projection error display, dirty/stale request invalidation, debounce, teardown, and refresh retry. Existing Space/Hub static regression remains green.
- Final focused Node tests 16/16 PASS; full applicable Node suite `node --test --test-reporter=dot tests/*.test.ts tests/*.test.js` 228/228 PASS. `npm run build` and `git diff --check` PASS. These are local automated/static results, separate from the user-run acceptance below.
- Read-only integration gate: the configured local frontend URL matches the linked Supabase project. Linked Production catalog confirms existing `spaces`, `space_members`, `profiles`, `events`, `event_occurrence_exceptions`, Event/exception RLS, four recurrence RPC names, Event Realtime publication and FULL replica identity. No backend rollout is needed for this frontend-only Slice. No authenticated browser, OTP, A/B, iPhone or PWA session was operated by Codex.
- User-run local authenticated functional checks 1–10: **PASS**. Coverage includes default all with Personal/Shared aggregation, source and owner labels, all/single create and explicit target, Hub → 查看日历, Shared-Space personal Events and permissions, recurrence with ONLY-THIS / THIS-AND-FUTURE, A/B Realtime, filter switching, stale-data behavior, refresh/re-entry and basic recovery. Today previous/next day, Week previous/next week, Month previous/next calendar month across year boundaries, and the corresponding current-period actions passed manual revalidation. Calendar Header UI is frozen.
- User-run bounded Production smoke: **PASS**. Production showed the Slice 2 frontend; default aggregate and source labels, all/single create behavior, Event open/edit Space context, Today/Week/Month navigation and current-period actions, Hub → Calendar single-Space filter, rapid filter switching without stale Space data, and A/B Realtime create/update/delete passed. This was user-performed acceptance; Codex did not operate authenticated sessions.
- Slice 2 is **CLOSED / PASS**. No backend rollout was required or made because this Slice is frontend-only. Dedicated Slice 2 check 11 iPhone Safari, 12 installed PWA and 13 final 320px device acceptance remain **DEFERRED / NOT RUN**; check 14 second Shared Space remains **N/A / NOT RUN**. These are coverage limits and are not PASS claims or blockers.

## v0.1.11 Slice 1 — Final Review, Production Rollout and Post-Deploy Acceptance (CLOSED / PASS)

- User-run local authenticated desktop checks: **PASS** for default Calendar; only `日历 / 空间 / 我的` and no Home; Personal and existing Shared Space list/current marker/create/join entries; Shared → Personal and Personal → Shared list→Hub→Calendar flows; members/invite/Tasks module; remembered selection after refresh without cross-Space pollution; Open/Completed Tasks; Tasks disable hiding the business entry and re-enable restoring the entry and original data; My display-name edit with refresh persistence and restored original name; this-device notification settings; logout to login, refresh staying logged out, and relogin without old navigation or Space state leakage. These are the user's results, not Codex-driven sessions.
- Full applicable automated suite: `node --test --test-reporter=dot tests/*.test.ts tests/*.test.js` — **213/213 PASS**. `npm run build`, implementation `git diff --check`, and final diff/code review — **PASS**. Review found no off-scope business query, Task architecture, backend, dependency or Home/aggregation/filter/global-create change. The Project State headings, exact no-blocker text and Version Index were checked.
- Production rollout: **PASS**. The user confirmed the official Production URL `https://cross-platform-shared-calendar.vercel.app/` displays the new Slice 1 three-item navigation after implementation commit `3bc8d89642c687998acef17b3f1ef064baea2358` and Project State freshness commit `885fe901a9304f1a36c290324e845aa1031612f9` were pushed. This rollout changed frontend navigation only; Slice 1 made no backend/schema/RPC or dependency changes.
- Desktop authenticated acceptance: **PASS**. Default Calendar; only `日历 / 空间 / 我的` and no Home; Personal/Shared list, selected Space marker, both switch directions, list→Hub→Calendar, remembered selection after refresh without cross-Space pollution; Open/Completed Tasks; disable/re-enable hiding/restoring the entry with data intact; My display-name edit and refresh persistence with original name restored; device notification settings; logout, refresh while logged out, and relogin without stale navigation/Space state. User performed the checks; Codex did not operate authenticated sessions.
- Post-deploy iPhone Safari acceptance: **PASS** for three-item navigation, Personal ↔ Shared, Event Sheet, Task Sheet, safe area and bottom-navigation clearance. Installed PWA acceptance: **PASS** for the same navigation and Space flows, safe area/bottom navigation, and Event/Task Sheets.
- At the Slice 1 closeout, overall v0.1.11 remained `IN PROGRESS` and Slices 2–4 had not started. No Slice 2 acceptance was included in this Slice 1 record.

## v0.1.11 Slice 1 — Navigation Foundation (LOCAL AUTOMATED PASS)

- Local implementation displays only `日历 / 空间 / 我的`. Calendar remains scoped to the validated concrete `selectedSpaceId`; Space list/create/join leads to the existing Hub; Tasks/Completed remain inside the Space domain; My contains display name, this-device notifications and logout. Home, aggregation, filter and global create are not implemented.
- `node --test --test-reporter=dot tests/*.test.ts tests/*.test.js`: 213/213 PASS. This includes navigation state, static Calendar/Hub/Space/My UI, existing invalid selected-Space fallback, ensure failure degradation, stale request guards, Personal/Shared Event identity, Tasks module/Realtime, recurrence, Reminder and Push regressions. `npm run build`: PASS. Static review confirms 320px minimum width, `viewport-fit=cover`, bottom safe-area spacing, 48px navigation controls, and Sheets above the bottom nav. The subsequent authenticated iPhone/PWA verification is recorded above.
- Environment readiness: the local frontend URL matched the linked Production Supabase project without printing credentials. Linked Production read-only catalog checks confirmed the required tables, all 11 frontend RPC names, RLS on required tables, and Event/Task Realtime publication. No new backend dependency or first-run write was introduced by Slice 1; the later Production frontend rollout is recorded above.
- At the initial `MANUAL_AUTH_ACCEPTANCE_CHECKPOINT`, desktop acceptance had not yet been performed; its subsequent PASS is recorded above. The later post-deploy iPhone Safari and installed PWA checks also passed as recorded above. Codex does not operate real OTP/Magic Link, A/B authenticated sessions or authenticated PWA. No Slice 2 aggregation acceptance is included.

## v0.1.11 Design Freeze — verification and future acceptance boundary

At the Design Freeze checkpoint, the [canonical specification](./v0.1.11_NAVIGATION_AGGREGATION_SPEC.md) was frozen before any v0.1.11 business code, authenticated acceptance or deployment. That docs-only update required `git diff --check` and governance/status review, not a frontend build. Each implementation slice requires focused tests and `npm run build` before its checkpoint.

Before any user-run authenticated test, Codex must verify the local frontend's actual backend target, required Production schema/RPC/Realtime capabilities and frontend/backend compatibility. The user, not Codex, performs OTP/Magic Link, A/B browser, iPhone/Android and PWA authenticated acceptance. Slice 2 can use Personal plus the existing Shared Space to test aggregate/all/one/isolation; record Shared ↔ Shared as `N/A` if no second Shared Space already exists. Do not create one in Production merely for acceptance. Slice 1 Home remains invisible until Slice 3 gives it all-Space semantics; Slice 4 must verify zero enabled Task targets before opening a Sheet.

## v0.1.10 Slice 3 — Tasks Module Enablement + UI Text Closeout (CLOSED / PASS)

- Focused frontend tests: `node --test tests/task.test.ts tests/space-request-guard.test.ts tests/space-ui.test.ts tests/space-modules.test.ts` — 20/20 PASS. Coverage includes true/false/absent/error module reads, ordered RPC-then-authoritative-refresh, RPC versus refresh failure, duplicate toggle blocking, stale cross-Space module response, Personal/Shared owner controls, Shared member read-only display, enabled/disabled/error Hub entry visibility, safe Hub rendering for blocked Tasks/Completed screens, delayed mutation completion after Task read-gate deactivation, and Chinese user-facing Task-domain errors across uppercase/lowercase variants.
- Full Node suite: `node --test tests/*.test.ts tests/*.test.js` — 212/212 PASS. `npm run build` and `git diff --check` PASS. Final read-only review passed. Source review confirms Tasks list/Realtime setup occurs only when enabled, toggle-in-progress hides the business entry, blocked state remounts the Tasks area to close sheets and discard local cache, and inactive `TasksArea` cannot start a new old-Space Task read or continue pagination. The existing database remains the mutation authority. Static/pure tests cannot establish real browser layout, authenticated state transitions, or Production data retention.
- Implementation commit `d14b73f898b3015564960a91c4e17035ee0f8272` reached Vercel Production deployment `6630561119` with `success` status and matching source SHA. The public URL and active JS/CSS assets returned HTTP 200; the unauthenticated login entry rendered without an observed initialization failure. Active JS contained the Slice 3 module state/toggle, disabled-state, and Chinese Task markers. Linked read-only SQL returned 4 Spaces, 4 Tasks enabled, 0 disabled, and 0 missing module rows. At deployment verification time, no Production module toggle or authenticated session was used; the user's later authenticated acceptance is recorded below.
- This Slice adds no `space_modules` Realtime publication. Another member's already-open page may temporarily display old state; refresh or re-entry reads the current row. Database RLS rejects Task mutations while disabled. Before the first real toggle, users must close/refresh old Production tabs and fully restart PWA runtimes; a still-running Slice 2 bundle continues showing the Tasks business entry even after the backend rejects disabled writes.

### User-run authenticated Production acceptance — PASS

- Personal Space owner disabled Tasks after preparing one Open and one Completed Task. The business entry and pending count disappeared while module management stayed visible; the owner re-enabled Tasks, both original rows and their contents/status returned, and edit / complete / reopen / delete worked.
- Shared Space owner disabled and re-enabled Tasks; the business entry disappeared and original Task data returned. Shared member had no toggle; refresh/re-entry showed the owner's current module state.
- Personal and Shared module states remained isolated during Space switching. iPhone/PWA module panel and basic disable/re-enable operation passed without an obvious layout or interaction issue.
- Known characteristic / future consideration: a Shared member who already has the Space open does not receive an immediate module-state update because `space_modules` is not published to Realtime. The old page may temporarily show the Tasks entry; refresh/re-entry updates it, while database policy immediately rejects disabled mutations. This is not a Slice 3 failure and does not reopen v0.1.10.
- The user performed the authenticated acceptance. Codex did not operate Magic Link / OTP or a user session. No module-state Realtime change is included.

### Acceptance coverage completed by the user

The acceptance above covered Personal and Shared owner disable/re-enable, Open/Completed history restoration and CRUD, Shared member read-only state and refresh, Personal/Shared module isolation, and iPhone/PWA behavior. The user completed these checks after closing or refreshing old Production tabs and restarting PWA runtimes.

## v0.1.10 — Personal Space + Multi-space + Module Enablement Foundation (CLOSED / PASS)

Slice 1: `PRODUCTION BACKEND ROLLOUT PASS`; Slice 2: `CLOSED / PASS`; Slice 3: `CLOSED / PASS`. This closes v0.1.10. Shared Spaces retain the two-member cap. Cross-Space aggregation, final four-destination navigation, global `+`, Lists / Important Dates / Review implementation, and module-state Realtime remain deferred. Next: v0.1.11 Navigation + Aggregation Experience — Scope / Architecture Audit (`NOT STARTED`).

## v0.1.10 Slice 2 — Selected / Current Space Vertical Flow (CLOSED / PASS)

Status at Slice 2 closeout: Slice 1 backend `PRODUCTION BACKEND ROLLOUT PASS`; Slice 2 `CLOSED / PASS`; its authenticated Production acceptance `PASS` and frontend rollout `PASS`. Slice 3's final review, Production rollout, and authenticated closeout are recorded above. This closes Slice 2 only, not the full v0.1.10 foundation.

### User-run authenticated Production acceptance — PASS

The user completed acceptance in real Production browsers and on iPhone/PWA after the compatible Slice 2 frontend was deployed. Codex did not open or operate Magic Link/OTP, enter credentials, or control any authenticated user session.

- Bootstrap and Space isolation: A's Personal Space was automatically created at login; A initially remained in the original Shared Space and could switch Shared ↔ Personal. Personal Calendar showed no Shared Calendar data. B's first-upgrade/default behavior and Personal Space behavior passed; A and B could not see each other's Personal Space. A/B remembered Space selections remained isolated, valid selection restored after refresh, and no random Space selection was observed.
- Personal Events: the audience selector (“我的 / 对方 / 共同”) was absent. Create, edit, and delete passed for A and B; Personal Events did not leak into Shared Space.
- Personal Tasks: assignment selector was absent. Create, edit, complete, Completed Tasks list, reopen, and delete passed for A and B; Personal Tasks did not leak into Shared Space.
- Shared behavior and live updates: Shared Event and Task regression passed; A/B Realtime passed. Rapid Shared ↔ Personal switching showed no cross-Space data in Calendar, Tasks, or members, no stale response repopulation, no Realtime leakage, and no white screen or endless loading. Shared create/join entry points and existing behavior had no observed issue.
- Devices and layout: 320px layout and iPhone/PWA smoke passed.

### Scenarios not run (N/A; not failures)

- Sheet-open Space switch: `N/A — current modal/sheet UI prevents Space switching while the sheet is open`. The user could not operate the Space selector with an Event or Task sheet open. This is not a Slice 2 blocker. The existing `selectedSpaceId` change → sheet reset/close behavior remains as defensive protection; no UI change was made for this scenario.
- Shared ↔ Shared switching: `N/A — no current acceptance account has two Shared Spaces`. The user did not create an extra real Shared Space for testing. Existing local automated logic and the `selectedSpaceId` contract remain the evidence for selecting between multiple Shared Spaces; this scenario is not reported as a real Production test.

No other failure was reported. The real-user acceptance above is distinct from local automated verification and the prior unauthenticated deployment checks.

### Automated and deployment verification

- Focused frontend Node tests: 19/19 PASS. Mocked bootstrap covers ensure-before-list order, Shared-first and Personal-only defaults, valid/stale remembered selection, user A/B storage isolation, ensure failure with readable Shared Space, list failure, no readable Space, explicit retry preserving current Shared selection even without device storage, ambiguous RPC response with a readable Personal Space, and Shared create/join result selection. Request-guard tests cover Shared A → Personal → Shared B with late Event/Task/member responses and newer same-Space refresh. Static rendering checks Personal/Shared form controls and selector entries.
- Full Node suite: 204/204 PASS. `npm run build`: PASS. `git diff --check`: PASS. Source review confirms the old one-Space `.limit(1).maybeSingle()` lookup is gone, current content follows membership-validated `selectedSpaceId`, both Event/Task Realtime channels are removed on unmount, and old requests are invalidated.
- Implementation commit `d7e13e1d81472bfee956920e232c443f15f042e5` reached Vercel Production successfully. The public alias and its Slice 2 JS/CSS assets returned HTTP 200; unauthenticated login entry loaded and the active JS contained the Space-switch and Personal bootstrap identifiers. Post-deployment read-only counts were 2 Spaces, 3 memberships, and 0 Personal Spaces before user acceptance. The docs-only redeployment also succeeded with the same frontend JS/CSS assets.

## v0.1.10 Slice 1 — Data / Permission Foundation (PRODUCTION BACKEND ROLLOUT PASS)

- The guarded forward patch was applied to the existing local Supabase test database and, exactly once without repair, to an isolated disposable replay database built from commit `08bec32f`'s v0.1.9 `schema.sql`. A second disposable database used the current fresh-install schema. Only the replay database received synthetic old data: one Shared Space with owner/member and invite, a shared Reminder Event, a Shared-Space personal Event, an open unassigned Task, and a completed assigned Task. Full-row snapshots of Space, membership, Event, and Task records matched after migration; the old Space became `shared`, gained `tasks=true`, kept its invite code, and no Personal row was created.
- Transactional post-patch checks in the replay database passed for multi-Space create/join, Shared two-member cap and duplicate rejection, idempotent Personal ensure and sole-owner guards, Personal invite/identity/Event restrictions, module owner/member privileges, cross-Space isolation, disabled Task SELECT and every mutation class, and re-enable restoration. Fresh-install versus migrated schema matched on 210 relevant catalog records covering columns, constraints, indexes, triggers, RPC definitions, RLS policies, effective table/function privileges, and Event/Task Realtime publication. These isolated databases used minimal local Supabase Auth prerequisites and synthetic users; they are not Production evidence.
- Focused pgTAP: 58/58 PASS. It covers legacy Shared defaults, multiple Shared memberships, Personal ensure idempotence and uniqueness, sole-owner membership guards, invite rejection and direct Personal invite-code update denial, Personal Event/Task rules, module owner/member privileges, absent/disabled module state, disabled Task create/edit/complete/reopen/reassign/delete, historical SELECT and re-enable, and cross-Space isolation. True concurrent `ensure_personal_space()` calls were not executed; the RPC uses a per-user transaction advisory lock plus the partial unique index.
- Full local database regression: 330/330 PASS across nine files. Full Node suite: 185/185 PASS. `npm run build` and `git diff --check`: PASS. The two task-created disposable databases were removed after verification; the existing local Supabase database and its volume were not reset or deleted.
- Production READ-ONLY preflight passed on PostgreSQL 17.6; just before rollout, the linked project and clean Git baseline were reconfirmed and v0.1.10 objects were still absent. The final `supabase/patches/2026-09-23-v0.1.10-multispace-foundation.sql` ran once in its own transaction on Production project `ximazjhxvmktpcdbypka` with no repair. Immediate postflight counts were unchanged: Spaces 2, memberships 3, Events 13, Tasks 0. Deterministic aggregate MD5 fingerprints were unchanged: Spaces `0d5796080933486b18088101f207b796`, memberships `6b540934b983d14453a6067fddb81a92`, Events `65ab2e25e6fdb04d7a79106fac9963e9`, Tasks `d41d8cd98f00b204e9800998ecf8427e`, invite data `ebffddcb4872beb5bf702b34caf85060`. No user content or invite code was printed.
- Postflight confirmed 2 old Shared Spaces with `tasks=true`, Personal Space count 0, absent one-user-one-Space index, valid partial Personal unique index, no `UNIQUE(kind, created_by)`, expected module PK/FK/check and RLS, member SELECT without direct anon/authenticated writes, authenticated owner-only toggle/ensure RPC grants, enabled Personal membership/Event triggers, Task SELECT preserved and all Task mutation policies gated by module state, unchanged Task identity/status-owner triggers, existing create/join/rotate signatures, and Event/Task Realtime publication with full replica identity. Anonymous PostgREST calls to the new RPCs returned `401 / 42501` rather than a missing-schema error; no business write was possible for that role. The existing Vercel frontend returned HTTP 200.
- Old frontend compatibility at the Slice 1 rollout checkpoint: no Personal Space had yet been created, old create/join RPC signatures and Event/Task calls remained compatible, and Tasks were enabled for all existing Spaces. Production Task count was 0 at backend rollout; later Slice 3 authenticated acceptance exercised disable/re-enable data retention. Next at that checkpoint: Slice 2 selected/current Space flow.

## v0.1.9 Shared Tasks MVP Acceptance and Verification

Status: `v0.1.9 CLOSED / PASS; SLICE 1/2/3 CLOSED / PASS`. The canonical behavior and boundaries are defined in [v0.1.9 Shared Tasks Spec](./v0.1.9_SHARED_TASKS_SPEC.md). The Production backend was applied/postflight verified, the Vercel frontend was deployed, and v0.1.9 is the latest accepted user-facing Production capability.

### Slice 3 Production acceptance — PASS (user-reported, 2026-09-23)

- Production page loaded and existing Calendar behavior worked. `👥 共享空间 · {space.name} ›` opened Space Hub → Tasks.
- In Desktop A/B Production sessions, A created a Shared Task and B saw it without refresh. Title, assignment, and due-date changes synchronized in real time.
- Either current member could Complete/Reopen a Shared Task. Only the assignee could Complete/Reopen an Assigned Task; the other member could not accidentally activate those controls. A member could first reassign a Task to self, then complete it.
- Complete, Reopen, and Delete synchronized in real time. Delete required a second confirmation, and the Completed page worked.
- iPhone Production smoke passed for the Tasks page and Create/Edit Task Sheet. Assignment and due date were operable; no material horizontal overflow or obstructed controls were observed.
- This is user-run authenticated Production evidence. Codex did not drive logged-in sessions. No new full Reminder delivery acceptance or separate Production non-member isolation test is claimed here.

Slice 2 UI is implemented locally. The original all-member complete/reopen rule was corrected after real A/B acceptance found A could complete B's assigned Task. The user completed real A/B and 320px browser acceptance after the correction and Space-entry fix; Codex did not drive authenticated sessions. Final automated results are recorded below.

### Slice 2 real-browser manual acceptance — PASS (user-reported, 2026-09-23)

- Navigation: the Calendar header `👥 共享空间 · {space.name} ›` was recognizable as the current Space entry; Calendar → Space Hub → Tasks worked. Returning to Calendar preserved the selected date and Today/Week/Month view.
- CRUD/Realtime: A created a Shared Task and B saw it without refresh. A's title, assignee, and due-date edits synchronized to B without refresh. Complete, Reopen, and Delete synchronized in real time; Delete required a second confirmation. A current Space member other than the creator could edit and delete.
- Status ownership: either current member could Complete/Reopen Shared Tasks. For a Task assigned to B, A could neither Complete nor Reopen after completion, while B could do both. A could reassign the Task to A, then Complete in a separate action. The same-UPDATE reassignment-plus-status bypass is separately rejected by the focused database test; the UI follows the two-step flow.
- Mobile: the Space Hub and Tasks page worked at 320px; Create/Edit Task Sheets had no material horizontal overflow, blocked controls, or unreachable actions. Ellipsis on the dynamic Space name at extreme narrow width was accepted and is not a blocker.
- This acceptance covered the local new frontend against the aligned Production Task backend. It is Slice 2 acceptance, not Vercel/frontend Production deployment or Slice 3 acceptance.

### Slice 2 final automated verification — PASS

- Focused Task frontend/schema-contract Node tests: 16/16 PASS.
- Focused Task foundation pgTAP: 58/58 PASS; focused status-ownership pgTAP: 15/15 PASS.
- Existing Node regression suite: 185/185 PASS. All eight local database regression suites: 272/272 PASS.
- `npm run build`: PASS. `git diff --check`: PASS.
- No frontend Production deployment or Slice 3 acceptance was performed by these checks.

### Authenticated Integration Readiness Gate and backend-first sequence

- Before any real-login, A/B, Realtime, or authenticated mobile/PWA manual test, Codex verifies the frontend's actual backend target, the target's required schema/RPC/Edge Function capabilities, and frontend/backend feature-version compatibility. A mismatch blocks the request for browser acceptance.
- For a reviewed, tested, backward-compatible additive backend change: apply the backend first, complete backend postflight, then test the local new frontend against the Production backend with real accounts. After manual acceptance passes, request explicit authorization before committing/pushing the frontend for Vercel.
- Narrow compatibility exception: when the new authenticated frontend's first run changes persistent Production state so the currently served frontend becomes incompatible, do not use local/Preview plus real Production accounts for pre-deployment acceptance. After environment alignment, local automated/static checks and code review, obtain explicit Git/deployment authorization, commit/push/deploy the compatible frontend, verify its unauthenticated/static Production assets and that the old frontend is no longer the active entry point, and have users close/refresh old tabs and restart PWA runtimes. The user then performs authenticated acceptance. This is not a general deploy-before-test rule. For v0.1.10 Slice 2, `ensure_personal_space()` can create a second membership that v0.1.9 `.limit(1).maybeSingle()` cannot handle; once created, v0.1.9 is not a safe rollback target for that account.
- Frontend defects remain local until fixed and retested. Backend corrections use a new reviewed forward migration; do not edit the already-applied Production migration, casually rollback, or reset the database. Breaking/destructive changes need their own rollout, compatibility, and rollback plan.
- Codex runs automated checks and this environment gate. The user runs Magic Link/OTP, A/B real-account, logged-in browser-session, and iPhone/Android/PWA acceptance on real browsers/devices. No Auth bypass or Codex-controlled authenticated browser testing.

### Slice 1 Production backend alignment — 2026-09-23

- The reviewed Slice 1 patch was unchanged from HEAD. The local 5175 frontend's remote target matched the CLI-linked Production project. Preflight found PostgreSQL 17.6, required Space/member helpers and composite uniqueness, and no Task table/function/index/publication entry.
- Applied only `supabase/patches/2026-09-22-v0.1.9-shared-tasks-slice1.sql`. Postflight verified nine columns, six expected constraints, the column-specific same-Space assignment FK, four member RLS policies, immutable-identity and `updated_at` triggers, CRUD grant, list index, Realtime publication, `REPLICA IDENTITY FULL`, and exactly zero Task rows. The non-Task public schema fingerprint was unchanged; an unauthenticated, read-only zero-row PostgREST request returned HTTP 200.
- At this backend-alignment checkpoint, the Vercel frontend was not deployed and manual acceptance was still pending; the later Slice 2 and Slice 3 acceptance results are recorded above.

### Slice 2 Task status-ownership correction — 2026-09-23

- TDD reproduction: before the corrective trigger, A's status UPDATE and same-UPDATE B→A reassignment plus completion succeeded incorrectly; 3/14 focused pgTAP assertions failed. After applying the reviewed corrective patch locally, focused pgTAP passed 15/15 and all eight database suites passed 272/272. Existing non-member and collaborative CRUD regressions remained green.
- The database checks `OLD.assigned_to_user_id` only when `status` changes. Shared Tasks allow any current Space member to complete/reopen under existing RLS; assigned Tasks require the current assignee. Title, due date, and assignment edits remain collaborative. A takeover requires a separate reassignment UPDATE before the new assignee changes status.
- Applied only `supabase/patches/2026-09-23-v0.1.9-task-status-ownership.sql` to Production after a clean preflight: PostgreSQL 17.6, original nine columns/six constraints/four RLS policies/two triggers intact, correction absent, zero Task rows. Postflight confirmed the new BEFORE UPDATE trigger enabled and function bound to OLD assignment; prior schema fingerprint unchanged, existing Task data untouched, zero rows. The 5175 frontend still targets the linked Production backend; no frontend deploy or real-account Codex browser test occurred.

### Slice 1 — Task persistence and authorization — LOCAL PASS

- Focused Task pgTAP: 58/58 PASS.
- Full database regression: 257/257 PASS across seven pgTAP files.
- Relevant schema-contract tests: 14/14 PASS.
- `git diff --check`: PASS.
- Verified local target: PostgreSQL 17.6. The composite assignee FK with column-specific `ON DELETE SET NULL (assigned_to_user_id)` preserved the Task and `space_id` while clearing assignment.
- Scope audit: no frontend, Event, Reminder, recurrence, Multi-space, dependency, Production, or deployment change.

- Verify the exact `tasks` fields and one-table complexity budget, required/default/nullability rules, title canonical-value constraint, `open` / `completed` status check, date-only `due_on`, timestamps, and one reasonable list-oriented index.
- Verify `space_id` and `created_by` are immutable; authenticated creation cannot forge another creator.
- Verify a non-null assignee is a current member of the same Space and cross-Space/former-member assignment is rejected.
- Verify removing an assigned membership clears the assignment to shared without deleting the Task. Test the selected minimal target-compatible mechanism directly.
- Verify current members can select/insert/update/delete under the frozen collaborative policy while former/non-members cannot read or mutate rows.
- Verify RLS remains the final row-level boundary and authenticated table grants do not broaden it.
- Verify `tasks` is present in `supabase_realtime` and uses the compatible replica-identity behavior required for Space-filtered DELETE delivery.
- Verify the incremental patch and fresh-install `schema.sql` converge on the same Task contract and do not modify Event/Reminder objects.
- Run the focused v0.1.9 pgTAP suite, all existing database regressions, relevant schema source-contract tests, and `git diff --check`.

### Slice 2 — Minimal CRUD, UI, and Realtime

- **Space-entry discoverability defect resolved and manually accepted:** Calendar header presents an icon-labeled `共享空间 · {space.name}` control with a chevron. User-run acceptance confirmed the entire pill opens the Hub, returning keeps the selected date and Today/Week/Month view, and extreme-width ellipsis does not block 320px use.
- At `http://127.0.0.1:5175`, start in Calendar. Tap its header Space name, confirm the Hub shows the actual Space name, member count/action, existing invite copy/rotate controls, and only one `Tasks / N 项待完成` module row. Go Hub → Tasks → Completed Tasks and back through each header. Confirm Calendar returns to its former date/view and existing Calendar controls/InvitePanel still work. No old top-level `Calendar / Tasks` switch, full navigation, or future-module placeholders appear.
- Confirm Tasks shows only Open rows, live `待完成 · N`, page-local `+`, assignment/date secondary labels, and one `已完成 · N >` entry. Completed page shows every completed row with view/edit and delete through its edit Sheet; `重新打开` appears only for Shared or self-assigned Tasks. The main page does not expand completed rows. Check that a list exceeding a server row limit is not silently truncated, without adding pagination UI. Test both empty lists and zero counts.
- Confirm Open ordering by `due_on` ascending, nulls last, then `created_at` and `id` ascending; equal-date and no-date fixtures should be deterministic. Completed uses the same stable ordering and makes no completion-recency claim.
- Confirm `+` opens the existing-style bottom Sheet with exactly title, assignment, and optional date; create defaults to Shared and no date. Edit preserves status while changing those fields. Title is trimmed and constrained to 1–200 characters; failures stay visible with input intact. Date can be set and cleared. Close/cancel discards unsaved changes.
- Confirm an eligible left Open circle completes without opening edit and moves the row to Completed; tapping any Task title opens edit without completing. `重新打开` returns an eligible Task to the sorted Open list. For a Task assigned to the other member, neither status control is clickable, but title/due date/assignment editing remains available. Delete exists only inside edit, requires a named second confirmation, and cancel leaves the Task intact. A failed write does not leave a false completed/deleted state.
- Confirm assignment shows `共同` plus only real current Space members. Prefer `profiles.display_name`; in the current two-member v0.1.9 UI, when it is empty use contextual `我` / `对方` labels relative to each signed-in account. Verify those labels are presentation only and writes use member IDs. One-member Space shows no invented partner; no email/Auth metadata label is displayed. Future Multi-space / multi-member display must use generic member logic, not a persisted `partner` identity.
- At 320px narrow mobile width and a typical mobile viewport, verify one column, wrapped titles, distinct circle/title/reopen targets, readable count/chevrons, no horizontal scrolling, Sheet keyboard/safe-area behavior, and keyboard/accessibility labels for icon controls.
- With A and B independently authenticated in the same Space, open Hub/Tasks in both and do not refresh either session: (1) A creates an open Task and B sees the row plus Open/Hub counts; (2) B edits title and A sees it; (3) A assigns to B, then Shared, and B sees each change; (4) B sets then clears a due date and A sees both values and resulting order; (5) A completes via circle and B sees the row leave Open and appear in Completed with both counts updated; (6) B reopens and A sees it return to Open; (7) A deletes through edit and confirmation and B sees it disappear from both lists/counts. Reverse A/B writer roles on a second Task. Verify no manual reload, including when the observer is on Hub or Completed.
- Corrective re-acceptance with A/B real sessions: create a Task assigned to B. A sees no clickable Complete/Reopen control but can edit title/due date and reassign. B can Complete and Reopen. A may reassign B→A and then Complete in a separate action; one UPDATE combining reassignment and completion must be rejected by the database. Repeat Shared Task Complete/Reopen from both accounts. Verify all results synchronize without refresh.
- Verify a non-member cannot receive or query another Space's Tasks and Realtime does not bypass RLS.
- Run focused Task Node tests, the full relevant frontend regression suite, `npm run build`, and authenticated desktop/narrow-mobile smoke at `http://127.0.0.1:5175`.

### Slice 3 — Production acceptance and closeout

- Requires separate Production/deployment approval after Slice 1 and Slice 2 acceptance.
- The authorized backend-first Slice 1 Production patch and structural postflight are recorded above; do not reapply it.
- Before any frontend deployment, review the user-run Slice 2 authenticated acceptance evidence and obtain separate approval for Slice 3.
- Deploy only the compatible reviewed frontend.
- In two authenticated Production sessions, verify Task create/edit/assign/complete/reopen/delete persistence and Realtime, plus non-member/RLS isolation and supported mobile layout.
- Confirm Task due dates do not create Events and no Task enters Reminder persistence, sender, ledger, Cron, or Web Push paths.
- Update canonical docs only after observed Production results; correct only concrete acceptance defects rather than adding polish.

### v0.1.9 Explicit Regression Boundaries

- Existing Event CRUD, recurrence, Calendar Today/Week/Month views, member identity, Email OTP, Push subscription lifecycle, ordinary/recurring Reminder delivery, scheduler, and keep-alive behavior remain unchanged.
- No new dependency, Edge Function, Cron job, queue, local persistence, external storage, Task Reminder, Multi-space implementation, or UI overhaul is part of v0.1.9 acceptance.

## Filesystem Persistence Boundary

- Tests that exercise filesystem persistence must use temporary directories or injected paths.
- Ordinary tests must not write the real `/Users/wp/Projects/_project-data/cross-system-shared-calendar/` root.
- This project currently has no filesystem-level persistent business data; Supabase remains the canonical cloud persistence and is not mirrored locally for filesystem governance.

## Project State Push Gate

运行独立 gate 集成测试：

```bash
node --test tests/project-state-push-gate.test.js
```

测试使用临时 Git repository、bare remote、临时 Git identity 与临时
`GIT_CONFIG_GLOBAL`（并设置 `GIT_CONFIG_NOSYSTEM=1`），只用本地路径且不访问网络。
覆盖 branch 的 `updated` / `verified-current` 分类、PROJECT_STATE 增改删、trailer
边界、首次与 force push、branch/tag 删除、lightweight / annotated / non-commit tag、
多 ref、tip 冲突、remote OID 缺失、真实 bare remote pre-push 接线、安装脚本首次安装/
幂等/冲突拒绝，以及含空格或非 ASCII 的路径。

Gate 实现还包含 forward-only version governance：对 branch push，只检查相对远端新增到
`Current version` 或 `Version Index` 的正式版本 token，并要求其为纯数字 canonical
version（例如 `v0.8`、`v0.8.2`、`v0.6.6.1`）。既有 legacy token 不做回溯验证；tag
不做 PROJECT_STATE tree 或 version-diff 分类。

Gate 语法检查：

```bash
sh -n .githooks/pre-push
sh -n scripts/check-project-state-push.sh
sh -n scripts/install-git-hooks.sh
```

Gate 检查新正式版本 token 的 forward-only canonical 格式，并检查最终 branch tip 的
trailer 是否与 PROJECT_STATE tree diff 一致；tag 只验证目标 commit 的合法 trailer。
`git push --no-verify` 可以绕过本地 hook；gate 不判断状态内容真实性，不会自动 commit
或 push，也不替代用户明确授权。

## v0.1.8 Mobile Push Reminder Acceptance Plan

Status: `v0.1.8 — Mobile Push Reminder` is `CLOSED / PASS`. Push Infrastructure, ordinary Reminder Slice A/B/C, Slice 3 Recurrence Reminder Integration, and final cross-platform acceptance are complete.

### Final Cross-Platform / Android Acceptance — CLOSED / PASS

- Mac Production Push and automatic Reminder: PASS.
- iPhone Production Push and automatic Reminder: PASS.
- Android acceptance was performed on Android Studio Emulator, not physical Android hardware.
- Android notification permission/subscription: PASS.
- Android `send-test-push` delivery: PASS.
- Android ordinary automatic Event Reminder delivery: PASS.
- Android audible notification: PASS.
- Android notification-shade delivery: PASS; pulling down the shade showed the delivered notifications, so no missing delivery was found.
- Android heads-up/top-screen banner: not observed. This is classified as emulator/Chrome notification presentation behavior, not a Push or Reminder delivery failure. Physical Android hardware heads-up presentation was not validated and is non-blocking.
- Notification-click/open PASS is not recorded because the supplied final evidence did not independently confirm it.
- Final read-only Production health review: project Healthy; displayed recent request success 100%; zero displayed Postgres/Edge Function warnings or errors. The accepted `send-reminders` v2, `send-test-push` v4, exactly one active scheduler, healthy recent Cron/pg_net HTTP results, no stuck claims, no unexpected subscription disablement, and no duplicate delivery identities remain the canonical state. No Production mutation was required.
- Existing Future Consideration remains unchanged: semantic due is exact; once-per-minute `pg_cron` + async `pg_net` + Web Push may add sub-minute to approximately one-minute visible latency; v0.1.8 adds no `-60s` early-dispatch allowance. Revisit only for material real-use feedback or future native OS-level local scheduling.
- Optional future consideration: casually revalidate heads-up presentation on physical Android hardware if convenient. This does not reopen v0.1.8.

### Slice 3 Recurring Reminder Production Acceptance — CLOSED / PASS

Production rollout and acceptance on 2026-09-22:

- Applied only the reviewed Slice 3 forward DB patch once. Postflight passed for nullable `reminder_deliveries.occurrence_date`, recurrence-aware `UNIQUE NULLS NOT DISTINCT` identity, preserved ordinary ledger rows, RLS/no-policy/no-Realtime state, service-role SELECT/UPDATE-only table access, and the exact service-role-only hardened recurring claim with no SQL recurrence expansion. Historical recurring Events were not auto-enabled.
- Deployed only `send-reminders` v2 with source-controlled `verify_jwt=false`; `send-test-push` remained v4. The deployed frontend contains recurring source Reminder controls. The unique once-per-minute scheduler stayed active and healthy without Vault/secret/Cron changes.
- Normal recurring automatic E2E passed: semantic start 11:55 and due 11:45 were exact; iPhone and Mac received the automatic Push; two subscription-specific rows finalized as `sent`; repeated work did not duplicate. The approximately one-minute visible delay was traced to asynchronous scheduler/pg_net/Web Push processing, not due calculation.
- ONLY-THIS override acceptance passed with inherited/read-only 10-minute Reminder, effective moved start/title, automatic Push, original scheduled occurrence identity, and no duplicate delivery. ONLY-THIS delete acceptance passed immediately without waiting: one unambiguous delete exception, zero canonical occurrence, zero Reminder candidate/effective due/ledger/claim/send, preserved neighboring occurrences, and structural stale-snapshot claim rejection.
- THIS-AND-FUTURE split acceptance passed: exactly one child source inherited Reminder/timezone/rule and logical identity, received a fresh marker, and projected the split boundary/future while the parent cutoff excluded them. There were no duplicate logical dates, no catch-up ledger, no per-occurrence Reminder field, and the prior override/delete semantics remained intact.
- Final health: `send-reminders` ACTIVE v2; one active scheduler; 10/10 recent Cron runs and pg_net HTTP 200 responses healthy; zero stuck claims, duplicate delivery identities, split-created ledger rows, or unexpected subscription disables. The prior ordinary Reminder regression remains PASS.
- `ALLDAY_PRODUCTION_REALTIME_WAIT_NOT_REQUIRED`: the deployed contracts and focused 26/26 automated verification remain authoritative for recurring all-day same-day 08:00, previous-day 20:00, canonical timezone, DST gap/overlap, a non-1-hour transition, and a full date-line/day transition. No next-day real Push wait was required.
- Future consideration — Web/PWA Push delivery precision: semantic due remains exact; once-per-minute `pg_cron` + async `pg_net` + Web Push may occasionally add sub-minute to approximately one-minute visible latency. v0.1.8 adds no `-60s` early-dispatch allowance and keeps ordinary/recurring timing under the same semantic rule. Revisit only for material real-use UX impact or future native OS-level local notification scheduling.

### P3C Automatic Scheduler E2E — CLOSED / PASS

Production acceptance on 2026-09-22:

- Confirmed exactly one Vault `REMINDER_CRON_SECRET` by name without retrieving its value. Enabled only `pg_cron` in `pg_catalog` and `pg_net` in `extensions`; `cron.schedule`, `cron.unschedule`, and `net.http_post` are available.
- Created exactly one active `send-reminders-every-minute` job on `* * * * *`. The exact stored command targets Production `send-reminders`, performs the Vault lookup at execution time, uses a 120000 ms request timeout, and contains neither plaintext secret nor service-role bearer. Unschedule-first is the canonical failure containment.
- Automatic no-due verification passed with zero enabled ordinary Reminder candidates and zero selected/claimed/sent/failed work. The ledger and subscription state remained unchanged.
- The scheduler discovered one disposable personal timed `Automatic Reminder E2E Test` without any manual curl or Function invocation. Both iPhone and Mac automatically received the real Reminder.
- Ledger postflight confirmed two rows for one due across two distinct active subscriptions: `sent = 2`, `claimed = 0`, `failed = 0`, duplicate identities `= 0`, and unexpected subscription disables `= 0`.
- Four repeated due-window scheduled responses produced eight aggregate claim rejections with no extra claim, row, send, or notification. A bounded 120-minute postflight recorded 120/120 successful Cron runs and HTTP 200 responses, at most one run in any minute, zero timeouts/errors, zero stuck claims, and zero sensitive diagnostic markers.
- C1 remains PASS; `send-reminders` remains ACTIVE v1 / `verify_jwt=false`; `send-test-push` remains ACTIVE v4 reviewed-equivalent. Slice C is `CLOSED / PASS`; Slice 3 recurrence Reminder integration and final Android/cross-platform acceptance remain separate.

### P3B send-reminders Production Manual E2E — CLOSED / PASS

Production acceptance on 2026-09-22:

- `send-reminders` is ACTIVE with `verify_jwt=false`; `send-test-push` remains ACTIVE v4 / `verify_jwt=true`. The Edge `REMINDER_CRON_SECRET` is confirmed by name only; its value was never exposed.
- Missing and invalid Authorization returned HTTP 401 before database work. The authorized no-due invocation returned HTTP 200 with `due_eligible = 0`, `claimed = 0`, `sent = 0`, and `failed = 0`.
- The disposable personal timed Event used `timed_10m_before`; one recipient had two active subscriptions. The first due-window invocation returned HTTP 200 with `due_eligible = 1`, `recipients = 1`, `active_subscriptions = 2`, `delivery_tasks = 2`, `claimed = 2`, `sent = 2`, `failed = 0`, and `finalize_failures = 0`.
- iPhone received the real Reminder; title/body and click behavior passed. Mac backend delivery succeeded, while visible presentation was initially suppressed by Sleep/Focus. After disabling that state, the existing Mac `send-test-push` regression passed.
- The repeat invocation returned `claim_rejected = 2`, `claimed = 0`, `sent = 0`, `failed = 0`, and no duplicate notification.
- Ledger postflight confirmed two finalized `sent` rows, zero remaining `claimed`, zero `failed`, zero duplicate `(event_id, subscription_id, due_at)` identities, zero unexpected subscription disablement, and zero unexpected ledger rows. The disposable Event is not present in the current aggregate check; no ledger rows were deleted.
- Cron remains OFF; Vault Reminder secret, pg_cron, and pg_net remain absent. P3C scheduler activation requires separate authorization.

### P3A Production C1 Foundation Final Closeout — CLOSED / PASS

Production ACL correction and bounded postflight on 2026-09-21:

- Applied only `supabase/patches/2026-09-21-v0.1.8.2-reminder-delivery-acl-correction.sql` once to canonical Production. Final direct/effective ACL is `service_role` SELECT / UPDATE only; INSERT / DELETE / TRUNCATE / REFERENCES / TRIGGER / MAINTAIN are denied. All eight privileges remain denied for anon/authenticated.
- `reminder_deliveries` remains empty with 10 expected columns, five constraints, UUID primary key, unique `(event_id, subscription_id, due_at)`, zero foreign keys, enabled updated-at trigger, RLS enabled, zero policies, and no Realtime publication.
- `claim_reminder_delivery(...)` remains one UUID-returning SECURITY DEFINER function with hardened search path, unchanged definition hash and reviewed body contract, service-role-only execution among application roles, and no Production invocation.
- Events, Push subscriptions, and Space members structural fingerprints matched pre-correction exactly. Five Reminder persistence constraints and the schedule-marker trigger remain intact.
- `send-test-push` remained ACTIVE v3. `send-reminders`, Edge/Vault Reminder secrets, pg_cron, pg_net, and Reminder Cron remain absent or untouched; no Push, Event/test data, or subscription mutation occurred. `C1_PRODUCTION_FOUNDATION = PASS`; stop before P3B.

### P3A C1 ACL Corrective RCA — HUMAN REVIEW PASS / APPLIED

- Production read-only catalog evidence classified the source as `DIRECT_OR_DEFAULT_TABLE_GRANT`: owner `postgres` has a schema-`public` default table ACL granting all privileges to `service_role`, and those grants were materialized directly in `reminder_deliveries.relacl`. `service_role` is not owner/superuser, has no inherited roles, and has no PUBLIC or other-role privilege path.
- Catalog reasoning confirms a table-local `REVOKE ALL PRIVILEGES ... FROM service_role` followed by `GRANT SELECT, UPDATE ... TO service_role` is sufficient. Default privileges affect future object creation and do not reapply to the existing table after the revoke.
- Added the four missing negative assertions for TRUNCATE, REFERENCES, TRIGGER, and MAINTAIN to the existing C1 pgTAP suite. Before the local correction they failed exactly 4/67; after applying the new corrective patch to the local database only, the suite passed 67/67.
- Bounded human/code review found no issues in the corrective SQL, full privilege contract, or governance scope. Production was not modified during the RCA/review itself; the reviewed correction was later applied in the bounded final closeout above.

### P3A Initial Production C1 Foundation Attempt — ACL GATE FAILED (historical)

Production execution and structural verification on 2026-09-21:

- Repository baseline was clean at `7c5c08634e7d689f9df1ae02388a06d02d75f619`; the exact C1 patch SHA-256 matched `81c40c715d6cd52cecc5f4f19835b6612ddafc7daaecdd1aa82d85b6bb6de629`. Linked-project identity matched canonical Production project `ximazjhxvmktpcdbypka`.
- Read-only preflight confirmed both C1 objects absent, all 14 required columns present, all five Slice B constraints and the schedule trigger present, `touch_updated_at()` present, `pg_cron` / `pg_net` absent, and `REMINDER_CRON_SECRET` absent. Structural fingerprints were captured for Events, Push subscriptions, and Space members.
- Applied exactly `supabase/patches/2026-09-21-v0.1.8.2-reminder-delivery.sql` once. Postflight confirmed 10/10 expected columns, five expected constraints, UUID primary key, unique `(event_id, subscription_id, due_at)`, zero foreign keys, enabled `touch_updated_at` trigger, RLS enabled, zero policies, no Realtime publication, and zero initial ledger rows.
- `claim_reminder_delivery(...)` exists once, returns UUID, is SECURITY DEFINER with exact `pg_catalog, pg_temp` search path, matches the reviewed revalidation/idempotency body contract, and is executable by `service_role` but not anon/authenticated.
- Existing Events, Push subscriptions, and Space members column/constraint/index/RLS-policy/trigger/publication fingerprints matched preflight exactly. `send-test-push` remained ACTIVE v3; `send-reminders`, Reminder secret, pg_cron, and pg_net remained absent.
- ACL gate failed: effective and direct ACL inspection showed `service_role` had INSERT / DELETE / TRUNCATE plus other broad table privileges, not only SELECT / UPDATE. No correction or cleanup was attempted during that run. This historical stop condition was resolved by the separately authorized correction and final closeout recorded above.

### Slice 2C2 Phase 2 — send-reminders Core Orchestration

Local implementation verification on 2026-09-21:

- Confirmed TDD RED before implementation because the `send-reminders` module did not exist. A later review-found cutoff regression also failed before the implementation added an immediate pre-claim budget recheck after asynchronous tag generation.
- Passed `node --test tests/send-reminders.test.ts` (26/26). Coverage includes exact bearer auth and zero unauthorized work, fixed run context, stable 100-row keyset pagination, exactly-1000 acceptance, explicit 1001st-row abort, canonical due/grace/marker semantics, current personal/shared recipients, active multi-install subscriptions, deterministic 50-task selection, all sender result mappings, raw-marker C1 claim, claim rejection, 404/410 retirement, exact-one-row finalize checks, aggregate-only diagnostics, five-worker concurrency, and the 95-second claim cutoff.
- Passed the complete repository suite: `node --test tests/*.test.ts tests/*.test.js` (153/153).
- Passed `deno check --no-lock --node-modules-dir=none --config supabase/functions/send-reminders/deno.json` for `logic.ts`, `index.ts`, and the existing shared Web Push sender. The function reuses the existing exact dependency pins and adds no root dependency or lockfile change.
- Passed `npm run build` and `git diff --check`.
- Scope audit: only the new `send-reminders` function, its focused Node test, and canonical status/testing docs changed. No database/schema/C1, recurrence, frontend, Service Worker, shared sender, `send-test-push`, root dependency, Cron, Vault, real secret, deployment, commit, push, or Production change was made. C1 remains undeployed; human/code review passed with no BLOCKER / MAJOR / MINOR findings, and commit/push closeout is the next authorized step.

### Slice 2C2 Phase 1 — Shared Web Push Sender Extraction

Local implementation verification on 2026-09-21:

- Confirmed RED before production refactoring because `supabase/functions/_shared/web-push.ts` did not exist and the new source-contract assertions could not read it.
- Passed `node --test tests/web-push.test.ts tests/send-test-push.test.ts tests/send-test-push-source.test.ts` (29/29). Coverage includes 2xx, 404, 410, provider rejection, timeout, network failure, invalid sender results, allowed/disallowed endpoints, VAPID loading, TTL 60, timeout 10000 ms, normal urgency, hostname/status-only diagnostics, no sensitive result leakage, shared-module usage, preserved CORS/auth/installation/fixed-payload/disable/response contracts, exact package pinning, and exclusion from the browser tsconfig/root package.
- Passed the complete repository suite: `node --test tests/*.test.ts tests/*.test.js` (123/123).
- Passed `deno check --no-lock --node-modules-dir=none supabase/functions/_shared/web-push.ts` and `deno check --no-lock --node-modules-dir=none --config supabase/functions/send-test-push/deno.json supabase/functions/send-test-push/index.ts`, using the Deno global cache for already-pinned function dependencies and adding no root dependency or lockfile.
- Passed `npm run build` and `git diff --check`.
- Passed required real-device regression after deploying only `send-test-push`: Desktop Chrome/macOS and iPhone installed PWA actual notification, unchanged safe diagnostics, correct title/body, and unchanged notification-click behavior. Desktop repeated-banner behavior was separately classified as pre-existing fixed-tag behavior and is non-blocking.
- Scope audit: no `send-reminders`, candidate scan, delivery ledger/claim, Cron, secret, Vault, database, or Service Worker change. Only `send-test-push` was deployed; commit/push closeout remains separate.

### Slice 2C1 — Minimal Delivery Ledger + Atomic Claim

Local implementation verification on 2026-09-21:

- Confirmed TDD RED from `supabase/tests/2026-09-20-v0.1.8.2-reminder-delivery.test.sql` before implementation because `public.reminder_deliveries` and `claim_reminder_delivery(...)` did not exist.
- Passed the final C1 pgTAP contract 63/63. Coverage includes the exact ledger fields and `smallint` provider status, minimum constraints, no audit foreign keys, RLS/ACL/Realtime/function privileges, first/duplicate claim, all frozen eligibility rejections, exact marker matching, valid grace, and audit survival after Event/subscription deletion or disablement.
- Passed a real local concurrency probe with four PostgreSQL sessions calling the identical claim after the same synchronization delay: exactly one call returned a UUID and the final ledger count was one. The fixed-UUID test fixture was removed afterward. No `dblink`, extension, or dependency was added.
- Passed the complete local database suite: 5 files and 161/161 assertions. Slice B remains 28/28.
- Passed `node --test tests/*.test.ts tests/*.test.js` (114/114), `node --test tests/reminder-due.test.ts` (9/9), `node --test tests/recurrence.test.ts` (25/25), both existing Deno checks, `npm run build`, and `git diff --check`.
- Marker contract: future callers must pass the database `reminder_schedule_changed_at` value without lossy JavaScript formatting or precision truncation. C1 itself is DB-only and has no caller, sender, candidate scan, Cron, secret, provider integration, or Production migration.

### Slice 2A — Timezone Primitives + Reminder Due Calculator

Local verification on 2026-09-20:

- Passed `node --test tests/recurrence.test.ts tests/reminder-due.test.ts` (34/34). Coverage includes null/invalid inputs, all seven frozen reminder kinds, timed/all-day mismatch, real-minute offsets, Event-local previous-day arithmetic, all-day 08:00/previous-day 20:00, DST gap/overlap policy, and the absence of `ends_at` from the calculator contract.
- Passed the full repository Node suite: `node --test tests/*.test.ts tests/*.test.js` (101/101).
- Passed `npm run build`, proving the Vite/browser TypeScript project imports the shared runtime-neutral timezone implementation.
- Node imports passed through both recurrence and Reminder tests. Existing recurrence behavior is locked by new DST characterization tests: a nonexistent wall clock advances to the first instant after the spring gap, while an overlapped wall clock selects the earlier instant.
- Passed with system Deno 2.9.7: `deno check supabase/functions/_shared/time-zone.ts` and `deno check supabase/functions/_shared/reminder-due.ts`. Deno remains a system verification tool rather than a project dependency.
- Scope audit passed: no database/schema/migration, Event UI, sender, Cron, Service Worker, Push Subscription, Supabase/Vercel configuration, dependency, deployment, commit, or push change.

### Slice 2B — Reminder Persistence + Event Mutation/UI

Local implementation verification on 2026-09-20:

- Passed the Slice B schema/migration static contract: 4/4. It covers the exact three columns, five minimum constraints, one validation/marker function + trigger, historical recurring-only timezone backfill, no historical Reminder activation, no legacy offset, and split-child timezone inheritance.
- Passed the complete repository Node suite: `node --test tests/*.test.ts tests/*.test.js` (114/114). New coverage includes timed/all-day defaults and mapping, null preservation, controlled timezone capture failure with no UTC fallback, existing timezone preservation, historical capture boundaries, semantic partial payloads, seconds/milliseconds preservation, and protected identity-field exclusion.
- Passed `deno check supabase/functions/_shared/time-zone.ts`, `deno check supabase/functions/_shared/reminder-due.ts`, `npm run build`, and `git diff --check`.
- Added `supabase/tests/2026-09-20-v0.1.8.2-reminder-persistence.test.sql` with 28 planned assertions for structure, constraints, marker behavior, direct marker mutation defense, and split-child timezone inheritance. Existing recurrence pgTAP fixtures now provide their authoritative Event timezone.
- Passed disposable ordered-upgrade from the committed pre-Slice-B schema with historical ordinary/recurring/personal fixtures. Verified historical-null policy, recurring timezone backfill, marker initialization, constraints/trigger, split-child timezone inheritance, RLS, personal ownership, and Realtime preservation.
- Passed Slice B pgTAP 28/28 and the complete local database regression suite 98/98. The recovered local database initially lacked the existing v0.1.8.1 prerequisite; applying that already-approved additive patch locally restored the expected baseline before the final green run.
- Production preflight, application of only `supabase/patches/2026-09-20-v0.1.8.2-reminder-persistence.sql`, and read-only postflight passed. Historical reminders remained disabled, ordinary timezones remained null, recurring timezones matched their rule, and existing RLS/owner validation/Realtime/Push infrastructure were preserved.
- Production human acceptance completed on 2026-09-20 against the deployed frontend — PASS: new timed defaults to 10 minutes before and new all-day defaults to 08:00; timed/all-day conversions preserve the non-null/null rule; timed 1-hour and all-day previous-day 20:00 presets persist; saved timed and all-day reminders persist after reopen; disabling remains 不提醒 after reopen; recurring Events force 不提醒 and disable the other Reminder options; title-only/description-only edits leave start/end unchanged; ordinary schedule edits reopen correctly without Reminder anomalies; A-created-B-owned personal Events remain read-only to A and editable by B; shared CRUD, own personal CRUD, ordinary Event create/update/delete Realtime, and shared Reminder Realtime all pass.
- Historical ordinary Event browser coverage was N/A because Production had no pre-Slice-B ordinary fixture. This is not a failure: ordered-upgrade and Slice B pgTAP covered `historical reminder_kind = null`, `historical ordinary time_zone = null`, and no historical Reminder auto-enable. Timezone detection failure and seconds/milliseconds preservation remain automated semantic checks; the browser acceptance verified the visible schedule was not rewritten by title/description edits.
- Scope audit: no delivery table, claim function, sender, Cron, retry, recipient resolution, Push delivery, recurring Reminder delivery, dependency, deployment, commit, or push change.

### Slice 1 — Push Infrastructure Foundation

Local automated verification updated on 2026-09-19:

- Passed 29/29 Node tests across `tests/push-notifications.test.ts`, `tests/send-test-push.test.ts`, `tests/send-test-push-source.test.ts`, `tests/service-worker.test.ts`, and `tests/supabase-schema-push.test.ts`; the full repository suite passed 90/90.
- Passed `npm run build` (TypeScript project build plus Vite production bundle).
- Passed an Edge static/type check against the exact `@mmmike/web-push@1.3.0` package declarations. Sender diagnostics cover accepted 2xx, gone 404/410, rejected 401/403/429/5xx, and network/runtime failure while returning only upstream status, provider hostname, delivery flags, and a stable non-sensitive error code.
- Added `supabase/tests/2026-09-18-v0.1.8.1-push-infrastructure.test.sql` with 22 assertions for table/RPC structure, privileges, authenticated registration/upsert, endpoint ownership, current-installation disable, and isolation. Its local run is pending because the local Supabase database was unavailable; Production was not used as a substitute.
- The v0.1.8.1 Push Infrastructure pgTAP suite passed as part of the complete 98/98 local database regression run on 2026-09-20.

Real Push Infrastructure acceptance on 2026-09-19:

- **iPhone installed PWA — PASS:** notification permission, subscription, test push, delivery after returning to the home screen, and lock-screen delivery passed.
- **Desktop Chrome/macOS — PASS:** notification permission, local `Notification`, Service Worker `showNotification`, FCM upstream acceptance, and final test-push display passed. The diagnostic result was `status = 201`, `delivered = true`, `provider = fcm.googleapis.com`, and `gone = false`.
- **Desktop recovery evidence:** the initial browser subscription produced FCM acceptance but no displayed Push. Closing notifications, enabling them again, and creating a fresh subscription restored delivery. No evidence indicates a Push architecture, VAPID, Edge Function, or Service Worker blocker.
- **First-line Push recovery:** retry; unsubscribe/resubscribe; restart the browser/PWA. Escalate to deeper RCA only if these do not restore delivery or safe sender diagnostics show provider rejection.
- **Android deferred by validation strategy:** permission, subscription, foreground delivery, background delivery, closed-app delivery, notification click, and logout lifecycle will be validated together during final v0.1.8 cross-platform acceptance. This is not a blocker for Slice 2.

- Register a root-scope Service Worker that handles Push and notification clicks only; verify that it adds no offline cache or `fetch` caching behavior.
- Request notification permission only after an explicit user action. Cover granted, dismissed/default, denied, unsupported-browser, and iPhone-not-installed guidance.
- Persist subscriptions by `user + installation`, not by Space. Desktop and iPhone used independent installations; final Android multi-device coverage remains part of final v0.1.8 acceptance.
- Verify current-installation logout disables/unsubscribes that installation without disabling another device, and invalid/expired endpoints are retired safely.
- Desktop and iPhone diagnostic system-notification smoke passed. Android system-notification and lifecycle smoke is deferred to final v0.1.8 acceptance and does not block reminder-semantics work.
- Confirm this slice does not add Event reminder persistence, reminder scheduling, recurrence delivery, Email reminder delivery, SQL beyond subscription persistence, or offline caching.

### Slice 2 — Reminder Persistence + Ordinary Event Delivery

- Verify nullable `events.reminder_kind` accepts only `timed_at_start`, `timed_10m_before`, `timed_30m_before`, `timed_1h_before`, `timed_previous_day_same_time`, `all_day_same_day_08`, and `all_day_previous_day_20`; `null` means no reminder. Reject timed kinds on all-day Events and all-day kinds on timed Events after the visible conversion step.
- Verify nullable `events.time_zone` accepts canonical IANA timezone names rather than fixed offsets. New Events capture `Intl.DateTimeFormat().resolvedOptions().timeZone`; later device timezone changes do not silently rewrite existing Events. Recurring Events require equality with `recurrence_rule.time_zone`.
- Verify the database default and every historical Event remain `reminder_kind = null`, with historical ordinary `time_zone = null`; no migration guesses a timezone or enables notifications. Historical recurring sources may initialize `time_zone` only from their existing authoritative `recurrence_rule.time_zone`. Enabling a timezone-dependent reminder on a historical null-timezone Event captures the current device IANA timezone explicitly as part of that mutation.
- Verify new UI-created timed Events default to `timed_10m_before` and new UI-created all-day Events default to `all_day_same_day_08`; these are UI defaults, not database defaults.
- Verify at-start/10m/30m/1h use the effective absolute start and real-minute subtraction. Verify `timed_previous_day_same_time` preserves the same wall-clock time on the prior Event-local calendar day and reuses the existing recurrence gap/overlap policy rather than subtracting 1440 minutes.
- Verify all-day same-day 08:00 and previous-day 20:00 derive one canonical instant from effective Event date plus Event timezone, independent of receiving-device timezone. Confirm the current all-day representation safely supports this calculation before proceeding; do not add date-only storage or exclusive-end behavior in Slice 2.
- Verify timed-to-all-day keeps null or maps any non-null timed reminder to `all_day_same_day_08`; all-day-to-timed keeps null or maps any non-null all-day reminder to `timed_10m_before`. The final option must be visible before save.
- Verify multi-day timed/all-day Events use only their effective range start/first date; `ends_at` never creates daily, end, journey, or intermediate reminders.
- Verify start/date and preset edits update `reminder_schedule_changed_at` and derive a new current due; the old due naturally leaves the candidate path without mutation-time ledger maintenance. Title/description edits keep the marker and due unchanged. An already-sent reminder is not withdrawn, while moving an Event to a future due may create one new legitimate delivery.
- Verify create/edit/enable/preset changes whose newly derived due is past do not immediately Push or compensate. Verify approximately ten-minute grace applies only when an already-valid due was missed by infrastructure: 10:00 → 10:07 may send, while 10:00 → 10:30 skips; apply the same rule to all-day 08:00.
- Verify shared events resolve all current active Space members at send time, personal events resolve only `owner_user_id`, former members receive nothing, and members without active subscriptions naturally receive no device notification.
- Verify Reminder UI copy tells the editor that a shared Event reminder notifies current Space members.
- Verify ordinary one-off uniqueness on `(event_id, subscription_id, due_at)`, atomic current-state revalidation/claim, `reminder_schedule_changed_at` snapshot matching, and approximately one-minute normal scheduler precision. Do not pre-generate pending rows or mutate the ledger when an Event schedule changes.
- Verify Production best-effort delivery on Desktop, iPhone installed PWA, and Android installed PWA, including repeated Cron/Edge Function invocation, multi-device delivery, and no duplicate notification on the same subscription/due time. Provider failures and ambiguous timeouts are terminal failed results in this slice and do not enter an automatic retry framework.
- Confirm Email, SMS, Bark, multiple reminders, arbitrary custom minutes, per-user reminder preferences, snooze, sound customization, notification inbox/history, native alarms, multi-space implementation, and UI overhaul remain outside v0.1.8.

### Slice 3 — Recurrence Reminder Integration

Local implementation verification on 2026-09-22 — automated PASS; one reviewed projection blocker corrected; final human/code re-review PASS with no remaining findings:

- Passed focused recurrence/Reminder tests 46/46 and full repository Node regression 169/169. Coverage includes inherited reminders, effective-title and moved-in/moved-out overrides, newly-past marker behavior, delete/cutoff suppression, split projection, all-day same-day 08:00 and previous-day 20:00, canonical timezone, DST gap/overlap, a non-1h transition, collision-safe tags/identities, caps, ordinary delivery regression, UI inheritance/read-only behavior, and a daily Event whose duration spans more than 500 intervals. The long-duration test proves Reminder projection discovers the current due occurrence without mutating the source while canonical calendar expansion retains its existing duration-overlap guard behavior.
- Passed all six local pgTAP files, 199/199 assertions. Slice 3 adds 32 assertions for nullable occurrence identity, atomic claim ACL/search path, exact source/exception race rejection, membership/subscription checks, schedule marker, grace, idempotency, colliding due instants, and unchanged ordinary identity. Slice B now has 30 assertions including split Reminder/timezone inheritance and a fresh child schedule marker.
- Passed strict Deno checks for `send-reminders/logic.ts`, `send-reminders/recurring.ts`, `send-reminders/index.ts`, the canonical recurrence module, and the shared Web Push sender. Passed `npm run build` and `git diff --check`.
- The implementation imports the canonical `src/lib/recurrence.ts` engine; SQL does not expand recurrence. The bounded timezone/calendar window plus the complete capped exception set discovers moved-in overrides without materializing occurrences.
- Production, deployed Functions, scheduler, Vault/Cron/secrets, Push subscriptions, and Production data were not modified. Android final acceptance remains deferred and overall v0.1.8 remains OPEN.

## v0.1.7.3.3.2 Frontend Scope Integration

Passed locally on 2026-07-19:

- `node --test tests/recurrence.test.ts tests/event-edit-target.test.ts tests/event-edit-draft.test.ts tests/event-edit-mutation.test.ts tests/event-edit-ui.test.ts` (41 tests).
- Coverage includes ordinary-event route regression; occurrence only-this and this-and-future routes; final split/future-delete RPC parameter payloads; source all-day/rule/revision preservation; exactly two occurrence scopes and their copy; and projection of old/child split segments without a duplicate split date.
- The UI helper coverage now asserts save/delete action-chooser copy for both scopes; the sheet no longer renders a persistent scope control.
- `npm run build` and `git diff --check` passed.
- Refresh error propagation is implemented so EventSheet's awaited `onSaved()` path retains the sheet when either events or exceptions reload fails; initial-load and Realtime fire-and-forget callers handle the resulting rejection after the page error is set.
- Authenticated local UI smoke passed: only-this edit, this-and-future edit, only-this delete, this-and-future delete, and the save/delete action chooser.
- Local PostgREST cache recovery: database inspection confirmed `delete_occurrence_and_future(uuid, date, timestamptz)` already exists; a local `NOTIFY pgrst, 'reload schema'` completed and PostgREST logged a 15-function schema cache. The existing v0.1.7.3.3.1 patch was subsequently applied once to Production, its cache was reloaded, and the final RPC signatures/permissions were verified. No SQL file changed.

Production acceptance completed on 2026-07-19:

- Passed on Production Desktop and iPhone Standalone PWA: 「仅修改当前事件」、「修改当前及未来事件」、「仅删除当前事件」and「删除当前及未来事件」.
- Passed: the Production alias serves the v0.1.7.3.3.2 build and the recurrence action chooser retains the sheet until the selected mutation succeeds and refresh completes.
- iOS Standalone PWA cannot actively refresh itself. This is an iOS system limitation, not an application defect; the smoke scope verified the supported manual interaction flow.
- Deferred by product decision: `delete_logical_series` remains an available backend RPC but has no frontend entry point. Whole-logical-lineage deletion requires a separately approved UX and safeguard slice.
- Two-session Realtime and DST-zone behavior remain separate verification work. Recurrence-rule and all-day changes remain out of scope for occurrence edits.

## v0.1.7.3.3.1 Split RPC Correctness Patch

Passed locally on 2026-07-18. `supabase db reset --local --yes` resets the local Supabase instance but does not load this repository's `supabase/schema.sql`; the validated fresh bootstrap explicitly loaded that file through the local Postgres container. `schema.sql` is the latest complete bootstrap artifact, while `supabase/patches/*.sql` are ordered upgrades from an older database state.

- Standalone bootstrap: v0.1.7.1 foundation pgTAP 18/18; v0.1.7.3 series-editing pgTAP 30/30; total 48/48.
- Ordered upgrade from `e7decd1` bootstrap through v0.1.7.1, v0.1.7.3.1, and v0.1.7.3.3.1 patches: 48/48.
- Node recurrence/edit regressions: 34/34; `tests/supabase-schema-recurrence.test.ts`: 1/1; total 35/35. The schema test guards recurrence lineage, exception foundation, helpers, final RPCs, SECURITY DEFINER/search_path, and child `recurrence_until` inheritance.
- Passed: `npm run build` and `git diff --check`.

## v0.1.7.3.2 Frontend RPC Integration

Verified on 2026-07-18 with localhost:5175 connected to Production Supabase project `ximazjhxvmktpcdbypka` after the v0.1.7.3.1 patch and PostgREST schema-cache reload:

- Passed: opening a non-first recurring occurrence hydrates the sheet from the occurrence projection, including its own date and time rather than the source event baseline.
- Passed: editing title/time for one occurrence writes an only-this override; surrounding occurrences remain unchanged and the projection remains correct after refresh.
- Passed: deleting one occurrence writes an only-this deletion; surrounding occurrences remain and the projection remains correct after refresh.
- Passed: ordinary non-recurring event edit/delete regression.
- Passed: `node --test tests/recurrence.test.ts tests/event-edit-target.test.ts tests/event-edit-draft.test.ts tests/event-edit-mutation.test.ts tests/event-edit-ui.test.ts` (34 tests), `npm run build`, and `git diff --check`.
- Passed locally: `supabase test db --local supabase/tests/2026-07-18-v0.1.7.3-series-editing.test.sql` (15 pgTAP assertions).
- Scope: only-this occurrence mutation only. Recurrence-rule and all-day controls are unavailable for an occurrence because the override RPC contract accepts only `title`, `description`, `starts_at`, and `ends_at`.

## v0.1.7.3.1 Series Editing Database RPC Foundation

Verified locally on 2026-07-18, then applied and structurally/RPC-verified on Production project `ximazjhxvmktpcdbypka` before the v0.1.7.3.2 authenticated smoke:

- Passed: `supabase test db --local supabase/tests/2026-07-18-v0.1.7.3-series-editing.test.sql` (15 pgTAP assertions). Coverage includes only-this override/delete, source-timezone candidate validation, non-member denial, split cutoff/child lineage/no exception migration, stale `updated_at` rejection, and logical-series deletion of root, child, and exceptions.
- Passed regression: `supabase test db --local supabase/tests/2026-07-18-v0.1.7.1-database-foundation.test.sql` (18 pgTAP assertions).
- Passed Production: preflight found the v0.1.7.1 prerequisites and no existing v0.1.7.3.1 RPCs; the reviewed patch was applied once, PostgREST schema cache was reloaded, and all four `SECURITY DEFINER` RPCs were recognized by PostgREST. Frontend only-this integration and authenticated smoke are recorded above; split and logical-series UI remain outside this slice.

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
