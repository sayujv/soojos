// Family check page: every section renders, answers persist (device + db), no layout breaks.
// Usage: node projects/apollo/test/review_check.mjs
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import http from 'node:http';
import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '..');
const fails = []; const fail = m => fails.push(m);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'apollo-review-'));
for (const f of ['data.js', 'grammar.js', 'speech.js']) fs.copyFileSync(path.join(root, 'app', f), path.join(tmp, f));
fs.copyFileSync(path.join(root, 'review', 'review.js'), path.join(tmp, 'review.js'));
fs.cpSync(path.join(root, 'app', 'audio'), path.join(tmp, 'audio'), { recursive: true });
fs.writeFileSync(path.join(tmp, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(path.join(root, 'review', 'index.html'), 'utf8') + '</body></html>');
const server = http.createServer((q, r) => { const f = path.join(tmp, q.url.split('?')[0]); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8' }); fs.createReadStream(f).pipe(r); }).listen(0);
const base = `http://127.0.0.1:${server.address().port}/index.html`;
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const browser = await chromium.launch();
const errors = [];
async function open(withDb) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|net::/.test(m.text())) errors.push(m.text()); });
  await page.route(/fonts\./, r => r.abort());
  if (withDb) await page.addInitScript(() => {
    const store = (window.__db = JSON.parse(sessionStorage.getItem('__db') || '{}'));
    const save = () => sessionStorage.setItem('__db', JSON.stringify(store));
    const db = {
      doc: p => ({ set: async d => { store[p] = d; save(); } }),
      collection: c => ({ where: (f, op, v) => ({ get: async () => ({ docs: Object.entries(store).filter(([k, d]) => k.startsWith(c + '/') && d[f] === v).map(([k, d]) => ({ id: k, data: () => d })) }) }) })
    };
    const user = { id: async () => 'u_mum0000000000000000000' };
    window.claude = { use: async n => (n === 'db' ? db : n === 'user' ? user : null) };
  });
  await page.goto(base); await page.waitForSelector('.sec');
  return page;
}
const overflow = async (p, where) => { const o = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (o > 0) fail(`${where}: sideways scroll ${o}px`); };

const page = await open(true);
const total = await page.evaluate(() => window.APOLLO_REVIEW.count());
const secs = await page.evaluate(() => window.APOLLO_REVIEW.sections.map(s => [s.id, s.items.length]));
if (total < 500) fail(`only ${total} items`);
await overflow(page, 'home');
// every section opens; page through all items in each
for (const [id, n] of secs) {
  await page.click(`[data-sec="${id}"]`);
  while (await page.locator('#more').count()) await page.click('#more');
  const shown = await page.locator('.it').count();
  if (shown !== n) fail(`section ${id}: shows ${shown} of ${n}`);
  await overflow(page, `section ${id}`);
  await page.click('[data-home]');
}
// answer: verdict, note verdict, typed form
await page.click('[data-sec="family"]');
const first = page.locator('.it').first();
await first.locator('[data-v="no"]').click();
await first.locator('.say').fill('dadi'); await first.locator('.say').press('Tab');
await page.click('[data-home]'); await page.click('[data-sec="greet"]');
const withClaim = page.locator('.it:has(.claim)').first();
await withClaim.locator('[data-v="close"]').click();
await withClaim.locator('[data-c="yes"]').click();
await page.click('[data-home]'); await page.fill('#who', 'Mummy'); await page.press('#who', 'Tab');
await page.waitForTimeout(1200);
const db = await page.evaluate(() => window.__db);
const docs = Object.values(db);
const ba = docs.find(d => d.item === 'q:ba');
if (!(ba && ba.v === 'no' && ba.say === 'dadi' && ba.name === 'Mummy' && ba.by === 'u_mum0000000000000000000')) fail(`db answer for q:ba wrong: ${JSON.stringify(ba)}`);
if (!docs.some(d => d.v === 'close' && d.c === 'yes')) fail('note verdict not saved to db');
if (await page.textContent('#status') !== 'Saved') fail(`status says "${await page.textContent('#status')}"`);
if (!/2 of/.test(await page.textContent('.overall span'))) fail('overall progress not updated');
// reload with a cleared device store: answers come back from the db
await page.evaluate(() => localStorage.clear());
await page.reload(); await page.waitForSelector('.sec'); await page.waitForTimeout(400);
await page.click('[data-sec="family"]');
if (await page.locator('.it').first().locator('[data-v="no"][aria-pressed="true"]').count() !== 1) fail('answer not restored from db');
if (await page.locator('.it').first().locator('.say').inputValue() !== 'dadi') fail('typed answer not restored from db');
// hide-done filter
await page.check('#onlyOpen');
if (await page.locator('.it[data-id="q:ba"]').count()) fail('hide-done filter did not hide an answered item');
await page.close();

// for Sayuj: importing a pasted WhatsApp message writes answers to the db under the sender's name
{
  const pi = await open(true);
  await pi.evaluate(() => sessionStorage.removeItem('__db'));
  await pi.reload(); await pi.waitForSelector('.sec');
  await pi.click('.import summary');
  await pi.fill('#impText', 'APOLLO1|Mummy|1/1\nAnswers for Sayuj\'s Gujarati app.\nq:ba|n||dadi\nphrase:kem-cho|y|y|\nnot a line\nq:se|s||kyare kyare');
  await pi.click('#impBtn'); await pi.waitForTimeout(1200);
  if (!/Added 3 answers from Mummy/.test(await pi.textContent('#impMsg'))) fail(`import message: ${await pi.textContent('#impMsg')}`);
  const d2 = Object.values(await pi.evaluate(() => window.__db));
  if (!(d2.length === 3 && d2.every(x => x.name === 'Mummy') && d2.find(x => x.item === 'q:se').v === 'some' && d2.find(x => x.item === 'phrase:kem-cho').c === 'yes')) fail(`imported answers not in db: ${JSON.stringify(d2)}`);
  await pi.close();
}

