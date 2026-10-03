// AI commentary verification: engine-driven template comments on moves.
const { io } = require('socket.io-client');

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) break;
    } catch {}
    await sleep(3000);
  }
  const tag = Math.floor(Math.random() * 999999);
  const mk = (p) => ({ username: `ai${p}${tag}`, email: `ai${p}${tag}@t.local`, password: 'matkhau123' });
  const A = (await api('POST', '/api/auth/register', null, mk('a'))).data;
  const B = (await api('POST', '/api/auth/register', null, mk('b'))).data;

  const M = (await api('POST', '/api/matches', A.accessToken, { mode: 'CASUAL' })).data;
  await api('POST', `/api/matches/${M.id}/join`, B.accessToken, {});
  await api('POST', `/api/matches/${M.id}/ready`, A.accessToken);
  await api('POST', `/api/matches/${M.id}/ready`, B.accessToken);

  const sA = await connect(A.accessToken);
  const sB = await connect(B.accessToken);
  const heard = [];
  sB.on('commentary:new', (d) => heard.push(d));
  await emitAck(sA, 'match:join', { matchId: M.id });
  await emitAck(sB, 'match:join', { matchId: M.id });

  // 1. b0-c2 (khai cuộc) -> AI bình. 2. b9-c7 (khai cuộc) -> AI bình.
  // 3. h0-g2 (lặng) -> AI im. 4. h9-g7 (lặng) -> AI im.
  // 5. e3-e4? turn RED sau 4 nước là RED? b0c2(R) b9c7(B) h0g2(R) h9g7(B) -> turn RED: e3-e4.
  // 6. e6-e5 (BLACK). 7. e4-e5 ăn Chốt (RED) -> AI bình ăn quân.
  const seq = [
    [sA, 'b0', 'c2'],
    [sB, 'b9', 'c7'],
    [sA, 'h0', 'g2'],
    [sB, 'h9', 'g7'],
    [sA, 'e3', 'e4'],
    [sB, 'e6', 'e5'],
    [sA, 'e4', 'e5'],
  ];
  for (const [s, from, to] of seq) {
    const ack = await emitAck(s, 'move:request', { matchId: M.id, from, to });
    if (!ack.ok) {
      check(`move ${from}-${to} accepted`, false, JSON.stringify(ack));
    }
  }
  await sleep(4000); // AI fire-and-forget + broadcast
  const list = await api('GET', `/api/commentary/${M.id}`);
  const aiTexts = (Array.isArray(list.data) ? list.data : []).map((c) => c.content);
  check('opening commented (b0-c2)', aiTexts.some((t) => t.includes('Khai cuộc') && t.includes('Mã')));
  check('capture commented (e4xe5)', aiTexts.some((t) => t.includes('ăn Chốt')));
  check('quiet moves skipped', aiTexts.length <= 4, `${aiTexts.length} comments`);
  check('WS commentary:new received', heard.length >= 1, `${heard.length} events`);
  const bot = await api('GET', `/api/users/${list.data[0]?.userId}`);
  check('author is AI bot', bot.data?.username === 'ai-binh-luan', bot.data?.username);

  sA.disconnect();
  sB.disconnect();
  const failed = results.filter((x) => !x).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error('SCRIPT ERROR', e);
  process.exit(2);
});
