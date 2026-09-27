import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import type { CurrentSpace, List, ListItem, ListSection } from '../src/types.ts';

const target = { spaceId: 'space-a', listId: 'list-a' };
const space = { id: target.spaceId, kind: 'shared', name: '共同空间', membershipRole: 'member' } as CurrentSpace;
const list = { id: target.listId, space_id: target.spaceId, name: '采购', created_by: 'other', created_at: '2026-09-27', updated_at: '2026-09-27' } as List;
const section = { id: 'section-a', list_id: target.listId, name: '食品', sort_order: 1 } as ListSection;
const item = { id: 'item-a', list_id: target.listId, space_id: target.spaceId, section_id: null, content: '牛奶', completed: false, sort_order: 1 } as ListItem;

test('detail reads List, complete Section and Item pages after and before eligibility validation', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { loadListDetail } = await vite.ssrLoadModule('/src/lib/lists-detail-data.ts');
    const sections = Array.from({ length: 501 }, (_, index) => ({ ...section, id: `section-${index}`, sort_order: index + 1 }));
    const rows = { lists: [list], list_sections: sections, list_items: [item] };
    const visited: string[] = [];
    const client = { from(table: keyof typeof rows) {
      return {
        select() { return this; }, eq() { return this; }, order() { return this; },
        async maybeSingle() { visited.push('list'); return { data: list, error: null }; },
        async range(start: number, end: number) { visited.push(table); return { data: rows[table].slice(start, end + 1), count: rows[table].length, error: null }; },
      };
    } };
    const readEligibility = async () => { visited.push('eligibility'); return { eligibleSpaces: [space] }; };
    const result = await loadListDetail('me', target, client, readEligibility);
    assert.equal(result.status, 'ready');
    assert.equal(result.sections.length, 501);
    assert.deepEqual(visited, ['eligibility', 'list', 'list_sections', 'list_items', 'list_sections', 'eligibility']);
  } finally { await vite.close(); }
});

test('zero List row revalidates eligibility before distinguishing deletion, lost access and transient failure', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { loadListDetail } = await vite.ssrLoadModule('/src/lib/lists-detail-data.ts');
    const client = { from() { return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: null, error: null }; } }; } };
    let calls = 0;
    assert.equal((await loadListDetail('me', target, client, async () => { calls++; return { eligibleSpaces: [space] }; })).status, 'deleted');
    assert.equal(calls, 2);
    calls = 0;
    assert.equal((await loadListDetail('me', target, client, async () => { calls++; return { eligibleSpaces: calls === 1 ? [space] : [] }; })).status, 'ineligible');
    await assert.rejects(loadListDetail('me', target, client, async () => { calls++; if (calls > 3) throw new Error('offline'); return { eligibleSpaces: [space] }; }), /offline/);
  } finally { await vite.close(); }
});

test('Slice 3 mutations use exact RPC parameters and only name/content direct updates', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const api = await vite.ssrLoadModule('/src/lib/lists-detail-data.ts');
    const actions: unknown[] = [];
    let updated: unknown = null;
    const query = {
      update(payload: unknown) { actions.push(['update', payload]); updated = payload; return this; },
      eq() { return this; }, select() { return this; },
      async maybeSingle() {
        return { data: updated && 'name' in (updated as object) ? { ...section, ...updated } : { ...item, ...updated }, error: null };
      },
    };
    const client = {
      from(table: string) { actions.push(['from', table]); return query; },
      async rpc(name: string, args: Record<string, unknown>) {
        actions.push(['rpc', name, args]);
        return { data: name === 'create_list_section' ? section
          : name === 'create_list_item' ? { ...item, section_id: args.p_section_id, content: args.p_content }
            : name === 'set_list_item_completed' ? { ...item, completed: args.p_completed } : null, error: null };
      },
    };
    await api.createListSection(client, target.listId, ' 食品 ');
    await api.renameListSection(client, section, ' 新食品 ');
    await api.createListItem(client, target, null, ' 牛奶 ');
    await api.createListItem(client, target, section.id, ' 牛奶 ');
    await api.editListItem(client, target, item, ' 豆奶 ');
    await api.setListItemCompleted(client, target, item, true);
    await api.setListItemCompleted(client, target, { ...item, completed: true }, false);
    await api.deleteListItem(client, target.listId, item.id);
    await api.deleteListSection(client, target.listId, section.id, true);
    await api.deleteListSection(client, target.listId, section.id, false);
    assert.deepEqual(actions.filter((action) => Array.isArray(action) && ['rpc', 'update'].includes(action[0])), [
      ['rpc', 'create_list_section', { p_list_id: target.listId, p_name: '食品' }],
      ['update', { name: '新食品' }],
      ['rpc', 'create_list_item', { p_list_id: target.listId, p_section_id: null, p_content: '牛奶' }],
      ['rpc', 'create_list_item', { p_list_id: target.listId, p_section_id: section.id, p_content: '牛奶' }],
      ['update', { content: '豆奶' }],
      ['rpc', 'set_list_item_completed', { p_item_id: item.id, p_completed: true }],
      ['rpc', 'set_list_item_completed', { p_item_id: item.id, p_completed: false }],
      ['rpc', 'delete_list_item', { p_list_id: target.listId, p_item_id: item.id }],
      ['rpc', 'delete_list_section', { p_list_id: target.listId, p_section_id: section.id, p_preserve_items: true }],
      ['rpc', 'delete_list_section', { p_list_id: target.listId, p_section_id: section.id, p_preserve_items: false }],
    ]);
  } finally { await vite.close(); }
});
