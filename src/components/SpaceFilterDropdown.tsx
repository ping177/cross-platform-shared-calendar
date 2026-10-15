import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';

type Props = {
  spaces: ReadonlyArray<{ id: string; name: string }>;
  value: string;
  onChange: (id: string) => void;
  label: string;
  className: string;
  allowAll?: boolean;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

// Presentation only: each module retains its own filter, eligibility and create rules.
export function SpaceFilterDropdown({ spaces, value, onChange, label, className, allowAll = true, disabled = false, open: controlledOpen, onOpenChange }: Props) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const id = useId();
  const options = [...(allowAll ? [{ id: 'all', name: '全部空间' }] : []), ...spaces];
  const selected = options.findIndex((option) => option.id === value);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
  const current = useRef({ onOpenChange, disabled });
  current.current = { onOpenChange, disabled };

  function setOpen(next: boolean) {
    setLocalOpen(next);
    current.current.onOpenChange?.(next);
  }
  function restoreFocus() {
    // Calendar remounts its content on a Space change. Find its new trigger after commit.
    requestAnimationFrame(() => {
      const target = trigger.current?.isConnected ? trigger.current
        : Array.from(document.querySelectorAll<HTMLButtonElement>('[data-space-filter-trigger]')).find((button) => button.getAttribute('aria-label') === label);
      if (target && !target.disabled) target.focus({ preventScroll: true });
    });
  }
  function close(restore = false) {
    setOpen(false);
    if (restore) restoreFocus();
  }
  function show(index = selected < 0 ? 0 : selected) {
    if (disabled || !options.length) return;
    setActive(index); setPosition(null); setOpen(true);
  }
  function choose(optionId: string) {
    if (current.current.disabled || !options.some((option) => option.id === optionId)) return;
    close(true);
    onChange(optionId);
  }

  useEffect(() => {
    if (!open || disabled) return;
    function place() {
      const anchor = trigger.current?.getBoundingClientRect();
      const safe = viewport.current?.getBoundingClientRect();
      if (!anchor || !safe) return;
      const visual = window.visualViewport;
      const leftEdge = Math.max(safe.left, visual?.offsetLeft ?? 0) + 16;
      const rightEdge = Math.min(safe.right, (visual?.offsetLeft ?? 0) + (visual?.width ?? window.innerWidth)) - 16;
      const bottom = Math.min(safe.bottom, (visual?.offsetTop ?? 0) + (visual?.height ?? window.innerHeight)) - 8;
      const top = anchor.bottom + 4;
      if (anchor.bottom <= Math.max(safe.top, visual?.offsetTop ?? 0) || anchor.top >= bottom) { close(); return; }
      const width = Math.max(0, Math.min(384, rightEdge - leftEdge));
      setPosition({ left: Math.max(leftEdge, Math.min(anchor.left, rightEdge - width)), top, width, maxHeight: Math.max(0, Math.min(320, bottom - top)) });
    }
    place();
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menu.current?.contains(target) && !trigger.current?.contains(target)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.isComposing && event.keyCode !== 229) {
        event.preventDefault(); event.stopPropagation(); close(true);
      }
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    window.visualViewport?.addEventListener('resize', place);
    window.visualViewport?.addEventListener('scroll', place);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('scroll', place);
    };
  }, [open, disabled]);
  useEffect(() => {
    if (disabled && open) close();
  }, [disabled, open]);
  useEffect(() => {
    if (!open || !position) return;
    const buttons = menu.current?.querySelectorAll<HTMLButtonElement>('[role="option"]');
    const button = buttons?.[Math.min(active, options.length - 1)];
    button?.focus({ preventScroll: true });
    button?.scrollIntoView({ block: 'nearest' });
  }, [open, Boolean(position), active, options.length]);

  return <>
    <button ref={trigger} data-space-filter-trigger type="button" className={`ui-space-filter-trigger ui-dropdown-trigger ${className}`} disabled={disabled}
      aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => open ? close() : show()}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); show(event.key === 'ArrowUp' ? options.length - 1 : selected < 0 ? 0 : selected); }
      }}>
      {options.find((option) => option.id === value)?.name ?? '请选择空间'}
    </button>
    {open && !disabled && typeof document !== 'undefined' && createPortal(<div ref={viewport} className="ui-space-filter-viewport">
      <div ref={menu} id={id} role="listbox" aria-label={label} className="ui-space-filter-menu" style={position ? { ...position, visibility: 'visible' } : { visibility: 'hidden' }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
          let next = active;
          if (event.key === 'ArrowDown') next = (active + 1) % options.length;
          else if (event.key === 'ArrowUp') next = (active - 1 + options.length) % options.length;
          else if (event.key === 'Home') next = 0;
          else if (event.key === 'End') next = options.length - 1;
          else if (event.key === 'Tab') {
            // Return to the trigger before the browser performs its normal Tab movement.
            trigger.current?.focus({ preventScroll: true }); close(); return;
          } else return;
          event.preventDefault(); setActive(next);
        }}>
        {options.map((option, index) => <button key={option.id} type="button" role="option" aria-selected={option.id === value} tabIndex={index === active ? 0 : -1}
          className="ui-space-filter-option" onClick={() => choose(option.id)}>
          <Check size={18} aria-hidden="true" className={option.id === value ? '' : 'invisible'} /><span>{option.name}</span>
        </button>)}
      </div>
    </div>, document.body)}
  </>;
}
