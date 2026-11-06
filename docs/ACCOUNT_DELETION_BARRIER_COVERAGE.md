# Account Deletion Slice 2 — State and Barrier Coverage

Author: Ping Weng。2026-11-05。正式版本v0.1.21不变。

Status: `FRONTEND_READY_FOR_REVIEW`（2026-11-06，仅本地，前端未提交）。后端7bc144f仅本地Commit，未Push/Deploy；§1–9保留历史证据，最新前端/两个窄合同与本地集成见§10。Production与真实设备均未验收，功能不标CLOSED。

## 1. Baseline and authority

开始HEAD为4b1032e，本地origin/main相同0/0；原11个未提交路径先记录SHA256。原Slice 1审计patch、专项SQL和Tasks schema测试保持逐字不变；canonical在原Slice 1基础上追加独立Slice 2块，不重复执行/改写原审计迁移。既有六份设计/治理在原内容上增补。

本轮可以本地实现状态和屏障；不授权Production、更改真实账号/空间/Storage、UI、Auth Admin、正式Edge/Cron、Commit/Push/Deploy。两个闲置账号不用于测试。

## 2. State contract and deliberately closed acceptance

`private.account_deletions`以user_id为主键、request_id唯一，保存status/phase、accepted/completed时间、generation、attempts、next_attempt_at、lease_until及枚举错误码。目标无Auth/Profile FK，以便后续身份删除后继续恢复；创建/接受内部函数检查真实表中Auth UUID存在且与该意图精确匹配，不按邮箱归并。无OTP、JWT、邮箱正文、昵称或头像字段。

状态：preparing尚未受理，不撤业务访问；accepted是持久且不可反转的受理点；processing处理；needs_attention保持屏障；completed仅预留表示终态，**本轮禁止转入**，直到未来验证完成器实现，不会伪造完成。

- 准备/接受/状态推进函数全部在private schema，撤销PUBLIC/anon/authenticated/service_role的schema、表和函数权限，状态表RLS开启、无客户端策略。没有公开accept包装或任意目标UUID入口。
- 同一request重放幂等，另一request竞争相同user明确拒绝；accepted_at/目标/request不可改、已受理记录不能删或恢复preparing；generation不符返回false，不覆盖新状态。
- SQL测试以隔离库owner调用内部函数，**模拟未来可信受理端**，不是OTP证明，也不是用户可用接口。后续必须先集成同UUID邮箱重验、最终确认及最小授权包装；不得为接通而直接开放private schema或授予应用角色内部accept EXECUTE。
- phase/重试字段只是后续幂等/离线执行的持久基础，本轮无worker/lease领取器，不宣称已具备自动注销完成能力。Personal专用删除仍未开放。

## 3. Entry inventory and implemented coverage

下表按实际schema、客户端查询与两个既有Edge入口盘点。所有写触发器为新增`account_access_guard`，不替换旧身份/成员/系列/Owner触发器；所有public读写策略是附加RESTRICTIVE约束，不新增宽松策略或扩大原权限。15张public业务表均覆盖。

| 实际入口 | 本轮实施位置 | 本地证据/界限 |
|---|---|---|
| profiles直接SELECT/UPDATE及本人读分支 | caller active的restrictive policy；用户请求写触发器；Auth bootstrap另校验新Profile目标 | 旧模拟JWT本人Profile不可读；正常合成Auth插入仍创建Profile；真实Auth bootstrap角色/隔离待验 |
| spaces/space_members/space_modules直接CRUD | 三表restrictive policy+写触发器；新Personal创建者、新成员/role目标active检查 | accepted状态不删除空间/成员；正常Shared保留；客户端不能自行加入/改Owner |
| create_space_with_invite / ensure_personal_space / join_space_by_invite_code | 创建实际写触发器；ensure/join入口显式账号共享门闩 | ensure已有数据返回也被封锁；创建/加入与受理双向竞态实测 |
| leave_shared_space / remove_space_member / transfer_space_ownership / delete_shared_space / rotate_invite_code / set_space_module_enabled | 保留旧授权/Space锁；实际写经触发器，升Owner/新增目标必须active | Owner先完成转让→受理拒绝；受理先完成→新Owner转入拒绝；删除/移除不被错误当作授予目标新权限 |
| is_space_member / are_users_in_same_space / can_manage_event / is_space_module_enabled | 前两者显式active调用者（same-space也检查两目标），can_manage继承member检查；module invoker受RLS | 不能因definer读取旧成员行而恢复访问；纯随机邀请码/由输入计算的日期不作为服务器业务数据读取 |
| events直接CRUD、event_occurrence_exceptions | 两表RLS+写触发器；新/变更personal owner目标active | accepted不能写；其他成员不能新分配personal日程给accepted目标；已存creator不可改 |
| assert_manage_recurring_event / upsert_occurrence_override / delete_occurrence / split_recurring_event / delete_logical_series / delete_occurrence_and_future / save_event_edit | 保留既有can_manage及Space/系列检查；实际事件/例外写触发器 | Slice 1系列/例外及Event collaboration回归，旧历史creator UUID仍可受控派生；不把派生creator误判成新伪造作者 |
| tasks直接CRUD、完成/重开、指派 | restrictive policy+写触发器；变更assignee目标active；原OLD assignee状态保护保留 | accepted目标不能接新任务；正常成员继续编辑Shared Task；新建伪造作者/修改历史作者拒绝 |
| lists/sections/items直接允许列更新、新List创建 | 三表restrictive policy+写触发器，既有列级授权/不可变身份不变 | 当前Lists专项135项回归；无创建者FK也不允许客户端伪造作者 |
| create_list_section/item、delete_list/section/item、reorder_list_sections/items、set_list_item_completed、lock_writable_list | 原锁/成员检查+实际写触发器；lock helper无新增客户端授权 | accepted在member检查或写屏障处拒绝，正常排序/删除语义不变 |
| Important Dates create/update旧新重载、delete、内部lock helpers | restrictive policy+实际写触发器，原Space/模块/成员检查保留 | accepted不能创建；没有新target/creator参数；来源表仍由Space拥有 |
| Review round/entry SELECT，can_read_review_round | restrictive policy+helper显式active，当前成员+原participant双条件保留 | 正常原参与者仍读双方正文；新成员/新Owner旧轮反向权限沿用SQL回归 |
| get_my_previous_review_plan | definer独立读取前显式active | 只加RLS时已复现可泄露计划的RED；新增检查后拒绝 |
| create_review_round / correct_review_date / save_my_review_entry各重载 / mark_my_review_filled各重载 / delete_review_round | 原participant/revision/版本检查+写触发器；创建participant目标active | accepted不能保存/新建；Shared新轮不能给accepted成员添participant；不删除/改写旧正文 |
| register_push_subscription / disable_push_subscription | 订阅实际写触发器，注册用户targetactive，保留原auth.uid及installation绑定 | 不能用旧JWT重启订阅；受理事务不更新/锁住Push业务行 |
| 普通/重复Event、Task、Important Date claim | ledger BEFORE INSERT对recipient取得账号共享门闩，不活跃返回NULL跳过插入 | 不改变去重键或将claim失败变成重发；已受理目标不会产生新claim |
| check_event_reminder_delivery / check_task_reminder_delivery / check_important_date_reminder_delivery | Event独立active复核；Task/Date既有eligibility函数加active | 旧claimed记录不表示可继续发出；已在外部网络的Push不可撤回 |
| send-reminders服务角色REST查订阅 | service-only、最多100UUID的active_notification_accounts预过滤，严格校验响应子集 | accepted目标不反复占用50发送预算；网络/畸形响应失败关闭；无客户端UUID查询权 |
| send-test-push | getUser后及外部发送前两次caller-scoped current_account_active复核 | Node入口连线/失败关闭/重查测试；真实Edge调用未部署验证 |
| profile-avatars Storage metadata SELECT/签名资格 | 新RESTRICTIVE policy；已有同Space读取检查也排除不活跃目标 | SQL Storage夹具拒绝旧JWT；不是Storage签名HTTP/已签URL失效证明 |
| profile-avatars INSERT/UPDATE/DELETE | 新Storage写触发器：用户actor门闩，上传namespace目标active；原路径/MIME/文件规则保留 | SQL元数据上传拒绝；真实在途blob、signed upload、缓存/服务端角色语义待验；特权文件清理本轮未执行 |

