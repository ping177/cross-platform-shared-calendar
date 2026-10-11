import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
const vite = await createServer({ configFile: false, envFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false } });
test.after(() => vite.close());
const { loadModuleOverview } = await vite.ssrLoadModule('/src/lib/module-overview.ts');
const personal = { id: 'p', kind: 'personal', name: '我的空间', membershipRole: 'owner' };
const shared = { id: 's', kind: 'shared', name: '家庭', membershipRole: 'member' };
const availability = { tasksIds: ['p','s'], reviewIds: ['p','s'], listsIds: ['p','s'], importantDatesIds: ['p','s'],
  tasksError: false, reviewError: false, listsError: false, importantDatesError: false };
const split = (text: string) => { let depth = 0, start = 0; const parts = []; for (let i=0;i<text.length;i++) { if(text[i]==='(') depth++; if(text[i]===')') depth--; if(text[i]===',' && depth===0) { parts.push(text.slice(start,i)); start=i+1; } } parts.push(text.slice(start)); return parts; };
function predicate(text: string, row: any): boolean {
  if(text.startsWith('and(')) return split(text.slice(4,-1)).every(x=>predicate(x,row));
  if(text.startsWith('or(')) return split(text.slice(3,-1)).some(x=>predicate(x,row));
  const [field,op,raw] = text.split('.'); const value = raw==='null'?null:Number.isFinite(Number(raw))?Number(raw):raw;
  return op==='is'||op==='eq'?row[field]===value:op==='gt'?row[field]>value:op==='gte'?row[field]>=value:row[field]<=value;
}
function client(patch: any = {}) {
  const db: any = { space_members: [personal,shared].map(s=>({space_id:s.id,user_id:'me',role:s.membershipRole})),
    space_modules: [personal,shared].flatMap(s=>['tasks','review','lists','important_dates'].map(module_key=>({space_id:s.id,module_key,enabled:true}))),
    tasks: [{id:'t1',space_id:'p',status:'open'},{id:'t2',space_id:'s',status:'open'},{id:'t3',space_id:'s',status:'completed'},{id:'hidden',space_id:'x',status:'open'}],
    lists: [{id:'l1',space_id:'p'},{id:'l2',space_id:'s'}], list_items: Array.from({length:50},(_,i)=>({id:String(i),list_id:'l1'})),
    review_rounds: [{id:'r1',space_id:'p',review_date:'2026-10-01',round_no:1},{id:'r2',space_id:'p',review_date:'2026-10-10',round_no:2},{id:'r3',space_id:'s',review_date:'2026-10-12',round_no:1}],
    important_dates: [], ...patch };
  const calls: any[] = []; const limits:any[]=[]; let afterRead = () => {};
  return { db, calls, limits, after(fn:()=>void){afterRead=fn;}, auth: { getUser: async()=>({data:{user:{id:'me'}},error:null}) },
    from(table: string) {
      const filters: any[]=[]; const orders: any[]=[]; let maximum=Infinity, head=false, exact=false;
      const query: any = {
        select(columns:string, options:any={}) { head=!!options.head; exact=options.count==='exact'; calls.push([table,columns,options]); return query; },
        eq(field:string,value:any){filters.push((r:any)=>r[field]===value);return query;},
        in(field:string,values:any[]){filters.push((r:any)=>values.includes(r[field]));return query;},
        gt(field:string,value:any){filters.push((r:any)=>r[field]>value);return query;},
        or(text:string){filters.push((r:any)=>split(text).some(x=>predicate(x,r)));return query;},
        order(field:string,options:any={}){orders.push([field,options.ascending!==false]);return query;},
        limit(n:number){maximum=n;limits.push([table,n]);return query;},
        then(resolve:any,reject:any) { return Promise.resolve().then(()=>{
          if(db[table] instanceof Error) return {data:null,count:null,error:db[table]};
          if(db.__responses && table in db.__responses) return db.__responses[table];
          let rows=db[table].filter((r:any)=>filters.every(fn=>fn(r)));
          rows.sort((a:any,b:any)=>{for(const [field,asc] of orders){if(a[field]!==b[field]) return (a[field]<b[field]?-1:1)*(asc?1:-1);}return 0;});
          const result={data:head?null:rows.slice(0,maximum),count:db.__counts && table in db.__counts ? db.__counts[table] : exact ? rows.length : null,error:null}; if(!exact && db.__omitCandidateCounts) delete (result as any).count; if(['tasks','lists','review_rounds','important_dates'].includes(table)) afterRead(); return result;
        }).then(resolve,reject); }
      }; return query;
    }
  };
}
const read=(c:any, patch:any={})=>loadModuleOverview({userId:'me',spaces:[personal,shared],availability,reviewSpaceId:'p',...patch},c,{year:2026,month:10,day:11});
const date=(id:string,fields:any={})=>({id,space_id:'s',name:id,emoji:null,repeat_kind:'annual',year:null,month:1,day:1,created_by:'me',created_at:'2026-01-01T00:00:00Z',updated_at:'2026-01-01T00:00:00Z',reminder_schedule_changed_at:'2026-01-01T00:00:00Z',time_zone:'Asia/Shanghai',reminder_kind:null,...fields});
test('exact open Tasks and Lists counts respect qualified Spaces; Review stays in selected Space',async()=>{
 const c=client();const result=await read(c);assert.equal(result.tasks.value,2);assert.equal(result.lists.value,2);
 assert.equal(result.review.value.date,'2026-10-10');assert.equal(result.review.value.spaceId,'p');
 assert.equal(c.calls.some(x=>x[0]==='list_items'),false);
 assert.ok(c.calls.filter(x=>['tasks','lists'].includes(x[0])).every(x=>x[2].head && x[2].count==='exact'));
 assert.equal((await read(client(),{reviewSpaceId:'s'})).review.value.date,'2026-10-12');
});
test('zero, empty, disabled and per-metric failure remain distinct',async()=>{
 const zero=await read(client({tasks:[],lists:[],review_rounds:[]})); assert.equal(zero.tasks.value,0);assert.equal(zero.lists.value,0);assert.equal(zero.review.value.date,null);assert.equal(zero.importantDates.value,null);
 const c=client();c.db.space_modules.filter((r:any)=>r.module_key==='tasks').forEach((r:any)=>r.enabled=false);
 assert.equal((await read(c,{availability:{...availability,tasksIds:[]}})).tasks.state,'unavailable');
 const failure=await read(client({lists:new Error('offline')}));assert.equal(failure.lists.state,'error');assert.equal(failure.tasks.value,2);assert.equal('value' in failure.lists,false);
});
test('scope loss and wrong authentication cannot publish results',async()=>{
 const c=client(); c.after(()=>{c.db.space_modules[0].enabled=false;});
 await assert.rejects(()=>read(c),/资格/);
 const wrong=client();wrong.auth.getUser=async()=>({data:{user:{id:'other'}},error:null});await assert.rejects(()=>read(wrong),/登录/);
});
test('next Important Date uses canonical annual/anchor/Feb29 rules and excludes past one-offs',async()=>{
 const c=client({important_dates:[date('past',{repeat_kind:'none',year:2020}),date('annual',{month:10,day:12}),date('once',{repeat_kind:'none',year:2026,month:10,day:13}),date('future-anchor',{year:2030,month:1,day:1})]});
 assert.deepEqual((await read(c)).importantDates.value,{name:'annual',date:'2026-10-12',spaceId:'s'});
 const leap=client({important_dates:[date('leap',{month:2,day:29}),date('march',{month:3,day:1})]});
 const result=await loadModuleOverview({userId:'me',spaces:[personal,shared],availability,reviewSpaceId:null},leap,{year:2027,month:2,day:28});
 assert.equal(result.importantDates.value.date,'2027-02-28');
 const anchor=await read(client({important_dates:[date('later',{year:2031}),date('first',{year:2030,month:9,day:2})]}));assert.equal(anchor.importantDates.value.date,'2030-09-02');
 assert.ok(c.calls.filter(x=>x[0]==='important_dates').length===4);
});

