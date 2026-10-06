// End-to-end check of the moodoodle extension in Playwright's Chromium (headless).
// Usage: npm run build && npm run e2e
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import JSZip from 'jszip';

const extDir = process.argv[2] ?? '.output/chrome-mv3';
const shots = process.argv[3] ?? '.output/e2e';
fs.mkdirSync(shots, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const ctx = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1280, height: 860 },
  acceptDownloads: true,
  args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`],
});

// Make test PNGs by screenshotting colored doodles (no binary fixtures needed).
const maker = await ctx.newPage();
async function png(bg, ink, size) {
  await maker.setViewportSize({ width: size, height: size });
  await maker.setContent(`<body style="margin:0"><div style="width:${size}px;height:${size}px;background:${bg};display:flex;align-items:center;justify-content:center">
    <div style="width:${size / 3}px;height:${size / 3}px;border-radius:50%;border:${Math.max(2, size / 30)}px solid ${ink}"></div></div></body>`);
  return maker.screenshot();
}
const files = {
  '/peach.png': await png('#FFD8C2', '#B8441E', 400),
  '/mint.png': await png('#CDEFD9', '#2F7D55', 360),
  '/sky.png': await png('#CFE6FB', '#2E6BA8', 300),
  '/icon.png': await png('#E3D9FB', '#5B3FB0', 32),
  '/blocked.png': await png('#FFF0B8', '#8A6400', 300),
};
await maker.close();

const page = `<!doctype html><html><head><title>Spring sketchbook</title></head>
<body style="font-family:sans-serif;margin:40px">
<h1>My spring sketchbook</h1>
<img id="icon" src="/icon.png" width="32" height="32">
<div style="display:flex;gap:40px;flex-wrap:wrap;margin-top:20px">
<img id="peach" src="/peach.png" width="400" height="400">
<img id="mint" src="/mint.png" width="360" height="360">
<img id="lazy" src="/sky.png" srcset="/sky.png 1x" width="300" height="300">
<img id="blocked" src="/blocked.png" width="300" height="300">
</div></body></html>`;

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/' || url === '/page.html') return res.writeHead(200, { 'content-type': 'text/html' }).end(page);
  // Simulated hotlink protection: only serve when the page itself is the referrer.
  if (url === '/blocked.png' && !req.headers.referer) return res.writeHead(403).end('no');
  if (files[url]) return res.writeHead(200, { 'content-type': 'image/png' }).end(files[url]);
  res.writeHead(404).end();
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent('serviceworker');
const extId = new URL(sw.url()).host;
check('extension loads', Boolean(extId), extId);

const web = await ctx.newPage();
await web.goto(`${base}/page.html`);
await web.waitForTimeout(500);
check('content script injects host element', (await web.locator('moodoodle-ui').count()) === 1);

async function keepViaPill(id) {
  const box = await web.locator(`#${id}`).boundingBox();
  await web.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await web.waitForTimeout(150);
  // Keep is the rightmost button of the pill, placed 10px in from the image's top-right corner.
  await web.mouse.click(box.x + box.width - 45, box.y + 10 + 22);
  await web.waitForTimeout(900);
}

async function stored() {
  return sw.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('moodoodle');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const all = await new Promise((res) => {
      const r = db.transaction('images').objectStore('images').getAll();
      r.onsuccess = () => res(r.result);
    });
    db.close();
    return all.map(({ imageUrl, site, pageTitle, colorFamily, palette, width, height, tags }) =>
      ({ imageUrl, site, pageTitle, colorFamily, palette, width, height, tags }));
  });
}

// Hover pill visual
const pbox = await web.locator('#peach').boundingBox();
await web.mouse.move(pbox.x + 200, pbox.y + 200);
await web.waitForTimeout(200);
await web.screenshot({ path: path.join(shots, '1-hover-pill.png') });

await keepViaPill('peach');
await web.screenshot({ path: path.join(shots, '2-kept-toast.png') });
let s = await stored();
check('Keep saves one image', s.length === 1, JSON.stringify(s[0] ?? null));
check('saved metadata: site, title, size', s[0]?.site === '127.0.0.1' && s[0]?.pageTitle === 'Spring sketchbook' && s[0]?.width === 400);
check('palette/color family is orange for peach', s[0]?.colorFamily === 'orange', `${s[0]?.colorFamily} ${s[0]?.palette}`);

await keepViaPill('peach');
s = await stored();
check('second Keep of same image is deduped', s.length === 1, `count=${s.length}`);
await web.screenshot({ path: path.join(shots, '3-duplicate-toast.png') });

await keepViaPill('blocked');
s = await stored();
check('hotlink-blocked image is not saved', s.length === 1, `count=${s.length}`);
await web.screenshot({ path: path.join(shots, '4-blocked-toast.png') });

// Icon: hovering must not show the pill.
const ibox = await web.locator('#icon').boundingBox();
await web.mouse.move(ibox.x + 16, ibox.y + 16);
await web.waitForTimeout(400);
await web.screenshot({ path: path.join(shots, '5-icon-no-pill.png'), clip: { x: 0, y: 0, width: 600, height: 200 } });

