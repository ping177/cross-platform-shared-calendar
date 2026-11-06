"""Final deletion only in an owned local stack, with synthetic SMTP identities."""
import argparse
import json
import secrets
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from account_deletion_trusted_local import TrustedGate
from account_deletion_cross_service import ROOT,HTTP

class ExecutionGate(TrustedGate):
    def __init__(self):
        super().__init__();self.wake_secret=secrets.token_hex(32)
    def command(self,args,source=None,timeout=60):
        args=list(args)
        if args[:1]==['create'] and self.prefix+'_deletion' in args:
            index=args.index('public.ecr.aws/supabase/edge-runtime:v1.74.1')
            args[index:index]=['-e','ACCOUNT_DELETION_WAKE_SECRET='+self.wake_secret]
        return super().command(args,source,timeout)
    def gateway_script(self,script):
        script=script.replace("['/rest/v1','http://rest:3000']","req.url.startsWith('/storage/v1/')?['/storage/v1','http://storage:5000']:['/rest/v1','http://rest:3000']")
        script=script.replace('createServer(async','let fault={},hit=false,release;\ncreateServer(async',1)
        script=script.replace(" try{", """ try{
  if(req.url==='/fault'){
   if(req.method==='POST'){let raw='';for await(const c of req)raw+=c;const next=JSON.parse(raw);if(next.mode==='resume'&&release)release();else{fault=next;hit=false;}}
   res.end(JSON.stringify({hit}));return;
  }""",1)
        script=script.replace('  const r=await fetch',"""  const target=req.method==='DELETE'&&(fault.kind==='storage'?req.url.startsWith('/storage/v1/object/'):fault.kind==='auth'?req.url.startsWith('/auth/v1/admin/users/'):false);
  const mode=target?fault.mode:null;
  if(mode==='fail'){fault={};res.writeHead(503).end('{}');return;}
  const r=await fetch""",1)
        script=script.replace('  res.writeHead(r.status',"""  if(mode==='lost'||mode==='pause'){await r.arrayBuffer();fault={};hit=true;if(mode==='pause')await new Promise(resolve=>{release=resolve;});res.writeHead(503).end('{}');return;}
  res.writeHead(r.status""",1)
        return script
    def start_deletion(self):
        if getattr(self,'red',False):return super().start_deletion()
        if getattr(self,'schema_mode','upgrade')!='fresh':
            self.sql((ROOT/'supabase/patches/2026-11-06-account-deletion-trusted.sql').read_text())
            self.sql((ROOT/'supabase/patches/2026-11-06-account-deletion-execution.sql').read_text())
        self.schema_mode='fresh'
        super().start_deletion()
    def wake(self):
        return self.http('deletion','/','POST',{'action':'work'},self.wake_secret)

def accept(g,user):
    permit=g.permit(user)
    assert g.action(user,'confirm',request_id=permit['request_id'],confirmation_token=permit['confirmation_token'],confirmed=True)['status']==202
    return permit

def stage(g,permit):
    return g.sql(f"select phase||':'||status from private.account_deletions where request_id='{permit['request_id']}'")

def fixture_due(g,permit):
    # Clock fixture only for targeted retry tests. Native Cron expiry/backoff is
    # independently tested below with real elapsed time and no client session.
    g.sql(f"update private.account_deletions set next_attempt_at=clock_timestamp() where request_id='{permit['request_id']}'")

def complete(g,permit):
    for _ in range(8):
        if stage(g,permit)=='verify:completed':return
        r=g.wake();assert r['status']==200
    raise AssertionError('Job did not complete: '+stage(g,permit))

def fault(g,kind,mode):
    assert g.http('gateway','/fault','POST',dict(kind=kind,mode=mode))['status']==200

def wait_for(predicate,timeout=15):
    deadline=time.monotonic()+timeout
    while time.monotonic()<deadline:
        if predicate():return
        time.sleep(.2)
    raise AssertionError('Observed local postcondition did not arrive')

