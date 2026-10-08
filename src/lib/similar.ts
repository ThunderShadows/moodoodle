/** Scales a vector to unit length (zero vectors are returned unchanged). */
export function normalize(v: Float32Array): Float32Array {
  let sum = 0;
  for (const x of v) sum += x * x;
  const len = Math.sqrt(sum);
  if (!len) return v;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i]! / len;
  return out;
}

/** Cosine similarity of two already-normalized vectors. */
export function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += a[i]! * b[i]!;
  return dot;
}

export interface Scored {
  id: string;
  score: number;
}

/** The k most similar items above `min`, best first, never including `exclude`. */
export function topSimilar(
  query: Float32Array,
  items: { id: string; vec: Float32Array }[],
  { k = 6, min = 0.25, exclude }: { k?: number; min?: number; exclude?: string } = {},
): Scored[] {
  return items
    .filter((it) => it.id !== exclude)
    .map((it) => ({ id: it.id, score: cosine(query, it.vec) }))
    .filter((s) => s.score >= min)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
