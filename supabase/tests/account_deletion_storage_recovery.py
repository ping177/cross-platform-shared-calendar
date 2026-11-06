"""Storage-only fault gate; real HTTP, synthetic users, cached owned services.

Reuses the cross-service bootstrap, not its Auth/Review/Edge suite. An anonymous
owned Docker volume preserves blobs across Storage SIGKILL/restart and is removed
with the owned container. No Storage core, SQL protection or real data is changed.
"""
import base64
from contextlib import contextmanager
import json
import secrets
import subprocess
import time

from account_deletion_cross_service import DOCKER, HTTP, IMAGES, Gate, uid

JPEG = b'\xff\xd8\xff\xe0' + b'storage-fault-fixture' * 100 + b'\xff\xd9'


class StorageGate(Gate):
    def run(self, kind, env):
        if kind != 'storage':
            return super().run(kind, env)
        name=self.prefix+'_storage';self.containers.append(name)
        args=['run','-d','--pull=never','--name',name,'--network',self.prefix,'--network-alias','storage',
              '--mount','type=volume,destination=/var/lib/storage']
        for key,value in env.items():args+=['-e',key+'='+value]
        self.command(args+[IMAGES['storage']])

    def command(self, args, source=None, timeout=60):
        # HTTP client must survive pause/kill of the server under test.
        if getattr(self,'client_ready',False) and args[-1:]==[HTTP]:
            args=list(args);args[2]=self.prefix+'_client'
            args[-1]=HTTP.replace('12000',str(getattr(self,'http_ms',12000)))
        return super().command(args,source,timeout)

    def start(self):
        super().start()
        name=self.prefix+'_client';self.containers.append(name)
        self.command(['run','-d','--pull=never','--name',name,'--network',self.prefix,'--entrypoint','node',
                      IMAGES['storage'],'-e','setInterval(()=>{},1000)'])
        self.client_ready=True
        self.volume=self.command(['inspect',self.prefix+'_storage','--format',
            '{{range .Mounts}}{{if eq .Destination "/var/lib/storage"}}{{.Type}}:{{.Name}}{{end}}{{end}}']).strip()
        assert self.volume.startswith('volume:'),'Crash fixture must preserve its own volume'

    def user(self):
        r=self.http('auth','/signup','POST',dict(email=uid()+'@storage-gate.invalid',password=secrets.token_hex(16)))
        assert r['status']==200,'Synthetic Auth fixture unavailable'
        v=self.data(r);return v['user']['id'],v['access_token']

    def upload(self, user, token):
        path=user+'/'+uid()+'.jpg'
        assert self.http('storage','/object/profile-avatars/'+path,'POST',token=token,binary=JPEG)['status']==200
        return path

    def accepted(self, user):
        request=self.accept(user)
        assert self.sql(f"select private.set_account_deletion_status('{request}',0,'processing')")=='t'
        return request

    def metadata(self,path):
        return int(self.sql(f"select count(*) from storage.objects where bucket_id='profile-avatars' and name='{path}'"))

    def blobs(self,path):
        files=self.command(['exec',self.prefix+'_storage','find','/var/lib/storage','-type','f']).splitlines()
        return [f for f in files if path in f and not f.endswith('.info')]

    def remove(self,path):
        return self.http('storage','/object/profile-avatars','DELETE',{'prefixes':[path]},self.service)

    def wait(self,predicate,label,seconds=8):
        deadline=time.monotonic()+seconds
        while time.monotonic()<deadline:
            if predicate():return
            time.sleep(.05)
        raise AssertionError('NOT VERIFIED: observation unavailable: '+label)

    def restart_storage(self):
        self.command(['start',self.prefix+'_storage'])
        def ready():
            try:return self.http('storage','/status')['status']==200
            except AssertionError:return False  # connection refused during real restart
        self.wait(ready,'Storage ready after restart')

    def no_completion(self,request,label):
        self.ok(self.sql(f"select status from private.account_deletions where request_id='{request}'")!='completed',label)


