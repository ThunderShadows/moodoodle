import { BADGE_LABEL, type Badge } from './license';

export interface OrbitResult {
  id: string;
  src: string;
  title: string;
  creator?: string;
  badge: Badge;
}

export interface OrbitData {
  title: string;
  centerSrc: string;
  results: OrbitResult[];
  learning: boolean;
  loading?: boolean;
  failed?: boolean;
  lensUrl: string | null;
  /** Outer "around the web" ring. Plus-only; 'locked' shows the invitation (v1.2 spec §11). */
  web?: { state: 'locked' };
}

export interface OrbitHandlers {
  onClose(): void;
  onShowInGallery(id: string): void;
  /** Called when a free user taps "Search the web too · Plus". */
  onUnlock?(): void;
}

const MAX = 6;
const STAGE = 760;
const RING = 200;
const OUTER = 330;
const OUTER_SLOTS = 8;

export const orbitCss = `
.orbit { position: fixed; inset: 0; z-index: 2147483647; font: 500 15px/1.4 var(--body, system-ui, sans-serif); color: #FFFFFF; }
.orbit * { box-sizing: border-box; }
.backdrop { position: absolute; inset: 0; background: rgba(34, 28, 43, 0.86); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
.head { position: absolute; top: 28px; left: 32px; display: flex; flex-direction: column; gap: 8px; max-width: 40vw; pointer-events: none; }
.head .more { font: italic 600 20px/1 var(--hand, system-ui, sans-serif); color: #CFC6DD; }
.head .title { font: 800 30px/1.05 var(--display, system-ui, sans-serif); letter-spacing: -0.02em; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.legend { align-self: flex-start; display: flex; align-items: center; gap: 8px; height: 30px; padding: 0 12px; border-radius: 999px; background: rgba(255,255,255,0.12); font-size: 13px; font-weight: 600; }
.legend i { width: 10px; height: 10px; border-radius: 50%; background: #FFB58F; }
.close { position: absolute; top: 28px; right: 32px; width: 48px; height: 48px; border: 0; border-radius: 50%; background: rgba(255,255,255,0.14); color: #FFFFFF; font-size: 22px; cursor: pointer; }
.stage { --s: min(${STAGE}px, 92vw, 82vh); position: absolute; left: 50%; top: 50%; width: var(--s); height: var(--s); transform: translate(-50%, -50%); }
.ringline { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.spin { position: absolute; inset: 0; animation: mo-spin 60s linear infinite; }
.counter { width: 100%; height: 100%; animation: mo-spin 60s linear infinite reverse; }
.stage:hover .spin, .stage:hover .counter { animation-play-state: paused; }
.still .spin, .still .counter { animation: none; }
@media (prefers-reduced-motion: reduce) { .spin, .counter { animation: none; } }
@keyframes mo-spin { to { transform: rotate(360deg); } }
.slot { position: absolute; width: calc(var(--s) * ${100 / STAGE}); height: calc(var(--s) * ${100 / STAGE}); transform: translate(-50%, -50%); }
.orb { width: 100%; height: 100%; padding: 0; border: 4px solid #FFFFFF; border-radius: 50%; overflow: hidden; background: #3A3245; cursor: pointer; box-shadow: 0 8px 22px rgba(0,0,0,0.3); transition: transform .2s ease; }
.orb:hover, .orb.on { transform: scale(1.12); border-color: #FFB58F; }
.orb:focus-visible, .close:focus-visible, .card button:focus-visible { outline: 3px solid #FFB58F; outline-offset: 3px; }
.orb img, .center img { width: 100%; height: 100%; object-fit: cover; display: block; }
.center { position: absolute; left: 50%; top: 50%; width: calc(var(--s) * ${220 / STAGE}); height: calc(var(--s) * ${220 / STAGE}); transform: translate(-50%, -50%); border-radius: 50%; overflow: hidden; border: 6px solid #FFFFFF; background: #3A3245; box-shadow: 0 0 0 16px rgba(255,181,143,0.22), 0 20px 50px rgba(0,0,0,0.35); }
.ghost { position: absolute; width: calc(var(--s) * ${76 / STAGE}); height: calc(var(--s) * ${76 / STAGE}); transform: translate(-50%, -50%); border-radius: 50%; border: 2px dashed rgba(255,255,255,0.22); }
.unlock { position: absolute; left: 50%; top: calc(50% - var(--s) * ${(OUTER + 46) / STAGE}); transform: translateX(-50%); display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 6px 0 16px; border: 0; border-radius: 999px; background: rgba(255,255,255,0.14); color: #FFFFFF; font: inherit; font-size: 14px; font-weight: 600; white-space: nowrap; cursor: pointer; }
.unlock b { height: 30px; display: inline-flex; align-items: center; padding: 0 12px; border-radius: 999px; background: #FFB58F; color: #2A2433; font-size: 13px; }
.unlock:focus-visible { outline: 3px solid #FFB58F; outline-offset: 3px; }
.note { position: absolute; left: 50%; top: calc(50% + var(--s) * 0.2); transform: translateX(-50%); width: min(420px, 80vw); text-align: center; font: italic 600 20px/1.3 var(--hand, system-ui, sans-serif); color: #EDE7F5; }
.card { position: absolute; left: 50%; bottom: 24px; transform: translateX(-50%); width: min(520px, calc(100vw - 32px)); display: flex; align-items: center; gap: 14px; padding: 12px 12px 12px 18px; border-radius: 22px; background: #FFFFFF; color: #2A2433; box-shadow: 0 18px 40px rgba(0,0,0,0.3); }
.card .text { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
.card .t { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card .by { font-size: 13px; color: #6E6578; }
.card button { flex-shrink: 0; height: 44px; padding: 0 18px; border: 0; border-radius: 999px; background: #FFB58F; color: #2A2433; font: inherit; font-weight: 700; cursor: pointer; }
.badge { align-self: flex-start; display: inline-flex; height: 22px; align-items: center; padding: 0 9px; border-radius: 999px; font-size: 12px; font-weight: 600; }
.badge.reuse { background: #CDEFD9; color: #1F5C3D; } .badge.conditions { background: #FFE7C7; color: #7A4A00; } .badge.reference { background: #ECE8F3; color: #4A4256; }
.hint { position: absolute; left: 32px; bottom: 32px; font: italic 600 18px/1 var(--hand, system-ui, sans-serif); color: #CFC6DD; }
.lens { position: absolute; right: 32px; bottom: 34px; color: #FFB58F; font-weight: 700; font-size: 14px; }
@media (max-width: 720px) { .hint, .head .more { display: none; } .lens { bottom: auto; top: 90px; right: 32px; } }
`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

