import { browser } from 'wxt/browser';
import { openImageStore } from '@/lib/db';
import { keepImage, keepMany, type KeepDeps } from '@/lib/keep';
import { fetchImage, decodeInWorker } from '@/lib/decode';
import { lensUrl } from '@/lib/urls';
import { registerMenus } from '@/lib/menus';
import { resolveKeepingInto } from '@/lib/settings';
import { createQueue } from '@/lib/queue';
import { findSimilar } from '@/lib/findsimilar';
import type { KeepResult, Message, OffscreenMessage, PageCredit } from '@/lib/types';

export default defineBackground(() => {
  const deps: KeepDeps = { store: openImageStore(), fetchImage, decode: decodeInWorker };

  // ── On-device image model (runs in an offscreen document) ──
  let creating: Promise<void> | undefined;
  async function ensureOffscreen() {
    const open = await browser.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT' as never] });
    if (open.length) return;
    creating ??= browser.offscreen
      .createDocument({ url: 'offscreen.html', reasons: ['WORKERS' as never], justification: 'Runs the on-device image model for Find similar.' })
      .finally(() => { creating = undefined; });
    await creating;
  }

  async function askOffscreen<T>(msg: OffscreenMessage): Promise<T> {
    await ensureOffscreen();
    // The document's script may still be starting; retry briefly until it's listening.
    for (let attempt = 0; ; attempt++) {
      try {
        const res = (await browser.runtime.sendMessage(msg)) as ({ ok: boolean; error?: string } & T) | undefined;
        if (res?.ok) return res;
        throw new Error(res?.error ?? 'no answer from the image model');
      } catch (e) {
        if (attempt >= 20 || !String(e).includes('Receiving end does not exist')) throw e;
        await new Promise((r) => setTimeout(r, 150));
      }
    }
  }

  const embeds = createQueue();
  const embedImage = (id: string) => embeds.push(() => askOffscreen({ target: 'offscreen', type: 'embed-image', id }));
  const embedUrl = async (url: string) =>
    Float32Array.from((await askOffscreen<{ vec: number[] }>({ target: 'offscreen', type: 'embed-url', url })).vec);
  async function backfill() {
    for (const id of await deps.store.missingEmbeddingIds()) embedImage(id);
  }
  const afterKeep = (r: KeepResult) => { if (r.status === 'kept') embedImage(r.image.id); return r; };
  backfill().catch(() => {});

  async function openLens(imageUrl: string): Promise<boolean> {
    const url = lensUrl(imageUrl);
    if (url) await browser.tabs.create({ url });
    return Boolean(url);
  }

  async function handle(msg: Message): Promise<unknown> {
    switch (msg.type) {
      case 'keep':
        return afterKeep(await keepImage(deps, { ...msg, board: await resolveKeepingInto(deps.store) }));
      case 'keep-many': {
        const res = await keepMany(deps, { ...msg, board: await resolveKeepingInto(deps.store) });
        backfill().catch(() => {});
        return res;
      }
      case 'similar':
        return findSimilar({ store: deps.store, embedUrl }, msg.imageUrl);
      case 'lens':
        return openLens(msg.imageUrl);
      case 'open-gallery': {
        const path = msg.focus ? `/gallery.html?focus=${encodeURIComponent(msg.focus)}` : '/gallery.html';
        await browser.tabs.create({ url: browser.runtime.getURL(path as '/gallery.html') });
        return true;
      }
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
      // Show the orbit on the page; fall back to Google Lens where the page can't host it (e.g. chrome:// pages).
      const show: Message = { type: 'show-similar', imageUrl: info.srcUrl };
      const shown = tab?.id !== undefined && (await browser.tabs.sendMessage(tab.id, show).then(() => true, () => false));
      if (!shown) await openLens(info.srcUrl);
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
    afterKeep(result);
    if (tab?.id !== undefined) {
      const toast: Message = { type: 'toast', result };
      browser.tabs.sendMessage(tab.id, toast).catch(() => {});
    }
  });

  browser.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
    const msg = raw as Message;
    if (msg.type !== 'keep' && msg.type !== 'keep-many' && msg.type !== 'lens' && msg.type !== 'similar' && msg.type !== 'open-gallery') return false;
    handle(msg).then(sendResponse, () => sendResponse({ status: 'error', reason: 'fetch-failed' }));
    return true;
  });
});
