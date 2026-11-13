// UI smoke test with mocked NASA APIs. Run: node tests/ui_test.js  (serves the site on :8765)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = process.argv[2] || '/tmp';

function rnd(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 - 0.5; }; }
function monthlyObj(base, amp, trend, noise, seed, y0 = 1981, y1 = 2025) {
  const r = rnd(seed); const o = {};
  for (let y = y0; y <= y1; y++) { let s = 0; for (let m = 1; m <= 12; m++) { const v = +(base + amp * Math.sin((m - 4) / 12 * 2 * Math.PI) + trend * (y - y0) + noise * r()).toFixed(2); o[`${y}${String(m).padStart(2, '0')}`] = v; s += v; } o[`${y}13`] = +(s / 12).toFixed(2); }
  return o;
}
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  const ext = path.extname(f);
  res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png' }[ext] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(8765);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url.includes('cartocdn.com') || url.includes('arcgisonline') || url.includes('openstreetmap.org')) return route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64') });
    if (url.includes('power.larc.nasa.gov') && url.includes('/point')) {
      const params = new URL(url).searchParams.get('parameters').split(',');
      const parameter = {}; params.forEach((p, i) => parameter[p] = monthlyObj(20 + i, 8, (i % 3 - 1) * 0.03, 3, 7 + i));
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ geometry: { coordinates: [72.67, 32.08, 178] }, properties: { parameter }, header: { fill_value: -999 }, parameters: {} }) });
    }
    if (url.includes('power.larc.nasa.gov') && url.includes('/regional')) {
      const sp = new URL(url).searchParams; const param = sp.get('parameters');
      const features = []; let k = 0;
      for (let la = Math.ceil(+sp.get('latitude-min') * 2) / 2; la <= +sp.get('latitude-max'); la += 0.5)
        for (let lo = Math.ceil(+sp.get('longitude-min') / 0.625) * 0.625; lo <= +sp.get('longitude-max'); lo += 0.625)
          features.push({ geometry: { coordinates: [lo, la, 100] }, properties: { parameter: { [param]: monthlyObj(5, 3, (la - 32) * 0.004 + (lo - 72) * 0.002, 1.5, ++k) } } });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ features, header: { fill_value: -999 } }) });
    }
    if (url.includes('modis.ornl.gov') && url.includes('/dates')) {
      const dates = []; for (let y = 2000; y <= 2026; y++) for (let d = 1; d <= 353; d += 16) { if (y === 2000 && d < 49) continue; if (y === 2026 && d > 289) continue; const dt = new Date(Date.UTC(y, 0, d)); dates.push({ modis_date: `A${y}${String(d).padStart(3, '0')}`, calendar_date: dt.toISOString().slice(0, 10) }); }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ dates }) });
    }
    if (url.includes('modis.ornl.gov') && url.includes('/subset')) {
      const sp = new URL(url).searchParams; const s = sp.get('startDate'), e = sp.get('endDate');
      const subset = []; const y0 = +s.slice(1, 5), d0 = +s.slice(5), y1 = +e.slice(1, 5), d1 = +e.slice(5);
      for (let y = y0; y <= y1; y++) for (let d = 1; d <= 353; d += 16) { if ((y === y0 && d < d0) || (y === y1 && d > d1)) continue; const dt = new Date(Date.UTC(y, 0, d)); const v = Math.round(4000 + 2000 * Math.sin(d / 365 * 2 * Math.PI) + (y - 2000) * 40); subset.push({ modis_date: `A${y}${d}`, calendar_date: dt.toISOString().slice(0, 10), data: Array(81).fill(v).map((x, i) => i === 0 ? -3000 : x) }); }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ scale: '0.0001', subset }) });
    }
    return route.continue();
  });

  await page.goto('http://localhost:8765/');
  await page.screenshot({ path: `${OUT}/01_home.png` });
  await page.click('#runBtn');
  
  await page.waitForSelector('#verdict h3', { timeout: 15000 });
  console.log('VERDICT annual:', await page.textContent('#verdict h3'));
  await page.screenshot({ path: `${OUT}/02_result.png`, fullPage: true });

  await page.selectOption('#period', 'monthly'); await page.click('#runBtn'); await page.waitForTimeout(1500);
  console.log('VERDICT monthly:', await page.textContent('#verdict h3'));
  await page.selectOption('#period', 'DJF'); await page.click('#runBtn'); await page.waitForTimeout(1000);
  console.log('VERDICT DJF:', await page.textContent('#verdict h3'));
  await page.selectOption('#variable', 'NDVI'); await page.selectOption('#period', 'annual'); await page.click('#runBtn');
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Done') || document.querySelector('#status').classList.contains('error'), null, { timeout: 30000 });
  console.log('VERDICT NDVI:', await page.textContent('#verdict h3'), '|', await page.textContent('#status'));

  await page.click('nav.tabs button[data-tab=scanner]');
  await page.click('#scanBtn'); await page.waitForSelector('#scanOut:not([hidden])', { timeout: 15000 });
  console.log('SCAN:', await page.textContent('#scanTitle'));
  await page.screenshot({ path: `${OUT}/03_scanner.png`, fullPage: true });

  await page.click('nav.tabs button[data-tab=map]');
  await page.selectOption('#mapSize', '10'); await page.click('#mapBtn');
  await page.waitForFunction(() => document.querySelector('#mapStatus').textContent.includes('Click'), null, { timeout: 20000 });
  console.log('MAP:', (await page.textContent('#mapSummary')).replace(/\s+/g, ' '));
  await page.screenshot({ path: `${OUT}/04_map.png` });

  await page.click('nav.tabs button[data-tab=cases]');
  await page.screenshot({ path: `${OUT}/05_cases.png`, fullPage: true });
  await page.click('.case[data-i="0"]'); await page.waitForTimeout(1500);
  console.log('CASE0:', await page.textContent('#verdict h3'), '| hash', await page.evaluate(() => location.hash));
  await page.click('nav.tabs button[data-tab=learn]');
  await page.screenshot({ path: `${OUT}/06_learn.png` });

  // mobile layout
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('nav.tabs button[data-tab=investigate]');
  await page.waitForTimeout(500);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  console.log('MOBILE horizontal overflow px:', overflow);
  await page.screenshot({ path: `${OUT}/07_mobile.png`, fullPage: false });
  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close(); server.close();
})().catch(e => { console.error(e); server.close(); process.exit(1); });
