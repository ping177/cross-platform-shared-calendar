import { X } from 'lucide-react';
import { memberDisplayName } from '../lib/member';
import type { SpaceMember } from '../types';

type MemberSheetProps = {
  members: SpaceMember[];
  userId: string;
  onClose: () => void;
};

export function MemberSheet({ members, userId, onClose }: MemberSheetProps) {
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
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
