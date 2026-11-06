# Account Deletion — Production Readiness Preflight

Author: Ping Weng。调查日期：2026-11-06；主要证据截至06:54 UTC。正式版本 **v0.1.21**。

Status: **PRODUCTION_READINESS_REVIEW**。上线判断：**HOLD / NOT AUTHORIZED**。本报告记录本地前端里程碑及其后的只读调查，不是Production PASS、DEPLOYED或CLOSED；没有执行任何迁移、配置修改、账号创建/删除、Push或Deploy。

## Production Mode Local Preparation — 2026-11-06（最新）

**PRODUCTION_MODE_LOCAL_READY_FOR_REVIEW / PRODUCTION_READINESS_HOLD**。正式v0.1.21、HEAD f259f0d与此前所有未提交成果保留。仅本地代码/测试/治理，无Production迁移、Secrets/权限/网关设置、Push/Commit/Deploy或真实账号操作。精确发布/配置与停止步骤集中在[Production runbook](./ACCOUNT_DELETION_PRODUCTION_RUNBOOK.md)。下方旧模式缺失/E4待查询描述均为历史，以本节为准。

### E4权限补证关闭

用户已提供：public.rls_auto_enable()返回event_trigger；SECURITY DEFINER，owner postgres；ensure_rls绑定ddl_command_end，tags为CREATE TABLE/CREATE TABLE AS/SELECT INTO；anon/authenticated有EXECUTE但无public CREATE；无table trigger绑定，无API包装文本提示。这是DDL事件触发器上下文，不是普通业务RPC；结合已确认exposed schemas和E2/E3，没有发现普通App用户直接执行任意DDL的路径。**本项调查关闭，不追加E5/E6，不REVOKE/改写该平台保护。** 不把文本扫描当全库安全证明，也不把EXECUTE谓词误读成REST可执行授权。

### 本地实现

- runtime.ts增加固定项目HTTPS production模式；isolated-local仍只接受本地HTTP。正式CORS只有cross-platform-shared-calendar.vercel.app精确Origin，无任意Preview/localhost混用。默认未配置runtime仍503；production新受理默认关闭。
- 单函数config verify_jwt=false是为worker非JWT能力/匿名短期回执到达handler；Auth.getUser+session/OTP、独立worker capability、回执三边界仍各自校验。不开全局JWT绕过，不给浏览器service key，不接受work任意UUID/path/job。托管gateway行为仍需真实验收。
- Edge ACCEPT_NEW仅控制begin/verify/confirm，不控制work/receipt/cancel。可选合成UUID名单限制Edge入口。全局runtime不是常规停新受理开关。
- **核对发现并封住直调路径：**原有效许可可绕开Edge开关直调accept_my_account_deletion。因此在未部署的P3/canonical中新增private.account_deletion_admission唯一配置行，默认enabled=false，无anon/authenticated/service_role权限；可选allowed_user_ids在DB限制合成身份。确认函数持配置行FOR SHARE至事务提交，owner关行后新的确认失败；已accepted重放不撤销任务。配置owner更新不混入业务锁事务。不是通用权限框架，无新队列/执行器。P2精确历史兼容保持；其余业务算法与受理证明保持。
- 前端固定正式host/项目的production runtime与入口开关拆分；入口false仍保留Root active核对、回执轮询/cancel、历史身份标记。未设置正式runtime保持原默认关闭/旧后端兼容。现有UI布局不变。

### 本地验证与范围

- `python3 -B supabase/tests/account_deletion_production_local.py`：**17项真实本地断言PASS**。真实Auth/SMTP OTP/PostgREST/Storage/Edge及原生Cron/pg_net/Vault：默认拒绝、用户/worker凭据交叉拒绝、有效许可直调RPC关闭/名单拒绝、正常用户业务、旧JWT隔离、Storage API失败/重试/Auth失败不提前完成、关闭受理后无用户/PWA后台完成、Shared/Review ID正文关联保留、目标头像不可读、Auth删除后receipt可查。
- 正式模式要求固定HTTPS项目；测试仅在临时bundle将该URL传输映射到内部隔离HTTP服务，Docker网络internal，无Production网络访问。配置切换真实重建自有Edge进程/环境变量，不在生产处理器加入测试入口或配置文件读取。**未验证真实TLS/托管gateway/Vercel/CORS浏览器实际部署。** 本地Cron沿用隔离平台owner fixture，不能照搬它的REVOKE到托管环境。
- `python3 -B supabase/tests/account_deletion_local.py --trusted`：**828 SQL断言、28并发、2隔离级别检查**及fresh/upgrade schema+ACL一致；增加3×2项私有受理表权限断言。原P2未知摘要拒绝保持。该层Auth/Storage是SQL fixture，不算真实服务证据。
- 相关Node **31/31**、Chrome/WebKit原注销/邮箱/导出 **44/44**、`deno check --cached-only supabase/functions/account-deletion/index.ts`、`npm run build`及diff检查PASS。Build保留原chunk提示。Node正式Origin/无错凭据/目标拒绝/关受理不关worker-receipt属于模拟HTTP测试；真实服务17项单独计数。
- 测试中修正过临时传输Request转发、不可变环境模拟及Storage合成文件名；最终用真实环境重启与合法UUID路径验证。浏览器首次沙箱启动失败，正常权限缓存浏览器重跑44项通过；未安装依赖/修改系统安全设置。所有测试容器仅自有缓存/tmpfs合成身份，已清理，不使用任何真实账号或两个闲置账号。

### Production待配置 / 待验收（不是本地失败）

**待配置且需另授权：**逐步P1→P2→P3→P4→P5及各owner/ACL/postflight；更新两个通知Edge；新Edge固定production模式、ACCEPT_NEW=false、独立服务器能力及单函数gateway；安全Vault/固定owner唤醒包装/单一Cron；前端runtime=production但入口false。DB受理行保持false。无任何真实Secret值读取/写入。

