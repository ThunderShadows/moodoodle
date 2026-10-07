import { licenseLabel, parseLicense } from './license';
import { emptyCredit, type Credit, type CreditSource, type License, type PageCredit, type XmpCredit } from './types';

type Field = keyof Credit['fieldSources'];

const NOAI = /\bno(image)?ai\b/i;

/** True when an X-Robots-Tag value opts the image out of AI use. */
export function parseRobots(header?: string | null): boolean {
  return !!header && NOAI.test(header);
}

export interface MergeInput {
  page?: PageCredit;
  xmp?: XmpCredit;
  headerNoAI?: boolean;
  previous?: Credit;
}

/**
 * Combines what the page, the file and the user say about an image.
 * Priority: user > JSON-LD > XMP > rel=license > page meta (creator only, inferred).
 */
export function mergeCredit({ page, xmp, headerNoAI, previous }: MergeInput): Credit {
  const ld = page?.jsonLd;
  const out: Credit = emptyCredit();
  const set = <K extends Field>(field: K, value: Credit[K] | undefined, source: CreditSource) => {
    if (value === undefined || out.fieldSources[field]) return;
    (out as Record<K, Credit[K]>)[field] = value;
    out.fieldSources[field] = source;
  };

  // User edits always win.
  for (const f of Object.keys(previous?.fieldSources ?? {}) as Field[]) {
    if (previous!.fieldSources[f] === 'user') set(f, previous![f] as never, 'user');
  }

  set('title', ld?.title, 'json-ld');
  set('creator', ld?.creator, 'json-ld');
  set('creatorUrl', ld?.creatorUrl, 'json-ld');
  set('copyrightNotice', ld?.copyrightNotice, 'json-ld');
  set('license', ld?.license ? parseLicense(ld.license) : undefined, 'json-ld');

  set('creator', xmp?.creator, 'xmp');
  set('copyrightNotice', xmp?.rights, 'xmp');
  set('license', xmp?.license ? parseLicense(xmp.license) : undefined, 'xmp');

  set('license', page?.relLicense ? parseLicense(page.relLicense) : undefined, 'rel-license');

  // A bare copyright notice means all rights reserved when no license was stated.
  const notice = out.copyrightNotice;
  if (!out.fieldSources.license && notice) {
    const fromNotice = parseLicense(notice);
    if (fromNotice.kind === 'all-rights-reserved') set('license', fromNotice, out.fieldSources.copyrightNotice!);
  }

  set('creator', page?.metaAuthor, 'meta');

  if (ld?.creditText) out.creditText = ld.creditText;
  if (ld?.acquireLicensePage) out.acquireLicensePage = ld.acquireLicensePage;
  if (!out.license) out.license = { kind: 'unknown' };

  out.noAI = !!(page?.noAI || xmp?.noAI || headerNoAI || previous?.noAI);
  const sources = Object.values(out.fieldSources);
  out.confidence = sources.some((s) => s !== 'meta') ? 'stated' : sources.length ? 'inferred' : 'none';
  return out;
}

export interface CreditEdit {
  creator?: string;
  creatorUrl?: string;
  license?: string;
  copyrightNotice?: string;
}

/** Applies the user's corrections; edited fields are marked 'user' and never overwritten later. */
export function applyUserEdit(credit: Credit, patch: CreditEdit): Credit {
  const out: Credit = { ...credit, fieldSources: { ...credit.fieldSources } };
  const text = (v: string) => v.trim() || undefined;
  if (patch.creator !== undefined) { out.creator = text(patch.creator); out.fieldSources.creator = 'user'; }
  if (patch.creatorUrl !== undefined) { out.creatorUrl = text(patch.creatorUrl); out.fieldSources.creatorUrl = 'user'; }
  if (patch.copyrightNotice !== undefined) { out.copyrightNotice = text(patch.copyrightNotice); out.fieldSources.copyrightNotice = 'user'; }
  if (patch.license !== undefined) { out.license = parseLicense(patch.license) as License; out.fieldSources.license = 'user'; }
  out.confidence = 'stated';
  return out;
}

/** "“Title” by Creator, License" when both creator and license are known; otherwise undefined. */
export function creditLine(credit: Credit, fallbackTitle: string): string | undefined {
  if (!credit.creator || credit.license.kind === 'unknown') return undefined;
  return `“${credit.title ?? fallbackTitle}” by ${credit.creator}, ${licenseLabel(credit.license)}`;
}
