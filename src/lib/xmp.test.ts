import { describe, it, expect } from 'vitest';
import { readXmp } from './xmp';

const enc = (s: string) => new TextEncoder().encode(s);
const packet = (inner: string) => `JUNK\xff\xd8<?xpacket begin=""?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF><rdf:Description ${inner}</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>MORE`;

describe('readXmp', () => {
  it('returns undefined when the file has no XMP packet', () => {
    expect(readXmp(enc('just pixels'))).toBeUndefined();
  });

  it('reads creator, rights, web statement and license (element form)', () => {
    const xmp = packet(`>
      <dc:creator><rdf:Seq><rdf:li>Jane Doe</rdf:li><rdf:li>Sam</rdf:li></rdf:Seq></dc:creator>
      <dc:rights><rdf:Alt><rdf:li xml:lang="x-default">© 2026 Jane Doe</rdf:li></rdf:Alt></dc:rights>
      <xmpRights:WebStatement>https://x.com/terms</xmpRights:WebStatement>
      <cc:license rdf:resource="https://creativecommons.org/licenses/by/4.0/"/>`);
    expect(readXmp(enc(xmp))).toEqual({
      creator: 'Jane Doe', rights: '© 2026 Jane Doe', webStatement: 'https://x.com/terms',
      license: 'https://creativecommons.org/licenses/by/4.0/', noAI: false,
    });
  });

  it('reads attribute-form properties and decodes XML entities', () => {
    const xmp = packet(`xmpRights:WebStatement="https://x.com/t?a=1&amp;b=2" plus:DataMining="http://ns.useplus.org/ldf/vocab/DMI-PROHIBITED-AIMLTRAINING">`);
    expect(readXmp(enc(xmp))).toMatchObject({ webStatement: 'https://x.com/t?a=1&b=2', noAI: true });
  });

  it('treats any DMI-PROHIBITED data-mining value as NoAI, and DMI-ALLOWED as not', () => {
    expect(readXmp(enc(packet('><plus:DataMining>DMI-PROHIBITED-GENAIMLTRAINING</plus:DataMining>')))?.noAI).toBe(true);
    expect(readXmp(enc(packet('><plus:DataMining>DMI-ALLOWED</plus:DataMining>')))?.noAI).toBe(false);
  });

  it('only scans the first 256 KB', () => {
    const big = new Uint8Array(300 * 1024 + 1000);
    big.set(enc(packet('><dc:creator><rdf:Seq><rdf:li>Late</rdf:li></rdf:Seq></dc:creator>')), 300 * 1024);
    expect(readXmp(big)).toBeUndefined();
  });
});
