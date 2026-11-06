type Runtime = { mode: 'production' | 'isolated-local'; url: string; acceptNew: boolean; users: string[] };
export function deletionRuntime(get: (name: string) => string | undefined): Runtime {
  const mode = get('ACCOUNT_DELETION_RUNTIME_MODE');
  const url = get('SUPABASE_URL') ?? '';
  if (mode === 'production') {
    if (url !== 'https://ximazjhxvmktpcdbypka.supabase.co') throw new Error('Service unavailable.');
  } else if (mode === 'isolated-local') {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' || !['127.0.0.1','localhost','storage','kong'].includes(parsed.hostname)
      || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw new Error('Service unavailable.');
  } else throw new Error('Service unavailable.');
  return { mode, url, acceptNew: get('ACCOUNT_DELETION_ACCEPT_NEW') === 'true',
    users: (get('ACCOUNT_DELETION_ACCEPT_USER_IDS') ?? '').split(',').map(value => value.trim()).filter(Boolean) };
}
export function acceptsDeletion(runtime: Runtime, userId: string) {
  return runtime.acceptNew && (!runtime.users.length || runtime.users.includes(userId));
}
export function deletionOrigin(runtime: Runtime, origin: string) {
  return runtime.mode === 'production' ? origin === 'https://cross-platform-shared-calendar.vercel.app'
    : ['http://127.0.0.1:5175','http://localhost:5175'].includes(origin);
}
