# Cross Platform Shared Calendar

共享生活管理 PWA，继续服务用户与分散居住家人的轻量共享日程、任务和提醒需求。目标是完整、精致、可靠、实际可使用的产品，同时作为 AI-assisted product development 的正式作品集案例；商业化可探索，但不是完成产品的必要条件。最初 v0.1 面向 iPhone/iOS Safari 与 Android/Chrome 的两人共享场景，现有 Space、多成员、共享与提醒架构继续保留。

Production URL: https://cross-platform-shared-calendar.vercel.app/

## 当前阶段

2026-10-28 — **独立 Review UI/UX Follow-up CLOSED / ACCEPTED**。用户确认最终 Production 视觉满意并结束本轮；阅读态右滑真机 PASS，其他列明边界为 AUTOMATED PASS / MANUAL NOT RUN，不追加人工验收。双入口保留，业务基线412ad4f8及部署/资源已核验；详见 [Testing](./docs/TESTING.md)。Slice 2 CLOSED / PASS 保持，Slice 3 仅只读调查、未实施；下方 Pending/未发布为历史检查点。

2026-10-28 — 独立Review UI/UX Follow-up正式发布获授权；本地iPhone Safari仅阅读态左缘右滑由用户确认PASS。编辑态、dirty取消四字段保留/确认离开、阅读态标记/已完成去重及旧revision拒绝均待正式PWA人工验收。Node1000/1000、WebKit/Chrome46/46证据及代码指纹保持，不以自动化代替真机。仅原两项前端，正常Commit/Push和既有Vercel Production；部署Source/状态/七项资源结果见/private/tmp/calendar-review-ux-release-20261028/RELEASE_RECEIPT.md，不预写部署成功。无数据库操作；Slice 2 CLOSED / PASS、Slice 1 DEFERRED、Slices 3–5未开始保持。

下方本地未授权/未部署为历史检查点，由本轮授权接续；Follow-up不提前CLOSED。

- 2026-10-28：独立Review UI/UX follow-up本地完成（详情右滑返回/未保存确认、阅读态本人直接“我已填写”），Node1000/1000、WebKit/Chrome46/46、TypeScript/Build PASS。未Commit/Push/部署，等待用户本地iPhone Safari验收；正式PWA新交互待后续单独授权发布，不重新打开Slice 2或启动其他Slice。

- 2026-10-28：**v0.1.21 Slice 2 CLOSED / PASS**，用户确认Production真实验收全部PASS，Review维护解除。已验收功能发布069f6fe5，数据库/缓存、自动化及部署/资源核验均PASS；本轮仅治理收口。v0.1.21整体IN PROGRESS，Slice 1 DEFERRED、Slices 3–5未开始；独立UI/UX反馈见BACKLOG。v0.1.20 CLOSED / PASS保持，下方旧检查点为历史。

- 2026-10-19：v0.1.21 Slice2数据库Patch/Postflight/负向探针由用户报告PASS；兼容前端发布准备READY，等待单独授权；缓存未确认时真实写入验收HOLD。Schema Cache HTTP识别尚未独立核实，前端未Commit/Push/部署，Review继续停写；详见Testing首节。下方2026-10-17为历史本地检查点，v0.1.20 CLOSED/PASS保持。

- 2026-10-17：v0.1.21 Engineering Stability & Data Safety，Slice 2回顾旧稿覆盖保护已完成本地条件保存与隔离验证，LOCAL VERIFIED / REVIEW PENDING，未部署/Commit/Push。Slice1暂缓，Slices3–5未启动；Production仍v0.1.20 CLOSED / PASS。当前前端默认远端Supabase，在新Patch正式授权部署前禁止真实新RPC验收。详见[Testing](./docs/TESTING.md)首节；下方“下一阶段尚未启动”等为关闭v0.1.20时的历史记录。

- 2026-10-16：**v0.1.20 CLOSED / PASS**。全域UI/UX一致性修整及创建表单Space选择器补充均完成，用户在正式installed iPhone PWA确认整轮六项及补充六项全部PASS；已验收业务代码 `b021a41d4d02543e565a121ba6a8cdb17c988361`。本地/Production验证与验收范围见 [Project State](./docs/PROJECT_STATE.md) / [Testing](./docs/TESTING.md)，不代表其他未执行业务测试或整个项目正式试用已完成。
- 下一阶段为**独立工程稳定性审查（尚未启动）**，待用户另行指示后先只读检查，再依据证据决定是否修改；不创建新版本或在本次收口中启动工程工作。以下条目保留各历史阶段事实。