**待实际验收：**托管网关对apikey/Authorization/用户JWT/自定义worker能力/receipt的真实拒绝与放行；托管Storage安装权限/失败边界；Cron HTTP实际执行、运维attention恢复；独立授权新Production合成身份（DB+Edge名单限制）及Shared/OTP/关闭入口后离线完成/receipt；正常提醒/旧PWA、Vercel实际Source及真实iPhone/Android/PWA由用户完成。现有元数据已收口部分不重复调查，完整约束/角色/部署前防漂移核对仍按runbook执行。

**当前可进入本地diff审查及后续独立发布授权评审，不能直接执行Production迁移或开放功能。** 关闭新受理必须DB先false并提交，再关Edge/前端入口；不要关runtime/worker/receipt。任何权限/Shared/完成判定异常停止后续并维持已受理任务隔离，采用前向修复而非撤保护。

## Local Compatibility Fix & E1–E3 Closeout — 2026-11-06（最新）

状态：**LOCAL_COMPATIBILITY_READY_FOR_REVIEW / PRODUCTION_READINESS_HOLD**。HEAD f259f0d、v0.1.21保持；保留此前所有修改。本轮仅改P2部署前置门禁及隔离测试，不改canonical/runtime函数、其余四patch、线上权限或已验收前端。无Commit/Push/Deploy。

### 1. 新增用户报告如何解释

- **Dashboard exposed schemas仅public、graphql_public：**实际配置证据覆盖E2/E3的schema范围，不再把未知额外exposed schema当本轮阻塞；只读观察，不修改设置。
- **E1 No rows：**SQL从pg_db_role_setting开始且CROSS JOIN unnest后筛两种键，因此只是该catalog筛选没有匹配设置；SELECT列表里的current_setting也不会独立返回一行。不能推断PostgREST无配置或默认权限安全；实际schema名单由Dashboard补足。
- **E2无敏感对象直接文本命中：**只检查两个schema的prokind=f函数正文关键字，不是完整调用图/动态SQL解析，不能证明所有间接调用安全。rls_auto_enable的dynamic标记与anon_callable=true需分开解释。
- **E3 No rows：**SQL不以敏感命中或SELECT权限过滤，空结果表示当时这两个schema内没有relkind=v/m对象；不是“所有view安全”，也不覆盖函数、其他schema视图、动态包装或直接DB登录。
- Q5默认队列SELECT=true保持平台约束解释：Data API配置收窄了直接暴露风险，但所有DB LOGIN信任边界、有效角色/默认ACL及包装调用仍需证据；不REVOKE、不读队列/Vault实际行。

### 2. rls_auto_enable：定向证据边界

