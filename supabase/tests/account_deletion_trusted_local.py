"""Real SMTP/Email OTP + Auth/REST fixture for local-only account deletion.

Reuses the owned cached stack. Mailpit receives mail only in the internal network.
Never prints messages, OTPs, Auth hashes, JWTs or synthetic service credentials.
"""
import argparse
import subprocess
import json
from pathlib import Path
import secrets
import tempfile
import time

from account_deletion_cross_service import DOCKER, Gate, HTTP, IMAGES, ROOT, uid

MAIL_IMAGE='public.ecr.aws/supabase/mailpit:v1.22.3'


class TrustedGate(Gate):
    def run(self,kind,env):
        if kind=='auth':
            self.command(['image','inspect',MAIL_IMAGE,'--format','{{.Id}}'])
            mail=self.prefix+'_mail';self.containers.append(mail)
            self.command(['run','-d','--pull=never','--name',mail,'--network',self.prefix,'--network-alias','mail',MAIL_IMAGE])
            env.update(GOTRUE_MAILER_AUTOCONFIRM='false',GOTRUE_MAILER_OTP_LENGTH='8',GOTRUE_MAILER_OTP_EXP='30',
                GOTRUE_SMTP_HOST='mail',GOTRUE_SMTP_PORT='1025',GOTRUE_SMTP_ADMIN_EMAIL='noreply@gate.invalid',
                GOTRUE_SMTP_SENDER_NAME='Isolated Auth',GOTRUE_SMTP_MAX_FREQUENCY='1s',GOTRUE_RATE_LIMIT_EMAIL_SENT='1000',
                GOTRUE_MAILER_TEMPLATES_MAGIC_LINK='http://storage:8080/template')
        return super().run(kind,env)

    def command(self,args,source=None,timeout=60):
        if args[-1:]==[HTTP]:
            args=list(args);args[-1]=HTTP.replace("auth:'http://auth:9999'","mail:'http://mail:8025',deletion:'http://deletion:9000',auth:'http://auth:9999'")
        return super().command(args,source,timeout)

    def start(self):
        super().start()
        template=(ROOT/'supabase/templates/magic_link.html').read_text().replace('1 小时','30 秒（隔离测试）')
        script="""
const {createServer}=require('node:http');
createServer(async(req,res)=>{
 try{
  if(req.url==='/template'){res.setHeader('Content-Type','text/html');res.end(TEMPLATE);return;}
  const [prefix,base]=req.url.startsWith('/auth/v1/')?['/auth/v1','http://auth:9999']:['/rest/v1','http://rest:3000'];
  if(!req.url.startsWith(prefix+'/')){res.writeHead(404).end();return;}
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const headers={...req.headers};delete headers.host;delete headers.connection;delete headers['content-length'];
  const r=await fetch(base+req.url.slice(prefix.length),{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
  res.writeHead(r.status,Object.fromEntries([...r.headers].filter(([k])=>!['transfer-encoding','content-encoding'].includes(k))));res.end(Buffer.from(await r.arrayBuffer()));
 }catch{res.writeHead(502).end();}
}).listen(8080,'0.0.0.0');
""".replace('TEMPLATE',json.dumps(template))
        if hasattr(self,'gateway_script'):script=self.gateway_script(script)
        self.command(['exec','-d',self.prefix+'_storage','node','-e',script])

    def start_deletion(self):
        if getattr(self,'schema_mode','upgrade')!='fresh':
            self.sql((ROOT/'supabase/patches/2026-11-06-account-deletion-trusted.sql').read_text())
        self.sql('update private.account_deletion_admission set enabled=true where singleton;')
        self.sql("notify pgrst,'reload schema';")
        self.bundle_dir=tempfile.TemporaryDirectory(prefix='calendar-trusted-edge-')
        subprocess.run(['node','supabase/tests/account_deletion_edge_bundle.mjs',self.bundle_dir.name,'account-deletion'],cwd=ROOT,check=True)
        name=self.prefix+'_deletion';self.containers.append(name)
        args=['create','--pull=never','--name',name,'--network',self.prefix,'--network-alias','deletion']
        env=dict(SUPABASE_URL='http://storage:8080',SUPABASE_ANON_KEY=self.anon,SUPABASE_SERVICE_ROLE_KEY=self.service,ACCOUNT_DELETION_RUNTIME_MODE='isolated-local',ACCOUNT_DELETION_ACCEPT_NEW='true')
        for key,value in env.items():args+=['-e',key+'='+value]
        self.command(args+['public.ecr.aws/supabase/edge-runtime:v1.74.1','start','--main-service','/tmp/function','--port','9000'])
        self.command(['cp',self.bundle_dir.name+'/account-deletion',name+':/tmp/function'])
        self.command(['start',name])
        for _ in range(40):
            try:
                if self.http('deletion','/')['status']==405:break
            except AssertionError:pass
            time.sleep(.1)
        else:raise AssertionError('Local deletion Edge unavailable')

    def action(self,user,action,**body):
        return self.http('deletion','/','POST',dict(action=action,**body),user['jwt'])

    def permit(self,user):
        r=self.action(user,'begin');assert r['status']==200,'Begin failed'
        intent=self.data(r);code,_=self.mail_code(user['email'])
        r=self.action(user,'verify',**intent,otp=code)
        assert r['status']==200,'Real OTP verification failed'
        return self.data(r)

    def new_user(self):
        email=uid()+'@gate.invalid';password=secrets.token_hex(16)
        r=self.http('auth','/admin/users','POST',dict(email=email,password=password,email_confirm=True),self.service)
        assert r['status']==200,'Synthetic confirmed user creation failed'
        r=self.http('auth','/token?grant_type=password','POST',dict(email=email,password=password))
        assert r['status']==200,'Real initial session unavailable'
        v=self.data(r);return dict(id=v['user']['id'],email=email,password=password,jwt=v['access_token'])

    def mail_code(self,email,after=None):
        for _ in range(50):
            messages=self.data(self.http('mail','/api/v1/messages')).get('messages',[])
            for message in messages:
                if after and message['ID']==after:continue
                if any(to.get('Address')==email for to in message.get('To',[])):
                    v=self.data(self.http('mail','/api/v1/message/'+message['ID']))
                    import re
                    match=re.search(r'\b(\d{8})\b',v.get('Text','')+' '+v.get('HTML',''))
                    assert match,'Mail arrived but did not contain configured real OTP'
                    return match.group(1),message['ID']
            time.sleep(.05)
        raise AssertionError('NOT VERIFIED: local SMTP OTP email was not received')