test('qualification restricts each count and missing exact count never becomes zero',async()=>{
 const c=client();c.db.space_modules.filter((r:any)=>r.module_key==='tasks'&&r.space_id==='s').forEach((r:any)=>r.enabled=false);
 const result=await read(c,{availability:{...availability,tasksIds:['p']}});assert.equal(result.tasks.value,1);assert.equal(result.lists.value,2);
 const incomplete=await read(client({__counts:{tasks:null}}));assert.equal(incomplete.tasks.state,'error');assert.equal('value' in incomplete.tasks,false);
 const missing=client();missing.db.space_members.pop();await assert.rejects(()=>read(missing),/成员资格/);
 await assert.rejects(()=>read(client(),{spaces:[]}),/成员资格/);
 const unknown=await read(client(),{availability:{...availability,listsError:true,listsIds:null}});assert.equal(unknown.lists.state,'error');assert.equal(unknown.tasks.value,2);
});
test('bounded next-date candidates equal canonical full-data projection across year/leap boundaries',async()=>{
 const {nextImportantDateOccurrence}=await vite.ssrLoadModule('/supabase/functions/_shared/important-date.ts');
 const data=[date('annual-wrap',{month:12,day:31}),date('new-year'),date('feb29',{month:2,day:29}),date('feb28',{month:2,day:28}),date('march',{month:3,day:1}),date('future-anchor',{year:2030,month:2,day:3}),date('once',{repeat_kind:'none',year:2028,month:5,day:2})];
 for(const today of [{year:2026,month:12,day:31},{year:2027,month:1,day:1},{year:2027,month:2,day:28},{year:2028,month:2,day:29},{year:2031,month:10,day:11}]){
  for(const subset of [data,data.slice(2),data.slice(5),data.slice(6)]){
   const c=client({important_dates:subset});
   const actual=await loadModuleOverview({userId:'me',spaces:[personal,shared],availability,reviewSpaceId:null},c,today);
   const expected=subset.map(r=>nextImportantDateOccurrence(r,today)).filter(Boolean).sort((a:any,b:any)=>a.year-b.year||a.month-b.month||a.day-b.day)[0];
   const label=expected?String(expected.year).padStart(4,'0')+'-'+String(expected.month).padStart(2,'0')+'-'+String(expected.day).padStart(2,'0'):null;
   assert.equal(actual.importantDates.value?.date??null,label);
   assert.deepEqual(c.limits.filter(x=>x[0]==='important_dates').map(x=>x[1]),[1,1,1,1]);
  }
 }
});

