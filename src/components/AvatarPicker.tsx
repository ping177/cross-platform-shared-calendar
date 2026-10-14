import { useEffect, useRef, useState } from 'react';
import { Camera, X, Check } from 'lucide-react';
import { avatarPresets, prepareAvatarPhoto } from '../lib/avatar';
import { AvatarSaveError, changeAvatar, cleanupAvatarFiles, findUnusedAvatarPhotos, type AvatarChoice } from '../lib/avatar-data';
import type { Profile } from '../lib/profile';
import { supabase } from '../lib/supabase';
import { ProfileAvatar } from './ProfileAvatar';

export function AvatarPicker({ userId, profile, onSaved, onClose }: { userId: string; profile: Profile; onSaved: (profile: Profile) => void; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState('');
  const [source, setSource] = useState<File | null>(null);
  const [cleanupPaths, setCleanupPaths] = useState<string[]>([]);
  const lock = useRef(false);
  const mounted = useRef(true);
  const dialog = useRef<HTMLElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let active = true;
    void findUnusedAvatarPhotos(supabase, userId).then((paths) => {
      if (active) setCleanupPaths((current) => [...new Set([...current, ...paths])]);
    }).catch(() => { /* Avatar editing remains usable if the optional old-file scan fails. */ });
    return () => { active = false; };
  }, [userId]);
  useEffect(() => {
    mounted.current = true;
    const opener = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; close.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); if (!lock.current) onClose(); }
      if (event.key !== 'Tab' || !dialog.current) return;
      const elements = Array.from(dialog.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled):not([type="file"]), [tabindex="0"]'));
      if (!elements.length) { event.preventDefault(); dialog.current.focus(); return; }
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.current.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.current.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { mounted.current = false; document.removeEventListener('keydown', keydown); document.body.style.overflow = overflow; opener?.focus(); };
  }, []);
  useEffect(() => {
    if (!photo) { setPreview(''); return; }
    const url = URL.createObjectURL(photo); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  async function prepare(file: File) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setPhoto(null); setSource(file);
    try { const processed = await prepareAvatarPhoto(file); if (mounted.current) setPhoto(processed); }
    catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : '图片处理失败，请重试。'); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  async function save(choice: AvatarChoice) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const result = await changeAvatar(supabase, userId, choice);
      const remaining = await cleanupAvatarFiles(supabase, userId, cleanupPaths);
      if (!mounted.current) return;
      onSaved(result.profile); setCleanupPaths([...new Set([...remaining, ...result.cleanupPaths])]);
      if (!remaining.length && !result.cleanupPaths.length) onClose();
      else { setPhoto(null); setSource(null); }
    } catch (failure) {
      if (!mounted.current) return;
      setError(failure instanceof Error ? failure.message : '头像保存失败，请重试。');
      if (failure instanceof AvatarSaveError) setCleanupPaths((paths) => [...new Set([...paths, ...failure.cleanupPaths])]);
    } finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  async function retryCleanup() {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    const remaining = await cleanupAvatarFiles(supabase, userId, cleanupPaths);
    lock.current = false;
    if (mounted.current) { setCleanupPaths(remaining); setBusy(false); }
  }
  return <div className="ui-avatar-overlay" onClick={(event) => { if (event.target === event.currentTarget && !lock.current) onClose(); }}>
    <section ref={dialog} className="ui-avatar-sheet" role="dialog" aria-modal="true" aria-labelledby="avatar-title" aria-busy={busy} tabIndex={-1}>
      <header className="ui-avatar-header"><h2 id="avatar-title" className="text-ui-section">更换头像</h2><button ref={close} className="ui-focus ui-avatar-close" type="button" aria-label="关闭头像选择" disabled={busy} onClick={() => { if (!lock.current) onClose(); }}><X size={20} aria-hidden="true" /></button></header>
      <div className="ui-avatar-content">
        <input ref={fileInput} className="hidden" type="file" accept="image/jpeg,image/png,image/webp" aria-label="选择头像照片" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void prepare(file); }} />
        <button className="ui-avatar-upload ui-focus" type="button" disabled={busy} onClick={() => { if (!lock.current) fileInput.current?.click(); }}><Camera size={20} aria-hidden="true" /><span><strong>上传自己的照片</strong><small>JPEG / PNG / WebP · 最大 10 MB</small></span></button>
        {photo && <div className="ui-avatar-photo-preview"><img src={preview || undefined} alt="居中裁剪后的头像预览" width={64} height={64} /><div><p className="text-ui-meta text-ui-muted">照片将以圆形显示</p><div className="flex gap-ui-2"><button className="ui-focus min-h-11 text-ui-meta text-ui-accent" type="button" disabled={busy} onClick={() => void save({ photo })}>使用这张照片</button><button className="ui-focus min-h-11 px-ui-2 text-ui-meta text-ui-muted" type="button" disabled={busy} onClick={() => { setPhoto(null); setSource(null); setError(''); }}>取消</button></div></div></div>}
        {error && <p className="mt-ui-3 text-ui-meta text-ui-danger" role="alert">{error}</p>}
        {error && source && !photo && <button className="ui-focus min-h-11 text-ui-meta text-ui-accent" type="button" disabled={busy} onClick={() => void prepare(source)}>重试处理照片</button>}
        {cleanupPaths.length > 0 && <div className="mt-ui-3 text-ui-meta text-ui-muted" role="status"><p>部分旧照片未清理，当前头像不受影响。</p><button className="ui-focus min-h-11 text-ui-accent" type="button" disabled={busy} onClick={() => void retryCleanup()}>重试清理旧照片</button></div>}
        <h3 className="ui-avatar-presets-title text-ui-meta text-ui-muted">或选一幅插画</h3>
        <div className="ui-avatar-grid">{avatarPresets.map((preset) => {
          const selected = profile.avatar_preset === preset.id && !profile.avatar_path;
          return <button key={preset.id} className="ui-avatar-preset ui-focus" type="button" aria-label={`使用${preset.label}头像`} aria-pressed={selected} disabled={busy} onClick={() => void save({ preset: preset.id })}>
            <ProfileAvatar userId={userId} preset={preset.id} size={48} /><span className="text-ui-label text-ui-muted">{preset.label}</span>{selected && <Check className="ui-avatar-check" size={12} aria-hidden="true" />}
          </button>;
        })}</div>
        {busy && <p className="mt-ui-2 text-ui-meta text-ui-accent" role="status">正在处理，请稍候…</p>}
        <button className="ui-avatar-reset ui-focus" type="button" disabled={busy || (!profile.avatar_path && !profile.avatar_preset)} onClick={() => void save({ preset: null })}>恢复默认头像</button>
      </div>
    </section>
  </div>;
}
