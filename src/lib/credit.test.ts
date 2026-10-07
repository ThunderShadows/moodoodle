import { describe, it, expect } from 'vitest';
import { mergeCredit, applyUserEdit, creditLine, parseRobots } from './credit';
import { emptyCredit } from './types';

const CC_BY = 'https://creativecommons.org/licenses/by/4.0/';

describe('mergeCredit', () => {
  it('is empty and "none" when nothing is stated', () => {
    expect(mergeCredit({})).toEqual(emptyCredit());
  });

  it('prefers JSON-LD over XMP over rel-license, recording each source', () => {
    const c = mergeCredit({
      page: { jsonLd: { creator: 'Jane', creatorUrl: 'https://x.com/jane', title: 'Flower' }, relLicense: 'https://creativecommons.org/licenses/by-nc/4.0/', noAI: false },
      xmp: { creator: 'J. Doe (file)', license: CC_BY, rights: '© Jane', noAI: false },
    });
    expect(c).toMatchObject({
      creator: 'Jane', creatorUrl: 'https://x.com/jane', title: 'Flower', copyrightNotice: '© Jane',
      license: { kind: 'cc', code: 'by' }, confidence: 'stated',
      fieldSources: { creator: 'json-ld', creatorUrl: 'json-ld', title: 'json-ld', license: 'xmp', copyrightNotice: 'xmp' },
    });
  });

  it('uses rel=license when nothing better states a license', () => {
    const c = mergeCredit({ page: { relLicense: 'https://creativecommons.org/licenses/by-nc/4.0/', noAI: false } });
    expect(c).toMatchObject({ license: { kind: 'cc', code: 'by-nc' }, fieldSources: { license: 'rel-license' }, confidence: 'stated' });
  });

  it('treats an XMP copyright notice as all rights reserved when no license is stated', () => {
    expect(mergeCredit({ xmp: { rights: '© 2026 Jane', noAI: false } }).license).toEqual({ kind: 'all-rights-reserved', notice: '© 2026 Jane' });
  });

  it('marks a creator found only in page meta as inferred', () => {
    expect(mergeCredit({ page: { metaAuthor: 'Mira', noAI: false } })).toMatchObject({ creator: 'Mira', confidence: 'inferred', fieldSources: { creator: 'meta' } });
  });

  it('sets NoAI from the page, the file or the response header', () => {
    expect(mergeCredit({ page: { noAI: true } }).noAI).toBe(true);
    expect(mergeCredit({ xmp: { noAI: true } }).noAI).toBe(true);
    expect(mergeCredit({ headerNoAI: true }).noAI).toBe(true);
  });

  it('never overwrites fields the user edited', () => {
    const previous = applyUserEdit(emptyCredit(), { creator: 'My Fix', license: CC_BY });
    const c = mergeCredit({ page: { jsonLd: { creator: 'Page Says' }, relLicense: 'https://creativecommons.org/licenses/by-nd/4.0/', noAI: false }, previous });
    expect(c).toMatchObject({ creator: 'My Fix', license: { kind: 'cc', code: 'by' }, fieldSources: { creator: 'user', license: 'user' } });
  });
});

describe('applyUserEdit', () => {
  it('parses the license and marks edited fields as the user\'s', () => {
    const c = applyUserEdit(emptyCredit(), { creator: '  Ana ', creatorUrl: 'https://ana.art', license: 'https://creativecommons.org/publicdomain/zero/1.0/', copyrightNotice: '' });
    expect(c).toMatchObject({ creator: 'Ana', creatorUrl: 'https://ana.art', license: { kind: 'cc0' }, confidence: 'stated' });
    expect(c.copyrightNotice).toBeUndefined();
    expect(c.fieldSources).toEqual({ creator: 'user', creatorUrl: 'user', license: 'user', copyrightNotice: 'user' });
  });
});

describe('creditLine', () => {
  it('builds a TASL line only when creator and license are both known', () => {
    const known = mergeCredit({ page: { jsonLd: { creator: 'Jane', license: CC_BY }, noAI: false } });
    expect(creditLine(known, 'Flower study')).toBe('“Flower study” by Jane, CC BY 4.0');
    expect(creditLine(mergeCredit({ page: { jsonLd: { creator: 'Jane' }, noAI: false } }), 'X')).toBeUndefined();
  });
});

describe('parseRobots', () => {
  it('spots noai / noimageai in an X-Robots-Tag header', () => {
    expect(parseRobots('noindex, NoAI')).toBe(true);
    expect(parseRobots('noimageai')).toBe(true);
    expect(parseRobots('noindex')).toBe(false);
    expect(parseRobots(undefined)).toBe(false);
  });
});
