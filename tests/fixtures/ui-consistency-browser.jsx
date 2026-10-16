import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import RootApp,{BottomNavigation} from '../../src/App';
import {ModuleHubContent} from '../../src/components/ModuleHub';
import {TasksArea} from '../../src/components/TasksArea';
import {ListsOverviewPage} from '../../src/components/ListsOverviewPage';
import {ReviewHistoryPage} from '../../src/components/ReviewHistoryPage';
import {ReviewDetailPage} from '../../src/components/ReviewDetailPage';
import {ImportantDatesPage} from '../../src/components/ImportantDatesPage';
import {MyPage} from '../../src/components/MyPage';
import '../../src/styles.css';
const params=new URLSearchParams(location.search),mode=params.get('mode')||'tasks',state=params.get('state')||'populated';
const empty=state==='empty',loading=state==='loading',error=state==='error';
const spaces=[{id:'p',name:'我的小天地',kind:'personal',membershipRole:'owner',created_by:'me',created_at:'2026-01-01'},{id:'s',name:'家庭共享空间',kind:'shared',membershipRole:'owner',created_by:'me',invite_code:'TEST2026',created_at:'2026-01-01'}];
const members=id=>[{space_id:id,user_id:'me',role:'owner',joined_at:'2026-01-01',profiles:{display_name:'测试用户',avatar_preset:'cat-f-02',avatar_path:null}},...(id==='p'?[]:[{space_id:id,user_id:'other',role:'member',joined_at:'2026-01-02',profiles:{display_name:'家人',avatar_path:null}}])];
const entry={memberSpaces:spaces,eligibleSpaces:spaces};
const events=empty?[]:Array.from({length:7},(_,i)=>({id:'e'+i,space_id:i%2?'s':'p',title:['家庭晚餐','运动与散步','准备下周旅行计划并确认预订资料'][i%3],description:'仅用于隔离视觉审查的合成内容',created_by:'me',owner_user_id:i%2?null:'me',scope:i%2?'shared':'personal',all_day:false,starts_at:`2026-10-${String(16+i%4).padStart(2,'0')}T0${i%5+1}:00:00Z`,ends_at:null,recurrence_rule:null,reminder_kind:null}));
const tasks=empty?[]:Array.from({length:7},(_,i)=>({id:'t'+i,space_id:i%2?'s':'p',title:['购买本周食材','预约年度体检','整理出行资料与家庭共享事项清单'][i%3],status:i===6?'completed':'open',assigned_to_user_id:i%2?null:'me',created_by:'me',due_on:'2026-10-16',created_at:'2026-10-01',updated_at:'2026-10-15'}));
const lists=empty?[]:[{id:'l',space_id:'s',name:'周末采购',created_by:'me',created_at:'2026-10-01',updated_at:'2026-10-15'},{id:'l2',space_id:'p',name:'旅行准备与待办物品',created_by:'me',created_at:'2026-10-01',updated_at:'2026-10-15'}];
const items=empty?[]:[{id:'i',list_id:'l',space_id:'s',section_id:'g',content:'牛奶和水果',completed:false,sort_order:1},{id:'i2',list_id:'l',space_id:'s',section_id:null,content:'检查出行证件',completed:true,sort_order:2}];
const dates=empty?[]:[{id:'d',space_id:'s',name:'家人生日',emoji:'🎂',repeat_kind:'annual',year:null,month:10,day:20,reminder_kind:null},{id:'d2',space_id:'p',name:'值得纪念的一天',emoji:null,repeat_kind:'none',year:2026,month:9,day:1,reminder_kind:null}];
const rounds=empty?[]:Array.from({length:5},(_,i)=>({id:'r'+i,space_id:'s',round_no:5-i,review_date:`2026-10-${String(16-i*2).padStart(2,'0')}`,created_by:'me',created_at:'2026-10-01'}));
const own={review_id:'r0',user_id:'me',focus:'本周优先把重要的事情安排好。',progress:'完成了家庭出行准备。',problems:'还需要留出足够休息时间。',next_plan:'下周继续保持规律作息。',content_revision:1,filled_revision:1,updated_at:'2026-10-16T00:00:00Z'};
const tables={events,tasks,lists,list_items:items,important_dates:dates,review_rounds:rounds,review_entries:[own,{...own,user_id:'other'}],list_sections:[{id:'g',list_id:'l',name:'食材',sort_order:1}],profiles:[{id:'me',display_name:'测试用户',avatar_preset:'cat-f-02',avatar_path:null}],space_members:spaces.flatMap(s=>members(s.id)),space_modules:spaces.flatMap(s=>['tasks','review','lists','important_dates'].map(module_key=>({space_id:s.id,module_key,enabled:true}))),event_occurrence_exceptions:[]};
window.audit={mode,state,spaces,entry,members,tables,own,rounds,events,tasks,dates,lists,items,requests:[],
 async read(value){if(loading)return new Promise(()=>{});if(error)throw new Error('读取失败，请重试。');return structuredClone(value)},
 taskData(filter){const set=filter==='all'?tasks:tasks.filter(t=>t.space_id===filter.spaceId);return {...entry,filter,grouped:{open:set.filter(t=>t.status==='open'),completed:set.filter(t=>t.status==='completed')},sourceSpacesById:Object.fromEntries(spaces.map(s=>[s.id,s])),membersBySpaceId:Object.fromEntries(spaces.map(s=>[s.id,members(s.id)]))}},
 listData(){return {...entry,grouped:{active:lists.map(list=>({list,totalItems:2,completedCount:0})),completed:empty?[]:[{list:{...lists[0],id:'completed-list',name:'已完成的出行准备'},totalItems:2,completedCount:2}]}}},
 dateData(){return {...entry,dates}},
 query(table){let rows=structuredClone(tables[table]||[]),one=false,start=0,end=100000,head=false;const q={select(cols,opts){head=!!opts?.head;return q},eq(k,v){rows=rows.filter(r=>r[k]===v);return q},in(k,vs){rows=rows.filter(r=>vs.includes(r[k]));return q},order(){return q},range(a,b){start=a;end=b;return q},limit(n){end=n-1;return q},is(k,v){rows=rows.filter(r=>r[k]===v);return q},not(k,op,v){rows=rows.filter(r=>r[k]!==v);return q},gte(k,v){rows=rows.filter(r=>r[k]!=null&&r[k]>=v);return q},lte(k,v){rows=rows.filter(r=>r[k]!=null&&r[k]<=v);return q},lt(k,v){rows=rows.filter(r=>r[k]!=null&&r[k]<v);return q},gt(k,v){rows=rows.filter(r=>r[k]!=null&&r[k]>v);return q},or(){return q},maybeSingle(){one=true;return q},single(){one=true;return q},then(resolve,reject){window.audit.requests.push(table);if(loading)return new Promise(()=>{});return Promise.resolve(error?{data:null,error:new Error('读取失败，请重试。'),count:null}:{data:head?null:one?rows[0]??null:rows.slice(start,end+1),count:rows.length,error:null}).then(resolve,reject)}};return q}
};