- 2026-10-09 Product Direction Freeze：先建立 Figma ↔ Codex MCP 工作流，完成全应用统一 UI 设计至用户明确满意；再分阶段实施确认设计、完善中英文/i18n、检查试用前安全/隐私/账户/访问体验、家庭与适量外部试用，最后整理演示/设计/项目说明/简历与 LinkedIn 材料。全应用覆盖与候选功能边界见 [Decisions](./docs/DECISIONS.md#product-direction-freeze--2026-10-09)。本轮只记录方向，不配置 MCP、不实施 UI。
- v0.1.20 Mobile Gesture Navigation `CLOSED / PASS`：两个冻结 Scope、focused review、全量788自动测试、Production发布与资产核验，以及用户真实 iPhone installed PWA 13/13 人工检查 PASS。多指取消/busy 未单独人工检查；证据边界见 [Testing](./docs/TESTING.md)。最终 closeout c316b60 已 push、独立远端核验及 docs-only Production 部署成功；后续顺序由上方 Product Direction Freeze 接续。
- v0.1.10 foundation remains `CLOSED / PASS`; v0.1.11 Slices 1–4 and the overall version are `CLOSED / PASS`. Production includes Slice 4; user-reported Desktop and installed PWA acceptance passed. Dedicated final iPhone Safari acceptance is `NOT RUN` and is not a Slice 4 blocker. Independent Slice 3 Event/Task section error/retry simulation remains `NOT RUN / DIFFICULT TO SIMULATE SAFELY`; second Shared Space is `N/A / NOT RUN`. Home “近期日程 +” opens Event creation directly; “需要处理的任务 +” opens Task creation directly. See the [v0.1.11 Navigation + Aggregation Spec](./docs/v0.1.11_NAVIGATION_AGGREGATION_SPEC.md), [v0.1.9 Shared Tasks Spec](./docs/v0.1.9_SHARED_TASKS_SPEC.md), and [Shared Life Architecture Freeze](./docs/SHARED_LIFE_ARCHITECTURE.md).
- v0.1.12 Module Hub + Space Management Navigation、v0.1.13 Space Lifecycle & Membership Safety 与 v0.1.14「回顾」均为 `CLOSED / PASS`。v0.1.14 的 [canonical contract](./docs/v0.1.14_STRUCTURED_CHECKIN_SPEC.md)、backend/date chronology、frontend deployment、public smoke、用户报告的 Production authenticated acceptance 与最终 exact-ID fixture cleanup 均通过；Production Review 数据为 0/0，Shared 与 Personal Review module 保持 enabled。
- v0.1.14.1 Navigation Persistence 已在 Production 完成用户真实账号刷新验收并 `CLOSED / PASS`。v0.1.15 Shared Lists 及 Slices 1–4 均 `CLOSED / PASS`：桌面真实账号、双账号 Realtime、移动端/PWA Item drag 与长列表自动滚动验收通过；full Node 356/356、build PASS。stale reorder `AUTOMATED PASS / MANUAL NOT REQUIRED`；Section drag 按冻结设计延后，既有 bundle warning 均非阻塞。详见 [v0.1.15 Shared Lists Specification](./docs/v0.1.15_SHARED_LISTS_SPEC.md)。
- `v0.1.8 — Mobile Push Reminder` 仍为 `CLOSED / PASS`：Push Infrastructure、ordinary Reminder delivery、Slice 3 Recurrence Reminder Integration 与 final cross-platform acceptance 已完成。v0.1.10 的 Personal Space、多 Space 选择、Event/Task 隔离、A/B Realtime、320px 与 iPhone/PWA 验收已通过；表单打开时切换 Space 与 Shared ↔ Shared 按本轮记录为 N/A，不是失败。整个 v0.1.10 已 `CLOSED / PASS`。
- v0.1.8 Slice 1 已实现并验证 Push-only Service Worker、明确用户操作触发的 notification permission flow、`user + installation` subscription persistence/lifecycle，以及带安全 upstream diagnostics 的 authenticated test-push Edge Function。
- Desktop Chrome/macOS 与 iPhone installed PWA 的真实 Push / automatic Reminder 验收已通过。Android Studio Emulator 的 notification permission/subscription、`send-test-push`、ordinary automatic Reminder、声音与 notification-shade delivery 均通过；未观察到 heads-up banner，且未在实体 Android 硬件上验证该展示行为，这不是 v0.1.8 blocker。
- v0.1.8 Slice 2 已冻结一个 nullable `events.reminder_kind`、per-event canonical IANA `events.time_zone`、新建 timed 默认提前 10 分钟、新建 all-day 默认当天 08:00、历史事件不自动开启提醒，以及普通事件的 past-due / grace / edit-recalculation 规则。
- v0.1.8 Slice B persistence/UI、Slice C ordinary delivery/scheduler 与 Slice 3 recurrence delivery 均已通过 Production acceptance。Slice 3 复用 canonical recurrence projection，并已验收 recurrence-aware ledger identity、独立原子 claim、override/delete/split/current-and-future 语义、bounded occurrence window 与 recurring source UI；DB patch、`send-reminders` v2 与前端均已部署，scheduler、ordinary Reminder 回归及真实 iPhone/Mac 自动 Push 均通过。完整状态见 [Decisions](./docs/DECISIONS.md)、[Backlog](./docs/BACKLOG.md) 与 [Testing](./docs/TESTING.md)。

## v0.1 功能范围

- Supabase Email OTP 登录/注册
- 创建两人共享空间
- 通过邀请码加入空间
- 轮换邀请码
- 创建、查看、编辑、删除日程
- 重复日程 projection、only-this override/delete、current-and-future split/delete
- 今日、本周、本月视图
- 成员显示名称与空间成员列表；个人日程显示成员名称，shared 日程显示「共同」
- 基础 PWA：manifest、mobile meta、可添加到主屏幕

Shared Tasks MVP 的 Space-scoped persistence、member/shared assignment、`open/completed` 与 optional date-only due date 已完成 Production backend postflight。当前 Space 下的最小 CRUD UI 与 Realtime 已部署，Desktop A/B Production 验收和 iPhone mobile smoke 均通过。Task 不自动创建 Calendar Event，也不接入 Reminder。

## 暂不做

- Apple Calendar / Google Calendar / CalDAV / 系统日历同步
- 原生 iOS / Android App
- v0.1.9 内的 Personal Space、多空间切换、模块开关与完整四栏导航（后续方向见架构文档）
- Shared Lists Slices 1–4 与 v0.1.15 均 `CLOSED / PASS`；Section drag 延后且不阻塞。产品与技术边界见 [canonical specification](./docs/v0.1.15_SHARED_LISTS_SPEC.md)。Task Reminder、recurring Tasks、纪念日、聊天、相册
- 复杂 service worker 离线缓存

## 本地开发

1. 安装依赖：

   ```bash
   npm install
   ```

2. 创建本地环境变量：

   ```bash
   cp .env.example .env
   ```

3. 填写 `.env`：

   ```bash
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   VITE_VAPID_PUBLIC_KEY=your-public-vapid-key
   ```

   `VITE_SUPABASE_URL` 必须止于 `.supabase.co`，不能包含 `/rest/v1/` 或其他 API 路径。
   `.env` 已加入 `.gitignore`，不要提交真实环境变量。

4. 启动开发服务器：

   ```bash
   npm run dev
   ```

## Supabase SQL

在 Supabase SQL Editor 中执行：

```sql
-- supabase/schema.sql
```

该文件包含：

- `profiles`、`spaces`、`space_members`、`events`、`tasks` 等当前 bootstrap 表
- indexes
- RLS policies
- `create_space_with_invite(space_name text)`
- `join_space_by_invite_code(code text)`
- `rotate_invite_code(space_id uuid)`
- `updated_at` trigger
- event owner 校验 trigger
- `push_subscriptions`、subscription lifecycle RPC 与最小权限边界

`events` 使用稳定归属模型：

- 共同日程：`scope = 'shared'` 且 `owner_user_id is null`
- 个人日程：`scope = 'personal'` 且 `owner_user_id` 是空间成员
- personal 日程标签显示 owner 的 `profiles.display_name`；名称缺失时安全显示「成员」，shared 日程显示「共同」
- 两位成员都可查看 personal 日程，但只有 `owner_user_id` 本人可编辑或删除。
- shared 日程允许两位空间成员编辑或删除。

已有 Supabase 环境不要重新执行整份 schema。按版本执行 `supabase/patches/` 中对应的增量 SQL，并先完成该版本文档要求的 preflight 检查。

## v0.1.8.1 Push Infrastructure 配置

已有 Supabase 环境应执行
`supabase/patches/2026-09-18-v0.1.8.1-push-infrastructure.sql`，为
`send-test-push` 配置 `VAPID_SUBJECT`、`VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_KEY`
secrets，再部署该 Edge Function。`VAPID_PRIVATE_KEY` 只能存在于 Supabase secret 中，不能
进入 Git、浏览器环境变量或日志。

Vercel 只配置与服务端同一 key pair 对应的 `VITE_VAPID_PUBLIC_KEY`，然后重新部署。Desktop
Chrome/macOS 与 iPhone installed PWA 的 Slice 1 验收已经通过；详细证据见
[Testing](./docs/TESTING.md)。Android permission、subscription、foreground/background/closed-app
delivery、notification click 与 logout lifecycle 统一留到最终 v0.1.8 cross-platform acceptance。

## Email OTP 登录

v0.1.5 使用 Supabase Email OTP。用户在当前浏览器或 PWA 中输入邮箱，收到 8 位验证码后直接完成登录，不再依赖邮件 App 回跳。

在 Supabase Dashboard 的 Authentication -> Email Templates 中，将密码less 登录邮件模板配置为包含 `{{ .Token }}` 的验证码邮件，而不是仅包含 `{{ .ConfirmationURL }}` 的 Magic Link。确认 Email Provider 已启用。

保留现有 Site URL 与 Redirect URLs 配置，供其他可能使用邮件链接的 Auth 功能与既有环境配置使用；Email OTP 登录本身不依赖回跳。

## 验证与测试

完整测试命令、smoke checklist 和生产验收记录请见：

- [Testing](./docs/TESTING.md)

## 常用命令

```bash
npm run dev
npm run build
```

## Project State Push Gate

本仓库提供可选的本地 `pre-push` gate。它要求在已经取得用户明确 commit / push
授权后，人工复核 `docs/PROJECT_STATE.md` 的 `Current version`、`Current status`、
`Next Action`、`Blockers`、`Version Index`，以及受影响时的 `Deployment`。最终 branch
commit 只能保留一个 trailer：最终 tree 相对远端 branch tree 的
`docs/PROJECT_STATE.md` 有净差异时使用 `Project-State-Review: updated`；无净差异时
使用 `Project-State-Review: verified-current`。

Gate 还执行 forward-only version governance：只检查本次相对远端新增到 `Current version`
或 `Version Index` 的正式版本 token，并要求使用 `v0.8`、`v0.8.2`、`v0.6.6.1`
这类纯数字 canonical version。仓库已有的 legacy token 保持 grandfathered，不会被回溯
重写或重新判错。Gate 不判断版本对应的业务状态是否真实，人工 Project State Review 仍是
必需步骤。

安装（仅在需要启用本地 hook 时执行）：

```bash
sh scripts/install-git-hooks.sh
```

可在 Git work tree 中把 Git 传入的 ref 行交给检查脚本手动检查：

```bash
printf '%s\n' "refs/heads/main <local-commit> refs/heads/main <remote-commit>" | sh scripts/check-project-state-push.sh
```

Tag 不做远端 tree 分类或 version-diff 分类：lightweight 或 annotated tag 都只要求最终
指向的 commit 有一个合法 trailer。`git push --no-verify` 可绕过客户端 hook，hook 也可
被本地修改或删除；这是本地治理 gate，不是不可绕过的安全边界。它不判断
PROJECT_STATE 内容真实性，不会自动 commit 或 push，也绝不替代用户明确授权。

Gate 集成测试使用临时本地 Git 仓库和 bare remote，不访问网络：

```bash
node --test tests/project-state-push-gate.test.js
```

## Development docs

- [AI/Codex collaboration rules](./AGENTS.md)
- [Development log](./docs/DEVLOG.md)
- [Decisions](./docs/DECISIONS.md)
- [Backlog](./docs/BACKLOG.md)
- [Testing](./docs/TESTING.md)