def verify(g):
    from account_deletion_trusted_fixtures import seed,retained,fingerprints
    from account_deletion_cross_service import uid
    from concurrent.futures import ThreadPoolExecutor
    # Reject every credential crossover before any job exists.
    g.ok(g.http('deletion','/','POST',{'action':'work'})['status']==403,'anon cannot wake worker')
    a,b=g.new_user(),g.new_user()
    g.ok(g.http('deletion','/','POST',{'action':'work'},a['jwt'])['status']==403,'real user JWT cannot wake worker')
    g.ok(g.http('deletion','/','POST',{'action':'work'},g.service)['status']==403,'service JWT is not scheduler capability')
    g.ok(g.http('deletion','/','POST',{'action':'work','user_id':b['id']},g.wake_secret)['status']==403,'scheduler cannot select arbitrary target')
    g.ok(g.http('deletion','/','POST',{'action':'begin'},g.wake_secret)['status']==401,'scheduler capability cannot authorize user actions')
    g.ok(g.rpc(a['jwt'],'claim_account_deletion')['status']==403,'user cannot claim execution lease')
    g.ok(g.rpc(g.service,'cleanup_account_business',dict(p_request_id=uid(),p_generation=0))['status']==403,'service cannot bypass lease wrapper for Personal cleanup')
    i=seed(g,a,b);before=retained(g,i)
    another=g.data(g.rpc(a['jwt'],'create_space_with_invite',{'space_name':'Second Shared'}))
    assert g.rpc(b['jwt'],'join_space_by_invite_code',{'code':another['invite_code']})['status']==200
    second_task=uid()
    assert g.http('rest','/tasks','POST',dict(id=second_task,space_id=another['id'],created_by=b['id'],title='Keep second shared'),b['jwt'])['status']==201
    # More than one API page, including legacy/current avatars. No Profile link
    # is needed to find these names. Each object is created by real Storage API.
    image=b'\xff\xd8\xff\xe0'+b'fixture'*80+b'\xff\xd9'
    paths=[b['id']+'/'+uid()+'.jpg' for _ in range(101)]
    with ThreadPoolExecutor(max_workers=8) as pool:
        uploads=list(pool.map(lambda path:g.http('storage','/object/profile-avatars/'+path,'POST',token=b['jwt'],binary=image),paths))
    assert all(r['status']==200 for r in uploads)
    normal_path=a['id']+'/'+uid()+'.jpg'
    assert g.http('storage','/object/profile-avatars/'+normal_path,'POST',token=a['jwt'],binary=image)['status']==200
    p=accept(g,b)
    receipt=g.http('deletion','/','POST',dict(action='receipt',receipt_token=p['receipt_token']))
    g.ok(g.data(receipt)=={'status':'accepted'},'pre-delivered independent receipt reports acceptance only')
    g.ok(g.rpc(b['jwt'],'advance_deletion_execution',dict(p_request_id=p['request_id'],p_generation=0,p_lease_token=uid(),p_stage='complete'))['status']==403,'client cannot complete job')
    # Actually observe only one valid lease, then release it via protocol.
    with ThreadPoolExecutor(max_workers=2) as pool:claims=list(pool.map(lambda _:g.rpc(g.service,'claim_account_deletion'),range(2)))
    jobs=[g.data(r) for r in claims if g.data(r)]
    g.ok(len(jobs)==1,'two wake claims produce exactly one active lease')
    j=jobs[0];args=dict(p_request_id=j['request_id'],p_generation=j['generation'],p_lease_token=j['lease_token'])
    g.ok(g.rpc(g.service,'advance_deletion_execution',dict(**args,p_stage='complete'))['status']>=400,'valid lease alone cannot skip stages to completed')
    assert g.rpc(g.service,'release_deletion_execution',dict(**args,p_attention=False))['status']==200
    g.ok(g.rpc(g.service,'check_deletion_execution',args)['status']==403,'released lease token and generation cannot advance a later execution')
    fixture_due(g,p)
    g.wake()
    g.ok(stage(g,p)=='storage:processing' and g.sql(f"select count(*) from storage.objects where name like '{b['id']}/%'")=='1','bounded Storage page removes first 100 without skipping remaining object')
    fixture_due(g,p);g.wake()
    g.ok(stage(g,p)=='business:processing','Storage API and database postflight precede business stage')
    old=fingerprints(g)
    g.sql(f"create function public.execution_test_fault() returns trigger language plpgsql as $$begin if old.id='{b['id']}'::uuid then raise exception 'Injected transient cancellation' using errcode='57014'; end if;return old;end;$$;create trigger zz_execution_test_fault before delete on public.profiles for each row execute function public.execution_test_fault();")
    g.wake()
    g.ok(old==fingerprints(g) and stage(g,p)=='business:processing','mid-business transient failure rolls back all tables and retains retry stage')
    g.sql('drop trigger zz_execution_test_fault on public.profiles;drop function public.execution_test_fault();')
    fixture_due(g,p);g.wake()
    g.ok(stage(g,p)=='auth:processing' and before==retained(g,i),'business retry preserves Shared IDs bodies links and historical Review')
    g.ok(g.sql(f"select title from public.tasks where id='{second_task}'")=='Keep second shared','multiple Shared membership cleanup preserves other Space content')
    fault(g,'auth','fail');g.wake()
    g.ok(stage(g,p)=='auth:processing' and g.sql(f"select count(*) from auth.users where id='{b['id']}'")=='1','Auth Admin failure keeps identity and pending job')
    fixture_due(g,p);fault(g,'auth','lost');g.wake()
    g.ok(stage(g,p)=='auth:processing' and g.sql(f"select count(*) from auth.users where id='{b['id']}'")=='0','Auth hard-delete commits but response loss cannot mark completion')
    fixture_due(g,p);complete(g,p)
    g.ok(before==retained(g,i),'real Auth hard delete leaves Shared creator snapshots and bodies exact')
    g.ok(g.sql(f"select count(*) from auth.sessions where user_id='{b['id']}'")=='0','hard deletion removes Auth sessions')
    g.ok(g.rpc(b['jwt'],'ensure_personal_space')['status']==403 and g.data(g.http('rest','/profiles',token=b['jwt']))==[],'old signed JWT cannot recreate or read business data after hard deletion')
    g.ok(len(g.data(g.http('rest',f"/review_entries?review_id=eq.{i['round']}",token=a['jwt'])))==2,'remaining original Review participant retains both bodies after hard delete')
    c=g.new_user();code=g.sql(f"select invite_code from public.spaces where id='{i['shared']}'")
    assert g.rpc(c['jwt'],'join_space_by_invite_code',{'code':code})['status']==200
    assert g.rpc(a['jwt'],'transfer_space_ownership',dict(p_space_id=i['shared'],p_new_owner_user_id=c['id']))['status']==204
    g.ok(g.data(g.http('rest',f"/review_entries?review_id=eq.{i['round']}",token=c['jwt']))==[],'new Owner gains no historical Review rights')
    g.ok(g.http('storage','/object/authenticated/profile-avatars/'+paths[0],token=g.service)['status']>=400,'deleted original avatar cannot be read from Storage origin')
    import base64
    g.ok(g.http('storage','/object/authenticated/profile-avatars/'+normal_path,token=a['jwt'])['base64']==base64.b64encode(image).decode(),'other user avatar bytes remain exact')
    g.ok(g.sql(f"select count(*) from storage.objects where name like '{b['id']}/%'")=='0','target observable Storage namespace empty')
    # File backend really removed registered objects, beyond metadata/API lists.
    disk=g.command(['exec',g.prefix+'_storage','find','/var/lib/storage','-type','f'])
    g.ok(all(path.split('/')[-1] not in disk for path in paths),'registered target files removed from local backend')
    r=g.http('deletion','/','POST',dict(action='receipt',receipt_token=p['receipt_token']))
    g.ok(g.data(r)=={'status':'completed'},'receipt after Auth deletion reveals only completed status')
    g.ok(g.http('deletion','/','POST',dict(action='receipt',receipt_token=secrets.token_hex(32)))['status']==404,'unguessable receipt has no enumeration by UUID')
    g.sql(f"update private.account_deletions set receipt_expires_at=clock_timestamp()-interval '1 second' where request_id='{p['request_id']}'")
    g.ok(g.http('deletion','/','POST',dict(action='receipt',receipt_token=p['receipt_token']))['status']==404,'expired receipt rejected independently of deleted session')
    # Missing Profile must not prevent fixed-namespace cleanup or retry.
    for mode in ['fail','lost']:
        user=g.new_user();assert g.rpc(user['jwt'],'ensure_personal_space')['status']==200
        path=user['id']+'/'+uid()+'.jpg'
        assert g.http('storage','/object/profile-avatars/'+path,'POST',token=user['jwt'],binary=image)['status']==200
        job=accept(g,user)
        g.sql(f"select public.cleanup_account_business('{job['request_id']}',0)") # actual accepted cleanup, owner-only test setup
        fault(g,'storage',mode);g.wake()
        g.ok(stage(g,job)=='storage:processing','Storage '+mode+' keeps unfinished stage with missing Profile')
        g.ok(g.sql(f"select count(*) from auth.users where id='{user['id']}'")=='1','Storage uncertainty prevents Auth delete')
        g.ok(g.data(g.wake())=={'status':'idle'},'durable backoff prevents immediate hot retry')
        fixture_due(g,job);complete(g,job)
        g.ok(stage(g,job)=='verify:completed','Storage '+mode+' independently retries idempotently')
    verify_attention(g,image)
    verify_cron(g)
    g.ok(g.http('rest','/tasks','POST',dict(space_id=another['id'],title='Normal after deletions'),a['jwt'])['status']==201,'normal member business writes remain available')
    print(f'PASS {len(g.results)} final-execution real-service assertions',flush=True)


