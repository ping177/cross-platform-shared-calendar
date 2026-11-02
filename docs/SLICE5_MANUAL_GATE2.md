---
author: Ping Weng
last_modified_by: Ping Weng
date: 2026-11-02
status: USER EXECUTED / GATE 2 PASS
---

# Slice 5 Production Ledger 手动只读门禁

## 当前结果：PASS（用户本人执行，2026-11-02确认）

两组SQL、Dashboard及最后REST检查均由用户实际完成并回传脱敏证据，全部满足Gate 2；详细HTTP/count/Content-Range/截断拒绝结果见[TESTING](./TESTING.md)最新节。Production为ximazjhxvmktpcdbypka，旧函数ACTIVE v5、verify_jwt=false，单一active每分钟调度。CLI 2.120.0已恢复，Codex本轮独立管理读取成功。真实REST非空仅2条，不代表20条真实负载或长期运行验收；新版容量修复尚需正式部署及观察。

下面SQL和操作说明保留为当时检查点的历史审计材料，**无需再次执行**；历史“尚未执行/REST待补/CLI损坏”不代表当前状态。无数据库或权限修改、claim调用或真实通知测试。

## 历史操作说明（已执行）

原检查点曾HOLD、SQL尚未执行（现已由用户完成并PASS）。只在 Supabase Dashboard 确认项目 **ximazjhxvmktpcdbypka** 后打开 SQL Editor。分别整块执行组1和组2；每组显式 READ ONLY、8秒语句超时并ROLLBACK，不写表、不调用claim、不发送通知、不运行EXPLAIN ANALYZE。SET LOCAL ROLE仅限事务内模拟既有service_role，结束恢复原角色；不创建角色或扩大权限。遇到错误/超时/缺表停止，把脱敏错误返回，不启用扩展、不改grant/索引/配置。

可以回传：两个SQL结果中的catalog元数据/布尔值/计数及EXPLAIN文本。不要提供cron.command、环境变量值、密钥、endpoint、邮箱、真实投递身份或业务行。组2只返回计数，EXPLAIN仅含虚构UUID，不返回真实记录。

## 组1：结构、唯一键、权限和调度（直接复制整块）

```sql
BEGIN READ ONLY;
SET LOCAL statement_timeout = '8s';
SELECT jsonb_build_object(
  'columns', (SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull) ORDER BY a.attnum)
    FROM pg_attribute a WHERE a.attrelid='public.reminder_deliveries'::regclass AND a.attnum>0 AND NOT a.attisdropped),
  'constraints', (SELECT jsonb_agg(jsonb_build_object('name',c.conname,'validated',c.convalidated,'definition',pg_get_constraintdef(c.oid)))
    FROM pg_constraint c WHERE c.conrelid='public.reminder_deliveries'::regclass),
  'indexes', (SELECT jsonb_agg(jsonb_build_object('name',i.indexrelid::regclass::text,'valid',i.indisvalid,'ready',i.indisready,'definition',pg_get_indexdef(i.indexrelid)))
    FROM pg_index i WHERE i.indrelid='public.reminder_deliveries'::regclass),
  'role', (SELECT jsonb_build_object('exists',true,'bypass_rls',r.rolbypassrls,
    'select',has_table_privilege(r.oid,'public.reminder_deliveries','SELECT')) FROM pg_roles r WHERE r.rolname='service_role'),
  'rls', (SELECT jsonb_build_object('enabled',relrowsecurity,'forced',relforcerowsecurity) FROM pg_class WHERE oid='public.reminder_deliveries'::regclass),
  'claim_functions', (SELECT jsonb_agg(jsonb_build_object('name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),
    'security_definer',p.prosecdef,'service_execute',has_function_privilege('service_role',p.oid,'EXECUTE'),
    'uses_identity_constraint',position('reminder_deliveries_occurrence_identity_key' in lower(p.prosrc))>0,
    'uses_do_nothing',lower(p.prosrc) ~ 'do[[:space:]]+nothing',
    'contains_update',lower(p.prosrc) ~ 'update[[:space:]]+public[.]reminder_deliveries',
    'contains_delete',lower(p.prosrc) ~ 'delete[[:space:]]+from[[:space:]]+public[.]reminder_deliveries')))
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN
      ('claim_reminder_delivery','claim_recurring_reminder_delivery','claim_task_reminder_delivery','claim_important_date_reminder_delivery')),
  'postgrest_role_settings', (SELECT jsonb_agg(jsonb_build_object('role',r.rolname,'setting',v.setting))
    FROM pg_db_role_setting s JOIN pg_roles r ON r.oid=s.setrole CROSS JOIN LATERAL unnest(s.setconfig) v(setting)
    WHERE r.rolname IN ('authenticator','service_role') AND split_part(v.setting,'=',1) IN ('pgrst.db_max_rows','pgrst.db_schemas','pgrst.db_extra_search_path'))
) AS ledger_contract;
-- Only aggregate metadata; never print cron.command (it can contain configuration/secrets).
SELECT count(*) AS matching_jobs, count(*) FILTER (WHERE active) AS active_jobs,
  count(*) FILTER (WHERE active AND schedule='* * * * *') AS active_every_minute,
  count(*) FILTER (WHERE command LIKE '%https://ximazjhxvmktpcdbypka.supabase.co/functions/v1/send-reminders%') AS expected_project_target
FROM cron.job WHERE jobname='send-reminders-every-minute' OR command LIKE '%send-reminders%';
ROLLBACK;
```