// no Claude viewer: device-only mode + copy fallback
const p2 = await open(false);
if (!/this phone/.test(await p2.textContent('#status'))) fail('offline status not shown');
await p2.click('[data-sec="kutchi"]');
await p2.locator('.it').first().locator('[data-v="yes"]').click();
await p2.click('[data-home]');
await p2.click('#copyAll');
const copied = await p2.locator('.copybox').count() ? await p2.locator('.copybox').inputValue() : '';
if (copied && !/phrase:kien-aayo\|y\|\|/.test(copied)) fail('copy text missing the answer');

// no account: WhatsApp send of new answers, marked sent, then a new one appears for the next answer
await p2.click('[data-sec="family"]');
const f0 = p2.locator('.it').first();
await f0.locator('[data-v="no"]').click(); await f0.locator('.say').fill('ame "dadi" kahiye | બા નહીં'); await f0.locator('.say').press('Tab');
await p2.click('[data-home]'); await p2.fill('#who', 'Mummy'); await p2.press('#who', 'Tab');
const waHrefs = await p2.$$eval('a.wa', as => as.map(a => a.getAttribute('href')));
if (waHrefs.length !== 1) fail(`expected 1 WhatsApp button, got ${waHrefs.length}`);
const waText = waHrefs.length ? decodeURIComponent(waHrefs[0].replace('https://wa.me/?text=', '')) : '';
if (!/^APOLLO1\|Mummy\|1\/1/.test(waText) || !waText.includes('q:ba|n||ame "dadi" kahiye બા નહીં') || !waText.includes('phrase:kien-aayo|y||')) fail(`WhatsApp text wrong:\n${waText}`);
await p2.evaluate(() => { const a = document.querySelector('a.wa'); a.addEventListener('click', e => e.preventDefault()); a.click(); });
await p2.waitForTimeout(900);
if (!(await p2.locator('.send .sent').count())) fail('sent answers not marked as sent');
await p2.click('[data-sec="greet"]'); await p2.locator('.it').first().locator('[data-v="yes"]').click(); await p2.click('[data-home]');
const again = await p2.$$eval('a.wa', as => as.map(a => decodeURIComponent(a.getAttribute('href'))));
if (again.length !== 1 || !/Send 1 new answers/.test(await p2.textContent('a.wa')) || again[0].includes('q:ba|')) fail('second send should contain only the new answer');
// many answers split into parts under the URL limit
await p2.evaluate(() => { const R = window.APOLLO_REVIEW; R.sections.forEach(sc => sc.items.slice(0, 40).forEach(it => { R.answers()[it.id] = { v: 'close', say: 'kai bijo shabd vaprie chhie aa jagya par' }; })); });
await p2.click('[data-sec="family"]'); await p2.click('[data-home]');
const many = await p2.$$eval('a.wa', as => as.map(a => a.getAttribute('href').length));
if (many.length < 2 || many.some(n => n > 3200)) fail(`long sends should split under the limit: ${JSON.stringify(many)}`);
await p2.emulateMedia({ colorScheme: 'dark' });
if (await p2.evaluate(() => getComputedStyle(document.body).backgroundColor) !== 'rgb(14, 17, 36)') fail('dark mode background wrong');
await p2.screenshot({ path: path.join(tmp, 'review-dark.png') });
await p2.close();

// standalone page, served from the repo layout as GitHub would serve it: no Claude viewer at all
{
  const rs = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8' }); fs.createReadStream(f).pipe(r); }).listen(0);
  const sp = await browser.newPage({ viewport: { width: 390, height: 844 } });
  sp.on('pageerror', e => errors.push('standalone: ' + e.message));
  const audioHits = []; sp.on('response', r => { if (/app\/audio\//.test(r.url())) audioHits.push(r.status()); });
  await sp.route(/fonts\./, r => r.abort());
  await sp.goto(`http://127.0.0.1:${rs.address().port}/review/family-check.html`);
  await sp.waitForSelector('.sec');
  if (await sp.evaluate(() => document.compatMode) !== 'CSS1Compat') fail('standalone page renders in quirks mode');
  if (await sp.evaluate(() => window.APOLLO_REVIEW.count()) !== total) fail('standalone page item count differs');
  await sp.waitForTimeout(800);
  if (audioHits.length < 17 || audioHits.some(s => s !== 200)) fail(`standalone audio: ${JSON.stringify(audioHits)}`);
  if (!/this phone/.test(await sp.textContent('#status'))) fail('standalone should save on the phone');
  await sp.click('[data-sec="family"]'); await sp.locator('.it').first().locator('[data-v="yes"]').click(); await sp.click('[data-home]');
  if (await sp.locator('a.wa').count() !== 1) fail('standalone: WhatsApp button missing');
  const o = await sp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (o > 0) fail(`standalone: sideways scroll ${o}px`);
  await sp.close(); rs.close();
}
await browser.close(); server.close();
errors.forEach(e => fail('console: ' + e));
console.log(`items: ${total} in ${secs.length} sections ${JSON.stringify(Object.fromEntries(secs))}`);
console.log(`screenshots: ${tmp}`);
if (fails.length) { console.log(`FAIL (${fails.length})\n - ` + fails.join('\n - ')); process.exit(1); }
console.log('PASS: every section renders fully; answers save to device and db, restore from db, filter works; no-account WhatsApp send (new-only, split into parts), import back into db; copy fallback; standalone public page (standards mode, audio, WhatsApp); dark mode; no sideways scroll; 0 console errors');