test('overview identity tracks the real fallback Review Space, rename and scope boundary',async()=>{
 const {overviewScopeKey}=await vite.ssrLoadModule('/src/lib/module-overview.ts');
 const scope={userId:'me',spaces:[personal,shared],availability,reviewSpaceId:null};
 assert.notEqual(overviewScopeKey(scope),overviewScopeKey({...scope,spaces:[shared,personal]}));
 assert.notEqual(overviewScopeKey(scope),overviewScopeKey({...scope,spaces:[{...personal,name:'新名称'},shared]}));
});


test('latest Review and four next-date candidates omit exact count; real totals and qualification keep it',async()=>{
 const c=client({important_dates:[date('next',{month:10,day:12})]});const result=await read(c);
 assert.equal(result.review.value.date,'2026-10-10');assert.equal(result.importantDates.value.date,'2026-10-12');
 const candidateCalls=c.calls.filter(x=>['review_rounds','important_dates'].includes(x[0]));
 assert.equal(candidateCalls.filter(x=>x[0]==='review_rounds').length,1);
 assert.equal(candidateCalls.filter(x=>x[0]==='important_dates').length,4);
 assert.ok(candidateCalls.every(x=>!('count' in x[2])));
 assert.deepEqual(c.limits.filter(x=>['review_rounds','important_dates'].includes(x[0])).map(x=>x[1]),[1,1,1,1,1]);
 assert.ok(c.calls.filter(x=>['tasks','lists'].includes(x[0])).every(x=>x[2].count==='exact'&&x[2].head));
 assert.ok(c.calls.filter(x=>['space_members','space_modules'].includes(x[0])).every(x=>x[2].count==='exact'));
});
test('null or missing candidate counts allow both empty and single-record results',async()=>{
 for(const omit of [false,true]){
  const empty=await read(client({review_rounds:[],important_dates:[],__omitCandidateCounts:omit}));
  assert.equal(empty.review.state,'ready');assert.equal(empty.review.value.date,null);
  assert.equal(empty.importantDates.state,'ready');assert.equal(empty.importantDates.value,null);
  const single=await read(client({review_rounds:[{id:'only',space_id:'p',review_date:'2026-10-09',round_no:1}],important_dates:[date('next',{month:10,day:12})],__omitCandidateCounts:omit}));
  assert.equal(single.review.value.date,'2026-10-09');assert.equal(single.importantDates.value.date,'2026-10-12');
 }
});
test('candidate database errors, malformed responses and oversized results never become empty success',async()=>{
 for(const [table,key] of [['review_rounds','review'],['important_dates','importantDates']]){
  const failed=await read(client({[table]:new Error('database read failed')}));
  assert.equal(failed[key].state,'error');assert.equal('value' in failed[key],false);
  for(const data of [null,{},[{},{}],[null],[{}]]){
   const malformed=await read(client({__responses:{[table]:{data,error:null}}}));
   assert.equal(malformed[key].state,'error');assert.equal('value' in malformed[key],false);
   assert.equal(malformed.tasks.value,2);assert.equal(malformed.lists.value,2);
  }
 }
});
