import { useEffect, useRef, useState } from 'react';
import { Bell, LogOut } from 'lucide-react';
import { memberDisplayNameMaxLength } from '../lib/member';
import { createRequestGuard } from '../lib/request-guard';
import { cleanupPushAndSignOut, disableCurrentPushInstallation, unsubscribeCurrentPushSubscription } from '../lib/push-notifications';
import { supabase } from '../lib/supabase';
import { NotificationSettings } from './NotificationSettings';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请稍后再试。';
}

export function MyPage({ userId }: { userId: string }) {
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

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-4">
      <h1 className="text-xl font-bold">我的</h1>
      <form className="mt-4 rounded-lg bg-white p-4 shadow-sm" onSubmit={(event) => void saveName(event)}>
        <label className="block text-sm font-semibold" htmlFor="my-display-name">显示名称</label>
        <input id="my-display-name" className="mt-2 w-full rounded-lg border border-ink/15 px-4 py-3 outline-none focus:border-teal" value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="nickname" disabled={loading || busy} maxLength={memberDisplayNameMaxLength} />
        <button className="mt-3 min-h-11 rounded-lg bg-teal px-4 font-semibold text-white disabled:opacity-60" type="submit" disabled={loading || busy || displayName.trim() === savedName}>{busy ? '保存中' : '保存名称'}</button>
      </form>
      <button className="mt-4 flex min-h-14 w-full items-center gap-3 rounded-lg bg-white px-4 text-left font-semibold shadow-sm" type="button" onClick={() => setShowNotifications(true)}><Bell size={18} />此设备通知设置</button>
      <button className="mt-4 flex min-h-14 w-full items-center gap-3 rounded-lg bg-white px-4 text-left font-semibold shadow-sm" type="button" onClick={() => void signOut()}><LogOut size={18} />退出登录</button>
      {error && <p className="mt-4 rounded-lg bg-coral/10 px-4 py-3 text-sm text-coral" role="alert">{error}</p>}
      {message && <p className="mt-4 rounded-lg bg-teal/10 px-4 py-3 text-sm text-teal" role="status">{message}</p>}
      {showNotifications && <NotificationSettings onClose={() => setShowNotifications(false)} />}
    </main>
  );
}