九个被替换函数均有forward patch的旧prosrc指纹门禁；15表RLS必须已开启；未知private namespace、未知Storage宽松策略或重放停止。新表/函数权限显式收紧；没有把service_role视为已拥有所有业务RPC。

## 4. Lock and snapshot contract

用户写入/新增目标先取得该UUID共享事务门闩并用独立语句重查active；受理只取得目标排他门闩→job行锁→无业务行锁的Owner查询→私有记录更新。它不取得Space/Task/Push行锁，也不跨外部HTTP持锁，因而不会形成“接受持账号锁等Space、业务写持Space等账号锁”的环。

既有Space advisory→Space行→业务行顺序不改。共享门闩之间兼容；写触发器有时在Space锁后到达，但接受不反向等待该Space。正在移除目标不会授予新权，可与受理并发提交，不强制多余的目标锁。一次内部接受事务只处理单个账号；后续包装不能把多个账号接受塞进一个事务。

实际WRITE/读谓词只支持当前READ COMMITTED模型：写函数对其他隔离显式拒绝，读谓词返回false，避免长寿命旧快照恢复已受理前访问。未修改全局/会话默认隔离；Production前要核实真实PostgREST/Auth/Storage调用角色与隔离，不靠此文档假定。

两套路径各14个双会话场景，用pg_blocking_pids+实际advisory wait确认顺序（移除场景确认接受不等Space），不以sleep假装并发成功；包括新建、ensure、加入/退出/移除、转让、指派、两个接受者同request及竞争request。每次同时核对Shared Task/Event的ID/正文存在，Owner先取得则拒绝接受，受理先取得则拒绝新权限。

## 5. Remaining boundary — no cross-service completeness claim

1. Auth仅SQL表/claim GUC模拟；HTTP sender测试为拦截fetch及合成配置，不验证真正JWT签名、Auth session、邮箱OTP或实际PWA。
2. Storage为明确标记的最小SQL表夹具，不是真实storage-api。尚未确认实际Storage API设置role/隔离、签名/签名上传、对象锁和在途blob的提交语义，不能声称完整头像访问/写入屏障。
3. 受理前签发的头像signed URL是独立bearer能力，现有五分钟期限不会被private状态立即撤销；新SQL读取/签名资格拒绝不等于旧URL失效。真实文件删除及最终排空留后续安全执行，不为本轮PASS偷偷删文件或旋转全站签名密钥。
4. 已开始的数据库读取、已进入外部网络的Push、其他设备已有内存内容不能远程撤回；不把这些当成新的JWT业务写许可。
5. 运行时受理包装、OTP证明、Personal专用删除、完成器/回执/恢复执行器仍未实现；本轮不授予入口去制造真实accepted账号。

因此本轮仅内部状态/SQL权限子集LOCAL PASS，整体`PARTIAL`。下一步先审查本轮实现与覆盖，再单独授权隔离的真实Auth/PostgREST/Storage集成门禁及OTP可信受理设计；不能跳过门禁开放注销、生产迁移、Edge/Cron或Git发布。

## 6. Cross-Service Integration Gate — 2026-11-06

Author: Ping Weng。Status: **PARTIAL**。本轮仅验证及测试辅助，没有业务SQL/Edge修改，没有Slice 3、Personal清理例外、Auth Admin删除、公开受理包装、Cron、Production或Git发布。正式v0.1.21保持。

### 6.1 Isolation and reproducibility

基线21个未提交路径先记录SHA256；新测试完成后、文档更新前21/21逐字保持。HEAD/main与本地origin/main仍4b1032e、0/0，未fetch。保留既有审计迁移，不重复实现。

命令：`python3 -B supabase/tests/account_deletion_cross_service.py`。仅依赖现有Python/Node/Docker/Deno缓存和已有esbuild，不新增package依赖。测试每次检查本地Unix Docker context、精确缓存镜像，生成随机自有网络/容器、合成密码/签名密钥；`--pull=never`、内部网络、无host端口/现有业务挂载，PostgreSQL与文件后端使用tmpfs。原业务容器始终未启动或改写。finally只清理自有容器/网络/匿名卷/tmpfs。

真实版本：PostgreSQL `17.6.1.127`、Auth `v2.193.0`、PostgREST `v14.5`、Storage `v1.65.1`、Edge Runtime `v1.74.1`。数据库使用镜像内置角色/Auth/Storage schema及服务自己的迁移；应用按4b1032e schema→原审计patch→原屏障patch升级。不是SQL auth.uid夹具。真实Auth为合成邮箱自动确认的密码Session，未验证邮箱OTP，未删除任何Auth用户。

实际HTTP在自有内部网络发起，Auth自行签发/验证JWT，PostgREST/Storage自行验签和执行请求。两个原Edge入口在真实缓存Edge Runtime运行，通过仅本地HTTP转发接入Auth/REST；唯一替身是外部Push provider，不测试真实FCM/APNs投递。SDK从现有Deno缓存解析：supabase-js2.57.0、auth-js2.71.1、functions-js2.4.5、node-fetch2.6.15、postgrest-js1.21.3、realtime-js2.15.4、storage-js2.116.0；后者是SDK原有范围依赖的缓存解析，不冒称所有传递依赖均被生产锁定。测试不使用前端已安装的supabase-js2.108.2代替Edge配置。

