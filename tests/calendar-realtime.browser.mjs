import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
const { webkit, chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const browsers = new Map(); let files;
before(async () => {
  files = (await build({ root, configFile: false, envFile: false, logLevel: 'error', plugins: [{
    name: 'calendar-offline-io', enforce: 'pre',
    resolveId(id) { if (/\/supabase(?:\.ts)?$/.test(id)) return '\0calendar-test-client'; },
    load(id) { if (id === '\0calendar-test-client') return `export const supabase={
      auth:{onAuthStateChange(...args){return window.calendarFixture.client.auth.onAuthStateChange(...args)}},
      channel(...args){return window.calendarFixture.client.channel(...args)},
      removeChannel(...args){return window.calendarFixture.client.removeChannel(...args)},
      from(...args){return window.calendarFixture.client.from(...args)}};`; },
  }], build: { write: false, minify: false, rollupOptions: { input: root + 'tests/fixtures/calendar-realtime-browser.jsx' } } })).output;
  browsers.set('WebKit', await webkit.launch({ headless: true }));
  browsers.set('Chrome', await chromium.launch({ channel: 'chrome', headless: true }));
});
after(async () => { for (const browser of browsers.values()) await browser.close(); });
async function pageFor(engine, query = '') {
  const page = await browsers.get(engine).newPage({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Shanghai' });
  page.setDefaultTimeout(3000); page.errors = []; page.on('pageerror', error => page.errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url()); assert.equal(url.origin, 'http://127.0.0.1:5175');
    const asset = files.find(file => '/' + file.fileName === url.pathname);
    if (asset) return route.fulfill({ contentType: asset.fileName.endsWith('.css') ? 'text/css' : 'text/javascript', body: asset.type === 'chunk' ? asset.code : asset.source });
    if (url.pathname !== '/__calendar_realtime') return route.abort();
    return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><link rel="stylesheet" href="/${files.find(file => file.fileName.endsWith('.css')).fileName}"><script type="module" src="/${files.find(file => file.isEntry).fileName}"></script></html>` });
  });
  await page.goto('http://127.0.0.1:5175/__calendar_realtime' + query);
  await page.waitForFunction(() => window.calendarFixture?.view?.status === 'success');
  return page;
}
const waitSuccess = page => page.waitForFunction(() => window.calendarFixture.view.status === 'success');
for (const engine of ['WebKit', 'Chrome']) {
  test(`${engine}: cold REST, partial subscription and one compensation per recovered channel`, async () => {
    const page = await pageFor(engine);
    try {
      await page.getByRole('button', { name: '共享日程', exact: true }).click();
      assert.equal(await page.getByLabel('已确认日程').innerText(), '共享日程');
      const before = await page.evaluate(() => window.calendarFixture.validated.length);
      await page.evaluate(() => { const f = window.calendarFixture; f.rows[1].title = '订阅窗口新数据'; f.status(0, 'SUBSCRIBED'); });
      await page.getByRole('button', { name: '订阅窗口新数据', exact: true }).waitFor();
      await page.evaluate(() => { const f = window.calendarFixture; f.status(0, 'CHANNEL_ERROR'); f.status(1, 'TIMED_OUT'); });
      assert.match(await page.getByLabel('同步错误').innerText(), /实时同步暂不可用/);
      await page.evaluate(() => window.calendarFixture.status(0, 'SUBSCRIBED')); await waitSuccess(page);
      assert.match(await page.getByLabel('同步错误').innerText(), /实时同步暂不可用/);
      await page.evaluate(() => window.calendarFixture.status(1, 'SUBSCRIBED')); await waitSuccess(page);
      assert.equal(await page.getByLabel('同步错误').innerText(), '');
      const count = await page.evaluate(() => window.calendarFixture.validated.length); assert.equal(count, before + 3);
      await page.evaluate(() => { for (const channel of window.calendarFixture.channels) channel.status('SUBSCRIBED'); });
      await page.waitForTimeout(200); assert.equal(await page.evaluate(() => window.calendarFixture.validated.length), count);
      await page.evaluate(() => { const f = window.calendarFixture; f.rows[1].title = '正常实时更新'; f.channels[1].changed(); });
      await page.getByRole('button', { name: '正常实时更新', exact: true }).waitFor(); assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
  });
  for (const status of ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']) test(`${engine}: ${status} cannot discard REST or block saved refresh, retry and qualification`, async () => {
    const page = await pageFor(engine);
    try {
      await page.evaluate(() => { const f = window.calendarFixture; f.hold = true; f.rows[1].title = '断线期间有效响应'; });
      await page.getByRole('button', { name: '模拟保存后刷新', exact: true }).click();
      await page.waitForFunction(() => window.calendarFixture.pending.length > 0);
      await page.evaluate(status => { const f = window.calendarFixture; f.status(0, status); f.release(); }, status);
      await page.getByRole('button', { name: '断线期间有效响应', exact: true }).click();
      assert.equal(await page.getByLabel('已确认日程').innerText(), '断线期间有效响应');
      assert.equal(await page.getByLabel('读取状态').innerText(), 'success'); assert.equal(await page.getByLabel('读取错误').innerText(), '');
      assert.match(await page.getByLabel('同步错误').innerText(), /实时同步暂不可用/);
      await page.evaluate(() => { window.calendarFixture.rows[1].title = '断线主动重试'; });
      await page.getByRole('button', { name: '重试读取', exact: true }).click();
      await page.getByRole('button', { name: '断线主动重试', exact: true }).waitFor(); assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
  });
  test(`${engine}: REST error retries offline, membership loss still removes authority`, async () => {
    const page = await pageFor(engine);
    try {
      await page.evaluate(() => { const f = window.calendarFixture; f.fail = true; f.status(0, 'CLOSED'); });
      await page.getByRole('button', { name: '模拟保存后刷新', exact: true }).click();
      await page.waitForFunction(() => window.calendarFixture.view.status === 'error');
      assert.match(await page.getByLabel('读取错误').innerText(), /REST 读取失败/);
      assert.match(await page.getByLabel('同步错误').innerText(), /实时同步暂不可用/);
      await page.evaluate(() => { window.calendarFixture.fail = false; });
      await page.getByRole('button', { name: '重试读取', exact: true }).click(); await waitSuccess(page);
      await page.evaluate(() => { window.calendarFixture.memberId = 'removed'; });
      await page.getByRole('button', { name: '模拟保存后刷新', exact: true }).click();
      await page.waitForFunction(() => window.calendarFixture.view.status === 'error');
      assert.match(await page.getByLabel('读取错误').innerText(), /成员身份已变化/);
      assert.equal(await page.getByRole('button', { name: '共享日程', exact: true }).count(), 0); assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
  });
  test(`${engine}: offline pagination includes last page and canonical recurrence exceptions`, async () => {
    const page = await pageFor(engine, '?many=1');
    try {
      await page.getByRole('button', { name: '末页日程', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: '已排除重复日程', exact: true }).count(), 0);
      const requests = await page.evaluate(() => window.calendarFixture.requests);
      assert.ok(requests.some(r => r.table === 'events' && r.start === 500 && r.filters.space_id === 'personal'));
      assert.ok(requests.some(r => r.table === 'event_occurrence_exceptions' && r.filters.event_id.includes('repeat'))); assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
  });
  for (const boundary of ['account', 'space', 'logout', 'unmount']) test(`${engine}: offline pending REST cannot publish after ${boundary}`, async () => {
    const page = await pageFor(engine);
    try {
      await page.evaluate(() => { const f = window.calendarFixture; f.hold = true; f.rows[1].title = '旧请求结果'; });
      await page.getByRole('button', { name: '模拟保存后刷新', exact: true }).click();
      await page.waitForFunction(() => window.calendarFixture.pending.length > 0);
      await page.evaluate(boundary => {
        const f = window.calendarFixture; f.oldChannels = [...f.channels]; f.hold = false; f.rows[1].title = '新作用域结果';
        if (boundary === 'account') { f.memberId = 'other'; f.setUserId('other'); }
        if (boundary === 'space') f.setSingle(true);
        if (boundary === 'logout') for (const fn of [...f.auth]) fn('SIGNED_OUT', null);
        if (boundary === 'unmount') f.unmount();
      }, boundary);
      if (boundary === 'account' || boundary === 'space') await page.getByRole('button', { name: '新作用域结果', exact: true }).waitFor();
      const before = await page.evaluate(() => window.calendarFixture.validated.length);
      await page.evaluate(() => { const f = window.calendarFixture; f.release(); for (const c of f.oldChannels) { c.status('CHANNEL_ERROR'); c.status('SUBSCRIBED'); c.changed(); } });
      await page.waitForTimeout(200);
      assert.equal(await page.getByRole('button', { name: '旧请求结果', exact: true }).count(), 0);
      assert.equal(await page.evaluate(() => window.calendarFixture.validated.length), before);
      if (boundary === 'space') assert.equal(await page.getByRole('button', { name: '个人日程', exact: true }).count(), 0);
      if (boundary === 'unmount') assert.equal(await page.evaluate(() => window.calendarFixture.channels.length + window.calendarFixture.auth.size), 0);
      assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
  });
}
