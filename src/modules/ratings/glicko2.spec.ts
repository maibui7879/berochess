import { GlickoPlayer, updateDuel, updateRating } from './glicko2';

const FRESH: GlickoPlayer = { rating: 1500, rd: 350, vol: 0.06 };
const SOLID: GlickoPlayer = { rating: 1500, rd: 100, vol: 0.06 };

describe('glicko2', () => {
  it('rewards a win against an equal opponent and tightens RD', () => {
    const [w, l] = updateDuel(FRESH, FRESH, 1);
    expect(w.rating).toBeGreaterThan(1500);
    expect(l.rating).toBeLessThan(1500);
    expect(w.rd).toBeLessThan(350);
    expect(l.rd).toBeLessThan(350);
  });

  it('is symmetric for identical players', () => {
    const [w, l] = updateDuel(FRESH, FRESH, 1);
    expect(w.rating - 1500).toBeCloseTo(1500 - l.rating, 6);
    expect(w.rd).toBeCloseTo(l.rd, 6);
  });

  it('moves little on a draw between equals', () => {
    const [a] = updateDuel(FRESH, FRESH, 0.5);
    const [w] = updateDuel(FRESH, FRESH, 1);
    expect(Math.abs(a.rating - 1500)).toBeLessThan(Math.abs(w.rating - 1500) / 3);
    expect(a.rd).toBeLessThan(350);
  });

  it('rewards upsets more than routine wins', () => {
    const [upset] = updateDuel(
      { rating: 1200, rd: 100, vol: 0.06 },
      { rating: 1800, rd: 100, vol: 0.06 },
      1,
    );
    const [routine] = updateDuel(SOLID, SOLID, 1);
    expect(upset.rating - 1200).toBeGreaterThan(routine.rating - 1500);
  });

  it('moves newcomers more than established players', () => {
    const [fresh] = updateDuel(FRESH, SOLID, 1);
    const [solid] = updateDuel(SOLID, FRESH, 1);
    expect(fresh.rating - 1500).toBeGreaterThan(solid.rating - 1500);
  });

  it('keeps volatility and RD in sane bounds', () => {
    const results = [
      updateRating(FRESH, [{ opponent: FRESH, score: 1 }]),
      updateRating(FRESH, [{ opponent: FRESH, score: 0 }]),
      updateRating(FRESH, [{ opponent: FRESH, score: 0.5 }]),
    ];
    for (const r of results) {
      expect(r.vol).toBeGreaterThan(0.02);
      expect(r.vol).toBeLessThan(0.2);
      expect(r.rd).toBeLessThan(350);
      expect(r.rd).toBeGreaterThan(0);
    }
  });

  it('leaves idle players untouched', () => {
    expect(updateRating(FRESH, [])).toEqual(FRESH);
  });
});
