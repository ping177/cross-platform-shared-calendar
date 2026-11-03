import { ChevronLeft, LogOut } from 'lucide-react';
import { LoginEmail } from './LoginEmail';
import { useMobileSwipe } from './useMobileSwipe';

export function AccountManagementPage({ userId, email, error, onBack, onSignOut }: {
  userId: string; email?: string; error: string; onBack: () => void; onSignOut: () => void;
}) {
  const swipe = useMobileSwipe({ enabled: true, scope: `${userId}:account`, direction: 'right', onSwipe: onBack });
  return <main {...swipe} className="mx-auto min-h-[100dvh] w-full max-w-3xl bg-ui-page px-ui-4 py-ui-4 font-ui text-ui-text safe-bottom">
    <header className="flex min-h-11 items-center gap-ui-3">
      <button className="ui-focus inline-flex min-h-11 shrink-0 items-center gap-ui-1 rounded-ui-control text-ui-meta font-ui-semibold text-ui-accent" type="button" onClick={onBack}><ChevronLeft size={18} aria-hidden="true" />我的</button>
      <h1 className="text-ui-page-title">账户管理</h1>
    </header>
    <LoginEmail userId={userId} email={email} />
    <div className="ui-my-links">
      <button className="ui-space-entry ui-focus" type="button" onClick={onSignOut}><span>退出登录</span><LogOut className="mx-ui-3" size={20} aria-hidden="true" /></button>
    </div>
    {error && <p className="mt-ui-4 text-ui-meta text-ui-danger" role="alert">{error}</p>}
  </main>;
}