环境处理实绩：首个临时CLI启动自动选择了不同新镜像并开始下载，发现后中断（exit130），没有启动该临时项目的数据库。此次误触发下载不属于已批准的依赖安装，不隐瞒；新增缓存保留，未做全局Docker清理/CLI重装/安全设置更改。最终可复现harness完全避开CLI启动，只用启动前已有的上述镜像并强制禁止拉取。CLI版本2.120.0；未链接远端、未复制项目.env或真实凭据。

### 6.2 Actual results — 112 assertions PASS

| 范围 | 实测结果与后置条件 |
|---|---|
| 正常用户 | 真实注册/Session/user验证、Personal初始化、Shared创建/加入、Profile修改、Task/Event直接写、List及Item、Important Date、Review、Push注册、Owner移除/转让/转回及头像上传/字节读取/删除均正常；List严格沿用仅space_id/name的列级INSERT权限 |
| 无关用户/历史Review | 无关JWT看不到Shared；原参与者读双方正文；新成员及新Owner不能读旧轮，原双方JSON正文/ID/关联保持；成员移除轮换邀请码、两人成员上限保持 |
| 旧JWT和刷新 | 受理后Auth的/user仍确认旧JWT有效，真实refresh也可签发新JWT，但两者均不能恢复业务访问；15表读取为空或原ACL拒绝，ensure/create/join/previous-plan/Review/List/Date/Push等窄RPC及直接Event/Profile写被阻止；没有新增Personal/Forbidden记录，Profile数据库值不变 |
| 新权限目标 | A不能把B重新指定为Task assignee、personal Event owner或Shared Owner；拒绝后原指派为空、Event仍shared/owner为空、Owner仍A。B被正常移除后用最新有效邀请码也不能重加 |
| 审计与共享保留 | Task/Event伪造创建者与修改历史作者被真实API拒绝；其他创建者校验/RPC列级限制沿用原合同，四类旧外键patch未改。Shared Task/Event精确ID/正文/创建者及Review双方完整JSON保持，受理本身无删除 |
| 现有通知Edge | 正常测试通知和两人提醒成功；accepted旧JWT测试发送401且provider计数不增；service-only过滤只保留active UUID，用户无UUID探测权；同一合成claimed记录pre-send在接受前true/后false；新提醒只向A生成ledger并发送，B订阅仍在也不绕过屏障 |
| 真实事务并发 | 接受事务持账号排他锁时，实际PostgREST写在advisory等待，提交后42501且无新Event；实际HTTP写先取得共享账号锁时，受理等待，释放原Space锁后写/受理顺序完成，无死锁，Event ID/正文纳入已受理状态。等待由pg_stat_activity/pg_locks确认，HTTP业务身份没有SET ROLE/GUC模拟 |
| Storage正常/拒绝 | 正常字节round-trip和删除成功；accepted旧JWT不能直接上传、签新读/上传URL。**仍未过期**的旧上传URL在不携带用户JWT时因ACCOUNT_ACCESS_REVOKED拒绝，元数据不生成；不能仅将此归因于RLS，因为签名上传实际走asSuperUser |
| Storage已有下载能力 | 受理前的下载URL在受理后仍可读；可信服务Storage API删除合成文件后，元数据、底层文件及签名访问均不可用。未旋转签名密钥/修改全局Storage设置 |
| Storage在途反例 | 实际发送部分请求体并观察到后端部分blob，再受理。此时API list为空，DELETE API成功也没有排空该blob。继续发送剩余字节后，提交元数据被guard拒绝；本地Storage失败清理最终移除了文件，元数据仍为零 |

SQL层794断言/28双会话的原Slice 2证据保持，**本轮未重跑且不冒充真实HTTP计数**。本轮相关Node113/113、Build（含TypeScript）、Python AST、MJS语法及diff检查通过，既有大chunk提示保留；没有真实PWA/移动设备或生产验收。

测试开发中发现的失败来自夹具：数据库bootstrap角色限制、就绪探针、List列ACL、void RPC的204、轮换邀请码、claimed结果字段一致性、Storage失败HTTP外层状态及并发控制会话输出协议。均修正测试去遵守真实合同，没有放宽ACL/RLS/trigger/FK来通过，没有发现需要改业务代码的明确缺陷。

### 6.3 Authority review and future restricted execution

当前private表及内部prepare/accept/status函数不向anon/authenticated/service_role开放，Data API只暴露public。真实HTTP下用户和service_role均无公开accept入口；数据库owner仅由本地测试控制端用于设置受理点，Edge环境没有数据库owner密码/连接串。

后续最小方向仍是主规格§5.2/§6：可信Edge独立验证同UUID OTP后记录短期一次性许可，客户端窄接受RPC从auth.uid/session推导目标并原子消费许可；不直接grant现有任意UUID的内部函数。内部worker只能claim已accepted job并携带generation推进；专用NOLOGIN definer角色无成员切换授权，权限限具体函数/对象。不得把owner凭据放Edge或通过新增公开函数转发万能SQL。

**这些包装、许可写入、专用执行角色与租约尚未实施/授权验证**。本轮不能因为private函数存在就开放入口。平台Auth Admin服务key本身仍是广泛权限，job合同只约束正常执行和对外API，不把它描述为泄露后仍受job范围限制的密钥。该既有设计边界不是新的任意删除授权。

### 6.4 Remaining Storage completion boundary — no arbitrary wait

本地证明了正常路径及一次迟到提交的清理，尚未证明Storage崩溃、cleanup事件失败/重启后的可恢复性、最大在途持续时间及其可靠排空信号。真实线上Storage后端/版本/上传路由/代理硬超时也未核验。**空列表、成功DELETE或单次正常失败清理均不足以证明可以标completed**；这是本轮保持PARTIAL的关键原因。

候选最小流程（待验证，不在本轮实现）：

