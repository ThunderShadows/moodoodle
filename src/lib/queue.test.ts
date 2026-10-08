import { describe, it, expect } from 'vitest';
import { createQueue } from './queue';

describe('createQueue', () => {
  it('runs jobs one at a time, in order, and keeps going after a failure', async () => {
    const log: string[] = [];
    const q = createQueue();
    const job = (name: string, fail = false) => async () => {
      log.push(`start ${name}`);
      await new Promise((r) => setTimeout(r, 5));
      log.push(`end ${name}`);
      if (fail) throw new Error(name);
    };
    q.push(job('a'));
    q.push(job('b', true));
    q.push(job('c'));
    await q.idle();
    expect(log).toEqual(['start a', 'end a', 'start b', 'end b', 'start c', 'end c']);
  });
  it('reports how many jobs are waiting', async () => {
    const q = createQueue();
    q.push(async () => {});
    q.push(async () => {});
    expect(q.size()).toBeGreaterThan(0);
    await q.idle();
    expect(q.size()).toBe(0);
  });
});
