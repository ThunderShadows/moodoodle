/** Artist communities where kudoodle never collects in bulk (v1.2 spec §6). */
export const ARTIST_PLATFORMS = ['artstation.com', 'cara.app', 'deviantart.com', 'behance.net', 'dribbble.com'];

export function isArtistPlatform(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return ARTIST_PLATFORMS.some((d) => host === d || host.endsWith(`.${d}`));
}

/** "Keep all" is off on artist platforms and on pages that opt out of AI use. */
export function bulkKeepBlocked(pageUrl: string, pageNoAI: boolean): boolean {
  return pageNoAI || isArtistPlatform(pageUrl);
}

export const BULK_BLOCKED_MESSAGE = 'Artists here asked not to be collected in bulk. Keep the ones you love one at a time.';
