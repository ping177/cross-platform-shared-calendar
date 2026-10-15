// Actual page components and filter hooks; only backend I/O is supplied in memory.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CurrentSpaceApp } from '../../src/App';
import { TasksArea } from '../../src/components/TasksArea';
import { ListsOverviewPage } from '../../src/components/ListsOverviewPage';
import { ReviewHistoryPage } from '../../src/components/ReviewHistoryPage';
import { ImportantDatesPage } from '../../src/components/ImportantDatesPage';
import '../../src/styles.css';
const spaces = Array.from({length:24}, (_,i) => ({id:'s'+i, name:i===0?'我的自定义小天地':i===1?'家庭共享空间':i===22?'极长空间名称与连续长文本ABCDEFGHIJKLMN'.repeat(6):'共享空间 '+i+' 很长的空间名称测试',kind:i===0?'personal':'shared',membershipRole:'owner',created_by:'me',created_at:'2026-10-01'}));
const members = id => [{space_id:id,user_id:'me',role:'owner'},...(id==='s0'?[]:[{space_id:id,user_id:'other',role:'member'}])];
window.fixture = { spaces, entry:{memberSpaces:spaces,eligibleSpaces:spaces}, members, requests:[], pending:[], hold:false, fail:false, changes:[],
 async taskData(filter){const key=filter==='all'?'all':filter.spaceId;this.requests.push(key);if(this.hold) await new Promise(resolve=>this.pending.push({key,resolve}));if(this.fail)throw new Error('筛选读取失败');const targets=filter==='all'?spaces:spaces.filter(s=>s.id===filter.spaceId);return {memberSpaces:spaces,eligibleSpaces:spaces,filter,grouped:{open:targets.map(s=>({id:'t'+s.id,space_id:s.id,title:'任务 '+s.name,status:'open',assigned_to_user_id:null,due_on:null,created_by:'me'})),completed:[]},sourceSpacesById:Object.fromEntries(spaces.map(s=>[s.id,s])),membersBySpaceId:Object.fromEntries(spaces.map(s=>[s.id,members(s.id)]))}},
 listData(){return {...this.entry,grouped:{completed:[],active:spaces.slice(0,2).map(s=>({list:{id:'l'+s.id,space_id:s.id,name:'清单 '+s.name},completedCount:0,totalItems:1}))}}},
 importantData(){return {...this.entry,dates:spaces.slice(0,2).map(s=>({id:'i'+s.id,space_id:s.id,name:'重要日 '+s.name,repeat_kind:'annual',year:null,month:1,day:1,emoji:null,reminder_kind:null}))}}
};
const noop=()=>{};
function Fixture(){
 const mode=new URLSearchParams(location.search).get('mode');
 const [filter,setFilter]=useState('all');const [reviewId,setReviewId]=useState('s0');
 const [entry,setEntry]=useState(window.fixture.entry);const [entryPending,setEntryPending]=useState(false);window.fixture.setEntry=value=>{window.fixture.entry=value;setEntry(value)};window.fixture.setEntryPending=setEntryPending;
 const choose=value=>{window.fixture.changes.push(value);setFilter(value)};
 return <>
 {mode==='calendar'?<CurrentSpaceApp key={filter==='all'?'all':filter.spaceId} session={{user:{id:'me'}}} spaces={filter==='all'?spaces:spaces.filter(s=>s.id===filter.spaceId)} allSpaces={spaces} importantDatesEntry={{memberSpaces:spaces,eligibleSpaces:[]}} calendarFilter={filter} onCalendarFilterChange={choose} selectedDate={new Date(2026,9,16)} onSelectedDateChange={noop} viewMode="today" onViewModeChange={noop}/>
 :mode==='tasks'?<TasksArea screen="tasks" onScreenChange={noop} onHubBack={noop} userId="me" entry={entry} entryPending={entryPending}/>
 :mode==='lists'?<ListsOverviewPage userId="me" entry={entry} entryPending={entryPending} onHubBack={noop} onNoEligible={noop} onOpenDetail={noop}/>
 :mode==='review'?<ReviewHistoryPage userId="me" entry={entry} entryPending={entryPending} currentSpaceId={reviewId} onSpaceChange={setReviewId} onOpenDetail={noop} onHubBack={noop}/>
 :<ImportantDatesPage userId="me" entry={entry} entryPending={entryPending} onHubBack={noop} onNoEligible={noop}/>}
 <button id="outside" style={{position:'fixed',right:16,bottom:16,zIndex:5}}>外部按钮</button>
 <div style={{height:1200}} aria-hidden="true"/>
 </>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
