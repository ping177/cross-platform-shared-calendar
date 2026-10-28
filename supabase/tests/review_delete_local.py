"""Disposable local-only databases; never uses the linked Production project."""
import importlib.util, pathlib, re, subprocess, sys, uuid
sys.dont_write_bytecode = True
from important_dates_local import SUPPORT
ROOT=pathlib.Path(__file__).resolve().parents[2]
CMD=['docker','--context','desktop-linux','exec','-i','supabase_db_cross-platform-shared-calendar']
PSQL=CMD+['psql','-U','postgres','-X','-q','-t','-A','-v','ON_ERROR_STOP=1']
def sql(db, source):
    assert db=='postgres' or re.fullmatch(r'review_delete_(upgrade|fresh)_[a-f0-9]{12}',db)
    r=subprocess.run(PSQL+['-d',db],input=source,text=True,capture_output=True,timeout=90)
    assert r.returncode==0,r.stderr+r.stdout[-4000:]
    return r.stdout

def concurrency(db):
    spec=importlib.util.spec_from_file_location('review_existing_concurrency',ROOT/'supabase/tests/review-foundation-concurrency.py')
    helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
    helper.PSQL=PSQL+['-d',db]
    a,b,space=[str(uuid.uuid4()) for _ in range(3)]
    sql(db,f"""begin;insert into auth.users(id,email) values ('{a}','race-a@review.invalid'),('{b}','race-b@review.invalid');
insert into public.spaces(id,name,kind,invite_code,created_by) values ('{space}','Race','shared','RACEDELETE','{a}');
insert into public.space_members(space_id,user_id,role) values ('{space}','{a}','owner'),('{space}','{b}','member');commit;""")
    actor=helper.actor_sql
    sql(db,actor(a,f"select public.set_space_module_enabled('{space}','review',true);"))
    def create(date):
        return sql(db,actor(a,f"select (public.create_review_round('{space}','{date}')).id;")).strip().splitlines()[-1]
    r=create('2030-02-01')
    helper.ordered_pair(actor(b,f"select public.delete_review_round('{r}'); select 'LOCKED'; select pg_sleep(1);"),actor(a,f"select public.save_my_review_entry('{r}','late',null,null,null,0);"),second_fails=True)
    assert sql(db,f"select count(*) from public.review_entries where review_id='{r}';").strip()=='0'
    r=create('2030-02-02')
    helper.ordered_pair(f"begin;delete from public.space_members where space_id='{space}' and user_id='{b}';select 'LOCKED';select pg_sleep(1);commit;",actor(b,f"select public.delete_review_round('{r}');"),second_fails=True)
    assert sql(db,f"select count(*) from public.review_rounds where id='{r}';").strip()=='1'
    sql(db,f"insert into public.space_members(space_id,user_id,role) values ('{space}','{b}','member');")
    helper.ordered_pair(actor(a,f"select public.delete_review_round('{r}');select 'LOCKED';select pg_sleep(1);"),actor(a,f"select public.create_review_round('{space}','2030-02-02');"))
    assert sql(db,f"select count(*) from public.review_entries where review_id='{r}';").strip()=='0'
    print(db.split('_')[2]+': delete/save, revoke/delete, delete/create serialized PASS',flush=True)

def main():
    endpoint=subprocess.check_output(['docker','--context','desktop-linux','context','inspect','--format','{{.Endpoints.docker.Host}}'],text=True).strip()
    assert endpoint.startswith('unix://')
    storage=subprocess.check_output(CMD+['pg_dump','-U','postgres','-d','postgres','--schema-only','--schema=storage','--no-owner','--no-comments'],text=True)
    assert 'CREATE POLICY' not in storage
    canonical=(ROOT/'supabase/schema.sql').read_text()
    baseline=subprocess.check_output(['git','show','305681e:supabase/schema.sql'],cwd=ROOT,text=True)
    definitions=[]
    for mode in ['upgrade','fresh']:
        db=f'review_delete_{mode}_{uuid.uuid4().hex[:12]}'
        sql('postgres',f'create database "{db}" template template0;')
        try:
            sql(db,SUPPORT);sql(db,storage);sql(db,baseline if mode=='upgrade' else canonical)
            if mode=='upgrade':
                sql(db,(ROOT/'supabase/patches/2026-10-15-review-delete.sql').read_text())
                sql(db,(ROOT/'supabase/patches/2026-10-17-v0.1.21-review-entry-conflict.sql').read_text())
            definitions.append(sql(db,"select pg_get_functiondef('public.delete_review_round(uuid)'::regprocedure);"))
            for file in ['2026-10-15-review-delete.test.sql','2026-09-26-v0.1.14-review-foundation.test.sql','2026-09-26-v0.1.14-review-date-chronology.test.sql']:
                out=sql(db,(ROOT/'supabase/tests'/file).read_text())
                assert not re.search(r'^not ok|^# Looks like',out,re.M),out
                print(mode+': '+file+' '+re.search(r'^1\.\.\d+',out,re.M)[0],flush=True)
            concurrency(db)
        finally:sql('postgres',f'drop database "{db}";')
    assert definitions[0]==definitions[1], 'canonical/patch mismatch'
    print('canonical and incremental RPC parity PASS')
if __name__=='__main__':main()