[Supabase官方事件触发器示例](https://supabase.com/docs/guides/database/postgres/event-triggers)包含用于自动启用RLS的动态DDL；[PostgreSQL17触发器说明](https://www.postgresql.org/docs/17/plpgsql-trigger.html)区分普通函数与event_trigger上下文。仅名字相同不能断言线上就是官方实现。E2 anon_callable是USAGE+EXECUTE权限谓词，没有检查返回类型、事件绑定或PostgREST可执行条件。

**若实际为PL/pgSQL、无参数、returns event_trigger：**它需要事件触发器调用上下文，普通SQL/RPC不能凭EXECUTE grant把它当普通函数执行。动态DDL可能用于自动启用RLS，并不自动等于任意SQL注入/秘密读取。调用链还须确认事件/标签/owner、客户端是否拥有相关DDL或可调用DDL包装能力。不要在线尝试调用该函数来“证明安全”。

当前未提供实际returns_type/语言/绑定/owner信息，**不标该项PASS，也不将其直接定为公网漏洞**。仅追加现有EXPOSURE_METADATA_READONLY.sql **E4**：返回这一个函数名的所有签名、返回类型/语言/owner/安全配置/ACL、事件与行触发器绑定、public CREATE权限及包装文本提示；不返回函数体、不执行函数。NULL绑定、普通返回类型、未知包装或额外DDL权限都需定向解释后再收口；不做无关权限重构。完整函数源码不是本轮默认索取项。

### 3. P2最小修复及验证

P2仍逐签名核对9个函数；只对ensure_personal_space()/join_space_by_invite_code(text)分别额外接受两个已核实的v0.1.10 MD5：8a0d5b46299e724c5cfa25756504ec11 / a3ef55f1c186a61ab9781a4a7446b4f6。原canonical MD5保留；每条新增条件绑定精确签名，未知摘要依然失败。没有正则归一化、通配匹配或增加expected行导致错误计数。P2原namespace/FK/RLS/Storage保护及事务门禁不动，业务函数替换体不动。Q3B补充canonical匹配列与同样的精确历史兼容判断，避免继续误报此已审查版本。

先测试后修复：旧patch下--historical-baseline实际失败于baseline drift，容器清理完成；不是把Docker沙箱权限错误当业务RED。正常权限执行自有缓存/无网络/tmpfs容器后获得真实RED。修复后：

- `python3 -B supabase/tests/account_deletion_local.py --historical-baseline`：PASS。实际安装历史函数定义→P1/P2升级提交→全套现有相关SQL/并发；fresh/upgrade schema+ACL一致。
- `python3 -B supabase/tests/account_deletion_local.py --barrier`：PASS。canonical基线升级与fresh一致。
- **每次**794 SQL断言、28并发场景、2个非READ-COMMITTED拒绝检查；另逐个给两函数加入未经审查注释，确认未知摘要拒绝，schema/ACL与15业务表数据指纹不变。两路径合计4个未知版本拒绝场景；原重复patch拒绝、生命周期/Lists/Event/Review/审计保护继续通过。
- Python语法与git diff --check通过；未改React或Edge业务代码，不重复Build/Node/Auth/Storage完整套件。Auth为SQL stub、Storage为SQL policy fixture，**不是Production或真实跨服务新PASS**。自有容器已清理，无既有业务库访问。

### 4. 五patch顺序与当前门禁

准确顺序继续是P1 audit-snapshots → P2 barrier → P3 trusted → P4 execution → P5 frontend-contract（完整日期文件名见§5）。P1精确9 FK/无额外Auth依赖、P2 private namespace及15表/Storage精确policy/owner能力、P3角色/5项中间摘要、P4租约/owner ACL与2项摘要、P5同名对象/完整完成合同均须逐步核验。P2历史格式阻塞现已**仅本地修复并验证**，未在线应用。

已验证：用户报告的PG/隔离/扩展/保护存在；历史函数摘要来源；两个schema实际配置；E1/E3查询范围解释；本地严格升级兼容。尚待核验：E4实际元数据、完整Q1/Q2/Q3A/Q4/Q5安全结果的逐项约束/默认ACL/角色与LOGIN信任检查、托管Storage对象安装权限、真实迁移记录与各patch后置能力。扩展存在不代表Cron/pg_net调度和授权配置完成。

**实际发布阻塞：**Production模式/CORS/单函数gateway、分离停新受理与维持worker/receipt的适配尚未实施；服务端窄凭据/Vault/后台实际调用与运维责任、Edge/Vercel配置及合成Production/用户设备门禁仍未通过。这里仅保留已有独立门禁，不重新大范围调查。旧客户端正常路径预计兼容，不能据本轮fixture替代线上验证；任何未来迁移漂移或权限异常即停，已有accepted不得撤屏障，数据迁移采取前向修复。

下一最小动作：审查本地P2差异与测试；用户只补E4并反馈既有安全结果用于剩余精确对照。无需重跑Q0–Q5/E1–E3，不索取密钥/请求头/用户记录，不申请直接上线。

下方Evidence Review为前轮历史，关于P2“必拒绝/未修复”和schema未知的描述以本节为准。

## Production Catalog Evidence Review — 2026-11-06（当前结论）

**MIGRATION COMPATIBILITY HOLD / PRODUCTION_READINESS_REVIEW**。用户已成功执行Q1–Q5；以本轮提供的结果摘要作为用户报告证据，不再将“catalog通道超时”当当前阻塞。原超时记录仅历史。尚未提供原始JSON/完整ACL列表，不能声称已经逐行核对。没有执行Production写入或修改任何patch。

### A. 已核实与证据边界

| 证据 | 已有用户报告 | 仍不足以证明 |
|---|---|---|
| Q1 | PG17.6、READ COMMITTED；现有业务表RLS启用；cron1.6.4/net0.20.3/Vault0.3.1 | 扩展实际健康/调度能力、Storage安装guard所需owner权限；完整列/namespace/角色权限未逐行获取 |
| Q2 | 四created_by依赖仍在；tasks→profiles CASCADE风险确实待解 | P1精确9条的约束名/列/动作及跨namespace额外依赖需原结果逐项对照，不仅凭结构摘要放行 |
| Q3A/B | 其余已存在受检函数摘要匹配；未部署的注销函数NULL符合前置阶段 | MD5不覆盖owner/ACL/search_path/返回类型，不能以摘要代替授权检查 |
| Q4 | 原Personal/Shared/Storage保护存在启用，RLS策略存在 | 完整角色范围、permissive/restrictive、默认ACL及有效权限组合仍需安全结果列表 |
| Q5 | anon/authenticated队列及headers SELECT=true；service_role可访问Vault | 不能直接推出匿名HTTP泄露；也不能据此证明所有LOGIN都可信或包装RPC无泄露 |

### B. 两函数摘要的准确来源（本地逐字提取prosrc并计算MD5）

| 函数 | canonical迁移前 / P2 expected | v0.1.10历史patch / Production reported | P2实施后 |
|---|---|---|---|
| ensure_personal_space() | 5a0443ce56e48fc97286beeec613ce05 | 8a0d5b46299e724c5cfa25756504ec11 | dd860e2fd877d10e3703a93b8ef9f05b |
| join_space_by_invite_code(text) | 3760c175a4ff5c1972b858e722272280 | a3ef55f1c186a61ab9781a4a7446b4f6 | e40083fae4e6a2e60d08575c4dddba5a |

来源：2026-09-23-v0.1.10-multispace-foundation.sql的219/252行；schema.sql初始779/812行；P2 barrier 358/392行（canonical追加3800/3834行）。实际两个摘要逐字匹配历史patch，且历史与canonical基线diff仅空行/SQL换行变化，字符串、权限判断、Personal保护、成员上限与锁语句不变。此结论来自实际diff，不把通用“去空白”当SQL语义验证方法。

P2 expected是**执行前**canonical函数体，不是实施后值；P2新增的是入口`private.assert_active_account(auth.uid())`。因此不是“Production已提前安装屏障”，也不是发现业务逻辑漂移。无需读取线上完整定义：已有MD5与受控历史源码完全匹配足以定位本次差异，但仍须核对Q3A元数据/权限。

**真正迁移阻塞仍存在：现有P2严格9项计数只能匹配7项，必将事务报baseline drift退出。** 不能运行P1后假装整批就绪。候选最小修正是在另行授权的本地修改中为这两个签名各精确允许已审查的两种迁移前摘要（明确expected集合，逐签名计数，拒绝第三值），其余检查保留，并用真实历史前缀→升级及未知摘要拒绝测试验证。不可直接覆盖Production、全局归一化函数体、移除摘要保护或只为PASS替换expected。本轮不修改SQL patch/既有实现。

### C. pg_net / Vault：修正旧ACL门禁，改查可达链

[官方pg_net说明](https://supabase.com/docs/guides/database/extensions/pg_net)、[平台默认授权说明](https://supabase.com/kb/troubleshooting/revoking-access-to-pg_net-objects-has-no-effect-0bbc16)解释：net平台默认存在PUBLIC表权限；托管Data API默认不暴露net，anon/authenticated为非LOGIN角色。项目添加的可调用函数/视图、泛用SQL执行器、额外API schema或不可信直接DB登录能力，才可能让这些底层权限成为实际访问路径。仅有Q5 true不能认定已经对公网泄露；默认配置也不能替代本项目证据。

[官方队列凭据边界](https://supabase.com/kb/troubleshooting/database-roles-can-read-request-headers-queued-by-pg_net-ad6357)说明排队请求含已解密头，平台不支持项目自行更改这些表grants/RLS。因此撤销先前G4“必须先收紧平台队列ACL”的绝对要求；隔离本地平台owner试验不应照搬Production。**不REVOKE、不尝试SET ROLE平台owner、不读队列实际行。** 应核验：所有DB LOGIN及可继承/切换身份均可信；API不暴露底层对象；可调用RPC/view/触发链不提供读队列/Vault、任意SQL或越权身份切换；凭据仅最小wake能力且固定job、不含万能service key。

service_role拥有Vault能力不代表客户端能读；它是可信服务端角色，仍须保证未泄露且无客户端可达的definer包装。仓库schema/forward patches中未发现net/Vault引用（本地Cron测试配置不在部署patch中），这只能覆盖仓库，不能排除线上额外对象。local config仅public/graphql_public，不是托管exposed schemas证明。原Q3A按函数名过滤，会漏掉自定义包装RPC；原Q4无完整原始结果，故不能声明链路闭合。

最小补证据：[EXPOSURE_METADATA_READONLY.sql](./ACCOUNT_DELETION_EXPOSURE_METADATA_READONLY.sql) E1–E3分别执行；只返回schema设置、函数签名/摘要/权限/风险提示布尔、view直接依赖，绝不返回source或秘密。E1可为空，不能代表无exposed schema。Dashboard只反馈Data API **Exposed schemas名称**（不附API keys）；如果含其他schema，先反馈名称再调整E2/E3范围。请同时反馈已执行Q1/Q2/Q3A/Q4/Q5的安全结果文件，不重复查询；重点是owner、LOGIN/成员关系、默认ACL、policy角色/摘要。函数文本匹配和直接view依赖都不是完整调用图；出现未知或动态包装再针对该签名定向核对，不能因无命中就记安全PASS。任何一步报错即停。

### D. 五patch兼容门禁（准确次序不变）

1. **P1 2026-11-05-account-deletion-audit-snapshots.sql**：移除四历史FK、不删行/不改UUID；旧字段查询兼容。先精确核对9条和额外依赖；未知/重放/动作漂移停。即使P1单独可用，本轮不申请把半批迁移上线。
2. **P2 2026-11-05-account-deletion-barrier.sql**：当前hash门禁确定阻塞，先本地审查修正与历史升级验证。随后须满足private不存在、15表RLS及Storage精确三policy/无额外宽松策略、owner安装权限。restrictive与旧permissive取AND，不授予新业务权；但函数EXECUTE/search_path/default ACL必须逐项可用，单有policy存在不够。新账号状态为空时正常旧客户端预计保持，必须正常路径验证；Storage缺失分支会跳过guard，Production不得将此当通过。
3. **P3 2026-11-06-account-deletion-trusted.sql**：依赖完整P2、5项中间摘要与NOLOGIN执行角色/owner/SET ROLE授权；未知或角色能力缺失停。未建立有效可信许可不能受理，普通Personal保护保持。
4. **P4 2026-11-06-account-deletion-execution.sql**：依赖完整P3、2项中间摘要/租约列未安装；核验实际owner/grants/revoke。只安装合同，不安装Cron或Secrets；原清理直调必须确实撤销。
5. **P5 2026-11-06-account-deletion-frontend-contract.sql**：依赖P4完成语义、同名对象不存在；窄撤销/Review标记仅authenticated执行，不放宽原参与者RLS。

这些DDL不是全部重放幂等，遇到漂移/部分应用须停，不重复DROP/跳保护。每步事务成功后postflight，再下一步；旧PWA正常用户兼容是条件结论，不能以hash相同代替Storage/RLS/提醒回归。所有接受始终关闭，角色私有化/通知RPC安装顺序、Edge/网关/Cron/前端启用顺序仍见§6；先前队列REVOKE条件被本节C取代。已accepted后不可撤屏障，数据迁移以审查后的前向修复为主。

### E. 当前结论与下一步

可进入**定向证据补充/最小本地迁移适配评审**，不可进入Production迁移执行。阻塞从“无法取得任何catalog”收窄为：P2已知摘要白名单不适配；实际API/包装函数/LOGIN信任链和完整ACL结果不足；受限角色/Storage对象安装权限及后续Production模式/网关/CORS/分离开关与合成门禁未完成。线上Edge/Vercel配置不在本轮重复调查。保持v0.1.21/f259f0d，不Commit/Push/Deploy，不读秘密或真实业务行。

以下Manual metadata follow-up及§1–9为前轮历史证据/候选计划；其中旧超时阻塞、未取得catalog及收紧队列ACL假设，以本轮上方Evidence Review为准。

## Manual metadata follow-up — 2026-11-06

当前查询已拆分并严格限于系统catalog，只读操作以[手动指引](./ACCOUNT_DELETION_CATALOG_MANUAL_GUIDE.md)为准：先SELECT 1，再逐条Q1–Q5（Q3A/B分开），失败即停。旧报告中SET LOCAL/事务及可选bucket/Cron/migration行查询描述属于上一轮文件版本，本轮已移除，不再照旧执行。无新Production结果，HOLD保持；既有9路径基础上新增该指引，当前共10个未提交路径，无新Commit。

## 1. Local checkpoint and scope

- 起点HEAD `7bc144f8eecdbaa97d0418afddfdb848f19d6d95`，main相对本地origin/main为1/0，31份待提交文件。完整清单、差异、文件类型/密钥模式、源码与测试/治理一致性检查通过；没有真实OTP/JWT/密钥、测试缓存、容器产物或其他项目文件。
- 必要复核：相关Node **42/42**、Build含tsc、`git diff --check`通过；保留原chunk提示。沿用未受影响的44项浏览器、真实本地Auth/SMTP/Edge/Cron、fresh/upgrade及窄合同证据，不重跑完整套件、不再执行账号删除。
- 用户明确授权的本地Commit：**f259f0d — feat: add account deletion frontend locally**。仅暂存经核对的31文件，提交后即时工作区clean；HEAD `f259f0d503b8a4ff9666c4a87f715952585b5677`，相对本地origin/main **2/0**。未fetch；后续GitHub API读取没有更新本地remote refs。
- 之后只有本报告、只读SQL补充和必要治理记录的本地文档修改，保持未提交，不创建第二Commit。旧后端四份patch、前端窄合同及业务代码均不修改。

## 2. Observed Production evidence

| 项目 | 本轮结果 | 证据边界 |
|---|---|---|
| GitHub远端main | API观察为`4b1032e1924ee64d6f7f5faa24f36ec7af831161`，protected=false | 只读仓库元数据，不是git fetch或Vercel设置变更 |
| 最新成功Production部署记录 | ID **7565048535**，Source **4b1032e**，creator vercel[bot]，2026-11-05 04:17:10 UTC，status success | [部署元数据](https://api.github.com/repos/ping177/cross-platform-shared-calendar/deployments/7565048535)、[状态](https://api.github.com/repos/ping177/cross-platform-shared-calendar/deployments/7565048535/statuses)；environment标签为Production，GitHub记录的production_environment字段为false；这是GitHub最新记录，不冒充Vercel控制面的active alias绑定证明 |
| 正式公开别名 | HTML 200；入口`/assets/index-DnC6vetU.js`，CSS`/assets/index-tpRAj-6Q.css`；JS未包含注销模块/回执key，后端hostname为`ximazjhxvmktpcdbypka.supabase.co` | [公开应用](https://cross-platform-shared-calendar.vercel.app/)的未登录静态资源；未提取任何嵌入key或访问用户API |
| 静态资产指纹 | JS SHA256 `8257ec2aa7dc5521db8603a754d59bb5dc3c9b6df01e7384a8e60072a61d1453`；CSS `64262f9e578c10a6c4008e67a069ea9830a4605c8a263e2e4f6409dc78dadc52` | 当前别名资产可复核；不能仅凭相同产物证明docs-only Source SHA |
| 不可变部署URL | GitHub返回的`cross-platform-shared-calendar-dofddk4gd-ping178.vercel.app`未认证读取最终跳转vercel.com/login，未取得可信应用产物 | 不把登录页HTTP200当部署内容或Source核验；未登录/绕过保护 |
| HTML与SW缓存 | 正式HTML/SW均`public, max-age=0, must-revalidate`；公开`sw.js`无fetch handler，仅通知用途 | 新打开的在线窗口可重新验证；不能强制更新已运行JS、HTTP离线缓存或已送达通知 |
| Vercel生产分支/自动规则 | 有vercel[bot]持续Production部署的历史证据；本地无Vercel CLI/linkage | 当前生产分支、忽略构建条件、Git自动部署开关、环境配置及active alias精确Source均**NOT VERIFIED**，不能将历史观察当配置证明 |

未登录公开页面、GitHub元数据及官方文档是本轮唯一取得的线上证据。未读真实业务行、Auth用户/Session行、Storage对象列表或文件、Vault/环境变量值、pg_net头/响应正文、Cron命令正文。

## 3. Database preflight — no reliable Production catalog result

Supabase CLI2.120.0可运行。已用既有授权CLI尝试functions list、secrets list（只筛所需配置名称）、projects list，均有界25秒未返回；functions一次`--agent no`重试22秒仍超时。无认证失败响应可据以断定登录失效，不修改代理、CLI安装或系统安全设置。

静态help第一次因沙箱限制正常telemetry文件写入失败，正常权限重试取得帮助；CLI `db query --linked --project-ref`支持Management API。本轮提交一条显式 **BEGIN READ ONLY / statement_timeout=12s / catalog SELECT / ROLLBACK** 的筛选查询，28秒未得到结果。不能断言服务端未执行；即便执行，所请求的内容也只有catalog元数据且事务只读。没有取得数据库验证结果，不用仓库/local PASS替代。

本机没有已配置PG连接环境或.pg_service.conf/.pgpass，未读取其中凭据、未请求用户交付DB密码/owner连接。未调用db dump/pull/lint/reset/push、函数下载或用户/Storage数据接口。

以下全部 **NOT VERIFIED**：

- 实际public/private/auth/storage表列、所有指向Auth/Profile的FK及ON DELETE，是否恰为第一patch要求的9条public引用，其他namespace额外Auth依赖。
- 实际15表RLS、policy/trigger、Personal保护、Review当前成员+原参与者合同、函数source摘要/owner/grants、默认ACL、执行角色/SET ROLE能力与READ COMMITTED。
- Storage对象表版本/owner字段/策略与guard安装权限；本地版本行为不能替代托管catalog。
- 五份账号注销patch的真实已应用/未应用/部分应用状态，migration registry与手动forward patches的对应关系。

最小补充：用现有已授权只读连接，或由用户在正确项目SQL Editor运行[元数据补充](./ACCOUNT_DELETION_PRODUCTION_CATALOG_READONLY.sql)。先单独运行主catalog块；确认关系存在/权限后分开运行可选bucket、队列/Vault ACL、Cron和migration标识块。只分享此筛选结果，不粘贴function source、secret值、cron.command、迁移statements或用户行。无需创建测试用户/数据。也可恢复现有Management API只读查询能力后由Codex继续，不能为此提取CLI/浏览器Token。

## 4. Edge, Cron, Storage — repository facts versus hosted facts

### 4.1 Current code is deliberately local, not deployment-ready by flags alone

| 控制 | 当前仓库事实 | 正式启用前要求 |
|---|---|---|
| 前端入口/Root/回执 | `localDeletionEnabled()`同时要求DEV、显式true及前后端loopback HTTP；生产Buildfalse | 单独评审Production适配。不能只在Vercel设置VITE开关；启用新入口与保留已受理状态查询/Root屏障应分开控制 |
| Edge运行 | ACCOUNT_DELETION_RUNTIME_MODE必须isolated-local，SUPABASE_URL只允许HTTP本地host | 审查固定目标项目的HTTPS运行模式；保留默认关闭，不能删除校验后裸开任意后端 |
| CORS | 仅127.0.0.1:5175、localhost:5175 | 明确正式HTTPS Origin和将来验收用的单一受控Local/Preview来源，不能通配*.vercel.app或任意Origin |
| 关停策略 | 当前一个全局local开关会同时关闭用户动作、worker和receipt；前端同一gate也包状态恢复 | 正式模式须可只停begin/verify/confirm，而worker、receipt、停用账号屏障仍继续；这是启用前阻塞，不是本轮修复 |
| 现有提醒配置 | 仓库send-test-push verify_jwt=true，send-reminders=false；新sender需active_notification_accounts/current_account_active | 线上已部署版本与verify_jwt未知。先安装barrier RPC再更新两个提醒入口，并保留原调度/去重/发送预算 |
| account-deletion网关 | config.toml没有该函数条目，本地直接Edge Runtime没有托管gateway层 | 显式按该单函数配置并验证网关，不能靠本地HTTP PASS推断Production通过 |
| 调度 | 现有local_cron.sql只有隔离URL和合成Vault配置，不是Production资源 | 需审查正式HTTPS URL、最小唤醒能力、真正队列权限和健康检查；禁止直接运行local_cron.sql到Production |

### 4.2 Dual authorization must be verified at both layers

依据[官方授权头说明](https://supabase.com/docs/guides/functions/auth-headers)：平台verify_jwt在handler之前执行；Authorization与apikey有不同用途。当前worker使用随机64hex自定义Bearer能力，它不是用户JWT，也不是平台签发API key，不能假定默认verify_jwt=true会放行。

最小候选仍可复用一个Edge，不新增认证框架：单独对account-deletion显式verify_jwt=false，由handler对用户begin/verify/cancel/confirm调用Auth.getUser并绑定真实session/同UUID OTP；work只接受独立高熵服务器能力且body不得选job/UUID；receipt只接受不可猜测只读回执。关闭gatewayJWT不等于允许匿名执行删除。必须以托管gateway实测：无凭据/错凭据/普通JWT不能work；worker能力不能作用户授权；旧JWT不能业务CRUD；Auth消失后receipt仍可查；apikey本身不能授权删除；拒绝未受理job/错误代次。只在此函数配置，不关闭全项目或提醒函数保护。

官方新文档介绍的新wrapper不是本项目现有实现，本轮不引入依赖或改认证系统。平台是否要求/接受当前apikey种类、legacy JWT及新签名Key、OPTIONS和内部Authorization传递均需实际网关核验。现有local cron只发Content-Type/自定义Authorization；正式请求应按核验结果明确apikey字段，不能盲用secret key为浏览器授权。

### 4.3 Credentials and queue confidentiality

[官方调度文档](https://supabase.com/docs/guides/functions/schedule-functions)建议Vault，并明确pg_net待发请求中可能暴露解密后的请求头。仅证明Vault不可读不够；必须检查实际可达链及DB LOGIN信任边界。按本轮官方平台约束，不能将收紧平台表grants作为可执行方案，不做REVOKE；本轮最新Evidence Review C取代先前owner收紧假设。

新功能优先保持专用窄唤醒能力，不在Cron命令写字面key、不把万能service key作为浏览器或公开worker凭据。Edge所持service key仍具平台广泛能力，窄RPC限制的是正常调用面，不是限制已泄露key。Vault/Edge能力的安全配置、轮换、owner授权和运维通道必须另行审批；本轮连名称是否已存在也未取得可靠结果。

### 4.4 Storage boundary is accepted design, not hosted proof

仓库头像仅普通upload、JPEG≤1MiB、UUID/UUID.jpg，读取签名300秒；生产对象/配置未查询。实际bucket、文件大小/MIME、owner/owner_id、版本、TUS/S3可用路由/预签期限、所有metadata发布路由是否受guard控制仍待核验。不能据前端没用TUS/S3就断言线上不存在这些入口。

沿用已接受Storage Gate：Storage API清可枚举文件、迟到发布由guard拒绝；[官方删除要求](https://supabase.com/docs/guides/storage/management/delete-objects)明确不能只删SQL metadata。隐藏临时字节/副本属于平台生命周期，不承诺立即零字节、通用上传硬超时或逐对象物理删除回执。已知残留/清理失败必须needs_attention并经供应商/受控运维修复，不得completed。

本项目实际托管后端、自动清理配置/事故状态/可用支持渠道未取得Project级证据。本轮不重启已收口的Storage研究，也不在缺证据时建新扫描系统。

## 5. Exact patch order and compatibility

**仅为待授权的候选序列；必须以真实catalog逐步核对后形成执行清单。不能按文件名字典序或通配符运行，也不能将schema.sql整份覆盖Production。**

| 次序 | 独立forward patch | 变化/依赖 | 兼容与重放边界 |
|---|---|---|---|
| P1 | `2026-11-05-account-deletion-audit-snapshots.sql` | 核对9条public Auth/Profile FK，移除spaces/events/tasks/review_rounds四个历史creator依赖；保留其他活身份FK | 旧UUID字段/查询保留，既有guard必须有效；无数据删除。来源FK已迁移/额外FK/动作漂移会拒绝；不是重复执行无害脚本 |
| P2 | `2026-11-05-account-deletion-barrier.sql` | 必须P1；创建private唯一job、15表restrictive policy/写guard、必要definer/读/目标检查、Storage策略/guard及通知RPC | 正常active账号在READ COMMITTED下预计兼容旧客户端；实际角色/隔离/策略未知则HOLD。会影响所有读写/提醒入口，不能称纯无影响additive；private命名空间已存在、9函数摘要或Storage策略漂移即停 |
| P3 | `2026-11-06-account-deletion-trusted.sql` | 必须P2；同session OTP许可/受理包装、NOLOGIN角色、Personal精确例外/业务事务；检查5函数摘要 | 普通Personal保护保持；无有效服务证明/许可不能接受。需平台确认角色创建/owner/SET ROLE权限；重放/缺前置/漂移拒绝 |
| P4 | `2026-11-06-account-deletion-execution.sql` | 必须P3；租约/阶段/receipt/严格完成，收紧原cleanup直调权限；检查2函数摘要 | 角色owner下grant/revoke后必须验证实际ACL；不自动安装Secret/Cron，不应单独开放用户受理。guard/列已存在或不匹配即停 |
| P5 | `2026-11-06-account-deletion-frontend-contract.sql` | 完整P4合同后添加原会话撤销未受理许可与原参与者Review标记 | 原RLS及正文不放宽；create function无IF NOT EXISTS/OR REPLACE，重复会失败。没有P4完整语义时不得跳装或单独启用 |

P1–P4有事务性前置门禁，但**不具备全部重放幂等**；已应用部分先比对catalog/权限/迁移记录，不能自动跳过或手动关保护强行继续。Runtime重试幂等与DDL重放不是一回事。P5没有独立source摘要预检，执行前更要确认P4能力和同名对象不存在。

这些文件位于patches，不等于CLI migrations目录。未读到真实registry，不能宣称它已记录这些脚本，亦不能直接db push代替精确序列。未来应以既有项目治理确定唯一迁移标识/审查摘要/回执，不能篡改已应用历史迁移；本轮不搬文件、不创建项目版本。

## 6. Staged rollout gate — future authorization only

| 阶段 | 未来动作 | 必要preflight/postflight | 停止条件 |
|---|---|---|---|
| G0 补证据/适配 | 取得第2–4节项目级只读结果；另授权最小Production运行/CORS/分离开关及网关适配的本地实现验证 | 源码版本、FK/摘要、角色/ACL、队列/Storage/Auth能力一致；普通用户和旧客户端合同评审 | 任一实际依赖未知、guard缺失、无法保持已接受任务独立恢复，均不申请部署 |
| G1 数据合同 | 单独批准维护窗口和P1 | 记录FK/guard/RLS元数据与锁预算，事务后确认仅四FK改变/活身份保护保留 | 额外依赖、锁等待/DDL漂移/非预期数据行为停止，不盲加DROP IF EXISTS |
| G2 屏障 | 批准P2，再依次P3→P4→P5；全程用户接受保持关闭 | 每步source/owner/ACL/默认隔离/Storage postflight；普通路径Personal拒绝、正常账号功能不退化；部署时记录每步提交结果 | 任何权限警告、不能安装Storage guard、Shared/Review契约变化停止；不执行下一patch、不关约束 |
| G3 现有通知 | P2 RPC存在并核验后，分别部署新版send-test-push/send-reminders | 保持各自verify_jwt；新active RPC连通、旧发送/去重/预算和现有单一调度不变，正常合成提醒验证 | 新RPC缺失、通知回归或额外重复调度，暂停新功能开放并前向修正 |
| G4 新服务与凭据 | 批准的Production适配版account-deletion，以新受理OFF部署；安全配置专用能力/Vault | 单函数gateway+内部双重授权、错误/交叉凭据、receipt、目标固定；先确认API无队列/Vault暴露、DB LOGIN可信及使用窄能力，再配置凭据，不输出值 | verify_jwt/akey不匹配、任意target可调用、存在非可信可达队列/Vault读取链则不配置/调度 |
| G5 独立恢复 | 批准正式HTTPS Cron→pg_net→同一Edge，先关闭调度做鉴权/idle核验，再开启后台；新受理仍OFF | pg_cron/net健康、worker无用户Session可唤醒、单租约/代次、错误可持续重试/attention，真实HTTP而非仅Cron成功 | 后台不独立、凭据泄露/存在非可信队列访问链、无法监控则不开放任何新受理 |
| G6 合成门禁 | **另行授权后**创建全新Production合成账号/测试空间，限定服务器端允许受理的合成身份范围；用户完成邮箱/设备步骤 | 原共享数据、Owner/Review反向权限、OTP、接受/关页/离线恢复、Storage/API/Auth最终不存在和receipt；绝不使用两个闲置账号或真实共享空间 | 任何Shared误删、提前completed、未知残留、旧JWT重建、无自动接续，立即停新受理，相关job attention |
| G7 前端/兼容验收 | 按AGENTS先后端、对齐能力后用已批准Local/Preview新前端测试合成身份；授权Git/Vercel发布兼容前端时入口默认OFF | 确认真实Source/域名/CORS/版本；关闭旧标签并重启PWA、更新到兼容前端；普通用户继续工作 | 本地硬限制尚未适配、Production别名Source未知、旧PWA兼容或Root/回执关闭错误，保持入口OFF |
| G8 正式开启 | 独立授权后协调放行服务端新受理及前端入口，且worker/receipt/Root能力已持续可用 | 所有postflight/合成与用户真实设备门禁通过，运维负责人/异常处理能力就绪；观察现有Dashboard与脱敏日志 | 指标或契约异常只停新受理，后台和状态查询维持；不得直接关掉全局runtime |

G6合成身份限制必须在服务端对已验证UUID执行，不相信客户端参数/前端隐藏；当前实现没有该Production控制模式，需G0另行评审实现。前端可保持正式别名入口关闭，用单一批准的Local/Preview来源验收，避免提前向真实用户宣传未开放功能。上述顺序并未授权本轮创建任何账号/数据。

P1预计兼容旧字段；P2的覆盖面使兼容性必须实证，不能仅称“后端先部署”便跳过。新数据归属/RLS保障主要在DB，即使旧PWA仍运行，也必须无法给注销中目标重新分配身份或产生私人数据。旧已缓存显示/已发送通知不能远程收回。当前SW无fetch缓存不代表已运行JS会自动替换；正式打开前要求实际用户关闭旧标签/重启PWA。

GitHub/Vercel观察表明Push可能自动Production部署，后端源码/前端/治理push都不能随意当“只同步Git”。本地两Commit未push；未来任何Git或部署仍独立授权。本轮没有为了预检更改Vercel环境、分支或自动规则。

## 7. Stop and recovery

- **首个accepted之前：**新受理OFF，任一步不确定即停止后续；DDL成功已提交不意味着要反向恢复。可回退尚未产生依赖的数据无关代码/配置，但必须验证旧客户端正常功能；不自动执行Git回退/重新部署。
- **已有accepted之后：**任务授权不可撤销，永久隔离保持。停止新接受与继续worker/receipt必须分开；已知安全依赖异常的job进入needs_attention，修复后owner-only恢复同一job/代次，从Storage重新postflight。不能让用户登录来续跑，也不能将错误改preparing/正常。
- **不能假称一键SQL rollback：**四个历史FK移除后可能已留真实已删Auth UUID，重新加FK会失败或迫使丢历史；不能级联清Shared、改写创建者或禁保护来恢复。Barrier/trusted/execution之间有schema/权限依赖，卸掉屏障会使旧JWT或旧client复生。采用新审查forward corrective，保留已接受job和完整恢复路径。
- **Auth/Storage已永久删除：**不承诺重建原账号/数据。平台备份/日志生命周期不等于按账号随时恢复；灾难恢复需另行评估供应商能力、范围及其他成员影响并独立授权，不能把全项目备份恢复当无损账号撤销。
- **凭据/调度故障：**保持访问屏障；在受控配置渠道修复/轮换最小能力并验证恢复。不能停所有恢复器后仍继续接受任务；不能将密钥或临时调试头放入Cron命令/公开日志。

## 8. Remaining blockers and minimum next step

1. **B1 Production数据库未取得可信只读结果。** 第一块元数据查询和可选配置补充需成功返回；本轮无catalog PASS，也未证实五patch未应用/适用。
2. **B2 Supabase已部署Edge/配置/Cron/Storage/Vault/队列未知。** CLI元数据均超时；不根据本地config或过去v5提醒记录补PASS。恢复既有只读能力，或由用户输出无密钥的版本/flag/扩展/ACL/配置存在性。
3. **B3 现有源码硬限制为本地。** 需另授权最小Production模式、正式CORS、显式新函数网关、入口/Root能力/worker/receipt分离控制和受控合成验证模式。不能只切环境变量上线。
4. **B4 Vercel真实控制面未验证。** 获取当前Production部署ID+Source、alias绑定、Git生产分支/自动部署规则及变量名称/配置存在性，禁止导出值；当前只有GitHub记录+公开资产证据。
5. **B5 后续合成Production与用户设备验收未进行。** 只有独立授权后才能创建测试账号/调度/部署；真实账号、OTP和iPhone/Android/PWA操作仍由用户完成。

下一步：先审查本报告并补只读元数据，再单独授权B3本地部署适配；尚不能申请执行现有patch或开启真实注销。正式状态停在 **PRODUCTION_READINESS_REVIEW**。

## 9. Final local file and review record

本轮前端里程碑包含原31个已审查路径；可用`git show --stat f259f0d`核对完整清单。随后新增本报告及ACCOUNT_DELETION_PRODUCTION_CATALOG_READONLY.sql，修改SPEC、BARRIER_COVERAGE、PROJECT_STATE、TESTING、DEVLOG、DECISIONS、BACKLOG七份必要治理文档，共9个未提交文档/只读SQL路径；暂存区为空，业务源码与HEAD一致。不再Commit；无其他项目文件修改，无.env或凭据文件读取/密钥输出。

最终`git diff --check`与静态范围检查通过：6块显式READ ONLY/ROLLBACK；仅catalog/config元数据SELECT与timeout设置；16个阶段source摘要与对应patch对照；Version Index保持逐字不变。此检查不代表SQL已在Production运行或平台权限PASS。复核结论：报告可供审查，Production实施仍HOLD；下一步只补证据并另行授权部署适配。