/** Opens the Find-similar orbit inside `root` (a shadow root or any element). Page text is always set as text. */
export function openOrbit(root: ShadowRoot | HTMLElement, data: OrbitData, handlers: OrbitHandlers) {
  const style = el('style');
  style.textContent = orbitCss;
  const overlay = el('div', 'orbit');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) overlay.classList.add('still');
  root.append(style, overlay);

  let current = data;
  let picked: string | undefined;
  let plusNote = false;

  function close() {
    document.removeEventListener('keydown', onKey, true);
    overlay.remove();
    style.remove();
    handlers.onClose();
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  }
  document.addEventListener('keydown', onKey, true);

  function render() {
    const d = current;
    const results = d.results.slice(0, MAX);
    overlay.replaceChildren();
    overlay.setAttribute('aria-label', `More like ${d.title}`);

    const backdrop = el('div', 'backdrop');
    backdrop.addEventListener('click', close);

    const head = el('div', 'head');
    const legend = el('span', 'legend');
    legend.append(el('i'), document.createTextNode(`In your saves · ${results.length}`));
    head.append(el('span', 'more', 'more like'), el('span', 'title', d.title), legend);

    const closeBtn = el('button', 'close', '×');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.addEventListener('click', close);

    const stage = el('div', 'stage');
    const ring = svg('svg', { class: 'ringline', viewBox: `0 0 ${STAGE} ${STAGE}`, 'aria-hidden': 'true' });
    ring.append(svg('circle', { cx: STAGE / 2, cy: STAGE / 2, r: RING, fill: 'none', stroke: 'rgba(255,255,255,0.16)', 'stroke-width': 1.5 }));
    const spin = el('div', 'spin');
    const spokes = svg('svg', { class: 'ringline', viewBox: `0 0 ${STAGE} ${STAGE}`, 'aria-hidden': 'true' });
    spin.append(spokes);

    results.forEach((r, i) => {
      const a = (i / results.length) * Math.PI * 2 - Math.PI / 2;
      const x = STAGE / 2 + RING * Math.cos(a);
      const y = STAGE / 2 + RING * Math.sin(a);
      spokes.append(svg('line', { x1: STAGE / 2, y1: STAGE / 2, x2: x.toFixed(1), y2: y.toFixed(1), stroke: 'rgba(255,181,143,0.35)', 'stroke-width': 1.5 }));
      const slot = el('div', 'slot');
      slot.style.left = `${(x / STAGE) * 100}%`;
      slot.style.top = `${(y / STAGE) * 100}%`;
      const counter = el('div', 'counter');
      const orb = el('button', `orb${picked === r.id ? ' on' : ''}`);
      orb.type = 'button';
      orb.setAttribute('aria-label', r.creator ? `${r.title}, by ${r.creator}` : r.title);
      const img = el('img');
      img.alt = '';
      img.src = r.src;
      orb.append(img);
      orb.addEventListener('click', () => { picked = r.id; render(); });
      counter.append(orb);
      slot.append(counter);
      spin.append(slot);
    });

    if (d.web?.state === 'locked') {
      ring.append(svg('circle', { cx: STAGE / 2, cy: STAGE / 2, r: OUTER, fill: 'none', stroke: 'rgba(255,255,255,0.10)', 'stroke-width': 1.5, 'stroke-dasharray': '4 8' }));
      for (let i = 0; i < OUTER_SLOTS; i++) {
        const a = (i / OUTER_SLOTS) * Math.PI * 2 - Math.PI / 2 + Math.PI / OUTER_SLOTS;
        const ghost = el('div', 'ghost');
        ghost.style.left = `${((STAGE / 2 + OUTER * Math.cos(a)) / STAGE) * 100}%`;
        ghost.style.top = `${((STAGE / 2 + OUTER * Math.sin(a)) / STAGE) * 100}%`;
        stage.append(ghost);
      }
      const unlock = el('button', 'unlock', 'Search the web too ');
      unlock.type = 'button';
      unlock.append(el('b', '', 'Plus'));
      unlock.addEventListener('click', () => {
        if (handlers.onUnlock) handlers.onUnlock();
        else { plusNote = true; render(); }
      });
      stage.append(unlock);
    }

    const center = el('div', 'center');
    const cimg = el('img');
    cimg.alt = d.title;
    cimg.src = d.centerSrc;
    center.append(cimg);
    stage.append(ring, spin, center);

    const note = plusNote ? 'Web search is coming with kudoodle Plus, along with unlimited boards and downloads.' : noteText(d, results.length);
    if (note) stage.append(el('p', 'note', note));

    overlay.append(backdrop, head, closeBtn, stage, el('span', 'hint', 'hover to pause · click to peek'));
    if (d.lensUrl) {
      const lens = el('a', 'lens', 'Open in Google Lens ↗');
      lens.href = d.lensUrl;
      lens.target = '_blank';
      lens.rel = 'noopener';
      overlay.append(lens);
    }

    const choice = results.find((r) => r.id === picked);
    if (choice) {
      const card = el('div', 'card');
      const text = el('div', 'text');
      text.append(el('span', 't', choice.title));
      if (choice.creator) text.append(el('span', 'by', `by ${choice.creator}`));
      text.append(el('span', `badge ${choice.badge}`, BADGE_LABEL[choice.badge]));
      const show = el('button', '', 'Show in gallery');
      show.type = 'button';
      show.addEventListener('click', () => handlers.onShowInGallery(choice.id));
      card.append(text, show);
      overlay.append(card);
    }
  }

  render();
  closeFocus(overlay);

  return {
    update(next: OrbitData) {
      current = next;
      render();
    },
    close,
  };
}

function noteText(d: OrbitData, count: number): string | undefined {
  if (d.loading) return 'Looking through your saves…';
  if (d.failed) return "Sorry, kudoodle couldn't read this image. Try Google Lens instead.";
  if (count > 0) return d.learning ? 'Still learning your collection… more matches soon' : undefined;
  if (d.learning) return 'Still learning your collection… try again in a moment';
  return 'Nothing like this in your saves yet';
}

function closeFocus(overlay: HTMLElement) {
  overlay.querySelector<HTMLButtonElement>('button.close')?.focus();
}