await keepViaPill('mint');
s = await stored();
check('second image keeps', s.length === 2 && s.some((x) => x.colorFamily === 'green'), s.map((x) => x.colorFamily).join(','));

// Similar → Lens tab
const mbox = await web.locator('#mint').boundingBox();
await web.mouse.move(mbox.x + 180, mbox.y + 180);
await web.waitForTimeout(150);
const lensPage = ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null);
await web.mouse.click(mbox.x + mbox.width - 120, mbox.y + 32);
const lp = await lensPage;
// Record the first URL the tab navigated to (Google redirects uploadbyurl to /search afterwards).
const lensUrl = lp ? await lp.evaluate(() => performance.getEntriesByType('navigation')[0]?.name ?? location.href).catch(() => lp.url()) : '';
const firstReq = lp ? (await lp.waitForLoadState('domcontentloaded').catch(() => {}), lp.url()) : '';
check('Similar opens a Google Lens tab', /^https:\/\/(lens\.google\.com\/uploadbyurl\?url=|www\.google\.com\/search\?vsrid=)/.test(lensUrl || firstReq), (lensUrl || firstReq).slice(0, 90));
if (lp) await lp.close();

// Keep-all path (what the popup does): collect from the tab, then keep-many in the worker.
const gallery = await ctx.newPage();
await gallery.goto(`chrome-extension://${extId}/gallery.html`);
const keepAll = await gallery.evaluate(async (pageUrl) => {
  const [tab] = await chrome.tabs.query({ url: pageUrl });
  const urls = await chrome.tabs.sendMessage(tab.id, { type: 'collect-images' });
  const res = await chrome.runtime.sendMessage({ type: 'keep-many', imageUrls: urls, pageUrl: tab.url, pageTitle: tab.title });
  return { urls, res };
}, `${base}/page.html`);
check('collect-images skips the 32px icon', keepAll.urls.length === 4 && !keepAll.urls.some((u) => u.includes('icon')), keepAll.urls.map((u) => u.split('/').pop()).join(','));
check('keep-many keeps the new one, skips dup + blocked', keepAll.res.kept === 1 && keepAll.res.skipped === 3, JSON.stringify(keepAll.res));

// Gallery UI
await gallery.reload();
await gallery.waitForTimeout(600);
const tiles = gallery.locator('button.tile');
check('gallery shows 3 tiles', (await tiles.count()) === 3, `tiles=${await tiles.count()}`);
await gallery.screenshot({ path: path.join(shots, '6-gallery.png'), fullPage: true });

await gallery.getByRole('button', { name: /Green/ }).click();
check('color chip filters to green', (await tiles.count()) === 1);
await gallery.getByRole('button', { name: /All/ }).click();
await gallery.fill('#q', 'nothing-matches-this');
check('search with no match shows empty message', await gallery.getByText('No saves match that').isVisible());
await gallery.fill('#q', '');

await tiles.nth(0).click();
await gallery.fill('#tags', 'Cute, cat');
await gallery.press('#tags', 'Enter');
await gallery.waitForTimeout(300);
await gallery.fill('#q', 'cat');
check('tags save and are searchable', (await tiles.count()) === 1 && (await tiles.nth(0).innerText()).includes('cute, cat'));
await gallery.fill('#q', '');
await gallery.screenshot({ path: path.join(shots, '7-gallery-selected.png') });

await tiles.nth(1).click();
const dl = gallery.waitForEvent('download');
await gallery.getByRole('button', { name: 'Download .zip' }).click();
const download = await dl;
const zipPath = path.join(shots, 'export.zip');
await download.saveAs(zipPath);
const zip = await JSZip.loadAsync(fs.readFileSync(zipPath));
const names = Object.keys(zip.files).sort();
check('zip has 2 images + sources.txt', names.length === 3 && names.includes('sources.txt'), names.join(', '));

gallery.once('dialog', (d) => d.accept());
await gallery.getByRole('button', { name: 'Remove' }).click();
await gallery.waitForTimeout(500);
check('remove deletes selected tiles', (await tiles.count()) === 1, `tiles=${await tiles.count()}`);

// Narrow screen: no horizontal scroll
await gallery.setViewportSize({ width: 390, height: 800 });
const overflow = await gallery.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check('gallery has no horizontal scroll at 390px', overflow <= 0, `overflow=${overflow}`);
await gallery.screenshot({ path: path.join(shots, '8-gallery-phone.png') });

// Popup rendered as a page (active tab is the popup itself, so it reports the unreadable-page state)
const popup = await ctx.newPage();
await popup.setViewportSize({ width: 400, height: 560 });
await popup.goto(`chrome-extension://${extId}/popup.html`);
await popup.waitForTimeout(600);
check('popup shows recent thumbnails', (await popup.locator('.recent img').count()) === 1);
check('popup on non-web page explains it', await popup.getByText("Can't read this page").isVisible());
await popup.screenshot({ path: path.join(shots, '9-popup.png') });

await ctx.close();
server.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
