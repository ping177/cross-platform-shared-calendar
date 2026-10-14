import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import type { CurrentSpace, SpaceMember } from '../src/types.ts';
const personal = {id:'p',name:'个人空间',kind:'personal',invite_code:'PRIVATE',created_by:'me',created_at:'2026-01-01',membershipRole:'owner'} as CurrentSpace;
const shared = {...personal,id:'s',name:'共同空间',kind:'shared',invite_code:'FIXTURE'} as CurrentSpace;
const members = [{space_id:'s',user_id:'me',role:'owner',joined_at:'2026-01-01',profiles:{display_name:'我'}},{space_id:'s',user_id:'other',role:'member',joined_at:'2026-01-02',profiles:{display_name:'同伴'}}] as SpaceMember[];
const noop=()=>undefined;
async function components(run:(m:any)=>void|Promise<void>){const v=await createServer({configFile:false,envFile:false,logLevel:'silent',appType:'custom',server:{middlewareMode:true,hmr:false}} as any);try{await run({...await v.ssrLoadModule('/src/components/SpaceManagementPage.tsx'),...await v.ssrLoadModule('/src/components/SharedSpaceForms.tsx'),...await v.ssrLoadModule('/src/components/MyPage.tsx')});}finally{await v.close();}}
function nodes(tree:any):any[]{return React.isValidElement(tree)?[tree,...React.Children.toArray((tree.props as any).children).flatMap(nodes)]:[];}
const detailProps={space:shared,members,moduleState:'enabled',moduleError:'',moduleBusy:false,onModuleRetry:noop,onModuleToggle:noop,reviewModuleState:'disabled',listsModuleState:'enabled',importantDatesModuleState:'disabled',onSpaceChange:noop};
test('owner switches preserve all four authoritative states; members are read-only and unknown is never off',()=>components(({SpaceDetailContent})=>{
 const html=(p:any)=>renderToStaticMarkup(React.createElement(SpaceDetailContent,{...detailProps,...p}));
 const owner=html({});assert.equal((owner.match(/role="switch"/g)||[]).length,4);assert.match(owner,/ui-space-switch-track/);assert.match(owner,/aria-checked="true"/);assert.match(owner,/aria-checked="false"/);assert.doesNotMatch(owner,/邀请成员/);
 const member=html({space:{...shared,membershipRole:'member'}});assert.doesNotMatch(member,/role="switch"/);assert.match(member,/已开启|已关闭/);
 const unknown=html({moduleState:'loading',reviewModuleState:'error',listsModuleState:'loading',importantDatesModuleState:'error'});assert.doesNotMatch(unknown,/role="switch"|已关闭/);assert.match(unknown,/读取中|重试/);
 const busy=html({moduleBusy:true});assert.match(busy,/更新中/);assert.match(busy,/disabled=""[^>]*role="switch"|role="switch"[^>]*disabled=""/);
}));
test('personal detail has no invitation, other participants or lifecycle controls',()=>components(({SpaceDetailContent})=>{
 const html=renderToStaticMarkup(React.createElement(SpaceDetailContent,{...detailProps,space:personal,members:[],lifecycleControls:React.createElement('p',{},'危险操作')}));assert.match(html,/个人空间/);assert.doesNotMatch(html,/邀请码|同伴|危险操作|空间成员/);
}));
test('overview exposes two entries without mounted forms or fictional member counts; My keeps a compact profile without permanent name fields',()=>components(({SharedSpaceForms,MyPage})=>{
 const forms=renderToStaticMarkup(React.createElement(SharedSpaceForms,{onReady:async()=>true,busy:false,onBusyChange:noop}));assert.match(forms,/创建共享空间|加入空间/);assert.doesNotMatch(forms,/<form|<input|2 位成员/);
 const me=renderToStaticMarkup(React.createElement(MyPage,{userId:'me',onManageSpaces:noop}));assert.match(me,/ui-my-page/);assert.doesNotMatch(me,/<input|保存名称/);assert.match(me,/ui-profile-card/);assert.match(me,/此设备通知设置|退出登录/);
}));
async function runtime(file:string,run:(e:any)=>Promise<void>,exportName?:string){let cursor=0;const slots:any[]=[];const calls:any[]=[];const effects:any[]=[];
 (globalThis as any).__spaceUIHooks={useState(initial:any){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],(value:any)=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},useRef(initial:any){return slots[cursor++]??={current:initial};},useEffect(fn:any){effects.push(fn);}};
 (globalThis as any).__spaceUIClient={rpc:async(method:string,args:any)=>{calls.push({method,args});return{data:{id:'new-space'},error:null};}};
 const v=await createServer({configFile:false,envFile:false,logLevel:'silent',appType:'custom',server:{middlewareMode:true,hmr:false},ssr:{noExternal:[/^react$/],external:['react/jsx-runtime','react/jsx-dev-runtime']},plugins:[{name:'space-ui-handlers',enforce:'pre',resolveId(id,importer){if(id==='react')return '\0space-hooks';if(/\/supabase(?:\.ts)?$/.test(id))return '\0space-client';},load(id){if(id==='\0space-hooks')return'export const {useState,useRef,useEffect}=globalThis.__spaceUIHooks;';if(id==='\0space-client')return'export const supabase=globalThis.__spaceUIClient;';}}]} as any);
 try{const m=await v.ssrLoadModule('/src/components/'+file);const props:any={busy:false,onBusyChange:(b:boolean)=>{props.busy=b;},onReady:async(id:string)=>{calls.push({ready:id});return true;}};const C=m[exportName??file.replace('.tsx','')];const render=()=>{cursor=0;return C(props);};const click=(label:string)=>nodes(render()).find(n=>n.type==='button'&&(n.props['aria-label']===label||n.props.children===label)).props.onClick();const change=(id:string,value:string)=>nodes(render()).find(n=>n.props.id===id).props.onChange({target:{value}});const submit=()=>nodes(render()).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await run({props,calls,render,click,change,submit,client:(globalThis as any).__spaceUIClient,effects,flush:()=>new Promise(r=>setImmediate(r)),html:()=>renderToStaticMarkup(render()),m});}finally{await v.close();delete(globalThis as any).__spaceUIHooks;delete(globalThis as any).__spaceUIClient;}}
