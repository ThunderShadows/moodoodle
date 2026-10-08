interface Menus {
  removeAll(): Promise<void>;
  create(props: { id: string; title: string; contexts: ['image'] }): unknown;
}

/** Recreates our right-click items; clearing first avoids duplicate-id errors after an update. */
export async function registerMenus(menus: Menus): Promise<void> {
  await menus.removeAll();
  menus.create({ id: 'keep', title: 'Keep image', contexts: ['image'] });
  menus.create({ id: 'lens', title: 'Find similar', contexts: ['image'] });
}
