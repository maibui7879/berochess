/**
 * Glicko-2 (Glickman) — pure math, không phụ thuộc framework.
 * Rating period = 1 ván (update ngay khi match RANKED kết thúc).
 */

export interface GlickoPlayer {
  rating: number;
  rd: number;
  vol: number;
}

export interface GlickoOutcome {
  opponent: GlickoPlayer;
  /** Điểm từ góc nhìn của player: 1 thắng, 0.5 hòa, 0 thua. */
  score: number;
}

const SCALE = 173.7178;
const TAU = 0.5;
const EPSILON = 0.000001;

function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

function expected(mu: number, muj: number, phij: number): number {
  return 1 / (1 + Math.exp(-g(phij) * (mu - muj)));
}

/** Bước 5 của paper: giải σ' bằng minh họa số (illustration algorithm). */
function newVolatility(phi: number, sigma: number, delta: number, v: number): number {
  const a = Math.log(sigma * sigma);
  const f = (x: number): number => {
    const ex = Math.exp(x);
    const denom = phi * phi + v + ex;
    return (
      (ex * (delta * delta - phi * phi - v - ex)) / (2 * denom * denom) - (x - a) / (TAU * TAU)
    );
  };
  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    // f -> +inf khi x -> -inf nên chắc chắn gặp f > 0 khi đi sang trái.
    let k = 1;
    while (f(a - k * TAU) < 0) k++;
    B = a - k * TAU;
  }
  let fA = f(A);
  let fB = f(B);
  let guard = 0;
  while (Math.abs(B - A) > EPSILON && guard++ < 100) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }
    B = C;
    fB = fC;
  }
  return Math.exp(A / 2);
}

export function updateRating(player: GlickoPlayer, outcomes: GlickoOutcome[]): GlickoPlayer {
  if (outcomes.length === 0) return { ...player };
  const mu = (player.rating - 1500) / SCALE;
  const phi = player.rd / SCALE;

  let vInv = 0;
  let deltaSum = 0;
  for (const o of outcomes) {
    const muj = (o.opponent.rating - 1500) / SCALE;
    const phij = o.opponent.rd / SCALE;
    const gphi = g(phij);
    const e = expected(mu, muj, phij);
    vInv += gphi * gphi * e * (1 - e);
    deltaSum += gphi * (o.score - e);
  }
  const v = 1 / vInv;
  const delta = v * deltaSum;
  const sigmaPrime = newVolatility(phi, player.vol, delta, v);
  const phiStar = Math.sqrt(phi * phi + sigmaPrime * sigmaPrime);
  const phiPrime = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muPrime = mu + phiPrime * phiPrime * deltaSum;

  return {
    rating: SCALE * muPrime + 1500,
    rd: SCALE * phiPrime,
    vol: sigmaPrime,
  };
}

/** Tiện cho ván 1v1: trả [rating mới bên A, rating mới bên B]. */
export function updateDuel(
  a: GlickoPlayer,
  b: GlickoPlayer,
  scoreA: number,
): [GlickoPlayer, GlickoPlayer] {
  return [
    updateRating(a, [{ opponent: b, score: scoreA }]),
    updateRating(b, [{ opponent: a, score: 1 - scoreA }]),
  ];
}
