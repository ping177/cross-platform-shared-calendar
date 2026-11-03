import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'vite';
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
let files;
const browsers = new Map();
before(async () => {
  files = (await build({ configFile: false, envFile: false, logLevel: 'error', plugins: [{ name: 'email-fixture', resolveId(id) { if (id === 'email-fixture') return '\0email-fixture'; }, load(id) { if (id === '\0email-fixture') return `import React from 'react';import {createRoot} from 'react-dom/client';import {LoginEmail} from '${process.cwd()}/src/components/LoginEmail.tsx';import '${process.cwd()}/src/styles.css';const root=createRoot(document.getElementById('root'));window.show=u=>root.render(u?React.createElement(LoginEmail,u):null);window.copies=[];Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.copies.push(text);if(window.copyMode==='fail')throw Error('fixture');if(window.copyMode==='wait')await new Promise(r=>window.releaseCopy=r);}}});window.show({userId:'a',email:'first.last@gmail.com'});`; } }], build: { write: false, minify: false, rollupOptions: { input: 'email-fixture' } } })).output;
  browsers.set('WebKit', await webkit.launch()); browsers.set('Chrome', await chromium.launch({ channel: 'chrome' }));
});
after(async () => { for (const b of browsers.values()) await b.close(); });
async function pageFor(engine) {
  const p = await browsers.get(engine).newPage({ viewport: { width: 375, height: 812 } });
  p.setDefaultTimeout(3000);
  await p.route('**/*', route => {
    const u = new URL(route.request().url()); assert.equal(u.origin, 'http://127.0.0.1:5175');
    const f = files.find(f => '/' + f.fileName === u.pathname);
    return route.fulfill(f ? { contentType: f.fileName.endsWith('.css') ? 'text/css' : 'text/javascript', body: f.type === 'chunk' ? f.code : f.source } : { contentType: 'text/html', body: `<html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><link rel="stylesheet" href="/${files.find(f=>f.fileName.endsWith('.css')).fileName}"><script type="module" src="/${files.find(f=>f.isEntry).fileName}"></script></html>` });
  });
  await p.goto('http://127.0.0.1:5175/email');
  await p.getByText('first.last@gmail.com', { exact: true }).waitFor();
  return p;
}
for (const engine of ['WebKit', 'Chrome']) {
  test(`${engine}: Auth email preserves dots, copies exactly, wraps and handles clipboard failure`, async () => {
    const p = await pageFor(engine);
    try {
      await p.getByRole('button', { name: '复制登录邮箱' }).click();
      await p.getByRole('status').filter({ hasText: '邮箱已复制' }).waitFor();
      assert.deepEqual(await p.evaluate(()=>window.copies), ['first.last@gmail.com']);
      await p.evaluate(()=>{window.copyMode='fail';window.show({userId:'a',email:'long.email.address.with.dots.and.extra.characters@example.test'});});
      await p.getByText('long.email.address.with.dots.and.extra.characters@example.test', { exact:true }).waitFor();
      assert.equal(await p.getByRole('status').count(),0);
      await p.getByRole('button', { name: '复制登录邮箱' }).click();
      await p.getByText('复制失败，请长按邮箱手动复制').waitFor();
      for (const width of [320,375,390]) { await p.setViewportSize({width,height:812});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true); }
    } finally { await p.close(); }
  });
  test(`${engine}: account/email changes and logout reject late copy feedback`, async () => {
    const p = await pageFor(engine);
    try {
      await p.evaluate(()=>window.copyMode='wait');
      await p.getByRole('button', { name:'复制登录邮箱' }).click();
      await p.waitForFunction(()=>Boolean(window.releaseCopy));
      await p.evaluate(()=>window.show({userId:'b',email:'firstlast@gmail.com'}));
      await p.getByText('firstlast@gmail.com',{exact:true}).waitFor();
      await p.evaluate(()=>window.releaseCopy());
      assert.equal(await p.getByText('first.last@gmail.com',{exact:true}).count(),0);
      assert.equal(await p.getByRole('status').count(),0);
      await p.evaluate(()=>window.show({userId:'b'}));
      await p.getByText('当前账号未提供邮箱').waitFor();
      assert.equal(await p.getByRole('button').count(),0);
      await p.evaluate(()=>window.show(null));
      await p.waitForFunction(()=>!document.querySelector('section'));
    } finally { await p.close(); }
  });
}
