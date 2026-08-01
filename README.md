# Cross Platform Shared Calendar

一个两人共享日历 Web App。v0.1 面向“一个人用 iPhone/iOS Safari，另一个人用 Android/Chrome”的场景，优先做移动端友好的 Web/PWA。

Production URL: https://cross-platform-shared-calendar.vercel.app/

## v0.1 功能范围

- Supabase Email OTP 登录/注册
- 创建两人共享空间
- 通过邀请码加入空间
- 轮换邀请码
- 创建、查看、编辑、删除日程
- 今日、本周、本月视图
- 成员显示名称与空间成员列表；个人日程显示成员名称，shared 日程显示「共同」
- 基础 PWA：manifest、mobile meta、可添加到主屏幕

## 暂不做

- Apple Calendar / Google Calendar / CalDAV / 系统日历同步
- 原生 iOS / Android App
- 多团队/多空间切换
- Todo、纪念日、聊天、相册
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

- `profiles`、`spaces`、`space_members`、`events`
- indexes
- RLS policies
- `create_space_with_invite(space_name text)`
- `join_space_by_invite_code(code text)`
- `rotate_invite_code(space_id uuid)`
- `updated_at` trigger
- event owner 校验 trigger

`events` 使用稳定归属模型：

- 共同日程：`scope = 'shared'` 且 `owner_user_id is null`
- 个人日程：`scope = 'personal'` 且 `owner_user_id` 是空间成员
- personal 日程标签显示 owner 的 `profiles.display_name`；名称缺失时安全显示「成员」，shared 日程显示「共同」
- 两位成员都可查看 personal 日程，但只有 `owner_user_id` 本人可编辑或删除。
- shared 日程允许两位空间成员编辑或删除。

已有 Supabase 环境不要重新执行整份 schema。按版本执行 `supabase/patches/` 中对应的增量 SQL，并先完成该版本文档要求的 preflight 检查。

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

安装（仅在需要启用本地 hook 时执行）：

```bash
sh scripts/install-git-hooks.sh
```

可在 Git work tree 中把 Git 传入的 ref 行交给检查脚本手动检查：

```bash
printf '%s\n' "refs/heads/main <local-commit> refs/heads/main <remote-commit>" | sh scripts/check-project-state-push.sh
```

Tag 不做远端 tree 分类：lightweight 或 annotated tag 都只要求最终指向的 commit 有一个
合法 trailer。`git push --no-verify` 可绕过客户端 hook，hook 也可被本地修改或删除；
这是本地治理 gate，不是不可绕过的安全边界。它不判断 PROJECT_STATE 内容真实性，不会
自动 commit 或 push，也绝不替代用户明确授权。

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
