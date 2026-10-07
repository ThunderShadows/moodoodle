import type { KeepErrorReason, KeepResult } from './types';

const ERRORS: Record<KeepErrorReason, string> = {
  'unsupported-url': "This image can't be saved",
  'fetch-failed': 'This site blocked the download',
  'not-an-image': "That link isn't an image",
  'too-big': 'That image is over 25 MB',
  'decode-failed': "This image format isn't supported yet",
};

export function toastText(result: KeepResult): string {
  if (result.status === 'kept') {
    if (result.boardName) return `Kept to ${result.boardName} · from ${result.image.site}`;
    const family = result.image.colorFamily;
    return `Kept! ${family[0]!.toUpperCase()}${family.slice(1)} · from ${result.image.site}`;
  }
  if (result.status === 'duplicate') {
    if (result.addedToBoard) return `Already kept, added to ${result.boardName}`;
    if (result.boardName) return `Already in ${result.boardName}`;
    return 'Already in your collection';
  }
  return ERRORS[result.reason];
}
