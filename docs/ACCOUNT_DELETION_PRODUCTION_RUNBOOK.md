# Account Deletion — Production Mode Preparation / Release Gates

Author: Ping Weng。2026-11-06。正式v0.1.21，**仅本地准备，不是上线授权**。所有步骤均待独立审查与授权，本轮未执行线上操作。

## 1. 控制边界

| 层 | 配置/对象 | 默认与用途 |
|---|---|---|
| DB真实受理 | private.account_deletion_admission | P3创建唯一行，enabled=false、allowed_user_ids=NULL。无客户端/service_role权限。仅受控owner设置；NULL允许所有合格身份，空数组不允许任何身份，非空数组仅允许指定UUID。只控制新accepted，不控制已有任务 |
| Edge运行 | ACCOUNT_DELETION_RUNTIME_MODE | 未配置拒绝所有调用；production只允许固定ximazjhxvmktpcdbypka HTTPS URL，isolated-local仅本地HTTP |
| Edge新验证/确认 | ACCOUNT_DELETION_ACCEPT_NEW | 只有字面true开放begin/verify/confirm；默认关闭，不阻止cancel/work/receipt。可选ACCOUNT_DELETION_ACCEPT_USER_IDS逗号UUID列表，非空则限制用户；数据库允许列表才是防直接RPC的最终边界 |
| Edge worker | ACCOUNT_DELETION_WAKE_SECRET | 独立32随机字节的64hex服务器能力；只接受action=work，无目标参数。不是user JWT、service JWT或apikey授权 |
| Edge receipt | 原短期receipt token | 只返回状态，不依赖Auth仍存在，不受新受理开关影响 |
| 前端运行/恢复 | VITE_ACCOUNT_DELETION_RUNTIME_MODE=production | 固定正式host和项目，开启Root隔离、历史标记及回执。未配置保持原默认关闭；后端完整对齐后才可设置 |
| 前端入口 | VITE_ACCOUNT_DELETION_ENABLED | 只有true显示入口并允许新请求；false仍保留正式运行模式的Root/回执/cancel。不重设计UI |

DB确认在既有账号锁之后取得受理配置行FOR SHARE，持有至commit。owner关闭同一行需等先前确认事务结束；关闭成功后后来的确认无法受理。配置更新事务只能操作该单行，不与Space/账号/job操作混在同一事务，避免反向锁序。已accepted重放仍返回同一状态，不因停止新受理撤销既有job。worker不读取该门禁。

**暂停顺序：先owner关闭DB enabled并确认提交，再关Edge新受理/前端入口；保持Edge runtime、wake能力、Cron及前端运行/回执能力。** 单关Edge不足以阻止尚有效许可直调RPC。不要关掉整个runtime或卸载权限屏障来暂停新入口。

## 2. Secrets / 网关 / Cron配置边界（未执行）

- SUPABASE_URL、SUPABASE_ANON_KEY、SUPABASE_SERVICE_ROLE_KEY沿用托管Edge提供的配置；验证存在且对应目标项目，不导出或打印值。service key仅Edge运行时，不能给浏览器、Cron命令或本机前端。无数据库owner连接凭据进入Edge。
- 单独为account-deletion设verify_jwt=false（本地config.toml已声明），不改变两个提醒函数各自设置。这让非JWT worker/回执能到handler，不代表匿名管理授权：用户调用必须Auth.getUser、原session/同UUID OTP/许可；worker必须独立能力；receipt必须随机短期只读token。apikey不能替代以上任一授权。
- 后续在受控Secret管理界面生成/配置wake能力，Vault内保存同一值；可以另存供gateway使用的项目public apikey。由受控owner设置Vault，不读回值，不放入SQL脚本、命令历史、截图或日志。两边配置不匹配时worker应403、job保留重试，不能误completed；修复配置后同job继续。
- 后续调度仅向固定`https://ximazjhxvmktpcdbypka.supabase.co/functions/v1/account-deletion` POST `{"action":"work"}`；headers含Content-Type、Authorization=Bearer+Vault窄wake能力，以及经托管gateway验证所需的项目public apikey。不能在body选择UUID/job/path/stage。
- 由owner创建private无参数唤醒包装，固定URL/body，在服务器内读取指定Vault能力；撤销PUBLIC/anon/authenticated/service_role EXECUTE，单一每分钟Cron调用该包装。先无调度鉴权与idle核验，再开启Cron。**本轮不提供含凭据的可执行脚本，不直接复用tests/local_cron.sql。**
- 托管net平台默认grant不做REVOKE或RLS变更。排队headers可被DB可达角色读取；保持API只暴露public/graphql_public，无秘密读取/泛用SQL包装，DB LOGIN均须可信。Vault只保证静态存储边界，不隐藏出队前明文。遵守已接受平台责任边界，不重新调查E4。
- 先确认Cron/pg_net/Vault owner权限与实际HTTP结果；Cron自身run success不等于worker成功。监测脱敏status/错误码、重试延迟、过期租约和needs_attention，不读取请求头、OTP/JWT、用户内容或完整函数请求日志。

## 3. 精确发布顺序（全部未来动作）

