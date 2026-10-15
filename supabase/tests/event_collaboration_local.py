"""Only disposable local databases; never uses linked Supabase or Production."""
import pathlib, subprocess, sys, re, uuid, json
sys.dont_write_bytecode = True
from important_dates_local import SUPPORT
from event_collaboration_concurrency import run as races
ROOT=pathlib.Path(__file__).resolve().parents[2]
DOCKER=['docker','--context','desktop-linux']
CONTAINER='supabase_db_cross-platform-shared-calendar'
PSQL=DOCKER+['exec','-i',CONTAINER,'psql','-U','postgres','-X','-q','-t','-A','-v','ON_ERROR_STOP=1']
PATCH=ROOT/'supabase/patches/2026-10-15-event-collaboration.sql'
BASE='2204b30fee3e00d116d902c6925b33239b6409dc'
def sql(db,source):
    assert db=='postgres' or re.fullmatch(r'event_collab_(fresh|upgrade)_[a-f0-9]{12}',db)
    r=subprocess.run(PSQL+['-d',db],input=source,text=True,capture_output=True,timeout=90)
    assert r.returncode==0,r.stderr+r.stdout[-5000:]
    return r.stdout

def main():
    red='--red' in sys.argv
    endpoint=subprocess.check_output(DOCKER+['context','inspect','--format','{{.Endpoints.docker.Host}}'],text=True).strip()
    assert endpoint.startswith('unix://')
    storage=subprocess.check_output(DOCKER+['exec',CONTAINER,'pg_dump','-U','postgres','-d','postgres','--schema-only','--schema=storage','--no-owner','--no-comments'],text=True)
    assert 'CREATE POLICY' not in storage
    baseline=subprocess.check_output(['git','show',BASE+':supabase/schema.sql'],cwd=ROOT,text=True)
    created=[]
    catalog=None
    try:
        for mode in ['upgrade','fresh']:
            db=f'event_collab_{mode}_{uuid.uuid4().hex[:12]}'
            sql('postgres',f'create database "{db}" template template0;');created.append(db)
            sql(db,SUPPORT);sql(db,storage)
            sql(db,baseline if mode=='upgrade' or red else (ROOT/'supabase/schema.sql').read_text())
            if not red and mode=='upgrade':
                sql(db, """begin;
insert into auth.users(id,email) values ('eb000000-0000-4000-8000-000000000001','legacy@collab.invalid');
insert into public.spaces(id,name,kind,invite_code,created_by) values ('eb000000-0000-4000-8000-000000000010','Legacy','personal','COLLABLEGACY','eb000000-0000-4000-8000-000000000001');
insert into public.space_members(space_id,user_id,role) values ('eb000000-0000-4000-8000-000000000010','eb000000-0000-4000-8000-000000000001','owner');
insert into public.events(space_id,created_by,scope,owner_user_id,title,starts_at) values ('eb000000-0000-4000-8000-000000000010','eb000000-0000-4000-8000-000000000001','personal','eb000000-0000-4000-8000-000000000001','Legacy','2030-01-01'); commit;""")
                rollout=(ROOT/'docs/EVENT_COLLABORATION_ROLLOUT.md').read_text()
                pre,post=re.findall(r'~~~sql\n(.*?)\n~~~',rollout,re.S)
                readiness=json.loads(sql(db,pre))
                assert readiness==dict(installed=False,event_rls=True,guards=4,invalid_audiences=0,invalid_links=0),readiness
                fingerprint=sql(db,'select md5(jsonb_agg(to_jsonb(e) order by id)::text) from public.events e;')
                sql(db,PATCH.read_text())
                assert fingerprint==sql(db,'select md5(jsonb_agg(to_jsonb(e) order by id)::text) from public.events e;')
                print('upgrade: existing Event row fingerprint unchanged')

            if not red:
                rollout=(ROOT/'docs/EVENT_COLLABORATION_ROLLOUT.md').read_text()
                post=re.findall(r'~~~sql\n(.*?)\n~~~',rollout,re.S)[1]
                assert all(json.loads(sql(db,post)).values()),'documented postflight failed'
                signatures=sql(db, """select jsonb_agg(pg_get_functiondef(oid) order by proname)
from pg_proc where pronamespace='public'::regnamespace and proname in
('can_manage_event','validate_event_owner','prepare_event_reminder_schedule','assert_manage_recurring_event',
 'delete_logical_series','validate_event_lineage_audience','save_event_edit','check_event_reminder_delivery');""")
                if catalog is not None:assert signatures==catalog,'canonical/upgrade function drift'
                catalog=signatures
            test_source=(ROOT/'supabase/tests/2026-10-15-event-collaboration.test.sql').read_text()
            if red:
                test_source='begin; select no_plan();\n'+test_source[test_source.index('insert into auth.users'):test_source.index("select lives_ok($$update public.events set scope='shared'")]+"select * from finish(); rollback;"
            out=sql(db,test_source)
            if red:
                assert 'not ok' in out,out
                print('RED: baseline denies B editing A-owned Shared Event');return
            assert not re.search(r'^not ok|^# Looks like',out,re.M),out
            print(mode+': '+out.strip().splitlines()[-1])
            class Database:
                command=PSQL+['-d',db]
                def sql(self,source):return sql(db,source).strip()
            print(mode+': '+str(races(Database()))+' observed concurrency orderings PASS')
            total=0
            for name in ['2026-07-18-v0.1.7.3-series-editing.test.sql',
                         '2026-09-22-v0.1.9-shared-tasks-slice1.test.sql',
                         '2026-09-23-v0.1.9-task-status-ownership.test.sql',
                         '2026-10-05-v0.1.19-task-reminders.test.sql',
                         '2026-09-25-v0.1.13-space-lifecycle-slice1a.test.sql',
                         '2026-09-22-v0.1.8-slice3-recurrence-reminders.test.sql',
                         '2026-09-20-v0.1.8.2-reminder-delivery.test.sql']:
                regression=sql(db,(ROOT/'supabase/tests'/name).read_text())
                assert not re.search(r'^not ok|^# Looks like',regression,re.M),name+'\\n'+regression
                total+=int(re.search(r'^1\.\.(\d+)',regression,re.M)[1])
            print(mode+': '+str(total)+' existing Event/Task DB assertions PASS')
    finally:
        for db in created:sql('postgres',f'drop database "{db}";')
if __name__=='__main__':main()