def probe(g):
    user=g.new_user()
    r=g.http('auth','/otp','POST',dict(email=user['email'],create_user=False))
    assert r['status']==200,'Local Auth OTP send failed'
    code,_=g.mail_code(user['email'])
    r=g.http('auth','/verify','POST',dict(email=user['email'],token=code,type='email'))
    assert r['status']==200 and g.data(r)['user']['id']==user['id']
    print('PASS real SMTP OTP verifies same Auth UUID',flush=True)
    r=g.rpc(user['jwt'],'prepare_my_account_deletion')
    assert r['status']==404,'Expected missing acceptance contract on baseline'
    print('RED: trusted acceptance RPC absent on existing baseline',flush=True)


def verify(g):
    from concurrent.futures import ThreadPoolExecutor
    from account_deletion_trusted_fixtures import seed,retained,fingerprints
    owner,member,other=[g.new_user() for _ in range(3)]
    fixture=seed(g,owner,member);before=retained(g,fixture)
    task_marker=g.sql(f"select reminder_schedule_changed_at from public.tasks where id='{fixture['task']}'")
    session_count=g.sql(f"select count(*) from auth.sessions where user_id='{member['id']}'")
    begun=g.action(member,'begin');g.ok(begun['status']==200,'dedicated intent starts without accepting account')
    intent=g.data(begun);code,_=g.mail_code(member['email'])
    g.ok(g.action(member,'verify',**intent,otp=str((int(code[0])+1)%10)+code[1:])['status']==403,'wrong real email OTP rejected')
    g.ok(g.action(other,'verify',**intent,otp=code)['status']==409,'different caller UUID cannot use another intent')
    rejected=g.rpc(member['jwt'],'finish_deletion_verification',dict(p_user_id=member['id'],p_session_id=uid(),p_request_id=intent['request_id'],p_challenge_id=intent['challenge_id'],p_claim_id=uid(),p_permit_hash='a'*64))
    g.ok(rejected['status']==403,'client cannot mint trusted verification through direct RPC')
    verified=g.action(member,'verify',**intent,otp=code)
    g.ok(verified['status']==200,'actual SMTP OTP verifies original UUID for this dedicated intent')
    permit=g.data(verified)
    g.ok(g.sql(f"select count(*) from auth.sessions where user_id='{member['id']}'")==session_count,'temporary OTP session removed; original session remains')
    g.ok(g.http('auth','/user',token=member['jwt'])['status']==200,'original device session still valid after local temporary logout')
    g.ok(g.action(member,'verify',**intent,otp=code)['status']==409,'OTP success cannot be replayed into a second permit')
    # A second genuine device cannot reuse the first device's permit.
    login=g.http('auth','/token?grant_type=password','POST',dict(email=member['email'],password=member['password']))
    second=dict(member,jwt=g.data(login)['access_token'])
    g.ok(g.action(second,'confirm',request_id=permit['request_id'],confirmation_token=permit['confirmation_token'],confirmed=True)['status']==409,'permit bound to original Auth session')
    g.ok(g.action(second,'begin')['status']==409,'same account second device cannot replace pending challenge')
    p=fixture['personal']
    g.ok(g.http('rest',f'/spaces?id=eq.{p}','DELETE',token=g.service)['status']>=400,'ordinary service_role Personal DELETE remains protected')
    g.ok(g.rpc(g.service,'cleanup_account_business',dict(p_request_id=intent['request_id'],p_generation=0))['status']==403,'preparing/verified job is not cleanup authorization')
    confirm=dict(request_id=permit['request_id'],confirmation_token=permit['confirmation_token'],confirmed=True)
    with ThreadPoolExecutor(max_workers=3) as pool:
        results=list(pool.map(lambda device:g.action(device,'confirm',**confirm),[member,member,second]))
    g.ok(all(r['status']==202 for r in results[:2]) and results[2]['status']==409,
        'concurrent duplicate confirmations converge; other real device cannot consume original-session permit')
    g.ok(g.sql(f"select count(*) from private.account_deletions where user_id='{member['id']}' and accepted_at is not null and permit_used_at is not null")=='1','one durable accepted intent and consumed permit')
    g.ok(g.rpc(member['jwt'],'ensure_personal_space')['status']==403,'acceptance atomically activates old-JWT bootstrap barrier')
    g.ok(g.rpc(member['jwt'],'cleanup_account_business',dict(p_request_id=intent['request_id'],p_generation=0))['status']==403,'ordinary user cannot invoke cleanup executor')
    snapshot=fingerprints(g)
    # Deterministic SQL fault at the last Profile delete, after preceding work.
    # Added test trigger only; existing guards remain enabled and unchanged.
    g.sql(f"""create function public.test_deletion_fault() returns trigger language plpgsql as $$begin
      if old.id='{member['id']}'::uuid then raise exception 'TEST_CLEANUP_ROLLBACK'; end if; return old; end;$$;
      create trigger zz_test_deletion_fault before delete on public.profiles for each row execute function public.test_deletion_fault();""")
    r=g.rpc(g.service,'cleanup_account_business',dict(p_request_id=intent['request_id'],p_generation=0))
    g.ok(r['status']>=400 and 'TEST_CLEANUP_ROLLBACK' in r['text'],'mid-cleanup injected failure rolls back whole database transaction')
    g.ok(snapshot==fingerprints(g),'rollback preserves every business table fingerprint')
    g.ok(g.sql(f"select business_cleaned_at is null and generation=0 from private.account_deletions where request_id='{intent['request_id']}'")=='t','rollback does not advance phase or idempotency marker')
    g.sql('drop trigger zz_test_deletion_fault on public.profiles; drop function public.test_deletion_fault();')
    from account_deletion_storage_recovery import sql_hold
    with ThreadPoolExecutor(max_workers=1) as pool:
        with sql_hold(g,f"select pg_advisory_xact_lock(hashtext('{fixture['shared']}'));"):
            future=pool.submit(g.rpc,g.service,'cleanup_account_business',dict(p_request_id=intent['request_id'],p_generation=0))
            deadline=time.monotonic()+6
            while time.monotonic()<deadline:
                if g.sql("select exists(select 1 from pg_stat_activity where usename='authenticator' and wait_event='advisory' and cardinality(pg_blocking_pids(pid))>0)")=='t':break
                time.sleep(.05)
            else:raise AssertionError('Cleanup did not reach observed Space advisory wait')
            g.ok(g.action(member,'confirm',**confirm)['status']==202,'accepted confirmation replay never waits on cleanup job row under account exclusive gate')
            blocked=g.http('rest','/tasks','POST',dict(space_id=fixture['shared'],title='Blocked concurrent assignment',assigned_to_user_id=member['id']),owner['jwt'])
            g.ok(blocked['status']==403,'concurrent business writer rejects inactive target without deadlock')
        r=future.result(timeout=15)
    if r['status']!=200:print('Cleanup diagnostic:',r['status'],r['text'],flush=True)
    g.ok(r['status']==200 and g.data(r) is True,'restricted cleanup succeeds on retry')
    after_retained=retained(g,fixture)
    if before!=after_retained:
        for k in before:
            if before[k]!=after_retained[k]:print('Preservation mismatch table:',k,flush=True)
    g.ok(before==after_retained,'Shared IDs bodies links and Review participants remain exact')
    g.ok(g.sql(f"""select not exists(select 1 from public.spaces where id='{p}')
      and not exists(select 1 from public.space_modules where space_id='{p}')
      and not exists(select 1 from public.list_sections where id='{fixture['private_section']}')
      and not exists(select 1 from public.push_subscriptions where id='{fixture['push']}')""")=='t',
      'dedicated path removes exact Personal Space/modules/Section and target Push subscription')
    for table,column,values in [('events','id',[fixture['root'],fixture['child'],fixture['private_root'],fixture['private_child']]),
        ('event_occurrence_exceptions','event_id',[fixture['root'],fixture['private_root']]),('tasks','id',[fixture['private_task']]),
        ('lists','id',[fixture['private_list']]),('list_items','id',[fixture['private_item']]),('important_dates','id',[fixture['private_date']]),
        ('review_rounds','id',[fixture['private_round']]),('review_entries','review_id',[fixture['private_round']]),
        ('reminder_deliveries','id',[fixture['delivery_target'],fixture['delivery_deleted'],fixture['delivery_private_task'],fixture['delivery_private_date']])]:
        quoted=','.join("'"+v+"'" for v in values)
        g.ok(g.sql(f"select count(*) from public.{table} where {column} in ({quoted})")=='0','exact private/owned deletion set cleared '+table)
    g.ok(g.sql(f"select reminder_schedule_changed_at>'{task_marker}'::timestamptz from public.tasks where id='{fixture['task']}'")=='t','assignment removal advances existing reminder dedup marker')
    g.ok(g.sql(f"select assigned_to_user_id is null from public.tasks where id='{fixture['task']}'")=='t','Shared Task retains body and clears departed assignment')
    g.ok(g.sql(f"select count(*) from public.profiles where id='{member['id']}'")=='0','Profile safely removed without cascading Shared Tasks')
    g.ok(g.sql(f"select count(*) from auth.users where id='{member['id']}'")=='1','Auth user intentionally remains; no Auth Admin deletion')
    g.ok(g.sql(f"select status='processing' and phase='storage' and business_cleaned_at is not null and completed_at is null from private.account_deletions where request_id='{intent['request_id']}'")=='t','business cleaned marker leaves Storage/Auth and final completion unfinished')
    after=fingerprints(g)
    g.ok(g.rpc(g.service,'cleanup_account_business',dict(p_request_id=intent['request_id'],p_generation=0))['status']==200 and fingerprints(g)==after,'lost-response/stale-generation cleanup replay performs no extra deletion')
    g.ok(g.data(g.http('rest',f"/review_entries?review_id=eq.{fixture['round']}",token=owner['jwt'])) and len(g.data(g.http('rest',f"/review_entries?review_id=eq.{fixture['round']}",token=owner['jwt'])))==2,'remaining original participant retains both Review bodies')
    # Empty Personal, ordinary-login success is not a dedicated permit.
    empty=g.new_user();assert g.rpc(empty['jwt'],'ensure_personal_space')['status']==200
    original_login=g.http('auth','/otp','POST',dict(email=empty['email'],create_user=False));assert original_login['status']==200
    login_code,login_mail=g.mail_code(empty['email'])
    native=g.http('auth','/verify','POST',dict(email=empty['email'],token=login_code,type='email'));assert native['status']==200
    g.ok(g.action(empty,'confirm',request_id=uid(),confirmation_token='a'*64,confirmed=True)['status']==409,'ordinary login success/JWT cannot serve as deletion permit')
    time.sleep(1.1)  # local Auth SMTP minimum frequency is configured to one second
    new_begin=g.action(empty,'begin');assert new_begin['status']==200,'Fresh dedicated email send failed'
    new_intent=g.data(new_begin);fresh_code,_=g.mail_code(empty['email'],after=login_mail)
    g.ok(g.action(empty,'verify',**new_intent,otp=login_code)['status']==403,'previously successful login OTP cannot authorize this new intent')
    verified=g.action(empty,'verify',**new_intent,otp=fresh_code);assert verified['status']==200
    empty_permit=g.data(verified)
    assert g.action(empty,'confirm',request_id=empty_permit['request_id'],confirmation_token=empty_permit['confirmation_token'],confirmed=True)['status']==202
    g.ok(g.rpc(g.service,'cleanup_account_business',dict(p_request_id=empty_permit['request_id'],p_generation=0))['status']==200 and g.sql(f"select count(*) from public.spaces where kind='personal' and created_by='{empty['id']}'")=='0','empty Personal Space removed only after its own trusted acceptance')
    latest=g.data(g.http('rest',f"/spaces?id=eq.{fixture['shared']}",token=owner['jwt']))[0]['invite_code']
    assert g.rpc(other['jwt'],'join_space_by_invite_code',{'code':latest})['status']==200
    assert g.rpc(owner['jwt'],'transfer_space_ownership',dict(p_space_id=fixture['shared'],p_new_owner_user_id=other['id']))['status']==204
    g.ok(g.data(g.http('rest',f"/review_entries?review_id=eq.{fixture['round']}",token=other['jwt']))==[],'new Shared Owner gains no historical Review participant rights')
    # Former creator is already absent from membership when deletion is accepted.
    former=g.new_user();assert g.rpc(former['jwt'],'ensure_personal_space')['status']==200
    history=g.data(g.rpc(owner['jwt'],'create_space_with_invite',{'space_name':'Former creator history'}))
    assert g.rpc(former['jwt'],'join_space_by_invite_code',{'code':history['invite_code']})['status']==200
    history_task=uid()
    assert g.http('rest','/tasks','POST',dict(id=history_task,space_id=history['id'],created_by=former['id'],title='Former creator exact task'),former['jwt'])['status']==201
    round_response=g.rpc(former['jwt'],'create_review_round',dict(p_space_id=history['id'],p_review_date='2031-01-01'))
    # Enable Review with the existing owner RPC, then create through the member.
    if round_response['status']!=200:
        assert g.rpc(owner['jwt'],'set_space_module_enabled',dict(p_space_id=history['id'],p_module_key='review',p_enabled=True))['status'] in (200,204)
        round_response=g.rpc(former['jwt'],'create_review_round',dict(p_space_id=history['id'],p_review_date='2031-01-01'))
    assert round_response['status']==200
    history_round=g.sql(f"select id from public.review_rounds where space_id='{history['id']}'")
    g.sql(f"update public.review_entries set focus='Keep former participant text' where review_id='{history_round}'")
    assert g.rpc(former['jwt'],'leave_shared_space',{'p_space_id':history['id']})['status']==204
    history_before=g.sql(f"select to_jsonb(t) from public.tasks t where id='{history_task}'")
    reviews_before=g.sql(f"select jsonb_agg(to_jsonb(e) order by user_id) from public.review_entries e where review_id='{history_round}'")
    former_permit=g.permit(former);assert g.action(former,'confirm',request_id=former_permit['request_id'],confirmation_token=former_permit['confirmation_token'],confirmed=True)['status']==202
    assert g.rpc(g.service,'cleanup_account_business',dict(p_request_id=former_permit['request_id'],p_generation=0))['status']==200
    g.ok(g.sql(f"select to_jsonb(t) from public.tasks t where id='{history_task}'")==history_before and g.sql(f"select jsonb_agg(to_jsonb(e) order by user_id) from public.review_entries e where review_id='{history_round}'")==reviews_before,'already-departed creator Profile cleanup preserves complete Shared Task and Review JSON')
    # Fresh users avoid changing real Auth timestamps or bypassing expiry.
    expiring=g.new_user();start=g.data(g.action(expiring,'begin'));exp_code,_=g.mail_code(expiring['email'])
    print('Waiting for configured real Auth 30-second OTP expiry (not a Storage timeout assumption)',flush=True)
    deadline=time.monotonic()+31
    while time.monotonic()<deadline:time.sleep(min(.5,deadline-time.monotonic()))
    g.ok(g.action(expiring,'verify',**start,otp=exp_code)['status']==403,'real Auth rejects expired SMTP OTP; no SQL backdating of Auth')
    g.ok(g.sql(f"select identity_verified_at is null and accepted_at is null from private.account_deletions where user_id='{expiring['id']}'")=='t','expired OTP creates neither permit nor accepted state')
    role_ok=g.sql("select not rolcanlogin and not rolbypassrls and not rolsuper and not rolcreaterole and not rolcreatedb from pg_roles where rolname='account_deletion_executor'")
    g.ok(role_ok=='t' and g.sql("select pg_has_role('service_role','account_deletion_executor','MEMBER') or pg_has_role('authenticated','account_deletion_executor','MEMBER')")=='f','executor has no login/BYPASS/role-management and no application membership')
    g.ok(g.sql("select has_table_privilege('account_deletion_executor','public.events','INSERT') or has_table_privilege('account_deletion_executor','public.events','TRUNCATE')")=='f','executor cannot insert or truncate business data')
    # Expired confirmation permit is a DB clock fixture, separate from Auth E2E.
    expired=g.new_user();expired_permit=g.permit(expired)
    g.sql(f"update private.account_deletions set permit_expires_at=clock_timestamp()-interval '1second' where request_id='{expired_permit['request_id']}'")
    g.ok(g.action(expired,'confirm',request_id=expired_permit['request_id'],confirmation_token=expired_permit['confirmation_token'],confirmed=True)['status']==409,'expired permit rejected by database clock (fixture expiry)')
    # Owner check covers every Space; rejection does not consume the permit.
    o=g.new_user();successor=g.new_user();spaces=[]
    for name in ['Owned one','Owned two']:
        s=g.data(g.rpc(o['jwt'],'create_space_with_invite',{'space_name':name}));spaces.append(s['id'])
        assert g.rpc(successor['jwt'],'join_space_by_invite_code',{'code':s['invite_code']})['status']==200
    owner_permit=g.permit(o)
    args=dict(request_id=owner_permit['request_id'],confirmation_token=owner_permit['confirmation_token'],confirmed=True)
    g.ok(g.action(o,'confirm',**args)['status']==409,'unhandled Shared Owner cannot accept')
    assert g.rpc(o['jwt'],'transfer_space_ownership',dict(p_space_id=spaces[0],p_new_owner_user_id=successor['id']))['status']==204
    g.ok(g.action(o,'confirm',**args)['status']==409,'remaining second Owner identity also blocks acceptance')
    assert g.rpc(o['jwt'],'transfer_space_ownership',dict(p_space_id=spaces[1],p_new_owner_user_id=successor['id']))['status']==204
    g.ok(g.action(o,'confirm',**args)['status']==202,'same unconsumed permit accepts after all ownership handled')
    # Two unrelated verified accounts can finalize concurrently.
    one,two=[g.new_user() for _ in range(2)]
    permits=[g.permit(one),g.permit(two)]
    with ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(lambda pair:g.action(pair[0],'confirm',request_id=pair[1]['request_id'],confirmation_token=pair[1]['confirmation_token'],confirmed=True),zip([one,two],permits)))
    g.ok(all(r['status']==202 for r in results),'different accounts accept concurrently without cross-target state')
    print(f'PASS {len(g.results)} trusted-acceptance/business assertions; no completed/Auth deletion',flush=True)


