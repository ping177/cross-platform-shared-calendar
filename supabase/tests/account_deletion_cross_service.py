"""Real cached Supabase services + synthetic Auth sessions, never a linked project.

No environment file, external URL, credentials or existing Docker volume is read.
All network requests run inside the owned internal network. Auth email is locally
AUTO-CONFIRMED for password-session tests; this is NOT an OTP acceptance proof.
"""
import base64
import hashlib
import hmac
import json
from pathlib import Path
import secrets
import subprocess
import tempfile
import time
import uuid

ROOT = Path(__file__).resolve().parents[2]
DOCKER = ['docker', '--context', 'desktop-linux']
IMAGES = dict(db='public.ecr.aws/supabase/postgres:17.6.1.127',
              auth='public.ecr.aws/supabase/gotrue:v2.193.0',
              rest='public.ecr.aws/supabase/postgrest:v14.5',
              storage='public.ecr.aws/supabase/storage-api:v1.65.1')
HTTP = """
let text='';for await(const chunk of process.stdin)text+=chunk;
const q=JSON.parse(text);const bases={auth:'http://auth:9999',rest:'http://rest:3000',storage:'http://storage:5000',testpush:'http://testpush:9000',reminders:'http://reminders:9000',gateway:'http://storage:8080'};
if(!bases[q.service]||!q.path.startsWith('/')||q.path.startsWith('//'))throw Error('Non-local target');
const r=await fetch(bases[q.service]+q.path,{method:q.method,headers:q.headers,
 body:q.binary?Buffer.from(q.binary,'base64'):q.body===undefined?undefined:JSON.stringify(q.body),signal:AbortSignal.timeout(12000)});
const bytes=Buffer.from(await r.arrayBuffer());console.log(JSON.stringify({status:r.status,text:bytes.toString(),base64:bytes.toString('base64')}));process.exit(0);
"""


def uid():
    return str(uuid.uuid4())


