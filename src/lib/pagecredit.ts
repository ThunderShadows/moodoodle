import type { PageCredit } from './types';

type Json = Record<string, unknown>;

const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** Compare image URLs ignoring query string and hash (CDNs add sizing params). */
function sameImage(a: string, b: string): boolean {
  try {
    const x = new URL(a);
    const y = new URL(b);
    return x.origin + x.pathname === y.origin + y.pathname;
  } catch {
    return a === b;
  }
}

/** Every object in a JSON-LD tree, including @graph members and nested values. */
function* walk(node: unknown): Generator<Json> {
  if (Array.isArray(node)) {
    for (const n of node) yield* walk(n);
  } else if (isObj(node)) {
    yield node;
    for (const v of Object.values(node)) if (typeof v === 'object') yield* walk(v);
  }
}

function people(v: unknown): { names: string[]; url?: string } {
  const list = Array.isArray(v) ? v : v === undefined ? [] : [v];
  const names: string[] = [];
  let url: string | undefined;
  for (const p of list) {
    if (typeof p === 'string') names.push(p.trim());
    else if (isObj(p)) {
      const n = str(p.name);
      if (n) names.push(n);
      url ??= str(p.url);
    }
  }
  return { names: names.filter(Boolean), url };
}

function imageUrls(node: Json): string[] {
  return [node.contentUrl, node.url].flatMap((v) => (Array.isArray(v) ? v : [v])).filter((v): v is string => typeof v === 'string');
}

function jsonLdCredit(doc: Document, imageUrl: string): PageCredit['jsonLd'] {
  for (const script of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    let data: unknown;
    try {
      data = JSON.parse(script.textContent ?? '');
    } catch {
      continue;
    }
    for (const node of walk(data)) {
      if (!imageUrls(node).some((u) => sameImage(u, imageUrl))) continue;
      const creator = people(node.creator ?? node.author);
      const credit = {
        title: str(node.name) ?? str(node.caption),
        creator: creator.names.length ? creator.names.join(', ') : undefined,
        creatorUrl: creator.url,
        creditText: str(node.creditText),
        copyrightNotice: str(node.copyrightNotice),
        license: str(node.license),
        acquireLicensePage: str(node.acquireLicensePage),
      };
      const defined = Object.fromEntries(Object.entries(credit).filter(([, v]) => v !== undefined));
      if (Object.keys(defined).length) return defined;
    }
  }
  return undefined;
}

const NOAI = /\bno(image)?ai\b/i;

/** Credit facts the page states about one image. Pure DOM reading; never throws. */
export function extractPageCredit(doc: Document, imageUrl: string): PageCredit {
  const meta = (sel: string) => str(doc.querySelector<HTMLMetaElement>(sel)?.content);
  const noAI = Array.from(doc.querySelectorAll<HTMLMetaElement>('meta[name]')).some(
    (m) => /robots|bot$/i.test(m.name) && NOAI.test(m.content),
  );
  return {
    jsonLd: jsonLdCredit(doc, imageUrl),
    relLicense: str(doc.querySelector<HTMLAnchorElement | HTMLLinkElement>('a[rel~="license"], link[rel~="license"]')?.getAttribute('href')),
    metaAuthor: meta('meta[name="author"]') ?? meta('meta[property="article:author"]') ?? meta('meta[name="twitter:creator"]'),
    noAI,
  };
}
