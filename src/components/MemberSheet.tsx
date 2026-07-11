import { useState } from 'react';
import { Pencil, X } from 'lucide-react';
import { memberDisplayName, memberDisplayNameMaxLength } from '../lib/member';
import { supabase } from '../lib/supabase';
import type { SpaceMember } from '../types';

type MemberSheetProps = {
  members: SpaceMember[];
  userId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export function MemberSheet({ members, userId, onClose, onSaved }: MemberSheetProps) {
  const currentMember = members.find((member) => member.user_id === userId);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(currentMember?.profiles?.display_name ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function cancelEditing() {
    setDisplayName(currentMember?.profiles?.display_name ?? '');
    setError('');
    setEditing(false);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();

    const trimmedName = displayName.trim();

    if (!trimmedName) {
      setError('名称不能为空或仅包含空白字符。');
      return;
    }

    if (trimmedName.length > memberDisplayNameMaxLength) {
      setError(`名称不能超过 ${memberDisplayNameMaxLength} 个字符。`);
      return;
    }

    const normalizedName = trimmedName;

    setBusy(true);
    setError('');

    const { data, error: updateError } = await supabase
      .from('profiles')
      .update({ display_name: normalizedName })
      .eq('id', userId)
      .select('id');

    setBusy(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    if (!data?.length) {
      setError('未能更新名称，请重新登录后再试。');
      return;
    }

    await onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-ink/35 md:items-center md:px-4 md:py-6">
      <section className="mx-auto w-full max-w-md rounded-t-2xl bg-white p-5 shadow-soft safe-bottom md:rounded-lg" role="dialog" aria-modal="true" aria-labelledby="members-title">
        <div className="flex items-center justify-between">
          <h2 id="members-title" className="text-xl font-bold">空间成员</h2>
          <button className="grid h-10 w-10 place-items-center rounded-lg bg-mist" type="button" onClick={onClose} aria-label="关闭成员列表">
            <X size={20} />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {members.map((member) => {
            const isCurrentUser = member.user_id === userId;

            return (
              <div key={member.user_id} className="rounded-lg bg-mist px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate font-semibold text-ink">
                    {memberDisplayName(member)}{isCurrentUser ? '（我）' : ''}
                  </p>
                  {isCurrentUser && !editing && (
                    <button className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-teal" type="button" onClick={() => setEditing(true)}>
                      <Pencil size={15} />
                      编辑我的名称
                    </button>
                  )}
                </div>

                {isCurrentUser && editing && (
                  <form className="mt-3" onSubmit={save}>
                    <label className="block text-sm font-semibold text-ink/70" htmlFor="display-name">
                      显示名称
                    </label>
                    <input
                      id="display-name"
                      className="mt-2 w-full rounded-lg border border-ink/15 bg-white px-4 py-3 outline-none focus:border-teal"
                      value={displayName}
                      autoComplete="nickname"
                      onChange={(inputEvent) => {
                        setDisplayName(inputEvent.target.value);
                        setError('');
                      }}
                    />
                    <p className="mt-2 text-xs text-ink/50">1–{memberDisplayNameMaxLength} 个字符，保存时会自动去除首尾空格。</p>
                    {error && <p className="mt-3 rounded-lg bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p>}
                    <div className="mt-3 flex gap-3">
                      <button className="h-11 flex-1 rounded-lg bg-mist font-semibold text-ink" type="button" onClick={cancelEditing} disabled={busy}>
                        取消
                      </button>
                      <button className="h-11 flex-1 rounded-lg bg-teal font-semibold text-white disabled:opacity-60" type="submit" disabled={busy}>
                        {busy ? '保存中' : '保存'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
