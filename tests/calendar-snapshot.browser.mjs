import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
const { webkit, chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const browsers = new Map(); let files;
before(async () => {
  files = (await build({ root, configFile: false, envFile: false, logLevel: 'error', plugins: [{
    name: 'calendar-snapshot-io', enforce: 'pre',
    resolveId(id) {
      if (/\/supabase(?:\.ts)?$/.test(id)) return '\0snapshot-client';
      if (/\/important-dates-data(?:\.ts)?$/.test(id)) return '\0snapshot-data';
    },
    load(id) {
      if (id === '\0snapshot-client') return `export const isSupabaseConfigured=true;export const supabase={auth:{onAuthStateChange(...a){return window.snapshotFixture.client.auth.onAuthStateChange(...a)}},
        channel(...a){return window.snapshotFixture.client.channel(...a)},removeChannel(...a){return window.snapshotFixture.client.removeChannel(...a)},from(...a){return window.snapshotFixture.client.from(...a)}};`;
      if (id === '\0snapshot-data') return `export * from ${JSON.stringify(root + 'src/lib/important-dates-data.ts?actual')};export const loadCalendarImportantDates=(...a)=>window.snapshotFixture.load(...a);`;
    },
  }], build: { write: false, minify: false, rollupOptions: { input: root + 'tests/fixtures/calendar-snapshot-browser.jsx' } } })).output;
  browsers.set('WebKit', await webkit.launch({ headless: true }));
  browsers.set('Chrome', await chromium.launch({ channel: 'chrome', headless: true }));
});
after(async () => { for (const browser of browsers.values()) await browser.close(); });
async function pageFor(engine, empty = false) {
  const page = await browsers.get(engine).newPage({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Shanghai' });
  page.setDefaultTimeout(3000); page.errors = []; page.on('pageerror', error => page.errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url()); assert.equal(url.origin, 'http://127.0.0.1:5175');
    const asset = files.find(file => '/' + file.fileName === url.pathname);
    if (asset) return route.fulfill({ contentType: asset.fileName.endsWith('.css') ? 'text/css' : 'text/javascript', body: asset.type === 'chunk' ? asset.code : asset.source });
    if (url.pathname !== '/__calendar_snapshot') return route.abort();
    return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><link rel="stylesheet" href="/${files.find(file => file.fileName.endsWith('.css')).fileName}"><script type="module" src="/${files.find(file => file.isEntry).fileName}"></script></html>` });
  });
  await page.goto('http://127.0.0.1:5175/__calendar_snapshot' + (empty ? '?empty=1' : ''));
  await page.waitForFunction(() => window.snapshotFixture?.validated.length > 0); return page;
}
async function switchPending(page, view) {
  const reads = await page.evaluate(() => window.snapshotFixture.reads);
  await page.evaluate(view => { const f = window.snapshotFixture; f.hold = true; f.setView(view); }, view);
  await page.waitForFunction(reads => window.snapshotFixture.reads > reads && window.snapshotFixture.pending.length > 0, reads);
}
async function finish(page) {
  const before = await page.evaluate(() => window.snapshotFixture.validated.length);
  await page.evaluate(() => window.snapshotFixture.release());
  await page.waitForFunction(before => window.snapshotFixture.validated.length > before, before);
}
async function assertCovered(page) {
  assert.equal(await page.getByText('当前范围尚未完整确认。', { exact: true }).count(), 0);
  assert.equal(await page.getByText('正在读取重要日…', { exact: true }).count(), 0);
}
for (const engine of ['WebKit', 'Chrome']) {
  for (const empty of [false, true]) test(`${engine}: ${empty ? 'empty' : 'nonempty'} month-week-day-week-month and week-day-week preserve real coverage`, async () => {
    const page = await pageFor(engine, empty);
    try {
      const range = await page.evaluate(() => window.snapshotFixture.validated.at(-1).range);
      for (const view of ['week', 'today', 'week', 'month', 'week', 'today', 'week']) {
        await switchPending(page, view); await assertCovered(page);
        assert.equal(await page.getByText('重要日更新中…', { exact: true }).count(), 0);
        if (!empty && view !== 'month') assert.ok(await page.getByRole('button', { name: '打开重要日 当天重要日', exact: true }).count());
        await finish(page); await assertCovered(page);
        assert.deepEqual(await page.evaluate(() => window.snapshotFixture.validated.at(-1).range), range);
      }
      await page.evaluate(() => window.snapshotFixture.setMounted(false));
      await page.waitForFunction(() => window.snapshotFixture.channels.length === 0);
      await page.evaluate(() => { const f = window.snapshotFixture; f.hold = true; f.setMounted(true); });
      await page.waitForFunction(() => window.snapshotFixture.pending.length > 0); await assertCovered(page);
      assert.equal(await page.getByText('重要日更新中…', { exact: true }).count(), 0); await finish(page);
      assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
  });
  test(`${engine}: subrange edits and empty results replace just their interval; new month stays incomplete`, async () => {
    const page = await pageFor(engine);
    try {
      await page.evaluate(() => { const f = window.snapshotFixture; f.rows[1].name = '已更新当天'; });
      await switchPending(page, 'today'); await assertCovered(page); await finish(page);
      await page.getByRole('button', { name: '打开重要日 已更新当天', exact: true }).waitFor();
      assert.deepEqual(await page.evaluate(() => window.snapshotFixture.validated.at(-1).items.map(item => item.name)), ['周初重要日', '已更新当天', '月内重要日']);
      await page.evaluate(() => { const f = window.snapshotFixture; f.rows = f.rows.filter(row => row.id !== 'today'); f.hold = true; window.dispatchEvent(new Event('focus')); });
      await page.waitForFunction(() => window.snapshotFixture.pending.length > 0); await finish(page);
      assert.deepEqual(await page.evaluate(() => window.snapshotFixture.validated.at(-1).items.map(item => item.name)), ['周初重要日', '月内重要日']);
      await switchPending(page, 'month'); await assertCovered(page); await finish(page);
      await page.evaluate(() => { const f = window.snapshotFixture; f.hold = true; f.setDate(new Date(2026, 10, 10)); });
      await page.getByText('当前范围尚未完整确认。', { exact: true }).waitFor();
      assert.equal(await page.getByText('重要日更新中…', { exact: true }).count(), 1); await finish(page);
      assert.deepEqual(await page.evaluate(() => window.snapshotFixture.validated.at(-1).range), { start: { year: 2026, month: 10, day: 26 }, end: { year: 2026, month: 12, day: 6 } });
      assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
  });
  test(`${engine}: late subrange and Event refresh cannot overwrite or reread current Important Dates`, async () => {
    const page = await pageFor(engine);
    try {
      const reads = await page.evaluate(() => window.snapshotFixture.reads);
      await page.evaluate(() => { for (const channel of window.snapshotFixture.channels) channel.change(); });
      await page.waitForTimeout(200); assert.equal(await page.evaluate(() => window.snapshotFixture.reads), reads);
      await switchPending(page, 'today');
      await page.evaluate(() => { const f = window.snapshotFixture; f.hold = false; f.rows[1].name = '最新周内容'; f.setView('week'); });
      await page.getByRole('button', { name: '打开重要日 最新周内容', exact: true }).waitFor();
      const count = await page.evaluate(() => window.snapshotFixture.validated.length);
      await page.evaluate(() => window.snapshotFixture.release()); await page.waitForTimeout(50);
      assert.equal(await page.evaluate(() => window.snapshotFixture.validated.length), count); await assertCovered(page);
      await page.getByRole('button', { name: '打开重要日 最新周内容', exact: true }).waitFor(); assert.deepEqual(page.errors, []);
    } finally { await page.close(); }
  });
}
