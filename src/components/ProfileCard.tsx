import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { memberDisplayNameMaxLength } from '../lib/member';
import { saveProfileName, type Profile } from '../lib/profile';
import { supabase } from '../lib/supabase';
import { ProfileAvatar } from './ProfileAvatar';
import { AvatarPicker } from './AvatarPicker';

export function ProfileCard({ userId, profile, loading, onProfileChange }: {
  userId: string; profile: Profile | null; loading: boolean; onProfileChange: (profile: Profile) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const submitting = useRef(false);
  const composing = useRef(false);
  const mounted = useRef(true);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  const live = useRef({ userId, profile });
  live.current = { userId, profile };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (editing) input.current?.focus();
    else if (wasEditing.current) trigger.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  function cancel() {
    if (submitting.current) return;
    setEditing(false); setDraft(profile?.display_name ?? ''); setError('');
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current || composing.current || !profile) return;
    const current = live.current;
    const isCurrent = () => mounted.current && live.current.userId === current.userId;
    submitting.current = true; setSaving(true); setError(''); setMessage('');
    try {
      const name = await saveProfileName(supabase, userId, draft, profile.display_name ?? '');
      if (!isCurrent()) return;
      if (name !== null) { onProfileChange({ ...live.current.profile!, display_name: name }); setMessage('名称已更新。'); }
      setEditing(false);
    } catch (failure) {
      if (isCurrent()) setError(failure instanceof Error ? failure.message : '保存失败，请重试。');
    } finally {
      submitting.current = false;
      if (isCurrent()) setSaving(false);
    }
  }
  const disabled = loading || !profile || saving;
  const actionClass = 'ui-focus min-h-11 rounded-ui-control px-ui-3 text-ui-meta font-ui-semibold disabled:opacity-50';
  return <><section className="ui-my-profile ui-profile-card" aria-label="个人资料" aria-busy={loading || saving}>
    <div className="ui-profile-row">
      <button className="ui-profile-avatar-button ui-focus" type="button" aria-label="更换头像" disabled={disabled || editing} onClick={() => { if (!submitting.current && !disabled && !editing) { setMessage(''); setShowAvatarPicker(true); } }}><ProfileAvatar userId={userId} preset={profile?.avatar_preset} path={profile?.avatar_path} /></button>
      {editing ? <form className="ui-profile-name-form" onSubmit={(event) => void save(event)} onKeyDownCapture={(event) => {
        const ime = composing.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229;
        if (event.key === 'Enter' && ime) event.preventDefault();
        if (event.key === 'Escape' && !ime) { event.preventDefault(); cancel(); }
      }}>
        <label className="sr-only" htmlFor="my-display-name">显示名称</label>
        <input ref={input} id="my-display-name" className="ui-space-input" value={draft} onChange={(event) => setDraft(event.target.value)} autoComplete="nickname" required disabled={disabled} maxLength={memberDisplayNameMaxLength}
          onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} aria-describedby={error ? 'profile-name-error' : undefined} />
        <div className="ui-profile-name-actions">
          <button className={`${actionClass} text-ui-accent`} type="submit" disabled={disabled || draft.trim() === (profile?.display_name ?? '')}>{saving ? '保存中…' : '保存'}</button>
          <button className={`${actionClass} text-ui-muted`} type="button" disabled={disabled} onClick={cancel}>取消</button>
        </div>
      </form> : <>
        <h2 className="ui-profile-name text-ui-bar" title={profile?.display_name ?? undefined}>{loading ? '正在读取资料…' : profile?.display_name || '我的资料'}</h2>
        <button ref={trigger} className="ui-focus flex min-h-11 w-11 shrink-0 items-center justify-center rounded-ui-control text-ui-accent disabled:opacity-50" aria-label="修改显示名称" type="button" disabled={disabled} onClick={() => {
          if (submitting.current || disabled) return;
          setDraft(profile?.display_name ?? ''); setError(''); setMessage(''); setEditing(true);
        }}><Pencil size={16} aria-hidden="true" /></button>
      </>}
    </div>
    {error && <p id="profile-name-error" className="mt-ui-2 text-ui-meta text-ui-danger" role="alert">{error}</p>}
    {message && <p className="sr-only" role="status">{message}</p>}
  </section>{showAvatarPicker && profile && <AvatarPicker key={userId} userId={userId} profile={profile} onSaved={(updated) => { onProfileChange(updated); setMessage('头像已更新。'); }} onClose={() => { setShowAvatarPicker(false); trigger.current?.focus(); }} />}</>;
}