@contextmanager
def sql_hold(g,body):
    command=DOCKER+['exec','-i',g.prefix+'_db','psql','-U','postgres','-d','postgres','-X','-Atq','-v','ON_ERROR_STOP=1']
    p=subprocess.Popen(command,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    try:
        p.stdin.write("begin;set local statement_timeout='20s';\n"+body+'\n\\echo HELD\n');p.stdin.flush()
        while True:
            line=p.stdout.readline()
            if line.strip()=='HELD':break
            assert line or p.poll() is None,'Control transaction failed'
        yield
        p.stdin.write('commit;\n');p.stdin.close();p.wait(timeout=10)
        assert p.returncode==0,'Control commit failed'
    finally:
        if p.poll() is None:p.terminate();p.wait(timeout=5)


STREAM = r"""
const {createInterface}=await import('node:readline');const {once}=await import('node:events');const {request}=await import('node:http');
const rl=createInterface({input:process.stdin});const [line]=await once(rl,'line');const q=JSON.parse(line),body=Buffer.from(q.bytes,'base64');
try {
 const result=await new Promise((resolve,reject)=>{
  const req=request({hostname:'storage',port:5000,path:q.url,method:q.method,headers:{'Content-Type':'image/jpeg','Content-Length':body.length,'Authorization':'Bearer '+q.token}},res=>{
   let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,text}));
  });req.on('error',reject);req.write(body.subarray(0,100));console.log('PREFIX_SENT');
  once(rl,'line').then(()=>req.end(body.subarray(100)));
 });console.log(JSON.stringify(result));
}catch{console.log(JSON.stringify({status:0,text:'NETWORK_UNKNOWN'}));}process.exit(0);
"""


@contextmanager
def streaming(g,path,token,signed=False):
    url='/object/profile-avatars/'+path
    if signed:
        r=g.http('storage','/object/upload/sign/profile-avatars/'+path,'POST',{},token)
        assert r['status']==200
        url=g.data(r)['url'];token=g.anon
    q=dict(url=url,token=token,method='PUT' if signed else 'POST',bytes=base64.b64encode(JPEG).decode())
    p=subprocess.Popen(DOCKER+['exec','-i',g.prefix+'_client','node','--input-type=module','-e',STREAM],
        stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    try:
        p.stdin.write(json.dumps(q)+'\n');p.stdin.flush()
        assert p.stdout.readline().strip()=='PREFIX_SENT'
        g.wait(lambda:bool(g.blobs(path)),'actual partial blob')
        yield p
    finally:
        if p.poll() is None:p.terminate();p.wait(timeout=5)


def verify(g):
    control,ct=g.user();control_path=g.upload(control,ct)
    # The public route executes asSuperUser for signed uploads. Exercise both
    # normal app uploads and pre-issued signed capabilities at metadata commit.
    for signed in [False,True]:
        user,token=g.user();path=user+'/'+uid()+'.jpg'
        with streaming(g,path,token,signed) as p:
            with sql_hold(g,'lock table storage.objects in share mode;'):
                p.stdin.write('finish\n');p.stdin.flush()
                g.wait(lambda:bool(g.blobs(path)) and int(g.command(['exec',g.prefix+'_storage','stat','-c','%s',g.blobs(path)[0]]))==len(JPEG),'all upload bytes before metadata commit')
                g.wait(lambda:g.sql("select exists(select 1 from pg_stat_activity where usename='supabase_storage_admin' and wait_event_type='Lock' and cardinality(pg_blocking_pids(pid))>0)")=='t','real metadata transaction wait')
                request=g.accepted(user)
                g.ok(g.metadata(path)==0,'full blob exists while metadata absent ('+str(signed)+')')
            result=json.loads(p.stdout.readline());p.wait(timeout=12)
            g.ok(result['status']>=400 and 'ACCOUNT_ACCESS_REVOKED' in result['text'],'post-acceptance metadata commit rejected ('+str(signed)+')')
            g.wait(lambda:not g.blobs(path),'normal Storage failed-upload cleanup')
            g.ok(g.metadata(path)==0 and not g.blobs(path),'full failed upload cleaned by unchanged Storage ('+str(signed)+')')
            g.no_completion(request,'failed upload never marked completed ('+str(signed)+')')

    # Timeout before the service can acknowledge anything: keep phase pending,
    # resume the same service, retry through the API, and check real bytes.
    user,token=g.user();path=g.upload(user,token);request=g.accepted(user)
    g.command(['pause',g.prefix+'_storage']);g.http_ms=600
    try:
        try:g.remove(path)
        except AssertionError:timed_out=True
        else:timed_out=False
        g.ok(timed_out,'paused real Storage delete times out at caller')
        g.ok(g.metadata(path)==1,'timeout is not interpreted as confirmed deletion')
        g.no_completion(request,'timeout preserves unfinished state')
    finally:
        g.command(['unpause',g.prefix+'_storage']);g.http_ms=12000
    g.ok(g.remove(path)['status']==200 and g.metadata(path)==0 and not g.blobs(path),'independent retry cleans timeout fixture')
    g.ok(g.remove(path)['status']==200 and g.metadata(path)==0,'repeat delete of absent fixture is safe')

    # Crash inside a real deletion request after its DB work begins, before
    # releasing the locked row. Do not claim a post-unlink/pre-commit crash.
    user,token=g.user();path=g.upload(user,token);request=g.accepted(user)
    q=dict(service='storage',path='/object/profile-avatars',method='DELETE',headers={'Authorization':'Bearer '+g.service,'Content-Type':'application/json'},body={'prefixes':[path]})
    with sql_hold(g,f"select id from storage.objects where name='{path}' for update;"):
        p=subprocess.Popen(DOCKER+['exec','-i',g.prefix+'_client','node','--input-type=module','-e',HTTP],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        p.stdin.write(json.dumps(q));p.stdin.close()
        try:
            g.wait(lambda:g.sql("select exists(select 1 from pg_stat_activity where usename='supabase_storage_admin' and wait_event_type='Lock' and cardinality(pg_blocking_pids(pid))>0)")=='t','delete request waiting on real row')
            g.command(['kill','--signal=KILL',g.prefix+'_storage']);p.wait(timeout=15)
        finally:
            if p.poll() is None:p.terminate();p.wait(timeout=5)
    g.restart_storage()
    g.ok(g.metadata(path)==1 and bool(g.blobs(path)),'delete crash rolls back metadata and retains recoverable file')
    g.no_completion(request,'delete crash remains unfinished')
    g.ok(g.remove(path)['status']==200 and g.metadata(path)==0 and not g.blobs(path),'API retry after crash deletes metadata and real file')

    # Server succeeds; the execution process loses its acknowledgement before
    # recording success. Discard the real response at the test client boundary.
    user,token=g.user();path=g.upload(user,token);request=g.accepted(user)
    q['body']={'prefixes':[path]}
    program=HTTP.replace("console.log(JSON.stringify({status:r.status,text:bytes.toString(),base64:bytes.toString('base64')}));process.exit(0);", "process.exit(r.status===200?75:76);")
    result=subprocess.run(DOCKER+['exec','-i',g.prefix+'_client','node','--input-type=module','-e',program],input=json.dumps(q),text=True,capture_output=True,timeout=20)
    g.ok(result.returncode==75 and not result.stdout,'real delete completed but execution acknowledgement discarded')
    g.ok(g.metadata(path)==0 and not g.blobs(path),'lost acknowledgement did not imply server rollback')
    g.no_completion(request,'unacknowledged operation does not fabricate completion')
    g.ok(g.remove(path)['status']==200 and g.metadata(path)==0 and not g.blobs(path),'retry after lost acknowledgement is idempotent')

    # Kill before a failed upload can enqueue/run its cleanup. Persist the real
    # local orphan across server restart; no direct unlink or SQL metadata delete.
    user,token=g.user();path=user+'/'+uid()+'.jpg'
    with streaming(g,path,token,signed=True) as p:
        request=g.accepted(user)
        g.command(['kill','--signal=KILL',g.prefix+'_storage']);p.wait(timeout=15)
    g.restart_storage()
    g.ok(g.metadata(path)==0 and bool(g.blobs(path)),'hard upload crash leaves an unindexed local blob after restart')
    g.ok(g.data(g.http('storage','/object/list/profile-avatars','POST',{'prefix':user,'limit':100},g.service))==[],'API empty list cannot certify absence of crash orphan')
    g.ok(g.remove(path)['status']==200 and bool(g.blobs(path)),'public delete cannot discover unindexed local blob')
    g.ok(g.http('storage','/object/authenticated/profile-avatars/'+path,token=token)['status']>=400,'unindexed crash blob is not accessible via authenticated API')
    g.ok(g.http('storage','/object/profile-avatars/'+path,'POST',token=token,binary=JPEG)['status']>=400 and g.metadata(path)==0,'old JWT cannot publish orphan bytes after restart')
    g.ok(g.sql(f"select private.set_account_deletion_status('{request}',1,'needs_attention','INVARIANT_FAILED')")=='t','observed unresolved orphan enters durable needs_attention')
    g.no_completion(request,'known orphan is not labelled completed')
    try:g.sql(f"select private.set_account_deletion_status('{request}',2,'completed')")
    except AssertionError:blocked=True
    else:blocked=False
    g.ok(blocked,'existing finalizer boundary rejects fabricated completion')
    g.ok(g.http('storage','/object/authenticated/profile-avatars/'+control_path,token=ct)['base64']==base64.b64encode(JPEG).decode(),'unrelated user file bytes intact after all faults')
    print('NOT VERIFIED: exact post-physical-delete/pre-DB-commit crash; hosted S3/queue recovery; universal upload hard timeout',flush=True)
    print('OBSERVED: local crash orphan retained for operator/platform recovery, then removed only with disposable test volume',flush=True)


def main():
    gate=StorageGate()
    try:
        gate.start();verify(gate)
        print(f'PASS {len(gate.results)} targeted Storage assertions (includes safe needs_attention outcome)',flush=True)
    finally:
        gate.close()
        if hasattr(gate,'volume'):
            r=subprocess.run(DOCKER+['volume','inspect',gate.volume.split(':',1)[1]],capture_output=True,text=True)
            assert r.returncode!=0,'Owned anonymous test volume leaked'
            print('Owned crash-persistent anonymous volume removed',flush=True)


if __name__=='__main__':
    main()
