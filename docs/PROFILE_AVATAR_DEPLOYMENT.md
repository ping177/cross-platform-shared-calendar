# Profile Card Compact + Avatar v1 — Production deployment preparation

Status: CLOSED / PASS — user-confirmed Production manual acceptance. No new formal version.

## Reviewed scope

The forward patch adds two nullable Profile columns and three constraints, one private bucket and three scoped Storage policies in one transaction. It does not update/delete existing profiles, change public RLS, membership/Lifecycle, RPCs, Edge Functions, Auth or scheduler. Old frontend selects/updates only display_name and remains compatible. The new frontend requires the patch first.

Mutual exclusion allows both fields null (default), a known preset, or an own canonical UUID JPEG path. Existing Profile self-update RLS enforces owner-only writes. Storage INSERT is own path only; no UPDATE policy; DELETE requires own path and no current reference. SELECT permits own canonical objects or another user's currently referenced photo when both users still share a Space. Losing the last common membership prevents new signing; if another common Space remains, access remains legitimate. Already issued signed URLs remain usable until their five-minute expiry. Browser refreshes at 240 seconds and foreground/focus; errors retry after 30 seconds.

Frontend uploads a new immutable UUID before compare-and-set metadata, then cleans old photos. Unconfirmed metadata errors retain the new upload: a fresh read could precede a late commit. Existing bounded >24h unreferenced-file recovery handles leftovers, without exposing recent uncertain uploads to immediate cleanup retry. Confirmed conflicts and old-file cleanup retain existing behavior. Cleanup re-reads current metadata and Storage DELETE RLS also excludes the current reference.

## 1. Read-only Preflight — user runs only after authorization

First confirm the intended **Production project in the Supabase Dashboard**. Database names alone do not identify the project. Before authenticated local acceptance, Codex must verify the actual frontend target matches that project without printing keys. Port 5175 was switched from the offline Python mock fixture to the real Vite frontend for authenticated integration on 2026-10-14; target alignment is ximazjhxvmktpcdbypka.

Paste the complete block into SQL Editor. It reads catalogs and an aggregate count only; no user names/photos/keys are returned.

```sql
begin transaction read only;

select to_regclass('public.profiles') as profiles,
       to_regclass('public.space_members') as space_members,
       to_regclass('storage.buckets') as buckets,
       to_regclass('storage.objects') as objects,
       to_regprocedure('public.are_users_in_same_space(uuid,uuid)') as membership_helper;

select n.nspname as schema_name, c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.oid in (to_regclass('public.profiles'),to_regclass('public.space_members'),to_regclass('storage.objects'))
order by 1,2;

select column_name,data_type,is_nullable,column_default
from information_schema.columns
where table_schema='public' and table_name='profiles' order by ordinal_position;
select count(*) as existing_profile_count from public.profiles;

select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies
where (schemaname='public' and tablename='profiles')
   or (schemaname='storage' and tablename='objects')
order by schemaname,policyname;

select p.oid::regprocedure as function_name,p.prosecdef,p.proconfig,
       pg_get_functiondef(p.oid) as definition
from pg_proc p
where p.oid=to_regprocedure('public.are_users_in_same_space(uuid,uuid)');

select id,name,public,file_size_limit,allowed_mime_types
from storage.buckets where id='profile-avatars';

select has_table_privilege('authenticated','public.profiles','SELECT') as profile_select,
       has_table_privilege('authenticated','public.profiles','UPDATE') as profile_update,
       has_table_privilege('authenticated','storage.objects','SELECT') as object_select,
       has_table_privilege('authenticated','storage.objects','INSERT') as object_insert,
       has_table_privilege('authenticated','storage.objects','DELETE') as object_delete,
       has_function_privilege('authenticated','public.are_users_in_same_space(uuid,uuid)','EXECUTE') as helper_execute;

rollback;
```

Expected / STOP conditions:

