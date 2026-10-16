import { SpaceFilterDropdown } from './SpaceFilterDropdown';

// A form target is never a content filter. Callers own eligibility and ID mapping.
export function SpaceTargetDropdown({ id, spaces, value, onChange, label = '选择保存空间', disabled = false, className = '' }: {
  id: string;
  spaces: ReadonlyArray<{ id: string; name: string; disabled?: boolean }>;
  value: string;
  onChange: (id: string) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}) {
  return <SpaceFilterDropdown controlId={id} spaces={spaces} value={value} onChange={onChange} label={label}
    disabled={disabled} allowAll={false} withinDialog placeholder="请主动选择空间" className={`ui-space-target-trigger ui-focus ${className}`} />;
}
