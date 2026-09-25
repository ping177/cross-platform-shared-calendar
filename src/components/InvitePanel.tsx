import { useState } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Space } from '../types';

export function InvitePanel({ space, onSpaceChange }: { space: Space; onSpaceChange: (space: Space) => void }) {
  const [message, setMessage] = useState('');
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(space.invite_code);
      setMessage('邀请码已复制。');
    } catch {
      setMessage('复制失败，请手动复制邀请码。');
    }
  }
  async function rotateCode() {
    setMessage('');
    const { data, error } = await supabase.rpc('rotate_invite_code', { space_id: space.id });
    if (error) { setMessage(error.message); return; }
    onSpaceChange(data as Space);
    setMessage('已生成新邀请码，旧码已失效。');
  }
  return (
    <section className="rounded-lg bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase text-ink/45">邀请码</p>
      <p className="mt-1 break-all text-2xl font-bold tracking-widest text-ink">{space.invite_code}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-mist px-3 text-sm font-semibold" type="button" onClick={() => void copyCode()} aria-label="复制邀请码"><Copy size={18} />复制邀请码</button>
        <button className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-mist px-3 text-sm font-semibold" type="button" onClick={() => void rotateCode()} aria-label="轮换邀请码"><RefreshCw size={18} />轮换邀请码</button>
      </div>
      {message && <p className="mt-2 text-sm text-ink/60" role="status">{message}</p>}
    </section>
  );
}
