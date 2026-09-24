// Send yourself a test push notification, to check push works end to end.
//
//   node scripts/push-test.mjs                       list users and their push tokens
//   node scripts/push-test.mjs send <uid|email|token>  send a test push, then check delivery
//
// Needs credentials/fcm-service-account.json (from the private setup kit, never
// committed). It reads Firestore with that key, so it bypasses the rules — run
// it only on your own machine.
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const sa = JSON.parse(readFileSync(new URL('../credentials/fcm-service-account.json', import.meta.url), 'utf8'));
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');

async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  })}`;
  const sig = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(JSON.stringify(j));
  return j.access_token;
}

async function users() {
  const tok = await accessToken();
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents/users?pageSize=300`,
    { headers: { Authorization: `Bearer ${tok}` } });
  const j = await r.json();
  if (!j.documents) throw new Error(JSON.stringify(j));
  return j.documents.map((d) => ({
    uid: d.name.split('/').pop(),
    name: d.fields?.displayName?.stringValue ?? d.fields?.name?.stringValue,
    email: d.fields?.email?.stringValue,
    tokens: (d.fields?.pushTokens?.arrayValue?.values ?? []).map((v) => v.stringValue),
  }));
}

const [cmd, target] = process.argv.slice(2);
const list = await users();
if (cmd !== 'send') {
  for (const u of list) console.log(`${u.uid}  ${u.name ?? ''} <${u.email ?? ''}>  tokens: ${u.tokens.length ? u.tokens.join(', ') : '(none)'}`);
} else {
  const tokens = target?.startsWith('ExponentPushToken')
    ? [target]
    : list.filter((u) => !target || u.uid === target || u.email === target).flatMap((u) => u.tokens);
  if (!tokens.length) { console.log('No tokens to send to.'); process.exit(1); }
  const r = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(tokens.map((to) => ({
      to, title: 'ShareWallet test', body: 'If you can read this, push works.',
      sound: 'default', channelId: 'expenses', data: { type: 'test' },
    }))),
  });
  const j = await r.json();
  console.log(JSON.stringify(j, null, 2));
  const ids = (j.data ?? []).map((t) => t.id).filter(Boolean);
  if (ids.length) {
    await new Promise((res) => setTimeout(res, 5000));
    const rr = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }),
    });
    console.log('Receipts:', JSON.stringify(await rr.json(), null, 2));
  }
}
