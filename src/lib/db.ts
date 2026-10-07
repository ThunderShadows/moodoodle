import { openDB, type DBSchema } from 'idb';
import type { SavedImage } from './types';

interface Schema extends DBSchema {
  images: { key: string; value: SavedImage; indexes: { byUrl: string; bySavedAt: string } };
  blobs: { key: string; value: { bytes: ArrayBuffer; type: string } };
  thumbs: { key: string; value: { bytes: ArrayBuffer; type: string } };
}

export type NewImage = Omit<SavedImage, 'id' | 'savedAt'>;

export interface ImageStore {
  findByUrl(url: string): Promise<SavedImage | undefined>;
  add(input: NewImage, blob: Blob, thumb?: Blob): Promise<SavedImage>;
  list(): Promise<SavedImage[]>;
  getBlob(id: string): Promise<Blob | undefined>;
  /** Small preview for grids; falls back to the full image for keeps made before v1.1. */
  getThumb(id: string): Promise<Blob | undefined>;
  setTags(id: string, tags: string[]): Promise<void>;
  remove(id: string): Promise<void>;
}

export function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
}

export function openImageStore(name = 'moodoodle', now: () => Date = () => new Date()): ImageStore {
  const dbp = openDB<Schema>(name, 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const images = db.createObjectStore('images', { keyPath: 'id' });
        images.createIndex('byUrl', 'imageUrl', { unique: true });
        images.createIndex('bySavedAt', 'savedAt');
        db.createObjectStore('blobs');
      }
      if (oldVersion < 2) db.createObjectStore('thumbs');
    },
  });

  return {
    async findByUrl(url) {
      return (await dbp).getFromIndex('images', 'byUrl', url);
    },
    async add(input, blob, thumb) {
      const db = await dbp;
      // Read bytes before opening the transaction: awaiting non-IDB work would auto-commit it.
      const bytes = await blob.arrayBuffer();
      const thumbBytes = thumb ? await thumb.arrayBuffer() : undefined;
      const image: SavedImage = { ...input, id: crypto.randomUUID(), savedAt: now().toISOString() };
      const tx = db.transaction(['images', 'blobs', 'thumbs'], 'readwrite');
      await Promise.all([
        tx.objectStore('images').add(image),
        tx.objectStore('blobs').put({ bytes, type: blob.type }, image.id),
        thumb && thumbBytes ? tx.objectStore('thumbs').put({ bytes: thumbBytes, type: thumb.type }, image.id) : undefined,
        tx.done,
      ]);
      return image;
    },
    async list() {
      return (await (await dbp).getAllFromIndex('images', 'bySavedAt')).reverse();
    },
    async getBlob(id) {
      const row = await (await dbp).get('blobs', id);
      return row ? new Blob([row.bytes], { type: row.type }) : undefined;
    },
    async getThumb(id) {
      const row = await (await dbp).get('thumbs', id);
      return row ? new Blob([row.bytes], { type: row.type }) : this.getBlob(id);
    },
    async setTags(id, tags) {
      const db = await dbp;
      const tx = db.transaction('images', 'readwrite');
      const image = await tx.store.get(id);
      if (image) await tx.store.put({ ...image, tags: normalizeTags(tags) });
      await tx.done;
    },
    async remove(id) {
      const db = await dbp;
      const tx = db.transaction(['images', 'blobs', 'thumbs'], 'readwrite');
      await Promise.all([
        tx.objectStore('images').delete(id),
        tx.objectStore('blobs').delete(id),
        tx.objectStore('thumbs').delete(id),
        tx.done,
      ]);
    },
  };
}
