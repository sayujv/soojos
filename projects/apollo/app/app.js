/* Apollo — app logic. Plain JS, no framework. */
(function () {
  'use strict';
  const D = window.APOLLO_DATA;
  const G = window.APOLLO_GRAMMAR || { patterns: [], stories: [] };
  const byId = Object.fromEntries(D.phrases.map(p => [p.id, p]));
  // Pattern rows and story lines become phrase-like items so the exercise engine and audio can use them.
  const CORE_META = { kind: 'standard', conf: 'unsourced', src: 'apollo:standard-core', date: '2026-11-05' };
  G.patterns.forEach(pt => { pt.items = pt.rows.map(([r, g, e], i) => (byId['pat-' + pt.id + '-' + i] = Object.assign({ id: 'pat-' + pt.id + '-' + i, unit: 'learner', r, g, e }, CORE_META, pt.dialect ? { kind: 'kutchi' } : {}))); });
  G.stories.forEach(st => { st.items = st.lines.map((l, i) => (byId['sty-' + st.id + '-' + i] = Object.assign({ id: 'sty-' + st.id + '-' + i, unit: 'samaj', r: l.r, g: l.g, e: l.e }, CORE_META))); });
  const SP = window.APOLLO_SPEECH || { ladders: [], reductions: [], gym: [], level: null };
  SP.ladders.forEach(ld => { ld.items = ld.rungs.map((rg, i) => (byId['lad-' + ld.id + '-' + i] = { id: 'lad-' + ld.id + '-' + i, unit: 'flow', r: rg.r, g: rg.g, e: ld.e + ' (' + rg.l.toLowerCase() + ')', kind: rg.l === 'Kutchi' ? 'kutchi' : 'colloquial', conf: rg.conf || 'unsourced', src: rg.src || 'apollo:standard-core', date: '2026-11-05', note: rg.n || '' })); });
  SP.gym.forEach(([c, g, e, traps, fem], i) => { byId['gym-' + i] = Object.assign({ id: 'gym-' + i, unit: 'flow', r: c.split(' | ').join(' '), g, e, chunks: c.split(' | '), traps }, CORE_META, fem ? { f: { r: fem[0].split(' | ').join(' '), g: fem[1], chunks: fem[0].split(' | '), traps: fem[2] } } : {}); });
  // "Formal or casual?" drill, generated from the ladders: elders get the formal rung, cousins the casual one.
  (function () {
    const steps = []; let n = 0;
    for (const ld of SP.ladders) {
      const formal = ld.rungs.find(x => x.l === 'Formal') || ld.rungs.find(x => x.l === 'Everyday');
      const casual = ld.rungs.find(x => x.l === 'Casual') || ld.rungs.find(x => x.l === 'Playful');
      if (!formal || !casual || formal === casual || n >= 12) continue;
      const toElder = n % 2 === 0; n++;
      steps.push({ cue: toElder ? `Say "${ld.e}" to Kaka, at a family function.` : `Say "${ld.e}" to your cousin, quickly.` });
      steps.push({ reply: toElder
        ? [{ r: formal.r, e: 'the respectful form', ok: true }, { r: casual.r, e: 'the clipped form', why: 'Too casual for Kaka. Save the short form for cousins and friends.' }]
        : [{ r: casual.r, e: 'the clipped form', ok: true }, { r: formal.r, e: 'the formal form', why: 'Correct, but stiff. With a cousin the short form sounds natural.' }] });
    }
    if (steps.length) D.scenes.push({ id: 'drill-style', title: 'Drill: formal or casual?', who: 'Drill', where: 'Same sentence, different person. Pick the version that fits.', drill: true, steps });
  })();
  const LESSON_SIZE = 5;
  const BOX_DAYS = [0, 1, 3, 7, 14, 30, 60];
  const MAX_BOX = BOX_DAYS.length - 1;
  const $view = document.getElementById('view');
  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── icons ──────────────────────────────────────────────
  const I = {
    flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#FF8A1F" d="M12 1.5c1.2 4.2 6.5 6.3 6.5 12.5a6.5 6.5 0 0 1-13 0c0-3.2 2-5.4 3.3-6.4 0 2.1 1 3.3 2.2 3.4C11 6.8 9.8 4.6 12 1.5z"/><path fill="#FFD35A" d="M12 12c1 2 3.3 3 3.3 5.3a3.3 3.3 0 0 1-6.6 0c0-2.2 2.2-3.2 3.3-5.3z"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#FFD35A" d="M13.5 1.5 4 14h7l-1.5 8.5L20 10h-7z"/></svg>',
    speaker: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>',
    turtle: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.5 15.5c0-4.2 3.2-7.5 7.5-7.5s7.5 3.3 7.5 7.5zm15.7-2.2h1.3a2 2 0 0 0 0-4h-1.6c.2.6.3 1.2.3 1.8zM5.5 16.5h3.2v3H5.5zm7.8 0h3.2v3h-3.2z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
    star: c => `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="${c}" d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z"/></svg>`,
    gift: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.5 11h17v10h-17zM2.5 7h19v3.2h-19zm8.3 0h2.4v14h-2.4zM8.2 2.8c2 0 3.8 4.2 3.8 4.2s-3.3.6-4.8-.3S6.2 2.8 8.2 2.8zm7.6 0c2 0 2 2.9.9 3.9S12 7 12 7s1.8-4.2 3.8-4.2z"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.8 2 11h3v9.5h5V15h4v5.5h5V11h3z"/></svg>',
    talk: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 4.5A1.5 1.5 0 0 1 4.5 3h15A1.5 1.5 0 0 1 21 4.5v10a1.5 1.5 0 0 1-1.5 1.5H9l-5 4.5V16h-.5A1.5 1.5 0 0 1 3 14.5zM7 8.5h10v2H7z"/></svg>',
    review: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 3.5v5h-5"/></svg>',
    family: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="8" cy="7" r="3.3"/><circle cx="17" cy="9" r="2.7"/><path d="M1.8 20.5c0-4.2 2.9-7.3 6.2-7.3s6.2 3.1 6.2 7.3zm12.9 0c0-2.6-.8-4.7-2.1-6.1 1.3-.8 2.8-1 4.5-.6 2.7.7 4.1 3.3 4.1 6.7z"/></svg>',
    me: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="8" r="4.3"/><path d="M3.5 21.5c0-4.8 3.8-8.2 8.5-8.2s8.5 3.4 8.5 8.2z"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 2.5h10v2h4V8a5 5 0 0 1-5 5h-.3A5 5 0 0 1 13 15.9V18h3v3.5H8V18h3v-2.1A5 5 0 0 1 8.3 13H8a5 5 0 0 1-5-5V4.5h4zm10 4.2v4a3 3 0 0 0 2-2.8V6.7zM5 6.7v1.2a3 3 0 0 0 2 2.8v-4z"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 10V8a5 5 0 0 1 10 0v2h1.5v11h-13V10zm2.2 0h5.6V8a2.8 2.8 0 0 0-5.6 0z"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 3.5h7v17H5.5A1.5 1.5 0 0 1 4 19zm9 0h7V19a1.5 1.5 0 0 1-1.5 1.5H13z"/></svg>',
    target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>',
    leaf: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 3.5C9 3.5 4 8.5 4 15.5c0 1.5.3 3 .9 4.3 1.2-4.3 4-7.6 8.1-9.3-3.4 2.3-5.6 5.6-6.4 9.8 1.2.5 2.6.7 4 .7 6.9 0 9.9-6 9.4-17.5z"/></svg>',
    map: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.3 7 13 7 13s7-7.7 7-13a7 7 0 0 0-7-7zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2z"/></svg>'
  };

  // ── utilities ──────────────────────────────────────────
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const today = () => iso(new Date());
  const addDays = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); };
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const h = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content; };
  const norm = s => s.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
  const unitPhrases = uid => D.phrases.filter(p => p.unit === uid);
  const lessonsOf = uid => { const ps = unitPhrases(uid), out = []; for (let i = 0; i < ps.length; i += LESSON_SIZE) out.push(ps.slice(i, i + LESSON_SIZE)); return out; };
  const unitColor = uid => `var(--u-${uid})`;
  const ring = (pct, size, sw, color, inner) => {
    const r = (size - sw) / 2, c = 2 * Math.PI * r;
    return `<svg class="ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(127,127,127,.25)" stroke-width="${sw}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${c * Math.min(1, pct)} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/>${inner || ''}</svg>`;
  };

  // ── state (localStorage now, artifact db when available) ───
  const KEY = 'apollo.v1';
  const blank = () => ({ xp: 0, streak: 0, lastDay: '', days: [], day: { date: today(), xp: 0 }, cards: {}, lessons: {}, scenes: {}, chests: {}, patterns: {}, stories: {}, verdicts: {}, badges: {}, bestCombo: 0, perfect: 0, profile: null, goal: 30, mine: [], speakFirst: true, level: null, levelHistory: [], recallLog: [], ladderFamily: {}, gymCount: 0, updated: 0 });
  const migrate = s => {
    s = Object.assign(blank(), s);
    for (const k of Object.keys(s.scenes)) if (s.scenes[k] === true) s.scenes[k] = 1;
    if (s.day.date !== today()) s.day = { date: today(), xp: 0 };
    return s;
  };
  let S = blank();
  const goal = () => S.goal || 30;
  try { const raw = localStorage.getItem(KEY); if (raw) S = migrate(JSON.parse(raw)); } catch (e) { /* storage blocked */ }

  const registerMine = () => (S.mine || []).forEach(m => { byId[m.id] = Object.assign({ unit: 'mine', kind: 'standard', conf: 'claimed', src: 'apollo:ai', date: m.at || today() }, m); });
  registerMine();
  let docRef = null, saveTimer = null;
  function save() {
    S.updated = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
    if (docRef) { clearTimeout(saveTimer); saveTimer = setTimeout(() => docRef.set(JSON.parse(JSON.stringify(S))).catch(() => {}), 1200); }
  }
  (async function connect() {
    try {
      if (!window.claude || !window.claude.use) return;
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!db || !user) return;
      const uid = await user.id();
      if (!uid) return;
      docRef = db.doc('progress/' + uid);
      const snap = await docRef.get();
      const remote = snap && (snap.data ? snap.data() : snap);
      if (remote && remote.updated > S.updated) { S = migrate(remote); registerMine(); if (!run && !scene) route(current); paintBar(); }
      else save();
    } catch (e) { /* stay local */ }
  })();

  // ── game systems ───────────────────────────────────────
  const LEVEL_TITLES = ['Newcomer', 'Listener', 'Chatterbox', 'Table talker', 'Phone pro', 'Family favourite', 'Gaam regular', 'Ujamni star', 'Kaka-approved', "Ba's pride"];
  const xpFor = n => 25 * (n - 1) * n;
  const levelOf = xp => { let n = 1; while (xpFor(n + 1) <= xp) n++; return n; };
  const titleOf = n => LEVEL_TITLES[Math.min(n - 1, LEVEL_TITLES.length - 1)];
  const BADGES = [
    { id: 'first', name: 'First steps', desc: 'Finish a lesson', icon: 'check', c: '--u-greet', test: s => Object.keys(s.lessons).length >= 1 },
    { id: 'streak3', name: 'On a roll', desc: '3-day streak', icon: 'flame', c: '--u-food', test: s => s.streak >= 3 },
    { id: 'streak7', name: 'Week strong', desc: '7-day streak', icon: 'flame', c: '--u-family', test: s => s.streak >= 7 },
    { id: 'talk', name: 'Talker', desc: 'Finish a conversation', icon: 'talk', c: '--u-call', test: s => Object.keys(s.scenes).length >= 1 },
    { id: 'stars3', name: 'Smooth talker', desc: '3 stars in a conversation', icon: 'star', c: '--u-feel', test: s => Object.values(s.scenes).some(v => v >= 3) },
    { id: 'perfect', name: 'Flawless', desc: 'A lesson with no mistakes', icon: 'target', c: '--u-daily', test: s => s.perfect >= 1 },
    { id: 'combo10', name: 'Hot streak', desc: '10 right in a row', icon: 'bolt', c: '--u-food', test: s => s.bestCombo >= 10 },
    { id: 'p50', name: 'Fifty phrases', desc: 'Know 50 phrases', icon: 'book', c: '--u-greet', test: s => Object.keys(s.cards).length >= 50 },
    { id: 'kutchi', name: 'Kutchi flavour', desc: 'Finish a Kutchi lesson', icon: 'map', c: '--u-kutch', test: s => Object.keys(s.lessons).some(k => k.startsWith('kutch:')) },
    { id: 'family5', name: 'Family approved', desc: 'Check 5 phrases with family', icon: 'family', c: '--u-family', test: s => Object.keys(s.verdicts).length >= 5 },
    { id: 'mithai', name: 'Sweet tooth', desc: 'Open a mithai box', icon: 'gift', c: '--u-food', test: s => Object.keys(s.chests).length >= 1 },
    { id: 'grammar', name: 'Grammar geek', desc: 'Practise 5 patterns', icon: 'book', c: '--u-learner', test: s => Object.keys(s.patterns || {}).length >= 5 },
    { id: 'stories', name: 'Story time', desc: 'Finish 3 stories', icon: 'talk', c: '--u-samaj', test: s => Object.keys(s.stories || {}).length >= 3 },
    { id: 'rehearse', name: 'Brave talker', desc: 'Rehearse 3 conversations', icon: 'talk', c: '--u-family', test: s => (s.rehearsals || 0) >= 3 },
    { id: 'mine', name: 'My own words', desc: 'Save 5 of your own phrases', icon: 'book', c: '--u-kin2', test: s => (s.mine || []).length >= 5 },
    { id: 'gym', name: 'Gym regular', desc: 'Do 5 sentence gym sessions', icon: 'bolt', c: '--u-flow', test: s => (s.gymCount || 0) >= 5 },
    { id: 'quickdraw', name: 'Quick on the draw', desc: 'Median recall under 3 seconds', icon: 'flame', c: '--u-wit', test: s => (s.recallLog || []).some(z => z.median && z.median < 3000 && z.n >= 6) },
    { id: 'bigday', name: 'Big day', desc: 'Earn 60 XP in one day', icon: 'trophy', c: '--u-feel', test: s => s.day.xp >= 60 }
  ];
  const icon = (name, cls) => name === 'star' ? I.star(cls || 'star-on') : I[name];
  const medal = (b, locked) => `<div class="medal" style="--c:var(${b.c})">${locked ? I.lock : icon(b.id === 'stars3' ? 'star' : b.icon, 'star-on')}</div>`;
  function checkBadges() {
    const fresh = [];
    for (const b of BADGES) if (!S.badges[b.id] && b.test(S)) { S.badges[b.id] = today(); fresh.push(b); }
    if (fresh.length) save();
    return fresh;
  }

  function award(n) {
    const t = today();
    if (S.lastDay !== t) { S.streak = S.lastDay === addDays(t, -1) ? S.streak + 1 : 1; S.lastDay = t; }
    if (!S.days.includes(t)) S.days = [...S.days, t].slice(-60);
    const before = levelOf(S.xp);
    S.xp += n; S.day.xp += n; save(); paintBar();
    return levelOf(S.xp) > before;
  }
  const liveStreak = () => (S.lastDay === today() || S.lastDay === addDays(today(), -1)) ? S.streak : 0;
  function paintBar() {
    const sp = document.getElementById('streakPill');
    sp.innerHTML = I.flame + liveStreak(); sp.classList.toggle('cold', S.lastDay !== today());
    sp.setAttribute('aria-label', liveStreak() + ' day streak');
    document.getElementById('xpPill').innerHTML = I.bolt + '<span id="xp">' + S.xp + '</span>';
    const g = document.getElementById('goalPill');
    g.innerHTML = ring(S.day.xp / goal(), 26, 4, '#FFD35A') + '<span>' + Math.min(S.day.xp, goal()) + '/' + goal() + '</span>';
    g.setAttribute('aria-label', `Today ${S.day.xp} of ${goal()} XP`);
  }

  function learn(id) { if (!S.cards[id]) S.cards[id] = { box: 1, due: addDays(today(), 1), seen: 1 }; }
  function grade(id, ok) {
    const c = S.cards[id] || (S.cards[id] = { box: 0, due: today(), seen: 0 });
    c.seen++; c.box = ok ? Math.min(c.box + 1, MAX_BOX) : 1;
    c.due = addDays(today(), ok ? BOX_DAYS[c.box] : 0);
  }
  const dueCards = () => Object.keys(S.cards).filter(id => byId[id] && S.cards[id].due <= today());

  // ── personalisation ────────────────────────────────────
  const prof = () => S.profile || {};
  const cap = w => String(w || '').trim().replace(/^./, c => c.toUpperCase());
  function personal(str) {
    const pr = prof(); let o = String(str);
    if (pr.father) o = o.replace(/Rameshbhai/g, cap(pr.father) + 'bhai');
    if (pr.name) o = o.replace(/Sayuj/g, cap(pr.name));
    if (pr.gaam) o = o.replace(/amaru gaam Kutch ma che/g, 'amaru gaam ' + cap(pr.gaam) + ' che');
    return o;
  }
  // The learner's own version of a phrase: gendered form, then names and gaam.
  function view(p) {
    const base = prof().gender === 'f' && p.f ? Object.assign({}, p, p.f) : p;
    const r = personal(base.r), e = personal(base.e);
    return Object.assign({}, base, { r, e, personalised: r !== base.r });
  }
  // Kutchi equivalents, from the sourced kutch unit's "std" field.
  const KUTCHI = {};
  D.phrases.filter(p => p.unit === 'kutch' && p.std).forEach(k => k.std.split(' / ').forEach(sd => { KUTCHI[norm(sd)] = k; }));
  const kutchiOf = p => p.unit !== 'kutch' && p.unit !== 'mine' ? KUTCHI[norm(p.r)] : null;
  const kutchiLine = p => { const k = kutchiOf(p); return k ? `<p class="kx"><span class="tag dialect">Kutchi</span> <b>${esc(k.r)}</b> <button class="hear" data-say="${k.id}" aria-label="Play Kutchi">▶</button> <span class="muted">from public Kutchi sources, ${esc(k.conf)}</span></p>` : ''; };

  // ── audio: pre-rendered Gujarati clips (eSpeak NG), loaded in the background ──
  const AUDIO = { map: null, clips: {} };
  (async () => {
    try {
      const idx = await (await fetch('audio/index.json')).json();
      AUDIO.map = idx.map;
      await Promise.all(idx.packs.map(pk => fetch('audio/' + pk).then(r => r.json()).then(o => Object.assign(AUDIO.clips, o)).catch(() => {})));
    } catch (e) { /* no packs: fall back to device speech */ }
  })();
  let clip = null;
  function playClip(g) {
    const hsh = AUDIO.map && AUDIO.map[g], b64 = hsh && AUDIO.clips[hsh];
    if (!b64) return false;
    try { if (clip) clip.pause(); clip = new Audio('data:audio/mpeg;base64,' + b64); clip.playbackRate = slow ? 0.75 : 1; clip.play().catch(() => {}); return true; } catch (e) { return false; }
  }

  // ── speech ─────────────────────────────────────────────
  const synth = window.speechSynthesis;
  let voices = [];
  const pickVoices = () => { try { voices = synth ? synth.getVoices() : []; } catch (e) { voices = []; } };
  if (synth) { pickVoices(); synth.onvoiceschanged = pickVoices; }
  const guVoice = () => voices.find(v => /^gu/i.test(v.lang));
  const fallbackVoice = () => voices.find(v => /en[-_]IN/i.test(v.lang)) || voices.find(v => /^en/i.test(v.lang));
  let slow = false;
  function speak(g, r, personalised) {
    if (!personalised && playClip(g)) return;
    if (!synth) return;
    try {
      synth.cancel();
      const gv = guVoice();
      const u = new SpeechSynthesisUtterance(gv ? g : r.replace(/\?/g, ''));
      const v = gv || fallbackVoice(); if (v) { u.voice = v; u.lang = v.lang; }
      u.rate = slow ? 0.6 : 0.9;
      synth.speak(u);
    } catch (e) { /* no speech */ }
  }
  const speakItem = p => { const v = view(p); speak(v.g, v.r, v.personalised); };
  const voiceNote = () => (AUDIO.map || guVoice()) ? '' :
    '<p class="voice-warn">This device has no Gujarati voice, so audio reads the English spelling in an Indian-English voice. Treat it as a rough guide.</p>';

  // ── sound, haptics, confetti ───────────────────────────
  let ac = null;
  function tone(freqs, type, vol, len) {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = ac.currentTime;
      freqs.forEach((f, i) => {
        const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.connect(g); g.connect(ac.destination);
        const t = t0 + i * len; o.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .015); g.gain.exponentialRampToValueAtTime(.0001, t + len + .12);
        o.start(t); o.stop(t + len + .15);
      });
    } catch (e) { /* no audio */ }
  }
  const sfx = {
    right: combo => tone([523 * Math.pow(1.06, Math.min(combo, 10)), 784 * Math.pow(1.06, Math.min(combo, 10))], 'sine', .14, .08),
    wrong: () => { tone([196, 165], 'triangle', .12, .1); try { navigator.vibrate && navigator.vibrate(60); } catch (e) { /* */ } },
    fanfare: () => tone([523, 659, 784, 1047], 'triangle', .12, .1)
  };
  const cv = document.getElementById('confetti');
  function confetti(n) {
    if (reduceMotion || !cv.getContext) return;
    const ctx = cv.getContext('2d'), dpr = window.devicePixelRatio || 1;
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; ctx.scale(dpr, dpr);
    const cols = ['#E4A11B', '#B8312A', '#2A3990', '#2E7D4F', '#F27B6F', '#FFD35A'];
    const ps = Array.from({ length: n || 140 }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 80, y: innerHeight * .35, vx: (Math.random() - .5) * 13, vy: -Math.random() * 13 - 4, s: 5 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: cols[Math.floor(Math.random() * cols.length)], round: Math.random() < .35 }));
    let f = 0;
    (function tick() {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of ps) {
        p.vy += .35; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
        if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.s / 2, 0, 7); ctx.fill(); } else ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      }
      if (++f < 110) requestAnimationFrame(tick); else ctx.clearRect(0, 0, innerWidth, innerHeight);
    })();
  }
  function toast(msg) {
    const t = h(`<div class="toast" role="status">${msg}</div>`).firstChild;
    document.body.append(t); setTimeout(() => t.remove(), 2600);
  }
  function xpPop(n, el) {
    const r = el ? el.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0 };
    const p = h(`<div class="xp-pop">+${n} XP</div>`).firstChild;
    p.style.left = (r.left + r.width / 2 - 30) + 'px'; p.style.top = (r.top - 10) + 'px';
    document.body.append(p); setTimeout(() => p.remove(), 950);
  }
  function celebrate(fresh, levelUp) {
    fresh.forEach((b, i) => setTimeout(() => toast(`Badge unlocked: <b>${esc(b.name)}</b>`), 300 + i * 900));
    if (levelUp) setTimeout(() => toast(`Level ${levelOf(S.xp)}: <b>${esc(titleOf(levelOf(S.xp)))}</b>`), 200);
  }

  // ── badges & source ────────────────────────────────────
  const KIND_LABEL = { standard: 'Standard', colloquial: 'Casual', gujlish: 'Gujlish', sklpc: 'SKLPC', kutchi: 'Kutchi', 'swahili-loan': 'Swahili loan' };
  const tag = p => `<span class="tag ${['standard', 'colloquial', 'gujlish'].includes(p.kind) ? (p.kind === 'standard' ? '' : 'casual') : 'dialect'}">${KIND_LABEL[p.kind] || p.kind}</span>`;
  function srcLine(p) {
    if (p.src === 'apollo:standard-core') return '<p class="src">Standard Gujarati · not yet checked by family</p>';
    if (p.src === 'apollo:ai') return `<p class="src">Your phrase · made with Claude for ${esc(p.to || 'you')} · not yet checked by family</p>`;
    return `<p class="src">${esc(p.conf)} · <a href="${esc(p.src)}" target="_blank" rel="noopener">source</a> · ${esc(p.date)}${p.std ? ' · standard: <em>' + esc(p.std) + '</em>' : ''}</p>`;
  }

  // ── tabs & routing ─────────────────────────────────────
  const TABS = [['learn', 'Learn', 'home'], ['talk', 'Talk', 'talk'], ['review', 'Review', 'review'], ['family', 'Family', 'family'], ['me', 'Me', 'me']];
  let current = 'learn';
  function paintTabs() {
    const due = dueCards().length;
    document.getElementById('tabs').replaceChildren(h(TABS.map(([id, label, ic]) =>
      `<button class="tab" data-go="${id}" ${(current === id || (current === 'book' && id === 'me') || (current === 'guide' && id === 'family') || (current === 'patterns' && id === 'learn') || ((current === 'ask' || current === 'rehearse') && id === 'talk') || (current === 'profile' && id === 'me') || (current === 'levelres' && id === 'me') || (current === 'speech' && id === 'learn')) ? 'aria-current="page"' : ''}>${I[ic]}${label}${id === 'review' && due ? `<span class="dot">${due}</span>` : ''}</button>`).join('')));
  }
  function setFocus(on) { document.body.classList.toggle('focus', on); document.querySelector('main').classList.toggle('focus', on); }
  function route(to) {
    try { synth && synth.cancel(); } catch (e) { /* */ }
    run = null; scene = null; setFocus(false);
    story = null;
    if (chat && chat.ctl) chat.ctl.abort(); chat = null;
    current = ['learn', 'talk', 'review', 'family', 'guide', 'me', 'book', 'patterns', 'ask', 'rehearse', 'profile', 'levelres', 'speech'].includes(to) ? to : 'learn';
    try { if (location.hash.slice(1) !== current) history.replaceState(null, '', '#' + current); } catch (e) { /* */ }
    ({ learn: viewLearn, talk: viewTalk, review: viewReview, family: () => viewBook(true), guide: viewGuide, patterns: viewPatterns, me: viewMe, ask: viewAsk, rehearse: viewRehearse, profile: viewProfile, levelres: viewLevel, speech: viewSpeech, book: () => viewBook(false) })[current]();
    paintTabs(); paintBar(); window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', () => { const t = location.hash.slice(1); if (t && t !== current && !run && !scene) route(t); });

  // ── Learn tab ──────────────────────────────────────────
  const OFF = [0, 52, 78, 52, 0, -52, -78, -52];
  function phraseOfDay() {
    const known = Object.keys(S.cards).map(id => byId[id]).filter(Boolean);
    const pool = known.length ? known : D.phrases.filter(p => p.unit === 'greet');
    const n = [...today()].reduce((a, c) => a + c.charCodeAt(0), 0);
    return pool[n % pool.length];
  }
  function nextLessonKey() {
    for (const u of D.units) { const ls = lessonsOf(u.id); for (let i = 0; i < ls.length; i++) if (!S.lessons[u.id + ':' + i]) return { key: u.id + ':' + i, u, i }; }
    return null;
  }
  function viewLearn() {
    if (!S.profile && !S.profileSkipped) return viewProfile(true);
    const pod = phraseOfDay();
    const nx = nextLessonKey();
    const due = dueCards().length;
    const lessonsDone = Object.keys(S.lessons).length;
    const status = !lessonsDone ? "Tap the glowing circle to start your first lesson." :
      due ? `${due} phrase${due === 1 ? '' : 's'} ready to review. Keep them fresh.` :
      S.day.xp >= goal() ? 'Daily goal done. Shabash!' : `${goal() - S.day.xp} XP to today's goal.`;
    const days = Array.from({ length: 7 }, (_, i) => addDays(today(), i - 6));
    const week = days.map(d => `<i class="${S.days.includes(d) ? 'on' : ''} ${d === today() ? 'now' : ''}" title="${d}">${'SMTWTFS'[new Date(d + 'T00:00:00').getDay()]}</i>`).join('');
    let firstNext = true, idx = 0;
    const stops = D.units.map((u, ui) => {
      const ls = lessonsOf(u.id);
      const doneN = ls.filter((_, i) => S.lessons[u.id + ':' + i]).length;
      const nodes = ls.map((_, i) => {
        const done = S.lessons[u.id + ':' + i];
        const next = !done && firstNext; if (next) firstNext = false;
        const x = OFF[idx++ % OFF.length];
        return `<button class="node ${done ? 'done' : ''} ${next ? 'next' : ''}" style="--x:${x}px;--c:${unitColor(u.id)}" data-lesson="${u.id}:${i}" aria-label="${esc(u.title)} lesson ${i + 1}${done ? ', done' : ''}">${next ? '<span class="start">START</span>' : ''}${done ? I.check : i + 1}</button>`;
      }).join('');
      const allDone = ls.length && doneN === ls.length;
      const opened = S.chests[u.id];
      const cx = OFF[idx++ % OFF.length];
      const chest = ls.length ? `<button class="node chest ${opened ? 'opened' : allDone ? 'ready' : ''}" style="--x:${cx}px" data-chest="${u.id}" aria-label="Mithai box${opened ? ', opened' : allDone ? ', ready to open' : ', locked until the unit is done'}">${I.gift}</button>` : '';
      return `<section class="stop">
        <div class="banner" style="background:${unitColor(u.id)}">
          <span class="eyebrow">Stop ${ui + 1}</span><h3>${esc(u.title)}</h3><p>${esc(u.blurb)}</p>
          ${u.id === 'kutch' ? '<span class="tag onband">Dialect · from public sources</span>' : ''}
          <span class="count">${doneN}/${ls.length}</span>
          ${doneN < ls.length && u.id !== 'kutch' ? `<button class="testout" data-testout="${u.id}">Already know this? Test out</button>` : ''}
        </div>
        <div class="path">${nodes}${chest}</div>
      </section>`;
    }).join('');
    $view.replaceChildren(h(`
      <div class="guide">
        <div class="avatar" aria-hidden="true">બા<span>Ba</span></div>
        <button class="speech" data-say="${pod.id}" aria-label="Phrase of the day: ${esc(pod.r)}. Tap to hear.">
          <span class="eyebrow">Phrase of the day · tap to hear</span>
          <b>“${esc(pod.r)}”</b><small>${esc(pod.e)}</small>
        </button>
      </div>
      ${nx ? `<button class="primary go cta" data-lesson="${nx.key}">Continue: ${esc(nx.u.title)} · lesson ${nx.i + 1}</button>` : ''}
      ${sampler ? `<form class="quickask" id="quickAskForm"><input id="quickAsk" type="text" placeholder="How do I say…? e.g. tell Ba I got a new job" aria-label="How do I say"><button class="primary" type="submit">Ask</button></form>` : ''}
      <div class="today">
        ${ring(S.day.xp / goal(), 64, 8, 'var(--turmeric)', `<text x="32" y="37" text-anchor="middle" font-family="Baloo Bhai 2, sans-serif" font-weight="800" font-size="15" fill="currentColor">${Math.min(100, Math.round(100 * S.day.xp / goal()))}%</text>`)}
        <div><h3>${esc(status)}</h3><div class="week" aria-label="This week">${week}</div></div>
      </div>
      ${S.level ? `<div class="card plan-card"><div class="row" style="justify-content:space-between"><span class="eyebrow">Your plan</span><button class="chip" data-go="levelres">Details</button></div>${levelBars(S.level)}
        <div class="pair"><button class="primary go" data-act="gym-start">Sentence gym</button><button class="primary" data-act="quick-start">Quick-fire</button></div></div>`
      : `<div class="card plan-card"><span class="eyebrow">5 minutes</span><h3>Find your level</h3><p class="muted">Words, sentences, sentence-building, tu/tame and recall speed, measured separately. If you already know the words, you skip the basics and go straight to conversation.</p><button class="primary go" data-act="level-start">Find my level</button></div>`}
      <button class="card how" data-go="speech" style="border-left-color:var(--u-wit)">
        <span class="eyebrow">Real speech</span>
        <span class="row" style="justify-content:space-between;width:100%"><h3>How it's really said</h3><span class="tag casual">${SP.ladders.length} sentences</span></span>
        <span class="muted">Formal → everyday → clipped → Gujlish → Kutchi. "su kare?", "kidhu tu ne!", "tension na le".</span>
      </button>
      <button class="card how" data-go="patterns">
        <span class="eyebrow">How Gujarati works</span>
        <span class="row" style="justify-content:space-between;width:100%"><h3>${G.patterns.length} patterns behind every sentence</h3><span class="tag">${Object.keys(S.patterns).length}/${G.patterns.length}</span></span>
        <span class="muted">tu vs tame endings, the "me" past, why it's "mane bhukh lagi"…</span>
      </button>
      ${stops}
      <p class="src">Phrases come from public sources wherever possible. "Standard" means textbook Gujarati your family hasn't checked yet. Use the Family tab to mark what they actually say.</p>
    `));
  }

  function openChest(uid, btn) {
    const ls = lessonsOf(uid);
    const allDone = ls.every((_, i) => S.lessons[uid + ':' + i]);
    if (S.chests[uid]) return toast('Already opened. Finish another unit for the next box.');
    if (!allDone) return toast('Finish every lesson in this stop to open its mithai box.');
    S.chests[uid] = today();
    const lv = award(25); sfx.fanfare(); confetti(160); xpPop(25, btn);
    toast('Mithai box opened: <b>+25 XP</b>');
    celebrate(checkBadges(), lv);
    setTimeout(() => route('learn'), 900);
  }

  // ── Talk tab ───────────────────────────────────────────
  const starsHtml = n => `<span class="stars" aria-label="${n} of 3 stars">${[1, 2, 3].map(i => I.star(i <= n ? 'star-on' : 'star-off')).join('')}</span>`;
  function viewTalk() {
    const COLORS = ['--u-food', '--u-call', '--u-kutch', '--u-family', '--u-daily', '--u-kin2', '--u-samaj', '--u-learner'];
    const list = arr => `<div class="list">${arr.map((s, i) => `<button class="scene-card" data-scene="${s.id}">
        <span class="art bandhani" style="background-color:var(${s.drill ? '--u-respect' : COLORS[i % COLORS.length]})">${s.drill ? '?' : esc(s.who[0])}</span>
        <span class="body"><h3>${esc(s.title)}</h3><span class="muted" style="font-size:14px">${esc(s.where)}</span>
        <span class="row">${starsHtml(S.scenes[s.id] || 0)}${s.dialect ? '<span class="tag dialect">Kutchi</span>' : ''}${s.drill ? `<span class="tag">${s.steps.filter(z => z.reply).length} calls</span>` : ''}</span></span>
      </button>`).join('')}</div>`;
    $view.replaceChildren(h(`
      <div><h2>Talk it through</h2><p class="muted">Real conversations. Pick what you'd say. Three stars means every reply was right first time.</p></div>
      ${voiceNote()}
      ${sampler ? `<div class="ai-cards">
        <button class="ai-card" data-go="rehearse"><span class="eyebrow">AI partner</span><h3>Rehearse a real conversation</h3><span class="muted">Ba, Kaka, Masi, a cousin, a samaj elder, a Bhuj shopkeeper. You type, they answer, and you're corrected on tu/tame and grammar.</span></button>
        <button class="ai-card" data-go="ask"><span class="eyebrow">Ask</span><h3>How do I say…?</h3><span class="muted">Anything you want to say, phrased right for who you're saying it to. Save it to your deck.</span></button>
      </div>` : `<p class="voice-warn">AI practice (role-play with corrections, and "How do I say…?") works when you open Apollo in the Claude app or claude.ai.</p>`}
      <h3>Listen in</h3><p class="muted" style="margin-top:-12px">Longer real-life dialogues. Tap any line for a word-by-word breakdown.</p>
      <div class="list">${G.stories.map((st, i) => `<button class="scene-card" data-story="${st.id}">
        <span class="art bandhani" style="background-color:var(${COLORS[(i + 3) % COLORS.length]})">${esc(st.title[0])}</span>
        <span class="body"><h3>${esc(st.title)}</h3><span class="muted" style="font-size:14px">${esc(st.cast)} · ${st.lines.length} lines</span>
        <span class="row"><span class="tag">${esc(st.level)}</span>${S.stories[st.id] ? '<span class="tag resp">Done</span>' : ''}</span></span>
      </button>`).join('')}</div>
      <h3>Drills</h3>${list(D.scenes.filter(s => s.drill))}
      <h3>Conversations</h3>${list(D.scenes.filter(s => !s.drill))}`));
  }

  // ── Review tab ─────────────────────────────────────────
  function viewReview() {
    const due = dueCards().length, known = Object.keys(S.cards).length;
    const bars = D.units.map(u => {
      const ids = unitPhrases(u.id).map(p => p.id).filter(id => S.cards[id]);
      const pct = ids.length ? Math.round(100 * ids.reduce((a, id) => a + S.cards[id].box, 0) / (ids.length * MAX_BOX)) : 0;
      return `<div class="sbar"><span>${esc(u.title)}</span><span class="meter"><i style="width:${pct}%;background:${unitColor(u.id)}"></i></span><span>${pct}%</span></div>`;
    }).join('');
    $view.replaceChildren(h(`
      <div><h2>Keep it fresh</h2><p class="muted">Phrases come back just before you'd forget them. Get one right and it waits longer next time.</p></div>
      <div class="card" style="justify-items:center;text-align:center">
        <div style="color:var(--indigo)">${ring(known ? 1 - due / Math.max(known, 1) : 0, 110, 12, 'var(--leaf)', `<text x="55" y="62" text-anchor="middle" font-family="Baloo Bhai 2, sans-serif" font-weight="800" font-size="28" fill="currentColor">${due}</text>`)}</div>
        <h3>${due ? `${due} phrase${due === 1 ? '' : 's'} due` : known ? 'All fresh' : 'Nothing to review yet'}</h3>
        <p class="muted">${due ? 'About ' + Math.max(1, Math.round(Math.min(due, 15) / 4)) + ' min. Review XP counts toward your goal.' : known ? 'Come back tomorrow, or do a lesson.' : 'Finish a lesson and its phrases will show up here.'}</p>
        <button class="primary go" data-act="start-review" ${due ? '' : 'disabled'}>Start review</button>
      </div>
      <div class="card"><h3>Memory strength</h3><div class="strength">${bars}</div></div>`));
  }

  // ── Me tab ─────────────────────────────────────────────
  function viewMe() {
    const lv = levelOf(S.xp), lo = xpFor(lv), hi = xpFor(lv + 1);
    const days = Array.from({ length: 7 }, (_, i) => addDays(today(), i - 6));
    $view.replaceChildren(h(`
      <div class="card level">
        <span class="eyebrow">Level ${lv}</span><h2>${esc(titleOf(lv))}</h2>
        <div class="lvl-meter"><i style="width:${Math.round(100 * (S.xp - lo) / (hi - lo))}%"></i></div>
        <p class="muted">${hi - S.xp} XP to level ${lv + 1}: ${esc(titleOf(lv + 1))}</p>
      </div>
      <div class="bigstats">
        <div class="bigstat"><b>${liveStreak()}</b><span>day streak</span></div>
        <div class="bigstat"><b>${S.xp}</b><span>total XP</span></div>
        <div class="bigstat"><b>${Object.keys(S.cards).length}</b><span>phrases known</span></div>
      </div>
      <div class="card"><div class="row" style="justify-content:space-between"><h3>Your level</h3><button class="chip" data-act="level-start">${S.level ? 'Retake' : 'Take it'}</button></div>${S.level ? levelBars(S.level) : '<p class="muted">Not measured yet.</p>'}</div>
      ${(S.recallLog || []).length ? `<div class="card"><h3>Recall speed</h3><p class="muted">Median time to say it, per session. Lower is better.</p><div class="spark">${S.recallLog.slice(-10).map(z => { const v = z.median ? Math.min(100, Math.round(z.median / 80)) : 0; return `<span title="${z.date}: ${z.median ? (z.median / 1000).toFixed(1) + ' s' : 'n/a'}"><i style="height:${Math.max(6, v)}%"></i><small>${z.median ? (z.median / 1000).toFixed(1) : '–'}</small></span>`; }).join('')}</div></div>` : ''}
      <div class="card"><h3>This week</h3><div class="week">${days.map(d => `<i class="${S.days.includes(d) ? 'on' : ''} ${d === today() ? 'now' : ''}">${'SMTWTFS'[new Date(d + 'T00:00:00').getDay()]}</i>`).join('')}</div></div>
      <div class="card"><h3>Badges · ${Object.keys(S.badges).length}/${BADGES.length}</h3>
        <div class="badges">${BADGES.map(b => `<div class="badge ${S.badges[b.id] ? '' : 'locked'}">${medal(b, !S.badges[b.id])}<b>${esc(b.name)}</b><span class="muted">${esc(b.desc)}</span></div>`).join('')}</div>
      </div>
      <div class="card"><div class="row" style="justify-content:space-between"><h3>About you</h3><button class="chip" data-go="profile">Edit</button></div>
        <p class="muted">${S.profile ? esc([cap(prof().name), prof().gender === 'f' ? 'speaks as a woman' : 'speaks as a man', prof().father ? 'father: ' + cap(prof().father) + 'bhai' : '', prof().gaam ? 'gaam: ' + cap(prof().gaam) : ''].filter(Boolean).join(' · ')) : 'Not set. Phrases use placeholders like "Rameshbhai".'}</p></div>
      <div class="card"><h3>Voice</h3><p class="muted">${AUDIO.map ? `Lessons, conversations, patterns and stories play ${Object.keys(AUDIO.map).length} pre-recorded Gujarati clips (eSpeak). The voice is robotic, but the sounds are real Gujarati. Use it for shape and rhythm, and your family for the music.` : 'Gujarati clips are still loading, or could not load. Using your device\'s voice for now.'} Your own saved phrases and AI replies use your device's voice.</p></div>
      <div class="card"><h3>Daily goal</h3><div class="toolbar">${[[20, 'Casual'], [30, 'Regular'], [50, 'Serious']].map(([n, l]) => `<button class="chip" data-goal="${n}" aria-pressed="${goal() === n}">${l} · ${n} XP</button>`).join('')}</div></div>
      <button class="secondary" data-go="book">Open the phrasebook</button>`));
  }

  // ── exercise engine ────────────────────────────────────
  let run = null;
  function distractors(p, field, n, from) {
    const pool = shuffle((from || D.phrases).filter(q => q.id !== p.id && q[field] !== p[field]));
    const same = pool.filter(q => q.unit === p.unit);
    return [...same, ...pool].filter((q, i, a) => a.findIndex(z => z[field] === q[field]) === i).slice(0, n).map(q => q[field]);
  }
  function buildExercises(newOnes, reviewIds) {
    const mix = [];
    newOnes.forEach(p => {
      mix.push({ t: 'listen', p }, { t: 'meaning', p });
      mix.push({ t: p.r.split(' ').length >= 3 ? 'build' : 'say', p });
    });
    reviewIds.forEach(id => mix.push({ t: shuffle(['listen', 'meaning', 'say'])[0], p: byId[id], review: true }));
    return newOnes.map(p => ({ t: 'intro', p })).concat(shuffle(mix));
  }
  const backOf = k => ({ review: 'review', pattern: 'patterns', story: 'talk', })[k] || 'learn';
  function startPattern(pid) {
    const pt = G.patterns.find(z => z.id === pid);
    const q = []; pt.items.forEach(p => { q.push({ t: 'meaning', p, pool: pt.items }); q.push({ t: 'listen', p, pool: pt.items }); });
    startRun({ kind: 'pattern', pid, queue: shuffle(q) });
  }
  function startStoryQuiz(sid) {
    const st = G.stories.find(z => z.id === sid);
    const pick = shuffle(st.items).slice(0, 6);
    startRun({ kind: 'story', sid, queue: pick.flatMap((p, i) => [{ t: i % 2 ? 'listen' : 'meaning', p, pool: st.items }]) });
  }
  function startTestOut(uid) {
    const ps = shuffle(unitPhrases(uid)).slice(0, 10);
    startRun({ kind: 'testout', uid, queue: ps.map((p, i) => ({ t: i % 2 ? 'listen' : 'meaning', p })) });
  }
  function startLevel() {
    const L = SP.level, q = [];
    L.words.forEach(id => byId[id] && q.push({ t: 'listen', p: byId[id], sec: 'words' }));
    const sentPool = L.sentences.map(id => byId[id]).filter(Boolean);
    sentPool.forEach(p => q.push({ t: 'listen', p, pool: [...sentPool, ...G.stories.flatMap(s => s.items)], sec: 'sentences' }));
    L.building.forEach(b => q.push({ t: 'choose', p: { id: 'lvl-b', r: b.opts[0][0], g: '', e: b.e }, prompt: b.e, label: 'Which is right?', opts: b.opts.map(([r, ok, why]) => ({ r, ok, why })), sec: 'building' }));
    L.register.forEach(ref => {
      const [sid, idx] = ref.split(':'), sc = D.scenes.find(z => z.id === sid); if (!sc) return;
      const st = sc.steps[+idx], cue = sc.steps[+idx - 1];
      q.push({ t: 'choose', p: { id: 'lvl-r', r: st.reply.find(o => o.ok).r, g: '', e: cue.cue }, prompt: cue.cue, label: 'What do you say?', opts: st.reply.map(o => ({ r: o.r, ok: !!o.ok, why: o.why })), sec: 'register' });
    });
    L.recall.forEach(id => byId[id] && q.push({ t: 'recall', p: byId[id], sec: 'recall' }));
    startRun({ kind: 'level', queue: q, noRequeue: true });
  }
  function startGym() {
    const items = shuffle(SP.gym.map((_, i) => byId['gym-' + i]));
    const q = [...items.slice(0, 8).map(p => ({ t: 'chunks', p })), ...items.slice(8, 14).map(p => ({ t: 'recall', p }))];
    startRun({ kind: 'gym', queue: q });
  }
  function startQuick() {
    const known = Object.keys(S.cards).map(id => byId[id]).filter(p => p && p.unit !== 'mine' && p.r.split(' ').length >= 2);
    const pool = shuffle([...SP.gym.map((_, i) => byId['gym-' + i]), ...known]).slice(0, 12);
    startRun({ kind: 'quick', queue: pool.map(p => ({ t: 'recall', p })) });
  }
  function startRun(r) { run = Object.assign({ done: 0, right: 0, wrong: 0, combo: 0, best: 0, xp: 0, wrongOnce: new Set(), sec: {}, recall: [] }, r); run.total = run.queue.length; setFocus(true); next(); }
  function startLesson(key) {
    const [uid, idx] = key.split(':');
    const ps = lessonsOf(uid)[+idx];
    const pastIds = shuffle(Object.keys(S.cards).filter(id => !ps.find(p => p.id === id))).slice(0, 3);
    startRun({ kind: 'lesson', key, uid, queue: buildExercises(ps, pastIds), newIds: ps.map(p => p.id) });
  }
  function startReview() {
    const ids = shuffle(dueCards()).slice(0, 15);
    if (!ids.length) return route('review');
    startRun({ kind: 'review', uid: null, queue: ids.map(id => ({ t: shuffle(['listen', 'meaning', 'say', 'say'])[0], p: byId[id], review: true })) });
  }
  function frame(inner) {
    const pct = Math.round(100 * run.done / Math.max(1, run.total));
    return h(`<div class="ex"><div class="exbar"><button class="x" data-go="${backOf(run.kind)}" aria-label="Quit">×</button><div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div><span class="combo" id="combo">${run.combo >= 2 ? I.flame + run.combo : ''}</span></div>${inner}<div id="fb"></div><div style="height:220px" aria-hidden="true"></div></div>`);
  }
  const playRow = p => `<div class="playrow"><button class="big-play" data-say="${p.id}" aria-label="Play">${I.speaker}</button><button class="slow" id="slowBtn" aria-pressed="${slow}" aria-label="Slow playback">${I.turtle}</button></div>`;
  function next() {
    if (!run.queue.length) return finish();
    const x = run.queue.shift(); run.cur = x;
    const p = x.v = view(x.p);
    if (x.t === 'intro') {
      $view.replaceChildren(frame(`<span class="eyebrow">New phrase</span><div class="card learn" style="--c:${unitColor(p.unit)}"><div class="row">${tag(p)}</div><div class="roman">${esc(p.r)}</div><div class="meaning">${esc(p.e)}</div>${p.note ? `<p class="note">${esc(p.note)}</p>` : ''}${kutchiLine(p)}${srcLine(p)}</div>${playRow(p)}<p class="muted">Listen, then say it out loud twice.</p>${voiceNote()}<button class="primary" data-act="continue">Got it</button>`));
      speak(p.g, p.r, p.personalised); return;
    }
    if (x.t === 'listen') {
      const opts = shuffle([p.e, ...distractors(p, 'e', 3, x.pool)]);
      $view.replaceChildren(frame(`<span class="eyebrow">What did you hear?</span>${playRow(p)}<div class="opts">${opts.map(o => `<button class="opt" data-pick="${esc(o)}">${esc(o)}</button>`).join('')}</div>`));
      x.answer = p.e; speak(p.g, p.r, p.personalised); return;
    }
    if (x.t === 'meaning') {
      const opts = shuffle([p.r, ...distractors(p, 'r', 3, x.pool)]);
      $view.replaceChildren(frame(`<span class="eyebrow">How do you say…</span><p class="prompt">${esc(p.e)}</p><div class="opts">${opts.map(o => `<button class="opt" data-pick="${esc(o)}">${esc(o)}</button>`).join('')}</div>`));
      x.answer = p.r; return;
    }
    if (x.t === 'build') {
      const words = p.r.replace(/[?!.,]/g, '').split(' ');
      const extra = shuffle([...new Set(D.phrases.flatMap(q => q.r.replace(/[?!.,]/g, '').split(' ')))].filter(w => !words.includes(w))).slice(0, 3);
      x.tiles = shuffle([...words, ...extra]); x.picked = [];
      $view.replaceChildren(frame(`<span class="eyebrow">Build it</span><p class="prompt">${esc(p.e)}</p><div class="answer-line" id="line"></div><div class="tiles">${x.tiles.map((w, i) => `<button class="tile" data-tile="${i}">${esc(w)}</button>`).join('')}</div><button class="primary" data-act="check">Check</button>`));
      return;
    }
    if (x.t === 'choose') {
      x.answer = x.opts.find(o => o.ok).r;
      $view.replaceChildren(frame(`<span class="eyebrow">${esc(x.label || 'Which one is right?')}</span><p class="prompt">${esc(x.prompt || p.e)}</p><div class="opts">${shuffle(x.opts).map(o => `<button class="opt" data-pick="${esc(o.r)}">${esc(o.r)}</button>`).join('')}</div>`));
      return;
    }
    if (x.t === 'chunks') {
      x.chunks = p.chunks || p.r.split(' '); x.picked = [];
      x.tiles = shuffle([...x.chunks, ...(p.traps || [])]);
      $view.replaceChildren(frame(`<span class="eyebrow">Build it from chunks</span><p class="prompt">${esc(p.e)}</p><p class="muted" style="margin-top:-8px">Grab whole pieces, not single words. Watch for the traps.</p><div class="answer-line" id="line"></div><div class="tiles">${x.tiles.map((w, i) => `<button class="tile chunk" data-tile="${i}">${esc(w)}</button>`).join('')}</div><button class="primary" data-act="check">Check</button>`));
      return;
    }
    if (x.t === 'recall') {
      x.t0 = performance.now(); x.ms = null;
      $view.replaceChildren(frame(`<span class="eyebrow">Quick recall · say it the moment it comes</span><p class="prompt">${esc(p.e)}</p><div class="recall-timer" aria-hidden="true"><i></i></div><div class="pair"><button class="secondary" data-act="recall-blank">Blank</button><button class="primary go" data-act="recall-said">Said it</button></div>`));
      return;
    }
    $view.replaceChildren(frame(`<span class="eyebrow">Say it out loud</span><p class="prompt">${esc(p.e)}</p><p class="muted">Say it in Gujarati, out loud, then reveal and be honest.</p><button class="primary" data-act="reveal">Reveal</button>`));
  }
  const CHEERS = [['Saras!', 'Nice!'], ['Shabash!', 'Well done!'], ['Waah!', 'Wow!'], ['Bahu saras!', 'Very good!'], ['Ekdum barabar!', 'Spot on!']];
  function feedback(ok, anchor, extraNote) {
    const x = run.cur, p = x.v || x.p;
    if (x.review || run.kind === 'review') grade(p.id, ok);
    if (x.sec) { const sc = run.sec[x.sec] = run.sec[x.sec] || { n: 0, score: 0 }; sc.n++; sc.score += ok ? (x.t === 'recall' ? (x.ms !== null && x.ms < 4000 ? 1 : 0.6) : 1) : 0; }
    if (x.t === 'recall') run.recall.push({ ms: x.ms, ok });
    let gain = 0;
    if (ok) {
      run.right++; run.combo++; run.best = Math.max(run.best, run.combo);
      gain = run.combo >= 5 ? 2 : 1; run.xp += gain;
      sfx.right(run.combo); xpPop(gain, anchor);
    } else {
      run.wrong++; run.combo = 0; sfx.wrong();
      if (!run.noRequeue && !run.wrongOnce.has(p.id + x.t)) { run.wrongOnce.add(p.id + x.t); run.queue.push(Object.assign({}, x)); run.total++; }
    }
    run.done++;
    const bar = document.querySelector('.progress'); bar.querySelector('i').style.width = Math.round(100 * run.done / run.total) + '%'; bar.setAttribute('aria-valuenow', Math.round(100 * run.done / run.total));
    const cb = document.getElementById('combo'); cb.innerHTML = run.combo >= 2 ? I.flame + run.combo : ''; if (run.combo >= 2) { cb.classList.remove('hot'); void cb.offsetWidth; cb.classList.add('hot'); }
    document.querySelectorAll('.opt, .tile, [data-act="check"], [data-act="reveal"]').forEach(b => { b.disabled = true; });
    const [gu, en] = ok ? CHEERS[Math.floor(Math.random() * CHEERS.length)] : ['Koi vaandho nahi', 'No problem. Here it is'];
    const comboNote = ok && run.combo >= 5 ? ` · ${run.combo} in a row, double XP` : '';
    document.getElementById('fb').replaceChildren(h(`<div class="sheet feedback ${ok ? 'good' : 'bad'}"><div class="col gut">
      <div class="cheer">${ok ? I.check : ''}${gu} <small>${en}${comboNote}</small></div>
      <div class="ans"><b>${esc(x.t === 'choose' ? x.answer : p.r)}</b> · ${esc(x.prompt || p.e)}</div>${extraNote ? `<div class="ans">${esc(extraNote)}</div>` : ''}
      <button class="hear" data-say="${p.id}">▶ hear it</button>
      <button class="primary ${ok ? 'go' : 'warn'}" data-act="continue">Continue</button></div></div>`));
    document.querySelector('#fb [data-act="continue"]').focus({ preventScroll: true });
    if (!ok) speak(p.g, p.r, p.personalised);
  }
  const median = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; };
  function finish() {
    const r = run;
    if (r.kind === 'level') {
      const pct = k => r.sec[k] ? Math.round(100 * r.sec[k].score / r.sec[k].n) : null;
      const ms = r.recall.filter(z => z.ok && z.ms !== null).map(z => z.ms);
      S.level = { words: pct('words'), sentences: pct('sentences'), building: pct('building'), register: pct('register'), recall: pct('recall'), recallMs: median(ms), at: today() };
      S.levelHistory = [...(S.levelHistory || []), S.level].slice(-12);
      run = null; award(20); celebrate(checkBadges(), false); confetti(120);
      return route('levelres');
    }
    if (r.recall.length) {
      const ms = r.recall.filter(z => z.ok && z.ms !== null).map(z => z.ms);
      S.recallLog = [...(S.recallLog || []), { date: today(), median: median(ms), n: r.recall.length, instant: r.recall.filter(z => z.ok && z.ms !== null && z.ms < 3000).length }].slice(-30);
    }
    if (r.kind === 'gym') S.gymCount = (S.gymCount || 0) + 1;
    let bonus = 0;
    if (r.kind === 'lesson') {
      r.newIds.forEach(learn);
      bonus = S.lessons[r.key] ? 5 : 10;
      S.lessons[r.key] = true;
    }
    let testoutMsg = '';
    if (r.kind === 'testout') {
      const passed = r.wrong <= 2;
      if (passed) { lessonsOf(r.uid).forEach((ps, i) => { S.lessons[r.uid + ':' + i] = true; ps.forEach(p => { learn(p.id); S.cards[p.id].box = Math.max(S.cards[p.id].box, 2); }); }); bonus = 15; }
      testoutMsg = passed ? `You know this one. ${esc(D.units.find(u => u.id === r.uid).title)} is marked done and its phrases go into review.` : `${r.wrong} slips. Test out needs 8 of 10. Do the lessons and it will stick.`;
    }
    if (r.kind === 'gym') bonus = 10;
    if (r.kind === 'quick') bonus = 5;
    if (r.kind === 'pattern') { bonus = S.patterns[r.pid] ? 3 : 8; S.patterns[r.pid] = true; }
    if (r.kind === 'story') { bonus = S.stories[r.sid] ? 3 : 10; S.stories[r.sid] = true; }
    const perfect = r.wrong === 0 && r.kind === 'lesson';
    if (perfect) { bonus += 5; S.perfect++; }
    S.bestCombo = Math.max(S.bestCombo, r.best);
    const total = r.xp + bonus;
    const lv = award(total);
    const fresh = checkBadges();
    const acc = Math.round(100 * r.right / Math.max(1, r.done));
    run = null;
    $view.replaceChildren(h(`<div class="finish">
      <div class="trophy">${perfect ? I.star('star-on').replace('class="star-on"', 'fill="#3A2600"') : I.trophy}</div>
      <span class="eyebrow">${r.kind === 'lesson' ? (perfect ? 'Flawless lesson' : 'Lesson complete') : ({ review: 'Review complete', pattern: 'Pattern practised', story: 'Story understood', testout: 'Test out', gym: 'Sentence gym', quick: 'Quick-fire' })[r.kind]}</span>
      ${r.recall.length ? (() => { const L = S.recallLog[S.recallLog.length - 1]; return `<p class="meaning">Recall: ${L.median !== null ? (L.median / 1000).toFixed(1) + ' s median' : 'no hits yet'} · ${L.instant}/${L.n} under 3 s</p>`; })() : ''}
      ${testoutMsg ? `<p class="meaning">${testoutMsg}</p>` : ''}
      <h2>${perfect ? 'Ekdum barabar!' : 'Shabash!'}</h2>
      <div class="bigstats">
        <div class="bigstat"><b style="color:var(--gold)" id="xpCount">+0</b><span>XP earned</span></div>
        <div class="bigstat"><b>${acc}%</b><span>accuracy</span></div>
        <div class="bigstat"><b>${r.best}</b><span>best combo</span></div>
      </div>
      ${lv ? `<div class="card unlock"><div class="medal" style="--c:var(--turmeric)">${I.bolt}</div><div><b>Level ${levelOf(S.xp)}</b><p class="muted">${esc(titleOf(levelOf(S.xp)))}</p></div></div>` : ''}
      ${fresh.map(b => `<div class="card unlock">${medal(b, false)}<div><b>${esc(b.name)}</b><p class="muted">${esc(b.desc)}</p></div></div>`).join('')}
      <p class="muted">Try one of these on someone at home today.</p>
      <button class="primary go" data-go="${backOf(r.kind)}">Continue</button>
    </div><span class="done-hero" hidden></span>`));
    setFocus(true);
    sfx.fanfare(); confetti(perfect || lv || fresh.length ? 180 : 110);
    const el = document.getElementById('xpCount'); let k = 0;
    const step = () => { k = Math.min(total, k + Math.max(1, Math.round(total / 20))); el.textContent = '+' + k; if (k < total) requestAnimationFrame(step); };
    reduceMotion ? (el.textContent = '+' + total) : requestAnimationFrame(step);
  }

  // ── scenes ─────────────────────────────────────────────
  let scene = null;
  function startScene(id) {
    const s = D.scenes.find(z => z.id === id);
    scene = { s, i: 0, right: 0, firstTry: true };
    setFocus(true);
    $view.replaceChildren(h(`<div class="ex"><div class="exbar"><button class="x" data-go="talk" aria-label="Quit">×</button><div style="flex:1;min-width:0"><h3>${esc(s.title)}</h3><span class="muted" style="font-size:14px">${esc(s.where)}</span></div></div>${voiceNote()}<div class="row"><button class="chip" id="hideEn" aria-pressed="false">Hide English</button><button class="chip" id="slowBtn" aria-pressed="${slow}">Slow audio</button>${s.drill ? '' : `<button class="chip" id="speakFirst" aria-pressed="${!!S.speakFirst}">Speak first</button>`}</div><div class="chat" id="chat"></div><div id="choices" class="opts"></div></div>`));
    sceneStep();
  }
  function sceneStep() {
    const { s } = scene; const chat = document.getElementById('chat'), choices = document.getElementById('choices');
    choices.replaceChildren();
    const hide = document.getElementById('hideEn').getAttribute('aria-pressed') === 'true';
    while (scene.i < s.steps.length && (s.steps[scene.i].say || s.steps[scene.i].cue)) {
      const st = s.steps[scene.i];
      if (st.cue) { chat.append(h(`<div class="bubble cue"><span class="who">Your move</span><span class="r">${esc(st.cue)}</span></div>`)); scene.i++; continue; }
      chat.append(h(`<div class="bubble them"><span class="who">${esc(s.who)}</span><span class="r">${esc(st.r)}</span><span class="e" ${hide ? 'hidden' : ''}>${esc(st.e)}</span><button class="play" data-sayraw="${scene.i}">▶ play</button></div>`));
      speak(st.say, st.r);
      scene.i++;
    }
    if (scene.i >= s.steps.length) {
      const total = s.steps.filter(z => z.reply).length, ratio = scene.right / total;
      const stars = ratio === 1 ? 3 : ratio >= .5 ? 2 : 1;
      const firstTime = !S.scenes[s.id];
      S.scenes[s.id] = Math.max(S.scenes[s.id] || 0, stars);
      const gain = (firstTime ? 15 : 5) + scene.right * 2;
      const lv = award(gain);
      sfx.fanfare(); confetti(stars === 3 ? 180 : 100);
      celebrate(checkBadges(), lv);
      choices.append(h(`<div class="card" style="justify-items:center;text-align:center"><div class="stars" style="transform:scale(1.8);margin:8px">${[1, 2, 3].map(i => I.star(i <= stars ? 'star-on' : 'star-off')).join('')}</div><h3>Conversation done! +${gain} XP</h3><p class="muted">${scene.right} of ${total} replies right first time.</p><button class="primary go" data-go="talk">Back to conversations</button></div>`));
      return;
    }
    const st = s.steps[scene.i]; scene.firstTry = true;
    const prev = s.steps[scene.i - 1];
    if (S.speakFirst && !(prev && prev.cue) && !scene.shown) {
      const okR = st.reply.find(o => o.ok);
      choices.append(h(`<div class="card speakfirst"><span class="eyebrow">Your turn · say it out loud first</span><p class="meaning">${esc(personal(okR.e))}</p><button class="primary" data-act="show-choices">I've said it. Show the options</button></div>`));
      return;
    }
    scene.shown = false;
    shuffle(st.reply.map((o, k) => ({ o, k }))).forEach(({ o, k }) => choices.append(h(`<button class="opt" data-reply="${k}">${esc(personal(o.r))}<br><span class="muted" style="font-size:14px">${esc(personal(o.e))}</span></button>`)));
    if (chat.lastElementChild) chat.lastElementChild.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  function sceneReply(k, btn) {
    const st = scene.s.steps[scene.i], o = st.reply[k];
    if (!o.ok) {
      sfx.wrong(); btn.classList.add('wrong'); btn.disabled = true; scene.firstTry = false;
      btn.insertAdjacentHTML('beforeend', `<br><span style="font-size:14px">${esc(o.why || 'Try another.')}</span>`);
      return;
    }
    if (scene.firstTry) { scene.right++; sfx.right(scene.right); xpPop(2, btn); } else sfx.right(0);
    const hide = document.getElementById('hideEn').getAttribute('aria-pressed') === 'true';
    document.getElementById('chat').append(h(`<div class="bubble you"><span class="who">You</span><span class="r">${esc(personal(o.r))}</span><span class="e" ${hide ? 'hidden' : ''}>${esc(personal(o.e))}</span></div>`));
    scene.i++; sceneStep();
  }

  // ── phrasebook & family ────────────────────────────────
  let bookFilter = 'all';
  function viewBook(family) {
    const kinds = ['all', ...((S.mine || []).length ? ['mine'] : []), 'standard', 'sklpc', 'kutchi', 'swahili-loan'].filter(k => k === 'all' || k === 'mine' || D.phrases.some(p => p.kind === k));
    if (family && bookFilter === 'all') bookFilter = 'dialect';
    if (!family && bookFilter === 'dialect') bookFilter = 'all';
    const dialect = D.phrases.filter(p => p.kind !== 'standard');
    const checked = dialect.filter(p => S.verdicts[p.id] && S.verdicts[p.id].v).length;
    const chips = (family ? ['dialect', ...kinds] : kinds).map(k => `<button class="chip" data-kind="${k}" aria-pressed="${bookFilter === k}">${k === 'all' ? 'All' : k === 'dialect' ? 'Dialect first' : k === 'mine' ? 'Mine' : KIND_LABEL[k]}</button>`).join('');
    $view.replaceChildren(h(`<div class="ex">
      ${family ? segment('family') : ''}
      ${family ? `<div class="card" style="grid-template-columns:auto minmax(0,1fr);align-items:center">
          <div style="color:var(--ok)">${ring(checked / Math.max(1, dialect.length), 64, 8, 'var(--ok)', `<text x="32" y="37" text-anchor="middle" font-family="Baloo Bhai 2, sans-serif" font-weight="800" font-size="14" fill="currentColor">${checked}/${dialect.length}</text>`)}</div>
          <div><h2>Ask family</h2><p class="muted">Say each phrase to a parent or grandparent. Mark ✓ if that's how your family says it, ✗ if not, and write what they say instead. This outranks every source in the app.</p></div>
        </div><button class="secondary" id="copyVerdicts">Copy results</button>
        <a class="card famlink" href="https://claude.ai/artifact/N3E4x1Z5TArJvfA3mddZjp" target="_blank" rel="noopener"><span class="eyebrow">For Mum, Dad or Ba</span><b>Family check: 650+ sentences to mark</b><span class="muted">Share this page with them (Share → give access). They tap ✓ / ✗ and type how they'd say it. Claude reads their answers and fixes the app.</span></a>`
      : `<div class="exbar"><button class="x" data-go="me" aria-label="Back">×</button><h2>Phrasebook</h2></div>`}
      <input class="search" id="q" type="search" placeholder="Search English or Gujarati…" aria-label="Search phrases">
      <div class="toolbar">${chips}</div>
      <div class="list" id="list"></div>${voiceNote()}</div>`));
    const paint = () => {
      const q = norm(document.getElementById('q').value);
      const pool = bookFilter === 'mine' ? (S.mine || []).map(m => byId[m.id]) : [...D.phrases, ...(family ? [] : (S.mine || []).map(m => byId[m.id]))];
      let items = pool.filter(p => (bookFilter === 'all' || bookFilter === 'dialect' || bookFilter === 'mine' || p.kind === bookFilter) && (!q || norm(p.r + ' ' + p.e).includes(q)));
      if (bookFilter === 'dialect') items = [...items.filter(p => p.kind !== 'standard'), ...items.filter(p => p.kind === 'standard')];
      document.getElementById('list').replaceChildren(h(items.map(p => {
        const v = S.verdicts[p.id] || {};
        const q = view(p);
        return `<div class="item"><button class="play" data-say="${p.id}" aria-label="Play ${esc(q.r)}">${I.speaker}</button><div class="row"><span class="r">${esc(q.r)}</span>${tag(p)}</div><div>${esc(q.e)}</div>${kutchiLine(p)}${srcLine(p)}${family ? `<div class="verdict"><button class="yes" data-v="${p.id}:yes" aria-pressed="${v.v === 'yes'}">✓ we say this</button><button class="no" data-v="${p.id}:no" aria-pressed="${v.v === 'no'}">✗ not us</button><input data-note="${p.id}" value="${esc(v.note || '')}" placeholder="We say…" aria-label="What your family says instead"></div>` : ''}</div>`;
      }).join('') || '<p class="muted">No phrases match.</p>'));
    };
    document.getElementById('q').addEventListener('input', paint);
    $view.querySelector('.toolbar').addEventListener('click', e => { const b = e.target.closest('[data-kind]'); if (!b) return; bookFilter = b.dataset.kind; $view.querySelectorAll('[data-kind]').forEach(c => c.setAttribute('aria-pressed', c === b)); paint(); });
    const copyBtn = document.getElementById('copyVerdicts');
    if (copyBtn) copyBtn.addEventListener('click', () => {
      const txt = JSON.stringify(Object.entries(S.verdicts).map(([id, v]) => ({ id, phrase: byId[id] && byId[id].r, verdict: v.v || '', we_say: v.note || '' })), null, 1);
      const done = () => { copyBtn.textContent = 'Copied'; setTimeout(() => { copyBtn.textContent = 'Copy results'; }, 1500); };
      try { navigator.clipboard.writeText(txt).then(done).catch(() => { copyBtn.textContent = 'Copying is blocked here. Results are still saved in the app.'; }); } catch (e) { copyBtn.textContent = 'Copying is blocked here. Results are still saved in the app.'; }
    });
    $view.addEventListener('change', e => {
      const n = e.target.closest('[data-note]'); if (!n) return;
      const id = n.dataset.note; S.verdicts[id] = Object.assign(S.verdicts[id] || {}, { note: n.value.trim(), at: today() });
      save(); celebrate(checkBadges(), false);
    });
    paint();
  }

  // ── patterns ───────────────────────────────────────────
  function viewPatterns() {
    $view.replaceChildren(h(`<div class="ex"><div class="exbar"><button class="x" data-go="learn" aria-label="Back">×</button><div style="flex:1;min-width:0"><h2>How Gujarati works</h2></div></div>
      <p class="muted">The rules behind the phrases. Learn a pattern once and you can build sentences you've never heard. Each one has a table to listen to and a quick drill.</p>
      <div class="list">${G.patterns.map((pt, i) => `<button class="scene-card" data-pattern="${pt.id}">
        <span class="art" style="background:var(${pt.dialect ? '--u-kutch' : '--u-learner'});font-size:24px">${i + 1}</span>
        <span class="body"><h3>${esc(pt.title)}</h3><span class="row"><span class="tag ${pt.dialect ? 'dialect' : ''}">${esc(pt.tag)}</span>${S.patterns[pt.id] ? '<span class="tag resp">Practised</span>' : ''}</span></span>
      </button>`).join('')}</div></div>`));
  }
  function viewPattern(pid) {
    const pt = G.patterns.find(z => z.id === pid);
    setFocus(true);
    $view.replaceChildren(h(`<div class="ex"><div class="exbar"><button class="x" data-go="patterns" aria-label="Back">×</button><div style="flex:1;min-width:0"><span class="eyebrow">${esc(pt.tag)}</span><h2>${esc(pt.title)}</h2></div></div>
      <div class="card learn" style="--c:var(${pt.dialect ? '--u-kutch' : '--u-learner'})"><p class="meaning" style="font-size:17px">${esc(pt.why)}</p></div>
      <div class="list">${pt.items.map(p => `<div class="item"><button class="play" data-say="${p.id}" aria-label="Play ${esc(p.r)}">${I.speaker}</button><span class="r">${esc(p.r)}</span><span>${esc(p.e)}</span></div>`).join('')}</div>
      ${voiceNote()}
      <button class="primary go" data-act="start-pattern" data-pid="${pt.id}">Practise this pattern</button></div>`));
  }

  // ── stories ────────────────────────────────────────────
  let story = null;
  function viewStory(sid) {
    const st = G.stories.find(z => z.id === sid);
    story = { st, i: 0 };
    setFocus(true);
    $view.replaceChildren(h(`<div class="ex"><div class="exbar"><button class="x" data-go="talk" aria-label="Back">×</button><div style="flex:1;min-width:0"><span class="eyebrow">${esc(st.cast)}</span><h3>${esc(st.title)}</h3></div></div>
      ${voiceNote()}
      <div class="row"><button class="chip" id="hideEn" aria-pressed="false">Hide English</button><button class="chip" id="showGu" aria-pressed="false">Show Gujarati script</button><button class="chip" id="slowBtn" aria-pressed="${slow}">Slow audio</button></div>
      <p class="muted" style="font-size:14px">Tap a line to see each word. Try to follow by ear first.</p>
      <div class="chat" id="chat"></div><div id="storyNext"></div></div>`));
    storyNext();
  }
  function storyNext() {
    const { st } = story, chat = document.getElementById('chat');
    if (story.i < st.lines.length) {
      const l = st.lines[story.i], p = st.items[story.i];
      const you = l.who === 'You';
      const hideE = document.getElementById('hideEn').getAttribute('aria-pressed') === 'true';
      const showG = document.getElementById('showGu').getAttribute('aria-pressed') === 'true';
      chat.append(h(`<div class="bubble ${you ? 'you' : 'them'} sline" data-gloss="${story.i}" role="button" tabindex="0"><span class="who">${esc(l.who)}</span>
        <span class="r">${esc(l.r)}</span><span class="gu" ${showG ? '' : 'hidden'} lang="gu">${esc(l.g)}</span><span class="e" ${hideE ? 'hidden' : ''}>${esc(l.e)}</span>
        <span class="gloss" hidden>${l.w.map(([a, b]) => `<span class="gl"><b>${esc(a)}</b> ${esc(b)}</span>`).join('')}</span>
        <button class="play" data-say="${p.id}">▶ play</button></div>`));
      speak(p.g, p.r, p.personalised);
      story.i++;
      if (chat.lastElementChild) chat.lastElementChild.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
    }
    const done = story.i >= st.lines.length;
    document.getElementById('storyNext').replaceChildren(h(done
      ? `<div class="card" style="text-align:center;justify-items:center"><h3>End of the story</h3><p class="muted">Six quick questions to check you followed it.</p><button class="primary go" data-act="story-quiz" data-sid="${st.id}">Quick check</button></div>`
      : `<button class="primary" data-act="next-line">Next line · ${story.i}/${st.lines.length}</button>`));
  }

  // ── level check results ────────────────────────────────
  const SKILLS = [['words', 'Words', 'Knowing what single words mean'], ['sentences', 'Sentences', 'Following whole sentences by ear'], ['building', 'Building', 'Putting a sentence together correctly'], ['register', 'Register', 'Picking tu or tame, formal or casual'], ['recall', 'Recall', 'Getting it out fast, in the moment']];
  const BASICS = ['greet', 'family', 'food', 'daily', 'feel', 'call'];
  function levelBars(L) {
    return `<div class="strength">${SKILLS.map(([k, label]) => { const v = L[k] == null ? 0 : L[k]; return `<div class="sbar"><span>${label}</span><span class="meter"><i style="width:${v}%;background:${v >= 75 ? 'var(--ok)' : v >= 50 ? 'var(--turmeric)' : 'var(--madder)'}"></i></span><span>${v}%</span></div>`; }).join('')}</div>`;
  }
  function levelPlan(L) {
    const weak = SKILLS.filter(([k]) => L[k] != null && L[k] < 70).map(([k]) => k);
    const lines = [];
    if (L.words >= 70 && (L.building < 70 || L.recall < 70)) lines.push('You know the words. The gap is putting them together on the spot, so skip the basics and train sentences.');
    if (weak.includes('building')) lines.push('Daily Sentence gym: build sentences from ready-made chunks, so the shapes come pre-assembled.');
    if (weak.includes('recall')) lines.push('Quick-fire recall: say it before you think. Your speed is tracked under Me.');
    if (weak.includes('register')) lines.push('Do the "tu or tame?" and "formal or casual?" drills until they feel automatic.');
    if (weak.includes('sentences')) lines.push('Listen to the stories with English hidden, then turn it on to check.');
    if (!weak.length) lines.push('Strong all round. Spend your time in Rehearse and the stories, and capture your family\'s own forms.');
    lines.push('Keep the "Keep talking" fillers handy: "ek minit, yaad karu" buys you time without switching to English.');
    return lines;
  }
  function viewLevel() {
    const L = S.level;
    if (!L) { $view.replaceChildren(h(`<div class="card"><h3>No level check yet</h3><button class="primary go" data-act="level-start">Find my level</button></div>`)); return; }
    const basicsLeft = BASICS.some(u => lessonsOf(u).some((_, i) => !S.lessons[u + ':' + i]));
    $view.replaceChildren(h(`<div class="ex">
      <div class="exbar"><button class="x" data-go="learn" aria-label="Close">×</button><div><span class="eyebrow">Level check · ${esc(L.at)}</span><h2>Your Gujarati, skill by skill</h2></div></div>
      <div class="card">${levelBars(L)}${L.recallMs ? `<p class="muted">Median recall time: ${(L.recallMs / 1000).toFixed(1)} s</p>` : ''}</div>
      <div class="card"><h3>Your plan</h3><ul class="plan">${levelPlan(L).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
      ${L.words >= 70 && basicsLeft ? `<div class="card"><h3>Skip the basics?</h3><p class="muted">Greetings, family, food, everyday talk, feelings and the phone call get marked as known. Their phrases move into review, so you keep them fresh without re-learning them.</p><button class="primary go" data-act="skip-basics">Skip the basics</button></div>` : ''}
      <div class="pair"><button class="secondary" data-act="gym-start">Sentence gym</button><button class="primary" data-act="quick-start">Quick-fire</button></div>
    </div>`));
  }
  function skipBasics() {
    BASICS.forEach(u => lessonsOf(u).forEach((ps, i) => { S.lessons[u + ':' + i] = true; ps.forEach(p => { learn(p.id); S.cards[p.id].box = Math.max(S.cards[p.id].box, 2); }); }));
    save(); toast('Basics marked as known. They\'ll come back in review.'); route('learn');
  }

  // ── how it's really said (ladders) ─────────────────────
  function viewSpeech() {
    const fam = S.ladderFamily || {};
    $view.replaceChildren(h(`<div class="ex">
      <div class="exbar"><button class="x" data-go="learn" aria-label="Back">×</button><h2>How it's really said</h2></div>
      <p class="muted">Nobody at a family dinner talks like a textbook. Each sentence below runs from formal to how it actually comes out: clipped, Gujlish, village or Kutchi. Add how YOUR family says it, and it shows up as its own line.</p>
      <button class="primary go" data-scene="drill-style">Practise: formal or casual?</button>
      <h3>The shortcuts</h3>
      <div class="list">${SP.reductions.map(rd => `<div class="card rule"><b>${esc(rd.rule)}</b>${rd.ex.map(([a, b]) => `<span class="ex-pair"><span class="from">${esc(a)}</span> → <span class="to">${esc(b)}</span></span>`).join('')}${rd.n ? `<span class="muted">${esc(rd.n)}${rd.src ? ` · <a href="${esc(rd.src)}" target="_blank" rel="noopener">source</a>` : ''}</span>` : ''}</div>`).join('')}</div>
      <h3>One sentence, many ways</h3>
      <div class="list">${SP.ladders.map(ld => `<section class="card ladder"><h3>${esc(ld.e)}</h3>
        ${ld.items.map((p, i) => { const rg = ld.rungs[i]; return `<div class="rung"><span class="tag rung-${rg.l.toLowerCase()}">${esc(rg.l)}</span><button class="hear chipbtn" data-say="${p.id}" aria-label="Play">▶</button><b>${esc(rg.r)}</b>${rg.n ? `<span class="muted rn">${esc(rg.n)}${rg.src ? ` · <a href="${esc(rg.src)}" target="_blank" rel="noopener">${esc(rg.conf || 'source')}</a>` : ''}</span>` : ''}</div>`; }).join('')}
        ${fam[ld.id] ? `<div class="rung"><span class="tag rung-family">Your family</span><b>${esc(fam[ld.id])}</b></div>` : ''}
        <input class="famin" data-ladfam="${ld.id}" value="${esc(fam[ld.id] || '')}" placeholder="Your family says it like…" aria-label="How your family says: ${esc(ld.e)}">
      </section>`).join('')}</div></div>`));
    $view.addEventListener('change', e => {
      const inp = e.target.closest('[data-ladfam]'); if (!inp) return;
      S.ladderFamily = Object.assign({}, S.ladderFamily, { [inp.dataset.ladfam]: inp.value.trim() });
      if (!inp.value.trim()) delete S.ladderFamily[inp.dataset.ladfam];
      save(); toast('Saved as your family\'s form.');
    });
  }

  // ── about you (profile) ────────────────────────────────
  const GAAM_HINTS = ['Madhapar', 'Kera', 'Baladia', 'Kodki', 'Bharasar', 'Samatra', 'Sukhpar', 'Mankuva', 'Naranpar', 'Rampar', 'Mirjapar', 'Meghpar', 'Kundanpur'];
  function viewProfile(first) {
    const pr = prof();
    const radio = (name, opts, cur) => `<div class="radios">${opts.map(([v, l]) => `<label class="radio"><input type="radio" name="${name}" value="${v}" ${cur === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>`;
    setFocus(!!first);
    $view.replaceChildren(h(`<form class="ex profile" id="profileForm" onsubmit="return false">
      ${first ? `<div class="guide"><div class="avatar" aria-hidden="true">બા<span>Ba</span></div><div class="speech"><b>“aav dikra!”</b><small>Come in! Tell me about yourself, so I can teach you the way your family talks.</small></div></div>` : `<div class="exbar"><button class="x" type="button" data-go="me" aria-label="Back">×</button><h2>About you</h2></div>`}
      <label class="field"><span>Your name</span><input id="pfName" value="${esc(pr.name || 'Sayuj')}" autocomplete="given-name"></label>
      <div class="field"><span>Speak as</span>${radio('pfGender', [['m', 'A man (hu gayo, dikro)'], ['f', 'A woman (hu gai, dikri)']], pr.gender || 'm')}<small class="muted">Gujarati verbs change with the speaker's gender. This sets your forms.</small></div>
      <label class="field"><span>Your father's first name</span><input id="pfFather" value="${esc(pr.father || '')}" placeholder="e.g. Ramesh"><small class="muted">So you can answer "kono dikro?" with his name + bhai.</small></label>
      <label class="field"><span>Your family's gaam</span><input id="pfGaam" list="gaamList" value="${esc(pr.gaam || '')}" placeholder="Ask your parents if you're not sure"><datalist id="gaamList">${GAAM_HINTS.map(g => `<option value="${g}">`).join('')}</datalist><small class="muted">Suggestions are villages linked to the community in public sources, not a verified list.</small></label>
      <div class="field"><span>At home, your family speaks</span>${radio('pfLean', [['gujarati', 'Mostly Gujarati'], ['mixed', 'Gujarati with Kutchi words'], ['kutchi', 'Mostly Kutchi'], ['unsure', 'Not sure']], pr.lean || 'unsure')}</div>
      <div class="field"><span>Your style when you talk</span>${radio('pfStyle', [['playful', 'Playful and quippy'], ['easy', 'Easygoing'], ['polite', 'Polite and gentle']], pr.style || 'playful')}<small class="muted">The AI partner and "How do I say…?" match your tone.</small></div>
      <div class="field"><span>Right now you</span>${radio('pfLevel', [['understand', 'Understand most things but freeze when speaking'], ['some', 'Understand some'], ['new', 'Are starting out']], pr.level || 'understand')}</div>
      <button class="primary go" type="button" data-act="save-profile">${first ? 'Start learning' : 'Save'}</button>
      ${first ? '<button class="secondary" type="button" data-act="skip-profile">Skip for now</button>' : ''}
    </form>`));
  }
  function saveProfile() {
    const val = id => (document.getElementById(id).value || '').trim();
    const pick = n => (document.querySelector(`input[name="${n}"]:checked`) || {}).value;
    S.profile = { name: val('pfName') || 'Sayuj', gender: pick('pfGender') || 'm', father: val('pfFather'), gaam: val('pfGaam'), lean: pick('pfLean') || 'unsure', level: pick('pfLevel') || 'some', style: pick('pfStyle') || 'playful' };
    save(); route('learn');
    toast(S.profile.level === 'understand' ? 'Saved. Tip: use "Test out" on any stop you already know.' : 'Saved. Your phrases now use your name, gaam and forms.');
  }

  // ── Claude in the page (sample capability) ─────────────
  let sampler = null;
  (async () => {
    try {
      if (!window.claude || !window.claude.use) return;
      sampler = await window.claude.use('sample');
      if (sampler && !run && !scene && !story && !chat && (current === 'learn' || current === 'talk')) route(current);
    } catch (e) { sampler = null; }
  })();
  const AI_ERR = { not_granted: 'You chose not to let this page use Claude. Reopen Apollo to allow it.', sampling_disabled: 'Claude is not available on this account.', rate_limited: 'Claude is busy or you have hit a usage limit. Try again in a little while.', session_expired: 'Sign in to Claude again, then retry.', invalid_json: "Claude's answer came back garbled. Try again.", refused: "Claude wouldn't answer that one. Try rephrasing it.", empty_completion: 'No answer came back. Try again.' };
  const aiErr = e => AI_ERR[e && e.code] || 'Something went wrong reaching Claude. Try again.';
  function learnerContext() {
    const pr = prof();
    const lean = { gujarati: 'mostly Gujarati', mixed: 'Gujarati with Kutchi words mixed in', kutchi: 'mostly Kutchi (Kachchhi)' }[pr.lean] || 'not sure, probably Gujarati with some Kutchi words';
    const level = { understand: 'understands a lot but freezes when speaking', some: 'understands some everyday Gujarati', new: 'is a beginner' }[pr.level] || 'understands some everyday Gujarati';
    return `The learner is ${cap(pr.name) || 'a heritage learner'}, ${pr.gender === 'f' ? 'a woman (use feminine first-person verb forms for her: gai, boli, dikri)' : 'a man (use masculine first-person verb forms for him: gayo, bolyo, dikro)'}, living in Perth. The family belongs to the Shree Kutchi Leva Patel Community (SKLPC): Hindu Leva Patel farming families from the 24 villages around Bhuj, Kutch, with diaspora in East Africa and the UK; many are Swaminarayan followers.${pr.gaam ? ' Family gaam: ' + cap(pr.gaam) + '.' : ''}${pr.father ? " Father's name: " + cap(pr.father) + '.' : ''} Home speech: ${lean}. The learner ${level}. Goal: confident everyday conversation with family; reading and writing are not goals. ${({ playful: 'Personality: playful, quippy and teasing; loves banter and idioms. Where it fits, show the witty, casual way a young person would really say it, clipped forms included (su for shu, nai for nahi, kidhu tu), and natural Gujlish where diaspora families use it.', easy: 'Personality: easygoing and casual; prefers everyday clipped speech over formal Gujarati.', polite: 'Personality: polite and gentle; prefers respectful forms.' })[pr.style || 'playful']}${S.level ? ` Measured skills (0-100): words ${S.level.words}, sentences ${S.level.sentences}, building ${S.level.building}, register ${S.level.register}, recall ${S.level.recall}. Do not explain basic vocabulary they already know; focus on how sentences are put together.` : ''}`;
  }
  const ROMAN_RULES = 'Romanise for an English reader, no diacritics: "aa" for long a, "ch" for both ચ and છ, "sh" for શ and ષ, plain i and u, e.g. "tame kya jaao cho?", "mane bhukh lagi che". The Gujarati script must say exactly the same thing as the roman.';
  const aiOff = () => `<div class="card"><h3>Needs the Claude app</h3><p class="muted">This part uses Claude, so it only works when Apollo is opened inside the Claude app or claude.ai, signed in.</p><button class="secondary" data-go="talk">Back</button></div>`;
  const wordsHtml = w => Array.isArray(w) && w.length ? `<div class="gloss">${w.slice(0, 14).map(x => `<span class="gl"><b>${esc(x[0])}</b> ${esc(x[1])}</span>`).join('')}</div>` : '';

  // How do I say…?
  const TO = [['elder', 'Ba, Dada or another elder'], ['parent', 'Mum or Dad'], ['uncle', 'An uncle or aunt'], ['peer', 'A cousin or sibling my age'], ['child', 'A child'], ['stranger', 'A shopkeeper or stranger']];
  let askTo = 'elder', askPrefill = '', lastAsk = null, prepList = [];
  function viewAsk() {
    if (!sampler) { $view.replaceChildren(h(aiOff())); return; }
    $view.replaceChildren(h(`<div class="ex"><div class="exbar"><button class="x" data-go="talk" aria-label="Back">×</button><h2>How do I say…?</h2></div>
      <form id="askForm" class="card">
        <label class="field"><span>What do you want to say?</span><textarea id="askIn" rows="2" placeholder="e.g. Tell Ba I got a new job and I'll visit at Diwali">${esc(askPrefill)}</textarea></label>
        <div class="field"><span>Saying it to</span><div class="toolbar">${TO.map(([v, l]) => `<button type="button" class="chip" data-to="${v}" aria-pressed="${askTo === v}">${l}</button>`).join('')}</div></div>
        <button class="primary go" type="submit" id="askBtn">Show me how</button>
      </form>
      <div id="askOut"></div></div>`));
    askPrefill = '';
  }
  async function askGo() {
    const q = (document.getElementById('askIn').value || '').trim(); if (!q) return;
    const out = document.getElementById('askOut'), btn = document.getElementById('askBtn');
    const toLabel = (TO.find(z => z[0] === askTo) || TO[0])[1];
    btn.disabled = true; out.replaceChildren(h('<p class="muted thinking">Working it out…</p>'));
    const prompt = `${learnerContext()}
The learner wants to SAY this, out loud, in Gujarati: "${q}"
They are saying it to: ${toLabel}.
Give what a Kutch Leva Patel family member would naturally say: everyday spoken Gujarati, short, not textbook or Sanskritised. Get the register right for this listener: tu or tame, verb endings (-o for respect), plural agreement when talking about elders, -bhai / -ben after names, and the learner's own gender in first-person verbs.
${ROMAN_RULES}
If you know a common Kutchi (Kachchhi) way to say it, give it; if unsure, use null. Never invent Kutchi.
Reply with only JSON: {"r":"roman","gu":"Gujarati script","e":"close English back-translation","register":"one sentence: why this form fits this listener","words":[["roman word","meaning"]],"ladder":[{"label":"Formal"|"Everyday"|"Casual"|"Playful"|"Gujlish","r":"roman","gu":"Gujarati script","e":"English"}],"kutchi":{"r":"roman","note":"short note"} or null,"culture":"one short practical tip, or empty string"}. "ladder" gives the same message 3-5 ways, from formal down to how it is really said between young family members: clipped forms (su, nai, kidhu tu, dropping che), a playful or idiomatic version, and Gujlish if families really say it that way. Mark which rung suits this listener by putting it in "r" as well.`;
    try {
      const a = await sampler.json(prompt, { modelTier: 'default' });
      if (!a || typeof a.r !== 'string' || typeof a.gu !== 'string') throw { code: 'invalid_json' };
      lastAsk = { r: a.r, g: a.gu, e: a.e || q, note: a.register || '', words: a.words || [], to: toLabel };
      out.replaceChildren(h(`<div class="card ai-result">
        <span class="eyebrow">Say it like this · to ${esc(toLabel.toLowerCase())}</span>
        <div class="roman">${esc(a.r)}</div>
        <p class="meaning">${esc(a.e || '')}</p>
        <div class="row"><button class="hear chipbtn" data-sayg="${esc(a.gu)}" data-sayr="${esc(a.r)}">▶ hear it</button><span class="gu-small" lang="gu">${esc(a.gu)}</span></div>
        ${a.register ? `<p class="note">${esc(a.register)}</p>` : ''}
        ${wordsHtml(a.words)}
        ${Array.isArray(a.ladder) && a.ladder.length ? `<div class="ladder ai-ladder"><span class="eyebrow">Other ways to say it</span>${a.ladder.slice(0, 5).map(x => `<div class="rung"><span class="tag rung-${esc(String(x.label || '').toLowerCase())}">${esc(x.label || '')}</span><button class="hear chipbtn" data-sayg="${esc(x.gu || '')}" data-sayr="${esc(x.r || '')}" aria-label="Play">▶</button><b>${esc(x.r || '')}</b><span class="muted rn">${esc(x.e || '')}</span></div>`).join('')}</div>` : ''}
        ${a.kutchi && a.kutchi.r ? `<p class="kx"><span class="tag dialect">Kutchi</span> <b>${esc(a.kutchi.r)}</b> <span class="muted">${esc(a.kutchi.note || '')} · unverified</span></p>` : ''}
        ${a.culture ? `<p class="src">${esc(a.culture)}</p>` : ''}
        <p class="src">Made by Claude for you. Standard spoken Gujarati, not yet checked by family.</p>
        <button class="primary go" data-act="save-mine">Save to my phrases</button>
      </div>`));
    } catch (e) { out.replaceChildren(h(`<p class="voice-warn">${esc(aiErr(e))}</p>`)); }
    finally { btn.disabled = false; }
  }
  function saveMine(btn) {
    const src = btn.dataset.idx !== undefined ? prepList[+btn.dataset.idx] : lastAsk;
    if (!src) return;
    const id = 'my-' + Date.now().toString(36) + Math.floor(Math.random() * 1e4);
    S.mine = [...(S.mine || []), { id, r: src.r, g: src.g || src.gu || '', e: src.e, note: src.note || '', to: src.to || '', at: today() }];
    registerMine(); learn(id); save();
    btn.disabled = true; btn.textContent = 'Saved · it will come up in Review';
    celebrate(checkBadges(), false);
  }

  // Rehearse with an AI partner
  const PARTNERS = [
    { id: 'ba', name: 'Ba', who: 'the learner\'s grandmother', reg: 'She calls the learner "tu", "dikra" / "dikri" or "beta"; the learner must use "tame" with her.', sit: 'Ba calls from Kutch on a Sunday morning to ask about your week, your food and when you will visit.' },
    { id: 'kaka', name: 'Kaka', who: "the learner's father's younger brother", reg: 'He uses "tu" with the learner; the learner uses "tame".', sit: 'Kaka is visiting Perth and asks about your work and plans over dinner.' },
    { id: 'masi', name: 'Masi', who: "the learner's mother's sister", reg: 'Affectionate and teasing; uses "tu"; the learner uses "tame".', sit: "At a cousin's wedding, Masi asks when you will get married and wants to introduce someone." },
    { id: 'cousin', name: 'Nikhil', who: "the learner's younger cousin", reg: 'Both use "tu"; casual banter.', sit: 'Your cousin wants to plan a trip to Kutch together next winter.' },
    { id: 'elder', name: 'Devjibapa', who: 'an elderly man at the samaj', reg: 'Formal but warm; uses "tu" with the young learner; the learner uses "tame" and -bapa.', sit: 'At the Chovis Gaam Ujamni, an elder asks whose son you are, which gaam your family is from, and what you do.' },
    { id: 'shop', name: 'Shopkeeper', who: 'a bandhani seller in Bhuj bazaar', reg: 'Polite, uses "tame"; the learner calls him "bhai".', sit: 'You want to buy a bandhani saree for your mother and bargain on the price.' }
  ];
  let partner = PARTNERS[0], chat = null;
  function viewRehearse() {
    if (!sampler) { $view.replaceChildren(h(aiOff())); return; }
    $view.replaceChildren(h(`<div class="ex"><div class="exbar"><button class="x" data-go="talk" aria-label="Back">×</button><h2>Rehearse a conversation</h2></div>
      <p class="muted">Pick who you're talking to. You type your side in roman Gujarati (English when you're stuck). They answer in character and correct you as you go.</p>
      <div class="partners">${PARTNERS.map(pn => `<button class="partner" data-partner="${pn.id}" aria-pressed="${partner.id === pn.id}"><b>${esc(pn.name)}</b><span>${esc(pn.who.replace("the learner's", 'your'))}</span></button>`).join('')}</div>
      <label class="field"><span>Situation</span><textarea id="rhSit" rows="3">${esc(partner.sit)}</textarea></label>
      <div class="pair"><button class="secondary" data-act="rh-prep">Prep phrases first</button><button class="primary go" data-act="rh-start">Start talking</button></div>
      <div id="rhPrepOut"></div></div>`));
  }
  async function rhPrep() {
    const sit = (document.getElementById('rhSit').value || partner.sit).trim();
    const out = document.getElementById('rhPrepOut');
    out.replaceChildren(h('<p class="muted thinking">Picking the phrases you\'ll need…</p>'));
    const prompt = `${learnerContext()}
The learner is about to have this real conversation with ${partner.name} (${partner.who}): "${sit}". ${partner.reg}
Give the 6 most useful things the LEARNER will want to say, in natural spoken Kutch Leva Patel Gujarati with the right register for ${partner.name}.
${ROMAN_RULES}
Reply with only JSON: {"phrases":[{"r":"roman","gu":"Gujarati script","e":"English","note":"short usage tip"}]}`;
    try {
      const a = await sampler.json(prompt, { modelTier: 'default' });
      prepList = (a && Array.isArray(a.phrases) ? a.phrases : []).filter(x => x && x.r && x.gu).slice(0, 8).map(x => ({ r: x.r, g: x.gu, e: x.e || '', note: x.note || '', to: partner.name }));
      if (!prepList.length) throw { code: 'invalid_json' };
      out.replaceChildren(h(`<div class="list">${prepList.map((x, i) => `<div class="item"><button class="play" data-sayg="${esc(x.g)}" data-sayr="${esc(x.r)}" aria-label="Play">${I.speaker}</button><span class="r">${esc(x.r)}</span><span>${esc(x.e)}${x.note ? ` <span class="muted">· ${esc(x.note)}</span>` : ''}</span><button class="chip" data-act="save-mine" data-idx="${i}">Save</button></div>`).join('')}</div>`));
    } catch (e) { out.replaceChildren(h(`<p class="voice-warn">${esc(aiErr(e))}</p>`)); }
  }
  function rhRules(sit) {
    return `${learnerContext()}
Role-play: you are ${partner.name}, ${partner.who}, in a Kutch Leva Patel (SKLPC) family. ${partner.reg}
Situation: ${sit}
The learner is practising SPOKEN Gujarati. They write romanised Gujarati, sometimes with English words when stuck.
Every reply you give is ONLY one JSON object:
{"feedback": null or {"verdict":"great"|"ok"|"fix","note":"one or two short sentences: what was good, or what to fix (grammar, tu/tame register, verb endings, gender forms, word choice). Warm and specific.","better":"the natural roman Gujarati for what they meant, or empty string if already great","better_e":"English of better, or empty string","spice":"a more playful, quippy or clipped way to say it (only if the learner\'s style is playful; otherwise empty string)"},
 "reply":{"r":"your next line in romanised spoken Gujarati, 1-2 short sentences","gu":"the same line in Gujarati script","e":"English translation"},
 "hint":"a short English suggestion of what the learner could say next"}
Speak like a real ${partner.name}: warm, everyday Kutch Leva Patel Gujarati, simple words, the register ${partner.name} would really use. React to what the learner actually said and keep the conversation moving naturally. If they write English, give the Gujarati in "better" and carry on in Gujarati.
${ROMAN_RULES}`;
  }
  function rhStart() {
    const sit = (document.getElementById('rhSit').value || partner.sit).trim();
    chat = { sit, turns: [{ role: 'user', content: rhRules(sit) + '\n\nStart the conversation now with your first line. "feedback" must be null.' }], ctl: null, n: 0 };
    setFocus(true);
    $view.replaceChildren(h(`<div class="ex"><div class="exbar"><button class="x" data-go="talk" aria-label="End">×</button><div style="flex:1;min-width:0"><span class="eyebrow">Rehearsing with</span><h3>${esc(partner.name)}</h3></div></div>
      <p class="muted" style="font-size:14px">${esc(sit)}</p>
      <div class="row"><button class="chip" id="hideEn" aria-pressed="false">Hide English</button></div>
      <div class="chat" id="chat"></div>
      <p class="muted thinking" id="rhStatus">${esc(partner.name)} is thinking…</p>
      <div class="card hintcard" id="rhHint" hidden></div>
      <form id="rhForm" class="composer"><input id="rhIn" autocomplete="off" placeholder="Type your reply in roman Gujarati…" aria-label="Your reply"><button class="primary" type="submit" id="rhSend">Send</button></form>
      <button class="chip" data-act="rh-hint" style="justify-self:start">Stuck? Show a hint</button></div>`));
    rhCall();
  }
  async function rhCall() {
    const status = document.getElementById('rhStatus'), send = document.getElementById('rhSend');
    if (!chat) return;
    chat.ctl = new AbortController();
    status.hidden = false; send.disabled = true;
    const turns = chat.turns.length > 17 ? [chat.turns[0], ...chat.turns.slice(-16)] : chat.turns.slice();
    const mine = chat;
    try {
      const a = await sampler.json(turns, { cache: false, modelTier: 'default', signal: chat.ctl.signal });
      if (chat !== mine) return;
      if (!a || !a.reply || !a.reply.r) throw { code: 'invalid_json' };
      chat.turns.push({ role: 'assistant', content: JSON.stringify(a) });
      const youAll = document.querySelectorAll('#chat .bubble.you'), youB = youAll[youAll.length - 1];
      if (a.feedback && youB && !youB.querySelector('.fbk')) {
        const f = a.feedback, v = ['great', 'ok', 'fix'].includes(f.verdict) ? f.verdict : 'ok';
        youB.insertAdjacentHTML('afterend', `<div class="fbk ${v}"><b>${{ great: 'Shabash!', ok: 'Good', fix: 'Try this' }[v]}</b> ${esc(f.note || '')}${f.better ? `<div class="better"><b>${esc(f.better)}</b>${f.better_e ? ` · ${esc(f.better_e)}` : ''}</div>` : ''}${f.spice ? `<div class="better spice">Spice it up: <b>${esc(f.spice)}</b></div>` : ''}</div>`);
        if (chat.n) { const lv = award(v === 'great' ? 3 : 2); celebrate(checkBadges(), lv); }
      }
      const hide = document.getElementById('hideEn').getAttribute('aria-pressed') === 'true';
      document.getElementById('chat').append(h(`<div class="bubble them"><span class="who">${esc(partner.name)}</span><span class="r">${esc(a.reply.r)}</span><span class="e" ${hide ? 'hidden' : ''}>${esc(a.reply.e || '')}</span><button class="play" data-sayg="${esc(a.reply.gu || '')}" data-sayr="${esc(a.reply.r)}">▶ play</button></div>`));
      speak(a.reply.gu || '', a.reply.r, true);
      const hint = document.getElementById('rhHint'); hint.hidden = true; hint.textContent = a.hint ? 'Idea: ' + a.hint : 'Say whatever you would say. Short is fine.';
    } catch (e) {
      if (e && e.code === 'cancelled') return;
      if (chat === mine) document.getElementById('chat').append(h(`<p class="voice-warn">${esc(aiErr(e))}</p>`));
      if (chat === mine && chat.turns[chat.turns.length - 1].role === 'user' && chat.n) chat.turns.pop();
    } finally {
      if (chat === mine) { status.hidden = true; send.disabled = false; const inp = document.getElementById('rhIn'); if (inp) inp.focus({ preventScroll: true }); }
    }
  }
  function rhSend() {
    if (!chat) return;
    const inp = document.getElementById('rhIn'), txt = (inp.value || '').trim();
    if (!txt || document.getElementById('rhSend').disabled) return;
    inp.value = '';
    chat.n++; S.rehearsals = (S.rehearsals || 0) + (chat.n === 1 ? 1 : 0); save();
    document.getElementById('chat').append(h(`<div class="bubble you"><span class="who">You</span><span class="r">${esc(txt)}</span></div>`));
    chat.turns.push({ role: 'user', content: txt });
    rhCall();
  }

  const segment = on => `<div class="seg" role="tablist"><button role="tab" data-go="family" aria-selected="${on === 'family'}">Ask family</button><button role="tab" data-go="guide" aria-selected="${on === 'guide'}">Who's who</button></div>`;
  function viewGuide() {
    $view.replaceChildren(h(`<div class="ex">${segment('guide')}
      <div><h2>Who's who, and how to address them</h2><p class="muted">What you call each person, and whether they get "tu" or "tame". When in doubt, go respectful: nobody minds being called "tame".</p></div>
      ${D.guide.map(g => `<section class="card guide-card"><h3>${esc(g.group)}</h3><div class="grows">${g.rows.map(([who, say, you, note]) => `<div class="grow"><span class="gwho">${esc(who)}</span><span class="gsay">${esc(say)}</span><span class="tag ${/^tu$/.test(you) ? '' : 'resp'}">${esc(you)}</span>${note ? `<span class="gnote">${esc(note)}</span>` : ''}</div>`).join('')}</div></section>`).join('')}
      <p class="src">General Gujarati custom, not yet checked by your family. Kutch families vary, so use the Ask family tab to confirm.</p></div>`));
  }

  // ── events ─────────────────────────────────────────────
  document.addEventListener('submit', e => {
    e.preventDefault();
    if (e.target.id === 'quickAskForm') { askPrefill = document.getElementById('quickAsk').value.trim(); return route('ask'); }
    if (e.target.id === 'askForm') return askGo();
    if (e.target.id === 'rhForm') return rhSend();
  });
  const toggleGloss = el => { const g = el.querySelector('.gloss'); if (g) g.hidden = !g.hidden; };
  document.addEventListener('keydown', e => { const sl = e.target.closest && e.target.closest('.sline'); if (sl && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleGloss(sl); } });
  document.addEventListener('click', e => {
    const sl = e.target.closest('.sline'); if (sl && !e.target.closest('button')) return toggleGloss(sl);
    const t = e.target.closest('button'); if (!t || t.disabled) return;
    if (t.dataset.go) return route(t.dataset.go);
    if (t.dataset.lesson) return startLesson(t.dataset.lesson);
    if (t.dataset.chest) return openChest(t.dataset.chest, t);
    if (t.dataset.scene) return startScene(t.dataset.scene);
    if (t.dataset.act === 'start-review') return startReview();
    if (t.dataset.testout) return startTestOut(t.dataset.testout);
    if (t.dataset.act === 'level-start') return startLevel();
    if (t.dataset.act === 'gym-start') return startGym();
    if (t.dataset.act === 'quick-start') return startQuick();
    if (t.dataset.act === 'skip-basics') return skipBasics();
    if (t.dataset.goal) { S.goal = +t.dataset.goal; save(); return route('me'); }
    if (t.id === 'speakFirst') { S.speakFirst = !S.speakFirst; save(); t.setAttribute('aria-pressed', S.speakFirst); return; }
    if (t.dataset.act === 'show-choices') { scene.shown = true; return sceneStep(); }
    if (t.dataset.act === 'save-profile') return saveProfile();
    if (t.dataset.act === 'skip-profile') { S.profileSkipped = true; save(); return route('learn'); }
    if (t.dataset.to) { document.querySelectorAll('[data-to]').forEach(b => b.setAttribute('aria-pressed', b === t)); askTo = t.dataset.to; return; }
    if (t.dataset.act === 'ask-go') return askGo();
    if (t.dataset.act === 'save-mine') return saveMine(t);
    if (t.dataset.partner) { partner = PARTNERS.find(z => z.id === t.dataset.partner); return viewRehearse(); }
    if (t.dataset.act === 'rh-start') return rhStart();
    if (t.dataset.act === 'rh-send') return rhSend();
    if (t.dataset.act === 'rh-hint') { const hh = document.getElementById('rhHint'); if (hh) hh.hidden = !hh.hidden; return; }
    if (t.dataset.act === 'rh-prep') return rhPrep();
    if (t.dataset.sayg) return speak(t.dataset.sayg, t.dataset.sayr || '', true);
    if (t.dataset.pattern) return viewPattern(t.dataset.pattern);
    if (t.dataset.act === 'start-pattern') return startPattern(t.dataset.pid);
    if (t.dataset.story) return viewStory(t.dataset.story);
    if (t.dataset.act === 'next-line') return storyNext();
    if (t.dataset.act === 'story-quiz') return startStoryQuiz(t.dataset.sid);
    if (t.id === 'showGu') { const on = t.getAttribute('aria-pressed') !== 'true'; t.setAttribute('aria-pressed', on); document.querySelectorAll('.chat .gu').forEach(el => { el.hidden = !on; }); return; }
    if (t.dataset.say) { const p = byId[t.dataset.say]; return p && speakItem(p); }
    if (t.dataset.sayraw) { const st = scene.s.steps[+t.dataset.sayraw]; return speak(st.say, st.r); }
    if (t.id === 'slowBtn') { slow = !slow; t.setAttribute('aria-pressed', slow); return; }
    if (t.id === 'hideEn') { const on = t.getAttribute('aria-pressed') !== 'true'; t.setAttribute('aria-pressed', on); document.querySelectorAll('.chat .e').forEach(el => { el.hidden = on; }); return; }
    if (t.dataset.reply !== undefined) return sceneReply(+t.dataset.reply, t);
    if (t.dataset.v) {
      const [id, v] = t.dataset.v.split(':'); const cur = S.verdicts[id] || {};
      S.verdicts[id] = Object.assign(cur, { v: cur.v === v ? undefined : v, at: today() });
      if (!S.verdicts[id].v && !S.verdicts[id].note) delete S.verdicts[id];
      save(); t.parentElement.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', !!S.verdicts[id] && b.dataset.v === id + ':' + S.verdicts[id].v));
      celebrate(checkBadges(), false); return;
    }
    if (!run) return;
    const x = run.cur;
    if (t.dataset.act === 'continue') return next();
    if (t.dataset.pick !== undefined && x.t === 'choose') {
      const o = x.opts.find(z => z.r === t.dataset.pick), ok = !!(o && o.ok); t.classList.add(ok ? 'right' : 'wrong');
      if (!ok) document.querySelectorAll('.opt').forEach(b => { if (b.dataset.pick === x.answer) b.classList.add('right'); });
      return feedback(ok, t, ok ? '' : (o && o.why) || '');
    }
    if (t.dataset.act === 'recall-said' || t.dataset.act === 'recall-blank') {
      x.ms = t.dataset.act === 'recall-said' ? Math.round(performance.now() - x.t0) : null;
      document.querySelectorAll('[data-act^="recall-"]').forEach(b => { b.disabled = true; });
      if (x.ms === null) return feedback(false, t);
      t.closest('.pair').insertAdjacentElement('afterend', h(`<div class="card" id="revealCard"><span class="eyebrow">${(x.ms / 1000).toFixed(1)} s</span><div class="roman">${esc(x.v.r)}</div><p class="muted">Is that what you said?</p><div class="pair"><button class="secondary" data-act="self-no">Not quite</button><button class="primary go" data-act="self-yes">Yes</button></div></div>`).firstChild);
      speak(x.v.g, x.v.r, x.v.personalised); return;
    }
    if (t.dataset.pick !== undefined) {
      const ok = t.dataset.pick === x.answer; t.classList.add(ok ? 'right' : 'wrong');
      if (!ok) document.querySelectorAll('.opt').forEach(b => { if (b.dataset.pick === x.answer) b.classList.add('right'); });
      return feedback(ok, t);
    }
    if (t.dataset.tile !== undefined) { const i = +t.dataset.tile; x.picked.push(i); t.classList.add('used'); document.getElementById('line').append(h(`<button class="tile" data-untile="${i}">${esc(x.tiles[i])}</button>`)); return; }
    if (t.dataset.untile !== undefined) { const i = +t.dataset.untile; x.picked = x.picked.filter(z => z !== i); t.remove(); document.querySelector(`[data-tile="${i}"]`).classList.remove('used'); return; }
    if (t.dataset.act === 'check') return feedback(norm(x.picked.map(i => x.tiles[i]).join(' ')) === norm(x.t === 'chunks' ? x.chunks.join(' ') : x.v.r), t);
    if (t.dataset.act === 'reveal') {
      t.disabled = true;
      t.insertAdjacentElement('afterend', h(`<div class="card" id="revealCard"><div class="roman">${esc(x.v.r)}</div><button class="hear slow" style="width:auto;height:auto;padding:6px 12px" data-say="${x.v.id}">▶ hear it</button><p class="muted">Did you say it?</p><div class="pair"><button class="secondary" data-act="self-no">Not quite</button><button class="primary go" data-act="self-yes">I said it</button></div></div>`).firstChild);
      speak(x.v.g, x.v.r, x.v.personalised); return;
    }
    if (t.dataset.act === 'self-yes' || t.dataset.act === 'self-no') { const c = document.getElementById('revealCard'); c.querySelectorAll('button').forEach(b => { b.disabled = true; }); return feedback(t.dataset.act === 'self-yes', t); }
  });

  window.APOLLO = { state: () => S, route, current: () => run && run.cur && Object.assign({}, run.cur, { p: run.cur.v || run.cur.p }), save, audio: () => ({ map: AUDIO.map ? Object.keys(AUDIO.map).length : 0, clips: Object.keys(AUDIO.clips).length }) };
  route(location.hash.slice(1) || 'learn');
})();
