import { browser } from 'wxt/browser';
import { openImageStore } from '@/lib/db';
import { keepImage, keepMany, type KeepDeps } from '@/lib/keep';
import { fetchImage, decodeInWorker } from '@/lib/decode';
import { lensUrl } from '@/lib/urls';
import { registerMenus } from '@/lib/menus';
import { resolveKeepingInto } from '@/lib/settings';
import type { Message, PageCredit } from '@/lib/types';

export default defineBackground(() => {
  const deps: KeepDeps = { store: openImageStore(), fetchImage, decode: decodeInWorker };

  async function openLens(imageUrl: string): Promise<boolean> {
    const url = lensUrl(imageUrl);
    if (url) await browser.tabs.create({ url });
    return Boolean(url);
  }

  async function handle(msg: Message): Promise<unknown> {
    switch (msg.type) {
      case 'keep':
        return keepImage(deps, { ...msg, board: await resolveKeepingInto(deps.store) });
      case 'keep-many':
        return keepMany(deps, { ...msg, board: await resolveKeepingInto(deps.store) });
      case 'lens':
        return openLens(msg.imageUrl);
      default:
        return undefined;
    }
  }

  browser.runtime.onInstalled.addListener(() => {
    registerMenus(browser.contextMenus);
  });

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!info.srcUrl) return;
    if (info.menuItemId === 'lens') {
      await openLens(info.srcUrl);
      return;
    }
    if (info.menuItemId !== 'keep') return;
    // Ask the page what it says about this image; keep without page credit if it can't answer.
    let pageCredit: PageCredit | undefined;
    if (tab?.id !== undefined) {
      const ask: Message = { type: 'credit-for', imageUrl: info.srcUrl };
      pageCredit = (await browser.tabs.sendMessage(tab.id, ask).catch(() => undefined)) as PageCredit | undefined;
    }
    const result = await keepImage(deps, {
      imageUrl: info.srcUrl,
      pageUrl: tab?.url ?? info.pageUrl ?? '',
      pageTitle: tab?.title ?? '',
      board: await resolveKeepingInto(deps.store),
      pageCredit,
    });
    if (tab?.id !== undefined) {
      const toast: Message = { type: 'toast', result };
      browser.tabs.sendMessage(tab.id, toast).catch(() => {});
    }
  });

  browser.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
    const msg = raw as Message;
    if (msg.type !== 'keep' && msg.type !== 'keep-many' && msg.type !== 'lens') return false;
    handle(msg).then(sendResponse, () => sendResponse({ status: 'error', reason: 'fetch-failed' }));
    return true;
  });
});
