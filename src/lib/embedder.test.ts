import { describe, it, expect } from 'vitest';
import { clsEmbedding } from './embedder';

describe('clsEmbedding', () => {
  it('takes the first token of last_hidden_state and normalizes it', () => {
    // dims [1, tokens=2, hidden=2]: CLS = [3, 4], patch = [9, 9]
    const v = clsEmbedding({ dims: [1, 2, 2], data: Float32Array.from([3, 4, 9, 9]) });
    expect(Array.from(v).map((x) => +x.toFixed(2))).toEqual([0.6, 0.8]);
  });
  it('rejects unexpected tensor shapes', () => {
    expect(() => clsEmbedding({ dims: [384], data: new Float32Array(384) })).toThrow();
  });
});
