import { browser } from 'wxt/browser';
import { isBigEnough, pickBestSrc, collectImageUrls } from '@/lib/pick';
import { toastText } from '@/lib/toast';
import { extractPageCredit } from '@/lib/pagecredit';
import { openOrbit } from '@/lib/orbit';
import { openCropper } from '@/lib/cropui';
import { toOrbitData, type SimilarResult } from '@/lib/findsimilar';
import { lensUrl } from '@/lib/urls';
import type { CollectResult, KeepResult, Message } from '@/lib/types';
import { css } from './style';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    const host = document.createElement('moodoodle-ui');
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `<style>${css}</style>
      <div class="bar" hidden>
        <button class="crop" type="button">Crop</button>
        <button class="keep" type="button">Keep</button>
      </div>
      <div class="toast" role="status" aria-live="polite" hidden></div>`;
    document.documentElement.append(host);

    const bar = root.querySelector<HTMLDivElement>('.bar')!;
    const cropBtn = root.querySelector<HTMLButtonElement>('.crop')!;
    const keepBtn = root.querySelector<HTMLButtonElement>('.keep')!;
    const toast = root.querySelector<HTMLDivElement>('.toast')!;
    let current: HTMLImageElement | null = null;
    let hideTimer = 0;
    let toastTimer = 0;

    function place(img: HTMLImageElement) {
      const r = img.getBoundingClientRect();
      bar.style.top = `${Math.max(8, r.top + 10)}px`;
      bar.style.left = `${Math.max(8, Math.min(window.innerWidth - bar.offsetWidth - 8, r.right - bar.offsetWidth - 10))}px`;
    }
    function scheduleHide() {
      clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => { bar.hidden = true; current = null; }, 250);
    }
    function showToast(text: string) {
      toast.textContent = text;
      toast.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => { toast.hidden = true; }, 3000);
    }

    document.addEventListener('mouseover', (e) => {
      const t = e.target;
      if (t instanceof HTMLImageElement && isBigEnough(t) && pickBestSrc(t)) {
        clearTimeout(hideTimer);
        current = t;
        bar.hidden = false;
        place(t);
      }
    }, { passive: true });
    document.addEventListener('mouseout', (e) => { if (e.target === current) scheduleHide(); }, { passive: true });
    bar.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    bar.addEventListener('mouseleave', scheduleHide);
    window.addEventListener('scroll', () => { if (current && !bar.hidden) place(current); }, { passive: true, capture: true });

    keepBtn.addEventListener('click', async () => {
      const src = current && pickBestSrc(current);
      if (!src) return;
      keepBtn.disabled = true;
      try {
        const msg: Message = {
          type: 'keep', imageUrl: src, pageUrl: location.href, pageTitle: document.title,
          pageCredit: extractPageCredit(document, src),
        };
        const result = (await browser.runtime.sendMessage(msg)) as KeepResult;
        showToast(toastText(result));
      } catch {
        showToast('Something went wrong. Try again?');
      } finally {
        keepBtn.disabled = false;
      }
    });

    let orbitOpen = false;
    /** Opens the orbit overlay for an image on this page and fills it in once matching finishes. */
    async function showSimilar(src: string) {
      if (orbitOpen) return;
      orbitOpen = true;
      bar.hidden = true;
      const title = document.title || location.hostname;
      const orbit = openOrbit(root, { title, centerSrc: src, results: [], learning: false, loading: true, lensUrl: lensUrl(src) }, {
        onClose: () => { orbitOpen = false; },
        onShowInGallery: (id) => {
          const msg: Message = { type: 'open-gallery', focus: id };
          browser.runtime.sendMessage(msg);
        },
      });
      try {
        const msg: Message = { type: 'similar', imageUrl: src };
        const res = (await browser.runtime.sendMessage(msg)) as SimilarResult;
        if (orbitOpen) orbit.update(toOrbitData(res, { title, centerSrc: src }));
      } catch {
        if (orbitOpen) orbit.update({ title, centerSrc: src, results: [], learning: false, failed: true, lensUrl: lensUrl(src) });
      }
    }

    // Crop: select part of the image here; edit and keep it in the kudoodle side panel.
    let cropper: ReturnType<typeof openCropper> | undefined;
    cropBtn.addEventListener('click', () => {
      const img = current;
      const src = img && pickBestSrc(img);
      if (!img || !src) return;
      bar.hidden = true;
      cropper?.close();
      const start: Message = {
        type: 'crop-start', imageUrl: src, pageUrl: location.href, pageTitle: document.title,
        pageCredit: extractPageCredit(document, src),
      };
      const opened = browser.runtime.sendMessage(start) as Promise<{ panel?: boolean } | undefined>;
      cropper = openCropper(root, img.getBoundingClientRect(), {
        onSelect: (crop) => {
          const msg: Message = { type: 'crop-selected', crop };
          browser.runtime.sendMessage(msg);
        },
        onCancel: () => {
          cropper = undefined;
          const msg: Message = { type: 'crop-cancel' };
          browser.runtime.sendMessage(msg);
        },
      });
      // Some Chrome versions won't open the panel from a page click; point people to the popup instead.
      const thisCropper = cropper;
      opened.then((r) => { if (!r?.panel && cropper === thisCropper) thisCropper.setHint('Click the kudoodle icon, then Open crop panel'); }, () => {});
    });

    browser.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
      const msg = raw as Message;
      if (msg.type === 'toast') showToast(toastText(msg.result));
      if (msg.type === 'show-similar') showSimilar(msg.imageUrl);
      if (msg.type === 'crop-done') { cropper?.close(); cropper = undefined; }
      if (msg.type === 'credit-for') sendResponse(extractPageCredit(document, msg.imageUrl));
      if (msg.type === 'collect-images') {
        const urls = collectImageUrls(document);
        const credits = Object.fromEntries(urls.map((u) => [u, extractPageCredit(document, u)]));
        const result: CollectResult = { urls, credits, noAI: extractPageCredit(document, location.href).noAI };
        sendResponse(result);
      }
      return false;
    });
  },
});
