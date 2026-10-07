import { browser } from 'wxt/browser';
import { isBigEnough, pickBestSrc, collectImageUrls } from '@/lib/pick';
import { toastText } from '@/lib/toast';
import { extractPageCredit } from '@/lib/pagecredit';
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
        <button class="sim" type="button">Similar</button>
        <button class="keep" type="button">Keep</button>
      </div>
      <div class="toast" role="status" aria-live="polite" hidden></div>`;
    document.documentElement.append(host);

    const bar = root.querySelector<HTMLDivElement>('.bar')!;
    const simBtn = root.querySelector<HTMLButtonElement>('.sim')!;
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

    simBtn.addEventListener('click', () => {
      const src = current && pickBestSrc(current);
      if (!src) return;
      if (!lensUrl(src)) {
        showToast('Find similar only works for images with a web address');
        return;
      }
      const msg: Message = { type: 'lens', imageUrl: src };
      browser.runtime.sendMessage(msg);
    });

    browser.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
      const msg = raw as Message;
      if (msg.type === 'toast') showToast(toastText(msg.result));
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
