import { describe, it, expect } from 'vitest';
import { normalize, cosine, topSimilar } from './similar';

const v = (...xs: number[]) => normalize(Float32Array.from(xs));

describe('normalize / cosine', () => {
  it('scales to unit length and leaves zero vectors alone', () => {
    const n = normalize(Float32Array.from([3, 4]));
    expect(Array.from(n).map((x) => +x.toFixed(3))).toEqual([0.6, 0.8]);
    expect(Array.from(normalize(Float32Array.from([0, 0])))).toEqual([0, 0]);
  });
  it('is 1 for the same direction and 0 for orthogonal', () => {
    expect(cosine(v(1, 2, 3), v(2, 4, 6))).toBeCloseTo(1);
    expect(cosine(v(1, 0), v(0, 1))).toBeCloseTo(0);
  });
});

describe('topSimilar', () => {
  const items = [
    { id: 'self', vec: v(1, 0, 0) },
    { id: 'near', vec: v(0.9, 0.1, 0) },
    { id: 'mid', vec: v(0.6, 0.6, 0) },
    { id: 'far', vec: v(0, 0, 1) },
  ];
  it('ranks by similarity, excludes the query image and drops weak matches', () => {
    const r = topSimilar(v(1, 0, 0), items, { exclude: 'self' });
    expect(r.map((x) => x.id)).toEqual(['near', 'mid']);
    expect(r[0]!.score).toBeGreaterThan(r[1]!.score);
  });
  it('returns at most k', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ id: String(i), vec: v(1, i * 0.01, 0) }));
    expect(topSimilar(v(1, 0, 0), many, { k: 6 })).toHaveLength(6);
  });
  it('returns nothing for an empty collection', () => {
    expect(topSimilar(v(1, 0), [])).toEqual([]);
  });
});
