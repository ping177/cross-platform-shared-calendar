import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { canRenameSpace, renameSpace, spaceRenameError } from '../lib/space-rename';
import { supabase } from '../lib/supabase';
import type { CurrentSpace, Space } from '../types';

export function SpaceNameEditor({ space, userId, busy, onBusyChange, onSpaceChange }: {
  space: CurrentSpace;
  userId: string;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onSpaceChange: (space: Space) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(space.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const submitting = useRef(false);
  const composing = useRef(false);
  const mounted = useRef(true);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  const live = useRef({ space, userId, busy });
  live.current = { space, userId, busy };
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; if (submitting.current) onBusyChange(false); };
  }, []);
  useEffect(() => {
    if (editing) input.current?.focus();
    else if (wasEditing.current) trigger.current?.focus();
    wasEditing.current = editing;
  }, [editing]);
  const canEdit = canRenameSpace(space, userId);

  function cancel() {
    if (submitting.current || live.current.busy) return;
    setEditing(false);
    setDraft(live.current.space.name);
    setError('');
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current || live.current.busy || composing.current) return;
    const current = live.current;
    const isCurrent = () => mounted.current && live.current.space.id === current.space.id && live.current.userId === current.userId;
    submitting.current = true;
    setSaving(true);
    onBusyChange(true);
    setError('');
    setMessage('');
    try {
      const updated = await renameSpace(supabase, current.space, current.userId, draft);
      if (!isCurrent()) return;
      if (updated) {
        onSpaceChange(updated);
        setDraft(updated.name);
        setMessage('空间名称已更新。');
      }
      setEditing(false);
    } catch (failure) {
      if (isCurrent()) setError(spaceRenameError(failure));
    } finally {
      submitting.current = false;
      if (isCurrent()) { setSaving(false); onBusyChange(false); }
    }
  }
  const disabled = busy || saving;
  const actionClass = 'ui-focus min-h-11 rounded-ui-control px-ui-3 text-ui-meta font-ui-semibold disabled:opacity-50';
  return <div className="mt-ui-1 min-w-0">
    <div className="flex items-center gap-ui-2">
      <h2 className="min-w-0 flex-1 break-words text-ui-bar">{space.name}</h2>
      {canEdit && !editing && <button ref={trigger} className="ui-focus flex min-h-11 w-11 shrink-0 items-center justify-center rounded-ui-control text-ui-accent disabled:opacity-50" aria-label="修改名称" title="修改名称" type="button" disabled={disabled} onClick={() => {
      if (submitting.current || live.current.busy) return;
      setDraft(live.current.space.name); setError(''); setMessage(''); setEditing(true);
    }}><Pencil size={16} aria-hidden="true" /></button>}
    </div>
    {canEdit && editing && <form className="mt-ui-2" onSubmit={(event) => void save(event)} aria-busy={saving} onKeyDownCapture={(event) => {
      const ime = composing.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229;
      if (event.key === 'Enter' && ime) event.preventDefault();
      if (event.key === 'Escape' && !ime) { event.preventDefault(); cancel(); }
    }}>
      <label className="ui-space-field-label" htmlFor="space-rename-name">空间名称</label>
      <input ref={input} id="space-rename-name" className="ui-space-input" value={draft} required disabled={disabled}
        onChange={(event) => setDraft(event.target.value)} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} aria-describedby="space-rename-help" />
      <p id="space-rename-help" className="mt-ui-1 text-ui-label text-ui-muted">1–80 个字符；不会改变空间成员或现有内容。</p>
      <div className="mt-ui-2 flex flex-wrap gap-ui-2">
        <button className={`${actionClass} text-ui-accent`} type="submit" disabled={disabled || draft.trim() === space.name.trim()}>{saving ? '保存中…' : '保存名称'}</button>
        <button className={`${actionClass} text-ui-muted`} type="button" disabled={disabled} onClick={cancel}>取消</button>
      </div>
    </form>}
    {error && <p className="mt-ui-2 text-ui-meta text-ui-danger" role="alert">{error}</p>}
    {message && <p className="mt-ui-2 text-ui-meta text-ui-accent" role="status">{message}</p>}
  </div>;
}
