import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { memberDisplayName } from '../lib/member';
import { createRequestGuard } from '../lib/request-guard';
import { readSpaceMembers } from '../lib/space-members';
import type { CurrentSpace, Space, SpaceMember } from '../types';
import type { TasksModuleState } from '../lib/space-modules';
import { InvitePanel } from './InvitePanel';
import { SharedSpaceForms } from './SharedSpaceForms';
import { useSpaceTasksModule } from './useSpaceTasksModule';

type DetailProps = {
  space: CurrentSpace;
  members: SpaceMember[];
  moduleState: TasksModuleState;
  moduleError: string;
  moduleBusy: boolean;
  onModuleRetry: () => void;
  onModuleToggle: () => void;
  onSpaceChange: (space: Space) => void;
};

export function SpaceDetailContent({ space, members, moduleState, moduleError, moduleBusy, onModuleRetry, onModuleToggle, onSpaceChange }: DetailProps) {
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
      </section>
    </div>
  );
}

function SpaceDetail({ space, onSpaceChange }: { space: CurrentSpace; onSpaceChange: (space: Space) => void }) {
  const [members, setMembers] = useState<SpaceMember[]>([]);
  const [membersStatus, setMembersStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const membersGuard = useRef(createRequestGuard());
  const module = useSpaceTasksModule(space);

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
  return <SpaceDetailContent space={space} members={members} moduleState={module.state} moduleError={module.error} moduleBusy={module.busy} onModuleRetry={() => void module.retry()} onModuleToggle={() => void module.toggle()} onSpaceChange={onSpaceChange} />;
}

export function SpaceManagementPage({ spaces, selectedSpaceId, onSelect, onBack, onReady, onSpaceChange, busy, onBusyChange }: {
  spaces: CurrentSpace[];
  selectedSpaceId: string | null;
  onSelect: (spaceId: string) => void;
  onBack: () => void;
  onReady: (spaceId: string) => Promise<boolean>;
  onSpaceChange: (space: Space) => void;
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
      {selected ? <div className="mt-4"><SpaceDetail key={selected.id} space={selected} onSpaceChange={onSpaceChange} /></div> : (
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
