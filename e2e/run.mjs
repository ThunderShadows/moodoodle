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

/** Inserts an XMP APP1 segment right after a JPEG's SOI marker. */
function withXmp(jpeg, xmp) {
  const header = Buffer.from('http://ns.adobe.com/xap/1.0/\0', 'latin1');
  const body = Buffer.concat([header, Buffer.from(xmp, 'utf8')]);
  const len = Buffer.alloc(2);
  len.writeUInt16BE(body.length + 2);
  return Buffer.concat([jpeg.subarray(0, 2), Buffer.from([0xff, 0xe1]), len, body, jpeg.subarray(2)]);
}
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
  '/big.png': await png('#F7B2D9', '#8E3A6B', 1200),
  '/heart.png': await png('#F7D3E6', '#B03A78', 300),
};
await maker.setContent('<body style="margin:0"><div style="width:300px;height:300px;background:#E3D9FB"></div></body>');
await maker.setViewportSize({ width: 300, height: 300 });
files['/xmp.jpg'] = withXmp(await maker.screenshot({ type: 'jpeg' }),
  '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF><rdf:Description><dc:creator><rdf:Seq><rdf:li>Lena O.</rdf:li></rdf:Seq></dc:creator>'
  + '<cc:license rdf:resource="https://creativecommons.org/licenses/by-nc/4.0/"/></rdf:Description></rdf:RDF></x:xmpmeta>');
