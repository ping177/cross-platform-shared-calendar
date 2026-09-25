import type { CurrentSpace } from '../types';

export type CreateKind = 'event' | 'task';
export type CreateTargetState = 'loading' | 'ready' | 'blocked' | 'error';

export type CreateTargetControl = {
  spaces: CurrentSpace[];
  selectedId: string;
  enabledIds?: string[];
  state: CreateTargetState;
  error: string;
  onSelect: (spaceId: string) => void;
  onRetry: () => void;
};

export function CreateTargetSelector({ control, kind, disabled }: { control: CreateTargetControl; kind: CreateKind; disabled: boolean }) {
  const choices = kind === 'task'
    ? control.spaces.filter((space) => control.enabledIds?.includes(space.id) || space.id === control.selectedId)
    : control.spaces;
  return <div className="space-y-2">
    <label className="block text-sm font-semibold text-ink/70" htmlFor={`${kind}-create-target`}>保存到</label>
    <select id={`${kind}-create-target`} className="w-full min-w-0 rounded-lg border border-ink/15 bg-white px-4 py-3 outline-none focus:border-teal disabled:bg-mist" value={control.selectedId} disabled={disabled} onChange={(event) => control.onSelect(event.target.value)}>
      {choices.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}
    </select>
    {control.state === 'loading' && <p className="text-sm text-ink/60" role="status">正在确认空间成员…</p>}
    {control.state === 'blocked' && <p className="text-sm text-coral" role="alert">{control.spaces.find((space) => space.id === control.selectedId)?.kind === 'personal' ? '当前默认空间' : '当前空间'}未启用任务，请主动选择其他已启用任务的空间。</p>}
    {control.state === 'error' && <p className="text-sm text-coral" role="alert">{control.error}<button className="ml-3 font-semibold underline" type="button" onClick={control.onRetry}>重试</button></p>}
  </div>;
}
