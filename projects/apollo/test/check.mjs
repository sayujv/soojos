// Apollo outside check: content validation + a headless run through the real app.
// Usage: node projects/apollo/test/check.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { romanise, similarity, key } from '../tools/translit.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(here, '..', 'app');
const fails = [];
const fail = m => fails.push(m);

// ── 1. content validation ────────────────────────────────
const win = {};
vm.runInNewContext(fs.readFileSync(path.join(appDir, 'data.js'), 'utf8'), { window: win });
const { units, phrases, scenes } = win.APOLLO_DATA;
vm.runInNewContext(fs.readFileSync(path.join(appDir, 'grammar.js'), 'utf8'), { window: win });
const { patterns, stories } = win.APOLLO_GRAMMAR;
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
// grammar layer
for (const pt of patterns) {
  if (!pt.why || pt.rows.length < 6) fail(`pattern ${pt.id}: needs an explanation and at least 6 rows`);
  for (const f of [0, 2]) { const vals = pt.rows.map(r => r[f]); if (new Set(vals).size !== vals.length) fail(`pattern ${pt.id}: duplicate ${f ? 'english' : 'roman'} values make the drill ambiguous`); }
  for (const [r, g, e] of pt.rows) if (!r || !e || !/[\u0A80-\u0AFF]/.test(g)) fail(`pattern ${pt.id}: bad row ${r}`);
}
for (const st of stories) {
  if (st.lines.length < 8) fail(`story ${st.id}: too short`);
  for (const l of st.lines) {
    if (!(l.who && l.r && l.e && /[\u0A80-\u0AFF]/.test(l.g) && l.w.length)) fail(`story ${st.id}: incomplete line "${l.r}"`);
    const lk = ' ' + key(l.r) + ' ';
    for (const [w] of l.w) for (const t of key(w.replace(/…/g, ' ')).split(' ').filter(Boolean)) if (!lk.includes(t)) fail(`story ${st.id}: gloss word "${w}" is not in "${l.r}"`);
  }
}
// script <-> roman agreement, using the Apollo converter as an independent reading of the Gujarati
const pairs = [
  ...phrases.map(p => [p.id, p.r, p.g]),
  ...scenes.flatMap(sc => sc.steps.filter(x => x.say).map(x => [sc.id, x.r, x.say])),
  ...patterns.flatMap(pt => pt.rows.map(([r, g]) => [pt.id, r, g])),
  ...stories.flatMap(st => st.lines.map(l => [st.id, l.r, l.g]))
];
let loose = 0;
for (const [id, r, g] of pairs) { const sim = similarity(r, romanise(g)); if (sim < 0.8) loose++; if (sim < 0.6) fail(`${id}: roman "${r}" does not match its Gujarati (reads as "${romanise(g)}")`); }
console.log(`script/roman: ${pairs.length} pairs checked, ${loose} loose (loanwords and nasal endings), 0 allowed below 0.6`);
console.log(`grammar: ${patterns.length} patterns, ${stories.length} stories, ${stories.reduce((n, s) => n + s.lines.length, 0)} story lines`);
console.log(`content: ${phrases.length} phrases ${JSON.stringify(counts)}, ${units.length} units, ${scenes.length} scenes`);

// ── 2. drive the real app in headless Chromium ───────────
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'apollo-'));
for (const f of ['data.js', 'grammar.js', 'app.js']) fs.copyFileSync(path.join(appDir, f), path.join(tmp, f));
// Mirror the artifact publish skeleton so the page renders in standards mode.
fs.writeFileSync(path.join(tmp, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(path.join(appDir, 'index.html'), 'utf8') + '</body></html>');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|net::/.test(m.text())) errors.push('console: ' + m.text()); });
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await page.goto('file://' + path.join(tmp, 'index.html'));
await page.waitForSelector('.stop');

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
  while (await page.locator('.finish').count() === 0 && guard++ < 80) if (!(await answerCurrent())) break;
  if (!(await page.locator('.finish').count())) fail(`lesson ${key}: never reached the end`);
  await overflow(`lesson ${key}`);
  await page.click('.finish [data-go]');
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
if (await page.evaluate(() => window.APOLLO.state().xp) < 1) fail('xp lost');
await page.click('.exbar [data-go]');

// review: force everything due today
await page.evaluate(() => { const S = window.APOLLO.state(); const t = new Date(); const iso = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); for (const c of Object.values(S.cards)) c.due = iso; });
await page.click('.tab[data-go="review"]');
const due = Number(await page.textContent('.tab[data-go="review"] .dot'));
if (due < 5) fail(`review badge shows ${due} after forcing due`);
await overflow('review tab');
await page.click('[data-act="start-review"]');
let g = 0; while (await page.locator('.finish').count() === 0 && g++ < 60) if (!(await answerCurrent())) break;
if (!(await page.locator('.finish').count())) fail('review never finished');
await page.click('.finish [data-go]');
const nextDue = await page.evaluate(() => Object.values(window.APOLLO.state().cards).filter(c => c.box >= 2).length);
if (nextDue < 1) fail('review did not promote any card');

// mithai box: locked until the unit is done, then pays out once
await page.click('.tab[data-go="learn"]');
const xp0 = await page.evaluate(() => window.APOLLO.state().xp);
await page.click('[data-chest="family"]');
if (await page.evaluate(() => window.APOLLO.state().chests.family)) fail('chest opened before unit was done');
await page.evaluate(() => { const S = window.APOLLO.state(); for (let i = 0; i < 6; i++) S.lessons['greet:' + i] = true; window.APOLLO.route('learn'); });
await page.click('[data-chest="greet"]');
await page.waitForTimeout(1100);
const st2 = await page.evaluate(() => window.APOLLO.state());
if (!(st2.chests.greet && st2.xp >= xp0 + 25)) fail('mithai box did not pay out');
if (!(st2.badges.first && st2.badges.mithai && st2.badges.kutchi)) fail(`badges missing: ${JSON.stringify(st2.badges)}`);

