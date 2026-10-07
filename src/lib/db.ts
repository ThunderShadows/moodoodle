import { openDB, type DBSchema } from 'idb';
import { BoardNameInvalid, validateBoardName } from './boards';
import { emptyCredit, type Board, type BoardColor, type SavedImage } from './types';

interface Schema extends DBSchema {
  images: { key: string; value: SavedImage; indexes: { byUrl: string; bySavedAt: string; byBoard: string } };
  blobs: { key: string; value: { bytes: ArrayBuffer; type: string } };
  thumbs: { key: string; value: { bytes: ArrayBuffer; type: string } };
  boards: { key: string; value: Board };
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
  listBoards(): Promise<Board[]>;
  getBoard(id: string): Promise<Board | undefined>;
  /** Throws BoardNameInvalid for empty, too-long or duplicate names. */
  createBoard(name: string, color: BoardColor): Promise<Board>;
  updateBoard(id: string, patch: { name?: string; color?: BoardColor }): Promise<void>;
  /** Removes the board from every image; never deletes images. */
  deleteBoard(id: string): Promise<void>;
  addToBoard(imageIds: string[], boardId: string): Promise<void>;
  removeFromBoard(imageIds: string[], boardId: string): Promise<void>;
}

export function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
}

export function openImageStore(name = 'moodoodle', now: () => Date = () => new Date()): ImageStore {
  const dbp = openDB<Schema>(name, 3, {
    async upgrade(db, oldVersion, _newVersion, tx) {
      if (oldVersion < 1) {
        const images = db.createObjectStore('images', { keyPath: 'id' });
        images.createIndex('byUrl', 'imageUrl', { unique: true });
        images.createIndex('bySavedAt', 'savedAt');
        db.createObjectStore('blobs');
      }
      if (oldVersion < 2) db.createObjectStore('thumbs');
      if (oldVersion < 3) {
        db.createObjectStore('boards', { keyPath: 'id' });
        const images = tx.objectStore('images');
        images.createIndex('byBoard', 'boardIds', { multiEntry: true });
        // Give pre-v1.2 images the new fields (only IDB awaits inside the upgrade transaction).
        let cursor = await images.openCursor();
        while (cursor) {
          const v = cursor.value;
          if (!v.boardIds || !v.credit) await cursor.update({ ...v, boardIds: v.boardIds ?? [], credit: v.credit ?? emptyCredit() });
          cursor = await cursor.continue();
        }
      }
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
    async listBoards() {
      return (await (await dbp).getAll('boards')).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    async getBoard(id) {
      return (await dbp).get('boards', id);
    },
    async createBoard(name, color) {
      const v = validateBoardName(name, await this.listBoards());
      if (!v.ok) throw new BoardNameInvalid(v.error);
      const board: Board = { id: crypto.randomUUID(), name: v.name, color, createdAt: now().toISOString() };
      await (await dbp).add('boards', board);
      return board;
    },
    async updateBoard(id, patch) {
      const board = await this.getBoard(id);
      if (!board) return;
      let name = board.name;
      if (patch.name !== undefined) {
        const v = validateBoardName(patch.name, await this.listBoards(), id);
        if (!v.ok) throw new BoardNameInvalid(v.error);
        name = v.name;
      }
      await (await dbp).put('boards', { ...board, name, color: patch.color ?? board.color });
    },
    async deleteBoard(id) {
      const tx = (await dbp).transaction(['images', 'boards'], 'readwrite');
      const images = tx.objectStore('images');
      for (const img of await images.index('byBoard').getAll(id)) {
        await images.put({ ...img, boardIds: img.boardIds.filter((b) => b !== id) });
      }
      await tx.objectStore('boards').delete(id);
      await tx.done;
    },
    async addToBoard(imageIds, boardId) {
      const tx = (await dbp).transaction('images', 'readwrite');
      for (const id of imageIds) {
        const img = await tx.store.get(id);
        if (img && !img.boardIds.includes(boardId)) await tx.store.put({ ...img, boardIds: [...img.boardIds, boardId] });
      }
      await tx.done;
    },
    async removeFromBoard(imageIds, boardId) {
      const tx = (await dbp).transaction('images', 'readwrite');
      for (const id of imageIds) {
        const img = await tx.store.get(id);
        if (img && img.boardIds.includes(boardId)) await tx.store.put({ ...img, boardIds: img.boardIds.filter((b) => b !== boardId) });
      }
      await tx.done;
    },
  };
}
