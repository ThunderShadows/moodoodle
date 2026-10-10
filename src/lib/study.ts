/** Study tools: value, notan, posterize, grid and palette helpers. Pure pixel maths on RGBA arrays. */

/** Perceived lightness of a colour, 0 (black) to 255 (white). */
export function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Turns the picture into greys so only light and dark remain. */
export function toValues(px: Uint8ClampedArray): void {
  for (let i = 0; i < px.length; i += 4) {
    const v = luminance(px[i]!, px[i + 1]!, px[i + 2]!);
    px[i] = px[i + 1] = px[i + 2] = v;
  }
}

/** Evenly spaced greys from black to white, e.g. 3 → [0, 128, 255]. */
export function tones(count: number): number[] {
  return Array.from({ length: count }, (_, i) => Math.round((i * 255) / (count - 1)));
}

/** Notan: every pixel becomes one of a few flat greys, split at the given lightness thresholds. */
export function notan(px: Uint8ClampedArray, thresholds: number[]): void {
  const t = [...thresholds].sort((a, b) => a - b);
  const grey = tones(t.length + 1);
  for (let i = 0; i < px.length; i += 4) {
    const v = luminance(px[i]!, px[i + 1]!, px[i + 2]!);
    let band = 0;
    while (band < t.length && v >= t[band]!) band++;
    px[i] = px[i + 1] = px[i + 2] = grey[band]!;
  }
}

/**
 * Where to split the picture's lights and darks for a 2- or 3-value notan (Otsu's method:
 * the split that makes each group as even inside as possible, so it falls in the gaps between masses).
 */
export function autoThresholds(px: Uint8ClampedArray, bands: 2 | 3): number[] {
  const hist = new Float64Array(256);
  let total = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3]! < 128) continue;
    hist[Math.round(luminance(px[i]!, px[i + 1]!, px[i + 2]!))]!++;
    total++;
  }
  if (!total) return tones(bands + 1).slice(1, -1);
  // Running counts and sums, so any range's weight and mean come out in O(1).
  const n = new Float64Array(257), m = new Float64Array(257);
  for (let v = 0; v < 256; v++) { n[v + 1] = n[v]! + hist[v]!; m[v + 1] = m[v]! + v * hist[v]!; }
  const score = (lo: number, hi: number) => { const w = n[hi]! - n[lo]!; return w ? (m[hi]! - m[lo]!) ** 2 / w : 0; };
  let best = -1, out: number[] = [];
  if (bands === 2) {
    // Every split inside an empty gap scores the same: use the middle of the gap.
    let last = 1;
    for (let t = 1; t < 256; t++) {
      const s = score(0, t) + score(t, 256);
      if (s > best + 1e-6) { best = s; out = [t]; last = t; } else if (s > best - 1e-6) last = t;
    }
    if (out.length) out = [Math.round((out[0]! + last) / 2)];
  } else {
    for (let t1 = 1; t1 < 255; t1++) for (let t2 = t1 + 1; t2 < 256; t2++) {
      const s = score(0, t1) + score(t1, t2) + score(t2, 256);
      if (s > best) { best = s; out = [t1, t2]; }
    }
  }
  return out;
}

/** Flattens colours (or greys) into a few steps per channel, like a limited paint set. */
export function posterize(px: Uint8ClampedArray, levels: number, values = false): void {
  const step = 255 / (Math.max(2, Math.round(levels)) - 1);
  const q = (v: number) => Math.round(Math.round(v / step) * step);
  for (let i = 0; i < px.length; i += 4) {
    if (values) {
      px[i] = px[i + 1] = px[i + 2] = q(luminance(px[i]!, px[i + 1]!, px[i + 2]!));
    } else {
      px[i] = q(px[i]!);
      px[i + 1] = q(px[i + 1]!);
      px[i + 2] = q(px[i + 2]!);
    }
  }
}

export type GridKind = 'off' | 'thirds' | '4' | '6' | 'diagonal';

/** Where a grid's lines fall, as fractions of the width and height (diagonals run corner to corner). */
export function gridLines(kind: GridKind): { lines: number[]; diagonals: boolean } {
  const even = (n: number) => Array.from({ length: n - 1 }, (_, i) => (i + 1) / n);
  switch (kind) {
    case 'thirds': return { lines: even(3), diagonals: false };
    case '4': return { lines: even(4), diagonals: false };
    case '6': return { lines: even(6), diagonals: false };
    case 'diagonal': return { lines: [0.5], diagonals: true };
    default: return { lines: [], diagonals: false };
  }
}

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};

/** Sorts a palette from darkest to lightest, the way a value scale is laid out. */
export function byValue(palette: string[]): string[] {
  const v = (hex: string) => luminance(...rgb(hex));
  return [...palette].sort((a, b) => v(a) - v(b));
}

/** A palette file for Krita, GIMP and Inkscape (.gpl). */
export function toGpl(palette: string[], name: string): string {
  const rows = palette.map((hex) => `${rgb(hex).map((c) => String(c).padStart(3)).join(' ')}\t${hex}`);
  const clean = name.replace(/[\r\n]+/g, ' ').trim() || 'kudoodle';
  return `GIMP Palette\nName: ${clean}\nColumns: ${palette.length}\n#\n${rows.join('\n')}\n`;
}
