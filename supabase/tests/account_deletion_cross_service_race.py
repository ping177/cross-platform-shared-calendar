"""Real PostgREST JWT writes versus owner test-control acceptance transactions.

Only receives the owned Gate instance. Wait ordering is observed in pg_locks;
no role/GUC identity simulation is used for the HTTP business requests.
"""
import json
import secrets
import subprocess
import time
import uuid


def run(g, context, docker, http_program):
    psql=docker+['exec','-i',g.prefix+'_db','psql','-U','postgres','-d','postgres','-X','-Atq','-v','ON_ERROR_STOP=1']
    processes=[]

    def owner(body, ready=True):
        p=subprocess.Popen(psql,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        processes.append(p);p.stdin.write("begin;set local statement_timeout='10s';\n"+body+"\n"+('\\echo HELD\n' if ready else 'commit;\n'));p.stdin.flush()
        if ready:
            while True:
                line=p.stdout.readline()
                if line.strip()=='HELD':break
                assert line or p.poll() is None,'Owner control did not reach hold point'
        else:p.stdin.close()
        return p

    def request(user,token,space):
        event=str(uuid.uuid4())
        q=dict(service='rest',path='/events',method='POST',headers={'Authorization':'Bearer '+token,
            'Content-Type':'application/json','Prefer':'return=representation'},
            body=dict(id=event,space_id=space,created_by=user,scope='personal',owner_user_id=user,title='Real HTTP race',starts_at='2030-01-01'))
        p=subprocess.Popen(docker+['exec','-i',g.prefix+'_storage','node','--input-type=module','-e',http_program],
            stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        processes.append(p);p.stdin.write(json.dumps(q));p.stdin.close()
        return event,p

    def observe(query):
        for _ in range(25):
            if g.sql(query)=='t':return
            time.sleep(.05)
        raise AssertionError('Actual HTTP/advisory ordering not observed')

    def commit(p):
        p.stdin.write('commit;\n');p.stdin.close();p.wait(timeout=12)
        assert p.returncode==0,'Owner transaction failed'

    try:
        c,ct=context['users'][2]
        space=g.sql(f"select id from public.spaces where kind='personal' and created_by='{c}'")
        intent=str(uuid.uuid4());g.sql(f"select private.prepare_account_deletion('{c}','{intent}')")
        control=owner(f"select private.accept_account_deletion('{c}','{intent}');")
        event,p=request(c,ct,space)
        observe("select exists(select 1 from pg_stat_activity where usename='authenticator' and wait_event='advisory' and cardinality(pg_blocking_pids(pid))>0)")
        commit(control);p.wait(timeout=15);result=json.loads(p.stdout.read())
        g.ok(result['status']==403 and 'ACCOUNT_ACCESS_REVOKED' in result['text'],'real HTTP write waiting behind acceptance fails after commit')
        g.ok(g.sql(f"select count(*) from public.events where id='{event}'")=='0','acceptance-first race created no event')
        r=g.http('auth','/signup','POST',dict(email=str(uuid.uuid4())+'@gate.invalid',password=secrets.token_hex(16)))
        v=g.data(r);e=v['user']['id'];et=v['access_token']
        assert g.rpc(et,'ensure_personal_space')['status']==200
        space=g.sql(f"select id from public.spaces where kind='personal' and created_by='{e}'")
        intent=str(uuid.uuid4());g.sql(f"select private.prepare_account_deletion('{e}','{intent}')")
        control=owner(f"select pg_advisory_xact_lock(hashtext('{space}'));")
        event,p=request(e,et,space)
        observe(f"select exists(select 1 from pg_stat_activity a join pg_locks l on l.pid=a.pid where a.usename='authenticator' and a.wait_event='advisory' and l.locktype='advisory' and l.classid=20261105 and l.objid=(hashtext('{e}')::bigint & 4294967295)::oid and l.granted and l.mode='ShareLock')")
        acceptor=owner(f"select private.accept_account_deletion('{e}','{intent}');",ready=False)
        observe("select exists(select 1 from pg_stat_activity where usename='postgres' and wait_event='advisory' and cardinality(pg_blocking_pids(pid))>0)")
        commit(control);p.wait(timeout=15);acceptor.wait(timeout=15)
        g.ok(json.loads(p.stdout.read())['status']==201 and acceptor.returncode==0,'real HTTP writer finishes before waiting acceptance; no deadlock')
        g.ok(g.sql(f"select status from private.account_deletions where user_id='{e}'")=='accepted' and
             g.sql(f"select title from public.events where id='{event}'")=='Real HTTP race','write-first event included in durable accepted state')
    finally:
        for p in processes:
            if p.poll() is None:p.terminate();p.wait(timeout=5)
