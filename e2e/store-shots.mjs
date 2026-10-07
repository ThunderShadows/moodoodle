// Generates Chrome Web Store screenshots (1280×800) from the real built extension.
// Usage: npm run build && npm run shots
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const extDir = path.resolve(process.argv[2] ?? '.output/chrome-mv3');
const outDir = path.resolve(process.argv[3] ?? 'store-assets');
fs.mkdirSync(outDir, { recursive: true });

const font = (pkg, file) =>
  fs.readFileSync(path.resolve(`node_modules/@fontsource/${pkg}/files/${file}`)).toString('base64');
const fonts = {
  display: font('bricolage-grotesque', 'bricolage-grotesque-latin-800-normal.woff2'),
  body: font('figtree', 'figtree-latin-600-normal.woff2'),
  hand: font('caveat', 'caveat-latin-600-normal.woff2'),
};

// Demo doodles: [file, background, ink, svg body]
const doodles = [
  ['sun', '#FFF0B8', '#C98A00', '<circle cx="50" cy="50" r="17"/><path d="M50 12v12M50 76v12M12 50h12M76 50h12M23 23l8 8M69 69l8 8M77 23l-8 8M31 69l-8 8"/>'],
  ['flower', '#FFD8C2', '#B8441E', '<circle cx="50" cy="28" r="14"/><circle cx="72" cy="46" r="14"/><circle cx="63" cy="72" r="14"/><circle cx="37" cy="72" r="14"/><circle cx="28" cy="46" r="14"/><circle cx="50" cy="52" r="6"/>'],
  ['cat', '#E3D9FB', '#5B3FB0', '<path d="M20 55c0-22 14-36 30-36s30 14 30 36-14 28-30 28-30-6-30-28z"/><path d="M30 24l-6-12 14 6M70 24l6-12-14 6"/><circle cx="40" cy="50" r="2"/><circle cx="60" cy="50" r="2"/><path d="M44 63c4 4 8 4 12 0"/>'],
  ['wave', '#CFE6FB', '#2E6BA8', '<path d="M6 55c10-30 20-30 26 0s18 30 26 0 18-30 26 0"/><path d="M14 30l6-6M84 74l8 4"/>'],
  ['leaf', '#CDEFD9', '#2F7D55', '<path d="M25 78C25 40 50 20 80 20c0 32-22 58-55 58z"/><path d="M25 78L62 38"/>'],
  ['heart', '#F7D3E6', '#B03A78', '<path d="M50 80S18 60 18 38a16 16 0 0 1 32-6 16 16 0 0 1 32 6c0 22-32 42-32 42z"/>'],
  ['cloud', '#E9EEF5', '#5B6B82', '<path d="M30 70h42a14 14 0 0 0 0-28 20 20 0 0 0-38-4 14 14 0 0 0-4 32z"/>'],
  ['star', '#FFE7C7', '#C26A12', '<path d="M50 14l10 24 26 2-20 17 7 25-23-14-23 14 7-25-20-17 26-2z"/>'],
];

const ctx = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  args: [
    `--disable-extensions-except=${extDir}`,
    `--load-extension=${extDir}`,
    // A reserved demo domain, so screenshots show a readable site name instead of 127.0.0.1.
    '--host-resolver-rules=MAP sundaydoodles.example 127.0.0.1',
  ],
});

const maker = await ctx.newPage();
const files = {};
for (const [name, bg, ink, body] of doodles) {
  await maker.setViewportSize({ width: 600, height: 600 });
  await maker.setContent(`<body style="margin:0"><div style="width:600px;height:600px;background:${bg};display:flex;align-items:center;justify-content:center">
    <svg width="380" height="380" viewBox="0 0 100 100" fill="none" stroke="${ink}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">${body}</svg></div></body>`);
  files[`/${name}.png`] = await maker.screenshot();
}
await maker.close();

const page = `<!doctype html><html><head><title>Little doodles for a slow Sunday</title>
<style>body{margin:0;font-family:Georgia,serif;background:#fff;color:#222}
main{max-width:1100px;margin:0 auto;padding:48px 40px}h1{font-size:40px;margin:0 0 8px}p{color:#666;font-size:18px;margin:0 0 28px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:24px}img{width:100%;border-radius:12px;display:block}</style></head>
<body><main><h1>Little doodles for a slow Sunday</h1><p>A sketchbook of tiny things that made me smile this week.</p>
<div class="grid">${doodles.map(([n]) => `<img id="${n}" src="/${n}.png" alt="${n}">`).join('')}</div></main></body></html>`;

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/' || url === '/sketchbook') return res.writeHead(200, { 'content-type': 'text/html' }).end(page);
  if (files[url]) return res.writeHead(200, { 'content-type': 'image/png' }).end(files[url]);
  res.writeHead(404).end();
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://sundaydoodles.example:${server.address().port}`;

let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent('serviceworker');
const extId = new URL(sw.url()).host;

// 1) Hover button + toast on a page
const web = await ctx.newPage();
await web.setViewportSize({ width: 1180, height: 700 });
await web.goto(`${base}/sketchbook`);
await web.waitForTimeout(400);
const box = await web.locator('#flower').boundingBox();
await web.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await web.waitForTimeout(150);
await web.mouse.click(box.x + box.width - 45, box.y + 32);
await web.waitForTimeout(700);
await web.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await web.waitForTimeout(200);
const shotHover = await web.screenshot();

