// Text commentary realtime verification.
const { io } = require('socket.io-client');
const { Client } = require('pg');
const fs = require('fs');

const BASE = 'http://localhost:3002';
const results = [];
function check(name, cond, extra = '') {
  results.push(cond);
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${extra}`);
}
async function api(method, path, token, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}
async function promoteTo(userId, role) {
  const env = fs.readFileSync('.env', 'utf8');
  const url = env.match(/DATABASE_POOL_URL=(.+)/)[1].trim();
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query('UPDATE users SET role = $1 WHERE id = $2', [role, userId]);
  await c.end();
}
function connect(token) {
  return new Promise((resolve, reject) => {
    const s = io(`${BASE}/game`, { auth: { token }, timeout: 10000 });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
    setTimeout(() => reject(new Error('connect timeout')), 15000);
  });
}
function emitAck(socket, event, payload) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, reason: 'ACK_TIMEOUT' }), 15000);
    socket.emit(event, payload, (res) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}
function onceEvent(socket, event, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`event timeout: ${event}`)), timeoutMs);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}
(async () => {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 3000));
  }
  const tag = Math.floor(Math.random() * 999999);
  const mk = (p) => ({ username: `cm${p}${tag}`, email: `cm${p}${tag}@t.local`, password: 'matkhau123' });
  let caster = (await api('POST', '/api/auth/register', null, mk('caster'))).data;
  const fan = (await api('POST', '/api/auth/register', null, mk('fan'))).data;

  const M = (await api('POST', '/api/matches', caster.accessToken, { mode: 'CASUAL' })).data;
  const sFan = await connect(fan.accessToken);
  await emitAck(sFan, 'match:join', { matchId: M.id });

  // PLAYER viết commentary -> 403.
  const denied = await api('POST', '/api/commentary', caster.accessToken, { matchId: M.id, content: 'xin chao' });
  check('player commentary rejected 403', denied.status === 403, `status=${denied.status}`);

  // Promote + login lại để JWT có role mới.
  await promoteTo(caster.user.id, 'COMMENTATOR');
  caster = (await api('POST', '/api/auth/login', null, { email: `cmcaster${tag}@t.local`, password: 'matkhau123' })).data;
  check('commentator role in JWT', caster.user.role === 'COMMENTATOR', caster.user.role);

  const news = onceEvent(sFan, 'commentary:new');
  const created = await api('POST', '/api/commentary', caster.accessToken, {
    matchId: M.id,
    content: 'Do trang thai can bang',
  });
  check('commentator posts 201', created.status === 201, `status=${created.status}`);
  const evt = await news;
  check('fan receives commentary:new', evt.commentary?.content === 'Do trang thai can bang', JSON.stringify(evt.commentary?.content));

  const list = await api('GET', `/api/commentary/${M.id}`);
  check('commentary listed', Array.isArray(list.data) && list.data.some((c) => c.id === created.data.id));

  sFan.disconnect();
  const failed = results.filter((x) => !x).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error('SCRIPT ERROR', e);
  process.exit(2);
});
