"""Real local API bridge for synthetic browser sessions only; no linked project.
Host proxy exists only for this process and its own internal Docker network.
"""
import base64,json,os,secrets,subprocess,sys,threading,time
from pathlib import Path
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from account_deletion_execution_local import ExecutionGate
from account_deletion_cross_service import ROOT,HTTP,uid
from account_deletion_trusted_fixtures import seed,retained

class FrontendGate(ExecutionGate):
    include_frontend=True
    def command(self,args,source=None,timeout=60):
        if args[-1:]==[HTTP]:
            args=list(args);args[-1]=HTTP.replace("auth:'http://auth:9999'","mail:'http://mail:8025',deletion:'http://deletion:9000',auth:'http://auth:9999'").replace("base64:bytes.toString('base64')","base64:bytes.toString('base64'),headers:Object.fromEntries(r.headers)")
        return super().command(args,source,timeout)
    def start_deletion(self):
        super().start_deletion()
        if self.sql("select to_regprocedure('public.cancel_my_deletion_preparation()') is null")=='t':
            self.sql((ROOT/'supabase/patches/2026-11-06-account-deletion-frontend-contract.sql').read_text())
        self.sql((ROOT/'supabase/patches/2026-11-08-account-deletion-pilot-preparation.sql').read_text())
        self.sql("notify pgrst,'reload schema';")

    def allow_preparation(self, user):
        self.sql(f"update private.account_deletion_admission set allowed_user_ids=array['{user['id']}']::uuid[] where singleton;")