class Gate:
    def __init__(self):
        self.prefix = 'calendar_gate_' + uuid.uuid4().hex[:10]
        self.password = secrets.token_hex(24)
        self.jwt_secret = secrets.token_hex(32)
        self.containers = []
        self.network = False
        self.results = []
        self.anon = self.token('anon')
        self.service = self.token('service_role')

    def command(self, args, source=None, timeout=60):
        result = subprocess.run(DOCKER + args, input=source, text=True, capture_output=True, timeout=timeout)
        if result.returncode:
            # Never print Docker command arguments or unredacted service logs.
            message = result.stderr
            for value in [self.password, self.jwt_secret, self.anon, self.service]:
                message = message.replace(value, '[withheld]')
            raise AssertionError(message[-1600:])
        return result.stdout

    def token(self, role):
        def b(value):
            return base64.urlsafe_b64encode(value).decode().rstrip('=')
        body = b(b'{"alg":"HS256","typ":"JWT"}') + '.' + b(json.dumps(
            dict(role=role, iss='supabase', iat=int(time.time()), exp=int(time.time())+7200)).encode())
        return body + '.' + b(hmac.new(self.jwt_secret.encode(), body.encode(), hashlib.sha256).digest())

    def sql(self, text):
        return self.command(['exec', '-i', self.prefix+'_db', 'psql', '-U', 'postgres', '-d', 'postgres',
                             '-X', '-Atq', '-v', 'ON_ERROR_STOP=1'], text).strip()

    def start(self):
        endpoint = self.command(['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}']).strip()
        assert endpoint.startswith('unix://'), 'Only local Docker is permitted'
        for image in IMAGES.values():
            self.command(['image', 'inspect', image, '--format', '{{.Id}}'])
        self.command(['network', 'create', '--internal', self.prefix]); self.network = True
        self.run('db', dict(POSTGRES_PASSWORD=self.password, POSTGRES_HOST='/var/run/postgresql',
                           POSTGRES_USER='supabase_admin', POSTGRES_DB='postgres'))
        for _ in range(80):
            try:
                if 'accepting connections' in self.command(['exec',self.prefix+'_db','pg_isready','-h','127.0.0.1','-U','postgres']) and self.sql("select count(*) from pg_roles where rolname='supabase_storage_admin'") == '1':
                    break
            except AssertionError:
                pass
            time.sleep(.25)
        else:
            raise AssertionError('Database initialization unavailable')
        self.command(['exec','-i',self.prefix+'_db','psql','-U','supabase_admin','-d','postgres',
                      '-X','-Atq','-v','ON_ERROR_STOP=1'],
                     ''.join(f"alter role {r} password '{self.password}';" for r in
                             ['authenticator','supabase_auth_admin','supabase_storage_admin']))
        self.run('auth', dict(GOTRUE_API_HOST='0.0.0.0', GOTRUE_API_PORT='9999',
            API_EXTERNAL_URL='http://auth:9999', GOTRUE_DB_DRIVER='postgres',
            GOTRUE_DB_DATABASE_URL=f'postgres://supabase_auth_admin:{self.password}@db:5432/postgres',
            GOTRUE_SITE_URL='http://127.0.0.1:5175', GOTRUE_JWT_SECRET=self.jwt_secret,
            GOTRUE_JWT_EXP='3600', GOTRUE_JWT_ADMIN_ROLES='service_role', GOTRUE_JWT_AUD='authenticated',
            GOTRUE_JWT_DEFAULT_GROUP_NAME='authenticated', GOTRUE_DISABLE_SIGNUP='false',
            GOTRUE_MAILER_AUTOCONFIRM='true', GOTRUE_EXTERNAL_EMAIL_ENABLED='true'))
        self.run('rest', dict(PGRST_DB_URI=f'postgres://authenticator:{self.password}@db:5432/postgres',
            PGRST_DB_SCHEMAS='public', PGRST_DB_ANON_ROLE='anon', PGRST_JWT_SECRET=self.jwt_secret,
            PGRST_DB_EXTRA_SEARCH_PATH='public,extensions'))
        self.run('storage', dict(ANON_KEY=self.anon, SERVICE_KEY=self.service, AUTH_JWT_SECRET=self.jwt_secret,
            DATABASE_URL=f'postgres://supabase_storage_admin:{self.password}@db:5432/postgres',
            POSTGREST_URL='http://rest:3000', PGOPTIONS='-c search_path=storage,public',
            FILE_SIZE_LIMIT='1048576', STORAGE_BACKEND='file', FILE_STORAGE_BACKEND_PATH='/var/lib/storage',
            TENANT_ID='calendar-gate', REGION='local', GLOBAL_S3_BUCKET='calendar-gate', ENABLE_IMAGE_TRANSFORMATION='false'))
        for service, path in [('auth','/health'), ('rest','/'), ('storage','/status')]:
            for _ in range(50):
                try:
                    if self.http(service,path)['status'] == 200:
                        break
                except (AssertionError, subprocess.TimeoutExpired):
                    pass
                time.sleep(.2)
            else:
                raise AssertionError(service+' unavailable')
        if getattr(self,'schema_mode','upgrade') == 'fresh':
            canonical=(ROOT/'supabase/schema.sql').read_text()
            if not getattr(self,'include_frontend',False):canonical=canonical.split('-- ACCOUNT_DELETION_FRONTEND_BEGIN')[0]
            self.sql(canonical)
        else:
            self.sql(subprocess.check_output(['git','show','4b1032e:supabase/schema.sql'],cwd=ROOT,text=True))
            for name in ['audit-snapshots','barrier']:
                self.sql((ROOT/f'supabase/patches/2026-11-05-account-deletion-{name}.sql').read_text())
        self.sql("notify pgrst,'reload schema';")
        # Readiness is observed, not inferred from an arbitrary startup delay.
        for _ in range(40):
            if self.http('rest','/profiles?select=id',token=self.service)['status'] == 200:
                break
            time.sleep(.1)
        else:
            raise AssertionError('PostgREST schema reload unavailable')

    def run(self, kind, env):
        name=self.prefix+'_'+kind; self.containers.append(name)
        args=['run','-d','--pull=never','--name',name,'--network',self.prefix,'--network-alias',kind]
        if kind in ('db','storage'):
            args+=['--tmpfs','/var/lib/postgresql/data:mode=0700' if kind=='db' else '/var/lib/storage:mode=1777']
        for key,value in env.items():
            args+=['-e',key+'='+value]
        self.command(args+[IMAGES[kind]])

    def http(self, service, path, method='GET', body=None, token=None, binary=None):
        headers={'apikey':self.anon, 'Authorization':'Bearer '+(token or self.anon)}
        if binary is not None:
            headers['Content-Type']='image/jpeg'
        elif body is not None:
            headers['Content-Type']='application/json'
        if service=='rest':
            headers['Prefer']='return=representation'
        q=dict(service=service,path=path,method=method,headers=headers)
        if body is not None:
            q['body']=body
        if binary is not None:
            q['binary']=base64.b64encode(binary).decode()
        return json.loads(self.command(['exec','-i',self.prefix+'_storage','node','--input-type=module','-e',HTTP],json.dumps(q)))

    def data(self, result):
        return json.loads(result['text'])

    def ok(self, condition, label):
        assert condition, label
        self.results.append(label);print('PASS '+label,flush=True)

    def rpc(self, token, name, body=None):
        return self.http('rest','/rpc/'+name,'POST',body or {},token)

    def accept(self, user):
        request=uid()
        self.sql(f"select private.prepare_account_deletion('{user}','{request}');select private.accept_account_deletion('{user}','{request}');")
        return request

    def start_edges(self):
        self.command(['image','inspect','public.ecr.aws/supabase/edge-runtime:v1.74.1','--format','{{.Id}}'])
        self.has_edges = True
        self.bundle_dir = tempfile.TemporaryDirectory(prefix='calendar-gate-edge-')
        subprocess.run(['node','supabase/tests/account_deletion_edge_bundle.mjs',self.bundle_dir.name],cwd=ROOT,check=True)
        self.command(['cp',self.bundle_dir.name+'/gateway.mjs',self.prefix+'_storage:/tmp/gate-gateway.mjs'])
        self.command(['exec','-d',self.prefix+'_storage','node','/tmp/gate-gateway.mjs'])
        for kind,entry in [('testpush','send-test-push'),('reminders','send-reminders')]:
            name=self.prefix+'_'+kind;self.containers.append(name)
            args=['create','--pull=never','--name',name,'--network',self.prefix,'--network-alias',kind]
            env=dict(SUPABASE_URL='http://storage:8080',SUPABASE_ANON_KEY=self.anon,
                SUPABASE_SERVICE_ROLE_KEY=self.service,REMINDER_CRON_SECRET='local-gate-cron',
                VAPID_SUBJECT='mailto:gate@example.invalid',VAPID_PUBLIC_KEY='synthetic',VAPID_PRIVATE_KEY='synthetic')
            for key,value in env.items():args+=['-e',key+'='+value]
            self.command(args+['public.ecr.aws/supabase/edge-runtime:v1.74.1','start','--main-service','/tmp/function','--port','9000'])
            self.command(['cp',self.bundle_dir.name+'/'+entry,name+':/tmp/function'])
            self.command(['start',name])
            for _ in range(50):
                try:
                    if self.http(kind,'/')['status'] in (401,405):break
                except AssertionError:pass
                time.sleep(.1)
            else:raise AssertionError('Local Edge did not become ready')

    def close(self):
        for name in reversed(self.containers):
            self.command(['rm','-fv',name])
        if self.network:
            self.command(['network','rm',self.prefix])
        if hasattr(self,'bundle_dir'):self.bundle_dir.cleanup()
        print('Removed only owned test containers/network/tmpfs',flush=True)


