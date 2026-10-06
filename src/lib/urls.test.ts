import { describe, it, expect } from 'vitest';
import { isKeepableUrl, lensUrl } from './urls';

describe('isKeepableUrl', () => {
  it('accepts http, https and data:image URLs', () => {
    expect(isKeepableUrl('https://a.com/x.png')).toBe(true);
    expect(isKeepableUrl('http://a.com/x.png')).toBe(true);
    expect(isKeepableUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
  });
  it('rejects blob, chrome, data:text and garbage', () => {
    expect(isKeepableUrl('blob:https://a.com/123')).toBe(false);
    expect(isKeepableUrl('chrome://favicon/x')).toBe(false);
    expect(isKeepableUrl('data:text/html,hi')).toBe(false);
    expect(isKeepableUrl('not a url')).toBe(false);
    expect(isKeepableUrl('')).toBe(false);
  });
});

describe('lensUrl', () => {
  it('builds an encoded Google Lens link for web URLs', () => {
    expect(lensUrl('https://a.com/x y.png?s=1&t=2')).toBe(
      'https://lens.google.com/uploadbyurl?url=' +
        encodeURIComponent('https://a.com/x%20y.png?s=1&t=2'),
    );
  });
  it('returns null for data URLs and non-web URLs', () => {
    expect(lensUrl('data:image/png;base64,iVBORw0KGgo=')).toBeNull();
    expect(lensUrl('blob:https://a.com/123')).toBeNull();
    expect(lensUrl('nope')).toBeNull();
  });
});
