import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('single shared native and button-selector decoration reserves the same arrow inset without changing date/list controls', async () => {
  const css = await fs.readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(css, /select:not\(\[multiple\]\):not\(\[size\]\)/);
  assert.match(css, /\.ui-dropdown-trigger/);
  assert.match(css, /background-image: var\(--ui-dropdown-chevron\)/);
  assert.match(css, /background-position: right 1rem center/);
  assert.match(css, /background-size: 1rem 1rem/);
  assert.match(css, /padding-right: 3rem/);
  assert.match(css, /select[^{}]*\{[^{}]*appearance: none/s);
  assert.match(css, /@media \(forced-colors: active\)/);
});
test('selectors keep native options, canonical callbacks and disabled values with only one shared arrow', async () => {
  const vite = await createServer({ configFile: false, envFile: false, logLevel: 'silent', optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { TaskFilterPicker } = await vite.ssrLoadModule('/src/components/TasksArea.tsx');
    const { CalendarFilterPicker } = await vite.ssrLoadModule('/src/App.tsx');
    const { CreateTargetSelector } = await vite.ssrLoadModule('/src/components/GlobalCreateControls.tsx');
    const space = { id: 's', name: '很长的共享空间名称', kind: 'shared', membershipRole: 'member', created_by: 'other' };
    const taskFilter = renderToStaticMarkup(React.createElement(TaskFilterPicker, { spaces: [space], filter: 'all', onChange() {} }));
    assert.match(taskFilter, /<select/); assert.match(taskFilter, /value="s"/); assert.doesNotMatch(taskFilter, /lucide-chevron-down/);
    const calendar = renderToStaticMarkup(React.createElement(CalendarFilterPicker, { spaces: [space], filter: 'all', open: false, onOpen() {}, onClose() {}, onSelect() {} }));
    assert.match(calendar, /ui-dropdown-trigger/); assert.match(calendar, /aria-haspopup="dialog"/); assert.doesNotMatch(calendar, /lucide-chevron-down/);
    let chosen = '';
    const target = CreateTargetSelector({ kind: 'task', disabled: true, control: { spaces: [space], selectedId: 's', enabledIds: [], state: 'blocked', error: '', onSelect: (id: string) => { chosen = id; }, onRetry() {} } });
    const html = renderToStaticMarkup(target); assert.match(html, /<select[^>]*disabled=""/); assert.match(html, /value="s" disabled="" selected=""/);
    const select = React.Children.toArray(target.props.children).find((el: any) => el.type === 'select') as any;
    select.props.onChange({ target: { value: 's' } }); assert.equal(chosen, 's');
  } finally { await vite.close(); }
});