def verify(g):
    users=[]
    for _ in range(4):
        r=g.http('auth','/signup','POST',dict(email=uid()+'@gate.invalid',password=secrets.token_hex(16)))
        g.ok(r['status']==200,'real Auth signup and session '+str(len(users)+1))
        data=g.data(r);users.append((data['user']['id'],data['access_token']))
        if not hasattr(g,'refresh'):g.refresh={}
        g.refresh[data['user']['id']]=data['refresh_token']
    (a,at),(b,bt),(c,ct),(d,dt)=users
    for user,token in users:
        g.ok(g.data(g.http('auth','/user',token=token))['id']==user,'Auth verifies issued UUID '+user[:8])
        g.ok(g.rpc(token,'ensure_personal_space')['status']==200,'real JWT Personal bootstrap '+user[:8])
    s=g.data(g.rpc(at,'create_space_with_invite',{'space_name':'Gate Shared'}))
    if isinstance(s,list):s=s[0]
    space=s['id'];code=s['invite_code']
    g.ok(g.rpc(bt,'join_space_by_invite_code',{'code':code})['status']==200,'real JWT joins Shared')
    g.ok(g.data(g.http('rest',f'/spaces?id=eq.{space}',token=ct))==[],'unrelated real JWT cannot read Shared')
    g.sql(f"insert into public.space_modules(space_id,module_key,enabled) values ('{space}','review',true),('{space}','lists',true),('{space}','important_dates',true) on conflict(space_id,module_key) do update set enabled=true;")
    task,event,round_id,list_id=[uid() for _ in range(4)]
    g.ok(g.http('rest',f'/profiles?id=eq.{a}','PATCH',{'display_name':'Gate active'},at)['status']==200,'normal Profile update')
    created_list=g.http('rest','/lists','POST',dict(space_id=space,name='Keep Shared List'),bt)
    g.ok(created_list['status']==201,'normal List insert through existing column ACL')
    list_id=g.data(created_list)[0]['id']
    g.ok(g.rpc(bt,'create_list_item',dict(p_list_id=list_id,p_section_id=None,p_content='Keep Shared Item'))['status']==200,'normal List item definer write')
    date_params=dict(p_space_id=space,p_name='Keep Shared Date',p_emoji=None,p_repeat_kind='annual',p_month=1,p_day=1,p_year=None,p_time_zone='UTC')
    g.ok(g.rpc(bt,'create_important_date',date_params)['status']==200,'normal Important Date definer write')
    r=g.http('rest','/tasks','POST',dict(id=task,space_id=space,title='Keep exact Shared Task',created_by=b),bt)
    g.ok(r['status']==201,'normal direct task insert')
    r=g.http('rest','/events','POST',dict(id=event,space_id=space,title='Keep exact Shared Event',created_by=b,scope='shared',starts_at='2030-01-01T00:00:00Z'),bt)
    g.ok(r['status']==201,'normal direct event insert')
    g.ok(g.http('rest','/tasks','POST',dict(space_id=space,title='Forged',created_by=a),bt)['status']>=400,'forged audit creator rejected via HTTP')
    g.ok(g.http('rest',f'/tasks?id=eq.{task}','PATCH',dict(created_by=a),bt)['status']>=400,'historical creator edit rejected via HTTP')
    rr=g.rpc(bt,'create_review_round',dict(p_space_id=space,p_review_date='2030-01-01'))
    g.ok(rr['status']==200,'normal Review definer create')
    round_id=g.sql(f"select id from public.review_rounds where space_id='{space}'")
    g.sql(f"update public.review_entries set focus=case when user_id='{a}' then 'A original body' else 'B original body' end where review_id='{round_id}'")
    before=g.sql(f"select jsonb_agg(to_jsonb(e) order by user_id) from public.review_entries e where review_id='{round_id}'")
    g.ok(len(g.data(g.http('rest',f'/review_entries?review_id=eq.{round_id}',token=at)))==2,'original participant reads both Review bodies')
    # Real Storage round-trip, previously signed download, signed upload & in-flight URL.
    jpg=b'\xff\xd8\xff\xe0'+b'gate-image'*100+b'\xff\xd9'
    normal_path=a+'/'+uid()+'.jpg';old_path=b+'/'+uid()+'.jpg';signed_path=b+'/'+uid()+'.jpg'
    g.ok(g.http('storage','/object/profile-avatars/'+normal_path,'POST',token=at,binary=jpg)['status']==200,'active avatar upload')
    g.ok(g.http('storage','/object/authenticated/profile-avatars/'+normal_path,token=at)['base64']==base64.b64encode(jpg).decode(),'active avatar bytes read')
    g.ok(g.http('storage','/object/profile-avatars','DELETE',{'prefixes':[normal_path]},at)['status']==200,'active avatar delete API')
    g.ok(g.sql(f"select count(*) from storage.objects where name='{normal_path}'")=='0','active avatar metadata actually deleted')
    g.ok(g.http('storage','/object/profile-avatars/'+old_path,'POST',token=bt,binary=jpg)['status']==200,'target avatar before acceptance')
    edge=before_edges(g,a,at,b,bt,event) if getattr(g,'has_edges',False) else None
    read_sign=g.http('storage','/object/sign/profile-avatars/'+old_path,'POST',{'expiresIn':300},bt)
    upload_sign=g.http('storage','/object/upload/sign/profile-avatars/'+signed_path,'POST',{},bt)
    g.ok(read_sign['status']==200 and upload_sign['status']==200,'pre-acceptance download/upload signatures minted')
    read_url=g.data(read_sign).get('signedURL') or g.data(read_sign).get('signedUrl')
    upload_url=g.data(upload_sign)['url']
    request=g.accept(b)
    upload_claims=json.loads(base64.urlsafe_b64decode(g.data(upload_sign)['token'].split('.')[1]+'==='))
    g.ok(upload_claims['exp']>time.time(),'pre-issued upload capability is still unexpired at attempt')
    signed=g.http('storage',upload_url,'PUT',binary=jpg)
    g.ok(signed['status']>=400 and 'ACCOUNT_ACCESS_REVOKED' in signed['text'],'unexpired signed upload rejected by target guard (without user JWT)')
    g.ok(g.http('storage',read_url)['status']==200,'pre-issued signed download remains bearer-readable after acceptance')
    g.ok(g.sql(f"select status from private.account_deletions where user_id='{b}'")=='accepted','trusted test control accepts exact UUID')
    if edge:after_edges(g,a,at,b,bt,space,event,edge)
    g.ok(g.http('auth','/user',token=bt)['status']==200,'old JWT still valid in real Auth (not revoked by fixture)')
    refreshed=g.http('auth','/token?grant_type=refresh_token','POST',{'refresh_token':g.refresh[b]})
    g.ok(refreshed['status']==200 and g.data(g.rpc(g.data(refreshed)['access_token'],'current_account_active')) is False,'real refreshed JWT cannot revive business access')
    for table in ['profiles','spaces','space_members','space_modules','events','event_occurrence_exceptions','tasks','lists','list_sections','list_items','important_dates','review_rounds','review_entries','push_subscriptions','reminder_deliveries']:
        r=g.http('rest','/'+table,token=bt)
        g.ok((r['status']==200 and g.data(r)==[]) or r['status'] in (401,403),'old real JWT read fenced '+table)
    for name,body in [('ensure_personal_space',{}),('join_space_by_invite_code',{'code':code}),
        ('create_space_with_invite',{'space_name':'Forbidden'}),('get_my_previous_review_plan',{'p_review_id':round_id}),
        ('create_review_round',dict(p_space_id=space,p_review_date='2030-01-02')),
        ('create_list_item',dict(p_list_id=list_id,p_section_id=None,p_content='Forbidden')),('create_important_date',date_params),
        ('register_push_subscription',dict(p_installation_id=uid(),p_endpoint='https://fcm.googleapis.com/gate',p_p256dh='fake',p_auth='fake'))]:
        r=g.rpc(bt,name,body);g.ok(r['status'] in (400,401,403) and g.data(r).get('code') in ('42501','P0001'),'old real JWT definer fenced '+name)
    r=g.http('rest','/events','POST',dict(space_id=space,title='Forbidden',created_by=b,scope='shared',starts_at='2030-01-01'),bt)
    g.ok(r['status']>=400,'old JWT direct insert rejected')
    r=g.http('rest',f'/profiles?id=eq.{b}','PATCH',{'display_name':'Forbidden'},bt)
    g.ok(r['status']>=400 or g.data(r)==[],'old JWT profile update has no effect')
    g.ok(g.sql(f"select count(*) from public.spaces where kind='personal' and created_by='{b}'")=='1' and g.sql(f"select count(*) from public.events where title='Forbidden'")=='0','rejected requests created no extra Personal or business data')
    g.ok(g.sql(f"select display_name is null from public.profiles where id='{b}'")=='t','rejected Profile update left database unchanged')
    for table,record,body in [('tasks',task,dict(assigned_to_user_id=b)),('events',event,dict(scope='personal',owner_user_id=b))]:
        g.ok(g.http('rest',f'/{table}?id=eq.{record}','PATCH',body,at)['status']>=400,'active user cannot assign inactive target '+table)
    g.ok(g.rpc(at,'transfer_space_ownership',dict(p_space_id=space,p_new_owner_user_id=b))['status']>=400,'active Owner cannot transfer to inactive target')
    g.ok(g.sql(f"select assigned_to_user_id is null from public.tasks where id='{task}'")=='t' and g.sql(f"select scope='shared' and owner_user_id is null from public.events where id='{event}'")=='t' and g.sql(f"select role from public.space_members where space_id='{space}' and user_id='{a}'")=='owner','denied target assignments/transfer left exact associations unchanged')
    g.ok(g.http('rest',f'/tasks?id=eq.{task}','PATCH',{'title':'Active edit after barrier'},at)['status']==200,'normal member edit remains usable')
    g.ok(g.sql(f"select title||':'||created_by from public.tasks where id='{task}'")=='Active edit after barrier:'+b,'task ID creator and expected content preserved')
    g.ok(g.sql(f"select title from public.events where id='{event}'")=='Keep exact Shared Event','Shared Event exact ID/body preserved')
    g.ok(g.sql(f"select jsonb_agg(to_jsonb(e) order by user_id) from public.review_entries e where review_id='{round_id}'")==before,'both Review bodies and associations unchanged')
    g.ok(g.rpc(at,'remove_space_member',{'p_space_id':space,'p_member_user_id':b})['status']==204,'normal Owner removes accepted member via existing lifecycle')
    code=g.data(g.http('rest',f'/spaces?id=eq.{space}',token=at))[0]['invite_code']
    r=g.rpc(bt,'join_space_by_invite_code',{'code':code})
    g.ok(r['status']==403 and 'ACCOUNT_ACCESS_REVOKED' in r['text'] and g.sql(f"select count(*) from public.space_members where space_id='{space}' and user_id='{b}'")=='0','removed accepted member cannot rejoin with real old JWT')
    g.ok(g.rpc(ct,'join_space_by_invite_code',{'code':code})['status']==200,'active new member still joins')
    g.ok(g.data(g.http('rest',f'/review_entries?review_id=eq.{round_id}',token=ct))==[],'new member cannot read historical Review')
    g.ok(g.rpc(at,'transfer_space_ownership',dict(p_space_id=space,p_new_owner_user_id=c))['status']==204,'normal transfer to active member works')
    g.ok(g.data(g.http('rest',f'/review_entries?review_id=eq.{round_id}',token=ct))==[],'new Owner cannot read historical Review')
    g.ok(g.rpc(ct,'transfer_space_ownership',dict(p_space_id=space,p_new_owner_user_id=a))['status']==204,'normal ownership transfer back works')
    g.ok(g.data(g.rpc(bt,'current_account_active')) is False,'old JWT actor-scoped status false')
    for token in [bt,g.service]:
        r=g.http('rest','/rpc/accept_account_deletion','POST',dict(p_user_id=a,p_request_id=request),token)
        g.ok(r['status']>=400,'no public acceptance for '+('service_role' if token==g.service else 'user'))
    g.ok(g.data(g.rpc(g.service,'active_notification_accounts',{'p_user_ids':[a,b]}))==[a],'real service_role prefilter excludes accepted UUID')
    g.ok(g.rpc(at,'active_notification_accounts',{'p_user_ids':[a,b]})['status']>=400,'notification UUID probe denied to user')
    late=b+'/'+uid()+'.jpg'
    g.ok(g.http('storage','/object/profile-avatars/'+late,'POST',token=bt,binary=jpg)['status']>=400,'old JWT direct avatar upload denied')
    g.ok(g.http('storage','/object/upload/sign/profile-avatars/'+late,'POST',{},bt)['status']>=400,'old JWT cannot mint new upload signature')
    g.ok(g.http('storage','/object/sign/profile-avatars/'+old_path,'POST',{'expiresIn':300},bt)['status']>=400,'old JWT cannot mint new read signature')
    g.ok(g.sql(f"select count(*) from storage.objects where name in ('{late}','{signed_path}')")=='0','late upload paths have no metadata')
    g.ok(g.http('storage','/object/profile-avatars','DELETE',{'prefixes':[old_path]},g.service)['status']==200,'trusted Storage API cleanup can remove accepted fixture avatar')
    after_cleanup=g.http('storage',read_url)
    files=g.command(['exec',g.prefix+'_storage','find','/var/lib/storage','-type','f'])
    g.ok(g.sql(f"select count(*) from storage.objects where name='{old_path}'")=='0' and after_cleanup['status']>=400 and old_path not in files,'cleanup removed metadata/blob and prevented signed download')
    print('OBSERVATION target blob files',g.command(['exec',g.prefix+'_storage','find','/var/lib/storage','-type','f']).count('\n'),flush=True)
    return dict(users=users,space=space,task=task,event=event,jpg=base64.b64encode(jpg).decode())