1. 先持久接受并维持现有账号/命名空间写guard，冻结新凭证；旧签名不是仅靠RLS立即撤销。本地Storage源码默认上传签名60秒，不代表Production值，也不构成在途请求上界。
2. 从已核验平台配置确定最晚旧上传凭证到期点及所有允许上传路由的硬请求/会话终止上界（包括是否启用resumable/S3）；用现有next_attempt_at表达持久等待，客户端离线不影响。**没有可证明上界时，不填写猜测等待秒数，也不宣称等待一段时间已安全。**
3. 等排空边界后再次通过Storage API精确清理job UUID命名空间并复核。重复清理用于可见对象；不能声称它会发现/删除无metadata的孤立blob。本地正常失败清理由平台承担，异常孤立文件必须有可验证的平台清理/恢复保证或支持的确认途径。
4. 在途/孤立文件仍未知、平台清理失败或不存在可靠确认途径时保持处理中重试/明确needs_attention；不进入Auth删除及completed，不将问题留给“完成之后无期限再清”。需要较大网关/Storage架构变化时先停止评审。

上述是后续安全设计/验证依赖，不是已实现自动恢复。下一步仅审查本轮证据并补验Storage硬边界/故障清理及未来受限授权合同；不开始Slice 3、不申请生产迁移。独立Production catalog/Auth依赖/实际Storage配置与版本、Edge部署/ACL及真实OTP/PWA门禁仍未执行。

## 7. Storage Drain & Recovery Gate — 2026-11-06

Author: Ping Weng。结论：**CROSS_SERVICE_GATE_PASS_FOR_LOCAL_DESIGN**，等待用户/ChatGPT审查。按本轮用户明确边界，不要求证明供应商内部副本立即物理消失；不得以未知硬超时或API空列表证明物理排空。原24个未提交路径在文档增补前24/24 SHA256不变；本轮仅新增Storage专项测试与五份记录，业务SQL/Edge/头像实现及旧测试均未改。v0.1.21不变，无Production、Auth删除、UI、Cron、Commit/Push/Deploy。

### 7.1 Facts and evidence levels