// every scene, choosing the right reply
await page.click('.tab[data-go="talk"]');
await overflow('talk tab');
for (const s of scenes) {
  await page.click(`[data-scene="${s.id}"]`);
  for (const st of s.steps) if (st.reply) { const k = st.reply.findIndex(o => o.ok); await page.click(`[data-reply="${k}"]`); }
  if (!(await page.locator('text=Conversation done').count())) fail(`scene ${s.id}: did not complete`);
  await overflow(`scene ${s.id}`);
  await page.click('#choices [data-go="talk"]');
}
if (await page.evaluate(() => Math.min(...Object.values(window.APOLLO.state().scenes))) !== 3) fail('perfect scenes did not earn 3 stars');
await page.click('.tab[data-go="me"]');
if (await page.locator('.badge:not(.locked)').count() < 4) fail('Me tab shows too few unlocked badges');
await overflow('me tab');
await page.click('[data-go="book"]');
if (await page.locator('.item').count() !== phrases.length) fail('phrasebook does not list every phrase');

// patterns: open each, practise it to the end
await page.evaluate(() => window.APOLLO.route('learn'));
await page.click('.card.how');
for (const pt of patterns) {
  await page.click(`[data-pattern="${pt.id}"]`);
  if (await page.locator('.item').count() !== pt.rows.length) fail(`pattern ${pt.id}: table rows missing`);
  await overflow(`pattern ${pt.id}`);
  await page.click('[data-act="start-pattern"]');
  let k = 0; while (await page.locator('.finish').count() === 0 && k++ < 60) if (!(await answerCurrent())) break;
  if (!(await page.locator('.finish').count())) fail(`pattern ${pt.id}: drill never finished`);
  await page.click('.finish [data-go]');
}
// stories: read every line, open a gloss, pass the quick check
for (const st of stories) {
  await page.evaluate(() => window.APOLLO.route('talk'));
  await page.click(`[data-story="${st.id}"]`);
  while (await page.locator('[data-act="next-line"]').count()) await page.click('[data-act="next-line"]');
  if (await page.locator('.sline').count() !== st.lines.length) fail(`story ${st.id}: not every line shown`);
  await page.locator('.sline .r').first().click();
  if (await page.locator('.sline .gloss:visible').count() !== 1) fail(`story ${st.id}: tapping one line should show exactly one word breakdown`);
  await page.click('#showGu');
  if (!(await page.locator('.sline .gu:not([hidden])').count())) fail(`story ${st.id}: script toggle did nothing`);
  await overflow(`story ${st.id}`);
  await page.click('[data-act="story-quiz"]');
  let k = 0; while (await page.locator('.finish').count() === 0 && k++ < 40) if (!(await answerCurrent())) break;
  if (!(await page.locator('.finish').count())) fail(`story ${st.id}: quick check never finished`);
  await page.click('.finish [data-go]');
}
const st3 = await page.evaluate(() => window.APOLLO.state());
if (Object.keys(st3.patterns).length !== patterns.length || Object.keys(st3.stories).length !== stories.length) fail('pattern/story progress not recorded');
if (!(st3.badges.grammar && st3.badges.stories)) fail('grammar/story badges not unlocked');

// ask-family: verdict + note persist through a reload
await page.click('.tab[data-go="family"]');
const firstId = phrases[0].id;
await page.click(`[data-v="${firstId}:yes"]`);
await page.fill(`[data-note="${firstId}"]`, 'test note');
await page.press(`[data-note="${firstId}"]`, 'Tab');
await overflow('family');
await page.reload(); await page.waitForSelector('.tab');
await page.click('.seg [data-go="guide"]');
const rows = await page.locator('.grow').count();
const want = phrases.length && (await page.evaluate(() => window.APOLLO_DATA.guide.reduce((n, g) => n + g.rows.length, 0)));
if (rows !== want || rows < 25) fail(`who's-who shows ${rows} rows, expected ${want}`);
await overflow('who\'s who');
const v = await page.evaluate(id => window.APOLLO.state().verdicts[id], firstId);
if (!(v && v.v === 'yes' && v.note === 'test note')) fail(`family verdict not persisted: ${JSON.stringify(v)}`);

// dark mode renders with a dark background
await page.evaluate(() => window.APOLLO.route('learn'));
await page.emulateMedia({ colorScheme: 'dark' });
const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
if (bg !== 'rgb(13, 16, 34)') fail(`dark mode background is ${bg}`);
await page.screenshot({ path: path.join(tmp, 'home-dark.png'), fullPage: false });
await page.emulateMedia({ colorScheme: 'light' });
await page.screenshot({ path: path.join(tmp, 'home-light.png'), fullPage: false });

await browser.close();
for (const e of errors) fail(e);
console.log(`screenshots: ${tmp}`);
if (fails.length) { console.log(`FAIL (${fails.length})\n - ` + fails.join('\n - ')); process.exit(1); }
console.log(`PASS: content valid; ${lessonKeys.length} lessons, review, ${scenes.length} scenes, patterns, stories, ask-family, who's-who, mithai box, badges, tabs, dark mode; 0 console errors; no sideways scroll at 390px`);
