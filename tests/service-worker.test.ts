import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const serviceWorker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

test('service worker handles push and notification clicks without offline behavior', () => {
  assert.match(serviceWorker, /addEventListener\('push'/);
  assert.match(serviceWorker, /showNotification/);
  assert.match(serviceWorker, /addEventListener\('notificationclick'/);
  assert.match(serviceWorker, /clients\.matchAll/);
  assert.match(serviceWorker, /clients\.openWindow\('\/'\)/);
  assert.doesNotMatch(serviceWorker, /addEventListener\('fetch'/);
  assert.doesNotMatch(serviceWorker, /\bcaches\b/);
  assert.doesNotMatch(serviceWorker, /workbox/i);
});