def wait_due(g, event):
    for _ in range(25):
        if g.sql(f"select starts_at<=clock_timestamp() from public.events where id='{event}'")=='t':return
        time.sleep(.1)
    raise AssertionError('Synthetic event did not become due')


def before_edges(g,a,at,b,bt,event):
    installs={}
    for user,token in [(a,at),(b,bt)]:
        install=uid();installs[user]=install
        r=g.rpc(token,'register_push_subscription',dict(p_installation_id=install,
            p_endpoint='https://fcm.googleapis.com/'+install,p_p256dh='fixture',p_auth='fixture'))
        g.ok(r['status']==200,'active Push registration '+user[:8])
    r=g.http('testpush','/','POST',{'installation_id':installs[b]},bt)
    g.ok(r['status']==200 and g.data(r).get('delivered') is True,'real Edge test-push with real Auth/REST and synthetic provider')
    due=g.sql("select (clock_timestamp()+interval '1second')::text")
    r=g.http('rest',f'/events?id=eq.{event}','PATCH',dict(starts_at=due,reminder_kind='timed_at_start',time_zone='UTC'),bt)
    g.ok(r['status']==200,'normal reminder source update')
    wait_due(g,event)
    r=g.http('reminders','/','POST',{},'local-gate-cron')
    g.ok(r['status']==200 and g.data(r).get('sent')==2,'real Edge normal reminders delivered to both fixture recipients')
    # A deliberately seeded still-claimed ledger models a request paused before
    # dispatch; real service RPC must change eligibility across acceptance.
    delivery=g.sql(f"select id from public.reminder_deliveries where event_id='{event}' and recipient_user_id='{b}'")
    g.sql(f"update public.reminder_deliveries set status='claimed',result_code=null,provider_status=null where id='{delivery}'")
    marker=g.sql(f"select reminder_schedule_changed_at from public.events where id='{event}'")
    params=dict(p_delivery_id=delivery,p_event_id=event,p_expected_marker=marker)
    g.ok(g.data(g.rpc(g.service,'check_event_reminder_delivery',params)) is True,'real service pre-send permits active claimed fixture')
    return dict(params=params,install=installs[b])