// Fill the collection: keep everything on the page, then add tags
const gallery = await ctx.newPage();
await gallery.setViewportSize({ width: 1180, height: 700 });
await gallery.goto(`chrome-extension://${extId}/gallery.html`);
const webTabId = await gallery.evaluate(async (u) => {
  const [tab] = await chrome.tabs.query({ url: u });
  const { urls } = await chrome.tabs.sendMessage(tab.id, { type: 'collect-images' });
  await chrome.runtime.sendMessage({ type: 'keep-many', imageUrls: urls, pageUrl: tab.url, pageTitle: tab.title });
  return tab.id;
}, `${base}/sketchbook`);
await gallery.reload();
await gallery.waitForTimeout(700);
const tiles = gallery.locator('button.tile');
// Tiles render newest first, matching the store's list order.
const order = await sw.evaluate(async () => {
  const db = await new Promise((res) => { const r = indexedDB.open('moodoodle'); r.onsuccess = () => res(r.result); });
  const all = await new Promise((res) => { const r = db.transaction('images').objectStore('images').getAll(); r.onsuccess = () => res(r.result); });
  db.close();
  return all.sort((a, b) => b.savedAt.localeCompare(a.savedAt)).map((i) => i.imageUrl.split('/').pop().replace('.png', ''));
});
const tag = async (name, text) => {
  const tile = tiles.nth(order.indexOf(name));
  await tile.click();
  await gallery.fill('#d-tags', text);
  await gallery.getByRole('button', { name: 'Save', exact: true }).click();
  await gallery.waitForTimeout(250);
  await tile.click();
};
await tag('sun', 'sunny, cute');
await tag('cat', 'cat, cute');
await tag('flower', 'floral');
await gallery.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
await gallery.waitForTimeout(300);
const shotGallery = await gallery.screenshot();

// 2) Color filter + picks ready to export
await gallery.getByRole('button', { name: /^Orange/ }).click();
await gallery.waitForTimeout(250);
const orange = await tiles.count();
for (let i = 0; i < Math.min(2, orange); i++) await tiles.nth(i).click();
await gallery.evaluate(() => window.scrollTo(0, 0));
await gallery.waitForTimeout(250);
const shotExport = await gallery.screenshot();

// 3) Popup with the sketchbook tab as the active page
const popup = await ctx.newPage();
await popup.setViewportSize({ width: 400, height: 520 });
await popup.addInitScript((id) => {
  const realQuery = chrome.tabs.query.bind(chrome.tabs);
  chrome.tabs.query = async (q) => (q && q.active ? [await chrome.tabs.get(id)] : realQuery(q));
}, webTabId);
await popup.goto(`chrome-extension://${extId}/popup.html`);
await popup.waitForTimeout(700);
const popupHeight = await popup.evaluate(() => Math.ceil(document.querySelector('.pop').getBoundingClientRect().height));
const shotPopup = await popup.screenshot({ clip: { x: 0, y: 0, width: 400, height: popupHeight } });

// Frame each capture with a caption
const framer = await ctx.newPage();
await framer.setViewportSize({ width: 1280, height: 800 });
async function frame(file, title, note, shot, { width = 1000, side = false } = {}) {
  const img = `data:image/png;base64,${shot.toString('base64')}`;
  await framer.setContent(`<!doctype html><html><head><style>
    @font-face{font-family:D;src:url(data:font/woff2;base64,${fonts.display})}
    @font-face{font-family:B;src:url(data:font/woff2;base64,${fonts.body})}
    @font-face{font-family:H;src:url(data:font/woff2;base64,${fonts.hand})}
    body{margin:0;width:1280px;height:800px;background:#F7F5FB;color:#2A2433;overflow:hidden;font-family:B}
    .wrap{height:100%;display:flex;flex-direction:${side ? 'row' : 'column'};align-items:center;justify-content:center;gap:${side ? 72 : 24}px;padding:36px;box-sizing:border-box}
    .cap{display:flex;flex-direction:column;gap:4px;${side ? 'max-width:440px' : 'align-items:center;text-align:center'}}
    h1{font-family:D;font-size:${side ? 52 : 40}px;letter-spacing:-.02em;line-height:1.05;margin:0}
    .note{font-family:H;font-size:28px;color:#6E6578}
    img{width:${width}px;max-height:${side ? 700 : 600}px;object-fit:cover;object-position:top;border-radius:22px;box-shadow:0 0 0 1px #E7E1F2,0 24px 60px rgba(42,36,51,.16);display:block}
  </style></head><body><div class="wrap"><div class="cap"><h1>${title}</h1><span class="note">${note}</span></div><img src="${img}"></div></body></html>`);
  await framer.waitForTimeout(300);
  await framer.screenshot({ path: path.join(outDir, file) });
}
await frame('1-gallery.png', 'All your favorite doodles, in one cozy place', 'search by site, tag or color', shotGallery);
await frame('2-keep.png', 'Keep any image in one click', 'hover, press Keep, done', shotHover);
await frame('3-popup.png', 'Keep a whole page of inspiration at once', 'right from the toolbar', shotPopup, { width: 380, side: true });
await frame('4-export.png', 'Pick your favorites, take them anywhere', '.zip with a note of where each came from', shotExport);

await ctx.close();
server.close();
console.log(`wrote ${fs.readdirSync(outDir).join(', ')} to ${outDir}`);