files['/credited.png'] = files['/mint.png'];
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
  if (url === '/credited') return res.writeHead(200, { 'content-type': 'text/html' }).end(`<!doctype html><html><head><title>Mint study</title>
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'ImageObject', contentUrl: `http://${req.headers.host}/credited.png`, name: 'Mint study', creator: { '@type': 'Person', name: 'Jane Doe', url: 'https://example.com/jane' }, license: 'https://creativecommons.org/licenses/by/4.0/' })}</script>
</head><body style="margin:40px"><img id="credited" src="/credited.png" width="360" height="360"></body></html>`);
  if (url === '/noai') return res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><html><head><title>No AI</title><meta name="robots" content="noai, noimageai"></head><body style="margin:40px"><img src="/sun-noai.png" width="300" height="300"><img src="/heart2.png" width="300" height="300"></body></html>');
  if (url === '/sun-noai.png' || url === '/heart2.png') return res.writeHead(200, { 'content-type': 'image/png' }).end(files['/peach.png']);
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

// Find similar on the page (what the right-click menu does): the orbit opens in place, no new tab
const lensTab = ctx.waitForEvent('page', { timeout: 2500 }).catch(() => null);
const pageTabIdForSimilar = await sw.evaluate(async (u) => (await chrome.tabs.query({ url: u }))[0].id, `${base}/page.html`);
await sw.evaluate(([id, url]) => chrome.tabs.sendMessage(id, { type: 'show-similar', imageUrl: url }), [pageTabIdForSimilar, `${base}/mint.png`]);
const opened = await lensTab;
check('Find similar opens the orbit on the page instead of a new tab', opened === null, opened ? opened.url() : 'no new tab');
await web.waitForTimeout(2500);
await web.screenshot({ path: path.join(shots, '12-orbit-page.png') });
await web.keyboard.press('Escape');

// Keep-all path (what the popup does): collect from the tab, then keep-many in the worker.
const gallery = await ctx.newPage();
await gallery.goto(`chrome-extension://${extId}/gallery.html`);
const keepAll = await gallery.evaluate(async (pageUrl) => {
  const [tab] = await chrome.tabs.query({ url: pageUrl });
  const { urls } = await chrome.tabs.sendMessage(tab.id, { type: 'collect-images' });
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
await gallery.getByRole('button', { name: 'All', exact: true }).click();
await gallery.fill('#q', 'nothing-matches-this');
check('search with no match shows empty message', await gallery.getByText('No saves match that').isVisible());
await gallery.fill('#q', '');

await tiles.nth(0).click();
await gallery.fill('#d-tags', 'Cute, cat');
await gallery.getByRole('button', { name: 'Save', exact: true }).click();
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
check('zip has 2 images + CREDITS.md', names.length === 3 && names.includes('CREDITS.md'), names.join(', '));

gallery.once('dialog', (d) => d.accept());
await gallery.getByRole('button', { name: 'Delete', exact: true }).click();
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

// Large images get a small WebP thumbnail for the grid; the full image is kept for export.
const bigKeep = await popup.evaluate((url) => chrome.runtime.sendMessage({ type: 'keep', imageUrl: url, pageUrl: url, pageTitle: 'Big' }), `${base}/big.png`);
const thumbInfo = await sw.evaluate(async (id) => {
  const db = await new Promise((res) => { const r = indexedDB.open('moodoodle'); r.onsuccess = () => res(r.result); });
  const get = (store) => new Promise((res) => { const r = db.transaction(store).objectStore(store).get(id); r.onsuccess = () => res(r.result); });
  const [thumb, full] = [await get('thumbs'), await get('blobs')];
  db.close();
  return thumb && full ? { type: thumb.type, thumb: thumb.bytes.byteLength, full: full.bytes.byteLength } : null;
}, bigKeep.image?.id);
check('large image gets a smaller WebP thumbnail', thumbInfo?.type === 'image/webp' && thumbInfo.thumb < thumbInfo.full, JSON.stringify(thumbInfo));

// ── Boards ───────────────────────────────────────────────
await gallery.setViewportSize({ width: 1280, height: 860 });
await gallery.reload();
await gallery.waitForTimeout(500);
await gallery.getByRole('button', { name: '+ New board' }).click();
await gallery.fill('#newboard', 'Ocean study');
await gallery.getByRole('button', { name: 'Add', exact: true }).click();
await gallery.waitForTimeout(300);
check('board created from the sidebar', await gallery.getByRole('button', { name: /^Ocean study/ }).isVisible());

await gallery.getByRole('button', { name: '+ New board' }).click();
await gallery.fill('#newboard', '  ocean   STUDY ');
await gallery.getByRole('button', { name: 'Add', exact: true }).click();
await gallery.waitForTimeout(200);
check('duplicate board name is refused', await gallery.getByText('You already have a board with that name').isVisible());
await gallery.getByRole('button', { name: 'Cancel' }).click();

await popup.reload();
await popup.waitForTimeout(500);
await popup.selectOption('.keepinto select', { label: 'Ocean study' });
await popup.waitForTimeout(200);
const keptInto = await popup.evaluate((u) => chrome.runtime.sendMessage({ type: 'keep', imageUrl: u, pageUrl: u, pageTitle: 'Heart' }), `${base}/heart.png`);
check('new keep lands in the keeping-into board', keptInto.status === 'kept' && keptInto.boardName === 'Ocean study', JSON.stringify({ s: keptInto.status, b: keptInto.boardName }));
const dupInto = await popup.evaluate((u) => chrome.runtime.sendMessage({ type: 'keep', imageUrl: u, pageUrl: u, pageTitle: 'Big' }), `${base}/big.png`);
check('already-kept image is added to the board', dupInto.status === 'duplicate' && dupInto.addedToBoard === true, JSON.stringify({ s: dupInto.status, a: dupInto.addedToBoard }));

await gallery.reload();
await gallery.waitForTimeout(500);
await gallery.getByRole('button', { name: /^Ocean study/ }).click();
await gallery.waitForTimeout(200);
check('board view shows its 2 images', (await tiles.count()) === 2, `tiles=${await tiles.count()}`);
await tiles.nth(0).click();
await gallery.getByRole('button', { name: 'Remove from board' }).click();
await gallery.waitForTimeout(300);
check('remove from board leaves 1 in the board', (await tiles.count()) === 1, `tiles=${await tiles.count()}`);
await gallery.getByRole('button', { name: /^All \d+$/ }).click();
await gallery.waitForTimeout(200);
const allAfterRemove = await tiles.count();

await gallery.getByRole('button', { name: /^Ocean study/ }).click();
await gallery.getByRole('button', { name: 'Board options for Ocean study' }).click();
const bdl = gallery.waitForEvent('download');
await gallery.getByRole('button', { name: 'Download board' }).click();
const boardZipPath = path.join(shots, 'board.zip');
await (await bdl).saveAs(boardZipPath);
const boardZip = await JSZip.loadAsync(fs.readFileSync(boardZipPath));
check('board zip has the board image + CREDITS.md', Object.keys(boardZip.files).length === 2, Object.keys(boardZip.files).join(', '));
await gallery.screenshot({ path: path.join(shots, '10-board.png') });

await gallery.getByRole('button', { name: 'Board options for Ocean study' }).click();
gallery.once('dialog', (d) => d.accept());
await gallery.getByRole('button', { name: 'Delete board' }).click();
await gallery.waitForTimeout(400);
check('deleting a board keeps its images', (await gallery.getByRole('button', { name: /^Ocean study/ }).count()) === 0 && (await tiles.count()) === allAfterRemove, `tiles=${await tiles.count()} expected=${allAfterRemove}`);
const afterDelete = await popup.evaluate((u) => chrome.runtime.sendMessage({ type: 'keep', imageUrl: u, pageUrl: u, pageTitle: 'Sky' }), `${base}/sky.png?v=2`);
check('keeping-into clears when its board is deleted', afterDelete.status === 'kept' && !afterDelete.boardName, JSON.stringify({ s: afterDelete.status, b: afterDelete.boardName }));

// ── Credits ──────────────────────────────────────────────
await web.goto(`${base}/credited`);
await web.waitForTimeout(400);
await keepViaPill('credited');
const creditedRec = (await stored()).find((x) => x.imageUrl.endsWith('/credited.png'));
check('page JSON-LD credit is recorded on keep', !!creditedRec, JSON.stringify(creditedRec ?? null));
const xmpKeep = await popup.evaluate((u) => chrome.runtime.sendMessage({ type: 'keep', imageUrl: u, pageUrl: u, pageTitle: 'Lilac' }), `${base}/xmp.jpg`);
check('file XMP credit is recorded on keep', xmpKeep.status === 'kept' && xmpKeep.image.credit.creator === 'Lena O.' && xmpKeep.image.credit.license.code === 'by-nc', JSON.stringify(xmpKeep.image?.credit ?? null));

await gallery.reload();
await gallery.waitForTimeout(500);
const janeTile = tiles.filter({ hasText: 'by Jane Doe' });
check('tile shows creator and Free-to-reuse badge', (await janeTile.count()) === 1 && (await janeTile.first().innerText()).includes('Free to reuse'));
check('XMP tile shows Reuse-with-conditions badge', (await tiles.filter({ hasText: 'by Lena O.' }).first().innerText()).includes('Reuse with conditions'));

await janeTile.first().click();
await gallery.fill('#d-creator', 'Jane D. Doe');
await gallery.getByRole('button', { name: 'Save', exact: true }).click();
await gallery.waitForTimeout(300);
await gallery.reload();
await gallery.waitForTimeout(500);
check('creator edit persists after reload', (await tiles.filter({ hasText: 'by Jane D. Doe' }).count()) === 1);

await tiles.filter({ hasText: 'by Jane D. Doe' }).first().click();
const cdl = gallery.waitForEvent('download');
await gallery.getByRole('button', { name: 'Download .zip' }).click();
const creditsZipPath = path.join(shots, 'credits.zip');
await (await cdl).saveAs(creditsZipPath);
const creditsMd = await (await JSZip.loadAsync(fs.readFileSync(creditsZipPath))).file('CREDITS.md').async('string');
check('CREDITS.md has the credit line', creditsMd.includes('**Credit line:** “Mint study” by Jane D. Doe, CC BY 4.0'), creditsMd.split('\n').find((l) => l.includes('Credit')) ?? '');
await gallery.screenshot({ path: path.join(shots, '11-credits.png') });

await web.goto(`${base}/noai`);
await web.waitForTimeout(400);
const noaiTry = await gallery.evaluate(async (u) => {
  const [tab] = await chrome.tabs.query({ url: u });
  const res = await chrome.tabs.sendMessage(tab.id, { type: 'collect-images' });
  const unflagged = await chrome.runtime.sendMessage({ type: 'keep-many', imageUrls: res.urls, pageUrl: tab.url, pageTitle: tab.title, pageNoAI: res.noAI });
  return { noAI: res.noAI, unflagged };
}, `${base}/noai`);
check('NoAI page is detected and bulk keep is refused by the worker', noaiTry.noAI === true && noaiTry.unflagged.blocked === true && noaiTry.unflagged.kept === 0, JSON.stringify(noaiTry));

// ── Find similar (on-device embeddings) ──────────────────
const embeddedAll = await (async () => {
  for (let i = 0; i < 120; i++) {
    const counts = await sw.evaluate(async () => {
      const db = await new Promise((res) => { const r = indexedDB.open('moodoodle'); r.onsuccess = () => res(r.result); });
      const count = (store) => new Promise((res) => { const r = db.transaction(store).objectStore(store).count(); r.onsuccess = () => res(r.result); });
      const out = { images: await count('images'), embeddings: await count('embeddings') };
      db.close();
      return out;
    });
    if (counts.images > 0 && counts.embeddings === counts.images) return counts;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
})();
check('every kept image gets an on-device embedding', !!embeddedAll, JSON.stringify(embeddedAll));
const sim = await popup.evaluate((u) => chrome.runtime.sendMessage({ type: 'similar', imageUrl: u }), `${base}/credited.png`);
check('similar returns up to 6 of your saves, never the image itself',
  !!sim && Array.isArray(sim.results) && sim.results.length > 0 && sim.results.length <= 6 && sim.results.every((r) => !r.image.imageUrl.endsWith('/credited.png')),
  JSON.stringify({ n: sim?.results?.length, learning: sim?.learning, top: sim?.results?.[0]?.image?.imageUrl?.split('/').pop(), score: sim?.results?.[0]?.score }));
const simNew = await popup.evaluate((u) => chrome.runtime.sendMessage({ type: 'similar', imageUrl: u }), `${base}/icon.png`);
check('similar works for an image you have not kept', !!simNew && Array.isArray(simNew.results) && !simNew.failed, JSON.stringify({ n: simNew?.results?.length, failed: simNew?.failed }));

// Orbit overlay in the gallery (same component, inspectable here)
await gallery.reload();
await gallery.waitForTimeout(600);
await tiles.first().click();
await gallery.getByRole('button', { name: 'Find similar' }).click();
await gallery.waitForSelector('.orbit .orb', { timeout: 30000 }).catch(() => null);
const orbCount = await gallery.locator('.orbit .orb').count();
check('gallery Find similar shows the orbit with orbs', orbCount > 0 && orbCount <= 6, `orbs=${orbCount}`);
await gallery.screenshot({ path: path.join(shots, '13-orbit-gallery.png') });
await gallery.locator('.orbit .orb').first().click();
check('clicking an orb shows its card', await gallery.locator('.orbit .card').isVisible());
await gallery.getByRole('button', { name: 'Show in gallery' }).click();
await gallery.waitForTimeout(400);
check('Show in gallery closes the orbit and selects that image', (await gallery.locator('.orbit').count()) === 0 && (await gallery.locator('button.tile.on').count()) === 1);
await gallery.getByRole('button', { name: 'Find similar' }).click();
await gallery.waitForSelector('.orbit', { timeout: 10000 });
await gallery.keyboard.press('Escape');
check('Escape closes the orbit', (await gallery.locator('.orbit').count()) === 0);

// ── Crop & edit (select on the page, keep from the side panel) ──
await web.goto(`${base}/page.html`);
await web.waitForTimeout(500);
const cbox = await web.locator('#peach').boundingBox();
await web.mouse.move(cbox.x + cbox.width / 2, cbox.y + cbox.height / 2);
await web.waitForTimeout(150);
await web.mouse.click(cbox.x + cbox.width - 120, cbox.y + 32); // Crop is left of Keep on the pill
await web.waitForTimeout(300);
await web.mouse.move(cbox.x + 20, cbox.y + 20);
await web.mouse.down();
await web.mouse.move(cbox.x + 220, cbox.y + 120, { steps: 5 });
await web.mouse.up();
await web.waitForTimeout(400);
await web.screenshot({ path: path.join(shots, '14-crop-select.png') });
const panel = await ctx.newPage();
await panel.setViewportSize({ width: 400, height: 860 });
await panel.goto(`chrome-extension://${extId}/sidepanel.html`);
await panel.waitForSelector('.preview img', { timeout: 15000 }).catch(() => null);
check('side panel shows the selected crop', (await panel.locator('.preview img').count()) === 1 && (await panel.getByText('SELECTED').isVisible()));
await panel.getByRole('button', { name: 'Rotate right' }).click();
await panel.getByRole('button', { name: /B&W/ }).click();
await panel.screenshot({ path: path.join(shots, '15-side-panel.png') });
await panel.getByRole('button', { name: /Keep crop/ }).click();
await panel.waitForTimeout(1200);
check('Keep crop confirms in the panel', /Kept/.test(await panel.locator('.status').innerText().catch(() => '')));
const cropRec = await sw.evaluate(async () => {
  const db = await new Promise((res) => { const r = indexedDB.open('moodoodle'); r.onsuccess = () => res(r.result); });
  const all = await new Promise((res) => { const r = db.transaction('images').objectStore('images').getAll(); r.onsuccess = () => res(r.result); });
  db.close();
  const c = all.find((i) => i.imageUrl.includes('#moodoodle-crop='));
  return c ? { url: c.imageUrl.split('/').pop(), w: c.width, h: c.height, edits: c.edits, crop: c.crop } : null;
});
check('crop is saved as its own image, rotated (taller than wide), with its edits', !!cropRec && cropRec.h > cropRec.w && cropRec.edits?.rotate === 90 && cropRec.edits?.grayscale === true, JSON.stringify(cropRec));

await ctx.close();
server.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
