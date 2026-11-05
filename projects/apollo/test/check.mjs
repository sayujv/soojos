// Apollo outside check: content validation + a headless run through the real app.
// Usage: node projects/apollo/test/check.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(here, '..', 'app');
const fails = [];
const fail = m => fails.push(m);

// ── 1. content validation ────────────────────────────────
const win = {};
vm.runInNewContext(fs.readFileSync(path.join(appDir, 'data.js'), 'utf8'), { window: win });
const { units, phrases, scenes } = win.APOLLO_DATA;
const KINDS = new Set(['standard', 'sklpc', 'kutchi', 'swahili-loan']);
const CONFS = new Set(['unsourced', 'anecdote', 'claimed', 'verified']);
const unitIds = new Set(units.map(u => u.id));
const seen = new Set();
for (const p of phrases) {
  const w = `phrase ${p.id}`;
  if (seen.has(p.id)) fail(`${w}: duplicate id`); seen.add(p.id);
  for (const f of ['id', 'unit', 'r', 'g', 'e', 'kind', 'conf', 'src', 'date']) if (!p[f]) fail(`${w}: missing ${f}`);
  if (!unitIds.has(p.unit)) fail(`${w}: unknown unit ${p.unit}`);
  if (!KINDS.has(p.kind)) fail(`${w}: bad kind ${p.kind}`);
  if (!CONFS.has(p.conf)) fail(`${w}: bad confidence ${p.conf}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date)) fail(`${w}: date must be YYYY-MM-DD`);
  if (/[઀-૿]/.test(p.r) || !/[઀-૿]/.test(p.g)) fail(`${w}: r must be roman, g must be Gujarati script`);
  if (p.conf === 'unsourced' && (p.kind !== 'standard' || p.src !== 'apollo:standard-core')) fail(`${w}: only standard-core phrases may be unsourced`);
  if (p.kind !== 'standard' && !/^https?:\/\//.test(p.src)) fail(`${w}: dialect phrase needs a source URL`);
  if (p.kind !== 'standard' && p.conf === 'unsourced') fail(`${w}: dialect phrase cannot be unsourced`);
}
for (const s of scenes) {
  if (!s.steps.length) fail(`scene ${s.id}: empty`);
  for (const [i, st] of s.steps.entries()) {
    if (st.say && !(st.r && st.e && /[઀-૿]/.test(st.say))) fail(`scene ${s.id} step ${i}: say needs Gujarati, r and e`);
    if (st.reply && st.reply.filter(o => o.ok).length !== 1) fail(`scene ${s.id} step ${i}: exactly one reply must be ok`);
    if (st.reply) for (const o of st.reply) if (!o.ok && !o.why) fail(`scene ${s.id} step ${i}: wrong reply "${o.r}" needs a why`);
  }
}
const counts = {};
for (const p of phrases) counts[p.kind] = (counts[p.kind] || 0) + 1;
console.log(`content: ${phrases.length} phrases ${JSON.stringify(counts)}, ${units.length} units, ${scenes.length} scenes`);

// ── 2. drive the real app in headless Chromium ───────────
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'apollo-'));
for (const f of ['data.js', 'app.js']) fs.copyFileSync(path.join(appDir, f), path.join(tmp, f));
// Mirror the artifact publish skeleton so the page renders in standards mode.
fs.writeFileSync(path.join(tmp, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(path.join(appDir, 'index.html'), 'utf8') + '</body></html>');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|net::/.test(m.text())) errors.push('console: ' + m.text()); });
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await page.goto('file://' + path.join(tmp, 'index.html'));
await page.waitForSelector('.unit');

const overflow = async where => { const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (o > 0) fail(`${where}: page scrolls sideways by ${o}px at 390px`); };
await overflow('home');

// answer whatever exercise is on screen correctly
async function answerCurrent() {
  const x = await page.evaluate(() => { const c = window.APOLLO.current(); return c && { t: c.t, r: c.p.r, e: c.p.e, tiles: c.tiles }; });
  if (!x) return false;
  if (x.t === 'intro') await page.click('[data-act="continue"]');
  else if (x.t === 'listen' || x.t === 'meaning') {
    const want = x.t === 'listen' ? x.e : x.r;
    await page.evaluate(w => [...document.querySelectorAll('.opt')].find(b => b.dataset.pick === w).click(), want);
    if (!(await page.locator('.feedback.good').count())) fail(`${x.t} on "${x.r}": correct option not accepted`);
    await page.click('#fb [data-act="continue"]');
  } else if (x.t === 'build') {
    const words = x.r.replace(/[?!.,]/g, '').split(' ');
    const used = new Set();
    for (const w of words) { const i = x.tiles.findIndex((t, k) => t === w && !used.has(k)); used.add(i); await page.click(`[data-tile="${i}"]`); }
    await page.click('[data-act="check"]');
    if (!(await page.locator('.feedback.good').count())) fail(`build on "${x.r}": correct order not accepted`);
    await page.click('#fb [data-act="continue"]');
  } else if (x.t === 'say') {
    await page.click('[data-act="reveal"]'); await page.click('[data-act="self-yes"]'); await page.click('#fb [data-act="continue"]');
  }
  return true;
}

// a full lesson from every unit that has phrases
const lessonKeys = await page.$$eval('[data-lesson]', bs => [...new Set(bs.map(b => b.dataset.lesson.split(':')[0]))].map(u => u + ':0'));
for (const key of lessonKeys) {
  await page.click(`[data-lesson="${key}"]`);
  let guard = 0;
  while (await page.locator('.done-hero').count() === 0 && guard++ < 80) if (!(await answerCurrent())) break;
  if (!(await page.locator('.done-hero').count())) fail(`lesson ${key}: never reached the end`);
  await overflow(`lesson ${key}`);
  await page.click('[data-go="home"]');
}
const st1 = await page.evaluate(() => window.APOLLO.state());
if (!(st1.xp > 0 && Object.keys(st1.cards).length >= 5 && st1.streak === 1)) fail(`progress not recorded: xp=${st1.xp} cards=${Object.keys(st1.cards).length} streak=${st1.streak}`);

// one wrong answer gets re-queued
await page.click(`[data-lesson="${lessonKeys[0]}"]`);
for (;;) { const t = await page.evaluate(() => window.APOLLO.current().t); if (t === 'listen' || t === 'meaning') break; await answerCurrent(); }
const answer = await page.evaluate(() => { const c = window.APOLLO.current(); return c.answer; });
const opts = await page.$$eval('.opt', bs => bs.map(b => b.dataset.pick));
await page.click(`.opt[data-pick="${opts.find(o => o !== answer).replace(/"/g, '\\"')}"]`);
if (!(await page.locator('.feedback.bad').count())) fail('wrong answer not marked wrong');
await page.click('[data-go="home"]');

// review: force everything due today
await page.evaluate(() => { const S = window.APOLLO.state(); const t = new Date(); const iso = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); for (const c of Object.values(S.cards)) c.due = iso; window.APOLLO.route('home'); });
const due = Number(await page.textContent('[data-go="review"] strong'));
if (due < 5) fail(`review count ${due} after forcing due`);
await page.click('[data-go="review"]');
let g = 0; while (await page.locator('.done-hero').count() === 0 && g++ < 60) if (!(await answerCurrent())) break;
if (!(await page.locator('.done-hero').count())) fail('review never finished');
await page.click('[data-go="home"]');
const nextDue = await page.evaluate(() => Object.values(window.APOLLO.state().cards).filter(c => c.box >= 2).length);
if (nextDue < 1) fail('review did not promote any card');

