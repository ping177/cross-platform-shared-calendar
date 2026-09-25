import { useState } from 'react';
import { completeSharedSpaceAction } from '../lib/space-selection';
import { supabase } from '../lib/supabase';

export function SharedSpaceForms({ onReady, busy, onBusyChange }: {
  onReady: (spaceId: string) => Promise<boolean>;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const [spaceName, setSpaceName] = useState('我们的日历');
  const [inviteCode, setInviteCode] = useState('');
  const [message, setMessage] = useState('');

  async function submit(action: 'create' | 'join', value: string) {
    onBusyChange(true);
    setMessage('');
    try {
      if (!await completeSharedSpaceAction(action, value, async (method, args) => await supabase.rpc(method, args), onReady)) {
        setMessage(action === 'create' ? '空间已创建，但成员列表暂未刷新，请重试。' : '已加入空间，但成员列表暂未刷新，请重试。');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作失败，请稍后再试。');
    } finally {
      onBusyChange(false);
    }
  }

  return (
    <div className="mt-6 border-t border-ink/10 pt-4">
      <p className="text-sm leading-6 text-ink/65">创建两人共享空间，或输入邀请码加入。</p>
      {message && <p className="mt-5 rounded-lg bg-coral/10 px-4 py-3 text-sm text-coral" role="alert">{message}</p>}
      <form onSubmit={(event) => { event.preventDefault(); void submit('create', spaceName); }} className="mt-4 rounded-lg bg-white p-5 shadow-soft">
        <h2 className="text-lg font-bold">创建共享空间</h2>
        <label className="mt-4 block text-sm font-semibold" htmlFor="shared-space-name">空间名称</label>
        <input id="shared-space-name" className="mt-2 w-full rounded-lg border border-ink/15 px-4 py-3 outline-none focus:border-teal" value={spaceName} onChange={(event) => setSpaceName(event.target.value)} required />
        <button className="mt-4 h-12 w-full rounded-lg bg-teal font-semibold text-white disabled:opacity-60" type="submit" disabled={busy}>创建空间</button>
      </form>
      <form onSubmit={(event) => { event.preventDefault(); void submit('join', inviteCode); }} className="mt-4 rounded-lg bg-white p-5 shadow-soft">
        <h2 className="text-lg font-bold">加入空间</h2>
        <label className="mt-4 block text-sm font-semibold" htmlFor="shared-invite-code">邀请码</label>
        <input id="shared-invite-code" className="mt-2 w-full rounded-lg border border-ink/15 px-4 py-3 uppercase tracking-wide outline-none focus:border-teal" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} placeholder="输入邀请码" required />
        <button className="mt-4 h-12 w-full rounded-lg bg-ink font-semibold text-white disabled:opacity-60" type="submit" disabled={busy}>加入空间</button>
      </form>
    </div>
  );
}