window.audit.navigations=[];window.audit.authCalls=[];window.audit.holdRpc=false;window.audit.rpcCalls=[];
window.audit.rpc=(name,args)=>{window.audit.rpcCalls.push({name,args});return window.audit.holdRpc?new Promise(resolve=>{window.audit.releaseRpc=()=>resolve({data:null,error:{message:'模拟失败，请重试。'}})}):Promise.resolve({data:null,error:{message:'模拟失败，请重试。'}})};
const noop=()=>{},navigate=key=>()=>window.audit.navigations.push(key);
function Fixture(){
 const [reviewId,setReviewId]=useState('s');
 const overview={tasks:{state:'ready',value:empty?0:6},lists:{state:'ready',value:empty?0:2},review:{state:'ready',value:{date:empty?null:'2026-10-16',spaceName:'我的小天地'}},importantDates:{state:'ready',value:empty?null:{name:'家人生日',date:'2026-10-20'}}};
 if(loading||error)Object.values(overview).forEach(m=>m.state=state);
 let content;
 if(mode==='login')return <RootApp/>;
 if(mode==='hub')content=<ModuleHubContent loading={loading} tasksAvailable tasksError={error} reviewAvailable reviewError={error} listsAvailable listsError={error} importantDatesAvailable importantDatesError={error} overview={overview} onOpenTasks={navigate('tasks')} onOpenReview={navigate('review')} onOpenLists={navigate('lists')} onOpenImportantDates={navigate('important')} onRetryTasks={noop} onRetryReview={noop} onRetryLists={noop}/>;
 else if(mode==='tasks')content=<TasksArea screen="tasks" userId="me" entry={entry} entryPending={false} onScreenChange={noop} onHubBack={noop}/>;
 else if(mode==='lists')content=<ListsOverviewPage userId="me" entry={entry} onHubBack={noop} onNoEligible={noop} onOpenDetail={noop}/>;
 else if(mode==='review')content=<ReviewHistoryPage userId="me" entry={entry} currentSpaceId={reviewId} onSpaceChange={setReviewId} onOpenDetail={noop} onHubBack={noop}/>;
 else if(mode==='review-detail')content=<ReviewDetailPage userId="me" target={{spaceId:'s',reviewId:'r0',justCreated:false}} onBack={noop} onDirtyChange={noop} onUnavailable={noop}/>;
 else if(mode==='important')content=<ImportantDatesPage userId="me" entry={entry} onHubBack={noop} onNoEligible={noop}/>;
 else if(mode==='me')content=<MyPage userId="me" onManageSpaces={noop}/>;
 return <div className="min-h-screen text-ink pb-nav bg-ui-page">{content}<BottomNavigation tab="modules" onChange={noop}/></div>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