def verify_attention(g,image):
    from account_deletion_cross_service import uid
    user=g.new_user()
    assert g.rpc(user['jwt'],'ensure_personal_space')['status']==200
    g.sql("insert into storage.buckets(id,name,public) values ('unknown-private','unknown-private',false)")
    path=uid()+'.jpg'
    assert g.http('storage','/object/unknown-private/'+path,'POST',token=g.service,binary=image)['status']==200
    g.sql(f"update storage.objects set owner_id='{user['id']}' where bucket_id='unknown-private' and name='{path}'")
    p=accept(g,user);g.wake()
    g.ok(stage(g,p)=='storage:needs_attention','unknown Storage ownership stops in attention without expansion')
    g.ok(g.data(g.wake())=={'status':'idle'} and g.sql(f"select count(*) from auth.users where id='{user['id']}'")=='1','ordinary scheduler cannot bypass needs_attention')
    g.ok(g.rpc(g.service,'resume_account_deletion',dict(p_request_id=p['request_id']))['status']==404,'operational resume is not exposed through PostgREST')
    assert g.http('storage','/object/unknown-private','DELETE',dict(prefixes=[path]),g.service)['status']==200
    g.sql(f"select private.resume_account_deletion('{p['request_id']}')")
    complete(g,p)
    g.ok(stage(g,p)=='verify:completed','owner-only incident repair resumes same intent and all postflight')


