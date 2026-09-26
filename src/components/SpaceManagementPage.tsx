import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { memberDisplayName } from '../lib/member';
import { createRequestGuard } from '../lib/request-guard';
import { readSpaceMembers } from '../lib/space-members';
import { listCurrentSpaces } from '../lib/current-spaces';
import { executeSpaceLifecycle, type SpaceLifecycleAction } from '../lib/space-lifecycle';
import { supabase } from '../lib/supabase';
import type { CurrentSpace, Space, SpaceMember } from '../types';
import type { TasksModuleState } from '../lib/space-modules';
import { InvitePanel } from './InvitePanel';
import { SharedSpaceForms } from './SharedSpaceForms';
import { useSpaceTasksModule } from './useSpaceTasksModule';
import { useSpaceReviewModule } from './useSpaceReviewModule';

type DetailProps = {
  space: CurrentSpace;
  members: SpaceMember[];
  moduleState: TasksModuleState;
  moduleError: string;
  moduleBusy: boolean;
  onModuleRetry: () => void;
  onModuleToggle: () => void;
  reviewModuleState?: TasksModuleState;
  reviewModuleError?: string;
  reviewModuleBusy?: boolean;
  onReviewModuleRetry?: () => void;
  onReviewModuleToggle?: () => void;
  onSpaceChange: (space: Space) => void;
  lifecycleControls?: React.ReactNode;
};

export function SpaceDetailContent({ space, members, moduleState, moduleError, moduleBusy, onModuleRetry, onModuleToggle, reviewModuleState = 'loading', reviewModuleError = '', reviewModuleBusy = false, onReviewModuleRetry = () => undefined, onReviewModuleToggle = () => undefined, onSpaceChange, lifecycleControls }: DetailProps) {
  const isOwner = space.membershipRole === 'owner';
  return (
    <div className="space-y-4">
      <section className="rounded-lg bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold text-ink/55">{space.kind === 'personal' ? '个人空间' : '共享空间'}</p>
        <h2 className="mt-1 break-all text-xl font-bold">{space.name}</h2>
      </section>
      {space.kind === 'shared' && (
        <>
          <section className="rounded-lg bg-white p-4 shadow-sm">
            <h2 className="font-bold">空间成员</h2>
            <div className="mt-3 space-y-2">
              {members.map((member) => (
                <div key={member.user_id} className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-mist px-3 py-3">
                  <span className="min-w-0 break-all font-semibold">{memberDisplayName(member)}</span>
                  <span className="shrink-0 text-sm text-ink/60">{member.role === 'owner' ? '所有者' : '成员'}</span>
                </div>
              ))}
            </div>
          </section>
          <InvitePanel space={space} onSpaceChange={onSpaceChange} />
        </>
      )}
      <section className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="font-bold">使用的功能</h2>
        <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-3">
          <span className="font-semibold">任务</span>
          {moduleState === 'loading' || moduleBusy ? <span className="text-sm text-ink/60">载入中…</span>
            : moduleState === 'error' ? <button className="min-h-11 font-semibold text-teal" type="button" onClick={onModuleRetry}>重试</button>
              : isOwner ? <button className="min-h-11 rounded-lg bg-mist px-4 text-sm font-semibold" type="button" role="switch" aria-label="任务模块" aria-checked={moduleState === 'enabled'} onClick={onModuleToggle}>{moduleState === 'enabled' ? '关闭任务模块' : '开启任务模块'}</button>
                : <span className="text-sm text-ink/60">{moduleState === 'enabled' ? '已开启' : '已关闭'}</span>}
        </div>
        {moduleError && <p className="mt-2 text-sm text-coral" role="alert">{moduleError}</p>}
        <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-3">
          <span className="font-semibold">回顾</span>
          {reviewModuleState === 'loading' || reviewModuleBusy ? <span className="text-sm text-ink/60">载入中…</span>
            : reviewModuleState === 'error' ? <button className="min-h-11 font-semibold text-teal" type="button" onClick={onReviewModuleRetry}>重试</button>
              : isOwner ? <button className="min-h-11 rounded-lg bg-mist px-4 text-sm font-semibold" type="button" role="switch" aria-label="回顾模块" aria-checked={reviewModuleState === 'enabled'} onClick={onReviewModuleToggle}>{reviewModuleState === 'enabled' ? '关闭回顾模块' : '开启回顾模块'}</button>
                : <span className="text-sm text-ink/60">{reviewModuleState === 'enabled' ? '已开启' : '已关闭'}</span>}
        </div>
        {reviewModuleError && <p className="mt-2 text-sm text-coral" role="alert">{reviewModuleError}</p>}
      </section>
      {space.kind === 'shared' && lifecycleControls}
    </div>
  );
}

