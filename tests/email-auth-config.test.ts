import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p: string) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
test('signup and existing-user mail both use OTP with confirmed eight-digit email configuration', () => {
 const config = read('supabase/config.toml').split('[auth.email]')[1].split('[auth.sms]')[0];
 assert.match(config, /enable_confirmations = true/);
 assert.match(config, /otp_length = 8/);
 assert.match(config, /\[auth.email.template.confirmation\]/);
 for (const name of ['confirmation', 'magic_link']) {
  const template = read(`supabase/templates/${name}.html`);
  assert.match(template, /{{ \.Token }}/);
  assert.doesNotMatch(template, /ConfirmationURL|TokenHash|href=/);
 }
});
test('login email comes from the authenticated session without changing unified OTP calls', () => {
 const app = read('src/App.tsx');
 assert.match(app, /loginEmail={session.user.email}/);
 assert.match(app, /verifyOtp\({ email, token: otp, type: 'email' }\)/);
});
