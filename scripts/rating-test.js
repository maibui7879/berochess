// Phase 14 verification: RANKED resign updates Glicko-2, CASUAL untouched, leaderboard ordered.
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
  const mk = (p) => ({ username: `rt${p}${tag}`, email: `rt${p}${tag}@t.local`, password: 'matkhau123' });
  const R1 = (await api('POST', '/api/auth/register', null, mk('1'))).data;
  const R2 = (await api('POST', '/api/auth/register', null, mk('2'))).data;

  // RANKED match, R1 (RED) resigns -> BLACK (R2) wins.
  const M = (await api('POST', '/api/matches', R1.accessToken, { mode: 'RANKED' })).data;
  await api('POST', `/api/matches/${M.id}/join`, R2.accessToken, {});
  await api('POST', `/api/matches/${M.id}/ready`, R1.accessToken);
  await api('POST', `/api/matches/${M.id}/ready`, R2.accessToken);
  const fin = await api('POST', `/api/matches/${M.id}/resign`, R1.accessToken, {});
  check('ranked resign FINISHED', fin.data.status === 'FINISHED' && fin.data.winner === 'BLACK');

  const r1 = await api('GET', `/api/ratings/user/${R1.user.id}/COMPETITIVE`);
  const r2 = await api('GET', `/api/ratings/user/${R2.user.id}/COMPETITIVE`);
  check('loser rating down', r1.data.rating < 1500, String(r1.data.rating));
  check('winner rating up', r2.data.rating > 1500, String(r2.data.rating));
  check('symmetric swing', Math.abs(r2.data.rating - 1500 - (1500 - r1.data.rating)) < 0.01);
  check('games incremented', r1.data.games === 1 && r2.data.games === 1);
  check('RD tightened', r1.data.ratingDeviation < 350 && r2.data.ratingDeviation < 350);
  const h2 = await api('GET', `/api/ratings/user/${R2.user.id}/history`);
  check('history recorded', h2.data.length === 1 && h2.data[0].matchId === M.id && h2.data[0].ratingBefore === 1500);

  const lb = await api('GET', '/api/ratings/leaderboard?type=COMPETITIVE&limit=200');
  const ids = lb.data.map((r) => r.userId);
  check('leaderboard winner above loser', ids.indexOf(R2.user.id) < ids.indexOf(R1.user.id));

  // CASUAL match finish must NOT touch ratings.
  const C = (await api('POST', '/api/matches', R1.accessToken, { mode: 'CASUAL' })).data;
  await api('POST', `/api/matches/${C.id}/join`, R2.accessToken, {});
  await api('POST', `/api/matches/${C.id}/ready`, R1.accessToken);
  await api('POST', `/api/matches/${C.id}/ready`, R2.accessToken);
  await api('POST', `/api/matches/${C.id}/resign`, R2.accessToken, {});
  const r1b = await api('GET', `/api/ratings/user/${R1.user.id}/COMPETITIVE`);
  check('casual leaves rating untouched', r1b.data.rating === r1.data.rating && r1b.data.games === 1);

  const failed = results.filter((x) => !x).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error('SCRIPT ERROR', e);
  process.exit(2);
});
