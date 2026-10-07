import type { License } from './types';

type CcCode = Extract<License, { kind: 'cc' }>['code'];
const CC_CODES: CcCode[] = ['by', 'by-sa', 'by-nc', 'by-nd', 'by-nc-sa', 'by-nc-nd'];

/** Normalizes a license URL or rights statement. Anything unrecognized stays 'unknown'. */
export function parseLicense(input?: string): License {
  const raw = input?.trim();
  if (!raw) return { kind: 'unknown' };
  const cc = /creativecommons\.org\/licenses\/([a-z-]+)\/(\d+(?:\.\d+)?)/i.exec(raw);
  if (cc && CC_CODES.includes(cc[1]!.toLowerCase() as CcCode)) {
    return { kind: 'cc', code: cc[1]!.toLowerCase() as CcCode, version: cc[2], url: raw };
  }
  if (/creativecommons\.org\/publicdomain\/zero\//i.test(raw)) return { kind: 'cc0', url: raw };
  if (/creativecommons\.org\/publicdomain\/mark\//i.test(raw)) return { kind: 'public-domain', url: raw };
  if (/©|\(c\)|all rights reserved/i.test(raw)) return { kind: 'all-rights-reserved', notice: raw };
  return { kind: 'unknown', raw };
}

export type Badge = 'reuse' | 'conditions' | 'reference';

export const BADGE_LABEL: Record<Badge, string> = {
  reuse: 'Free to reuse',
  conditions: 'Reuse with conditions',
  reference: 'Reference only',
};

export function badgeFor(license: License): Badge {
  if (license.kind === 'cc0' || license.kind === 'public-domain') return 'reuse';
  if (license.kind === 'cc') return license.code === 'by' || license.code === 'by-sa' ? 'reuse' : 'conditions';
  return 'reference';
}

export function licenseLabel(license: License): string {
  switch (license.kind) {
    case 'cc':
      return `CC ${license.code.toUpperCase()}${license.version ? ` ${license.version}` : ''}`;
    case 'cc0':
      return 'CC0';
    case 'public-domain':
      return 'Public domain';
    case 'all-rights-reserved':
      return 'All rights reserved';
    default:
      return 'Not stated';
  }
}