def after_edges(g,a,at,b,bt,space,event,edge):
    before=g.data(g.http('gateway','/test-stat'))['pushes']
    r=g.http('testpush','/','POST',{'installation_id':edge['install']},bt)
    g.ok(r['status']==401,'real Edge refuses accepted caller with still-valid JWT')
    g.ok(g.data(g.http('gateway','/test-stat'))['pushes']==before,'accepted test-push causes no provider dispatch')
    g.ok(g.data(g.rpc(g.service,'check_event_reminder_delivery',edge['params'])) is False,'real service pre-send rejects accepted recipient')
    event2=uid();due=g.sql("select (clock_timestamp()+interval '1second')::text")
    r=g.http('rest','/events','POST',dict(id=event2,space_id=space,created_by=a,scope='shared',
        title='Second reminder',starts_at=due,reminder_kind='timed_at_start',time_zone='UTC'),at)
    g.ok(r['status']==201,'active member new reminder after acceptance')
    wait_due(g,event2)
    r=g.http('reminders','/','POST',{},'local-gate-cron')
    g.ok(r['status']==200 and g.data(r).get('sent')==1,'real Edge service-role tick sends only to remaining active recipient')
    g.ok(g.sql(f"select string_agg(recipient_user_id::text,',') from public.reminder_deliveries where event_id='{event2}'")==a,'real service claim persisted only active recipient')



