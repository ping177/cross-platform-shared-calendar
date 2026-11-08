"""Production policy, real local services; HTTPS transport mapped ONLY inside test artifact.

The owned Docker network is internal. No Production request is sent. No hosted
Supabase gateway is simulated as PASS. Only newly synthesized test identities.
"""
import json
from pathlib import Path
from account_deletion_execution_local import ExecutionGate, stage, fault, fixture_due, wait_for
from account_deletion_cross_service import ROOT, uid

TARGET = 'https://ximazjhxvmktpcdbypka.supabase.co'
class ProductionGate(ExecutionGate):
    def command(self,args,source=None,timeout=60):
        args=list(args)
        if args[:1]==['create'] and self.prefix+'_deletion' in args:
            args=[a.replace('SUPABASE_URL=http://storage:8080','SUPABASE_URL='+TARGET)
                  .replace('ACCOUNT_DELETION_RUNTIME_MODE=isolated-local','ACCOUNT_DELETION_RUNTIME_MODE=production')
                  .replace('ACCOUNT_DELETION_ACCEPT_NEW=true','ACCOUNT_DELETION_ACCEPT_NEW='+getattr(self,'accept_new','false')) for a in args]
        if args[:1]==['cp'] and args[-1].endswith(':/tmp/function'):
            p=Path(self.bundle_dir.name)/'account-deletion/index.ts'
            shim="""
const realFetch=globalThis.fetch;
globalThis.fetch=(input,init)=>{
 const url=new URL(input instanceof Request?input.url:String(input));
 if(url.origin!==TARGET)throw new Error('Non-fixture transport rejected');
 return realFetch('http://storage:8080'+url.pathname+url.search,init);
};
""".replace('TARGET',json.dumps(TARGET))
            p.write_text(shim+p.read_text())
        return super().command(args,source,timeout)
    def start_deletion(self):
        super().start_deletion()
        self.sql("update private.account_deletion_admission set enabled="+getattr(self,'accept_new','false')+" where singleton;")
    def accepting(self,value):
        # Real environment change through replacing ONLY our owned test Edge.
        # Stop database admission before replacing the process on close.
        if value=='false':self.sql("update private.account_deletion_admission set enabled=false where singleton;")
        self.accept_new=value
        name=self.prefix+'_deletion'
        self.command(['rm','--force',name]);self.containers.remove(name)
        self.start_deletion()

def main():
    g=ProductionGate();g.schema_mode="fresh";g.include_frontend=True
    try:
        g.start();g.start_deletion()
        a,b=g.new_user(),g.new_user()
        g.ok(g.action(b,'begin')['status']==503,'production acceptance defaults closed with real verified Auth')
        g.ok(g.wake()['status']==200,'disabled acceptance does not disable authenticated worker')
        g.ok(g.http('deletion','/','POST',{'action':'work'},a['jwt'])['status']==403,'user JWT cannot become worker')
        g.ok(g.http('deletion','/','POST',{'action':'begin'},g.wake_secret)['status']==401,'worker capability cannot become user')
        assert g.rpc(a['jwt'],'ensure_personal_space')['status']==200
        g.ok(g.action(a,'cancel')['status']==200,'cancel uncertainty remains authorized while new acceptance is closed')
        from account_deletion_trusted_fixtures import seed,retained
        ids=seed(g,a,b);kept=retained(g,ids)
        path=b['id']+'/'+uid()+'.jpg'
        assert g.http('storage','/object/profile-avatars/'+path,'POST',token=b['jwt'],binary=b'\xff\xd8\xff\xe0fixture\xff\xd9')['status']==200
        g.accepting('true')
        g.sql(f"update private.account_deletion_admission set allowed_user_ids=array['{b['id']}']::uuid[] where singleton")
        probe=g.action(b,'begin')
        assert probe['status']==200, 'Production begin failed: '+str(probe['status'])+' '+g.data(probe).get('error','')
        permit=g.permit(b)
        g.accepting('false')
        direct=g.rpc(b['jwt'],'accept_my_account_deletion',dict(p_request_id=permit['request_id'],p_confirmation_token=permit['confirmation_token']))
        g.ok(direct['status']==403,'database admission blocks direct RPC with still-valid OTP permit')
        g.accepting('true')
        g.sql(f"update private.account_deletion_admission set allowed_user_ids=array['{a['id']}']::uuid[] where singleton")
        g.ok(g.rpc(b['jwt'],'accept_my_account_deletion',dict(p_request_id=permit['request_id'],p_confirmation_token=permit['confirmation_token']))['status']==403,'database synthetic allowlist cannot be bypassed with a valid permit')
        g.sql(f"update private.account_deletion_admission set allowed_user_ids=array['{b['id']}']::uuid[] where singleton")
        assert g.action(b,'confirm',request_id=permit['request_id'],confirmation_token=permit['confirmation_token'],confirmed=True)['status']==202
        p=permit;g.accepting('false')
        g.ok(g.action(a,'begin')['status']==503,'closing switch stops further accepted intentions')
        g.ok(g.data(g.http('deletion','/','POST',dict(action='receipt',receipt_token=p['receipt_token'])))=={'status':'accepted'},'receipt remains available with acceptance off')
        # A normal member still has working business CRUD; target old JWT is isolated.
        g.ok(g.rpc(b['jwt'],'ensure_personal_space')['status']==403,'accepted old JWT cannot bootstrap personal data')
        g.ok(g.http('rest','/tasks','POST',dict(space_id=ids['shared'],title='Normal production-policy fixture'),a['jwt'])['status']==201,'normal member business writes remain available')
        # Failure/retry after acceptance is OFF; local fault proxy only.
        fault(g,'storage','fail');g.wake()
        g.ok(stage(g,p)=='storage:processing','Storage API failure cannot advance deletion')
        fixture_due(g,p);g.wake();g.wake()
        fault(g,'auth','fail');g.wake()
        g.ok(stage(g,p)=='auth:processing','Auth failure cannot prematurely complete')
        fixture_due(g,p)
        # Independent native scheduler; do not copy fixture ACL changes to Production.
        g.command(['exec','-i',g.prefix+'_db','psql','-U','supabase_admin','-d','postgres','-X','-Atq','-v','ON_ERROR_STOP=1'],(ROOT/'supabase/tests/account_deletion_local_cron.sql').read_text())
        g.sql(f"select vault.create_secret('{g.wake_secret}','account_deletion_local_wake')")
        g.sql("select cron.schedule('production-policy-fixture','1 second','select private.wake_account_deletions_local();')")
        wait_for(lambda:stage(g,p)=='verify:completed',30)
        g.ok(stage(g,p)=='verify:completed','native cron/net completes after acceptance disabled with no client/PWA')
        g.ok(g.http('storage','/object/authenticated/profile-avatars/'+path,token=g.service)['status']>=400,'target avatar unavailable after API cleanup')
        g.ok(kept==retained(g,ids),'shared IDs bodies links and original Review data preserved')
        g.ok(g.data(g.http('deletion','/','POST',dict(action='receipt',receipt_token=p['receipt_token'])))=={'status':'completed'},'receipt works after Auth deletion while acceptance off')
        g.sql("select cron.unschedule('production-policy-fixture')")
        print(f'PASS {len(g.results)} production-policy real-local assertions; hosted gateway NOT VERIFIED',flush=True)
    finally:g.close()
if __name__=='__main__':main()
