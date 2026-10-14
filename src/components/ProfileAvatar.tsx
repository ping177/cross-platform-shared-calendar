import { useEffect, useRef, useState } from 'react';
import { UserRound } from 'lucide-react';
import { avatarBucket, avatarPreset, avatarSignedSeconds, isAvatarPath } from '../lib/avatar';
import { supabase } from '../lib/supabase';

export function ProfileAvatar({ userId, preset, path, size = 48 }: { userId: string; preset?: string | null; path?: string | null; size?: 32 | 48 | 64 }) {
  const [photo, setPhoto] = useState<{ path: string; url: string } | null>(null);
  const retry = useRef<() => void>(() => undefined);
  const validPath = isAvatarPath(path, userId) ? path! : null;
  const selected = avatarPreset(preset);
  useEffect(() => {
    if (!validPath) { setPhoto(null); return; }
    let active = true, pending = false;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = (seconds: number) => { clearTimeout(timer); timer = setTimeout(() => void refresh(), seconds * 1000); };
    async function refresh() {
      if (!active || pending) return;
      pending = true;
      try {
        const { data, error } = await supabase.storage.from(avatarBucket).createSignedUrl(validPath!, avatarSignedSeconds);
        if (!active) return;
        if (error || !data?.signedUrl) throw new Error('Avatar unavailable');
        setPhoto({ path: validPath!, url: data.signedUrl }); schedule(avatarSignedSeconds - 60);
      } catch {
        if (active) { setPhoto(null); schedule(30); }
      } finally { pending = false; }
    }
    const foreground = () => { if (document.visibilityState === 'visible') void refresh(); };
    retry.current = () => { if (active) { setPhoto(null); schedule(30); } };
    void refresh();
    document.addEventListener('visibilitychange', foreground); window.addEventListener('focus', foreground);
    return () => { active = false; clearTimeout(timer); retry.current = () => undefined; document.removeEventListener('visibilitychange', foreground); window.removeEventListener('focus', foreground); };
  }, [validPath]);
  const src = selected ? `/avatars/${selected.id}.svg` : photo?.path === validPath ? photo?.url : null;
  return <span className={`ui-profile-avatar ui-profile-avatar-${size}`} aria-hidden="true">
    {src ? <img src={src} alt="" width={size} height={size} onError={() => { if (validPath) retry.current(); }} /> : <UserRound size={size === 32 ? 18 : 24} />}
  </span>;
}
