import { lazy, Suspense } from 'react';
import { ChevronLeft, Download, LogOut, UserRoundX } from 'lucide-react';
import { canStartAccountDeletion } from '../lib/account-deletion-api';
import { submitDeletionFromPage } from './AccountDeletionBoundary';
import { LoginEmail } from './LoginEmail';
import { useMobileSwipe } from './useMobileSwipe';
import { useAccountNavigation } from './useAccountNavigation';
const DataExportPage = lazy(() => import('./DataExportPage').catch(() => ({ default: ({ onBack }: { userId: string; onBack: () => void }) => <main className="p-ui-4"><p role="alert">导出页面未能加载，请返回后刷新重试。</p><button type="button" className="ui-focus min-h-11 text-ui-accent" onClick={onBack}>返回账户管理</button></main> })));

const AccountDeletionPage = lazy(() => import('./AccountDeletionPage'));

export function AccountManagementPage({ userId, email, error, onBack, onSignOut, onSpacesChanged }: {
  userId: string; email?: string; error: string; onBack: () => void; onSignOut: () => void; onSpacesChanged?: () => void;
}) {
  const deletionNavigation = useAccountNavigation(userId, 'deletion');
  const exportNavigation = useAccountNavigation(userId, 'export');
  const accountDeletionEnabled = canStartAccountDeletion(userId);
  const deletionOpen = accountDeletionEnabled && deletionNavigation.open;
  const swipe = useMobileSwipe({ enabled: !exportNavigation.open && !deletionOpen, scope: `${userId}:account`, direction: 'right', onSwipe: onBack });
  if (deletionOpen) return <Suspense fallback={<p role="status">正在打开注销账号…</p>}><AccountDeletionPage userId={userId} onBack={() => { deletionNavigation.back(); onSpacesChanged?.(); }} onConfirm={proof => submitDeletionFromPage(userId, proof)}/></Suspense>;
  if (exportNavigation.open) return <Suspense fallback={<main className="p-ui-4"><button type="button" onClick={exportNavigation.back}>返回账户管理</button><p role="status">正在打开导出数据…</p></main>}><DataExportPage key={userId} userId={userId} onBack={exportNavigation.back} /></Suspense>;
  return <main {...swipe} className="mx-auto min-h-[100dvh] w-full max-w-3xl bg-ui-page px-ui-4 py-ui-4 font-ui text-ui-text safe-bottom">
    <header className="ui-spaces-header flex min-h-11 items-center gap-ui-3">
      <button className="ui-focus inline-flex min-h-11 shrink-0 items-center gap-ui-1 rounded-ui-control text-ui-meta font-ui-semibold text-ui-accent" type="button" onClick={onBack}><ChevronLeft size={18} aria-hidden="true" />我的</button>
      <h1 className="min-w-0 flex-1 break-all text-ui-section">账户管理</h1>
    </header>
    <LoginEmail userId={userId} email={email} />
    <div className="ui-my-links">
      <button className="ui-space-entry ui-account-card ui-focus" type="button" onClick={exportNavigation.enter}><span className="ui-account-label">导出数据</span><span className="ui-account-icon-slot"><Download size={20} aria-hidden="true" /></span></button>
      {accountDeletionEnabled && <button className="ui-space-entry ui-account-card ui-focus" type="button" onClick={deletionNavigation.enter}><span className="ui-account-label text-ui-danger">注销账号</span><span className="ui-account-icon-slot text-ui-danger"><UserRoundX size={20} aria-hidden="true"/></span></button>}
      <button className="ui-space-entry ui-account-card ui-focus" type="button" onClick={onSignOut}><span className="ui-account-label">退出登录</span><span className="ui-account-icon-slot"><LogOut size={20} aria-hidden="true" /></span></button>
    </div>
    {error && <p className="mt-ui-4 text-ui-meta text-ui-danger" role="alert">{error}</p>}
  </main>;
}