def verify_inflight(g,context):
    d,dt=context['users'][3];path=d+'/'+uid()+'.jpg'
    r=g.http('storage','/object/upload/sign/profile-avatars/'+path,'POST',{},dt)
    g.ok(r['status']==200,'in-flight target mints real upload capability while active')
    url=g.data(r)['url']
    program=r"""
const {createInterface}=await import('node:readline');const {once}=await import('node:events');const {request}=await import('node:http');
const rl=createInterface({input:process.stdin});const [line]=await once(rl,'line');const q=JSON.parse(line);const body=Buffer.from(q.bytes,'base64');
const done=new Promise((resolve,reject)=>{
 const req=request({hostname:'storage',port:5000,path:q.url,method:'PUT',headers:{'Content-Type':'image/jpeg','Content-Length':body.length,'Authorization':'Bearer '+q.anon}},res=>{
  let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode,text}));
 });req.on('error',reject);req.write(body.subarray(0,100));
 console.log('PREFIX_SENT');once(rl,'line').then(()=>req.end(body.subarray(100)));
});console.log(JSON.stringify(await done));process.exit(0);
"""
    process=subprocess.Popen(DOCKER+['exec','-i',g.prefix+'_storage','node','--input-type=module','-e',program],
        stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    try:
        process.stdin.write(json.dumps(dict(url=url,bytes=context['jpg'],anon=g.anon))+'\n');process.stdin.flush()
        assert process.stdout.readline().strip()=='PREFIX_SENT'
        for _ in range(25):
            files=g.command(['exec',g.prefix+'_storage','find','/var/lib/storage','-type','f'])
            if path in files:break
            assert process.poll() is None,'Upload ended before the observation point'
            time.sleep(.1)
        else:raise AssertionError('Actual partial backend blob not observed; in-flight boundary NOT VERIFIED')
        g.ok(True,'actual partial backend blob observed before acceptance')
        g.ok(g.data(g.http('storage','/object/list/profile-avatars','POST',{'prefix':d,'limit':100},g.service))==[],'empty Storage API list can coexist with an in-flight blob')
        g.accept(d)
        cleanup=g.http('storage','/object/profile-avatars','DELETE',{'prefixes':[path]},g.service)
        g.ok(cleanup['status']==200 and path in g.command(['exec',g.prefix+'_storage','find','/var/lib/storage','-type','f']),'metadata-only cleanup does not drain the in-flight blob')
        process.stdin.write('finish\n');process.stdin.flush()
        result=json.loads(process.stdout.readline());process.wait(timeout=20)
        g.ok(result['status']>=400 and 'ACCOUNT_ACCESS_REVOKED' in result['text'],'started signed upload cannot commit metadata after acceptance')
        g.ok(g.sql(f"select count(*) from storage.objects where name='{path}'")=='0','in-flight upload left no committed metadata')
        files=g.command(['exec',g.prefix+'_storage','find','/var/lib/storage','-type','f'])
        g.ok(path not in files,'local file backend removed failed in-flight blob')
    finally:
        if process.poll() is None:
            process.terminate();process.wait(timeout=5)



def main():
    gate=Gate()
    try:
        gate.start();gate.start_edges();context=verify(gate)
        from account_deletion_cross_service_race import run
        run(gate,context,DOCKER,HTTP)
        verify_inflight(gate,context)
        print(f'PASS {len(gate.results)} real HTTP/postcondition checks; NOT full gate acceptance',flush=True)
    finally:
        gate.close()


if __name__=='__main__':
    main()
