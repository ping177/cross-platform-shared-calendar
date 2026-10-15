import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

// An externally provided Playwright avoids adding project dependencies. Missing runtime is an error.
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
let files;
const browsers = new Map();
const api = `export const isSupabaseConfigured=true; export const supabase={
  auth:{async getUser(){return {data:{user:{id:'me'}},error:null}}},
  channel(){return {on(){return this},subscribe(){return this}}},removeChannel(){},
  rpc(method,args){return window.fixture.write(method,args)},
  from(table){let value,id;return {update(v){value=v;return this},eq(k,v){if(k==='id')id=v;return this},select(){return this},
    maybeSingle(){return table==='review_entries' && value===undefined
      ? Promise.resolve({data:window.fixture.review.own,error:null})
      : window.fixture.write(table==='list_sections'?'rename-section':'rename-list',{id,value})}}}
};`;
before(async () => {
  const bundle = await build({ root, configFile: false, envFile: false, logLevel: 'error', plugins: [{
    name: 'browser-backend-fixture', enforce: 'pre',
    resolveId(id) {
      if (/\/supabase(?:\.ts)?$/.test(id)) return '\0fixture-api';
      for (const name of ['lists-detail-data', 'review-detail-data', 'review-history-data']) {
        if (new RegExp('/' + name + '(?:\\.ts)?$').test(id)) return '\0fixture-' + name;
      }
    },
    load(id) {
      if (id === '\0fixture-api') return api;
      const name = id.slice('\0fixture-'.length);
      const original = `export * from ${JSON.stringify(root + 'src/lib/' + name + '.ts?actual')};`;
      if (name === 'lists-detail-data') return original + 'export async function loadListDetail(){return structuredClone(window.fixture.data)}';
      if (name === 'review-detail-data') return original + 'export async function readReviewDetail(){return window.fixture.review}';
      if (name === 'review-history-data') return original + 'export async function loadReviewEligibility(){return [window.fixture.data.space]}';
    },
  }], build: { write: false, minify: false, rollupOptions: { input: root + 'tests/fixtures/list-groups-browser.jsx' } } });
  files = bundle.output;
  for (const [name, type] of [['WebKit', webkit], ['Chrome', chromium]]) {
    browsers.set(name, await type.launch(name === 'Chrome' ? { channel: 'chrome', headless: true } : { headless: true }));
  }
});
after(async () => { for (const browser of browsers.values()) await browser.close(); });