// every scene, choosing the right reply
for (const s of scenes) {
  await page.click(`[data-scene="${s.id}"]`);
  for (const st of s.steps) if (st.reply) { const k = st.reply.findIndex(o => o.ok); await page.click(`[data-reply="${k}"]`); }
  if (!(await page.locator('text=Conversation done').count())) fail(`scene ${s.id}: did not complete`);
  await overflow(`scene ${s.id}`);
  await page.click('#choices [data-go="home"]');
}

// ask-family: verdict + note persist through a reload
await page.click('[data-go="family"]');
const firstId = phrases[0].id;
await page.click(`[data-v="${firstId}:yes"]`);
await page.fill(`[data-note="${firstId}"]`, 'test note');
await page.press(`[data-note="${firstId}"]`, 'Tab');
await overflow('family');
await page.reload(); await page.waitForSelector('.unit');
const v = await page.evaluate(id => window.APOLLO.state().verdicts[id], firstId);
if (!(v && v.v === 'yes' && v.note === 'test note')) fail(`family verdict not persisted: ${JSON.stringify(v)}`);

// dark mode renders with a dark background
await page.emulateMedia({ colorScheme: 'dark' });
const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
if (bg !== 'rgb(14, 17, 36)') fail(`dark mode background is ${bg}`);
await page.screenshot({ path: path.join(tmp, 'home-dark.png'), fullPage: false });
await page.emulateMedia({ colorScheme: 'light' });
await page.screenshot({ path: path.join(tmp, 'home-light.png'), fullPage: false });

await browser.close();
for (const e of errors) fail(e);
console.log(`screenshots: ${tmp}`);
if (fails.length) { console.log(`FAIL (${fails.length})\n - ` + fails.join('\n - ')); process.exit(1); }
console.log(`PASS: content valid; ${lessonKeys.length} lessons, review, ${scenes.length} scenes, ask-family, dark mode; 0 console errors; no sideways scroll at 390px`);
