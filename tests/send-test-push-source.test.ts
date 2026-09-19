import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const functionRoot = new URL('../supabase/functions/send-test-push/', import.meta.url);

test('pins the function-only web-push dependency without changing the root package', async () => {
  const denoConfig = JSON.parse(await readFile(new URL('deno.json', functionRoot), 'utf8')) as {
    imports: Record<string, string>;
  };

  assert.equal(denoConfig.imports['@mmmike/web-push/send'], 'npm:@mmmike/web-push@1.3.0/send');
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
  const [source, clientSource, envExample] = await Promise.all([
    readFile(new URL('index.ts', functionRoot), 'utf8'),
    readFile(new URL('../src/lib/push-notifications.ts', import.meta.url), 'utf8'),
    readFile(new URL('../.env.example', import.meta.url), 'utf8'),
  ]);

  assert.match(source, /privateKey: requiredSecret\('VAPID_PRIVATE_KEY'\)/);
  assert.match(source, /通知测试成功/);
  assert.doesNotMatch(clientSource, /VAPID_PRIVATE_KEY/);
  assert.doesNotMatch(envExample, /VAPID_PRIVATE_KEY/);
});

test('returns non-empty diagnostics without logging raw library response data', async () => {
  const [source, logic] = await Promise.all([
    readFile(new URL('index.ts', functionRoot), 'utf8'),
    readFile(new URL('logic.ts', functionRoot), 'utf8'),
  ]);

  assert.match(source, /logger:\s*\{[\s\S]*pushStatusFromLoggerData/);
  assert.match(source, /return jsonResponse\(origin, result\)/);
  assert.match(source, /pushServiceErrorDiagnostic\(error\.statusCode, error\.endpoint\)/);
  assert.match(source, /return jsonResponse\(origin, diagnostic, 502\)/);
  assert.match(logic, /push_service_rejected/);
  assert.match(source, /Unable to send test notification\.' }, 500/);
  assert.doesNotMatch(source, /console\.(?:log|error|warn|debug)\([^)]*loggerData/);
  assert.doesNotMatch(source, /error\.body/);
});