export function SpaceLifecycleControls({ space, members, userId, busy, onBusyChange, onSettled }: {
  space: CurrentSpace;
  members: SpaceMember[];
  userId: string;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onSettled: (action: SpaceLifecycleAction, error?: string) => Promise<void>;
}) {
  const [pending, setPending] = useState<{ action: SpaceLifecycleAction; targetId?: string; label: string } | null>(null);
  const [deleteStep, setDeleteStep] = useState(1);
  const submitting = useRef(false);
  if (space.kind !== 'shared') return null;
  const otherMember = members.find((member) => member.user_id !== userId && member.role === 'member');
  const currentRole = members.find((member) => member.user_id === userId)?.role;
  const owner = space.membershipRole === 'owner' && currentRole === 'owner';
  const ordinaryMember = space.membershipRole === 'member' && currentRole === 'member';
  const open = (action: SpaceLifecycleAction, label: string, targetId?: string) => {
    if (busy || submitting.current) return;
    setDeleteStep(1);
    setPending({ action, label, targetId });
  };
  const confirm = async () => {
    if (!pending || busy || submitting.current) return;
    if (pending.action === 'delete' && deleteStep === 1) { setDeleteStep(2); return; }
    submitting.current = true;
    onBusyChange(true);
    const { action, targetId } = pending;
    let errorMessage: string | undefined;
    try {
      await executeSpaceLifecycle(action, space, members, userId, targetId, {
        listSpaces: () => listCurrentSpaces(userId),
        readMembers: readSpaceMembers,
        rpc: async (method, args) => await supabase.rpc(method, args),
      });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : '操作未完成，请刷新后重试。';
    }
    setPending(null);
    try {
      await onSettled(action, errorMessage);
    } finally {
      submitting.current = false;
      onBusyChange(false);
    }
  };
  return <section className="rounded-lg border border-coral/25 bg-white p-4 shadow-sm" aria-label="危险操作">
    <h2 className="font-bold text-coral">危险操作</h2>
    <p className="mt-1 text-sm leading-6 text-ink/65">这些操作会立即改变空间成员或永久删除数据。</p>
    {!owner && !ordinaryMember && <div className="mt-3 text-sm text-coral" role="alert">空间成员身份已变化。<button className="ml-2 min-h-11 font-semibold underline disabled:opacity-50" type="button" disabled={busy} onClick={() => void onSettled('leave', '空间成员身份已变化，请刷新后重试。')}>刷新空间列表</button></div>}
    <div className="mt-3 flex flex-wrap gap-2">
      {ordinaryMember && <button className="min-h-11 rounded-lg border border-coral/40 px-4 font-semibold text-coral disabled:opacity-50" type="button" disabled={busy} onClick={() => open('leave', '退出空间')}>退出空间</button>}
      {owner && otherMember && <>
        <button className="min-h-11 rounded-lg border border-coral/40 px-4 font-semibold text-coral disabled:opacity-50" type="button" disabled={busy} onClick={() => open('remove', '移除成员', otherMember.user_id)}>移除成员</button>
        <button className="min-h-11 rounded-lg border border-coral/40 px-4 font-semibold text-coral disabled:opacity-50" type="button" disabled={busy} onClick={() => open('transfer', '转让所有者', otherMember.user_id)}>转让所有者</button>
      </>}
      {owner && <button className="min-h-11 rounded-lg bg-coral px-4 font-semibold text-white disabled:opacity-50" type="button" disabled={busy} onClick={() => open('delete', '删除空间')}>删除空间</button>}
    </div>
    {pending && <div className="fixed inset-0 z-40 flex items-end bg-ink/50 p-4 md:items-center" role="dialog" aria-modal="true" aria-labelledby="space-lifecycle-title">
      <div className="mx-auto w-full max-w-md rounded-lg bg-white p-5 shadow-soft safe-bottom">
        <h3 id="space-lifecycle-title" className="text-lg font-bold">确认{pending.label}</h3>
        <p className="mt-3 text-sm leading-6">{pending.action === 'leave' ? '退出后，你在此共享空间的个人日程将删除；共享日程保留。' : pending.action === 'remove' ? '该成员在此共享空间的个人日程将删除；共享日程和任务保留。' : pending.action === 'transfer' ? '转让后，对方成为所有者，你成为普通成员。' : deleteStep === 1 ? '此操作将永久删除整个共享空间及其中的日程和任务，无法恢复。' : '请再次确认：整个共享空间将永久删除，所有成员都将失去访问权。'}</p>
        {(pending.action === 'remove' || pending.action === 'transfer') && <p className="mt-2 break-all text-sm font-semibold">目标成员：{members.find((member) => member.user_id === pending.targetId)?.profiles?.display_name || pending.targetId}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button className="min-h-11 rounded-lg bg-mist px-4 font-semibold" type="button" disabled={busy} onClick={() => setPending(null)}>取消</button>
          <button className="min-h-11 rounded-lg bg-coral px-4 font-semibold text-white disabled:opacity-50" type="button" disabled={busy} onClick={() => void confirm()}>{busy ? '处理中…' : pending.action === 'delete' ? deleteStep === 1 ? '继续确认' : '永久删除空间' : `确认${pending.label}`}</button>
        </div>
      </div>
    </div>}
  </section>;
}

function SpaceDetail({ space, userId, onSpaceChange, busy, onBusyChange, onLifecycleSettled }: { space: CurrentSpace; userId: string; onSpaceChange: (space: Space) => void; busy: boolean; onBusyChange: (busy: boolean) => void; onLifecycleSettled: (action: SpaceLifecycleAction, error?: string) => Promise<void> }) {
  const [members, setMembers] = useState<SpaceMember[]>([]);
  const [membersStatus, setMembersStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const membersGuard = useRef(createRequestGuard());
  const module = useSpaceTasksModule(space);
  const reviewModule = useSpaceReviewModule(space);

  async function loadMembers() {
    const request = membersGuard.current.begin();
    setMembersStatus('loading');
    try {
      const result = await readSpaceMembers(space.id);
      if (membersGuard.current.isCurrent(request)) {
        setMembers(result);
        setMembersStatus('ready');
      }
    } catch {
      if (membersGuard.current.isCurrent(request)) setMembersStatus('error');
    }
  }

  useEffect(() => {
    if (space.kind === 'shared') void loadMembers();
    return () => membersGuard.current.invalidate();
  }, [space.id, space.kind]);

  if (space.kind === 'shared' && membersStatus !== 'ready') {
    return <div role={membersStatus === 'error' ? 'alert' : 'status'}>{membersStatus === 'loading' ? '正在读取空间成员…' : '空间成员读取失败。'}{membersStatus === 'error' && <button className="ml-3 min-h-11 font-semibold text-teal" type="button" onClick={() => void loadMembers()}>重试</button>}</div>;
  }
  return <SpaceDetailContent space={space} members={members} moduleState={module.state} moduleError={module.error} moduleBusy={module.busy} onModuleRetry={() => void module.retry()} onModuleToggle={() => void module.toggle()} reviewModuleState={reviewModule.state} reviewModuleError={reviewModule.error} reviewModuleBusy={reviewModule.busy} onReviewModuleRetry={() => void reviewModule.retry()} onReviewModuleToggle={() => void reviewModule.toggle()} onSpaceChange={onSpaceChange} lifecycleControls={<SpaceLifecycleControls space={space} members={members} userId={userId} busy={busy} onBusyChange={onBusyChange} onSettled={onLifecycleSettled} />} />;
}

export function SpaceManagementPage({ spaces, selectedSpaceId, userId, detailRevision, onSelect, onBack, onReady, onSpaceChange, onLifecycleSettled, busy, onBusyChange }: {
  spaces: CurrentSpace[];
  selectedSpaceId: string | null;
  userId: string;
  detailRevision: number;
  onSelect: (spaceId: string) => void;
  onBack: () => void;
  onReady: (spaceId: string) => Promise<boolean>;
  onSpaceChange: (space: Space) => void;
  onLifecycleSettled: (action: SpaceLifecycleAction, error?: string) => Promise<void>;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const selected = spaces.find((space) => space.id === selectedSpaceId) ?? null;
  const personal = spaces.filter((space) => space.kind === 'personal');
  const shared = spaces.filter((space) => space.kind === 'shared');
  const sharedNameCounts = new Map<string, number>();
  for (const space of shared) sharedNameCounts.set(space.name, (sharedNameCounts.get(space.name) ?? 0) + 1);
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-4 safe-bottom">
      <header className="flex min-h-11 items-center gap-3">
        <button className="inline-flex min-h-11 items-center gap-1 font-semibold text-teal disabled:opacity-50" type="button" onClick={onBack} disabled={busy}><ChevronLeft size={18} />{selected ? '空间管理' : '我的'}</button>
        <h1 className="min-w-0 break-all text-xl font-bold">{selected ? selected.name : '空间管理'}</h1>
      </header>
      {selected ? <div className="mt-4"><SpaceDetail key={`${selected.id}:${selected.membershipRole}:${detailRevision}`} space={selected} userId={userId} onSpaceChange={onSpaceChange} busy={busy} onBusyChange={onBusyChange} onLifecycleSettled={onLifecycleSettled} /></div> : (
        <>
          <section className="mt-4">
            <h2 className="text-sm font-bold text-ink/60">个人空间</h2>
            <div className="mt-2 space-y-2">{personal.map((space) => <SpaceRow key={space.id} space={space} onSelect={onSelect} busy={busy} />)}</div>
            {personal.length === 0 && <p className="mt-2 text-sm text-ink/60">个人空间暂不可用，请重试初始化。</p>}
          </section>
          <section className="mt-5">
            <h2 className="text-sm font-bold text-ink/60">共享空间</h2>
            <div className="mt-2 space-y-2">{shared.map((space, index) => <SpaceRow key={space.id} space={space} onSelect={onSelect} busy={busy} secondary={(sharedNameCounts.get(space.name) ?? 0) > 1 ? `共享空间 ${index + 1}` : undefined} />)}</div>
            {shared.length === 0 && <p className="mt-2 text-sm text-ink/60">暂无共享空间</p>}
          </section>
          <SharedSpaceForms onReady={onReady} busy={busy} onBusyChange={onBusyChange} />
        </>
      )}
    </main>
  );
}

function SpaceRow({ space, onSelect, busy, secondary }: { space: CurrentSpace; onSelect: (spaceId: string) => void; busy: boolean; secondary?: string }) {
  return <button className="flex min-h-14 w-full min-w-0 items-center justify-between gap-3 rounded-lg bg-white px-4 text-left shadow-sm disabled:opacity-60" type="button" data-space-id={space.id} onClick={() => onSelect(space.id)} disabled={busy}>
    <span className="min-w-0"><span className="block break-all font-semibold">{space.kind === 'personal' ? '我的空间' : space.name}</span>{secondary && <span className="block text-xs text-ink/55">{secondary}</span>}</span>
    <ChevronRight size={18} className="shrink-0 text-ink/45" aria-hidden="true" />
  </button>;
}
