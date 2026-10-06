import { browser } from 'wxt/browser';
import { openImageStore } from '@/lib/db';
import { keepImage, type KeepDeps } from '@/lib/keep';
import { fetchBlob, decodeInWorker } from '@/lib/decode';
import { lensUrl } from '@/lib/urls';
import type { KeepManyResult, Message } from '@/lib/types';

export default defineBackground(() => {
  const deps: KeepDeps = { store: openImageStore(), fetchBlob, decode: decodeInWorker };

  async function openLens(imageUrl: string): Promise<boolean> {
    const url = lensUrl(imageUrl);
    if (url) await browser.tabs.create({ url });
    return Boolean(url);
  }

  async function handle(msg: Message): Promise<unknown> {
    switch (msg.type) {
      case 'keep':
        return keepImage(deps, msg);
      case 'keep-many': {
        const out: KeepManyResult = { kept: 0, skipped: 0 };
        for (const imageUrl of msg.imageUrls) {
          const r = await keepImage(deps, { imageUrl, pageUrl: msg.pageUrl, pageTitle: msg.pageTitle });
          if (r.status === 'kept') out.kept++;
          else out.skipped++;
        }
        return out;
      }
      case 'lens':
        return openLens(msg.imageUrl);
      default:
        return undefined;
    }
  }

  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({ id: 'keep', title: 'Keep image', contexts: ['image'] });
    browser.contextMenus.create({ id: 'lens', title: 'Find similar (Google Lens)', contexts: ['image'] });
  });

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!info.srcUrl) return;
    if (info.menuItemId === 'lens') {
      await openLens(info.srcUrl);
      return;
    }
    if (info.menuItemId !== 'keep') return;
    const result = await keepImage(deps, {
      imageUrl: info.srcUrl,
      pageUrl: tab?.url ?? info.pageUrl ?? '',
      pageTitle: tab?.title ?? '',
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
