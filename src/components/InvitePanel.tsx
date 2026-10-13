import { useEffect, useRef, useState } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Space } from '../types';

export function InvitePanel({ space, onSpaceChange }: { space: Space; onSpaceChange: (space: Space) => void }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const rotating = useRef(false);
  const mounted = useRef(true);
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
    if (rotating.current) return;
    rotating.current = true;
    setBusy(true);
    setMessage('');
    try {
      const { data, error } = await supabase.rpc('rotate_invite_code', { space_id: space.id });
      if (!mounted.current) return;
      if (error) { setMessage(error.message); return; }
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
      <button className="ui-space-secondary ui-focus" type="button" disabled={busy} onClick={() => void rotateCode()} aria-label="轮换邀请码"><RefreshCw size={18} aria-hidden="true" />{busy ? '轮换中…' : '轮换邀请码'}</button>
    </div>
    {message && <p className="mt-ui-2 text-ui-meta text-ui-muted" role="status">{message}</p>}
  </section>;
}
