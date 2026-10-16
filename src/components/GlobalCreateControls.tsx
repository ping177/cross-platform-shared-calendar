import type { CurrentSpace } from '../types';
import { SpaceTargetDropdown } from './SpaceTargetDropdown';

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
    <SpaceTargetDropdown id={`${kind}-create-target`} spaces={choices.map((space) => ({ ...space, disabled: kind === 'task' && control.enabledIds !== undefined && !control.enabledIds.includes(space.id) }))}
      value={control.selectedId} disabled={disabled} onChange={control.onSelect} />
    {control.state === 'loading' && <p className="text-sm text-ink/60" role="status">正在确认空间成员…</p>}
    {control.state === 'blocked' && <p className="text-sm text-ui-danger" role="alert">{control.spaces.find((space) => space.id === control.selectedId)?.kind === 'personal' ? '当前默认空间' : '当前空间'}未启用任务，请主动选择其他已启用任务的空间。</p>}
    {control.state === 'error' && <p className="text-sm text-ui-danger" role="alert">{control.error}<button className="ui-focus ml-3 inline-flex min-h-ui-touch min-w-11 items-center justify-center rounded-ui-control font-semibold underline" type="button" onClick={control.onRetry}>重试</button></p>}
  </div>;
}
