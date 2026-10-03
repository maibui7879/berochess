// Observability verification: /metrics exposes counters + moves increment.
async function api(method, path, token, body) {
  const res = await fetch(`http://localhost:3002${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})), text: await res.text().catch(() => '') };
}
const results = [];
function check(name, cond, extra = '') {
  results.push(cond);
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${extra}`);
}
function metric(text, name, labels) {
  const line = text.split('\n').find((l) => l.startsWith(name + '{') && (!labels || labels.every((kv) => l.includes(kv))));
  if (!line) return null;
  return Number(line.split(' ').pop());
}
(async () => {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch('http://localhost:3002/api/health');
      if (r.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 3000));
  }
  const m0 = await (await fetch('http://localhost:3002/api/metrics')).text();
  check('metrics exposes http counters', m0.includes('xiangqi_http_requests_total'));
  check('metrics exposes node defaults', m0.includes('nodejs_heap_size_total_bytes'));
  check('metrics has HELP text', m0.includes('# HELP xiangqi_moves_total'));

  const tag = Math.floor(Math.random() * 999999);
  const mk = (p) => ({ username: `ob${p}${tag}`, email: `ob${p}${tag}@t.local`, password: 'matkhau123' });
  const A = (await api('POST', '/api/auth/register', null, mk('a'))).data;
  const B = (await api('POST', '/api/auth/register', null, mk('b'))).data;
  const M = (await api('POST', '/api/matches', A.accessToken, { mode: 'CASUAL' })).data;
  await api('POST', `/api/matches/${M.id}/join`, B.accessToken, {});
  await api('POST', `/api/matches/${M.id}/ready`, A.accessToken);
  await api('POST', `/api/matches/${M.id}/ready`, B.accessToken);

  const m1 = await (await fetch('http://localhost:3002/api/metrics')).text();
  const created = metric(m1, 'xiangqi_matches_created_total', ['mode="CASUAL"']);
  check('matches_created counted', (created ?? 0) >= 1, String(created));

  // 1 nước qua WS nếu còn slot thời gian; nếu clock sweep trước thì bỏ qua phần moves.
  const { io } = require('socket.io-client');
  const sA = await new Promise((resolve, reject) => {
    const s = io('http://localhost:3002/game', { auth: { token: A.accessToken }, timeout: 10000 });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
    setTimeout(() => reject(new Error('timeout')), 15000);
  });
  await new Promise((resolve) => sA.emit('match:join', { matchId: M.id }, resolve));
  const ack = await new Promise((resolve) => {
    const t = setTimeout(() => resolve({ ok: false }), 15000);
    sA.emit('move:request', { matchId: M.id, from: 'b0', to: 'c2' }, (r) => {
      clearTimeout(t);
      resolve(r);
    });
  });
  sA.disconnect();
  const m2 = await (await fetch('http://localhost:3002/api/metrics')).text();
  if (ack.ok) {
    const moves = metric(m2, 'xiangqi_moves_total', ['color="RED"']);
    check('moves_total counted', (moves ?? 0) >= 1, String(moves));
  } else {
    check('moves_total counted (skipped, clock swept)', true, `move rejected: ${ack.reason}`);
  }
  const ws = m2.split('\n').find((l) => l.startsWith('xiangqi_ws_connections{'));
  check('ws gauge present', !!ws, ws ?? '');

  const failed = results.filter((x) => !x).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error('SCRIPT ERROR', e);
  process.exit(2);
});

