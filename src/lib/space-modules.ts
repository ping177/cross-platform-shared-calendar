export type TasksModuleState = 'loading' | 'enabled' | 'disabled' | 'error';

export function tasksModuleForcesHub(state: TasksModuleState, screen: 'calendar' | 'hub' | 'tasks' | 'completed'): boolean {
  return state === 'disabled' && (screen === 'tasks' || screen === 'completed');
}

type ModuleReadResult = {
  data: { enabled: boolean } | null;
  error: { message: string } | null;
};

export function tasksModuleStateFromResult({ data, error }: ModuleReadResult): 'enabled' | 'disabled' {
  if (error) throw new Error(error.message);
  return data?.enabled === true ? 'enabled' : 'disabled';
}

export async function toggleTasksModule(
  write: () => Promise<void>,
  refresh: () => Promise<'enabled' | 'disabled'>,
): Promise<{ state: 'enabled' | 'disabled' } | { failure: 'rpc' | 'refresh' }> {
  try {
    await write();
  } catch {
    return { failure: 'rpc' };
  }
  try {
    return { state: await refresh() };
  } catch {
    return { failure: 'refresh' };
  }
}

export function createTasksModuleToggleGuard() {
  let busy = false;
  return {
    isBusy: () => busy,
    run: async (write: () => Promise<void>, refresh: () => Promise<'enabled' | 'disabled'>) => {
      if (busy) return null;
      busy = true;
      try {
        return await toggleTasksModule(write, refresh);
      } finally {
        busy = false;
      }
    },
  };
}
