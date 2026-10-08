// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openOrbit, type OrbitData } from './orbit';

const result = (i: number) => ({ id: `id${i}`, src: `data:image/png;base64,${i}`, title: `Image ${i}`, creator: i === 0 ? 'Jane' : undefined, badge: 'reuse' as const });
const data = (over: Partial<OrbitData> = {}): OrbitData => ({
  title: 'Peach flower', centerSrc: 'https://x.com/a.png', results: [0, 1, 2].map(result), learning: false, lensUrl: 'https://lens.google.com/uploadbyurl?url=x', ...over,
});

let host: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.append(host);
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
});

describe('openOrbit', () => {
  it('puts the chosen image in the center and one orb per result (max 6)', () => {
    openOrbit(host, data({ results: Array.from({ length: 9 }, (_, i) => result(i)) }), { onClose: vi.fn(), onShowInGallery: vi.fn() });
    expect(host.querySelector<HTMLImageElement>('.center img')!.src).toBe('https://x.com/a.png');
    expect(host.querySelectorAll('.orb')).toHaveLength(6);
    expect(host.querySelectorAll('line')).toHaveLength(6);
  });

  it('shows a card with title, creator and badge when an orb is clicked, and opens it in the gallery', () => {
    const onShowInGallery = vi.fn();
    openOrbit(host, data(), { onClose: vi.fn(), onShowInGallery });
    host.querySelector<HTMLButtonElement>('.orb')!.click();
    const card = host.querySelector('.card')!;
    expect(card.textContent).toContain('Image 0');
    expect(card.textContent).toContain('by Jane');
    expect(card.textContent).toContain('Free to reuse');
    card.querySelector<HTMLButtonElement>('button')!.click();
    expect(onShowInGallery).toHaveBeenCalledWith('id0');
  });

  it('explains the empty, learning, loading and failed states', () => {
    const h = { onClose: vi.fn(), onShowInGallery: vi.fn() };
    const o = openOrbit(host, data({ results: [] }), h);
    expect(host.textContent).toContain('Nothing like this in your saves yet');
    o.update(data({ results: [], learning: true }));
    expect(host.textContent).toContain('Still learning your collection');
    o.update(data({ results: [], loading: true }));
    expect(host.textContent).toContain('Looking through your saves');
    o.update(data({ results: [], failed: true }));
    expect(host.textContent).toContain("couldn't read this image");
  });

  it('closes on Escape, on the close button and on the backdrop', () => {
    const onClose = vi.fn();
    openOrbit(host, data(), { onClose, onShowInGallery: vi.fn() });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(host.querySelector('.orbit')).toBeNull();

    const onClose2 = vi.fn();
    openOrbit(host, data(), { onClose: onClose2, onShowInGallery: vi.fn() });
    host.querySelector<HTMLButtonElement>('button.close')!.click();
    expect(onClose2).toHaveBeenCalledTimes(1);

    const onClose3 = vi.fn();
    openOrbit(host, data(), { onClose: onClose3, onShowInGallery: vi.fn() });
    host.querySelector<HTMLElement>('.backdrop')!.click();
    expect(onClose3).toHaveBeenCalledTimes(1);
  });

  it('keeps still for people who prefer reduced motion', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never;
    openOrbit(host, data(), { onClose: vi.fn(), onShowInGallery: vi.fn() });
    expect(host.querySelector('.orbit')!.classList.contains('still')).toBe(true);
  });

  it('treats page text as text, never HTML', () => {
    openOrbit(host, data({ title: '<img src=x onerror=alert(1)>' }), { onClose: vi.fn(), onShowInGallery: vi.fn() });
    expect(host.querySelector('.head .title')!.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(host.querySelectorAll('.head img')).toHaveLength(0);
  });

  it('links to Google Lens only when there is a Lens URL', () => {
    const o = openOrbit(host, data(), { onClose: vi.fn(), onShowInGallery: vi.fn() });
    expect(host.querySelector<HTMLAnchorElement>('a.lens')!.href).toContain('lens.google.com');
    o.update(data({ lensUrl: null }));
    expect(host.querySelector('a.lens')).toBeNull();
  });
});