test('local create/join return confirms modified drafts; untouched default and empty input exit normally',()=>runtime('SharedSpaceForms.tsx',async({click,change,html})=>{
 const prior=(globalThis as any).window;let asked=0,accept=false;(globalThis as any).window={confirm:()=>{asked++;return accept;}};try{
 click('创建共享空间');assert.match(html(),/value="我们的日历"/);click('返回空间管理');assert.equal(asked,0);assert.doesNotMatch(html(),/<form/);
 click('创建共享空间');change('shared-space-name','旅行');click('加入空间');assert.match(html(),/shared-space-name/);click('返回空间管理');assert.equal(asked,1);assert.match(html(),/value="旅行"/);
 accept=true;click('返回空间管理');assert.doesNotMatch(html(),/<form/);click('加入空间');change('shared-invite-code','code');accept=false;click('返回空间管理');assert.match(html(),/value="code"/);accept=true;click('返回空间管理');
 }finally{(globalThis as any).window=prior;}
}));
test('create/join pending writes block duplicate submit and closing; failure preserves draft for retry and exact returned ID',()=>runtime('SharedSpaceForms.tsx',async({props,calls,click,change,submit,client,flush,html})=>{
 click('加入空间');change('shared-invite-code','  abcd  ');let release:any;client.rpc=async(method:string,args:any)=>{calls.push({method,args});return await new Promise(r=>{release=r;});};submit();submit();click('返回空间管理');assert.equal(calls.length,1);assert.deepEqual(calls[0],{method:'join_space_by_invite_code',args:{code:'ABCD'}});assert.match(html(),/处理中/);
 release({data:null,error:new Error('加入失败')});await flush();assert.match(html(),/加入失败|value="  abcd  "/);client.rpc=async(method:string,args:any)=>{calls.push({method,args});return{data:{id:'exact-space'},error:null};};submit();await flush();assert.equal(calls.at(-1).ready,'exact-space');assert.doesNotMatch(html(),/<form/);
}));

test('invitation rotation retains member access, blocks duplicate writes and preserves code on failure',()=>runtime('InvitePanel.tsx',async({props,calls,render,click,client,flush,html})=>{
 props.space={...shared,membershipRole:'member'};props.onSpaceChange=(space:any)=>{calls.push({updated:space});};
 let release:any;client.rpc=async(method:string,args:any)=>{calls.push({method,args});return new Promise(r=>{release=r;});};click('轮换邀请码');click('轮换邀请码');assert.equal(calls.length,1);assert.deepEqual(calls[0],{method:'rotate_invite_code',args:{space_id:'s'}});assert.equal(nodes(render()).find(n=>n.props['aria-label']==='轮换邀请码').props.disabled,true);
 release({data:null,error:{message:'轮换失败'}});await flush();assert.match(html(),/FIXTURE|轮换失败/);assert.equal(calls.length,1);
 client.rpc=async()=>({data:{...shared,invite_code:'NEWCODE'},error:null});click('轮换邀请码');await flush();assert.equal(calls[1].updated.invite_code,'NEWCODE');
}));

