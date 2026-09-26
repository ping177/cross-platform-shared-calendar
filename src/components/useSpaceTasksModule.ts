import { useEffect, useRef, useState } from 'react';
import { createRequestGuard } from '../lib/request-guard';
import { createTasksModuleToggleGuard, tasksModuleStateFromResult, type TasksModuleState } from '../lib/space-modules';
import { supabase } from '../lib/supabase';
import type { CurrentSpace } from '../types';

export function useSpaceTasksModule(space: CurrentSpace, screen = 'detail') {
  const active = screen !== 'calendar';
  const [state, setState] = useState<TasksModuleState>('loading');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const requestGuard = useRef(createRequestGuard());
  const toggleGuard = useRef(createTasksModuleToggleGuard());

  async function read(spaceId: string) {
    const result = await supabase.from('space_modules')
      .select('enabled').eq('space_id', spaceId).eq('module_key', 'tasks').maybeSingle();
    return tasksModuleStateFromResult(result);
  }

  async function retry() {
    const request = requestGuard.current.begin();
    setState('loading');
    setError('');
    try {
      const next = await read(space.id);
      if (requestGuard.current.isCurrent(request)) setState(next);
    } catch {
      if (requestGuard.current.isCurrent(request)) {
        setState('error');
        setError('任务模块状态读取失败，请重试。');
      }
    }
  }

  useEffect(() => {
    if (active) void retry();
    return () => requestGuard.current.invalidate();
  }, [space.id, active, screen]);

  async function toggle() {
    if (space.membershipRole !== 'owner' || !active || toggleGuard.current.isBusy() || (state !== 'enabled' && state !== 'disabled')) return;
    const request = requestGuard.current.begin();
    setBusy(true);
    setError('');
    const result = await toggleGuard.current.run(
      async () => {
        const { error: toggleError } = await supabase.rpc('set_space_module_enabled', {
          p_space_id: space.id, p_module_key: 'tasks', p_enabled: state === 'disabled',
        });
        if (toggleError) throw toggleError;
      },
      () => read(space.id),
    );
    if (!requestGuard.current.isCurrent(request)) return result && 'state' in result ? result.state : undefined;
    setBusy(false);
    if (result === null) return;
    if ('state' in result) { setState(result.state); return result.state; }
    else if (result.failure === 'rpc') setError('任务模块切换失败，请确认空间权限或稍后重试。');
    else {
      setState('error');
      setError('任务模块状态读取失败，请重试。');
    }
  }

  return { state, error, busy, retry, toggle };
}
