import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, UserRound, Users } from 'lucide-react';
import { memberDisplayName } from '../lib/member';
import { createRequestGuard } from '../lib/request-guard';
import { readSpaceMembers } from '../lib/space-members';
import { listCurrentSpaces } from '../lib/current-spaces';
import { executeSpaceLifecycle, type SpaceLifecycleAction } from '../lib/space-lifecycle';
import { supabase } from '../lib/supabase';
import type { CurrentSpace, Space, SpaceMember } from '../types';
import type { TasksModuleState } from '../lib/space-modules';
import type { ModuleKey } from '../lib/module-availability';
import { InvitePanel } from './InvitePanel';
import { SharedSpaceForms } from './SharedSpaceForms';
import { SpaceNameEditor } from './SpaceNameEditor';
import { useSpaceTasksModule } from './useSpaceTasksModule';
import { useSpaceReviewModule } from './useSpaceReviewModule';
import { useSpaceImportantDatesModule } from './useSpaceImportantDatesModule';
import { useSpaceListsModule } from './useSpaceListsModule';

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
  listsModuleState?: TasksModuleState;
  listsModuleError?: string;
  listsModuleBusy?: boolean;
  onListsModuleRetry?: () => void;
  onListsModuleToggle?: () => void;
  importantDatesModuleState?: TasksModuleState;
  importantDatesModuleError?: string;
  importantDatesModuleBusy?: boolean;
  onImportantDatesModuleRetry?: () => void;
  onImportantDatesModuleToggle?: () => void;
  onSpaceChange: (space: Space) => void;
  lifecycleControls?: React.ReactNode;
  nameEditor?: React.ReactNode;
};

export function SpaceDetailContent({ space, members, moduleState, moduleError, moduleBusy, onModuleRetry, onModuleToggle, reviewModuleState = 'loading', reviewModuleError = '', reviewModuleBusy = false, onReviewModuleRetry = () => undefined, onReviewModuleToggle = () => undefined, listsModuleState = 'disabled', listsModuleError = '', listsModuleBusy = false, onListsModuleRetry = () => undefined, onListsModuleToggle = () => undefined, importantDatesModuleState = 'loading', importantDatesModuleError = '', importantDatesModuleBusy = false, onImportantDatesModuleRetry = () => undefined, onImportantDatesModuleToggle = () => undefined, onSpaceChange, lifecycleControls, nameEditor }: DetailProps) {
  const isOwner = space.membershipRole === 'owner';
  return <div className="ui-space-detail-groups">
    <section className="ui-space-group">
      <div className="ui-space-identity">
        {space.kind === 'personal' ? <UserRound size={24} aria-hidden="true" /> : <Users size={24} aria-hidden="true" />}
        <div className="min-w-0 flex-1"><p className="text-ui-label text-ui-muted">{space.kind === 'personal' ? '个人空间' : '共享空间'}</p>{nameEditor ?? <h2 className="mt-ui-1 break-words text-ui-bar">{space.name}</h2>}</div>
      </div>
    </section>
    {space.kind === 'shared' && <>
      <section className="ui-space-group">
        <h2 className="text-ui-list font-ui-semibold">空间成员 · {members.length}</h2>
        <div className="mt-ui-3">{members.map((member) => <div key={member.user_id} className="ui-space-member-row"><UserRound size={18} aria-hidden="true" /><span className="min-w-0 flex-1 break-words text-ui-body">{memberDisplayName(member)}</span><span className="shrink-0 text-ui-meta text-ui-muted">{member.role === 'owner' ? '所有者' : '成员'}</span></div>)}</div>
      </section>
      <InvitePanel space={space} onSpaceChange={onSpaceChange} />
    </>}
    <section className="ui-space-group">
      <h2 className="text-ui-list font-ui-semibold">使用的功能</h2>
      <div className="mt-ui-2">
        <SpaceModuleRow label="任务" state={moduleState} error={moduleError} busy={moduleBusy} owner={isOwner} onRetry={onModuleRetry} onToggle={onModuleToggle} />
        <SpaceModuleRow label="回顾" state={reviewModuleState} error={reviewModuleError} busy={reviewModuleBusy} owner={isOwner} onRetry={onReviewModuleRetry} onToggle={onReviewModuleToggle} />
        <SpaceModuleRow label="清单" state={listsModuleState} error={listsModuleError} busy={listsModuleBusy} owner={isOwner} onRetry={onListsModuleRetry} onToggle={onListsModuleToggle} />
        <SpaceModuleRow label="重要日" state={importantDatesModuleState} error={importantDatesModuleError} busy={importantDatesModuleBusy} owner={isOwner} onRetry={onImportantDatesModuleRetry} onToggle={onImportantDatesModuleToggle} />
      </div>
    </section>
    {space.kind === 'shared' && lifecycleControls}
  </div>;
}

