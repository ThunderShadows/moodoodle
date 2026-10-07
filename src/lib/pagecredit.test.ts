// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { extractPageCredit } from './pagecredit';

function page(head: string, body = '') {
  document.head.innerHTML = head;
  document.body.innerHTML = body;
  return document;
}
const ld = (obj: unknown) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;

describe('extractPageCredit', () => {
  beforeEach(() => page(''));

  it('reads the ImageObject that matches the kept image (ignoring query strings)', () => {
    const doc = page(ld({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'ImageObject', contentUrl: 'https://cdn.x.com/other.jpg', creator: { name: 'Someone Else' } },
        {
          '@type': 'ImageObject', contentUrl: 'https://cdn.x.com/flower.jpg', name: 'Flower study',
          creator: [{ '@type': 'Person', name: 'Jane Doe', url: 'https://x.com/jane' }, { '@type': 'Person', name: 'Sam' }],
          license: 'https://creativecommons.org/licenses/by/4.0/', creditText: 'Jane Doe', copyrightNotice: '© Jane Doe',
          acquireLicensePage: 'https://x.com/license',
        },
      ],
    }));
    expect(extractPageCredit(doc, 'https://cdn.x.com/flower.jpg?w=800').jsonLd).toEqual({
      title: 'Flower study', creator: 'Jane Doe, Sam', creatorUrl: 'https://x.com/jane', creditText: 'Jane Doe',
      copyrightNotice: '© Jane Doe', license: 'https://creativecommons.org/licenses/by/4.0/', acquireLicensePage: 'https://x.com/license',
    });
  });

  it('finds images nested as the image of an article, with string creators', () => {
    const doc = page(ld({ '@type': 'Article', image: { '@type': 'ImageObject', url: 'https://x.com/a.png', creator: 'Ana P.' } }));
    expect(extractPageCredit(doc, 'https://x.com/a.png').jsonLd?.creator).toBe('Ana P.');
  });

  it('gives no JSON-LD credit when no entry matches the kept image', () => {
    const doc = page(ld({ '@type': 'ImageObject', contentUrl: 'https://x.com/b.png', creator: 'Nope' }));
    expect(extractPageCredit(doc, 'https://x.com/a.png').jsonLd).toBeUndefined();
  });

  it('ignores malformed JSON-LD blocks and keeps reading the others', () => {
    const doc = page('<script type="application/ld+json">{ not json</script>' + ld({ '@type': 'ImageObject', contentUrl: 'https://x.com/a.png', creator: 'Ok' }));
    expect(extractPageCredit(doc, 'https://x.com/a.png').jsonLd?.creator).toBe('Ok');
  });

  it('reads rel=license links and author meta', () => {
    const doc = page('<meta name="author" content="Mira K.">', '<a rel="license" href="https://creativecommons.org/licenses/by-nc/4.0/">CC</a>');
    expect(extractPageCredit(doc, 'https://x.com/a.png')).toMatchObject({
      relLicense: 'https://creativecommons.org/licenses/by-nc/4.0/', metaAuthor: 'Mira K.', noAI: false,
    });
  });

  it('detects NoAI robots meta in any case', () => {
    expect(extractPageCredit(page('<meta name="robots" content="index, NoImageAI">'), 'https://x.com/a.png').noAI).toBe(true);
    expect(extractPageCredit(page('<meta name="robots" content="noai">'), 'https://x.com/a.png').noAI).toBe(true);
    expect(extractPageCredit(page('<meta name="robots" content="noindex">'), 'https://x.com/a.png').noAI).toBe(false);
  });
});