| 事实 | 证据等级与边界 |
|---|---|
| 实际头像上传 | 项目`src/lib/avatar-data.ts`仅普通`.upload()`，JPEG≤1MiB、`upsert:false`、路径`UUID/UUID.jpg`；浏览器先缩放。读取签名300秒。未使用signed upload/TUS/S3；后端可暴露的路由不能仅靠前端未使用便假定不存在 |
| 正常头像维护 | 当前客户端清理读取Profile并保护当前头像、只扫描超过24小时未用文件。这是正常编辑维护，不复用为注销完成条件；注销包含当前与遗留对象，也不依赖PWA重新打开 |
| 官方上传凭证期限 | [createSignedUploadUrl](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl)：2小时；[TUS](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)：最长24小时。二者都不是已开始请求的执行上界 |
| 本地版本差异 | 缓存Storage v1.65.1源码默认`UPLOAD_SIGNED_URL_EXPIRATION_TIME`60秒；本地没有把它改成线上值。只能报告本地观测，不以默认值推断托管配置。旧未过期签名已经实测被目标guard拒绝，不能把拒绝原因误写成过期 |
| 上传执行上界 | 未获得通用可证明上界。源码headers/keep-alive设置及对象锁等待不等于整个上传时限；SDK/测试客户端超时也不是服务器停止证明。不把2h/24h、65秒header超时或任意sleep用作硬排空门禁 |
| 自动清理 | [官方KB，2026-11-04](https://supabase.com/kb/troubleshooting/storage-clean-up-partial-files-from-failed-or-aborted-uploads)说明失败/中止的部分文件由平台自动清理、客户端不能列底层文件；异常应提交复现给支持。它没有给逐对象回执、硬时限或应用可验证的物理删除证明 |
| 删除职责 | [官方删除说明](https://supabase.com/docs/guides/storage/management/delete-objects)要求Storage API；SQL删metadata会留孤立文件。本轮所有应用对象删除使用API，SQL只布置锁、读取后置状态与推进已有私有测试job |

官方资料通过浏览工具读取；agent-reach/Jina读取尝试因本机代理/DNS失败，未改系统代理。只依赖上述官方资料，不用第三方文章推断平台保证。

### 7.2 SQL, RLS and Storage responsibilities

- 现有RLS和列级ACL约束调用者及路径；账号restrictive policy阻止旧JWT访问/签新凭证。RLS不是预签上传即时撤销机制，signed upload会使用服务特权。
- 现有`account_avatar_guard`对头像命名空间UUID检查真实账号活跃状态，并参与账号共享门闩；在元数据INSERT/UPDATE处同样约束Storage特权提交。新上传预检被拒绝，已开始请求也不能在accepted之后成功发布metadata。Auth最终不存在时同样fail closed。不能通过将业务创建者替换成别人来清理。
- Storage负责流式写后端文件、元数据事务和失败清理事件；SQL不能撤回已传入字节，也不等于底层blob管理API。
- 应用负责已登记对象的枚举、API删除及后置复核；隐藏临时对象、内部对象版本及基础设施故障后的修复属于平台边界。Production前仍要核验实际所有写路由均触发guard，不能凭本地版本保证未来版本。

### 7.3 Versioned source review — not a hosted SLA

只读提取缓存镜像v1.65.1的`dist`源码到临时目录，没有修改Storage核心。关键行为：

- `storage/uploader.js`先预检、写blob，再`completeUpload()`事务upsert；失败路径发`ObjectAdminDelete`清该版本及.info。标准和签名路径的发布屏障已真实测试。
- `storage/object.js`删除在DB事务内选取/删除metadata并执行backend删除。网络断开不能作为事务是否提交的证据，故保留同job重试和postflight。
- `internal/queue/event.js`的`PG_QUEUE_ENABLE=false`分支同步执行清理，无独立持久任务；开启时走平台已有队列及其重试/保留配置。进程在事件送出前硬崩溃无法靠catch保证清理，不能把源码中的重试选项当作每次孤立文件都必然被发现的保证。本轮没有新增或启用通用队列。
- 有平台管理端orphan scanner/API及脚本（`http/routes/admin/objects.js`、`storage/scanner`），不等于托管项目可用的公开API。尤其本地`storage/backend/file.js.list()`返回空keys，不能用该scanner证明本地磁盘无孤立文件。未向应用增加内部管理凭据、后台S3枚举或整桶扫描系统。
- S3源码部分路径复用uploader，不能据此冒称TUS/S3所有路由已完成HTTP验收。本项目未使用这两种上传；未来启用或Production对外可用路由不同，需单独核验最终发布同样受guard控制。

### 7.4 Minimal recovery and completion contract

**本轮按用户授权澄清Storage阶段的完成语义：应用可访问/可登记对象的清理与不可逆发布屏障可以验证；供应商内部字节生命周期不能伪装成应用可证明的零字节。**这取代§6.4中将未知硬上界等待作为唯一候选的方案，不降低普通Personal保护、共享保留或已知失败不得完成的规则。

1. **先冻结发布。**持久accepted及既有guard必须生效；拒绝旧JWT、新上传授权及对目标namespace的迟到metadata提交。保持UUID判定，Auth删除后也不能重建。不能仅撤前端Session/改RLS/等签名过期。未能验证某允许路由的发布屏障时，不进入后续成功判定。
2. **清可枚举对象。**可信端从固定accepted job派生bucket/UUID前缀；按受控路径分批Storage API删除当前及遗留头像，反复第一页避免offset漏项，处理完整页、重复请求与文件已不存在。未知归属/额外资源停止扩删。不能直接删storage.objects，不能按created_by清共享文件。
3. **未知结果保持未确认。**超时/5xx/响应丢失保留storage阶段及accepted屏障，使用现有next_attempt_at/generation规划下次独立重试。重试重新枚举并remove，确认后才推进；不依赖原HTTP进程、用户JWT或PWA存活。该执行器仍属于后续实现，本轮没有Cron/worker代码。
4. **逻辑排空postflight。**确认已受控路由无法再发布目标metadata；所有可枚举目标对象已通过API删除并复查无记录、已知原始对象不能再从origin取回；没有未确认删除响应/已知未解决清理异常。不能只用空列表作证明，也不能承诺已下载/缓存内容消失。
5. **平台常规生命周期。**正常迟到失败上传不可发布，其临时字节依官方平台机制清理。应用不逐字节证明供应商内部回收，不因没有全局硬超时而引入新上传网关、S3镜像或永久扫描队列。平台后台不可观测本身不是每个job必然needs_attention；它是明确披露的供应商责任，不能宣称立即物理删除。
6. **已知异常必须截停。**发现硬崩溃残留、平台明确清理失败、无法覆盖的发布路由、未知归属或持续异常时进入needs_attention（非成功），保留目标与证据，不推进Auth删除或completed。运维向Supabase支持提供脱敏job/请求时间/路径范围/复现，由平台内部工具修复；不得把内部管理API或全站key交给客户端。对本地自托管环境，应由环境所有者用受支持的Storage修复机制处理，不能把托管自动清理说明套给默认file后端。
7. **恢复与最终完成。**短暂服务故障自动重试；安全/平台异常由受控修复后恢复同一job，再跑API postflight。需要持久化许可、租约/代次等后续合同，不改变job目标。Storage阶段通过仅代表上述应用边界；完整completed仍须业务数据、Profile/成员、Auth等其他后置条件全部确认。未解决异常或未知结果绝不能以供应商责任为借口完成。

此合同无需先为所有可能的持续上传创造猜测等待时长。若某实际路由绕过发布屏障，或供应商不再提供相应生命周期能力，保持PARTIAL/needs_attention并评审；不能拿本结论直接作为Production准入。

### 7.5 Targeted local evidence

命令：`python3 -B supabase/tests/account_deletion_storage_recovery.py`。复用上一轮Gate.start，仅启动缓存PG/Auth/PostgREST/Storage，不启动Edge或重跑Review/RLS全套。新增独立HTTP client使服务器pause/SIGKILL不杀掉测试执行端；Storage用**自有匿名Docker卷**保持文件跨重启存续，避免tmpfs消失造成假PASS。所有资源独立、无host端口/真实业务挂载，最终清自有容器/网络/匿名卷。

29项断言PASS，其中“已知残留进入needs_attention”是安全异常结果，不是自动清理成功。故障点由实际文件大小、pg_stat_activity/阻塞锁和API/DB后置状态确认，不改Storage核心，不禁用RLS/guard/FK。

| 故障范围 | 实测及严格限制 |
|---|---|
| 全部字节已落文件、metadata尚未提交 | 标准上传和旧signed upload两种：Share表锁仅限自有DB，观察完整字节+真实请求等待，再接受、释放锁；metadata因ACCOUNT_ACCESS_REVOKED拒绝，本地正常失败清理删除blob，job不completed |
| DELETE超时 | pause自有Storage，用存活独立client真实发DELETE并超时；不把超时当成功；恢复后独立API重试/重复remove可清metadata及真实文件，不影响别人的文件 |
| 删除请求中服务崩溃 | API已在真实metadata行锁等待时SIGKILL，重启同一卷后metadata和文件仍在，可重试API清除。**没有声称命中了物理unlink后、DB提交前的微小窗口** |
| 删除成功、确认丢失 | 真API完成后测试执行端丢弃响应，模拟持久确认前退出；核对DB/文件已清，独立重试幂等。不是篡改Storage响应/关闭保护 |
| 上传崩溃未产生清理事件 | 部分blob已出现、受理后SIGKILL；重启仍有无metadata文件，API list为空、公开DELETE不能发现它，旧JWT不能读取或重新发布；已有私有job成功记录needs_attention，伪造completed被拒绝 |
| 无关数据 | 正常另一用户头像字节始终保持；未调用Auth删除。残留只随最终销毁测试卷消失，不把teardown冒称应用恢复成功 |

精确post-unlink/pre-DB-commit崩溃、实际托管S3/平台队列重试/运维orphan修复、TUS/S3 HTTP及通用上传硬超时均NOT VERIFIED。为命中微窗口不改Storage核心；未来可由供应商受控环境或现成可观察故障点验证，不建立大型框架。

头像相关Node `tests/avatar.test.ts tests/avatar-ui.test.ts` 17/17 PASS；Python AST/diff/新增文件空白检查PASS。无前端/业务实现变化，未重跑Build、112项跨服务或794 SQL/其他全项目套件；旧证据保持，不混计。

### 7.6 Remaining deployment gate

本地设计无剩余关键阻塞，建议**CROSS_SERVICE_GATE_PASS_FOR_LOCAL_DESIGN**；不是完整账号注销/Slice 1/2完成，不授权Slice 3或任何删除发布。受限OTP受理、Personal专用路径、最终执行器仍待单独授权实施。

Production必须另核验实际bucket/所有权与路由、guard/权限和版本兼容、上传签名配置、托管平台生命周期/支持渠道及已知事故；当前无任何Production访问或证明。正常托管清理依官方公开行为，未冒充已有每账号SLA或底层扫描权限。若线上不满足发布屏障/生命周期条件，停止而非继承本地PASS。

## 8. Trusted Acceptance & Personal Cleanup — 2026-11-06

Author: Ping Weng。仅本地合成账号；25个既有未提交路径先记录指纹、在原内容上增补。正式v0.1.21，无Production、真实数据删除、依赖安装或Git发布；不重复Storage调查。

### 8.1 Verified caller and intent

专用Edge `account-deletion`仅begin/verify/confirm。默认503；还要求显式isolated-local及本地HTTP后端白名单，不增加部署/config资源。输入严格键白名单/4KiB上限，不接受user_id、email、space_id或verified布尔授权。每次先用Auth.getUser验证原JWT，邮箱取已确认Auth身份；随后核对sub/role/session_id，数据库核对同一auth.sessions行及not_after。JWT解码仅发生在getUser成功之后，不替代验签。

- `prepare_my_account_deletion()`从auth.uid派生目标；同账号一条稳定request。原会话绑定、challenge有效5分钟；另设备5分钟内不能替换；同会话60秒发送冷却。signInWithOtp明确shouldCreateUser:false。
- service-only claim/finish/release是OTP验证端的窄合同，不开放private受理函数。claim每challenge最多5次、30秒CAS租约；finish再次核对user/session/request/challenge/claim和期限，仅写随机许可摘要；客户端直接RPC拒绝。
- Edge独立不持久化的Auth client执行verifyOtp，结果UUID必须精确相同；新临时OTP session只做local signOut，原session保留。服务client、调用者client、临时验证client不共用Session；失败不发许可。
- 32字节随机确认许可只返回一次，数据库仅存SHA256摘要和5分钟期限，绑定原session/UUID/request。未受理的丢响应可等冷却后重新发起challenge；没有取回明文许可的后门。OTP、JWT、邮件正文及原始许可均不写数据库/日志。

**OTP能力边界：**沿用Supabase邮箱OTP，没有新增Auth用途命名空间。验证码本身不是“注销专用”的新Auth类型；注销授权来自本专用意图内重新调用verifyOtp、同UUID检查、原会话绑定、服务端一次性许可及最终确认。普通登录成功记录、AMR/iat、客户端verified标志或已消费的普通登录OTP不能直接变成注销许可。不宣称邮件验证码在Auth层具有独立的注销用途签名。

### 8.2 Acceptance, replay and lock ordering

`accept_my_account_deletion(request,token)`仅authenticated可执行，从auth.uid及真实session确定目标；直接调用也必须有该会话绑定的有效许可。Edge还要求显式confirmed:true。原子消费许可、重新检查**全部**Shared Owner、更新accepted并开启既有账号屏障；Owner拒绝会回滚许可消费。提交才是不可逆起点；只返回202 accepted/processing，不是completed。

锁延续Slice 2：受理账号排他门闩→准备job行，不等Space/业务行。业务清理job行→按UUID稳定排序的Space advisory→Space行→业务行，不取得账号排他门闩。已accepted的prepare/accept重放在账号门闩下直接读取不可变身份，不再FOR UPDATE job，避免“清理持job等Space、写者持Space等账号、重放持账号等job”的潜在环。本轮真实HTTP测试观察清理等Space时确认重放及时返回、无死锁；原28个SQL双会话场景回归通过，未改既有全局锁顺序。

### 8.3 Restricted Personal cleanup

`cleanup_account_business(request,generation)`仅service_role具有执行权，目标不由请求UUID参数直接指定，必须从已受理job派生。缺失identity_verified_at/permit_used_at、未受理、非法phase/status或首轮generation过期即拒绝；business_cleaned_at已有则只返回幂等成功，不重复删除。内部prepare/accept及private表不授予应用/service访问权。

其owner为专用NOLOGIN/NOINHERIT/NOBYPASSRLS角色account_deletion_executor，不是业务表owner；无INSERT/TRUNCATE/CREATE/角色管理、无应用/service/authenticator成员资格。它只获job和确定工作集的必要SELECT/DELETE及邀请码列UPDATE策略。GUC工作集不是单独授权：唯一定义者入口重置并从可信job派生，普通/service直接DELETE即使伪造GUC仍无法成为该身份。

Personal保护trigger仅在current_user为该角色且old.created_by精确等于可信job目标时放行；普通客户端、普通Space RPC和直接service DELETE继续拒绝。既有delete_lifecycle_event_set改为invoker以保持受限身份，其现有公开生命周期调用者本身是definer、仍按原Owner/成员校验执行，helper仍不向客户端开放。没有关闭RLS、FK或保护trigger。

清理单一数据库事务：锁定并重验Owner/成员/Personal目标→快照私人Event ID/逻辑根和私人Task/Date来源→删本人接收账本及被删私人来源账本→复用叶子优先系列删除→删Personal及现有FK子表→Shared仅删本人personal事件、移除本人普通成员/轮换邀请码→删本人Push/Profile→后置核对。成员FK按旧合同解除Task指派并推进提醒schedule marker。绝不按created_by删共享业务，不改历史UUID，不移除额外活身份FK。

Shared Task/Event（含其他owner的personal事件）、Lists/Sections/Items、Important Dates、Review双方正文/participant和他人共享账本逐行JSON核对；合法变化仅邀请码、离开者指派及对应时间/去重marker。已退出成员但仍是历史创建者同样保留。原参与者仍可读双方Review，新成员/新Owner不能读取旧轮。

### 8.4 Deliberately incomplete execution

成功只写business_cleaned_at、generation+1、processing及storage待处理阶段（已有合法phase不前推）。Auth用户不删，Storage不在此函数清理，completed仍禁止转入。本地独立证明数据库子操作不等于已完成整体阶段编排：未来完整执行器优先按规格Storage→业务→Auth顺序；先验证的business标记不能跳过Storage/postflight。

没有Storage/Auth最终执行器、租约领取/自动调度、非登录状态回执、已注销身份UI或正式账户入口。不能部署可接受真实注销的接口，不能让用户进入当前无法离线自动完成的Production状态。service key本身仍广泛，不把窄RPC误称为能限制泄露service key；运行时不使用数据库owner凭据。

### 8.5 Evidence and remaining gate

真实隔离Auth→SMTP Mailpit→Email OTP→Edge Runtime→PostgREST→PG测试：升级54项、独立fresh 7项，共61项断言。包括真实错误/消费重放/30秒真实过期OTP、双设备session、两账号并发、Owner全部处理、事务末尾故障回滚、重试/幂等和共享逐行保留。服务端不同返回UUID场景仅Node注入模拟；许可过期通过DB时间fixture验证，不冒充真实等待5分钟。具体命令、822 SQL/28并发/119 Node及Build见TESTING最新节。

本地就本轮目标READY_FOR_REVIEW。Production真实catalog/默认ACL/建受限角色能力、Auth会话与SMTP配置、实际Storage及平台条件、完整租约/恢复/状态回执和最终完成门禁仍待独立授权实施/核验。真实OTP/iPhone PWA人工验收由用户完成；本轮仅合成账号本地SMTP，不是Production邮件或真机验收。

## 9. Final Execution & Offline Recovery — 2026-11-06

Author: Ping Weng。用户已接受§8本地阶段，另行授权隔离合成账号最终执行；正式v0.1.21不变。33个既有未提交文件先记录SHA256，原审计、屏障和trusted patch/专项保持；不接Production，不使用两个闲置或任何真实账号。

### 9.1 One leased job and one phase per wake

扩充现有private.account_deletions，不建队列：lease_token、storage_cleaned_at、auth_missing_at及短期receipt摘要/期限。claim只选已accepted、同UUID OTP验证/许可已消费、到期且无有效租约的accepted/processing记录，FOR UPDATE SKIP LOCKED最多一条；令generation递增、随机租约token、90秒期限。needs_attention/completed/preparing不参加领取。

每次内部HTTP仅允许action=work，无目标UUID、request_id、阶段或路径参数。独立32字节服务间唤醒凭据与用户JWT分开；匿名、用户JWT、service JWT及其他action/额外目标字段均不能作为work授权。Edge持service key只调用窄claim/check/advance/release；每个DB推进复核固定job、generation、lease token/期限/phase。运行时无数据库owner凭据。

数据库业务包装设置5秒锁等待上限，维持job→稳定排序Space advisory→Space行顺序；完成前再次检查租约期限，过期则整笔回滚。HTTP fetch的8秒超时仅是客户端预算，不证明Storage/Auth服务已停止；已开始外部请求可能晚到，后续固定目标幂等重试和DB fencing防止旧执行者推进状态，不声称external exactly-once。接受流程保持账号排他门闩不等Space/job清理行的既有设计，不新增长期跨服务锁。

### 9.2 Observable Storage cleanup, then business, then Auth

1. storage：从job UUID派生profile-avatars/UUID固定前缀。每次Storage API列第一页≤100对象，验证为文件和受控文件名后remove整批，再读第一页；有剩余则持久重试，不用递增offset跳项。发现嵌套目录/未知归属/其他bucket的目标所有权时停needs_attention，不扩删。定位不依赖Profile，当前/遗留对象均覆盖，不套正常头像24小时阈值。
2. API无错误及复查无可枚举对象后，DB检查目标namespace和owner/owner_id引用无metadata，再记storage_cleaned_at→business。超时、5xx、响应丢失不推进；重试重新枚举并做相同postflight。全链测试另外核对原始对象origin不可读及本地真实文件已移除，不以API空列表声称底层零字节。
3. business：经有效租约的advance包装调用已验证cleanup_account_business事务，再核对Profile/Personal/成员/personal Event/任务指派/订阅/本人接收账本为空。原业务清理body与受限角色保持，重复调用依据business_cleaned_at幂等，但包装仍做实际postflight。它先复查Storage，即使前轮已手动完成业务子集，也不能跳过Storage或Auth前置条件。
4. auth：先DB再查Storage/业务条件，然后Auth Admin getUserById；存在时deleteUser(job.user_id,false)明确hard delete，再get确认不存在。只有明确user_not_found/404才作不存在；网络错误/响应成功本身不够。DB再查auth.users不存在才写auth_missing_at→verify。没有接收任意UUID的Auth删除SQL函数。
5. verify：重新查Storage API和Auth API，再在最终DB事务检查可信accepted、阶段确认、业务/可观察Storage/Auth无残留、无error_code。仅此路径与guard共同允许completed，记录completed_at并清临时OTP/许可/session字段及租约。Shared历史UUID/正文应保留，不能以全库不再有该UUID判断成功。

原Personal清理函数的service_role EXECUTE已撤销，仅postgres拥有的租约包装可调用；由于函数实际owner为account_deletion_executor，迁移在事务内临时授予安装者切换该角色、以实际owner执行grant/revoke、reset后撤销成员资格，再检查有效ACL。不把无效REVOKE警告当成功，不改变普通Personal保护、不禁RLS/FK/trigger、不向运行时授予该角色。

§7的应用/平台边界保持：迟到metadata发布受已有guard限制；隐藏临时字节由平台生命周期管理，公开API不能证明所有底层字节消失。已知孤立残留/平台清理事故必须由可信运营标记needs_attention并受控修复，不允许该job完成；不能靠本执行器不存在的orphan扫描或猜测上传硬时限消除异常。

### 9.3 Durable retry, incidents and native local scheduling

临时网络/5xx/取消等保留当前阶段并写RETRY_LATER，next_attempt_at按尝试次数指数退避、间隔最多300秒，不固定次数永久放弃；多页清理也有有界推进。安全不变量/未知归属写INVARIANT_FAILED/needs_attention，继续隔离，不再被普通调度领取。执行进程崩溃、release失败或未知响应时保留租约，90秒后新的独立调度重新领取；已完成阶段须实查，Auth已删但阶段未确认仍能前进。

修复办法：运营先定位/修复原job的依赖或平台事故（文件用Storage API或供应商支持，不SQL删metadata）；只有DB owner可调用private.resume_account_deletion(request)，不授予service/client/PostgREST访问。恢复同一target/request，generation递增，从storage重新检查，不取消屏障、跳过OTP或直接completed；保留business标记也会做postflight。调度停止/凭据失效/持续无进展仍需运维发现，不能假定平台永不故障。

隔离测试使用真实缓存pg_cron 1.6.4、pg_net 0.20.3、Vault 0.3.1；两个每秒测试调度只执行固定private.wake_account_deletions_local()，其SECURITY DEFINER从Vault读取临时高熵secret并通过pg_net发HTTP。secret不写SQL文件、cron.command或日志，不给Edge DB凭据。正式部署仍规划每分钟唤醒，不能把每秒本地测试当Production配置。

**实际安全发现：**缓存pg_net默认net.http_request_queue可被anon/authenticated读取，Authorization会进入该表；只放Vault不能保护排队后的header。local_cron.sql在添加secret前以实际平台表owner撤销PUBLIC/anon/authenticated的SELECT并断言有效权限、Vault也不可读；仅普通postgres执行REVOKE会产生无效警告，测试据此拒绝。此安装身份只用于隔离配置，不进入运行时。Production必须独立核对所有相关队列/角色/权限及平台是否允许该收紧，不能自动部署或把该DDL混入未核验线上迁移。

### 9.4 Short receipt independent of deleted Auth

OTP成功后、接受前，Edge另外生成32字节随机receipt_token，并以同原会话/确认许可绑定摘要；返回原始回执给调用端后才有机会最终确认，避免接受/删除后才首次交付。只持摘要及期限，初始7天、completed时尚存在的摘要可再保留7天；每次后台claim同时清理已到期摘要。丢失/过期不影响后台完成，不能凭邮箱/UUID重新找回。

receipt动作接受POST body中的有效随机凭据，经Edge服务端摘要查询，只返回status；不需已经删除的Session，不返回UUID/request_id/邮箱/空间/错误详情，不放URL/query/log。未知/过期统一404；读回执不能执行、接受、恢复任务或改变目标。SQL读取函数仅service可用，表不向anon/client开放。

### 9.5 Verification boundary

最终真实服务及故障结果见TESTING最新节。原822 SQL/28双会话属于历史trusted子集回归，本轮保留可重复检查点，不把它冒称新Auth/Cron验收。新增catalog/ACL断言在真实Auth/Storage schema运行；独立fresh/upgrade比对public/private结构及ACL。

仍未授权/未验证：Production catalog/默认角色/受限角色安装能力、实际Storage版本/路由/平台事故处理、pg_net请求队列与Vault ACL、调度凭据配置和健康检查、Production Auth/邮件/网关行为、用户真实PWA操作及正式UI。所有本地闭环也不代表CLOSED或Production PASS。

本轮最终证据：升级50＋fresh3＝53项真实Auth/SMTP/PostgREST/Storage/Edge/Cron断言PASS，真实catalog权限检查分别执行；822 SQL/28双会话/2隔离检查为历史子集回归，Node121/121、cached Deno及Build PASS。具体失败注入和未验证项见TESTING。状态FINAL_EXECUTION_READY_FOR_REVIEW，仅本地；完成后停止等待用户/ChatGPT审查，不提交、不发布。

## 10. Frontend flow and local integration — 2026-11-06

Author: Ping Weng。后端39文件清单/证据/密钥模式核对后按用户明确授权本地Commit 7bc144f，无Push/Deploy。当前前端从该里程碑增量实现，正式v0.1.21/Version Index不变。

### 10.1 UI and environment boundary

AccountManagementPage增加默认隐藏入口，独立AccountDeletionPage复用原header、卡片、按钮、OTP表单习惯和移动返回手势。导出页面可退出再跳过，失败不锁注销；全部listCurrentSpaces分页读取Owner，失败关闭，操作后/发OTP前再读；转让/删除只走原SpaceManagementPage及独立确认，不在注销里静默删共享空间。复用页可选backLabel仅该路径显示“返回注销”，默认入口/布局保留，离开后刷新外层Space/模块状态。

仅VITE_ACCOUNT_DELETION_ENABLED=true + DEV + 浏览器与VITE_SUPABASE_URL均loopback HTTP时启用；生产Build返回false。没有任何VITE service/worker key。Edge原isolated-local/本地URL门禁保持，新增只允许两个5175本地Origin的OPTIONS/CORS响应以支持浏览器连接，任意Origin仍拒绝；无Production配置或资源。

OTP与一次性确认许可只在当前组件内存，不另存JWT，不向客户端提供目标UUID参数。沿用SDK既有登录Session保存约定，OTP实际验证在服务器独立client完成；前端不setSession为OTP结果。退出/身份变动清空内存许可，正常token刷新不误当新验证。服务端对错误/过期/已使用验证码可能使用同类拒绝，UI准确合并提示，不虚构可区分的供应商原因；网络、身份/意图变化、重发冷却与许可失效分别提示。

### 10.2 Receipt ownership and business gate

Root App在CalendarApp初始化之前包AccountDeletionBoundary；本地启用时先查current_account_active，未知/停用不bootstrap。最终提交前先持久化只读receipt，成功核对写入后才调用confirm；存储受限则拒绝提交、中文提示。localStorage仅token、expires及原UUID的SHA256本机绑定摘要（用于防止清理另一个后来登录账号，不是匿名化或服务端授权），无OTP/确认许可/邮箱/原UUID副本。回执能力仅查status，7天上限，过期/损坏本机记录清除，绝不放URL、日志或事件分析。

回执状态接管立即卸载业务/导出页，清内存快照/临时File与已有Object URL effect；接受回包未知时继续查询，不把点击/超时当成功。storage事件同步其他标签；重开即使Auth已删也能查询。accepted/processing没有取消；needs_attention保持隔离、不虚构人工渠道。没有回执且账号inactive只报告无法确认注销结果，不谎称未完成或已成功。

只有completed才清理：按旧合同尽力unsubscribe本机Push（远端已由后台删除）、原账号SDK local signOut，按绑定摘要匹配清理selectedSpaceId/navigation，移除回执及原App Session/状态，显示成功并返回登录。未知错误不清回执；登录清理错误可重试，不让旧账号恢复业务。若当前是不同账号，不退出其Session、不清它的偏好或Push；仅移除旧回执。平台不支持/离线时本机unsubscribe仍是best-effort，不冒称真机Push已验收。

### 10.3 Two minimal database contracts

- cancel_my_deletion_preparation()：无目标参数，仅authenticated、auth.uid和真实原session；账号EX门闩→未接受job行，已accepted直接false且不等清理行。未受理时清许可/claim/challenge，使迟到confirm/finish不能接受；不删除数据、不撤回已接受job、不改永久授权。用于未知结果时“核实未受理并返回”；先核对回执绑定，再经专用Edge的cancel动作固定原会话client调用，身份切换不能丢弃别人的旧回执；没有从preparing查询结果猜测在途请求已结束。
- review_deleted_participants(review_id)：仅authenticated，先复用can_read_review_round的当前成员+原参与者要求；只返回本轮相关participant且job completed/Auth不存在的UUID，不给任意UUID查询或private表读取。正文、RLS及历史可见范围不变。前端只用明确标记替换“对方”为“已注销用户”；Profile失败/普通退群/标记查询失败保持未知，不解析旧昵称/邮箱/头像。

独立frontend-contract forward patch与canonical追加；旧四份审计/barrier/trusted/execution patch、清理算法、调度和完整执行权限不重写。两个RPC的运行身份/反向越权已在真实本地Auth/PostgREST中验证。

### 10.4 Local evidence and remaining gate

真实集成使用既有隔离栈及合成账号，浏览器固定127.0.0.1:5175，经进程内loopback测试代理转发真实Auth/PostgREST/Edge/Storage；不替换认证返回或数据、不继承用户实际会话。SMTP真实8位OTP/30秒自然到期、重发新邮件游标、受理和后台Cron均实际执行。测试桥仅瞬时回环端口，无长期网关或新依赖；所有Docker/网络/tmpfs资源自有并最终清理。

Chrome/WebKit的状态/存储/身份变动/App bootstrap防护是明确的模拟API组件测试，不能当真实Auth E2E。真实API及浏览器命令、计数/截图核对见TESTING。Production实际catalog/两新RPC/Role/Vault/队列/网关/Storage/SMTP/部署版本仍NOT VERIFIED；真实iPhone/Android/PWA/推送与登录由用户验收。FRONTEND_READY_FOR_REVIEW仅本地，不第二次Commit、Push或Deploy。
