import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {Session} from '@supabase/supabase-js';
import {deletionRequest} from '../../src/lib/account-deletion-api';
import {ReviewDetailPanels} from '../../src/components/ReviewDetailPage';
import {readReviewDetail} from '../../src/lib/review-detail-data';
import type {ReviewDetail} from '../../src/lib/review-detail';
import type {CurrentSpace} from '../../src/types';
import {supabase} from '../../src/lib/supabase';
import RootApp from '../../src/App';
import {AccountManagementPage} from '../../src/components/AccountManagementPage';
import {AccountDeletionBoundary} from '../../src/components/AccountDeletionBoundary';
import '../../src/styles.css';
if(!import.meta.env.DEV)throw new Error('注销界面验证仅允许隔离本地开发模式。');
declare global {interface Window {deletionTestSession:Session;deletionSessionChange:()=>void;deletionTestRoot?:boolean;deletionTestReview?:{space:CurrentSpace;reviewId:string}}}
Object.assign(window,{deletionTestRequest:(body:Record<string,unknown>)=>deletionRequest(body,window.deletionTestSession.user.id)});
function History({session}:{session:Session}){
 const [detail,setDetail]=useState<ReviewDetail|null>(null),[panel,setPanel]=useState<'mine'|'other'>('other');
 useEffect(()=>{const target=window.deletionTestReview!;void readReviewDetail(supabase,target.space,target.reviewId,session.user.id).then(setDetail);},[]);
 return detail?<ReviewDetailPanels detail={detail} userId={session.user.id} mobilePanel={panel} onMobilePanelChange={setPanel} onDirtyChange={()=>undefined}/>:<p>正在读取历史回顾…</p>;
}
function Harness(){
 const [session,setSession]=useState<Session|null>(null),[ready,setReady]=useState(false);
 useEffect(()=>{const auth=supabase.auth.onAuthStateChange((_event,value)=>setSession(value));void supabase.auth.setSession(window.deletionTestSession).then(()=>setReady(true));window.deletionSessionChange=()=>{void supabase.auth.signOut({scope:'local'});};return()=>auth.data.subscription.unsubscribe();},[]);
 if(ready&&window.deletionTestRoot)return <RootApp/>;
 if(!ready)return <p>准备合成会话…</p>;
 return <AccountDeletionBoundary session={session} onFinished={clear=>{if(clear)setSession(null);}}>{session&&window.deletionTestReview?<History session={session}/>:session?<AccountManagementPage userId={session.user.id} email={session.user.email} error="" onBack={()=>undefined} onSignOut={()=>void supabase.auth.signOut({scope:'local'})}/>:<h1>登录</h1>}</AccountDeletionBoundary>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