1. **G0 审查与元数据锁定：**审查当前本地diff/测试，逐项核对已取得Q1–Q5约束/owner/ACL，确认无部分应用或新漂移；既有平台安装权限及运维负责人明确。任何不一致HOLD。
2. **P1** `2026-11-05-account-deletion-audit-snapshots.sql`：精确9引用及额外依赖门禁；postflight仅移除四历史FK，活身份/归属保护仍在。未知FK/动作/重放停。
3. **P2** `2026-11-05-account-deletion-barrier.sql`：含已本地验证的两历史MD5精确兼容；private namespace/15表RLS/Storage精确策略与触发器权限均满足。postflight账号屏障/正常用户/普通Personal保护/Review不放宽；跳过Storage guard不算通过。
4. **P3** `2026-11-06-account-deletion-trusted.sql`：受限角色/五摘要/OTP/业务清理；新增admission私有行必须enabled=false且无应用/service权限。确认DB直调持有效许可也不能在关闭时受理。不产生任何真实意图。
5. **P4** `2026-11-06-account-deletion-execution.sql`：两中间摘要/租约/完成器/receipt/ACL；旧unleased清理权限确实撤销。DB admission继续false。
6. **P5** `2026-11-06-account-deletion-frontend-contract.sql`：同名对象不存在、窄撤销与Review标记仅正确角色可执行。所有patch各自事务postflight后才下一步，不按通配符运行、不整份覆盖schema、不盲目重放。
7. **通知Edge：**P2通知RPC已就绪后更新原两个提醒入口；保留verify_jwt、原单一调度、去重/预算；正常合成提醒验收有回归即停。
8. **新Edge：**production模式、正式精确CORS、单函数gateway配置；Edge ACCEPT_NEW=false、DB admission=false。设置服务器能力，完成无/错/交叉凭据、apikey不能独立授权、恶意Origin、receipt检查；只配置不开放新受理。
9. **后台：**经授权设置Vault/固定owner包装、验证idle HTTP，再启用单一Cron。无用户Session也能继续；错误/崩溃可重试或attention。没有可靠后台不得开放新受理。
10. **前端暗发布：**后端能力核验后，VITE runtime=production、入口false；Root/receipt不与入口共用关闭条件。精确确认Vercel Source与alias，用户关闭旧标签并重启PWA。不要仅Push文档假设不会自动部署。
11. **合成门禁：**另授权新建Production合成账号/空间（绝不两个闲置账号），DB allowed_user_ids限制为这些合成UUID，再开启DB/Edge受理（Edge列表同范围）；在受控前端验收。真实OTP/iPhone/Android/PWA操作由用户。验证关闭入口仍离线完成、Shared ID/正文/Review权限、Storage/Auth不存在、completed严格判定与回执。正常用户不受影响。不用本地HTTP映射替代托管gateway实测。
12. **正式开放：**所有门禁通过后单独授权DB允许范围/Edge与前端新入口；保留runtime/worker/receipt。出现异常按第1节先停新受理，不回退屏障或重新激活账号。

## 4. 停止与恢复

任何前置摘要/ACL/Owner/Storage保护不符、通知回归、独立Cron失败、Shared误删或提前completed均停止后续步骤。已知清理异常needs_attention保持隔离，受控owner修复后恢复同job。代码/入口开关可独立退回关闭；已发生永久删除不可逆，历史FK不能无条件加回。数据库采用新审查的forward corrective，不承诺一键rollback。任何已受理任务存在时不能以关掉runtime/Cron作为常规回滚。

本地已验证与托管待验项目见readiness最新节；本轮未配置任何Production Secret/Cron/Vault/gateway，未部署或创建/删除线上账号。

## 5. 正式开放（已完成本地验证，待发布）

本节以已通过的账号 A 线上试点及 GA 隔离回归为依据，取代第 3 节第 11–12 步原规划的发布路径。GA 放行检查不要求再删除真实 Production 账号。

只需应用 `2026-11-09-account-deletion-general-availability.sql`。该补丁要求 DB 受理已关闭，只对齐准备 RPC 和最终受理 RPC 的名单语义。关闭时仍拒绝，开启且名单为 NULL 时允许符合条件的已认证用户，空数组拒绝所有人，非空数组按名单限制。前端和 Edge 已具备全量配置路径。

1. **入口保持关闭。** 确认 Vercel 正式产物的全局入口为 false、DB 与 Edge 双受理均为 false。保留历史任务和回执。先应用 SQL 补丁，核对准备 RPC 新摘要 `a88c998442071e5cd87a0191c3d8a233`、原权限和仍为 false 的数据库开关。
2. **清除服务端试点名单。** 在双门禁仍关闭时，由数据库 owner 将 singleton 的 `allowed_user_ids` 设为 NULL。移除 Edge 的 `ACCOUNT_DELETION_ACCEPT_USER_IDS`，回读验证名单已清除。
3. **先开服务端，再开放入口。** DB 仍为 false 时设 Edge `ACCOUNT_DELETION_ACCEPT_NEW=true`，验证运行配置。此时准备和最终受理仍受 DB 阻断。确认名单已清除且 Worker 正常后，由 owner 将数据库 singleton 的 `enabled` 设为 true，回读两层状态。随后才配置 Vercel Production 的下一份构建。保留 `VITE_ACCOUNT_DELETION_RUNTIME_MODE=production`，移除 `VITE_ACCOUNT_DELETION_PILOT_USER_ID`，设置 `VITE_ACCOUNT_DELETION_ENABLED=true` 并发布。验证正式别名对应的构建包含新入口配置。
4. **紧急关闭。** 先将 DB `enabled` 设为 false，再设 Edge `ACCOUNT_DELETION_ACCEPT_NEW=false`。随后将 Vercel 全局入口设回 false 并发布关闭版。保留 Production runtime、Worker、Cron 和回执，以继续处理已受理任务。

Edge v6 沿用现有 Auth 身份绑定、OTP、最终确认、Owner 检查和回执逻辑。无需重新部署 Edge 或同步 Supabase Auth 配置。发布只读核对邮件模板、已有任务、Worker 与 Cron。任一层回读不一致时停止公开前端入口。