function SpaceModuleRow({ label, state, error, busy, owner, onRetry, onToggle }: { label: string; state: TasksModuleState; error: string; busy: boolean; owner: boolean; onRetry: () => void; onToggle: () => void }) {
  const known = state === 'enabled' || state === 'disabled';
  return <div className="ui-space-module-row">
    <div className="flex min-h-11 items-center justify-between gap-ui-3">
      <span className="text-ui-body">{label}</span>
      {!known ? state === 'loading' || busy ? <span className="text-ui-meta text-ui-muted" role="status">{busy ? '更新中…' : '读取中…'}</span> : <button className="ui-focus min-h-11 px-ui-3 text-ui-meta text-ui-accent" type="button" onClick={onRetry}>重试</button>
        : owner ? <div className="flex items-center gap-ui-2">{busy && <span className="text-ui-meta text-ui-muted" role="status">更新中…</span>}<button className="ui-space-switch ui-focus" type="button" role="switch" aria-label={`${label}模块`} aria-checked={state === 'enabled'} aria-busy={busy} disabled={busy} onClick={() => { if (!busy) onToggle(); }}><span className="ui-space-switch-track" aria-hidden="true"><span /></span><span className="sr-only">{state === 'enabled' ? `关闭${label}模块` : `开启${label}模块`}</span></button></div>
          : <span className="text-ui-meta text-ui-muted">{state === 'enabled' ? '已开启' : '已关闭'}</span>}
    </div>
    {error && <p className="mt-ui-1 text-ui-meta text-ui-danger" role="alert">{error}</p>}
  </div>;
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
  const dialog = useRef<HTMLDivElement>(null);
  const currentBusy = useRef(busy);
  currentBusy.current = busy;
  useEffect(() => {
    if (!pending) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = dialog.current;
    root?.querySelector<HTMLButtonElement>('button')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !currentBusy.current && !submitting.current) { event.preventDefault(); setPending(null); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(root?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
      if (!controls.length) { event.preventDefault(); root?.focus(); return; }
      const first = controls[0], last = controls[controls.length - 1];
      if (!root?.contains(document.activeElement)) { event.preventDefault(); first?.focus(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [Boolean(pending)]);
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
  return <section className="ui-space-group ui-space-danger" aria-label="危险操作">
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
    {pending && <div ref={dialog} tabIndex={-1} className="ui-space-confirm-overlay font-ui" role="dialog" aria-modal="true" aria-labelledby="space-lifecycle-title">
      <div className="ui-space-confirm mx-auto w-full max-w-md rounded-lg bg-white p-5 shadow-soft safe-bottom">
        <h3 id="space-lifecycle-title" className="text-lg font-bold">确认{pending.label}</h3>
        <p className="mt-3 text-sm leading-6">{pending.action === 'leave' ? '退出后，你在此共享空间的个人日程将删除；共享日程保留。' : pending.action === 'remove' ? '该成员在此共享空间的个人日程将删除；共享日程和任务保留。' : pending.action === 'transfer' ? '转让后，对方成为所有者，你成为普通成员。' : deleteStep === 1 ? '此操作将永久删除整个共享空间及其中的日程、任务、回顾、清单和重要日，无法恢复。' : '请再次确认：整个共享空间及其中的日程、任务、回顾、清单和重要日将永久删除，所有成员都将失去访问权。'}</p>
        {(pending.action === 'remove' || pending.action === 'transfer') && <p className="mt-2 break-all text-sm font-semibold">目标成员：{members.find((member) => member.user_id === pending.targetId)?.profiles?.display_name || pending.targetId}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button className="min-h-11 rounded-lg bg-mist px-4 font-semibold" type="button" disabled={busy} onClick={() => setPending(null)}>取消</button>
          <button className="min-h-11 rounded-lg bg-coral px-4 font-semibold text-white disabled:opacity-50" type="button" disabled={busy} onClick={() => void confirm()}>{busy ? '处理中…' : pending.action === 'delete' ? deleteStep === 1 ? '继续确认' : '永久删除空间' : `确认${pending.label}`}</button>
        </div>
      </div>
    </div>}
  </section>;
}

function SpaceDetail({ space, userId, onSpaceChange, busy, onBusyChange, onLifecycleSettled, onModuleChanged }: { space: CurrentSpace; userId: string; onSpaceChange: (space: Space) => void; busy: boolean; onBusyChange: (busy: boolean) => void; onLifecycleSettled: (action: SpaceLifecycleAction, error?: string) => Promise<void>; onModuleChanged: (key: ModuleKey, spaceId: string, state: 'enabled' | 'disabled') => void }) {
  const [members, setMembers] = useState<SpaceMember[]>([]);
  const [membersStatus, setMembersStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const membersGuard = useRef(createRequestGuard());
  const module = useSpaceTasksModule(space);
  const reviewModule = useSpaceReviewModule(space);
  const listsModule = useSpaceListsModule(space);
  const importantDatesModule = useSpaceImportantDatesModule(space);

  async function toggleModule(key: ModuleKey, toggle: () => Promise<TasksModuleState | undefined>) {
    const state = await toggle();
    if (state === 'enabled' || state === 'disabled') onModuleChanged(key, space.id, state);
  }

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
  return <SpaceDetailContent space={space} members={members} moduleState={module.state} moduleError={module.error} moduleBusy={module.busy} onModuleRetry={() => void module.retry()} onModuleToggle={() => void toggleModule('tasks', module.toggle)} reviewModuleState={reviewModule.state} reviewModuleError={reviewModule.error} reviewModuleBusy={reviewModule.busy} onReviewModuleRetry={() => void reviewModule.retry()} onReviewModuleToggle={() => void toggleModule('review', reviewModule.toggle)} listsModuleState={listsModule.state} listsModuleError={listsModule.error} listsModuleBusy={listsModule.busy} onListsModuleRetry={() => void listsModule.retry()} onListsModuleToggle={() => void toggleModule('lists', listsModule.toggle)} importantDatesModuleState={importantDatesModule.state} importantDatesModuleError={importantDatesModule.error} importantDatesModuleBusy={importantDatesModule.busy} onImportantDatesModuleRetry={() => void importantDatesModule.retry()} onImportantDatesModuleToggle={() => void toggleModule('important_dates', importantDatesModule.toggle)} onSpaceChange={onSpaceChange} nameEditor={(space.kind === 'personal' || members.some((member) => member.user_id === userId && member.role === 'owner')) ? <SpaceNameEditor key={`${space.id}:${userId}`} space={space} userId={userId} busy={busy} onBusyChange={onBusyChange} onSpaceChange={onSpaceChange} /> : null} lifecycleControls={<SpaceLifecycleControls space={space} members={members} userId={userId} busy={busy} onBusyChange={onBusyChange} onSettled={onLifecycleSettled} />} />;
}

export function SpaceManagementPage({ spaces, selectedSpaceId, userId, detailRevision, onSelect, onBack, onReady, onSpaceChange, onLifecycleSettled, onModuleChanged, busy, onBusyChange }: {
  spaces: CurrentSpace[];
  selectedSpaceId: string | null;
  userId: string;
  detailRevision: number;
  onSelect: (spaceId: string) => void;
  onBack: () => void;
  onReady: (spaceId: string) => Promise<boolean>;
  onSpaceChange: (space: Space) => void;
  onLifecycleSettled: (action: SpaceLifecycleAction, error?: string) => Promise<void>;
  onModuleChanged: (key: ModuleKey, spaceId: string, state: 'enabled' | 'disabled') => void;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const selected = spaces.find((space) => space.id === selectedSpaceId) ?? null;
  const personal = spaces.filter((space) => space.kind === 'personal');
  const shared = spaces.filter((space) => space.kind === 'shared');
  const sharedNameCounts = new Map<string, number>();
  for (const space of shared) sharedNameCounts.set(space.name, (sharedNameCounts.get(space.name) ?? 0) + 1);
  return (
    <main className="ui-spaces-page mx-auto min-h-[100dvh] w-full max-w-3xl px-ui-4 py-ui-4 bg-ui-page font-ui text-ui-text safe-bottom">
      <header className="ui-spaces-header flex min-h-11 items-center gap-ui-3">
        <button className="ui-focus inline-flex min-h-11 items-center gap-1 text-ui-meta font-ui-semibold text-ui-accent disabled:opacity-50" type="button" onClick={onBack} disabled={busy}><ChevronLeft size={18} />{selected ? '空间管理' : '我的'}</button>
        <h1 className="min-w-0 flex-1 break-all text-ui-section">{selected ? selected.name : '空间管理'}</h1>
      </header>
      {selected ? <div className="mt-4"><SpaceDetail key={`${selected.id}:${selected.membershipRole}:${detailRevision}`} space={selected} userId={userId} onSpaceChange={onSpaceChange} busy={busy} onBusyChange={onBusyChange} onLifecycleSettled={onLifecycleSettled} onModuleChanged={onModuleChanged} /></div> : (
        <>
          <section className="mt-4">
            <h2 className="text-ui-meta text-ui-muted">个人空间</h2>
            <div className="mt-2 space-y-2">{personal.map((space) => <SpaceRow key={space.id} space={space} onSelect={onSelect} busy={busy} />)}</div>
            {personal.length === 0 && <p className="mt-ui-2 text-ui-meta text-ui-muted">个人空间暂不可用，请重试初始化。</p>}
          </section>
          <section className="mt-5">
            <h2 className="text-ui-meta text-ui-muted">共享空间</h2>
            <div className="mt-2 space-y-2">{shared.map((space, index) => <SpaceRow key={space.id} space={space} onSelect={onSelect} busy={busy} secondary={(sharedNameCounts.get(space.name) ?? 0) > 1 ? `共享空间 ${index + 1}` : undefined} />)}</div>
            {shared.length === 0 && <p className="mt-ui-2 text-ui-meta text-ui-muted">暂无共享空间</p>}
          </section>
          <SharedSpaceForms onReady={onReady} busy={busy} onBusyChange={onBusyChange} />
        </>
      )}
    </main>
  );
}

function SpaceRow({ space, onSelect, busy, secondary }: { space: CurrentSpace; onSelect: (spaceId: string) => void; busy: boolean; secondary?: string }) {
  return <button className="ui-space-entry ui-focus min-h-14 w-full min-w-0 disabled:opacity-50" type="button" data-space-id={space.id} onClick={() => onSelect(space.id)} disabled={busy}>
    <>{space.kind === 'personal' ? <UserRound size={22} aria-hidden="true" /> : <Users size={22} aria-hidden="true" />}<span className="min-w-0 flex-1"><span className="block break-all font-ui-semibold">{space.kind === 'personal' ? '我的空间' : space.name}</span><span className="mt-ui-1 block text-ui-meta text-ui-muted">{space.kind === 'personal' ? '仅我可见' : space.membershipRole === 'owner' ? '所有者' : '成员'}</span>{secondary && <span className="block text-ui-label text-ui-muted">{secondary}</span>}</span></>
    <ChevronRight size={18} className="shrink-0 text-ink/45" aria-hidden="true" />
  </button>;
}
