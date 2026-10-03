// Phase 15 verification: rating-based automatch via Redis queues.
async function api(method, path, token, body) {
  const res = await fetch(`http://localhost:3002${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}
const results = [];
function check(name, cond, extra = '') {
  results.push(cond);
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${extra}`);
}
(async () => {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch('http://localhost:3002/api/health');
      if (r.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 3000));
  }
  const tag = Math.floor(Math.random() * 999999);
  const mk = (p) => ({ username: `mm${p}${tag}`, email: `mm${p}${tag}@t.local`, password: 'matkhau123' });
  const reg = async (p) => (await api('POST', '/api/auth/register', null, mk(p))).data;
  const Q1 = await reg('1');
  const Q2 = await reg('2');

  // Q1 xếp hàng -> waiting; Q2 vào -> matched ngay.
  const j1 = await api('POST', '/api/matchmaking/join', Q1.accessToken, { mode: 'RANKED' });
  check('Q1 queued waiting', j1.data.status === 'waiting', JSON.stringify(j1.data));
  const j2 = await api('POST', '/api/matchmaking/join', Q2.accessToken, { mode: 'RANKED' });
  check('Q2 matched instantly', j2.data.status === 'matched' && !!j2.data.matchId, JSON.stringify(j2.data));
  const s1 = await api('GET', '/api/matchmaking/status', Q1.accessToken);
  check('Q1 status matched same match', s1.data.status === 'matched' && s1.data.matchId === j2.data.matchId);

  // Match ghép xong ở READY, Q1 RED (vào trước) - Q2 BLACK.
  const m = await api('GET', `/api/matches/${j2.data.matchId}`);
  check('paired match READY RANKED', m.data.status === 'READY' && m.data.mode === 'RANKED', `${m.data.status}/${m.data.mode}`);
  const players = await api('GET', `/api/matches/${j2.data.matchId}/players`);
  const red = players.data.find((p) => p.color === 'RED');
  const black = players.data.find((p) => p.color === 'BLACK');
  check('earlier waiter sits RED', red?.userId === Q1.user.id && black?.userId === Q2.user.id);

  // Queue CASUAL tách biệt + leave.
  const Q3 = await reg('3');
  const j3 = await api('POST', '/api/matchmaking/join', Q3.accessToken, { mode: 'CASUAL' });
  check('CASUAL queue isolated (waiting)', j3.data.status === 'waiting');
  await api('POST', '/api/matchmaking/leave', Q3.accessToken);
  const s3 = await api('GET', '/api/matchmaking/status', Q3.accessToken);
  check('leave -> idle', s3.data.status === 'idle');

  // Đang có match active thì không được xếp hàng.
  const P1 = await reg('4');
  const P2 = await reg('5');
  const PM = (await api('POST', '/api/matches', P1.accessToken, { mode: 'CASUAL' })).data;
  await api('POST', `/api/matches/${PM.id}/join`, P2.accessToken, {});
  await api('POST', `/api/matches/${PM.id}/ready`, P1.accessToken);
  await api('POST', `/api/matches/${PM.id}/ready`, P2.accessToken);
  const busy = await api('POST', '/api/matchmaking/join', P1.accessToken, { mode: 'RANKED' });
  check('in-match user blocked 409', busy.status === 409, `status=${busy.status}`);
  await api('POST', '/api/matchmaking/leave', P1.accessToken).catch(() => ({}));

  const failed = results.filter((x) => !x).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error('SCRIPT ERROR', e);
  process.exit(2);
});
