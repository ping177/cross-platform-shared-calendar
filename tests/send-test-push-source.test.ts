import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const functionRoot = new URL('../supabase/functions/send-test-push/', import.meta.url);
const sharedSenderUrl = new URL('../supabase/functions/_shared/web-push.ts', import.meta.url);

test('pins the function-only web-push dependency without changing the root package', async () => {
  const [denoConfig, sharedSource, packageJson, appTsconfig] = await Promise.all([
    readFile(new URL('deno.json', functionRoot), 'utf8').then((source) => JSON.parse(source)) as Promise<{
      imports: Record<string, string>;
    }>,
    readFile(sharedSenderUrl, 'utf8'),
    readFile(new URL('../package.json', import.meta.url), 'utf8'),
    readFile(new URL('../tsconfig.app.json', import.meta.url), 'utf8'),
  ]);

  assert.equal(denoConfig.imports['@mmmike/web-push/send'], 'npm:@mmmike/web-push@1.3.0/send');
  assert.match(sharedSource, /npm:\@mmmike\/web-push\@1\.3\.0\/send/);
  assert.doesNotMatch(packageJson, /@mmmike\/web-push/);
  assert.doesNotMatch(appTsconfig, /web-push\.ts/);
});

test('preserves the existing CORS origins, preflight, and POST-only boundary', async () => {
  const source = await readFile(new URL('index.ts', functionRoot), 'utf8');

  assert.match(source, /https:\/\/cross-platform-shared-calendar\.vercel\.app/);
  assert.match(source, /http:\/\/127\.0\.0\.1:5175/);
  assert.match(source, /http:\/\/localhost:5175/);
  assert.match(source, /Access-Control-Allow-Methods': 'POST, OPTIONS'/);
  assert.match(source, /request\.method === 'OPTIONS'[\s\S]*status: 204/);
  assert.match(source, /request\.method !== 'POST'[\s\S]*Method not allowed\.' }, 405/);
  assert.match(source, /Origin is not allowed\.' }, 403/);
});

test('authenticates the caller and scopes lookup and disable operations to that user', async () => {
  const source = await readFile(new URL('index.ts', functionRoot), 'utf8');

  assert.match(source, /auth\.getUser/);
  assert.match(source, /\.eq\('user_id', lookupUserId\)/);
  assert.match(source, /\.eq\('installation_id', lookupInstallationId\)/);
  assert.match(source, /\.eq\('id', subscriptionId\)/);
  assert.doesNotMatch(source, /body\.endpoint/);
});

test('maps non-object JSON and missing installation ids to client errors', async () => {
  const source = await readFile(new URL('index.ts', functionRoot), 'utf8');

  assert.match(source, /installationId === null[\s\S]*Request body must be a JSON object\.' }, 400/);
  assert.match(source, /message === 'Invalid installation id\.'[\s\S]*return jsonResponse\(origin, \{ error: message \}, 400\)/);
});

test('keeps VAPID private material server-only and uses a fixed test payload', async () => {
  const [source, sharedSource, clientSource, envExample] = await Promise.all([
    readFile(new URL('index.ts', functionRoot), 'utf8'),
    readFile(sharedSenderUrl, 'utf8'),
    readFile(new URL('../src/lib/push-notifications.ts', import.meta.url), 'utf8'),
    readFile(new URL('../.env.example', import.meta.url), 'utf8'),
  ]);

  assert.match(source, /loadVapidConfig/);
  assert.match(sharedSource, /VAPID_PRIVATE_KEY/);
  assert.match(source, /通知测试成功/);
  assert.doesNotMatch(clientSource, /VAPID_PRIVATE_KEY/);
  assert.doesNotMatch(envExample, /VAPID_PRIVATE_KEY/);
});

test('returns non-empty diagnostics without logging raw library response data', async () => {
  const [source, logic, sharedSource] = await Promise.all([
    readFile(new URL('index.ts', functionRoot), 'utf8'),
    readFile(new URL('logic.ts', functionRoot), 'utf8'),
    readFile(sharedSenderUrl, 'utf8'),
  ]);

  assert.match(source, /sendWebPush/);
  assert.match(source, /return jsonResponse\(origin, result\)/);
  assert.match(source, /return jsonResponse\(origin, diagnostic, 502\)/);
  assert.match(logic, /push_service_rejected/);
  assert.match(source, /Unable to send test notification\.' }, 500/);
  assert.doesNotMatch(source, /console\.(?:log|error|warn|debug)\([^)]*loggerData/);
  assert.doesNotMatch(source, /error\.body/);
  assert.doesNotMatch(sharedSource, /console\./);
  assert.doesNotMatch(sharedSource, /error\.(?:body|endpoint|message|stack)/);
});