预期：查询字段均存在；三个source UUID、occurrence_date=date、subscription_id=UUID、due_at=timestamptz、status=text。状态约束为claimed/sent/failed且validated=true；身份唯一约束是NULLS NOT DISTINCT的(event_id,important_date_id,task_id,occurrence_date,subscription_id,due_at)，对应索引valid/ready。service_role存在、SELECT和BYPASSRLS为true。四个当前claim函数均service_execute=true、security_definer=true、uses_identity_constraint/uses_do_nothing=true；contains_update/delete预期false（这只是快速线索，不足以单独证明无重试分支）。不得把failed/claimed当已送达，它们只是当前唯一键合同下不可重新claim。

调度预期matching_jobs=active_jobs=active_every_minute=expected_project_target=1；不符合时保持HOLD，不能用改调度“修复”门禁。postgrest_role_settings若null，仅代表catalog没有这些显式role设置，不能认定API配置已核验。不要输出或检查其他可能包含秘密的role设置。

## 组2：既有角色读取与20身份查询计划（直接复制整块）

```sql
BEGIN READ ONLY;
SET LOCAL statement_timeout = '8s';
SET LOCAL ROLE service_role;
SELECT current_user='service_role' AS using_service_role,
  has_table_privilege(current_user,'public.reminder_deliveries','SELECT') AS ledger_select;
-- Read at most 21 rows through the existing identity ordering; return aggregates only.
WITH probe AS MATERIALIZED (
  SELECT event_id,important_date_id,task_id,occurrence_date,subscription_id,due_at,status
  FROM public.reminder_deliveries
  ORDER BY event_id,important_date_id,task_id,occurrence_date,subscription_id,due_at
  LIMIT 21
)
SELECT count(*) AS bounded_probe_rows,
  count(*) FILTER (WHERE status NOT IN ('claimed','sent','failed')) AS unexpected_states,
  count(*) FILTER (WHERE num_nonnulls(event_id,important_date_id,task_id)<>1 OR subscription_id IS NULL OR due_at IS NULL) AS invalid_identities
FROM probe;
-- EXPLAIN only: this query is planned, never executed. Every literal identity below is fabricated.
EXPLAIN (COSTS TRUE, FORMAT TEXT)
SELECT event_id,important_date_id,task_id,occurrence_date,subscription_id,due_at,status
FROM public.reminder_deliveries
WHERE
(event_id = '00000000-0000-4000-8000-000000000001'::uuid AND important_date_id IS NULL AND task_id IS NULL AND occurrence_date IS NULL AND subscription_id = '00000000-0000-4000-8000-000000000001'::uuid AND due_at = TIMESTAMPTZ '2099-01-01T00:00:00.000Z')
OR (event_id = '00000000-0000-4000-8000-000000000001'::uuid AND important_date_id IS NULL AND task_id IS NULL AND occurrence_date = DATE '2099-01-01' AND subscription_id = '00000000-0000-4000-8000-000000000002'::uuid AND due_at = TIMESTAMPTZ '2099-01-01T00:00:00.000Z')
OR (event_id IS NULL AND important_date_id IS NULL AND task_id = '00000000-0000-4000-8000-000000000001'::uuid AND occurrence_date = DATE '2099-01-01' AND subscription_id = '00000000-0000-4000-8000-000000000003'::uuid AND due_at = TIMESTAMPTZ '2099-01-01T00:00:00.000Z')
OR (event_id IS NULL AND important_date_id = '00000000-0000-4000-8000-000000000001'::uuid AND task_id IS NULL AND occurrence_date = DATE '2099-01-01' AND subscription_id = '00000000-0000-4000-8000-000000000004'::uuid AND due_at = TIMESTAMPTZ '2099-01-01T00:00:00.000Z')
OR (event_id = '00000000-0000-4000-8000-000000000001'::uuid AND important_date_id IS NULL AND task_id IS NULL AND occurrence_date IS NULL AND subscription_id = '00000000-0000-4000-8000-000000000005'::uuid AND due_at = TIMESTAMPTZ '2099-01-01T00:00:00.000Z')
OR (event_id = '00000000-0000-4000-8000-000000000001'::uuid AND important_date_id IS NULL AND task_id IS NULL AND occurrence_date = DATE '2099-01-01' AND subscription_id = '00000000-0000-4000-8000-000000000006'::uuid AND due_at = TIMESTAMPTZ '2099-01-01T00:00:00.000Z')
OR (event_id IS NULL AND important_date_id IS NULL AND task_id = '00000000-0000-4000-8000-000000000001'::uuid AND occurrence_date = DATE '2099-01-01' AND subscription_id = '00000000-0000-4000-8000-000000000007'::uuid AND due_at = TIMESTAMPTZ '2099-01-01T00:00:00.000Z')
OR (event_id IS NULL AND important_date_id = '00000000-0000-4000-8000-000000000001'::uuid AND task_id IS NULL AND occurrence_date = DATE '2099-01-01' AND subscription_id = '00000000-0000-4000-8000-000000000008'::uuid AND due_at = TIMESTAMPTZ '2099-01-01T00:00:00.000Z')
OR (event_id = '00000000-0000-4000-8000-000000000001'::uuid AND important_date_id IS NULL AND task_id IS NULL AND occurrence_date IS NULL AND subscription_id = '00000000-0000-4000-8000-000000000009'::uuid AND due_at = TIMESTAMPTZ '2099-01-01T00:00:00.000Z')
OR (event_id = '00000000-0000-4000-8000-000000000001'::uuid AND important_date_id IS NULL AND task_id IS NULL AND occurrence_date = DATE '2099-01-01' AND subscription_id = '00000000-0000-4000-8000-000000000010'::uuid AND due_at = TIMESTAMPTZ '2099-01-01T00:00:00.000Z')
OR (event_id IS NULL AND important_date_id IS NULL AND task_id = '00000000-0000-4000-8000-000000000001'::uuid AND occurrence_date = DATE '2099-01-01' AND subscription_id = '00000000-0000-4000-8000-000000000011'::uuid AND due_at = TIMESTAMPTZ '2099-01-01T00:00:00.000Z')
OR (event_id IS NULL AND important_date_id = '00000000-0000-4000-8000-000000000001'::uuid AND task_id IS NULL AND occurrence_date = DATE '2099-01-01' AND subscription_id = '00000000-0000-4000-8000-000000000012'::uuid AND due_at = TIMESTAMPTZ '2099-01-01T00:00:00.000Z')
OR (event_id = '00000000-0000-4000-8000-000000000001'::uuid AND important_date_id IS NULL AND task_id IS NULL AND occurrence_date IS NULL AND subscription_id = '00000000-0000-4000-8000-000000000013'::uuid AND due_at = TIMESTAMPTZ '2099-01-01T00:00:00.000Z')
OR (event_id = '00000000-0000-4000-8000-000000000001'::uuid AND important_date_id IS NULL AND task_id IS NULL AND occurrence_date = DATE '2099-01-01' AND subscription_id = '00000000-0000-4000-8000-000000000014'::uuid AND due_at = TIMESTAMPTZ '2099-01-01T00:00:00.000Z')
OR (event_id IS NULL AND important_date_id IS NULL AND task_id = '00000000-0000-4000-8000-000000000001'::uuid AND occurrence_date = DATE '2099-01-01' AND subscription_id = '00000000-0000-4000-8000-000000000015'::uuid AND due_at = TIMESTAMPTZ '2099-01-01T00:00:00.000Z')
OR (event_id IS NULL AND important_date_id = '00000000-0000-4000-8000-000000000001'::uuid AND task_id IS NULL AND occurrence_date = DATE '2099-01-01' AND subscription_id = '00000000-0000-4000-8000-000000000016'::uuid AND due_at = TIMESTAMPTZ '2099-01-01T00:00:00.000Z')
OR (event_id = '00000000-0000-4000-8000-000000000001'::uuid AND important_date_id IS NULL AND task_id IS NULL AND occurrence_date IS NULL AND subscription_id = '00000000-0000-4000-8000-000000000017'::uuid AND due_at = TIMESTAMPTZ '2099-01-01T00:00:00.000Z')
OR (event_id = '00000000-0000-4000-8000-000000000001'::uuid AND important_date_id IS NULL AND task_id IS NULL AND occurrence_date = DATE '2099-01-01' AND subscription_id = '00000000-0000-4000-8000-000000000018'::uuid AND due_at = TIMESTAMPTZ '2099-01-01T00:00:00.000Z')
OR (event_id IS NULL AND important_date_id IS NULL AND task_id = '00000000-0000-4000-8000-000000000001'::uuid AND occurrence_date = DATE '2099-01-01' AND subscription_id = '00000000-0000-4000-8000-000000000019'::uuid AND due_at = TIMESTAMPTZ '2099-01-01T00:00:00.000Z')
OR (event_id IS NULL AND important_date_id = '00000000-0000-4000-8000-000000000001'::uuid AND task_id IS NULL AND occurrence_date = DATE '2099-01-01' AND subscription_id = '00000000-0000-4000-8000-000000000020'::uuid AND due_at = TIMESTAMPTZ '2099-01-01T00:00:00.000Z')
LIMIT 21;
ROLLBACK;
```

