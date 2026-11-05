/* Apollo — app logic. Plain JS, no framework. */
(function () {
  'use strict';
  const D = window.APOLLO_DATA;
  const byId = Object.fromEntries(D.phrases.map(p => [p.id, p]));
  const LESSON_SIZE = 5;
  const DAILY_GOAL = 30;
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
  const blank = () => ({ xp: 0, streak: 0, lastDay: '', days: [], day: { date: today(), xp: 0 }, cards: {}, lessons: {}, scenes: {}, chests: {}, verdicts: {}, badges: {}, bestCombo: 0, perfect: 0, updated: 0 });
  const migrate = s => {
    s = Object.assign(blank(), s);
    for (const k of Object.keys(s.scenes)) if (s.scenes[k] === true) s.scenes[k] = 1;
    if (s.day.date !== today()) s.day = { date: today(), xp: 0 };
    return s;
  };
  let S = blank();
  try { const raw = localStorage.getItem(KEY); if (raw) S = migrate(JSON.parse(raw)); } catch (e) { /* storage blocked */ }

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
      if (remote && remote.updated > S.updated) { S = migrate(remote); if (!run && !scene) route(current); paintBar(); }
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
    g.innerHTML = ring(S.day.xp / DAILY_GOAL, 26, 4, '#FFD35A') + '<span>' + Math.min(S.day.xp, DAILY_GOAL) + '/' + DAILY_GOAL + '</span>';
    g.setAttribute('aria-label', `Today ${S.day.xp} of ${DAILY_GOAL} XP`);
  }

  function learn(id) { if (!S.cards[id]) S.cards[id] = { box: 1, due: addDays(today(), 1), seen: 1 }; }
  function grade(id, ok) {
    const c = S.cards[id] || (S.cards[id] = { box: 0, due: today(), seen: 0 });
    c.seen++; c.box = ok ? Math.min(c.box + 1, MAX_BOX) : 1;
    c.due = addDays(today(), ok ? BOX_DAYS[c.box] : 0);
  }
  const dueCards = () => Object.keys(S.cards).filter(id => byId[id] && S.cards[id].due <= today());

  // ── speech ─────────────────────────────────────────────
  const synth = window.speechSynthesis;
  let voices = [];
  const pickVoices = () => { try { voices = synth ? synth.getVoices() : []; } catch (e) { voices = []; } };
  if (synth) { pickVoices(); synth.onvoiceschanged = pickVoices; }
  const guVoice = () => voices.find(v => /^gu/i.test(v.lang));
  const fallbackVoice = () => voices.find(v => /en[-_]IN/i.test(v.lang)) || voices.find(v => /^en/i.test(v.lang));
  let slow = false;
  function speak(g, r) {
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
  const voiceNote = () => guVoice() ? '' :
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
  const KIND_LABEL = { standard: 'Standard', sklpc: 'SKLPC', kutchi: 'Kutchi', 'swahili-loan': 'Swahili loan' };
  const tag = p => `<span class="tag ${p.kind === 'standard' ? '' : 'dialect'}">${KIND_LABEL[p.kind] || p.kind}</span>`;
  function srcLine(p) {
    if (p.src === 'apollo:standard-core') return '<p class="src">Standard Gujarati · not yet checked by family</p>';
    return `<p class="src">${esc(p.conf)} · <a href="${esc(p.src)}" target="_blank" rel="noopener">source</a> · ${esc(p.date)}${p.std ? ' · standard: <em>' + esc(p.std) + '</em>' : ''}</p>`;
  }

  // ── tabs & routing ─────────────────────────────────────
  const TABS = [['learn', 'Learn', 'home'], ['talk', 'Talk', 'talk'], ['review', 'Review', 'review'], ['family', 'Family', 'family'], ['me', 'Me', 'me']];
  let current = 'learn';
  function paintTabs() {
    const due = dueCards().length;
    document.getElementById('tabs').replaceChildren(h(TABS.map(([id, label, ic]) =>
      `<button class="tab" data-go="${id}" ${(current === id || (current === 'book' && id === 'me') || (current === 'guide' && id === 'family')) ? 'aria-current="page"' : ''}>${I[ic]}${label}${id === 'review' && due ? `<span class="dot">${due}</span>` : ''}</button>`).join('')));
  }
  function setFocus(on) { document.body.classList.toggle('focus', on); document.querySelector('main').classList.toggle('focus', on); }
  function route(to) {
    try { synth && synth.cancel(); } catch (e) { /* */ }
    run = null; scene = null; setFocus(false);
    current = ['learn', 'talk', 'review', 'family', 'guide', 'me', 'book'].includes(to) ? to : 'learn';
    try { if (location.hash.slice(1) !== current) history.replaceState(null, '', '#' + current); } catch (e) { /* */ }
    ({ learn: viewLearn, talk: viewTalk, review: viewReview, family: () => viewBook(true), guide: viewGuide, me: viewMe, book: () => viewBook(false) })[current]();
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
  function viewLearn() {
    const pod = phraseOfDay();
    const due = dueCards().length;
    const lessonsDone = Object.keys(S.lessons).length;
    const status = !lessonsDone ? "Tap the glowing circle to start your first lesson." :
      due ? `${due} phrase${due === 1 ? '' : 's'} ready to review. Keep them fresh.` :
      S.day.xp >= DAILY_GOAL ? 'Daily goal done. Shabash!' : `${DAILY_GOAL - S.day.xp} XP to today's goal.`;
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
      <div class="today">
        ${ring(S.day.xp / DAILY_GOAL, 64, 8, 'var(--turmeric)', `<text x="32" y="37" text-anchor="middle" font-family="Baloo Bhai 2, sans-serif" font-weight="800" font-size="15" fill="currentColor">${Math.min(100, Math.round(100 * S.day.xp / DAILY_GOAL))}%</text>`)}
        <div><h3>${esc(status)}</h3><div class="week" aria-label="This week">${week}</div></div>
      </div>
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
      <div class="card"><h3>This week</h3><div class="week">${days.map(d => `<i class="${S.days.includes(d) ? 'on' : ''} ${d === today() ? 'now' : ''}">${'SMTWTFS'[new Date(d + 'T00:00:00').getDay()]}</i>`).join('')}</div></div>
      <div class="card"><h3>Badges · ${Object.keys(S.badges).length}/${BADGES.length}</h3>
        <div class="badges">${BADGES.map(b => `<div class="badge ${S.badges[b.id] ? '' : 'locked'}">${medal(b, !S.badges[b.id])}<b>${esc(b.name)}</b><span class="muted">${esc(b.desc)}</span></div>`).join('')}</div>
      </div>
      <button class="secondary" data-go="book">Open the phrasebook</button>`));
  }

  // ── exercise engine ────────────────────────────────────
  let run = null;
  function distractors(p, field, n) {
    const pool = shuffle(D.phrases.filter(q => q.id !== p.id && q[field] !== p[field]));
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
  function startRun(r) { run = Object.assign({ done: 0, right: 0, wrong: 0, combo: 0, best: 0, xp: 0, wrongOnce: new Set() }, r); run.total = run.queue.length; setFocus(true); next(); }
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
    return h(`<div class="ex"><div class="exbar"><button class="x" data-go="${run.kind === 'review' ? 'review' : 'learn'}" aria-label="Quit">×</button><div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div><span class="combo" id="combo">${run.combo >= 2 ? I.flame + run.combo : ''}</span></div>${inner}<div id="fb"></div><div style="height:220px" aria-hidden="true"></div></div>`);
  }
  const playRow = p => `<div class="playrow"><button class="big-play" data-say="${p.id}" aria-label="Play">${I.speaker}</button><button class="slow" id="slowBtn" aria-pressed="${slow}" aria-label="Slow playback">${I.turtle}</button></div>`;
  function next() {
    if (!run.queue.length) return finish();
    const x = run.queue.shift(); run.cur = x;
    const p = x.p;
    if (x.t === 'intro') {
      $view.replaceChildren(frame(`<span class="eyebrow">New phrase</span><div class="card learn" style="--c:${unitColor(p.unit)}"><div class="row">${tag(p)}</div><div class="roman">${esc(p.r)}</div><div class="meaning">${esc(p.e)}</div>${p.note ? `<p class="note">${esc(p.note)}</p>` : ''}${srcLine(p)}</div>${playRow(p)}<p class="muted">Listen, then say it out loud twice.</p>${voiceNote()}<button class="primary" data-act="continue">Got it</button>`));
      speak(p.g, p.r); return;
    }
    if (x.t === 'listen') {
      const opts = shuffle([p.e, ...distractors(p, 'e', 3)]);
      $view.replaceChildren(frame(`<span class="eyebrow">What did you hear?</span>${playRow(p)}<div class="opts">${opts.map(o => `<button class="opt" data-pick="${esc(o)}">${esc(o)}</button>`).join('')}</div>`));
      x.answer = p.e; speak(p.g, p.r); return;
    }
    if (x.t === 'meaning') {
      const opts = shuffle([p.r, ...distractors(p, 'r', 3)]);
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
    $view.replaceChildren(frame(`<span class="eyebrow">Say it out loud</span><p class="prompt">${esc(p.e)}</p><p class="muted">Say it in Gujarati, out loud, then reveal and be honest.</p><button class="primary" data-act="reveal">Reveal</button>`));
  }
  const CHEERS = [['Saras!', 'Nice!'], ['Shabash!', 'Well done!'], ['Waah!', 'Wow!'], ['Bahu saras!', 'Very good!'], ['Ekdum barabar!', 'Spot on!']];
  function feedback(ok, anchor) {
    const x = run.cur, p = x.p;
    if (x.review || run.kind === 'review') grade(p.id, ok);
    let gain = 0;
    if (ok) {
      run.right++; run.combo++; run.best = Math.max(run.best, run.combo);
      gain = run.combo >= 5 ? 2 : 1; run.xp += gain;
      sfx.right(run.combo); xpPop(gain, anchor);
    } else {
      run.wrong++; run.combo = 0; sfx.wrong();
      if (!run.wrongOnce.has(p.id + x.t)) { run.wrongOnce.add(p.id + x.t); run.queue.push(Object.assign({}, x)); run.total++; }
    }
    run.done++;
    const bar = document.querySelector('.progress'); bar.querySelector('i').style.width = Math.round(100 * run.done / run.total) + '%'; bar.setAttribute('aria-valuenow', Math.round(100 * run.done / run.total));
    const cb = document.getElementById('combo'); cb.innerHTML = run.combo >= 2 ? I.flame + run.combo : ''; if (run.combo >= 2) { cb.classList.remove('hot'); void cb.offsetWidth; cb.classList.add('hot'); }
    document.querySelectorAll('.opt, .tile, [data-act="check"], [data-act="reveal"]').forEach(b => { b.disabled = true; });
    const [gu, en] = ok ? CHEERS[Math.floor(Math.random() * CHEERS.length)] : ['Koi vaandho nahi', 'No problem. Here it is'];
    const comboNote = ok && run.combo >= 5 ? ` · ${run.combo} in a row, double XP` : '';
    document.getElementById('fb').replaceChildren(h(`<div class="sheet feedback ${ok ? 'good' : 'bad'}"><div class="col gut">
      <div class="cheer">${ok ? I.check : ''}${gu} <small>${en}${comboNote}</small></div>
      <div class="ans"><b>${esc(p.r)}</b> · ${esc(p.e)}</div>
      <button class="hear" data-say="${p.id}">▶ hear it</button>
      <button class="primary ${ok ? 'go' : 'warn'}" data-act="continue">Continue</button></div></div>`));
    document.querySelector('#fb [data-act="continue"]').focus({ preventScroll: true });
    if (!ok) speak(p.g, p.r);
  }
  function finish() {
    const r = run;
    let bonus = 0;
    if (r.kind === 'lesson') {
      r.newIds.forEach(learn);
      bonus = S.lessons[r.key] ? 5 : 10;
      S.lessons[r.key] = true;
    }
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
      <span class="eyebrow">${r.kind === 'lesson' ? (perfect ? 'Flawless lesson' : 'Lesson complete') : 'Review complete'}</span>
      <h2>${perfect ? 'Ekdum barabar!' : 'Shabash!'}</h2>
      <div class="bigstats">
        <div class="bigstat"><b style="color:var(--gold)" id="xpCount">+0</b><span>XP earned</span></div>
        <div class="bigstat"><b>${acc}%</b><span>accuracy</span></div>
        <div class="bigstat"><b>${r.best}</b><span>best combo</span></div>
      </div>
      ${lv ? `<div class="card unlock"><div class="medal" style="--c:var(--turmeric)">${I.bolt}</div><div><b>Level ${levelOf(S.xp)}</b><p class="muted">${esc(titleOf(levelOf(S.xp)))}</p></div></div>` : ''}
      ${fresh.map(b => `<div class="card unlock">${medal(b, false)}<div><b>${esc(b.name)}</b><p class="muted">${esc(b.desc)}</p></div></div>`).join('')}
      <p class="muted">Try one of these on someone at home today.</p>
      <button class="primary go" data-go="${r.kind === 'review' ? 'review' : 'learn'}">Continue</button>
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
    $view.replaceChildren(h(`<div class="ex"><div class="exbar"><button class="x" data-go="talk" aria-label="Quit">×</button><div style="flex:1;min-width:0"><h3>${esc(s.title)}</h3><span class="muted" style="font-size:14px">${esc(s.where)}</span></div></div>${voiceNote()}<div class="row"><button class="chip" id="hideEn" aria-pressed="false">Hide English</button><button class="chip" id="slowBtn" aria-pressed="${slow}">Slow audio</button></div><div class="chat" id="chat"></div><div id="choices" class="opts"></div></div>`));
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
    shuffle(st.reply.map((o, k) => ({ o, k }))).forEach(({ o, k }) => choices.append(h(`<button class="opt" data-reply="${k}">${esc(o.r)}<br><span class="muted" style="font-size:14px">${esc(o.e)}</span></button>`)));
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
    document.getElementById('chat').append(h(`<div class="bubble you"><span class="who">You</span><span class="r">${esc(o.r)}</span><span class="e" ${hide ? 'hidden' : ''}>${esc(o.e)}</span></div>`));
    scene.i++; sceneStep();
  }

  // ── phrasebook & family ────────────────────────────────
  let bookFilter = 'all';
  function viewBook(family) {
    const kinds = ['all', 'standard', 'sklpc', 'kutchi', 'swahili-loan'].filter(k => k === 'all' || D.phrases.some(p => p.kind === k));
    if (family && bookFilter === 'all') bookFilter = 'dialect';
    if (!family && bookFilter === 'dialect') bookFilter = 'all';
    const dialect = D.phrases.filter(p => p.kind !== 'standard');
    const checked = dialect.filter(p => S.verdicts[p.id] && S.verdicts[p.id].v).length;
    const chips = (family ? ['dialect', ...kinds] : kinds).map(k => `<button class="chip" data-kind="${k}" aria-pressed="${bookFilter === k}">${k === 'all' ? 'All' : k === 'dialect' ? 'Dialect first' : KIND_LABEL[k]}</button>`).join('');
    $view.replaceChildren(h(`<div class="ex">
      ${family ? segment('family') : ''}
      ${family ? `<div class="card" style="grid-template-columns:auto minmax(0,1fr);align-items:center">
          <div style="color:var(--ok)">${ring(checked / Math.max(1, dialect.length), 64, 8, 'var(--ok)', `<text x="32" y="37" text-anchor="middle" font-family="Baloo Bhai 2, sans-serif" font-weight="800" font-size="14" fill="currentColor">${checked}/${dialect.length}</text>`)}</div>
          <div><h2>Ask family</h2><p class="muted">Say each phrase to a parent or grandparent. Mark ✓ if that's how your family says it, ✗ if not, and write what they say instead. This outranks every source in the app.</p></div>
        </div><button class="secondary" id="copyVerdicts">Copy results</button>`
      : `<div class="exbar"><button class="x" data-go="me" aria-label="Back">×</button><h2>Phrasebook</h2></div>`}
      <input class="search" id="q" type="search" placeholder="Search English or Gujarati…" aria-label="Search phrases">
      <div class="toolbar">${chips}</div>
      <div class="list" id="list"></div>${voiceNote()}</div>`));
    const paint = () => {
      const q = norm(document.getElementById('q').value);
      let items = D.phrases.filter(p => (bookFilter === 'all' || bookFilter === 'dialect' || p.kind === bookFilter) && (!q || norm(p.r + ' ' + p.e).includes(q)));
      if (bookFilter === 'dialect') items = [...items.filter(p => p.kind !== 'standard'), ...items.filter(p => p.kind === 'standard')];
      document.getElementById('list').replaceChildren(h(items.map(p => {
        const v = S.verdicts[p.id] || {};
        return `<div class="item"><button class="play" data-say="${p.id}" aria-label="Play ${esc(p.r)}">${I.speaker}</button><div class="row"><span class="r">${esc(p.r)}</span>${tag(p)}</div><div>${esc(p.e)}</div>${srcLine(p)}${family ? `<div class="verdict"><button class="yes" data-v="${p.id}:yes" aria-pressed="${v.v === 'yes'}">✓ we say this</button><button class="no" data-v="${p.id}:no" aria-pressed="${v.v === 'no'}">✗ not us</button><input data-note="${p.id}" value="${esc(v.note || '')}" placeholder="We say…" aria-label="What your family says instead"></div>` : ''}</div>`;
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

  const segment = on => `<div class="seg" role="tablist"><button role="tab" data-go="family" aria-selected="${on === 'family'}">Ask family</button><button role="tab" data-go="guide" aria-selected="${on === 'guide'}">Who's who</button></div>`;
  function viewGuide() {
    $view.replaceChildren(h(`<div class="ex">${segment('guide')}
      <div><h2>Who's who, and how to address them</h2><p class="muted">What you call each person, and whether they get "tu" or "tame". When in doubt, go respectful: nobody minds being called "tame".</p></div>
      ${D.guide.map(g => `<section class="card guide-card"><h3>${esc(g.group)}</h3><div class="grows">${g.rows.map(([who, say, you, note]) => `<div class="grow"><span class="gwho">${esc(who)}</span><span class="gsay">${esc(say)}</span><span class="tag ${/^tu$/.test(you) ? '' : 'resp'}">${esc(you)}</span>${note ? `<span class="gnote">${esc(note)}</span>` : ''}</div>`).join('')}</div></section>`).join('')}
      <p class="src">General Gujarati custom, not yet checked by your family. Kutch families vary, so use the Ask family tab to confirm.</p></div>`));
  }

  // ── events ─────────────────────────────────────────────
  document.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t || t.disabled) return;
    if (t.dataset.go) return route(t.dataset.go);
    if (t.dataset.lesson) return startLesson(t.dataset.lesson);
    if (t.dataset.chest) return openChest(t.dataset.chest, t);
    if (t.dataset.scene) return startScene(t.dataset.scene);
    if (t.dataset.act === 'start-review') return startReview();
    if (t.dataset.say) { const p = byId[t.dataset.say]; return speak(p.g, p.r); }
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
    if (t.dataset.pick !== undefined) {
      const ok = t.dataset.pick === x.answer; t.classList.add(ok ? 'right' : 'wrong');
      if (!ok) document.querySelectorAll('.opt').forEach(b => { if (b.dataset.pick === x.answer) b.classList.add('right'); });
      return feedback(ok, t);
    }
    if (t.dataset.tile !== undefined) { const i = +t.dataset.tile; x.picked.push(i); t.classList.add('used'); document.getElementById('line').append(h(`<button class="tile" data-untile="${i}">${esc(x.tiles[i])}</button>`)); return; }
    if (t.dataset.untile !== undefined) { const i = +t.dataset.untile; x.picked = x.picked.filter(z => z !== i); t.remove(); document.querySelector(`[data-tile="${i}"]`).classList.remove('used'); return; }
    if (t.dataset.act === 'check') return feedback(norm(x.picked.map(i => x.tiles[i]).join(' ')) === norm(x.p.r), t);
    if (t.dataset.act === 'reveal') {
      t.disabled = true;
      t.insertAdjacentElement('afterend', h(`<div class="card" id="revealCard"><div class="roman">${esc(x.p.r)}</div><button class="hear slow" style="width:auto;height:auto;padding:6px 12px" data-say="${x.p.id}">▶ hear it</button><p class="muted">Did you say it?</p><div class="pair"><button class="secondary" data-act="self-no">Not quite</button><button class="primary go" data-act="self-yes">I said it</button></div></div>`).firstChild);
      speak(x.p.g, x.p.r); return;
    }
    if (t.dataset.act === 'self-yes' || t.dataset.act === 'self-no') { const c = document.getElementById('revealCard'); c.querySelectorAll('button').forEach(b => { b.disabled = true; }); return feedback(t.dataset.act === 'self-yes', t); }
  });

  window.APOLLO = { state: () => S, route, current: () => run && run.cur, save };
  route(location.hash.slice(1) || 'learn');
})();
