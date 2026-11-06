// Caller-scoped RPC only: never accepts a client-selected target UUID.
export async function requireActiveAccount(read: () => Promise<{ data: unknown; error: unknown }>): Promise<void> {
  try {
    const result = await read();
    if (result.error !== null || result.data !== true) throw new Error();
  } catch {
    throw new Error('Authentication required.');
  }
}

// Service-only bounded batch; fail before dispatch on incomplete/malformed data.
export async function activeNotificationAccounts(
  read: () => Promise<{ data: unknown; error: unknown }>, userIds: string[],
): Promise<Set<string>> {
  try {
    if (userIds.length > 100) throw new Error();
    const { data, error } = await read();
    if (error !== null || !Array.isArray(data) || !data.every((id) => typeof id === 'string' && userIds.includes(id))
      || new Set(data).size !== data.length) throw new Error();
    return new Set(data);
  } catch {
    throw new Error('Account eligibility lookup failed.');
  }
}