预期：using_service_role/ledger_select=true；probe_rows为0..21，unexpected_states/invalid_identities均0。空表只证明空读可用，不证明非空投递实测。EXPLAIN不应报字段/类型/权限错误；非小表预期可利用身份唯一索引（例如BitmapOr/Bitmap Index Scan或Index Scan）。小表Seq Scan可能合理，不能仅凭Seq Scan字样判FAIL；需回传计划评估，不开ANALYZE、不开enable_seqscan开关、不新增索引。

## SQL之外必须补齐的证据

1. Dashboard → Edge Functions → send-reminders：只查看并记录ACTIVE、实际version、verify_jwt（仓库预期false）；查看已部署代码确实用SUPABASE_SERVICE_ROLE_KEY构造adminClient且persistSession=false/autoRefreshToken=false。只确认变量名/契约，不打开或复制secret值，不改配置。数据库SQL角色模拟不能证明已部署Edge真实使用的role。
2. 当前批量GET的PostgREST返回契约仍需受控只读API验证：20个精确身份OR过滤，选7列，Prefer=count=exact，limit=21；确认响应count与返回长度一致、未被API行数限制截断。上面SQL可证明字段/读取/计划，但不能替代REST响应头和网关长度验证。role设置缺失时不得猜测max_rows；部署代码对count不完整会拒绝，而不是静默放行。
3. 当前无可用受控API/CLI，**即使SQL都成功，也先把SQL及Dashboard脱敏结果发回评估，不自动判Gate 2全部PASS**。实际计划/完整读取证明、Edge版本/config和唯一调度证据齐备后，才可沿用发布授权。CLI签名问题仍会阻碍正常CLI部署，需另行恢复可信工具；不得自行重签名、移除安全保护或安装不受信任脚本。

## 本轮CLI只读诊断

PATH只发现Homebrew 2.107.0这一个已安装版本；wrapper选择darwin-arm64，当前macOS为arm64，架构匹配。codesign --verify --strict和spctl --assess均报告invalid signature (code or signature have been modified)。二进制含adhoc/linker签名，未设置TeamIdentifier；未发现该二进制的xattr名。签名无效与SIGKILL相符，但没有证据区分安装损坏、历史修改或其他来源，不能断言数据库不兼容。未修改安装、签名、xattr或系统安全设置。