- All five required objects exist; profiles/space_members/storage.objects RLS=true; six privilege flags=true.
- No avatar columns and no avatar bucket yet. Existing id/display_name/created_at remain intact. Existing Profile policies are canonical: SELECT self/current co-member; UPDATE USING and WITH CHECK both `id = auth.uid()`. Any additional broad UPDATE/ALL or SELECT policies require review; the patch's own guard is not a substitute for reviewing all policies.
- Helper is SECURITY DEFINER with search_path=public; its definition joins two **current** space_members rows on space_id, matching both requested user IDs. No historical/created_by permission shortcut.
- No permissive Storage policy applying to public/anon/authenticated. The exact patch intentionally aborts if any exists, even for another bucket. Do not delete policies or weaken the guard to proceed. Inspect any other roles/inherited privileges or restrictive policies for drift as well.
- Send the query results for review; do not run the patch until preflight is accepted and actual Production mutation is explicitly approved. Historical preparation had no live Production preflight result; the user subsequently reported Preflight and core Postflight PASS. Codex independently verified public zero-row Profile/member queries and Storage service reachability, not full live catalog policies.

## 2. Exact forward patch — user runs in SQL Editor after approval

Execute **the entire file**, including BEGIN/COMMIT:

`supabase/patches/2026-10-14-profile-avatar.sql`

SHA-256: `3f7b852f2480ab3ac0afe21b628722195fc31b94558af9b02e7118826cb031b8`

Do not execute supabase/schema.sql or the SQL test fixtures in Production. Do not separately pre-create the bucket/policies in Dashboard; this patch provisions them. No new secrets or Edge deployment is needed. It rejects replay, self-RLS drift, an existing bucket, broad Storage policies and disabled Storage RLS. Any error: stop, preserve the error and inspect state; do not remove guards, manually finish fragments or replay an already applied patch.

## 3. Read-only Postflight — user runs in SQL Editor

```sql
begin transaction read only;

select column_name,data_type,is_nullable,column_default
from information_schema.columns
where table_schema='public' and table_name='profiles'
  and column_name in ('avatar_preset','avatar_path') order by column_name;

select conname,convalidated,pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid='public.profiles'::regclass and conname like 'profiles_avatar_%'
order by conname;

select count(*) as profile_count,
       count(*) filter (where avatar_preset is not null or avatar_path is not null) as configured_avatar_count
from public.profiles;

select id,name,public,file_size_limit,allowed_mime_types
from storage.buckets where id='profile-avatars';

select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies
where (schemaname='public' and tablename='profiles')
   or (schemaname='storage' and tablename='objects')
order by schemaname,policyname;

select n.nspname as schema_name,c.relname,c.relrowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.oid in ('public.profiles'::regclass,'public.space_members'::regclass,'storage.objects'::regclass)
order by 1,2;

rollback;
```

Expected: two nullable text columns with no default; three validated preset/path/source constraints; initially configured_avatar_count=0 before new frontend acceptance. Compare profile_count with preflight allowing legitimate concurrent registration, not assuming a count difference proves data loss. One private bucket: public=false, 1048576 bytes, image/jpeg only. Exactly avatars_read SELECT, avatars_insert_self INSERT, avatars_delete_unused_self DELETE to authenticated; no avatar UPDATE. Review full policy bodies against patch; all prior Profile policies unchanged and RLS remains true. Send results; SQL catalog checks do not establish actual Storage API signing/upload or cross-device acceptance.

## 4. Release order and acceptance

1. Explicit backend authorization → accepted read-only preflight → exact patch → accepted read-only postflight.
2. Codex verifies real local new frontend target, Profile query/schema cache and Storage capability alignment. Use the real Vite frontend on fixed 5175, not the existing static mock fixture; report any server transition without changing the port.
3. User tests own photo upload/replace/reset, current member reads, cross-device persistence, outsider/anon denial, last common membership revocation/new signing denial, failure retry/old-file safety and >5-minute foreground renewal. Use disposable test accounts/photos where authorized; Codex does not drive logged-in sessions.
4. Only after authenticated local acceptance and separate Git/frontend publication authorization: required project-state review → Commit/Push → Vercel → asset/source/backend alignment → user Production/mobile/PWA smoke. No frontend-first deployment against a backend missing these columns.

