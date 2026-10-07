import { describe, it, expect } from 'vitest';
import { parseLicense, badgeFor, licenseLabel } from './license';

describe('parseLicense', () => {
  it.each([
    ['https://creativecommons.org/licenses/by/4.0/', { kind: 'cc', code: 'by', version: '4.0' }],
    ['http://creativecommons.org/licenses/by-sa/3.0', { kind: 'cc', code: 'by-sa', version: '3.0' }],
    ['https://creativecommons.org/licenses/by-nc-nd/4.0/deed.en', { kind: 'cc', code: 'by-nc-nd', version: '4.0' }],
    ['https://creativecommons.org/licenses/by-nc/2.0/', { kind: 'cc', code: 'by-nc', version: '2.0' }],
  ])('reads CC license %s', (url, expected) => {
    expect(parseLicense(url)).toMatchObject(expected);
  });
  it('reads CC0 and the Public Domain Mark', () => {
    expect(parseLicense('https://creativecommons.org/publicdomain/zero/1.0/')).toMatchObject({ kind: 'cc0' });
    expect(parseLicense('https://creativecommons.org/publicdomain/mark/1.0/')).toMatchObject({ kind: 'public-domain' });
  });
  it('reads all-rights-reserved notices and keeps the text', () => {
    expect(parseLicense('© 2026 Jane Doe')).toEqual({ kind: 'all-rights-reserved', notice: '© 2026 Jane Doe' });
    expect(parseLicense('All Rights Reserved')).toMatchObject({ kind: 'all-rights-reserved' });
  });
  it('treats anything else as unknown, keeping the raw value', () => {
    expect(parseLicense('https://example.com/terms')).toEqual({ kind: 'unknown', raw: 'https://example.com/terms' });
    expect(parseLicense(undefined)).toEqual({ kind: 'unknown' });
    expect(parseLicense('   ')).toEqual({ kind: 'unknown' });
  });
});

describe('badgeFor', () => {
  it('never marks unknown or all-rights-reserved as reusable', () => {
    expect(badgeFor({ kind: 'unknown' })).toBe('reference');
    expect(badgeFor({ kind: 'all-rights-reserved' })).toBe('reference');
  });
  it('splits CC licenses into reuse and conditions', () => {
    expect(badgeFor(parseLicense('https://creativecommons.org/licenses/by/4.0/'))).toBe('reuse');
    expect(badgeFor(parseLicense('https://creativecommons.org/licenses/by-sa/4.0/'))).toBe('reuse');
    expect(badgeFor(parseLicense('https://creativecommons.org/licenses/by-nc/4.0/'))).toBe('conditions');
    expect(badgeFor(parseLicense('https://creativecommons.org/licenses/by-nd/4.0/'))).toBe('conditions');
    expect(badgeFor({ kind: 'cc0' })).toBe('reuse');
    expect(badgeFor({ kind: 'public-domain' })).toBe('reuse');
  });
});

describe('licenseLabel', () => {
  it('names licenses for people', () => {
    expect(licenseLabel(parseLicense('https://creativecommons.org/licenses/by-nc-sa/4.0/'))).toBe('CC BY-NC-SA 4.0');
    expect(licenseLabel({ kind: 'cc0' })).toBe('CC0');
    expect(licenseLabel({ kind: 'public-domain' })).toBe('Public domain');
    expect(licenseLabel({ kind: 'all-rights-reserved' })).toBe('All rights reserved');
    expect(licenseLabel({ kind: 'unknown' })).toBe('Not stated');
  });
});
