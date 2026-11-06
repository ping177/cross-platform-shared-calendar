# Account Deletion — Production Catalog 手动只读获取

Author: Ping Weng。2026-11-06。状态：**PRODUCTION_READINESS_REVIEW — HOLD**，v0.1.21。

本轮仅拆分查询，未重新连接已超时的项目管理通道，未取得Production结果。HEAD f259f0d与既有全部未提交成果保留，无Commit/Push/Deploy。公开官方文档读取本轮因本机代理连接失败未取得新证据，不据此推断数据库故障。

## 操作顺序

1. 打开Supabase Dashboard，核对项目ref为 **ximazjhxvmktpcdbypka**，进入 **SQL Editor → 新查询**。不要打开迁移脚本，不运行整个SQL文件，不改变连接角色或权限。
2. **先只运行**：`SELECT 1 AS connection_ok;`。返回1后才继续；记录耗时。若超时/权限错误/其他错误，停止，不重复点击，不再运行catalog。
3. 打开[查询文件](./ACCOUNT_DELETION_PRODUCTION_CATALOG_READONLY.sql)。每次只复制一个Q标签下完整SELECT（到分号）；等结果成功再执行下一项。Q3A和Q3B须分开，不全选Run。
4. 顺序为 **Q1 → Q2 → Q3A → Q3B → Q4 → Q5**。任一项超时/报错即停，记录标签、时间、耗时及脱敏错误。无需把等待阈值调大，无需改数据库配置。Q1若显示所需public复合类型缺失，跳过Q3B并报告，不能补建对象。
5. 将各组结果以文本/JSON或SQL Editor结果CSV反馈；空数组/null也是结果。仅分享查询输出，不附项目API配置、连接字符串、函数源码、Cron命令、请求头或任何用户数据。不需提供密钥或数据库密码。

| 标签 | 内容与用途 | 不返回的内容 |
|---|---|---|
| Q0 | SELECT 1，连接门禁 | 无catalog或业务行 |
| Q1 | server设置只读值、namespace/扩展、表RLS/owner/ACL及列类型 | 不读各表中的记录或默认表达式 |
| Q2 | 所有指向Auth/Profile的FK及已知业务关联，含ON DELETE | 不读Auth/Profile或业务表 |
| Q3A | 相关函数签名/owner/definer/ACL/受限配置与函数体MD5 | 不返回函数体、JWT或任意配置值 |
| Q3B | 16个阶段前置函数摘要比对 | 不执行这些业务函数；不同阶段预期不同，不能要求全部matches=true |
| Q4 | RLS表达式摘要、trigger摘要、角色/继承/默认ACL | 不返回policy/trigger源码、密码或用户身份记录 |
| Q5 | 所有LOGIN及应用角色的队列/Vault有效读取权限布尔值 | 不读队列、headers、response或Vault秘密值；对象缺失为NULL |

所有实际执行语句都是SELECT/WITH…SELECT，FROM仅系统catalog或只读CTE；使用内置catalog解释/摘要/权限函数，不调用项目RPC。没有SET、DDL、DML、DO或动态执行。旧版显式READ ONLY事务/SET LOCAL与配置表取行已移除；这是更小的手工只读补充，不是迁移脚本。未在Production验证语法/权限或性能，不承诺拆分一定解决连接超时。

## SELECT 1也超时：只读健康检查后停止

- 留下项目ref、UTC时间、SQL Editor错误码/耗时；不要截图包含密钥、连接字符串、用户数据或查询历史的区域。
- 只查看Dashboard已提供的项目可用/暂停/维护状态、数据库健康和资源图表：CPU、内存、磁盘容量/IO、连接数是否出现异常。记录“可见/不可见、正常/告警及时间范围”，不修改资源、连接池或配置，不触发数据库重启/恢复/扩容。
- 查看[Supabase平台状态](https://status.supabase.com/)有无与项目区域、Database或Dashboard相关的事故/维护。无全局事故不等于本项目健康；CLI超时也不能单独证明数据库过载。
- Dashboard同样不可访问时，记录浏览器给出的状态码/网络错误即可，不导出HAR、Authorization、Cookie或用户Session。优先通过现有管理员/供应商支持通道提交脱敏项目ref、时间和错误；不虚构已配置的支持权限或响应承诺。
- 不执行额外诊断SQL、不读取活动SQL正文/业务日志、不kill连接、不VACUUM/REINDEX、不暂停/重启数据库、不升级资源。本轮到此停止，等待反馈或新的明确授权。

## 结果回来后的对照方式（尚未执行）

| 补丁顺序 | 对照证据 | 停止条件 |
|---|---|---|
| P1 audit-snapshots | Q2全部Auth/Profile FK与patch内9条预期逐一比较 | 额外/缺失/已部分应用/ON DELETE漂移 |
| P2 barrier | Q1 namespace/列，Q3A/B before_barrier，Q4 RLS/guard/ACL，Q5平台权限 | private已存在、摘要或角色/策略漂移、Storage guard权限不明 |
| P3 trusted | Q3B before_trusted；Q1列及Q4执行角色/成员关系 | 前置状态或受限角色授权不匹配 |
| P4 execution | Q3B before_execution；Q1阶段列，Q3A/Q4租约/完成权限 | 部分应用、来源摘要/实际ACL不匹配 |
| P5 frontend-contract | Q3A同名函数/owner/ACL，Q1/Q4及完整P4后置合同 | 已有同名对象、前置能力不完整或权限漂移 |

完整日期文件名及候选顺序见[预检报告§5](./ACCOUNT_DELETION_PRODUCTION_READINESS.md)。Q3B不匹配不是可自动修正的错误；必须结合实际阶段解释。缺对象/NULL并非成功。仅摘要无法解释未知函数/策略语义，出现漂移时停止，后续另行设计不会泄露凭据的定向核对，不索取完整函数源或配置导出。

**边界：**本文件严格只取系统metadata，故不读取迁移registry行、bucket配置行、Cron作业行、Edge/Secret配置；这些仍未核验，不能用catalog推断已部署版本/历史。catalog成功后才可逐项形成真实差异报告；目前没有实际差异结论，不标Production PASS。
