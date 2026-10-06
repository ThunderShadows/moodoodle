import { describe, it, expect } from 'vitest';
import { toastText } from './toast';
import type { SavedImage } from './types';

const image = { site: 'dribbble.com', colorFamily: 'orange' } as SavedImage;

describe('toastText', () => {
  it('celebrates a keep', () => {
    expect(toastText({ status: 'kept', image })).toBe('Kept! Orange · from dribbble.com');
  });
  it('explains duplicates and each error', () => {
    expect(toastText({ status: 'duplicate', image })).toBe('Already in your collection');
    expect(toastText({ status: 'error', reason: 'unsupported-url' })).toBe("This image can't be saved");
    expect(toastText({ status: 'error', reason: 'fetch-failed' })).toBe('This site blocked the download');
    expect(toastText({ status: 'error', reason: 'not-an-image' })).toBe("That link isn't an image");
    expect(toastText({ status: 'error', reason: 'too-big' })).toBe('That image is over 25 MB');
    expect(toastText({ status: 'error', reason: 'decode-failed' })).toBe("This image format isn't supported yet");
  });
});
