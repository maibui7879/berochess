// Live verification for Phase 6 GameGateway (namespace /game).
// Run: node ws-live-test.js   (needs backend on :3002)
const { io } = require('socket.io-client');

const BASE = 'http://localhost:3002';
const results = [];
function check(name, cond, extra = '') {
  results.push([cond ? 'PASS' : 'FAIL', name, extra]);
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
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function waitForHealth(tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 3000));
  }
  return false;
}

function connect(token) {
  return new Promise((resolve, reject) => {
    const s = io(`${BASE}/game`, { auth: { token }, timeout: 10000 });
    s.on('connect', () => resolve(s));
    s.on('connect_error', (e) => reject(e));
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
  check('server up', await waitForHealth());
  const tag = Math.floor(Math.random() * 999999);
  const mk = (p) => ({ username: `ws${p}${tag}`, email: `ws${p}${tag}@t.local`, password: 'matkhau123' });
  const A = (await api('POST', '/api/auth/register', null, mk('a'))).data;
  const B = (await api('POST', '/api/auth/register', null, mk('b'))).data;
  const C = (await api('POST', '/api/auth/register', null, mk('c'))).data;
  check('register A/B/C', !!(A.accessToken && B.accessToken && C.accessToken));

  const M = (await api('POST', '/api/matches', A.accessToken, { mode: 'CASUAL' })).data;
  await api('POST', `/api/matches/${M.id}/join`, B.accessToken, {});
  await api('POST', `/api/matches/${M.id}/ready`, A.accessToken);
  await api('POST', `/api/matches/${M.id}/ready`, B.accessToken);
  const g = await api('GET', `/api/matches/${M.id}`);
  check('match PLAYING via REST', g.data.status === 'PLAYING', g.data.status);

  const sA = await connect(A.accessToken);
  const sB = await connect(B.accessToken);
  check('WS connect A+B (JWT handshake)', sA.connected && sB.connected);

  // B joins first so we can observe player:joined on A side later? A joins first.
  const joinA = await emitAck(sA, 'match:join', { matchId: M.id });
  check('A match:join snapshot', joinA.ok === true && joinA.myColor === 'RED', JSON.stringify(joinA.myColor));
  check('snapshot has initial FEN', typeof joinA.state?.board === 'string' && joinA.state.board.startsWith('rnbakabnr'));

  const joinedOnA = onceEvent(sA, 'player:joined');
  const joinB = await emitAck(sB, 'match:join', { matchId: M.id });
  check('B match:join snapshot BLACK', joinB.ok === true && joinB.myColor === 'BLACK');
  const joinedEvt = await joinedOnA;
  check('A receives player:joined for B', joinedEvt.userId === B.user.id, JSON.stringify(joinedEvt.color));

  // A (RED) plays horse b0->c2.
  const playedOnB = onceEvent(sB, 'move:played');
  const ack1 = await emitAck(sA, 'move:request', { matchId: M.id, from: 'b0', to: 'c2' });
  check('A move b0-c2 accepted', ack1.ok === true && ack1.moveNumber === 1, JSON.stringify(ack1));
  const played1 = await playedOnB;
  check('B receives move:played turn=BLACK', played1.turn === 'BLACK' && played1.from === 'b0', `turn=${played1.turn}`);

  // A tries to move again out of turn.
  const ack2 = await emitAck(sA, 'move:request', { matchId: M.id, from: 'c2', to: 'd4' });
  check('A second move rejected NOT_YOUR_TURN', ack2.ok === false && ack2.reason === 'NOT_YOUR_TURN', JSON.stringify(ack2));

  // B tries illegal rook slide through own pawn.
  const ack3 = await emitAck(sB, 'move:request', { matchId: M.id, from: 'a9', to: 'a5' });
  check('B illegal a9-a5 rejected ILLEGAL_MOVE', ack3.ok === false && ack3.reason === 'ILLEGAL_MOVE', JSON.stringify(ack3));

  // B plays horse b9->c7.
  const playedOnA = onceEvent(sA, 'move:played');
  const ack4 = await emitAck(sB, 'move:request', { matchId: M.id, from: 'b9', to: 'c7' });
  check('B move b9-c7 accepted', ack4.ok === true && ack4.moveNumber === 2, JSON.stringify(ack4));
  const played2 = await playedOnA;
  check('A receives move:played turn=RED', played2.turn === 'RED' && played2.to === 'c7');

  // Spectator C joins room, sees state, but cannot move.
  const sC = await connect(C.accessToken);
  const joinC = await emitAck(sC, 'match:join', { matchId: M.id });
  check('C spectator snapshot (no color)', joinC.ok === true && joinC.myColor === null);
  const ack5 = await emitAck(sC, 'move:request', { matchId: M.id, from: 'h0', to: 'g2' });
  check('C spectator move rejected NOT_A_PLAYER', ack5.ok === false && ack5.reason === 'NOT_A_PLAYER', JSON.stringify(ack5));

  // DB persistence via REST.
  const moves = await api('GET', `/api/game/moves/${M.id}?limit=10`);
  check('DB has 2 moves in order', moves.data.length === 2 && moves.data[0].from === 'b0' && moves.data[1].from === 'b9');
  const st = await api('GET', `/api/game/states/${M.id}`);
  check('DB state turn=RED moveNumber=2', st.data.turn === 'RED' && st.data.moveNumber === 2, `turn=${st.data.turn} n=${st.data.moveNumber}`);

  // ---- Phase 7: server-authoritative hardening ----
  // Race: 2 nước RED cùng lúc -> đúng 1 ok, còn lại NOT_YOUR_TURN.
  const raceB = onceEvent(sB, 'move:played');
  const [rr1, rr2] = await Promise.all([
    emitAck(sA, 'move:request', { matchId: M.id, from: 'a3', to: 'a4' }),
    emitAck(sA, 'move:request', { matchId: M.id, from: 'c3', to: 'c4' }),
  ]);
  const raceOk = [rr1, rr2].filter((r) => r.ok === true).length;
  const raceTurn = [rr1, rr2].filter((r) => !r.ok && r.reason === 'NOT_YOUR_TURN').length;
  check('race: exactly 1 move accepted', raceOk === 1 && raceTurn === 1, JSON.stringify([rr1.reason || 'ok', rr2.reason || 'ok']));
  await raceB;

  // Reconnect resync: socket mới join lại thấy đủ 3 moves.
  sA.disconnect();
  const sA2 = await connect(A.accessToken);
  const rejoin = await emitAck(sA2, 'match:join', { matchId: M.id });
  check('reconnect resyncs latest state', rejoin.ok === true && rejoin.state?.moveNumber === 3, `n=${rejoin.state?.moveNumber}`);

  // Socket không token bị từ chối.
  const unauth = await new Promise((resolve) => {
    const s = io(`${BASE}/game`, { timeout: 8000 });
    s.on('connect', () => resolve('CONNECTED (BAD)'));
    s.on('connect_error', () => resolve('REJECTED'));
    setTimeout(() => resolve('TIMEOUT'), 10000);
  });
  check('unauthenticated socket rejected', unauth === 'REJECTED', String(unauth));

  // Move trên match WAITING.
  const W = (await api('POST', '/api/matches', A.accessToken, { mode: 'CASUAL' })).data;
  const wMove = await emitAck(sA2, 'move:request', { matchId: W.id, from: 'b0', to: 'c2' });
  check('move on WAITING match rejected', wMove.ok === false && wMove.reason === 'MATCH_NOT_PLAYING', JSON.stringify(wMove));

  // Payload sai schema + match không tồn tại.
  const bad = await emitAck(sA2, 'move:request', { matchId: M.id, from: 'zzz', to: 'c2' });
  check('malformed move rejected', bad.ok === false, JSON.stringify(bad));
  const ghost = await emitAck(sA2, 'move:request', { matchId: '00000000-0000-0000-0000-000000000000', from: 'b0', to: 'c2' });
  check('move on unknown match rejected', ghost.ok === false && ghost.reason === 'MATCH_NOT_FOUND', JSON.stringify(ghost));

  // Legal-moves read-only endpoint (turn BLACK, horse h9 -> g7/i7).
  const lm = await api('GET', `/api/game/legal-moves/${M.id}?from=h9`);
  check('legal-moves h9 = g7,i7', JSON.stringify(lm.data) === JSON.stringify(['g7', 'i7']), JSON.stringify(lm.data));

  // ---- Phase 8: chess clock ----
  check('join snapshot has clock', joinA.clock && joinA.clock.redMs <= 600000, JSON.stringify(joinA.clock && { red: joinA.clock.redMs, active: joinA.clock.activeColor }));
  const D = (await api('POST', '/api/auth/register', null, mk('d'))).data;
  const E = (await api('POST', '/api/auth/register', null, mk('e'))).data;
  const CM = (await api('POST', '/api/matches', D.accessToken, { mode: 'CASUAL', clock: { initialMs: 60000, incrementMs: 30000 } })).data;
  await api('POST', `/api/matches/${CM.id}/join`, E.accessToken, {});
  await api('POST', `/api/matches/${CM.id}/ready`, D.accessToken);
  await api('POST', `/api/matches/${CM.id}/ready`, E.accessToken);
  const t0 = Date.now();
  const clk0 = await api('GET', `/api/matches/${CM.id}/clock`);
  check('clock starts 60s RED to move', clk0.data.redMs <= 60000 && clk0.data.blackMs === 60000 && clk0.data.activeColor === 'RED', JSON.stringify({ red: clk0.data.redMs, black: clk0.data.blackMs }));

  const sD = await connect(D.accessToken);
  await emitAck(sD, 'match:join', { matchId: CM.id });
  const playedD = onceEvent(sD, 'move:played');
  const dAck = await emitAck(sD, 'move:request', { matchId: CM.id, from: 'b0', to: 'c2' });
  const t1 = Date.now();
  const dPlayed = await playedD;
  check('move:played carries clock', dAck.ok === true && !!dPlayed.clock && dPlayed.clock.activeColor === 'BLACK', JSON.stringify(dPlayed.clock && { red: dPlayed.clock.redMs, active: dPlayed.clock.activeColor }));
  // Increment 30s >> mọi elapsed thực tế -> red_after nhất định > red_before.
  // (Không increment thì red_after < red_before vì elapsed > 0.)
  check('fischer increment applied', dPlayed.clock.redMs > clk0.data.redMs && dPlayed.clock.blackMs === 60000, `red ${clk0.data.redMs} -> ${dPlayed.clock.redMs}`);

  // Timeout: tiny clock -> sweeper (hoặc nước đi) kết thúc TIMEOUT.
  const F = (await api('POST', '/api/auth/register', null, mk('f'))).data;
  const G = (await api('POST', '/api/auth/register', null, mk('g'))).data;
  const TM = (await api('POST', '/api/matches', F.accessToken, { mode: 'CASUAL', clock: { initialMs: 1500, incrementMs: 0 } })).data;
  await api('POST', `/api/matches/${TM.id}/join`, G.accessToken, {});
  await api('POST', `/api/matches/${TM.id}/ready`, F.accessToken);
  await api('POST', `/api/matches/${TM.id}/ready`, G.accessToken);
  await new Promise((r) => setTimeout(r, 8000));
  let tm = await api('GET', `/api/matches/${TM.id}`);
  if (tm.data.status !== 'FINISHED') {
    const sF = await connect(F.accessToken);
    const tAck = await emitAck(sF, 'move:request', { matchId: TM.id, from: 'b0', to: 'c2' });
    check('flagged mover rejected', tAck.ok === false && (tAck.reason === 'TIME_FLAGGED' || tAck.reason === 'MATCH_NOT_PLAYING'), JSON.stringify(tAck));
    sF.disconnect();
    tm = await api('GET', `/api/matches/${TM.id}`);
  }
  check('timeout finishes BLACK wins', tm.data.status === 'FINISHED' && tm.data.winner === 'BLACK' && tm.data.endReason === 'TIMEOUT', JSON.stringify({ s: tm.data.status, w: tm.data.winner, e: tm.data.endReason }));
  // ---- Phase 9: spectator presence ----
  const teamOnA = onceEvent(sA2, 'spectator:team-changed');
  const tAck = await emitAck(sC, 'spectator:team', { matchId: M.id, team: 'RED' });
  check('spectator team set', tAck.ok === true && tAck.team === 'RED', JSON.stringify(tAck));
  const tEvt = await teamOnA;
  check('team change broadcast to room', tEvt.userId === C.user.id && tEvt.team === 'RED', JSON.stringify({ team: tEvt.team }));
  const re = await emitAck(sC, 'match:join', { matchId: M.id });
  check('snapshot has spectators+myTeam', re.ok === true && re.myTeam === 'RED' && re.spectators.some((s) => s.userId === C.user.id));
  const leftOnA = onceEvent(sA2, 'spectator:left');
  const lAck = await emitAck(sC, 'spectator:leave', { matchId: M.id });
  check('spectator leave ok', lAck.ok === true);
  const lEvt = await leftOnA;
  check('spectator:left broadcast', lEvt.userId === C.user.id);

  // ---- Phase 11: realtime chat ----
  // A (RED player) gửi MATCH_CHAT -> B nhận.
  const chatOnB = onceEvent(sB, 'chat:message');
  const cAck1 = await emitAck(sA2, 'chat:send', { matchId: M.id, channel: 'MATCH_CHAT', content: 'hay lam' });
  check('chat MATCH_CHAT sent', cAck1.ok === true && cAck1.message.content === 'hay lam', JSON.stringify(cAck1.ok));
  const cMsg1 = await chatOnB;
  check('B receives chat:message', cMsg1.message.content === 'hay lam' && cMsg1.message.channel === 'MATCH_CHAT', cMsg1.message.channel);

  // C là spectator RED (đã set ở Phase 9... nhưng đã leave; set lại).
  await emitAck(sC, 'spectator:team', { matchId: M.id, team: 'RED' });
  const cAck2 = await emitAck(sC, 'chat:send', { matchId: M.id, channel: 'RED_CHAT', content: 'co len do' });
  check('RED spectator RED_CHAT ok', cAck2.ok === true);
  const cAck3 = await emitAck(sC, 'chat:send', { matchId: M.id, channel: 'BLACK_CHAT', content: 'toi la gian diep' });
  check('RED spectator BLACK_CHAT rejected', cAck3.ok === false && cAck3.reason === 'TEAM_ONLY', JSON.stringify(cAck3));
  const cAck4 = await emitAck(sB, 'chat:send', { matchId: M.id, channel: 'RED_CHAT', content: 'toi vao nham kenh' });
  check('BLACK player RED_CHAT rejected', cAck4.ok === false && cAck4.reason === 'TEAM_ONLY', JSON.stringify(cAck4));
  const cAck5 = await emitAck(sA2, 'chat:send', { matchId: M.id, channel: 'COMMENTARY', content: 'toi binh luan dao' });
  check('COMMENTARY channel restricted', cAck5.ok === false && cAck5.reason === 'MODERATOR_ONLY', JSON.stringify(cAck5));

  // Rate limit: 6 tin cùng lúc từ user mới -> đúng 5 ok + 1 RATE_LIMITED.
  const H = (await api('POST', '/api/auth/register', null, mk('h'))).data;
  const sH = await connect(H.accessToken);
  await emitAck(sH, 'match:join', { matchId: M.id });
  const batch = await Promise.all(
    [0, 1, 2, 3, 4, 5].map((i) =>
      emitAck(sH, 'chat:send', { matchId: M.id, channel: 'MATCH_CHAT', content: `burst ${i}` }),
    ),
  );
  const oks = batch.filter((r) => r.ok).length;
  const limited = batch.filter((r) => !r.ok && r.reason === 'RATE_LIMITED').length;
  check('rate limit 5/10s burst', oks === 5 && limited === 1, `${oks} ok / ${limited} limited`);
  sH.disconnect();

  // Xóa tin nhắn -> broadcast + ẩn khỏi history.
  const delOnB = onceEvent(sB, 'chat:deleted');
  const delAck = await emitAck(sA2, 'chat:delete', { id: cAck1.message.id });
  check('owner deletes message', delAck.ok === true);
  const dEvt = await delOnB;
  check('chat:deleted broadcast', dEvt.id === cAck1.message.id);
  const hist = await api('GET', `/api/chat/messages/${M.id}`);
  check('deleted hidden from history', Array.isArray(hist.data) && !hist.data.some((m) => m.id === cAck1.message.id));

  // ---- Replay + auth throttle ----
  const rp = await api('GET', `/api/matches/${M.id}/replay`);
  check(
    'replay plies with FENs',
    rp.data.initialFen.startsWith('rnbakabnr') &&
      rp.data.moves.length === 3 &&
      rp.data.moves[0].from === 'b0' &&
      typeof rp.data.moves[0].fenAfter === 'string' &&
      rp.data.moves[0].fenAfter !== rp.data.initialFen &&
      rp.data.moves[2].moveNumber === 3,
    `plies=${rp.data.moves.length}`,
  );

  // 30 login sai cùng lúc -> ít nhất 10 cái 429 (quota auth 20/phút).
  const burst = await Promise.all(
    Array.from({ length: 30 }, () =>
      api('POST', '/api/auth/login', null, { email: 'nobody@t.local', password: 'saimatkhau1' }),
    ),
  );
  const limited429 = burst.filter((r) => r.status === 429).length;
  check('auth brute-force throttled', limited429 >= 10, `${limited429}x 429`);

  sD.disconnect();

  sA2.disconnect();
  sB.disconnect();
  sC.disconnect();
  const failed = results.filter(([s]) => s === 'FAIL').length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error('SCRIPT ERROR', e);
  process.exit(2);
});
