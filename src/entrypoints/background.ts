import { browser } from 'wxt/browser';
import { openImageStore } from '@/lib/db';
import { keepImage, keepMany, type KeepDeps } from '@/lib/keep';
import { fetchImage, decodeInWorker, cropInWorker } from '@/lib/decode';
import { blobToDataUrl } from '@/lib/findsimilar';
import { lensUrl } from '@/lib/urls';
import { registerMenus } from '@/lib/menus';
import { resolveKeepingInto } from '@/lib/settings';
import { createQueue } from '@/lib/queue';
import { findSimilar } from '@/lib/findsimilar';
import type { KeepResult, Message, OffscreenMessage, PageCredit, PendingCrop } from '@/lib/types';

export default defineBackground(() => {
  const deps: KeepDeps = { store: openImageStore(), fetchImage, decode: decodeInWorker, crop: cropInWorker };

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
  const afterKeep = (r: KeepResult) => { if (r.status === 'kept' && !r.image.credit.noAI) embedImage(r.image.id); return r; };
  backfill().catch(() => {});

  async function openLens(imageUrl: string): Promise<boolean> {
    const url = lensUrl(imageUrl);
    if (url) await browser.tabs.create({ url });
    return Boolean(url);
  }

  // ── Crop & edit (selection on the page, editing in the side panel) ──
  const PENDING = 'pendingCrop';
  const getPending = async () => (await browser.storage.session.get(PENDING))[PENDING] as PendingCrop | undefined;
  const setPending = (p: PendingCrop | undefined) =>
    p ? browser.storage.session.set({ [PENDING]: p }) : browser.storage.session.remove(PENDING);

  async function handleCrop(msg: Message, tabId: number | undefined): Promise<unknown> {
    switch (msg.type) {
      case 'crop-start': {
        if (tabId === undefined) return false;
        await setPending({ tabId, imageUrl: msg.imageUrl, pageUrl: msg.pageUrl, pageTitle: msg.pageTitle, pageCredit: msg.pageCredit });
        // Opening needs the user's click; the Crop click that sent this message provides it.
        await browser.sidePanel.open({ tabId }).catch(() => {});
        return true;
      }
      case 'crop-selected': {
        const p = await getPending();
        if (p) await setPending({ ...p, crop: msg.crop });
        return true;
      }
      case 'crop-cancel':
        await setPending(undefined);
        return true;
      case 'crop-preview': {
        const p = await getPending();
        if (!p?.crop) return null;
        const { blob } = await fetchImage(p.imageUrl);
        return blobToDataUrl(await cropInWorker(blob, p.crop, undefined, 720));
      }
      case 'crop-keep': {
        const p = await getPending();
        if (!p) return { status: 'error', reason: 'unsupported-url' };
        const board = msg.boardId ? await deps.store.getBoard(msg.boardId) : undefined;
        const result = afterKeep(await keepImage(deps, {
          imageUrl: p.imageUrl, pageUrl: p.pageUrl, pageTitle: p.pageTitle, pageCredit: p.pageCredit,
          crop: msg.whole ? undefined : p.crop, edits: msg.whole ? undefined : msg.edits, board,
        }));
        const toast: Message = { type: 'toast', result };
        const done: Message = { type: 'crop-done' };
        browser.tabs.sendMessage(p.tabId, toast).catch(() => {});
        browser.tabs.sendMessage(p.tabId, done).catch(() => {});
        if (result.status !== 'error') await setPending(undefined);
        return result;
      }
      default:
        return undefined;
    }
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
    if (msg.type !== 'keep' && msg.type !== 'keep-many' && msg.type !== 'lens' && msg.type !== 'similar' && msg.type !== 'open-gallery' && !msg.type.startsWith('crop-')) return false;
    const work = msg.type.startsWith('crop-') ? handleCrop(msg, _sender.tab?.id) : handle(msg);
    work.then(sendResponse, () => sendResponse({ status: 'error', reason: 'fetch-failed' }));
    return true;
  });
});
