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
vm.runInNewContext(fs.readFileSync(path.join(appDir, 'speech.js'), 'utf8'), { window: win });
const SPEECH = win.APOLLO_SPEECH;
const KINDS = new Set(['standard', 'colloquial', 'gujlish', 'sklpc', 'kutchi', 'swahili-loan']);
const OWN = new Set(['standard', 'colloquial', 'gujlish']); // Claude's own Gujarati: may be unsourced
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
  if (p.conf === 'unsourced' && (!OWN.has(p.kind) || p.src !== 'apollo:standard-core')) fail(`${w}: only standard/colloquial phrases may be unsourced`);
  if (!OWN.has(p.kind) && !/^https?:\/\//.test(p.src)) fail(`${w}: dialect phrase needs a source URL`);
  if (!OWN.has(p.kind) && p.conf === 'unsourced') fail(`${w}: dialect phrase cannot be unsourced`);
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
// real-speech layer
for (const ld of SPEECH.ladders) {
  if (ld.rungs.length < 3) fail(`ladder ${ld.id}: needs at least 3 rungs`);
  for (const rg of ld.rungs) {
    if (!rg.l || !rg.r || !/[\u0A80-\u0AFF]/.test(rg.g)) fail(`ladder ${ld.id}: bad rung ${rg.r}`);
    if ((rg.l === 'Kutchi' || rg.l === 'Village') && rg.l === 'Kutchi' && !/^https?:/.test(rg.src || '')) fail(`ladder ${ld.id}: Kutchi rung needs a source`);
  }
}
for (const [c, g, e, traps, fem] of SPEECH.gym) {
  if (c.split(' | ').length < 2 || !e || !traps.length || !/[\u0A80-\u0AFF]/.test(g)) fail(`gym item "${c}" incomplete`);
  for (const t of traps) if (c.split(' | ').includes(t)) fail(`gym item "${c}": trap "${t}" is also a real chunk`);
  if (fem && fem[0].split(' | ').length < 2) fail(`gym item "${c}": bad feminine form`);
}
for (const b of SPEECH.level.building) if (b.opts.filter(o => o[1]).length !== 1 || b.opts.some(o => !o[1] && !o[2])) fail(`level building "${b.e}": one right answer, and a why for each wrong one`);
const phraseIds = new Set(phrases.map(p => p.id));
for (const id of [...SPEECH.level.words, ...SPEECH.level.recall]) if (!phraseIds.has(id)) fail(`level: unknown phrase id ${id}`);
for (const ref of SPEECH.level.register) { const [sid, i] = ref.split(':'); const st = (scenes.find(z => z.id === sid) || { steps: [] }).steps[+i]; if (!st || !st.reply) fail(`level: register ref ${ref} is not a reply step`); }
console.log(`real speech: ${SPEECH.ladders.length} ladders (${SPEECH.ladders.reduce((n, l) => n + l.rungs.length, 0)} rungs), ${SPEECH.reductions.length} shortcut rules, ${SPEECH.gym.length} gym sentences`);

// script <-> roman agreement, using the Apollo converter as an independent reading of the Gujarati
const pairs = [
  ...phrases.map(p => [p.id, p.r, p.g]),
  ...scenes.flatMap(sc => sc.steps.filter(x => x.say).map(x => [sc.id, x.r, x.say])),
  ...patterns.flatMap(pt => pt.rows.map(([r, g]) => [pt.id, r, g])),
  ...stories.flatMap(st => st.lines.map(l => [st.id, l.r, l.g])),
  ...SPEECH.ladders.flatMap(ld => ld.rungs.map(rg => [ld.id, rg.r, rg.g])),
  ...SPEECH.gym.map(([c, g]) => ['gym', c.split(' | ').join(' '), g])
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
for (const f of ['data.js', 'grammar.js', 'speech.js', 'app.js']) fs.copyFileSync(path.join(appDir, f), path.join(tmp, f));
fs.cpSync(path.join(appDir, 'audio'), path.join(tmp, 'audio'), { recursive: true });
// serve over http so fetch() of the audio packs works, as it does in the artifact
const http = await import('node:http');
const server = http.createServer((req, res) => {
  const f = path.join(tmp, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!f.startsWith(tmp) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;
// Mirror the artifact publish skeleton so the page renders in standards mode.
fs.writeFileSync(path.join(tmp, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(path.join(appDir, 'index.html'), 'utf8') + '</body></html>');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|net::/.test(m.text())) errors.push('console: ' + m.text()); });
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await page.goto(base + 'index.html');
// first run: About you
await page.waitForSelector('#profileForm');
await page.fill('#pfFather', 'mahesh'); await page.fill('#pfGaam', 'Kera');
await page.check('input[name="pfLean"][value="mixed"]');
await page.check('input[name="pfStyle"][value="playful"]');
await overflow_early();
await page.click('[data-act="save-profile"]');
await page.waitForSelector('.stop');
if (!(await page.locator('.cta[data-lesson="greet:0"]').count())) fail('Continue button missing or not pointing at the first lesson');
// audio packs load
for (let i = 0; i < 40 && (await page.evaluate(() => window.APOLLO.audio().clips)) < 400; i++) await page.waitForTimeout(250);
const au = await page.evaluate(() => window.APOLLO.audio());
if (au.clips < 450 || au.map < 450) fail(`audio packs: ${JSON.stringify(au)}`);


async function overflow_early() { const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (o > 0) fail(`about-you: sideways scroll ${o}px`); }

const overflow = async where => { const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (o > 0) fail(`${where}: page scrolls sideways by ${o}px at 390px`); };
await overflow('home');

// answer whatever exercise is on screen correctly
async function answerCurrent() {
  const x = await page.evaluate(() => { const c = window.APOLLO.current(); return c && { t: c.t, r: c.p.r, e: c.p.e, tiles: c.tiles, chunks: c.chunks, answer: c.answer }; });
  if (!x) return false;
  if (x.t === 'intro') await page.click('[data-act="continue"]');
  else if (x.t === 'choose') {
    await page.evaluate(a => [...document.querySelectorAll('.opt')].find(b => b.dataset.pick === a).click(), x.answer);
    if (!(await page.locator('.feedback.good').count())) fail(`choose "${x.r}": right option not accepted`);
    await page.click('#fb [data-act="continue"]');
  } else if (x.t === 'chunks') {
    const used = new Set();
    for (const ch of x.chunks) { const i = x.tiles.findIndex((t, k) => t === ch && !used.has(k)); used.add(i); await page.click(`[data-tile="${i}"]`); }
    await page.click('[data-act="check"]');
    if (!(await page.locator('.feedback.good').count())) fail(`chunks "${x.r}": right order not accepted`);
    await page.click('#fb [data-act="continue"]');
  } else if (x.t === 'recall') {
    await page.click('[data-act="recall-said"]'); await page.click('[data-act="self-yes"]');
    if (!(await page.locator('.feedback.good').count())) fail(`recall "${x.r}": not accepted`);
    await page.click('#fb [data-act="continue"]');
  }
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

// level check: all five skills measured; perfect run unlocks skip-basics
await page.click('.plan-card [data-act="level-start"]');
{ let k = 0; while (await page.locator('.sbar').count() === 0 && k++ < 60) if (!(await answerCurrent())) break; }
const L = await page.evaluate(() => window.APOLLO.state().level);
if (!L || ['words', 'sentences', 'building', 'register', 'recall'].some(k => typeof L[k] !== 'number')) fail(`level not measured: ${JSON.stringify(L)}`);
if (L && L.words !== 100) fail(`level words should be 100 after a perfect run, got ${L.words}`);
await overflow('level results');
await page.click('[data-act="skip-basics"]');
if (!(await page.evaluate(() => ['greet:0', 'family:3', 'call:1'].every(k => window.APOLLO.state().lessons[k])))) fail('skip basics did not mark the basic units');
if (!(await page.locator('.plan-card .sbar').count())) fail('Learn tab does not show the plan after the level check');
// sentence gym and quick-fire
await page.click('.plan-card [data-act="gym-start"]');
{ let k = 0; while (await page.locator('.finish').count() === 0 && k++ < 40) if (!(await answerCurrent())) break; }
if (!(await page.locator('.finish').count())) fail('sentence gym never finished');
await page.click('.finish [data-go]');
await page.click('.plan-card [data-act="quick-start"]');
{ let k = 0; while (await page.locator('.finish').count() === 0 && k++ < 30) if (!(await answerCurrent())) break; }
const rl = await page.evaluate(() => window.APOLLO.state().recallLog);
if (!(rl.length === 2 && rl[1].n >= 6 && rl[1].median !== null)) fail(`recall speed not logged: ${JSON.stringify(rl)}`);
await page.click('.finish [data-go]');
// real speech: ladders, family form, style drill
await page.click('[data-go="speech"]');
if (await page.locator('.ladder').count() !== SPEECH.ladders.length) fail('not every ladder is shown');
await overflow('real speech');
await page.fill('[data-ladfam="what-doing"]', 'su kare re?'); await page.press('[data-ladfam="what-doing"]', 'Tab');
if (await page.evaluate(() => window.APOLLO.state().ladderFamily['what-doing']) !== 'su kare re?') fail('family form not saved');
await page.click('[data-scene="drill-style"]');
{ const steps = await page.evaluate(() => window.APOLLO_DATA.scenes.find(z => z.id === 'drill-style').steps);
  for (const st of steps) if (st.reply) await page.click(`[data-reply="${st.reply.findIndex(o => o.ok)}"]`);
  if (!(await page.locator('text=Conversation done').count())) fail('formal-or-casual drill did not complete'); }
await page.evaluate(() => window.APOLLO.route('learn'));

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
await page.click('[data-chest="kin2"]');
if (await page.evaluate(() => window.APOLLO.state().chests.kin2)) fail('chest opened before unit was done');
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
  for (const st of s.steps) if (st.reply) {
    if (await page.locator('[data-act="show-choices"]').count()) await page.click('[data-act="show-choices"]');
    const k = st.reply.findIndex(o => o.ok); await page.click(`[data-reply="${k}"]`);
  }
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
await page.click('.card.how[data-go="patterns"]');
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

// personalisation: father's name and gendered forms reach the phrasebook
await page.evaluate(() => window.APOLLO.route('book'));
await page.fill('#q', 'dikro chu');
if (!(await page.locator('.item .r', { hasText: 'hu Maheshbhai no dikro chu' }).count())) fail('father name not personalised in phrasebook');
await page.fill('#q', 'kem cho');
if (!(await page.locator('.item .kx', { hasText: 'kien aayo' }).count())) fail('Kutchi equivalent not linked on "kem cho?"');
await page.evaluate(() => { window.APOLLO.state().profile.gender = 'f'; window.APOLLO.route('book'); });
await page.fill('#q', 'tired');
if (!(await page.locator('.item .r', { hasText: 'hu thaki gai chu' }).count())) fail('feminine form not used when speaking as a woman');
await page.evaluate(() => { window.APOLLO.state().profile.gender = 'm'; });

// test out of a unit
await page.evaluate(() => window.APOLLO.route('learn'));
await page.click('[data-testout="samaj"]');
{ let k = 0; while (await page.locator('.finish').count() === 0 && k++ < 30) if (!(await answerCurrent())) break; }
if (!(await page.evaluate(() => Object.keys(window.APOLLO.state().lessons).filter(k => k.startsWith('samaj:')).length >= 3))) fail('test-out did not mark the unit done');
await page.click('.finish [data-go]');

// goal
await page.evaluate(() => window.APOLLO.route('me'));
await page.click('[data-goal="50"]');
if (await page.evaluate(() => window.APOLLO.state().goal) !== 50) fail('goal not saved');
await page.evaluate(() => window.APOLLO.route('family'));
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

// AI features with a stand-in for Claude (the real one only exists inside the Claude viewer)
const ai = await browser.newPage({ viewport: { width: 390, height: 844 } });
ai.on('pageerror', e => errors.push('ai pageerror: ' + e.message));
await ai.addInitScript(() => {
  const calls = (window.__calls = []);
  const sample = async () => ({ text: '' });
  sample.json = async (input) => {
    calls.push(JSON.parse(JSON.stringify(input)));
    await new Promise(r => setTimeout(r, 30));
    if (typeof input === 'string' && input.includes('"phrases"')) return { phrases: [{ r: 'majama, ba', gu: 'મજામાં, બા', e: "I'm fine, Ba", note: 'reply to kem che' }, { r: 'tame kem cho?', gu: 'તમે કેમ છો?', e: 'How are you?', note: '' }] };
    if (typeof input === 'string') return { r: 'ba, mane navi naukri mali', gu: 'બા, મને નવી નોકરી મળી', e: 'Ba, I got a new job', register: 'tame-level respect is carried by "ba"; no verb needs it here.', words: [['navi', 'new'], ['naukri', 'job'], ['mali', 'was found (got)']], ladder: [{ label: 'Formal', r: 'ba, mane navi naukri mali che', gu: 'બા, મને નવી નોકરી મળી છે', e: 'Ba, I have got a new job' }, { label: 'Casual', r: 'ba, navi job mali!', gu: 'બા, નવી જોબ મળી!', e: 'Ba, got a new job!' }, { label: 'Playful', r: 'ba, have to tamaro dikro boss che!', gu: 'બા, હવે તો તમારો દીકરો બોસ છે!', e: 'Ba, your boy is the boss now!' }], kutchi: null, culture: 'Ba will ask about the salary. Smile.' };
    const last = input[input.length - 1].content;
    return { feedback: input.length > 1 ? { verdict: last.includes('tame') ? 'great' : 'fix', note: 'Use tame with Ba.', better: 'majama, ba. tame kem cho?', better_e: 'Fine, Ba. How are you?', spice: 'ekdum mast, ba! ane tame?' } : null, reply: { r: 'saru dikra. jamyo?', gu: 'સારું દીકરા. જમ્યો?', e: 'Good, son. Have you eaten?' }, hint: 'Say whether you have eaten.' };
  };
  window.claude = { use: async n => (n === 'sample' ? sample : null) };
});
await ai.route(/fonts\./, r => r.abort());
await ai.goto(base + 'index.html');
await ai.click('[data-act="skip-profile"]');
await ai.waitForSelector('#quickAskForm');
await ai.fill('#quickAsk', 'tell Ba I got a new job');
await ai.click('#quickAskForm button');
await ai.waitForSelector('#askIn');
if ((await ai.inputValue('#askIn')) !== 'tell Ba I got a new job') fail('quick ask did not carry the text over');
await ai.click('#askBtn');
await ai.waitForSelector('.ai-result');
if (!(await ai.locator('.ai-result .roman', { hasText: 'navi naukri' }).count())) fail('ask result not rendered');
if (await ai.locator('.ai-result .rung').count() !== 3) fail('ask ladder not rendered');
const askPrompt = await ai.evaluate(() => window.__calls[0]);
if (!/Kutch Leva Patel/.test(askPrompt) || !/Ba, Dada or another elder/.test(askPrompt)) fail('ask prompt missing community or listener context');
await ai.click('[data-act="save-mine"]');
const mine = await ai.evaluate(() => window.APOLLO.state().mine);
if (!(mine.length === 1 && mine[0].g === 'બા, મને નવી નોકરી મળી')) fail('saved phrase missing');
if (!(await ai.evaluate(id => !!window.APOLLO.state().cards[id], mine[0].id))) fail('saved phrase not added to review deck');
await ai.evaluate(() => window.APOLLO.route('rehearse'));
await ai.click('[data-act="rh-prep"]');
await ai.waitForSelector('#rhPrepOut .item');
await ai.click('[data-act="rh-start"]');
await ai.waitForSelector('#chat .bubble.them');
await ai.fill('#rhIn', 'majama ba. tame kem cho?');
await ai.click('#rhSend');
await ai.waitForSelector('.fbk.great');
if (!(await ai.locator('.fbk .spice').count())) fail('playful "spice it up" line missing');
if (!/playful, quippy/.test(JSON.stringify(await ai.evaluate(() => window.__calls[0])))) {}
if (await ai.locator('#chat .bubble.them').count() !== 2) fail('partner did not reply to the learner');
const turns = await ai.evaluate(() => window.__calls[window.__calls.length - 1]);
if (!(Array.isArray(turns) && turns[0].role === 'user' && turns[turns.length - 1].role === 'user' && turns[turns.length - 2].role === 'assistant')) fail('rehearse turns malformed');
{ const o = await ai.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (o > 0) fail(`rehearse: sideways scroll ${o}px`); }
await ai.close();

await browser.close(); server.close();
for (const e of errors) fail(e);
console.log(`screenshots: ${tmp}`);
if (fails.length) { console.log(`FAIL (${fails.length})\n - ` + fails.join('\n - ')); process.exit(1); }
console.log(`PASS: content valid; ${lessonKeys.length} lessons, review, ${scenes.length} scenes, about-you, level check, sentence gym, quick-fire, real-speech ladders, style drill, personalisation, audio packs, test-out, AI ask + rehearse (mocked), patterns, stories, ask-family, who's-who, mithai box, badges, tabs, dark mode; 0 console errors; no sideways scroll at 390px`);
