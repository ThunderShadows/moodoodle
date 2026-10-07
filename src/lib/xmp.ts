import type { XmpCredit } from './types';

const SCAN_BYTES = 256 * 1024;

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Value of an XMP property in element form (first rdf:li if it's a list) or attribute form. */
function prop(xmp: string, name: string): string | undefined {
  const el = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`).exec(xmp);
  if (el) {
    const li = /<rdf:li\b[^>]*>([\s\S]*?)<\/rdf:li>/.exec(el[1]!);
    const text = (li ? li[1]! : el[1]!).replace(/<[^>]+>/g, '').trim();
    if (text) return decodeEntities(text);
  }
  const resource = new RegExp(`<${name}\\b[^>]*rdf:resource="([^"]*)"`).exec(xmp);
  if (resource?.[1]) return decodeEntities(resource[1]);
  const attr = new RegExp(`\\s${name}="([^"]*)"`).exec(xmp);
  return attr?.[1] ? decodeEntities(attr[1]) : undefined;
}

/**
 * Reads credit facts from the XMP packet embedded in an image file, as text
 * (service workers have no DOMParser). Only the first 256 KB is scanned.
 */
export function readXmp(bytes: Uint8Array): XmpCredit | undefined {
  const text = new TextDecoder('utf-8').decode(bytes.subarray(0, SCAN_BYTES));
  const packet = /<x:xmpmeta[\s\S]*?<\/x:xmpmeta>/.exec(text)?.[0];
  if (!packet) return undefined;
  const dataMining = prop(packet, 'plus:DataMining');
  const credit: XmpCredit = {
    creator: prop(packet, 'dc:creator'),
    rights: prop(packet, 'dc:rights'),
    webStatement: prop(packet, 'xmpRights:WebStatement'),
    license: prop(packet, 'cc:license'),
    noAI: !!dataMining && /DMI-PROHIBITED/i.test(dataMining),
  };
  return Object.fromEntries(Object.entries(credit).filter(([, v]) => v !== undefined)) as XmpCredit;
}
