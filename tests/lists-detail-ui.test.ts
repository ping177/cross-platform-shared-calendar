import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import type { ListItem } from '../src/types.ts';

const active = { id: 'item-a', list_id: 'list-a', space_id: 'space-a', section_id: null, content: '牛奶', completed: false, sort_order: 1 } as ListItem;
const completed = { ...active, id: 'item-b', content: '面包', completed: true, sort_order: 2 };

test('each completed region is closed by default, opens accessibly and has no ungrouped heading', async () => {
  const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { ListDetailRegion } = await vite.ssrLoadModule('/src/components/ListDetailPage.tsx');
    const { initialListDetailUiState } = await vite.ssrLoadModule('/src/lib/lists-detail.ts');
    const noop = () => undefined;
    const props = { regionKey: 'ungrouped', regionLabel: '清单', region: { active: [active], completed: [completed], completedCount: 1, total: 2 },
      ui: initialListDetailUiState(), busy: false, disabled: false, onToggleFold: noop, onToggleItem: noop,
      onEditItem: noop, onEditChange: noop, onSaveEdit: noop, onCancelEdit: noop, onDeleteItem: noop };
    const closed = renderToStaticMarkup(React.createElement(ListDetailRegion, props));
    assert.match(closed, /牛奶|已完成 1|aria-expanded="false"/);
    assert.doesNotMatch(closed, /面包|未分组/);
    const open = renderToStaticMarkup(React.createElement(ListDetailRegion, { ...props, ui: { ...props.ui, foldOpen: { ungrouped: true } } }));
    assert.match(open, /面包|aria-expanded="true"/);
    const empty = renderToStaticMarkup(React.createElement(ListDetailRegion, { ...props, region: { active: [], completed: [], completedCount: 0, total: 0 } }));
    assert.doesNotMatch(empty, /已完成|未分组/);
  } finally { await vite.close(); }
});

test('detail source keeps Slice 4 controls and unsupported Item fields absent', () => {
  const source = readFileSync(new URL('../src/components/ListDetailPage.tsx', import.meta.url), 'utf8');
  const data = readFileSync(new URL('../src/lib/lists-detail-data.ts', import.meta.url), 'utf8');
  const realtime = readFileSync(new URL('../src/components/useListDetail.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /draggable|onDragStart|reorder_list_|拖拽|排序|未分组|created_by|assignee|due_on|reminder|quantity|comment/);
  assert.match(source, /仅删除分组/);
  assert.match(source, /删除分组及其中内容/);
  assert.match(data, /p_preserve_items: preserveItems/);
  assert.match(source, /setListItemCompleted|deleteListItem/);
  assert.match(source, /requestAnimationFrame\(\(\) => inputRefs\.current\.get\(key\)\?\.focus\(\)\)/);
  assert.match(source, /commitConfirmedDetailMutation/);
  assert.match(source, /deleteListSection[\s\S]*?true\), undefined, true\)/);
  assert.doesNotMatch(source, /applyConfirmed\(\{ kind: 'section-delete'/);
  assert.match(realtime, /guard\.current\.invalidate\(\)/);
  for (const table of ['lists', 'list_sections', 'list_items']) assert.match(realtime, new RegExp(`table: '${table}'`));
  assert.match(realtime, /signal\.stop\(\)[\s\S]*?removeChannel\(channel\)/);
});
