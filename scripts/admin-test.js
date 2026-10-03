// Admin module verification: bootstrap, privileges, force-finish.
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) break;
    } catch {}
    await sleep(3000);
  }
  // ADMIN_EMAILS=boss@test.local trên server dev.
  const boss = (await api('POST', '/api/auth/register', null, {
    username: `boss${Date.now() % 100000}`,
    email: 'boss@test.local',
    password: 'matkhau123',
  })).data;
  // Nếu boss đã tồn tại từ lần chạy trước -> login (vẫn auto-promote).
  let bossToken = boss.accessToken;
  let bossRole = boss.user?.role;
  if (!bossToken) {
    const login = await api('POST', '/api/auth/login', null, { email: 'boss@test.local', password: 'matkhau123' });
    bossToken = login.data.accessToken;
    bossRole = login.data.user?.role;
  }
  check('bootstrap admin on register/login', bossRole === 'ADMIN', bossRole);

  const stats = await api('GET', '/api/admin/stats', bossToken);
  check('admin stats', stats.status === 200 && typeof stats.data.users === 'number' && stats.data.matches, JSON.stringify({ users: stats.data.users }));

  const pleb = (await api('POST', '/api/auth/register', null, {
    username: `pleb${Date.now() % 100000}`,
    email: `pleb${Date.now() % 100000}@t.local`,
    password: 'matkhau123',
  })).data;
  const deniedStats = await api('GET', '/api/admin/stats', pleb.accessToken);
  check('non-admin blocked 403', deniedStats.status === 403, `status=${deniedStats.status}`);
  const deniedPatch = await api('PATCH', `/api/admin/users/${pleb.user.id}`, pleb.accessToken, { role: 'ADMIN' });
  check('non-admin cannot self-promote', deniedPatch.status === 403, `status=${deniedPatch.status}`);

  // Admin phong MODERATOR.
  const promoted = await api('PATCH', `/api/admin/users/${pleb.user.id}`, bossToken, { role: 'MODERATOR' });
  check('admin promotes to MODERATOR', promoted.status === 200 && promoted.data.role === 'MODERATOR', promoted.data.role);
  const found = await api('GET', `/api/admin/users?role=MODERATOR&search=pleb`, bossToken);
  check('admin users filter', Array.isArray(found.data) && found.data.some((u) => u.id === pleb.user.id));

  // Admin force-finish 1 ván đang đánh.
  const P1 = (await api('POST', '/api/auth/register', null, {
    username: `fp${Date.now() % 100000}`, email: `fp${Date.now() % 100000}@t.local`, password: 'matkhau123',
  })).data;
  const P2 = (await api('POST', '/api/auth/register', null, {
    username: `fq${Date.now() % 100000}`, email: `fq${Date.now() % 100000}@t.local`, password: 'matkhau123',
  })).data;
  const M = (await api('POST', '/api/matches', P1.accessToken, { mode: 'CASUAL' })).data;
  await api('POST', `/api/matches/${M.id}/join`, P2.accessToken, {});
  await api('POST', `/api/matches/${M.id}/ready`, P1.accessToken);
  await api('POST', `/api/matches/${M.id}/ready`, P2.accessToken);
  const fin = await api('POST', `/api/admin/matches/${M.id}/finish`, bossToken, { winner: 'DRAW', endReason: 'DRAW' });
  check('admin force-finish DRAW', fin.status === 201 && fin.data.status === 'FINISHED', `${fin.status}/${fin.data.status}`);

  const failed = results.filter((x) => !x).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error('SCRIPT ERROR', e);
  process.exit(2);
});
