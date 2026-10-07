import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { isSameLocalDay } from './dates';

describe('isSameLocalDay', () => {
  const originalTz = process.env.TZ;
  beforeAll(() => { process.env.TZ = 'Asia/Kolkata'; });
  afterAll(() => { process.env.TZ = originalTz; });

  it('uses the local calendar day, not the UTC one', () => {
    // 06:00 IST on 7 Oct is still 6 Oct in UTC; a keep at 01:30 IST the same morning is "today".
    const now = new Date('2026-10-07T06:00:00+05:30');
    expect(isSameLocalDay('2026-10-06T20:00:00.000Z', now)).toBe(true);
  });
  it('is false for the previous local day', () => {
    const now = new Date('2026-10-07T06:00:00+05:30');
    expect(isSameLocalDay('2026-10-06T18:00:00.000Z', now)).toBe(false); // 23:30 IST on 6 Oct
  });
});
