import { useEffect, useRef, useState } from 'react';
import { Bell, ChevronRight, LogOut, UserRound, Layers } from 'lucide-react';
import { memberDisplayNameMaxLength } from '../lib/member';
import { createRequestGuard } from '../lib/request-guard';
import { cleanupPushAndSignOut, disableCurrentPushInstallation, unsubscribeCurrentPushSubscription } from '../lib/push-notifications';
import { supabase } from '../lib/supabase';
import { NotificationSettings } from './NotificationSettings';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请稍后再试。';
}

export function MyPage({ userId, onManageSpaces }: { userId: string; onManageSpaces: () => void }) {
  const [displayName, setDisplayName] = useState('');
  const [savedName, setSavedName] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const requestGuard = useRef(createRequestGuard());

  useEffect(() => {
    const request = requestGuard.current.begin();
    void supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle().then(({ data, error: readError }) => {
      if (!requestGuard.current.isCurrent(request)) return;
      setLoading(false);
      if (readError) { setError(readError.message); return; }
      const name = data?.display_name ?? '';
      setDisplayName(name);
      setSavedName(name);
    });
    return () => requestGuard.current.invalidate();
  }, [userId]);

  async function saveName(event: React.FormEvent) {
    event.preventDefault();
    const name = displayName.trim();
    if (!name || name.length > memberDisplayNameMaxLength) {
      setError(`名称须为 1–${memberDisplayNameMaxLength} 个字符。`);
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    const { data, error: updateError } = await supabase.from('profiles').update({ display_name: name }).eq('id', userId).select('id');
    setBusy(false);
    if (updateError || !data?.length) {
      setError(updateError?.message ?? '未能更新名称，请重新登录后再试。');
      return;
    }
    setDisplayName(name);
    setSavedName(name);
    setMessage('名称已更新。');
  }

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
      <form className="ui-my-profile" onSubmit={(event) => void saveName(event)}>
        <div className="ui-my-profile-heading"><UserRound size={24} aria-hidden="true" /><h2 className="min-w-0 break-words text-ui-bar">{loading ? '正在读取资料…' : savedName || '我的资料'}</h2></div>
        <label className="ui-space-field-label" htmlFor="my-display-name">显示名称</label>
        <input id="my-display-name" className="ui-space-input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="nickname" disabled={loading || busy} maxLength={memberDisplayNameMaxLength} />
        <button className="ui-focus mt-ui-3 min-h-11 rounded-ui-control px-ui-3 text-ui-meta font-ui-semibold text-ui-accent disabled:opacity-50" type="submit" disabled={loading || busy || displayName.trim() === savedName}>{busy ? '保存中' : '保存名称'}</button>
      </form>
      <div className="ui-my-links">
        <button className="ui-space-entry ui-focus" type="button" onClick={onManageSpaces}><Layers size={20} aria-hidden="true" /><span>空间管理</span><ChevronRight size={18} aria-hidden="true" /></button>
        <button className="ui-space-entry ui-focus" type="button" onClick={() => setShowNotifications(true)}><Bell size={20} aria-hidden="true" /><span>此设备通知设置</span><ChevronRight size={18} aria-hidden="true" /></button>
        <button className="ui-space-entry ui-focus" type="button" onClick={() => void signOut()}><LogOut size={20} aria-hidden="true" /><span>退出登录</span><ChevronRight size={18} aria-hidden="true" /></button>
      </div>
      {error && <p className="mt-ui-4 text-ui-meta text-ui-danger" role="alert">{error}</p>}
      {message && <p className="mt-ui-4 text-ui-meta text-ui-accent" role="status">{message}</p>}
    </main>
    {showNotifications && <NotificationSettings onClose={() => setShowNotifications(false)} />}
  </>;
}
