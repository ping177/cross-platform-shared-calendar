import { Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// Remount feedback when either identity or the Auth email changes.
export function LoginEmail({ userId, email }: { userId: string; email?: string }) {
  return <EmailValue key={JSON.stringify([userId, email])} email={email} />;
}

function EmailValue({ email }: { email?: string }) {
  const [message, setMessage] = useState('');
  const mounted = useRef(false);
  const copying = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function copy() {
    if (!email || copying.current) return;
    copying.current = true;
    try {
      await navigator.clipboard.writeText(email);
      if (mounted.current) setMessage('邮箱已复制');
    } catch {
      if (mounted.current) setMessage('复制失败，请长按邮箱手动复制');
    } finally { copying.current = false; }
  }
  return <section className="mt-ui-4 min-w-0 rounded-ui-group border border-ui-border bg-ui-surface p-ui-4" aria-label="账号信息">
    <div className="flex min-w-0 items-center justify-between gap-ui-3">
      <h2 className="shrink-0 text-ui-meta text-ui-muted">登录邮箱</h2>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-ui-1">
        <p className="min-w-0 select-text break-all text-right text-ui-meta text-ui-text">{email || '当前账号未提供邮箱'}</p>
        {email && <button className="ui-focus inline-flex min-h-ui-touch min-w-11 shrink-0 items-center justify-center rounded-ui-control text-ui-accent" type="button" onClick={() => void copy()} aria-label="复制登录邮箱"><Copy size={16} aria-hidden="true" /></button>}
      </div>
    </div>
    {message && <p className="mt-ui-2 text-ui-meta text-ui-muted" role="status">{message}</p>}
  </section>;
}