def verify_cron(g):
    # Real pg_cron -> pg_net -> Edge, with generated capability in native Vault.
    # No PWA/client JWT is involved after acceptance, including the crash retry.
    # Extension tables belong to the local platform administrator. Installing
    # this credential boundary as postgres only emits ineffective REVOKE
    # warnings on the cached image; assert real ACLs after the actual owner DDL.
    g.command(['exec','-i',g.prefix+'_db','psql','-U','supabase_admin','-d','postgres',
               '-X','-Atq','-v','ON_ERROR_STOP=1'],(ROOT/'supabase/tests/account_deletion_local_cron.sql').read_text())
    g.ok(g.sql("select not has_table_privilege('authenticated','vault.decrypted_secrets','SELECT') and not has_table_privilege('anon','net.http_request_queue','SELECT')")=='t','scheduler Vault and pending authorization headers inaccessible to clients')
    g.sql(f"select vault.create_secret('{g.wake_secret}','account_deletion_local_wake')")
    user=g.new_user();assert g.rpc(user['jwt'],'ensure_personal_space')['status']==200
    p=accept(g,user);g.wake();g.wake()
    assert stage(g,p)=='auth:processing'
    fault(g,'auth','pause')
    with ThreadPoolExecutor(max_workers=1) as pool:
        pending=pool.submit(g.wake)
        wait_for(lambda:g.data(g.http('gateway','/fault'))['hit'])
        g.command(['kill','--signal','KILL',g.prefix+'_deletion'])
        try:pending.result(timeout=15)
        except AssertionError:pass
    g.ok(g.sql(f"select count(*) from auth.users where id='{user['id']}'")=='0' and stage(g,p)=='auth:processing','real Edge SIGKILL after Auth delete leaves leased unfinished job')
    fault(g,'auth','resume');g.command(['start',g.prefix+'_deletion'])
    wait_for(lambda:g.http('deletion','/')['status']==405)
    g.sql("select cron.schedule('account-deletion-local-a','1 second','select private.wake_account_deletions_local();');select cron.schedule('account-deletion-local-b','1 second','select private.wake_account_deletions_local();')")
    g.ok(g.sql(f"select lease_until>clock_timestamp() from private.account_deletions where request_id='{p['request_id']}'")=='t','unexpired lease survives process crash; no early takeover')
    print('Waiting for real 90-second lease expiry and independent pg_cron/pg_net recovery; no client token',flush=True)
    wait_for(lambda:stage(g,p)=='verify:completed',115)
    g.ok(stage(g,p)=='verify:completed','two native Cron schedules recover expired lease and finish without user/PWA')
    g.ok(int(g.sql("select count(*) from cron.job_run_details where status='succeeded'"))>0,'real pg_cron records successful independent wakes')
    g.ok(int(g.sql("select count(*) from net._http_response where status_code=200"))>0,'real pg_net receives worker HTTP responses')
    g.sql("select cron.unschedule('account-deletion-local-a');select cron.unschedule('account-deletion-local-b')")