test('successful create with failed membership refresh retries the exact returned ID without creating twice',()=>runtime('SharedSpaceForms.tsx',async({props,calls,click,submit,flush,html})=>{
 let refreshed=false;props.onReady=async(id:string)=>{calls.push({ready:id});return refreshed;};click('创建共享空间');submit();await flush();assert.equal(calls.filter((c:any)=>c.method).length,1);assert.match(html(),/重试刷新/);refreshed=true;submit();await flush();assert.equal(calls.filter((c:any)=>c.method).length,1);assert.deepEqual(calls.filter((c:any)=>c.ready).map((c:any)=>c.ready),['new-space','new-space']);assert.doesNotMatch(html(),/<form/);
}));
test('My reads canonical profile and preserves notification/management callbacks',()=>runtime('MyPage.tsx',async({props,calls,client,render,effects,flush})=>{
 props.userId='me';props.onManageSpaces=()=>calls.push('management');client.from=()=>{const chain:any={eq:()=>chain,select:()=>chain,maybeSingle:async()=>({data:{display_name:'阿林',avatar_preset:null,avatar_path:null},error:null})};return chain;};render();effects[0]();await flush();const card=nodes(render()).find(n=>n.type?.name==='ProfileCard');assert.equal(card.props.profile.display_name,'阿林');
 nodes(render()).find(n=>n.type==='button'&&n.props.onClick===props.onManageSpaces).props.onClick();assert.equal(calls.at(-1),'management');nodes(render()).find(n=>n.type==='button'&&nodes(n).some(c=>c.props.children==='此设备通知设置')).props.onClick();assert.ok(nodes(render()).some(n=>n.type?.name==='NotificationSettings'));
}));

test('shared owner deletion still requires two confirmations and one canonical RPC',()=>runtime('SpaceManagementPage.tsx',async({props,calls,client,click,render,flush})=>{
 props.space=shared;props.members=members;props.userId='me';props.onSettled=async(action:string)=>calls.push({settled:action});client.from=(table:string)=>{const chain:any={select:()=>chain,eq:()=>chain,order:()=>chain,range:async()=>({data:table==='spaces'?[shared]:[members[0]],count:1,error:null}),then:(yes:any,no:any)=>Promise.resolve({data:members,error:null}).then(yes,no)};return chain;};click('删除空间');click('继续确认');assert.equal(calls.length,0);const confirm=nodes(render()).find(n=>n.type==='button'&&n.props.children==='永久删除空间').props.onClick;confirm();confirm();assert.equal(nodes(render()).find(n=>n.type==='button'&&n.props.children==='取消').props.disabled,true);await flush();assert.equal(calls.filter((c:any)=>c.method).length,1);assert.equal(calls.find((c:any)=>c.method).method,'delete_shared_space');assert.equal(calls.at(-1).settled,'delete');
},'SpaceLifecycleControls'));
test('danger dialog Escape cannot bypass busy protection and restores the opener focus',()=>runtime('SpaceManagementPage.tsx',async({props,click,render,effects})=>{
 props.space=shared;props.members=members;props.userId='me';props.onSettled=async()=>undefined;const prior=(globalThis as any).document;let restored=0,keydown:any;const opener={focus(){restored++;}};(globalThis as any).document={activeElement:opener,addEventListener:(_name:string,fn:any)=>{keydown=fn;},removeEventListener(){}};try{click('删除空间');const tree=render();const button={focus(){(globalThis as any).document.activeElement=button;}};nodes(tree).find(n=>n.props.role==='dialog').ref.current={contains:()=>true,focus(){},querySelector:()=>button,querySelectorAll:()=>[button,button],addEventListener:(_name:string,fn:any)=>{keydown=fn;},removeEventListener(){}};const cleanup=effects.at(-1)();props.busy=true;render();keydown({key:'Escape',preventDefault(){}});assert.ok(nodes(render()).some(n=>n.props.role==='dialog'));props.busy=false;render();keydown({key:'Escape',preventDefault(){}});assert.ok(!nodes(render()).some(n=>n.props.role==='dialog'));cleanup();assert.equal(restored,1);}finally{(globalThis as any).document=prior;}
},'SpaceLifecycleControls'));
test('Clipboard copy and failure fallback is preserved without broadening invitation permissions',()=>runtime('InvitePanel.tsx',async({props,click,flush,html})=>{
 props.space=shared;props.onSpaceChange=noop;const prior=Object.getOwnPropertyDescriptor(globalThis,'navigator');Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async(value:string)=>{assert.equal(value,'FIXTURE');}}}});try{click('复制邀请码');await flush();assert.match(html(),/邀请码已复制/);(globalThis as any).navigator.clipboard.writeText=async()=>{throw new Error('clipboard blocked');};click('复制邀请码');await flush();assert.match(html(),/复制失败，请手动复制邀请码/);assert.match(html(),/FIXTURE/);}finally{if(prior)Object.defineProperty(globalThis,'navigator',prior);else delete(globalThis as any).navigator;}
}));

test('composition input cannot submit a local create/join form prematurely',()=>runtime('SharedSpaceForms.tsx',async({click,render,submit,calls})=>{
 click('创建共享空间');const input=nodes(render()).find(n=>n.props.id==='shared-space-name');input.props.onCompositionStart();let prevented=0;nodes(render()).find(n=>n.type==='form').props.onKeyDownCapture({key:'Enter',nativeEvent:{isComposing:true},preventDefault(){prevented++;}});submit();assert.equal(prevented,1);assert.equal(calls.length,0);input.props.onCompositionEnd();
}));
