import { browser } from 'wxt/browser';
import type { ImageStore } from './db';
import type { Board } from './types';

const KEEPING_INTO = 'keepingIntoBoardId';

export async function getKeepingInto(): Promise<string | undefined> {
  const got = await browser.storage.local.get(KEEPING_INTO);
  const id = got[KEEPING_INTO];
  return typeof id === 'string' ? id : undefined;
}

export async function setKeepingInto(id: string | undefined): Promise<void> {
  if (id) await browser.storage.local.set({ [KEEPING_INTO]: id });
  else await browser.storage.local.remove(KEEPING_INTO);
}

/**
 * The board new keeps go into; a stale id (board deleted) is cleared and treated as none.
 * Never throws: a broken setting must not stop an image from being kept.
 */
export async function resolveKeepingInto(store: Pick<ImageStore, 'getBoard'>): Promise<Board | undefined> {
  try {
    const id = await getKeepingInto();
    if (!id) return undefined;
    const board = await store.getBoard(id);
    if (!board) await setKeepingInto(undefined);
    return board;
  } catch {
    return undefined;
  }
}