def schema_dump(g):
    from account_deletion_local import normalized_dump
    return normalized_dump(g.command(['exec',g.prefix+'_db','pg_dump','-U','postgres','-d','postgres','--schema-only','--schema=public','--schema=private','--no-owner','--no-comments']))

def verify_fresh(expected):
    g=ExecutionGate();g.schema_mode='fresh'
    try:
        g.start();g.start_deletion()
        g.ok(schema_dump(g)==expected,'fresh/upgrade real execution schema and ACL parity')
        g.sql((ROOT/'supabase/tests/2026-11-06-account-deletion-execution.test.sql').read_text())
        user=g.new_user();g.rpc(user['jwt'],'ensure_personal_space');p=accept(g,user)
        complete(g,p)
        g.ok(stage(g,p)=='verify:completed' and g.sql(f"select count(*) from auth.users where id='{user['id']}'")=='0','empty fresh-schema account completes real hard deletion')
        g.ok(g.data(g.http('deletion','/','POST',dict(action='receipt',receipt_token=p['receipt_token'])))=={'status':'completed'},'fresh anonymous receipt remains valid after Auth deletion')
        print(f'PASS {len(g.results)} fresh real-service assertions',flush=True)
    finally:g.close()


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--red',action='store_true');opts=parser.parse_args()
    g=ExecutionGate();g.red=opts.red
    try:
        g.start();g.start_deletion()
        print('Cached preload:',g.sql('show shared_preload_libraries'),flush=True)
        print('Local cron/net availability:',g.sql("select name||':'||default_version from pg_available_extensions where name in ('pg_cron','pg_net','supabase_vault') order by name"),flush=True)
        if opts.red:
            g.ok(g.rpc(g.service,'claim_account_deletion')['status']==404,'RED execution lease contract is missing on trusted baseline')
            return
        g.sql((ROOT/'supabase/tests/2026-11-06-account-deletion-execution.test.sql').read_text())
        print('PASS execution SQL catalog/authority assertions',flush=True)
        expected=schema_dump(g)
        verify(g)
    finally:g.close()
    if not opts.red:verify_fresh(expected)
if __name__=='__main__':main()