If postflight/acceptance fails, pause the new frontend release; the old served frontend remains compatible with the additive backend. Preserve columns/bucket/files; any applied-backend correction is a newly reviewed forward patch under separate authorization, not deletion/reset/rollback. Unreferenced photos are handled by the existing bounded cleanup, not ad hoc SQL deletes.

## Current local integration checkpoint — 2026-10-14

- User reports exact patch Success in correct Production project and core Postflight PASS: two fields, three validated constraints, private JPEG bucket, three policies and RLS enabled. Existing test data retained.
- Actual served Vite configuration, CLI link and recorded Production identifier match `ximazjhxvmktpcdbypka`. Root/Vite/new ProfileCard/AvatarPicker/MemberSheet/avatar-data/final cat resources HTTP200; no mock fixture. Local address http://127.0.0.1:5175/; LAN address http://192.168.10.14:5175/ while on the same network. LAN HTTP is not secure-context installed-PWA evidence.
- Public-client Profile avatar columns and member Profile relationship queries with limit=0 both HTTP200, no returned user rows; no schema-cache error. Storage status HTTP200; unauthenticated bucket listing returns zero rows. Nonexistent-path signing HTTP400/NoSuchKey yields no URL but does not prove permissions for an existing real photo. Authenticated upload/signing/member revocation and cross-device tests remain for the user.
- Codex did not open/drive real signed-in browser sessions, query real Profile content, mutate Production, delete data or release the frontend. Existing957 tests/TypeScript/build results remain applicable; no business source changed for alignment.

## Release checkpoint

用户真实账号本地集成验收已通过：名称保存/取消；预设保存/刷新持久化；照片上传显示；同Space成员读取照片；切回预设后旧照片从Storage删除。12头像视觉已确认、猫F+02。用户随后明确确认Production新前端最终人工验收PASS，功能CLOSED / PASS。未完整覆盖的跨设备、照片替换/默认恢复、真实失败/断网重试、退出最后共同Space后新签拒绝、5分钟续期与iOS/Android/PWA仍待记录；自动测试不替代人工证据。数据整理独立延期、不阻塞本次发布。

本轮Git/前端发布已获明确授权，按Project-State-Review Gate执行正常Commit/Push与Vercel核验；不重新执行上面的后端部署步骤。该操作授权不扩大为数据库变更/清理或Production前端人工PASS。实际发布SHA与资源验证以独立最终发布报告为准。

## Final governance closeout — 2026-10-14

用户确认Profile Card Compact + Avatar v1正式Production人工验收PASS，最终状态CLOSED / PASS；Space Rename真实Production功能及最终UI也为CLOSED / PASS。Avatar已验收功能发布Source SHA：fcd3c8ad1b91bd7ec137c331e3d721ea8fae6cac。12预设及猫F+02「陶粉与燕麦」保持冻结。该整体验收不扩大为跨设备、照片替换/默认恢复、真实失败/断网重试、退出最后共同Space的新签拒绝、5分钟签名续期及iOS/Android/PWA全部边界已通过；未完整验证项继续在观察期记录。

暂停常规功能开发，进入约两周真实使用观察（2026-10-14起，约至2026-10-28）；记录实际使用问题与未完整覆盖的边界，再决定是否需要后续修正。未来独立待办：整理测试数据，三个测试账号保留两个；保留账号选择与清理需另行确认，本轮不执行，也不是当前阻塞项。不创建新版本或启动新功能。

Prior preparation/test checkpoints above are historical; their pending wording does not reopen the completed release. Existing957/957,49/49,TypeScript/Build and222 local SQL evidence retained; docs-only closeout runs diff-check only.
