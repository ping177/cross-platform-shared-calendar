// Local integration artifact only. Original handlers + real Auth/PostgREST;
// external provider transport is replaced so no real Push can leave the test.
import { build } from 'esbuild';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const output = process.argv[2];
if (!output || !path.isAbsolute(output)) throw new Error('A temporary absolute output directory is required');
// Resolve the entrypoint's pinned SDK from the existing Deno cache, never from
// the frontend's newer SDK. No network/package installation is permitted here.
const cache = JSON.parse(execFileSync('deno', ['info', '--json'], {encoding:'utf8'})).npmCache;
const registry = (await readdir(cache)).find(name => name === 'registry.npmmirror.com');
if (!registry) throw new Error('Existing pinned Deno cache unavailable');
const versions = {'@supabase/supabase-js':'2.57.0','@supabase/auth-js':'2.71.1',
  '@supabase/functions-js':'2.4.5','@supabase/node-fetch':'2.6.15','@supabase/postgrest-js':'1.21.3',
  '@supabase/realtime-js':'2.15.4','@supabase/storage-js':'2.116.0','iceberg-js':'0.8.1','tslib':'2.8.1','ws':'8.21.3'};
const entries = {};
for (const [name, version] of Object.entries(versions)) {
  const dir=path.join(cache,registry,name,version);
  const pkg=JSON.parse(await readFile(path.join(dir,'package.json'),'utf8'));
  const entry=typeof pkg.browser==='string'?pkg.browser:pkg.module||pkg.main;
  entries[name]=path.resolve(dir,entry);
}
console.log('Existing cached SDK/dependencies:',JSON.stringify(versions));
const selected = process.argv[3] ? [process.argv[3]] : ['send-test-push', 'send-reminders'];
if (selected.some(name => !['send-test-push','send-reminders','account-deletion'].includes(name))) throw new Error('Unknown local entrypoint');
for (const name of selected) {
  await mkdir(path.join(output, name), { recursive: true });
  await build({ entryPoints: [`supabase/functions/${name}/index.ts`], bundle: true, format: 'esm',
    platform: 'browser', target: 'es2022', outfile: path.join(output, name, 'index.ts'), plugins: [{
      name: 'local-provider-only', setup(builder) {
        builder.onResolve({filter:/^(@supabase\/|iceberg-js$|tslib$|ws$)/}, args => {
          if (!entries[args.path]) throw new Error('Unreviewed cached dependency: '+args.path);
          return {path:entries[args.path]};
        });
        builder.onResolve({ filter: /^npm:@mmmike\/web-push/ }, () => ({ path: 'provider', namespace: 'gate' }));
        builder.onLoad({ filter: /.*/, namespace: 'gate' }, () => ({ contents: `
          export class WebPushError extends Error {};
          export async function sendPushNotification(_s,_p,_v,options) {
            await fetch('http://storage:8080/test-push', {method:'POST'});
            options.logger.debug('local', {status:201}); return true;
          }` }));
      },
    }] });
}
await writeFile(path.join(output, 'gateway.mjs'), `
import {createServer} from 'node:http';
let pushes=0;
createServer(async(req,res)=>{
 try {
  if(req.url==='/test-push'){pushes++;res.writeHead(201).end();return;}
  if(req.url==='/test-stat'){res.end(JSON.stringify({pushes}));return;}
  const [prefix,base]=req.url.startsWith('/auth/v1/')?['/auth/v1','http://auth:9999']:['/rest/v1','http://rest:3000'];
  if(!req.url.startsWith(prefix+'/')){res.writeHead(404).end();return;}
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const headers={...req.headers};delete headers.host;delete headers.connection;delete headers['content-length'];
  const r=await fetch(base+req.url.slice(prefix.length),{method:req.method,headers,
    body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
  res.writeHead(r.status,Object.fromEntries([...r.headers].filter(([key])=>!['transfer-encoding','content-encoding'].includes(key))));
  res.end(Buffer.from(await r.arrayBuffer()));
 }catch{res.writeHead(502).end();}
}).listen(8080,'0.0.0.0');
`);
console.log('Local bundles ready; external Push provider is synthetic');
