export function isKeepableUrl(url: string): boolean {
  if (url.startsWith('data:image/')) return true;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function lensUrl(imageUrl: string): string | null {
  let u: URL;
  try {
    u = new URL(imageUrl);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  return `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(u.href)}`;
}
