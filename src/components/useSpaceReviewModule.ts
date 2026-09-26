import { useEffect, useRef, useState } from 'react';
import { createRequestGuard } from '../lib/request-guard';
import { createTasksModuleToggleGuard, tasksModuleStateFromResult, type TasksModuleState } from '../lib/space-modules';
import { supabase } from '../lib/supabase';
import type { CurrentSpace } from '../types';

export function useSpaceReviewModule(space: CurrentSpace) {
  const [state, setState] = useState<TasksModuleState>('loading');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const guard = useRef(createRequestGuard());
  const toggleGuard = useRef(createTasksModuleToggleGuard());

  async function read() {
    const result = await supabase.from('space_modules').select('enabled')
      .eq('space_id', space.id).eq('module_key', 'review').maybeSingle();
    return tasksModuleStateFromResult(result);
  }
  async function retry() {
    const request = guard.current.begin();
    setState('loading');
    setError('');
    try {
      const next = await read();
      if (guard.current.isCurrent(request)) setState(next);
    } catch {
      if (guard.current.isCurrent(request)) {
        setState('error');
        setError('回顾模块状态读取失败，请重试。');
      }
    }
  }
  useEffect(() => {
    void retry();
    return () => guard.current.invalidate();
  }, [space.id]);
  async function toggle() {
    if (space.membershipRole !== 'owner' || toggleGuard.current.isBusy() || (state !== 'enabled' && state !== 'disabled')) return;
    const request = guard.current.begin();
    setBusy(true);
    setError('');
    const result = await toggleGuard.current.run(async () => {
      const { error: toggleError } = await supabase.rpc('set_space_module_enabled', {
        p_space_id: space.id, p_module_key: 'review', p_enabled: state === 'disabled',
      });
      if (toggleError) throw toggleError;
    }, read);
    if (!guard.current.isCurrent(request)) return;
    setBusy(false);
    if (result === null) return;
    if ('state' in result) setState(result.state);
    else if (result.failure === 'rpc') setError('回顾模块切换失败，请确认空间权限或稍后重试。');
    else {
      setState('error');
      setError('回顾模块状态读取失败，请重试。');
    }
  }
  return { state, error, busy, retry, toggle };
}
