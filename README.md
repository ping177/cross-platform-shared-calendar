# Cross Platform Shared Calendar

一个两人共享日历 Web App。v0.1 面向“一个人用 iPhone/iOS Safari，另一个人用 Android/Chrome”的场景，优先做移动端友好的 Web/PWA。

Production URL: https://cross-platform-shared-calendar.vercel.app/

## 当前阶段

- v0.1.10 foundation remains `CLOSED / PASS`; Production includes `v0.1.11 Slice 1 — Navigation Foundation` (`CLOSED / PASS`). Slice 2 Aggregate Calendar is implemented and authenticated-functionally accepted locally; its Production rollout and smoke verification remain pending. Slice 2 iPhone Safari, installed PWA and final 320px device checks are deferred. Overall v0.1.11 remains `IN PROGRESS`; Slices 3–4 have not started. See the [v0.1.11 Navigation + Aggregation Spec](./docs/v0.1.11_NAVIGATION_AGGREGATION_SPEC.md), [v0.1.9 Shared Tasks Spec](./docs/v0.1.9_SHARED_TASKS_SPEC.md), and [Shared Life Architecture Freeze](./docs/SHARED_LIFE_ARCHITECTURE.md).
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
- Shared Lists、Task Reminder、recurring Tasks、纪念日、聊天、相册
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
