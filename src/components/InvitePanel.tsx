import { useEffect, useRef, useState } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Space } from '../types';
import { useListModalKeyboard } from './ListSheets';

export function InvitePanel({ space, onSpaceChange }: { space: Space; onSpaceChange: (space: Space) => void }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const rotating = useRef(false);
  const mounted = useRef(true);
  const keyboard = useListModalKeyboard(confirmOpen, busy, () => setConfirmOpen(false), '[data-invite-rotate-cancel]', rotating);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, [space.id]);
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(space.invite_code);
      if (mounted.current) setMessage('邀请码已复制。');
    } catch {
      if (mounted.current) setMessage('复制失败，请手动复制邀请码。');
    }
  }
  async function rotateCode() {
    if (!confirmOpen || rotating.current) return;
    rotating.current = true;
    setBusy(true);
    setMessage('');
    try {
      const { data, error } = await supabase.rpc('rotate_invite_code', { space_id: space.id });
      if (!mounted.current) return;
      if (error) { setMessage(error.message); return; }
      setConfirmOpen(false);
      onSpaceChange(data as Space);
      setMessage('已生成新邀请码，旧码已失效。');
    } catch (error) {
      if (mounted.current) setMessage(error instanceof Error ? error.message : '轮换失败，请稍后重试。');
    } finally {
      rotating.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return <section className="ui-space-group ui-space-invite">
    <h2 className="text-ui-list font-ui-semibold">邀请码</h2>
    <p className="mt-ui-2 break-all text-ui-section tracking-widest select-text">{space.invite_code}</p>
    <div className="mt-ui-3 flex flex-wrap gap-ui-2">
      <button className="ui-space-secondary ui-focus" type="button" disabled={busy} onClick={() => void copyCode()} aria-label="复制邀请码"><Copy size={18} aria-hidden="true" />复制邀请码</button>
      <button className="ui-space-secondary ui-focus" type="button" disabled={busy} onClick={() => { if (!rotating.current) { setMessage(''); setConfirmOpen(true); } }} aria-label="轮换邀请码"><RefreshCw size={18} aria-hidden="true" />{busy ? '轮换中…' : '轮换邀请码'}</button>
    </div>
    {confirmOpen && <div ref={keyboard.container} tabIndex={-1} className="ui-space-confirm-overlay font-ui" role="dialog" aria-modal="true" aria-labelledby="invite-rotate-title">
      <div className="ui-space-confirm mx-auto w-full max-w-md rounded-lg bg-white p-5 shadow-soft safe-bottom">
        <h2 id="invite-rotate-title" className="text-lg font-bold">轮换邀请码</h2>
        <p className="mt-3 break-words text-sm leading-6">空间：<strong>{space.name}</strong></p>
        <p className="mt-3 text-sm leading-6">旧邀请码将立即失效，之后请使用新邀请码邀请成员。已加入的成员不受影响。</p>
        {message && <p className="mt-3 text-sm text-coral" role="alert">{message}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button data-invite-rotate-cancel className="min-h-11 rounded-lg bg-mist px-4 font-semibold" type="button" disabled={busy} onClick={() => { if (!rotating.current) setConfirmOpen(false); }}>取消</button>
          <button className="min-h-11 rounded-lg bg-coral px-4 font-semibold text-white disabled:opacity-50" type="button" disabled={busy} onClick={() => void rotateCode()}>{busy ? '轮换中…' : '确认轮换'}</button>
        </div>
      </div>
    </div>}
    {message && <p className="mt-ui-2 text-ui-meta text-ui-muted" role="status">{message}</p>}
  </section>;
}
