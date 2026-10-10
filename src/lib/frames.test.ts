import { describe, it, expect } from 'vitest';
import { frameLabel, sniffImageType } from './frames';

const bytes = (s: string, ...extra: number[]) => new Uint8Array([...extra, ...Array.from(s, (c) => c.charCodeAt(0))]);

describe('sniffImageType', () => {
  it('recognises animated-capable formats from their first bytes', () => {
    expect(sniffImageType(bytes('GIF89a'))).toBe('image/gif');
    expect(sniffImageType(bytes('RIFF\0\0\0\0WEBPVP8X'))).toBe('image/webp');
    expect(sniffImageType(bytes('PNG\r\n', 0x89))).toBe('image/png');
  });
  it('falls back to the content type for anything else', () => {
    expect(sniffImageType(bytes('\xff\xd8\xff'), 'image/jpeg')).toBe('image/jpeg');
    expect(sniffImageType(bytes('hello'))).toBe('');
  });
});

describe('frameLabel', () => {
  it('counts frames from 1 for people', () => {
    expect(frameLabel(0, 12)).toBe('Frame 1 of 12');
    expect(frameLabel(11, 12)).toBe('Frame 12 of 12');
  });
});