def main():
    g=FrontendGate();server=None;mail_state={};control=secrets.token_hex(32)
    try:
        g.start();g.start_deletion()
        from account_deletion_execution_local import schema_dump
        expected_schema=schema_dump(g)
        preflight=json.loads(g.command(['exec','-i',g.prefix+'_storage','node','--input-type=module','-e',HTTP],json.dumps(dict(service='deletion',path='/',method='OPTIONS',headers={'Origin':'http://127.0.0.1:5175'}))))
        g.ok(preflight['status']==204 and preflight['headers'].get('access-control-allow-origin')=='http://127.0.0.1:5175','real Edge preflight allows only the local UI origin')
        cancelled=g.new_user();g.allow_preparation(cancelled);old=g.permit(cancelled)
        if '--contracts-only' in sys.argv:
            outsider=g.new_user()
            g.ok(g.action(outsider,'cancel')['status']==200,'another authenticated caller can revoke only its own preparation')
            g.ok(g.sql(f"select permit_hash is not null from private.account_deletions where user_id='{cancelled['id']}'")=='t','another caller cannot consume or revoke the original permit')
            g.ok(g.action(cancelled,'cancel',user_id=outsider['id'])['status']==400,'cancel Edge rejects caller-selected UUID parameters')
            g.ok(g.data(g.action(cancelled,'cancel'))=={'cancelled':True},'fixed-session Edge atomically confirms unaccepted cancellation')
            g.ok(g.action(cancelled,'confirm',request_id=old['request_id'],confirmation_token=old['confirmation_token'],confirmed=True)['status']==409,'cancel Edge fences a late confirmation')
            accepted=g.new_user();g.allow_preparation(accepted);permit=g.permit(accepted)
            assert g.action(accepted,'confirm',request_id=permit['request_id'],confirmation_token=permit['confirmation_token'],confirmed=True)['status']==202
            g.ok(g.data(g.action(accepted,'cancel'))=={'cancelled':False},'fixed-session Edge cannot cancel durable acceptance')
            print('PASS final cancellation Edge contract on real Auth/PostgREST',flush=True)
            return
        g.ok(g.rpc(cancelled['jwt'],'cancel_my_deletion_preparation')['status']==200,'real session can atomically cancel only its unaccepted preparation')
        g.ok(g.action(cancelled,'confirm',request_id=old['request_id'],confirmation_token=old['confirmation_token'],confirmed=True)['status']==409,'late confirmation cannot accept a cancelled permit')
        a,b=g.new_user(),g.new_user();g.allow_preparation(b);fixture=seed(g,a,b);before=retained(g,fixture)
        owned=g.data(g.rpc(b['jwt'],'create_space_with_invite',{'space_name':'待处理共享空间'}))
        assert g.rpc(a['jwt'],'join_space_by_invite_code',dict(code=owned['invite_code']))['status']==200
        logged=g.data(g.http('auth','/token?grant_type=password','POST',dict(email=b['email'],password=b['password'])))
        def cron():
            g.command(['exec','-i',g.prefix+'_db','psql','-U','supabase_admin','-d','postgres','-X','-Atq','-v','ON_ERROR_STOP=1'],(ROOT/'supabase/tests/account_deletion_local_cron.sql').read_text())
            g.sql(f"select vault.create_secret('{g.wake_secret}','account_deletion_local_wake');select cron.schedule('frontend-local','1 second','select private.wake_account_deletions_local();')")
        class Bridge(BaseHTTPRequestHandler):
            def log_message(self,*_args):pass
            def do_OPTIONS(self):self.answer(204,'')
            def do_GET(self):self.handle_request()
            def do_POST(self):self.handle_request()
            def do_PATCH(self):self.handle_request()
            def do_DELETE(self):self.handle_request()
            def answer(self,status,body,extra=None):
                self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Access-Control-Allow-Origin','http://127.0.0.1:5175');self.send_header('Access-Control-Allow-Headers','authorization,apikey,content-type,x-test-control,prefer,x-client-info,x-supabase-api-version');self.send_header('Access-Control-Allow-Methods','GET,POST,PATCH,DELETE,OPTIONS');self.send_header('Access-Control-Expose-Headers','content-range');
                for key,value in (extra or {}).items():
                    if key.lower() in ['content-range','range-unit']:self.send_header(key,value)
                self.end_headers()
                try:self.wfile.write(body.encode() if isinstance(body,str) else body)
                except BrokenPipeError:pass
            def handle_request(self):
                raw=self.rfile.read(int(self.headers.get('Content-Length','0')))
                try:
                    if self.path=='/control':
                        if self.headers.get('x-test-control')!=control:return self.answer(403,'{}')
                        body=json.loads(raw);action=body['action']
                        if action=='mail':
                            code,message=g.mail_code(b['email'],after=mail_state.get('id'));mail_state['id']=message;data={'otp':code}
                        elif action=='check':data={'accepted':g.sql(f"select exists(select 1 from private.account_deletions where user_id='{b['id']}' and accepted_at is not null)")=='t'}
                        elif action=='cron':cron();data={}
                        elif action=='refuse-cancel':data={'cancelled':g.data(g.rpc(b['jwt'],'cancel_my_deletion_preparation'))}
                        elif action=='wait':
                            deadline=time.monotonic()+30
                            while time.monotonic()<deadline:
                                if g.sql(f"select status from private.account_deletions where user_id='{b['id']}'")=='completed':break
                                time.sleep(.2)
                            data={'completed':g.sql(f"select status from private.account_deletions where user_id='{b['id']}'")=='completed'}
                        else:return self.answer(400,'{}')
                        return self.answer(200,json.dumps(data))
                    path=self.path.removeprefix('/backend')
                    route=next(((p,s) for p,s in [('/functions/v1/account-deletion','deletion'),('/auth/v1','auth'),('/rest/v1','rest'),('/storage/v1','storage')] if path.startswith(p)),None)
                    if not route:return self.answer(404,'{}')
                    prefix,kind=route;target='/' if kind=='deletion' else path[len(prefix):]
                    headers={k:v for k,v in self.headers.items() if k.lower() not in ['host','connection','content-length']}
                    q=dict(service=kind,path=target,method=self.command,headers=headers)
                    if raw:q['body']=json.loads(raw)
                    response=json.loads(g.command(['exec','-i',g.prefix+'_storage','node','--input-type=module','-e',HTTP],json.dumps(q)))
                    self.answer(response['status'],base64.b64decode(response['base64']),response.get('headers'))
                except Exception as error:
                    print('Bridge error type:',type(error).__name__,flush=True);self.answer(503,'{}')
        server=ThreadingHTTPServer(('127.0.0.1',0),Bridge);threading.Thread(target=server.serve_forever,daemon=True).start()
        owner_session=g.data(g.http('auth','/token?grant_type=password','POST',dict(email=a['email'],password=a['password'])))
        review_space=g.data(g.http('rest',f"/spaces?id=eq.{fixture['shared']}",token=a['jwt']))[0];review_space['membershipRole']='owner'
        config=dict(ownerSession=owner_session,review=dict(space=review_space,reviewId=fixture['round']),backend=f'http://127.0.0.1:{server.server_port}/backend',control=f'http://127.0.0.1:{server.server_port}/control',controlKey=control,anon=g.anon,session=logged)
        browser_env=dict(os.environ)
        cached=Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
        if cached.is_file():browser_env.setdefault('PLAYWRIGHT_MODULE_PATH',str(cached))
        subprocess.run(['node','tests/account-deletion-integration.mjs'],input=json.dumps(config),text=True,cwd=ROOT,env=browser_env,check=True)
        g.ok(g.sql(f"select count(*) from auth.users where id='{b['id']}'")=='0','browser flow hard-deleted only its real synthetic Auth identity')
        g.ok(before==retained(g,fixture),'browser acceptance preserves exact Shared data and Review bodies')
        marker=g.rpc(a['jwt'],'review_deleted_participants',dict(p_review_id=fixture['round']))
        g.ok(marker['status']==200 and g.data(marker)==[b['id']],'authorized original Review participant gets confirmed deletion marker')
        c=g.new_user();g.ok(g.rpc(c['jwt'],'review_deleted_participants',dict(p_review_id=fixture['round']))['status']==403,'unrelated account cannot query deletion identities')
        current_code=g.sql(f"select invite_code from public.spaces where id='{fixture['shared']}'")
        assert g.rpc(c['jwt'],'join_space_by_invite_code',dict(code=current_code))['status']==200
        assert g.rpc(a['jwt'],'transfer_space_ownership',dict(p_space_id=fixture['shared'],p_new_owner_user_id=c['id']))['status']==204
        g.ok(g.rpc(c['jwt'],'review_deleted_participants',dict(p_review_id=fixture['round']))['status']==403,'new Owner has no historical deletion-marker permission')
        extra=g.data(g.rpc(a['jwt'],'create_space_with_invite',dict(space_name='Ordinary former participant')))
        assert g.rpc(cancelled['jwt'],'join_space_by_invite_code',dict(code=extra['invite_code']))['status']==200
        assert g.rpc(a['jwt'],'set_space_module_enabled',dict(p_space_id=extra['id'],p_module_key='review',p_enabled=True))['status'] in (200,204)
        assert g.rpc(cancelled['jwt'],'create_review_round',dict(p_space_id=extra['id'],p_review_date='2031-01-01'))['status']==200
        extra_round=g.sql(f"select id from public.review_rounds where space_id='{extra['id']}'")
        assert g.rpc(cancelled['jwt'],'leave_shared_space',dict(p_space_id=extra['id']))['status']==204
        g.ok(g.data(g.http('rest',f"/profiles?id=eq.{cancelled['id']}",token=a['jwt']))==[],'ordinary former participant Profile is genuinely invisible under RLS')
        g.ok(g.data(g.rpc(a['jwt'],'review_deleted_participants',dict(p_review_id=extra_round)))==[],'missing Profile alone never marks ordinary former participant deleted')
        g.sql("select cron.unschedule('frontend-local')")
        print(f'PASS {len(g.results)} real API permission/postcondition assertions',flush=True)
        print('PASS real frontend/Auth/PostgREST/Storage/Edge/Cron integration',flush=True)
    finally:
        if server:server.shutdown();server.server_close()
        g.close()
    fresh=FrontendGate();fresh.schema_mode='fresh'
    try:
        fresh.start();fresh.start_deletion()
        fresh.ok(schema_dump(fresh)==expected_schema,'frontend canonical and forward patch public/private schema and ACL parity')
    finally:fresh.close()
if __name__=='__main__':main()
