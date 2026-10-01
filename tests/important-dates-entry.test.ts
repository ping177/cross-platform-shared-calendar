import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';

const vite = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const availability = await vite.ssrLoadModule('/src/lib/module-availability.ts');
const navigation = await vite.ssrLoadModule('/src/lib/navigation.ts');
const { ModuleHub, resolveHubEligibility } = await vite.ssrLoadModule('/src/components/ModuleHub.tsx');
const { SpaceDetailContent } = await vite.ssrLoadModule('/src/components/SpaceManagementPage.tsx');
const { ImportantDatesPage } = await vite.ssrLoadModule('/src/components/ImportantDatesPage.tsx');
test.after(async () => { await vite.close(); });
const space = { id: 's', name: '我的空间', kind: 'personal', membershipRole: 'owner', created_by: 'me' };
const entry = { memberSpaces: [space], eligibleSpaces: [space] };
const noop = () => undefined;

test('Important Dates availability is independent, retains failed hints and rejects unknown entry scopes', async () => {
  const read = await resolveHubEligibility(async () => ({ eligibleSpaces: [] }), async () => [], async () => ({ eligibleSpaces: [] }), async () => entry);
  assert.deepEqual(read, { tasksIds: [], reviewIds: [], listsIds: [], importantDatesIds: ['s'] });
  const known = availability.mergeModuleAvailability(null, read);
  assert.deepEqual(availability.moduleEntry([space], known, 'important_dates', false), entry);
  const failed = availability.mergeModuleAvailability(known, { ...read, importantDatesIds: null });
  assert.deepEqual(failed.importantDatesIds, ['s']);
  assert.equal(failed.importantDatesError, true);
  assert.equal(availability.moduleEntry([space], failed, 'important_dates', false), null);
  assert.equal(availability.moduleEntry([space], known, 'important_dates', true), null);
  assert.equal(availability.moduleEntry([], known, 'important_dates', false), null);
  assert.deepEqual(availability.applyModuleToggle(known, 'important_dates', 's', 'disabled'), { ...known, importantDatesIds: [] });
  const partial = await resolveHubEligibility(async () => entry, async () => [space], async () => entry, async () => { throw new Error('offline'); });
  assert.deepEqual(partial, { tasksIds: ['s'], reviewIds: ['s'], listsIds: ['s'], importantDatesIds: null });
});

test('Hub shows Important Dates only for eligible Spaces; errors remain retryable and old cards survive', () => {
  const read = { tasksIds: ['s'], reviewIds: ['s'], listsIds: ['s'], importantDatesIds: ['s'] };
  const known = availability.mergeModuleAvailability(null, read);
  const render = (value: any) => renderToStaticMarkup(React.createElement(ModuleHub, { availability: value, onRefresh: noop, onOpenTasks: noop, onOpenReview: noop, onOpenLists: noop, onOpenImportantDates: noop }));
  const shown = render(known);
  for (const label of ['进入任务', '进入回顾', '进入清单', '进入重要日']) assert.match(shown, new RegExp(label));
  assert.doesNotMatch(shown, /提醒|Reminder/);
  assert.doesNotMatch(render({ ...known, importantDatesIds: [] }), /进入重要日/);
  const error = render({ ...known, importantDatesIds: null, importantDatesError: true });
  assert.match(error, /重要日模块状态读取失败/);
  assert.doesNotMatch(error, /暂无已开启/);
});

test('Space Important Dates toggle is owner-only; disabled/loading/error are distinct', () => {
  const props = { space, members: [], moduleState: 'disabled', moduleError: '', moduleBusy: false, onModuleRetry: noop, onModuleToggle: noop, onSpaceChange: noop, importantDatesModuleState: 'enabled' };
  const render = (patch: any) => renderToStaticMarkup(React.createElement(SpaceDetailContent, { ...props, ...patch }));
  assert.match(render({}), /role="switch" aria-label="重要日模块" aria-checked="true"/);
  assert.match(render({ importantDatesModuleState: 'disabled' }), /开启重要日模块/);
  assert.doesNotMatch(render({ space: { ...space, membershipRole: 'member' } }), /aria-label="重要日模块"/);
  assert.doesNotMatch(render({ importantDatesModuleState: 'loading' }), /aria-label="重要日模块"/);
  assert.match(render({ importantDatesModuleState: 'error', importantDatesModuleError: '重要日读取失败' }), /重要日读取失败/);
});

test('Important Dates strict page identity restores after validation; confirmed loss goes Hub and read error stays retryable', async () => {
  const nav = navigation.openImportantDatesModule(navigation.initialNavigation);
  assert.equal(nav.moduleScreen, 'important-dates');
  const target = navigation.navigationTargetForState(nav, 'profile', null, null, null);
  assert.deepEqual(target, { page: 'important-dates' });
  assert.deepEqual(navigation.parseNavigationTarget(JSON.stringify({ ...target, draft: { name: 'private' }, spaceId: 'invalid' })), target);
  const review = { loadReviewSpaces: async () => [], canReadReview: async () => false };
  assert.deepEqual(await navigation.resolveNavigationTarget(target, [space], review, undefined, { loadImportantDatesSpaces: async () => [space] }), target);
  assert.deepEqual(await navigation.resolveNavigationTarget(target, [space], review, undefined, { loadImportantDatesSpaces: async () => [] }), { page: 'modules' });
  assert.deepEqual(await navigation.resolveNavigationTarget(target, [space], review, undefined, { loadImportantDatesSpaces: async () => { throw new Error('offline'); } }), target);
});

test('Important Dates Hub re-entry retains only same-scope view/filter/Past state, with canonical reread pending', () => {
  const data = { ...entry, dates: [{ id: 'd', space_id: 's', name: '保留的重要日', emoji: null, repeat_kind: 'none', year: 2020, month: 1, day: 1 }] };
  const props = { userId: 'me', entry, onHubBack: noop, onNoEligible: noop, initialData: data, initialFilter: { spaceId: 's' }, initialPastExpanded: true };
  const render = (patch: any) => renderToStaticMarkup(React.createElement(ImportantDatesPage, { ...props, ...patch }));
  assert.match(render({}), /保留的重要日/);
  assert.match(render({}), /aria-expanded="true"/);
  assert.doesNotMatch(render({ entry: { ...entry, eligibleSpaces: [] } }), /保留的重要日/);
  assert.doesNotMatch(render({ entry: null }), /保留的重要日/);
});

test('App owns only bounded wiring and account/scope retention; delete copy names all cascaded data', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /importantDatesSnapshot\.current\?\.userId === userId && sameModuleScope/);
  assert.match(app, /navigation\.moduleScreen === 'important-dates'/);
  assert.match(app, /loadImportantDatesSpaces:/);
  assert.doesNotMatch(app, /from\('important_dates'\)|createImportantDate\(|updateImportantDate\(|deleteImportantDate\(/);
  const management = readFileSync(new URL('../src/components/SpaceManagementPage.tsx', import.meta.url), 'utf8');
  assert.equal((management.match(/日程、任务、回顾、清单和重要日/g) ?? []).length, 2);
});
