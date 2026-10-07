import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { getKeepingInto, setKeepingInto, resolveKeepingInto } from './settings';
import { openImageStore } from './db';

describe('keeping-into setting', () => {
  beforeEach(() => fakeBrowser.reset());

  it('stores and clears the board id', async () => {
    expect(await getKeepingInto()).toBeUndefined();
    await setKeepingInto('b1');
    expect(await getKeepingInto()).toBe('b1');
    await setKeepingInto(undefined);
    expect(await getKeepingInto()).toBeUndefined();
  });

  it('resolves to the board, or clears itself when the board is gone', async () => {
    const store = openImageStore(`set-${crypto.randomUUID()}`);
    const board = await store.createBoard('Ocean', 'sky');
    await setKeepingInto(board.id);
    expect((await resolveKeepingInto(store))?.name).toBe('Ocean');
    await store.deleteBoard(board.id);
    expect(await resolveKeepingInto(store)).toBeUndefined();
    expect(await getKeepingInto()).toBeUndefined();
  });
});

describe('keeping-into when storage fails', () => {
  beforeEach(() => fakeBrowser.reset());

  it('falls back to no board instead of failing the keep', async () => {
    const store = openImageStore(`fail-${crypto.randomUUID()}`);
    const spy = vi.spyOn(fakeBrowser.storage.local, 'get').mockRejectedValue(new Error('storage unavailable'));
    expect(await resolveKeepingInto(store)).toBeUndefined();
    spy.mockRestore();
  });
});
