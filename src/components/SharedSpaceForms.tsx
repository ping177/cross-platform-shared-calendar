import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, LogIn } from 'lucide-react';
import { completeSharedSpaceAction } from '../lib/space-selection';
import { supabase } from '../lib/supabase';

const initialSpaceName = '我们的日历';
type FormMode = 'create' | 'join';

export function SharedSpaceForms({ onReady, busy, onBusyChange }: {
  onReady: (spaceId: string) => Promise<boolean>;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const [spaceName, setSpaceName] = useState(initialSpaceName);
  const [inviteCode, setInviteCode] = useState('');
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<FormMode | null>(null);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const submittedSpaceId = useRef<string | null>(null);
  const submitting = useRef(false);
  const composing = useRef(false);
  const view = useRef<HTMLDivElement>(null);
  const dirty = mode === 'create' ? Boolean(spaceName.trim()) && spaceName !== initialSpaceName : mode === 'join' && Boolean(inviteCode.trim());

  function close() {
    if (busy || submitting.current) return;
    if ((dirty || submittedSpaceId.current) && !window.confirm(submittedSpaceId.current ? '空间操作已提交，但列表尚未确认。确定返回空间管理吗？' : '有未提交的空间信息，确定放弃并返回空间管理吗？')) return;
    submittedSpaceId.current = null;
    setNeedsRefresh(false);
    if (mode === 'create') setSpaceName(initialSpaceName);
    if (mode === 'join') setInviteCode('');
    setMessage('');
    setMode(null);
  }
  const current = useRef({ close, dirty });
  current.current = { close, dirty };
  useEffect(() => {
    if (!mode) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = view.current;
    root?.querySelector<HTMLInputElement>('input')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.isComposing && event.keyCode !== 229 && !composing.current) { event.preventDefault(); current.current.close(); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(root?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)') ?? []);
      if (!controls.length) { event.preventDefault(); root?.focus(); return; }
      const first = controls[0], last = controls[controls.length - 1];
      if (!root?.contains(document.activeElement)) { event.preventDefault(); first?.focus(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const beforeUnload = (event: BeforeUnloadEvent) => { if (current.current.dirty || submitting.current || submittedSpaceId.current) { event.preventDefault(); event.returnValue = ''; } };
    document.addEventListener('keydown', keydown);
    window.addEventListener('beforeunload', beforeUnload);
    return () => { document.removeEventListener('keydown', keydown); window.removeEventListener('beforeunload', beforeUnload); previous?.focus(); };
  }, [mode]);

  async function submit(action: FormMode, value: string) {
    if (busy || submitting.current || composing.current) return;
    submitting.current = true;
    onBusyChange(true);
    setMessage('');
    try {
      // After a committed RPC, only retry canonical refresh for its returned ID.
      const ready = submittedSpaceId.current ? await onReady(submittedSpaceId.current) : await completeSharedSpaceAction(action, value, async (method, args) => await supabase.rpc(method, args), async (spaceId) => { submittedSpaceId.current = spaceId; setNeedsRefresh(true); return onReady(spaceId); });
      if (!ready) {
        setMessage(action === 'create' ? '空间已创建，但成员列表暂未刷新，请重试。' : '已加入空间，但成员列表暂未刷新，请重试。');
      } else { submittedSpaceId.current = null; setNeedsRefresh(false); setMode(null); }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作失败，请稍后再试。');
    } finally {
      submitting.current = false;
      onBusyChange(false);
    }
  }

  return <div className="ui-space-create-entries">
    <p className="text-ui-meta text-ui-muted">创建两人共享空间，或输入邀请码加入。</p>
    <button className="ui-space-entry ui-focus" type="button" aria-label="创建共享空间" disabled={busy || mode !== null} onClick={() => { if (!mode && !busy && !submitting.current) setMode('create'); }}><Plus size={22} aria-hidden="true" /><span><strong>创建共享空间</strong><small>和朋友、家人一起使用</small></span><ChevronRight size={18} aria-hidden="true" /></button>
    <button className="ui-space-entry ui-focus" type="button" aria-label="加入空间" disabled={busy || mode !== null} onClick={() => { if (!mode && !busy && !submitting.current) setMode('join'); }}><LogIn size={22} aria-hidden="true" /><span><strong>加入空间</strong><small>输入邀请码加入已有空间</small></span><ChevronRight size={18} aria-hidden="true" /></button>
    {mode && <div ref={view} tabIndex={-1} className="ui-space-form-view font-ui" role="dialog" aria-modal="true" aria-labelledby="shared-space-form-title">
      <form className="ui-space-form" onSubmit={(event) => { event.preventDefault(); void submit(mode, mode === 'create' ? spaceName : inviteCode); }} onKeyDownCapture={(event) => { if (event.key === 'Enter' && (composing.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)) event.preventDefault(); }}>
        <header className="ui-space-form-header">
          <button className="ui-focus" type="button" aria-label="返回空间管理" disabled={busy} onClick={close}><ChevronLeft size={20} aria-hidden="true" /></button>
          <h2 id="shared-space-form-title" className="text-ui-bar">{mode === 'create' ? '创建共享空间' : '加入空间'}</h2>
          <button className="ui-focus text-ui-accent font-ui-semibold" type="submit" disabled={busy}>{busy ? '处理中…' : needsRefresh ? '重试刷新' : mode === 'create' ? '创建' : '加入'}</button>
        </header>
        <div className="ui-space-form-body">
          <p className="text-ui-meta text-ui-muted">{mode === 'create' ? '创建后，可通过邀请码邀请另一位成员加入。' : '输入空间邀请码，加入已有的共享空间。'}</p>
          <label className="ui-space-field-label" htmlFor={mode === 'create' ? 'shared-space-name' : 'shared-invite-code'}>{mode === 'create' ? '空间名称' : '邀请码'}</label>
          <input id={mode === 'create' ? 'shared-space-name' : 'shared-invite-code'} className={mode === 'join' ? 'ui-space-input uppercase tracking-wide' : 'ui-space-input'} value={mode === 'create' ? spaceName : inviteCode} disabled={busy || needsRefresh} onChange={(event) => mode === 'create' ? setSpaceName(event.target.value) : setInviteCode(event.target.value)} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} placeholder={mode === 'create' ? '空间名称' : '输入邀请码'} required />
          {message && <p className="mt-ui-4 text-ui-meta text-ui-danger" role="alert">{message}</p>}
        </div>
      </form>
    </div>}
  </div>;
}
