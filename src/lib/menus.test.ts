import { describe, it, expect } from 'vitest';
import { registerMenus } from './menus';

describe('registerMenus', () => {
  it('clears old menu items before creating ours, so updates do not hit duplicate ids', async () => {
    const calls: string[] = [];
    const menus = {
      removeAll: async () => { calls.push('removeAll'); },
      create: (p: { id: string }) => { calls.push(`create:${p.id}`); },
    };
    await registerMenus(menus);
    expect(calls).toEqual(['removeAll', 'create:keep', 'create:lens']);
  });
});