async function pageFor(name, width = 375, mode = '') {
  const page = await browsers.get(name).newPage({ viewport: { width, height: 812 }, hasTouch: true, isMobile: width < 768 });
  page.setDefaultTimeout(3000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', async dialog => { errors.push('Unexpected native dialog: ' + dialog.message()); await dialog.dismiss(); });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    assert.equal(url.origin, 'http://127.0.0.1:5175', 'No external requests in component tests');
    const file = files.find(file => url.pathname === '/' + file.fileName);
    if (file) return route.fulfill({ contentType: file.fileName.endsWith('.css') ? 'text/css' : 'text/javascript', body: file.type === 'chunk' ? file.code : file.source });
    if (url.pathname !== '/__component_test') return route.abort();
    return route.fulfill({ contentType: 'text/html', body: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><div id="root"></div><link rel="stylesheet" href="/${files.find(f => f.fileName.endsWith('.css')).fileName}"><script type="module" src="/${files.find(f => f.type === 'chunk' && f.isEntry).fileName}"></script>` });
  });
  await page.goto('http://127.0.0.1:5175/__component_test?mode=' + mode);
  page.errors = errors;
  return page;
}
async function finish(page) { try { assert.deepEqual(page.errors, []); } finally { await page.close(); } }
const button = (page, name) => page.getByRole('button', { name, exact: true });
async function openGroup(page, id, action) {
  await page.locator('#list-group-menu-' + id).tap();
  await button(page, action).tap();
}
const calls = page => page.evaluate(() => window.fixture.calls);
async function waitCalls(page, count) { await page.waitForFunction(n => window.fixture.calls.length === n, count); }

for (const engine of ['WebKit', 'Chrome']) {
  for (const id of ['empty', 'full']) {
    test(`${engine}: ${id} group real touch rename, cancel, failure, retry and duplicate save`, async () => {
      const page = await pageFor(engine);
      try {
        await openGroup(page, id, '改名');
        const input = page.getByRole('textbox', { name: '编辑分组名称' });
        await input.waitFor();
        await button(page, '取消').tap();
        assert.equal((await calls(page)).length, 0);
        await openGroup(page, id, '改名');
        await input.fill('改好的分组');
        await page.evaluate(() => { window.fixture.fail = true; });
        await button(page, '保存').tap();
        await page.getByRole('alert').filter({ hasText: '操作失败' }).waitFor();
        assert.equal(await input.inputValue(), '改好的分组');
        await page.evaluate(() => { window.fixture.fail = false; window.fixture.hold = true; });
        await button(page, '保存').tap();
        await waitCalls(page, 2);
        assert.equal(await button(page, '保存').isDisabled(), true);
        // Two DOM submit events in the same task must still reach only one mutation.
        await input.evaluate(input => { const form = input.closest('form'); for (let i = 0; i < 2; i++) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
        assert.equal((await calls(page)).length, 2);
        await page.evaluate(() => window.fixture.release());
        await page.waitForFunction(id => document.querySelector(`[data-section-id="${id}"]`)?.textContent.includes('改好的分组') && !document.querySelector('[aria-label="编辑分组名称"]'), id);
        assert.deepEqual((await calls(page)).map(call => call.method), ['rename-section', 'rename-section']);
      } finally { await finish(page); }
    });
    for (const preserve of id === 'empty' ? [true] : [true, false]) {
      test(`${engine}: ${id} group touch delete preserve=${preserve}, cancel, failure, retry and lock`, async () => {
        const page = await pageFor(engine);
        try {
          const label = id === 'empty' ? '删除' : preserve ? '仅删除分组' : '删除分组及其中内容';
          await openGroup(page, id, '删除');
          await page.getByRole('dialog').waitFor();
          assert.equal((await calls(page)).length, 0);
          await button(page, '取消').tap();
          assert.equal((await calls(page)).length, 0);
          await openGroup(page, id, '删除');
          await page.evaluate(() => { window.fixture.fail = true; });
          await button(page, label).tap();
          await page.getByRole('dialog').getByRole('alert').waitFor();
          assert.equal(await button(page, label).isEnabled(), true);
          await page.evaluate(() => { window.fixture.fail = false; window.fixture.hold = true; });
          await button(page, label).tap();
          await waitCalls(page, 2);
          assert.equal(await button(page, '取消').isDisabled(), true);
          await button(page, label).evaluate(button => { button.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
          await page.keyboard.press('Escape');
          assert.equal(await page.getByRole('dialog').count(), 1);
          assert.equal((await calls(page)).length, 2);
          await page.evaluate(() => window.fixture.release());
          await page.locator(`[data-section-id="${id}"]`).waitFor({ state: 'detached' });
          assert.equal(await page.getByRole('dialog').count(), 0);
          assert.equal(await button(page, '编辑 牛奶').count(), id === 'full' && !preserve ? 0 : 1);
          assert.ok((await calls(page)).every(call => call.method === 'delete_list_section' && call.args.p_section_id === id && call.args.p_preserve_items === preserve));
        } finally { await finish(page); }
      });
    }
  }
  test(`${engine}: menu outside touch, keyboard navigation and item/whole-list confirmations`, async () => {
    const page = await pageFor(engine);
    try {
      const trigger = page.locator('#list-group-menu-empty');
      await trigger.tap();
      await page.getByRole('heading', { name: '测试清单' }).tap();
      assert.equal(await button(page, '改名').count(), 0);
      await trigger.focus(); await page.keyboard.press('Enter');
      await button(page, '删除').focus(); await page.keyboard.press('Enter');
      await page.getByRole('dialog').waitFor();
      await page.keyboard.press('Escape');
      await trigger.focus(); await page.keyboard.press('Enter');
      await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Shift+Tab');
      assert.equal(await button(page, '改名').count(), 0);
      await button(page, '编辑 牛奶').tap(); await button(page, '删除').tap();
      await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).tap(); assert.equal((await calls(page)).length, 0);
      await button(page, '删除').tap(); await page.getByRole('dialog').getByRole('button', { name: '删除', exact: true }).tap();
      await page.locator('[data-item-id="i"]').waitFor({ state: 'detached' });
      await page.locator('#list-detail-menu').tap(); await button(page, '删除清单').tap();
      await button(page, '取消').tap(); assert.equal((await calls(page)).length, 1);
      await page.locator('#list-detail-menu').tap(); await button(page, '删除清单').tap();
      await button(page, '继续确认').tap(); assert.equal((await calls(page)).length, 1);
      await button(page, '永久删除清单').tap();
      await page.waitForFunction(() => window.fixture.unavailable);
      assert.deepEqual((await calls(page)).map(call => call.method), ['delete_list_item', 'delete_list']);
    } finally { await finish(page); }
  });
}

const layouts = [
  ['group-empty', '', async page => openGroup(page, 'empty', '删除'), '.ui-list-confirm'],
  ['group-full', '', async page => openGroup(page, 'full', '删除'), '.ui-list-confirm'],
  ['item', '', async page => { await button(page, '编辑 牛奶').tap(); await button(page, '删除').tap(); }, '.ui-list-confirm'],
  ['list', '', async page => { await page.locator('#list-detail-menu').tap(); await button(page, '删除清单').tap(); }, '.ui-list-confirm'],
  ['review', 'review', async page => button(page, '删除回顾').tap(), '.ui-space-confirm'],
  ['important-entry', 'important', async () => {}, '[aria-labelledby="important-date-delete-title"] > div'],
  ['important-module', 'important-module', async () => {}, '.ui-important-confirm'],
  ['space', 'space', async page => button(page, '删除空间').tap(), '.ui-space-confirm'],
  ['member-remove', 'space', async page => button(page, '移除成员').tap(), '.ui-space-confirm'],
  ['member-transfer', 'space', async page => button(page, '转让所有者').tap(), '.ui-space-confirm'],
  ['space-leave', 'leave', async page => button(page, '退出空间').tap(), '.ui-space-confirm'],
  ['invite', 'invite', async page => button(page, '轮换邀请码').tap(), '.ui-space-confirm'],
  ['event', 'event', async page => page.getByRole('button', { name: '删除日程', exact: true }).tap(), '.ui-event-sheet-panel'],
  ['task', 'task', async page => page.getByRole('button', { name: '删除任务', exact: true }).tap(), '.ui-task-sheet > section'],
  ['recurring-event', 'recurring', async page => page.getByRole('button', { name: '删除此事件', exact: true }).tap(), '[data-event-scope-dialog] > section'],
];
for (const engine of ['WebKit', 'Chrome']) {
  test(`${engine}: 375px all confirmation shells share flush edges, width, corners and safe padding`, async () => {
    for (const [label, mode, open, selector] of layouts) {
      const page = await pageFor(engine, 375, mode);
      try {
        await open(page);
        const panel = page.locator(selector);
        await panel.waitFor();
        const metrics = await panel.evaluate(panel => {
          const style = getComputedStyle(panel), rect = panel.getBoundingClientRect();
          const body = panel.querySelector('.ui-delete-content, .ui-event-sheet-body, .ui-task-sheet-body') || panel;
          return { left: rect.left, right: rect.right, bottom: rect.bottom, top: rect.top, maxWidth: style.maxWidth, radius: [style.borderTopLeftRadius, style.borderBottomLeftRadius], padding: parseFloat(getComputedStyle(body).paddingBottom), overflow: document.documentElement.scrollWidth > innerWidth };
        });
        assert.equal(metrics.left, 0, label + ' left'); assert.equal(metrics.right, 375, label + ' right'); assert.equal(metrics.bottom, 812, label + ' bottom');
        assert.ok(metrics.top >= 16, label + ' top safe clearance');
        assert.equal(metrics.maxWidth, '512px', label + ' max width');
        assert.deepEqual(metrics.radius, ['24px', '0px'], label + ' corners');
        assert.ok(metrics.padding >= 20, label + ' bottom padding'); assert.equal(metrics.overflow, false, label + ' overflow');
        if (process.env.BROWSER_ARTIFACT_DIR && engine === 'WebKit') await page.screenshot({ path: process.env.BROWSER_ARTIFACT_DIR + '/' + label + '-375.png' });
      } finally { await finish(page); }
    }
  });
  test(`${engine}: 430px touch smoke and desktop/short-viewport confirmation bounds`, async () => {
    for (const width of [430, 1024]) {
      const page = await pageFor(engine, width);
      try {
        await openGroup(page, 'empty', '改名'); await page.getByRole('textbox', { name: '编辑分组名称' }).waitFor();
        await button(page, '取消').tap();
        await openGroup(page, 'full', '删除');
        const panel = page.locator('.ui-list-confirm'); await panel.waitFor();
        let rect = await panel.boundingBox(); assert.ok(rect.width <= 512);
        assert.equal(rect.x, (width - rect.width) / 2);
        if (width === 430) assert.equal(rect.y + rect.height, 812);
        else assert.ok(Math.abs(rect.y + rect.height / 2 - 406) < 1);
        await page.setViewportSize({ width, height: 360 });
        await page.evaluate(() => { document.querySelector('#section-delete-title').textContent = '很长的分组名称'.repeat(60); });
        rect = await panel.boundingBox(); assert.ok(rect.y >= 16); assert.ok(rect.y + rect.height <= 360);
        await button(page, '取消').scrollIntoViewIfNeeded(); assert.equal(await button(page, '取消').isVisible(), true);
      } finally { await finish(page); }
    }
  });
}

// Compare actual rendered geometry/styles with the whole-List confirmation, not class names.
async function contentMetrics(panel) {
  return panel.evaluate(panel => {
    const root = panel.matches('.ui-delete-content') ? panel : panel.querySelector('.ui-delete-content') || panel;
    const title = root.querySelector('h2,h3'), paragraphs = [...root.querySelectorAll('p')];
    const target = root.querySelector('.ui-delete-target') || paragraphs[0];
    const warning = root.querySelector('.ui-delete-warning') || paragraphs.find(p => p.textContent.includes('无法恢复')) || paragraphs[1];
    const buttons = [...root.querySelectorAll('button')].filter(button => !['保存', '关闭'].includes(button.textContent.trim()) && !button.getAttribute('aria-label')?.includes('关闭'));
    const actions = root.querySelector('.ui-delete-actions,.ui-delete-options') || buttons.at(-1)?.parentElement;
    const style = element => { const s = getComputedStyle(element); return { size: s.fontSize, weight: s.fontWeight, line: s.lineHeight, color: s.color, align: s.textAlign, family: s.fontFamily }; };
    const rect = panel.getBoundingClientRect(), heading = title?.getBoundingClientRect();
    return {
      title: title?.textContent, target: target?.textContent, warning: warning?.textContent, strong: Boolean(target?.querySelector('strong')),
      typography: title && target && warning ? { title: style(title), target: style(target), warning: style(warning), strong: target.querySelector('strong') && style(target.querySelector('strong')) } : null,
      spacing: heading && target && warning && actions ? { titleLeft: heading.left - rect.left, titleTop: heading.top - rect.top, targetGap: target.getBoundingClientRect().top - heading.bottom, warningGap: warning.getBoundingClientRect().top - target.getBoundingClientRect().bottom, actionGap: actions.getBoundingClientRect().top - warning.getBoundingClientRect().bottom } : null,
      buttons: buttons.map(button => { const s = getComputedStyle(button), r = button.getBoundingClientRect(); return { label: button.textContent, size: s.fontSize, weight: s.fontWeight, line: s.lineHeight, radius: s.borderRadius, padding: [s.paddingLeft, s.paddingRight], height: r.height, color: s.color, background: s.backgroundColor, left: r.left, right: r.right }; }),
    };
  });
}
const contentCases = [
  ['list', '', async page => { await page.locator('#list-detail-menu').tap(); await button(page, '删除清单').tap(); }, '.ui-list-confirm', '删除清单', '清单：', ['分组和项目', '无法恢复']],
  ['list-final', '', async page => { await page.locator('#list-detail-menu').tap(); await button(page, '删除清单').tap(); await button(page, '继续确认').tap(); }, '.ui-list-confirm', '再次确认删除清单', '清单：', ['再次确认', '永久删除']],
  ...layouts.filter(([label]) => ['event', 'task', 'important-entry', 'important-module', 'review', 'item', 'group-empty', 'group-full', 'recurring-event', 'space', 'member-remove', 'member-transfer', 'space-leave'].includes(label)).map(([label, mode, open, selector]) => {
    const data = {
      event: ['删除日程', '日程：', ['无法恢复']], task: ['删除任务', '任务：', ['无法恢复']],
      'important-entry': ['删除重要日', '重要日：', ['无法恢复']], 'important-module': ['删除重要日', '重要日：', ['无法恢复']],
      review: ['删除回顾', '回顾：', ['双方填写的全部内容将永久删除', '无法恢复']], item: ['删除清单项目', '项目：', ['无法恢复']],
      'group-empty': ['删除分组', '分组：', ['空分组', '无法恢复']], 'group-full': ['删除分组', '分组：', ['处理方式', '无法恢复']],
      'recurring-event': ['删除日程', '日程：', ['删除范围', '无法恢复']], space: ['删除空间', '空间：', ['日程、任务、回顾、清单和重要日', '无法恢复']],
      'member-remove': ['移除成员', '成员：', ['个人日程将删除', '共享日程和任务保留']], 'member-transfer': ['转让所有者', '成员：', ['对方成为所有者']],
      'space-leave': ['退出空间', '空间：', ['个人日程将删除', '共享日程保留']],
    }[label];
    return [label, mode, open, selector, ...data];
  }),
  ['space-final', 'space', async page => { await button(page, '删除空间').tap(); await button(page, '继续确认').tap(); }, '.ui-space-confirm', '再次确认删除空间', '空间：', ['再次确认', '所有成员都将失去访问权']],
];
for (const engine of ['WebKit', 'Chrome']) {
  test(`${engine}: 375px deletion content matches List typography, hierarchy, spacing and buttons`, async () => {
    let reference;
    for (const [label, mode, open, selector, title, targetPrefix, warnings] of contentCases) {
      const page = await pageFor(engine, 375, mode);
      try {
        await open(page); const panel = page.locator(selector); await panel.waitFor();
        const metrics = await contentMetrics(panel);
        if (label === 'list') {
          reference = metrics;
          assert.equal(reference.typography.title.size, '18px'); assert.equal(reference.typography.title.weight, '700'); assert.equal(reference.typography.title.line, '28px');
          assert.equal(reference.typography.target.size, '14px'); assert.equal(reference.typography.target.line, '24px');
          assert.deepEqual(reference.spacing, { titleLeft: 20, titleTop: 20, targetGap: 12, warningGap: 12, actionGap: 20 });
          assert.equal(reference.buttons[0].height, 44); assert.equal(reference.buttons[0].radius, '12px');
        }
        assert.equal(metrics.title, title, label + ' heading');
        assert.ok(metrics.target?.startsWith(targetPrefix), label + ' named object'); assert.equal(metrics.strong, true, label + ' object emphasis');
        warnings.forEach(text => assert.ok(metrics.warning.includes(text), label + ' required warning: ' + text));
        assert.deepEqual(metrics.typography, reference.typography, label + ' rendered typography');
        assert.deepEqual(metrics.spacing, reference.spacing, label + ' rendered spacing');
        metrics.buttons.forEach(action => {
          for (const key of ['size', 'weight', 'line', 'radius', 'padding', 'height']) assert.deepEqual(action[key], reference.buttons[0][key], label + ' button ' + key);
        });
        if (!['group-full', 'recurring-event'].includes(label)) {
          assert.equal(metrics.buttons[0].label, '取消', label + ' cancel first');
          assert.equal(metrics.buttons[1].left - metrics.buttons[0].right, 8, label + ' button gap');
          assert.equal(metrics.buttons[1].right, 355, label + ' actions right inset');
          assert.equal(metrics.buttons[0].background, reference.buttons[0].background, label + ' cancel background');
          assert.equal(metrics.buttons[1].background, reference.buttons[1].background, label + ' danger background');
          if (['event', 'task', 'important-entry', 'important-module', 'review', 'item', 'group-empty'].includes(label)) assert.equal(metrics.buttons[1].label, '删除', label + ' ordinary action copy');
        } else {
          const labels = metrics.buttons.map(action => action.label);
          assert.deepEqual(labels, label === 'group-full' ? ['仅删除分组', '删除分组及其中内容', '取消'] : ['仅删除当前事件', '删除当前及未来事件', '取消']);
        }
        assert.equal((await calls(page)).length, 0, label + ' rendering and first confirmation do not write');
        if (process.env.BROWSER_ARTIFACT_DIR && engine === 'WebKit') {
          // Compare the same unfocused visual state; focus containment is covered separately.
          await panel.evaluate(panel => { if (panel.contains(document.activeElement)) document.activeElement.blur(); });
          await panel.screenshot({ path: process.env.BROWSER_ARTIFACT_DIR + '/content-' + label + '-375.png' });
        }
      } finally { await finish(page); }
    }
  });
}
