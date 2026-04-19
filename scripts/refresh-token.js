import fetch from 'node-fetch';

const BASE_URL = 'https://developer.clashofclans.com/api';
const EMAIL    = process.env.COC_EMAIL;
const PASSWORD = process.env.COC_PASSWORD;

async function getIP() {
  const res = await fetch('https://api.ipify.org/');
  return res.text();
}

async function login() {
  const res = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const data = await res.json();
  const setCookie = res.headers.get('set-cookie');
  const cookie = `${setCookie}; game-api-url=${data.swaggerUrl}; game-api-token=${data.temporaryAPIToken}`;
  return cookie;
}

async function listKeys(cookie) {
  const res = await fetch(`${BASE_URL}/apikey/list`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({}),
  });
  const data = await res.json();
  return data.keys || [];
}

async function revokeKey(cookie, id) {
  await fetch(`${BASE_URL}/apikey/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ id }),
  });
}

async function createKey(cookie, ip) {
  const res = await fetch(`${BASE_URL}/apikey/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({
      cidrRanges: [ip],
      name: `auto-${new Date().toISOString().slice(0, 10)}`,
      description: 'Auto-generated key',
    }),
  });
  const data = await res.json();
  return data.key;
}

async function main() {
  if (!EMAIL || !PASSWORD) throw new Error('COC_EMAIL and COC_PASSWORD are required');

  const [cookie, ip] = await Promise.all([login(), getIP()]);

  const keys = await listKeys(cookie);

  const existing = keys.find(k => k.cidrRanges.includes(ip));
  if (existing) {
    process.stdout.write(existing.key);
    return;
  }

  // Revoke oldest non-protected key if at limit
  if (keys.length >= 10) {
    await revokeKey(cookie, keys[0].id);
  }

  const newKey = await createKey(cookie, ip);
  process.stdout.write(newKey.key);
}

main().catch(err => {
  process.stderr.write(`refresh-token error: ${err.message}\n`);
  process.exit(1);
});
