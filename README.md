# Cross Platform Shared Calendar

一个两人共享日历 Web App。v0.1 面向“一个人用 iPhone/iOS Safari，另一个人用 Android/Chrome”的场景，优先做移动端友好的 Web/PWA。

Production URL: https://cross-platform-shared-calendar.vercel.app/

## v0.1 功能范围

- Supabase Magic Link 登录/注册
- 创建两人共享空间
- 通过邀请码加入空间
- 轮换邀请码
- 创建、查看、编辑、删除日程
- 今日、本周、本月视图
- 用标签区分「我的 / 对方的 / 共同的」
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
- UI 中的「我的 / 对方的 / 共同的」根据当前登录用户动态计算
- 两位成员都可查看 personal 日程，但只有 `owner_user_id` 本人可编辑或删除。
- shared 日程允许两位空间成员编辑或删除。

已有 Supabase 环境不要重新执行整份 schema。按版本执行 `supabase/patches/` 中对应的增量 SQL，并先完成该版本文档要求的 preflight 检查。

## Magic Link Redirect URL

v0.1 默认使用 Supabase Magic Link。需要在 Supabase Dashboard 配置 Auth URL：

1. 打开 Supabase Dashboard。
2. 进入 Authentication -> URL Configuration。
3. 将本地开发地址加入 Redirect URLs，例如：

   ```text
   http://localhost:5175
   ```

4. 部署后将 Site URL 配置为稳定 Production URL，并将该地址加入 Redirect URLs：

   ```text
   https://cross-platform-shared-calendar.vercel.app/
   ```

当前还保留 `http://192.168.10.6:5175` 作为临时局域网手机测试 Redirect URL；它不是长期稳定地址，也不应替代 HTTPS Production URL。

iOS / Android 上邮件 App 可能用 Safari、Chrome 或内置浏览器打开登录链接。测试 Magic Link 时，最终回跳的域名必须在 Supabase 允许列表中。

如果 Magic Link 明显影响本地测试效率，再评估是否临时加入 email/password；v0.1 默认不启用多种登录方式。

## 验证与测试

完整测试命令、smoke checklist 和生产验收记录请见：

- [Testing](./docs/TESTING.md)

## 常用命令

```bash
npm run dev
npm run build
```

## Development docs

- [AI/Codex collaboration rules](./AGENTS.md)
- [Development log](./docs/DEVLOG.md)
- [Decisions](./docs/DECISIONS.md)
- [Backlog](./docs/BACKLOG.md)
- [Testing](./docs/TESTING.md)
