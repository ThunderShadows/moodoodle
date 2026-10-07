/** One object URL per id, created once even when several callers ask at the same time. */
export function createUrlCache(
  load: (id: string) => Promise<Blob | undefined>,
  makeUrl: (blob: Blob) => string = (b) => URL.createObjectURL(b),
  revoke: (url: string) => void = (u) => URL.revokeObjectURL(u),
) {
  const urls = new Map<string, string>();
  const pending = new Map<string, Promise<string | undefined>>();

  return {
    get(id: string): Promise<string | undefined> {
      const ready = urls.get(id);
      if (ready) return Promise.resolve(ready);
      let p = pending.get(id);
      if (!p) {
        p = load(id).then((blob) => {
          pending.delete(id);
          if (!blob) return undefined;
          const url = makeUrl(blob);
          urls.set(id, url);
          return url;
        });
        pending.set(id, p);
      }
      return p;
    },
    peek(id: string): string | undefined {
      return urls.get(id);
    },
    drop(id: string): void {
      const url = urls.get(id);
      if (url) revoke(url);
      urls.delete(id);
    },
  };
}