def schema_dump(g):
    from account_deletion_local import normalized_dump
    return normalized_dump(g.command(['exec',g.prefix+'_db','pg_dump','-U','postgres','-d','postgres',
        '--schema-only','--schema=public','--schema=private','--no-owner','--no-comments']))


def verify_fresh(expected_schema):
    from account_deletion_trusted_fixtures import seed,retained
    g=TrustedGate();g.schema_mode='fresh'
    try:
        g.start();g.start_deletion()
        g.ok(schema_dump(g)==expected_schema,'real fresh canonical and upgrade patch public/private schema+ACL parity')
        a,b=g.new_user(),g.new_user();fixture=seed(g,a,b);before=retained(g,fixture)
        permit=g.permit(b)
        g.ok(g.action(b,'confirm',request_id=permit['request_id'],confirmation_token=permit['confirmation_token'],confirmed=True)['status']==202,'fresh schema real SMTP acceptance')
        g.ok(g.rpc(g.service,'cleanup_account_business',dict(p_request_id=permit['request_id'],p_generation=0))['status']==200,'fresh schema populated Personal cleanup')
        g.ok(before==retained(g,fixture),'fresh schema Shared snapshots preserved exactly')
        g.ok(g.sql(f"select count(*) from public.spaces where id='{fixture['personal']}'")=='0','fresh schema Personal removed')
        g.ok(g.sql(f"select status='processing' and phase='storage' and completed_at is null from private.account_deletions where request_id='{permit['request_id']}'")=='t','fresh schema does not finalize outstanding Storage/Auth')
        g.ok(g.sql("select pg_has_role('authenticator','account_deletion_executor','MEMBER')")=='f','real PostgREST authenticator cannot SET cleanup role')
        print(f'PASS {len(g.results)} fresh real-service assertions',flush=True)
    finally:g.close()


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--red',action='store_true');parser.add_argument('--smoke',action='store_true');opts=parser.parse_args()
    g=TrustedGate();expected=None
    try:
        g.start()
        if opts.red:probe(g)
        else:
            g.start_deletion()
            if not opts.smoke:
                verify(g);expected=schema_dump(g)
            else:
                user=g.new_user();g.rpc(user['jwt'],'ensure_personal_space')
                permit=g.permit(user);r=g.action(user,'confirm',request_id=permit['request_id'],confirmation_token=permit['confirmation_token'],confirmed=True)
                assert r['status']==202,'Acceptance failed'
                r=g.rpc(g.service,'cleanup_account_business',dict(p_request_id=permit['request_id'],p_generation=0))
                print('Cleanup smoke HTTP:',r['status'],r['text'] if r['status']>=400 else 'success',flush=True)
                assert r['status']==200 and g.data(r) is True
                print('PASS real SMTP acceptance + empty Personal cleanup',flush=True)
    finally:g.close()
    if expected is not None:verify_fresh(expected)


if __name__=='__main__':main()
