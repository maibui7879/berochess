// Event model audit verification: every domain action leaves a game_events row.
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
  const mk = (p) => ({ username: `ev${p}${tag}`, email: `ev${p}${tag}@t.local`, password: 'matkhau123' });
  const A = (await api('POST', '/api/auth/register', null, mk('a'))).data;
  const B = (await api('POST', '/api/auth/register', null, mk('b'))).data;
  const C = (await api('POST', '/api/auth/register', null, mk('c'))).data;

  const M = (await api('POST', '/api/matches', A.accessToken, { mode: 'CASUAL' })).data;
  await api('POST', `/api/matches/${M.id}/join`, B.accessToken, {});
  await api('POST', `/api/matches/${M.id}/ready`, A.accessToken);
  await api('POST', `/api/matches/${M.id}/ready`, B.accessToken);

  const sA = await connect(A.accessToken);
  const sC = await connect(C.accessToken);
  await emitAck(sA, 'match:join', { matchId: M.id });
  await emitAck(sC, 'match:join', { matchId: M.id });
  await emitAck(sA, 'move:request', { matchId: M.id, from: 'b0', to: 'c2' });
  await emitAck(sC, 'spectator:team', { matchId: M.id, team: 'NONE' });
  await emitAck(sC, 'spectator:team', { matchId: M.id, team: 'RED' });
  await emitAck(sC, 'spectator:leave', { matchId: M.id });
  await api('POST', '/api/crowd/reactions', C.accessToken, { matchId: M.id, emoji: '🔥' });
  await api('POST', '/api/chat/messages', A.accessToken, { matchId: M.id, channel: 'MATCH_CHAT', content: 'gg' });
  await api('POST', `/api/matches/${M.id}/resign`, A.accessToken, {});
  await sleep(2000); // cho event async ghi xong

  const ev = await api('GET', `/api/matches/${M.id}/events?limit=100`);
  const types = ev.data.map((e) => e.type);
  for (const t of [
    'MATCH_CREATED',
    'MATCH_STARTED',
    'MOVE_PLAYED',
    'SPECTATOR_TEAM_CHANGED',
    'SPECTATOR_LEFT',
    'REACTION_SENT',
    'CHAT_SENT',
    'GAME_ENDED',
  ]) {
    check(`event ${t} logged`, types.includes(t), types.join(','));
  }
  check('no GAME_CHECK on quiet move', !types.includes('GAME_CHECK'));
  const moves = await api('GET', `/api/matches/${M.id}/events?type=MOVE_PLAYED`);
  check('filter by type', moves.data.length === 1 && moves.data[0].payload.from === 'b0');
  const ended = ev.data.find((e) => e.type === 'GAME_ENDED');
  check('ended payload has winner/reason', ended?.payload?.winner === 'BLACK' && ended?.payload?.endReason === 'RESIGN');

  sA.disconnect();
  sC.disconnect();
  const failed = results.filter((x) => !x).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error('SCRIPT ERROR', e);
  process.exit(2);
});
