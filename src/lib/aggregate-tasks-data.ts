import { readAggregateTasks, readTaskEligibility, taskFilterSpaces, type TaskFilter, type TaskModuleRow } from './aggregate-tasks.ts';
import { listCurrentSpaces } from './current-spaces.ts';
import { readSpaceMembers } from './space-members.ts';
import { supabase } from './supabase.ts';
import type { Task } from '../types.ts';

async function assertCurrentUser(userId: string) {
  const { data, error } = await supabase.auth.getUser();
  if (error || data.user?.id !== userId) throw new Error('登录状态已变化，请重试。');
}

async function taskModulePage(start: number, end: number) {
  const page = await supabase.from('space_modules').select('space_id,enabled', { count: 'exact' })
    .eq('module_key', 'tasks').order('space_id').range(start, end);
  return { data: page.data as TaskModuleRow[] | null, count: page.count, error: page.error };
}

export async function loadTaskEligibility(userId: string) {
  await assertCurrentUser(userId);
  const memberSpaces = await listCurrentSpaces(userId);
  const eligibleSpaces = await readTaskEligibility(memberSpaces, taskModulePage);
  await assertCurrentUser(userId);
  return { memberSpaces, eligibleSpaces };
}

export async function loadAggregateTasks(userId: string, filter: TaskFilter) {
  await assertCurrentUser(userId);
  const spaces = await listCurrentSpaces(userId);
  const result = await readAggregateTasks(spaces, filter, {
    modulePage: taskModulePage,
    taskPage: async (spaceId, start, end) => {
      const page = await supabase.from('tasks').select('*', { count: 'exact' })
        .eq('space_id', spaceId).order('id').range(start, end);
      return { data: page.data as Task[] | null, count: page.count, error: page.error };
    },
  });
  const memberPairs = await Promise.all(taskFilterSpaces(result.eligibleSpaces, result.filter)
    .map(async (space) => [space.id, await readSpaceMembers(space.id)] as const));
  await assertCurrentUser(userId);
  return { ...result, memberSpaces: spaces, membersBySpaceId: Object.fromEntries(memberPairs) };
}
