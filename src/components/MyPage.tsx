import { useEffect, useRef, useState } from 'react';
import { Bell, ChevronRight, LogOut, Layers } from 'lucide-react';
import { readProfile, type Profile } from '../lib/profile';
import { createRequestGuard } from '../lib/request-guard';
import { cleanupPushAndSignOut, disableCurrentPushInstallation, unsubscribeCurrentPushSubscription } from '../lib/push-notifications';
import { supabase } from '../lib/supabase';
import { NotificationSettings } from './NotificationSettings';
import { ProfileCard } from './ProfileCard';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请稍后再试。';
}

export function MyPage({ userId, onManageSpaces }: { userId: string; onManageSpaces: () => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const requestGuard = useRef(createRequestGuard());

  useEffect(() => {
    const request = requestGuard.current.begin();
    setLoading(true); setProfile(null); setError('');
    void readProfile(supabase, userId).then((data) => {
      if (!requestGuard.current.isCurrent(request)) return;
      setLoading(false);
      setProfile(data);
    }).catch(() => {
      if (!requestGuard.current.isCurrent(request)) return;
      setLoading(false); setError('未能读取资料，请稍后重试。');
    });
    return () => requestGuard.current.invalidate();
  }, [userId, retry]);

  async function signOut() {
    setError('');
    try {
      await cleanupPushAndSignOut({
        disableRemote: async () => { await disableCurrentPushInstallation(supabase); },
        unsubscribe: unsubscribeCurrentPushSubscription,
        signOut: async () => {
          const { error: signOutError } = await supabase.auth.signOut();
          if (signOutError) throw signOutError;
        },
        onCleanupError: (stage, cleanupError) => {
          console.warn(`Push cleanup failed during ${stage}.`, errorMessage(cleanupError));
        },
      });
    } catch (signOutError) {
      setError(errorMessage(signOutError));
    }
  }

  return <>
    <main className="ui-my-page mx-auto min-h-[100dvh] w-full max-w-3xl px-ui-4 py-ui-4 bg-ui-page font-ui text-ui-text">
      <h1 className="ui-me-title text-ui-section">我的</h1>
      <ProfileCard key={userId} userId={userId} profile={profile} loading={loading} onProfileChange={setProfile} />
      {!loading && !profile && <button className="ui-focus min-h-11 px-ui-3 text-ui-meta text-ui-accent" type="button" onClick={() => setRetry((value) => value + 1)}>重试读取资料</button>}
      <div className="ui-my-links">
        <button className="ui-space-entry ui-focus" type="button" onClick={onManageSpaces}><Layers size={20} aria-hidden="true" /><span>空间管理</span><ChevronRight size={18} aria-hidden="true" /></button>
        <button className="ui-space-entry ui-focus" type="button" onClick={() => setShowNotifications(true)}><Bell size={20} aria-hidden="true" /><span>此设备通知设置</span><ChevronRight size={18} aria-hidden="true" /></button>
        <button className="ui-space-entry ui-focus" type="button" onClick={() => void signOut()}><LogOut size={20} aria-hidden="true" /><span>退出登录</span><ChevronRight size={18} aria-hidden="true" /></button>
      </div>
      {error && <p className="mt-ui-4 text-ui-meta text-ui-danger" role="alert">{error}</p>}
    </main>
    {showNotifications && <NotificationSettings onClose={() => setShowNotifications(false)} />}
  </>;
}
