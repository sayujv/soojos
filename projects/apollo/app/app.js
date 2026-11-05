/* Apollo — app logic. Plain JS, no framework. */
(function () {
  'use strict';
  const D = window.APOLLO_DATA;
  const byId = Object.fromEntries(D.phrases.map(p => [p.id, p]));
  const LESSON_SIZE = 5;
  const DAILY_GOAL = 30;
  const BOX_DAYS = [0, 1, 3, 7, 14, 30, 60];
  const $view = document.getElementById('view');

  // ── utilities ──────────────────────────────────────────
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content; };
  const norm = s => s.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
  const unitPhrases = uid => D.phrases.filter(p => p.unit === uid);
  const lessonsOf = uid => { const ps = unitPhrases(uid), out = []; for (let i = 0; i < ps.length; i += LESSON_SIZE) out.push(ps.slice(i, i + LESSON_SIZE)); return out; };

  // ── state (localStorage now, artifact db when available) ───
  const KEY = 'apollo.v1';
  const blank = () => ({ xp: 0, streak: 0, lastDay: '', day: { date: today(), xp: 0 }, cards: {}, lessons: {}, scenes: {}, verdicts: {}, updated: 0 });
  let S = blank();
  try { const raw = localStorage.getItem(KEY); if (raw) S = Object.assign(blank(), JSON.parse(raw)); } catch (e) { /* storage blocked */ }
  if (S.day.date !== today()) S.day = { date: today(), xp: 0 };

  let db = null, docRef = null, saveTimer = null;
  function save() {
    S.updated = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
    if (docRef) { clearTimeout(saveTimer); saveTimer = setTimeout(() => docRef.set(JSON.parse(JSON.stringify(S))).catch(() => {}), 1200); }
  }
  (async function connect() {
    try {
      if (!window.claude || !window.claude.use) return;
      const [dbNs, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!dbNs || !user) return;
      const uid = await user.id();
      if (!uid) return;
      db = dbNs; docRef = db.doc('progress/' + uid);
      const snap = await docRef.get();
      const remote = snap && (snap.data ? snap.data() : snap);
      if (remote && remote.updated > S.updated) { S = Object.assign(blank(), remote); if (S.day.date !== today()) S.day = { date: today(), xp: 0 }; route(); }
      else save();
    } catch (e) { /* stay local */ }
  })();

  function award(n) {
    const t = today();
    if (S.lastDay !== t) { S.streak = S.lastDay === addDays(t, -1) ? S.streak + 1 : 1; S.lastDay = t; }
    S.xp += n; S.day.xp += n; save(); paintStats();
  }
  function paintStats() { document.getElementById('xp').textContent = S.xp; document.getElementById('streak').textContent = S.lastDay === today() || S.lastDay === addDays(today(), -1) ? S.streak : 0; }

  function learn(id) { if (!S.cards[id]) S.cards[id] = { box: 1, due: addDays(today(), 1), seen: 1 }; }
  function grade(id, ok) {
    const c = S.cards[id] || (S.cards[id] = { box: 0, due: today(), seen: 0 });
    c.seen++; c.box = ok ? Math.min(c.box + 1, BOX_DAYS.length - 1) : 1;
    c.due = addDays(today(), ok ? BOX_DAYS[c.box] : 0);
  }
  const dueCards = () => Object.keys(S.cards).filter(id => byId[id] && S.cards[id].due <= today());

  // ── speech ─────────────────────────────────────────────
  const synth = window.speechSynthesis;
  let voices = [];
  const pickVoices = () => { voices = synth ? synth.getVoices() : []; };
  if (synth) { pickVoices(); synth.onvoiceschanged = pickVoices; }
  const guVoice = () => voices.find(v => /^gu/i.test(v.lang));
  const inVoice = () => voices.find(v => /en[-_]IN/i.test(v.lang)) || voices.find(v => /^hi/i.test(v.lang) && false) || voices.find(v => /^en/i.test(v.lang));
  let slow = false;
  function speak(g, r) {
    if (!synth) return;
    synth.cancel();
    const gv = guVoice();
    const u = new SpeechSynthesisUtterance(gv ? g : r.replace(/\?/g, ''));
    const v = gv || inVoice(); if (v) { u.voice = v; u.lang = v.lang; }
    u.rate = slow ? 0.6 : 0.9;
    synth.speak(u);
  }
  const voiceNote = () => guVoice() ? '' :
    '<p class="voice-warn">No Gujarati voice on this device, so audio reads the English spelling in an Indian-English voice. That is only a rough guide. On iPhone, add a Gujarati voice under Settings → Accessibility → Spoken Content → Voices, if your iOS version offers one.</p>';

  // ── sounds ─────────────────────────────────────────────
  let ac = null;
  function chime(ok) {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain(); o.connect(g); g.connect(ac.destination);
      const t = ac.currentTime; o.type = 'sine';
      if (ok) { o.frequency.setValueAtTime(660, t); o.frequency.setValueAtTime(880, t + .09); } else { o.frequency.setValueAtTime(220, t); }
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.15, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .28);
      o.start(t); o.stop(t + .3);
    } catch (e) { /* no audio */ }
  }

  // ── badges & source ────────────────────────────────────
  const KIND_LABEL = { standard: 'Standard', sklpc: 'SKLPC', kutchi: 'Kutchi', 'swahili-loan': 'Swahili loan' };
  const badge = p => `<span class="tag ${p.kind === 'standard' ? '' : 'dialect'}">${KIND_LABEL[p.kind] || p.kind}</span>`;
  function srcLine(p) {
    if (p.src === 'apollo:standard-core') return '<p class="src">Standard Gujarati · not yet checked by family</p>';
    return `<p class="src">${esc(p.conf)} · <a href="${esc(p.src)}" target="_blank" rel="noopener">source</a> · ${esc(p.date)}${p.std ? ' · standard: <em>' + esc(p.std) + '</em>' : ''}</p>`;
  }

  // ── home ───────────────────────────────────────────────
  let bookFilter = 'all';
  function home() {
    paintStats();
    const due = dueCards().length;
    const learned = Object.keys(S.cards).length;
    const pct = Math.min(100, Math.round(100 * S.day.xp / DAILY_GOAL));
    const units = D.units.map(u => {
      const ls = lessonsOf(u.id);
      if (!ls.length) return `<section class="unit"><div class="unit-head"><div><h3>${esc(u.title)} ${u.id === 'kutch' ? '<span class="tag dialect">Dialect</span>' : ''}</h3><p class="muted">${esc(u.blurb)}. Phrases are being added from research.</p></div></div></section>`;
      const doneN = ls.filter((_, i) => S.lessons[u.id + ':' + i]).length;
      const nodes = ls.map((_, i) => {
        const done = S.lessons[u.id + ':' + i];
        const next = !done && i === doneN;
        return `<button class="node ${done ? 'done' : ''} ${next ? 'next' : ''}" data-lesson="${u.id}:${i}" aria-label="${esc(u.title)} lesson ${i + 1}${done ? ', done' : ''}">${done ? '✓' : i + 1}</button>`;
      }).join('');
      return `<section class="unit"><div class="unit-head"><div><h3>${esc(u.title)} ${u.id === 'kutch' ? '<span class="tag dialect">Dialect</span>' : ''}</h3><p class="muted">${esc(u.blurb)} · ${doneN}/${ls.length}</p></div></div><div class="nodes">${nodes}</div></section>`;
    }).join('');
    const scenes = D.scenes.map(s => `<button class="scene-card ${S.scenes[s.id] ? 'done' : ''}" data-scene="${s.id}"><h3>${esc(s.title)}</h3><span class="muted">${esc(s.where)}</span></button>`).join('');
    $view.replaceChildren(h(`
      <div class="goal"><div class="row"><span class="eyebrow">Today</span><span class="muted" style="margin-left:auto">${S.day.xp} / ${DAILY_GOAL} XP</span></div><div class="meter"><i style="width:${pct}%"></i></div></div>
      <div class="quick">
        <button class="qbtn" data-go="review"><strong>${due}</strong><span>to review</span></button>
        <button class="qbtn" data-go="book"><strong>${learned}</strong><span>phrases known</span></button>
        <button class="qbtn" data-go="family"><strong>${Object.keys(S.verdicts).length}</strong><span>family checked</span></button>
      </div>
      <h2>Talk it through</h2>
      <div class="scenes">${scenes}</div>
      <h2>Lessons</h2>
      ${units}
      <p class="src">Phrases come from public sources wherever possible. Anything marked "Standard" is textbook Gujarati that your family hasn't checked yet. Use the Ask family tab to mark what they actually say.</p>
    `));
  }

  // ── exercise engine ────────────────────────────────────
  // A run is a queue of exercise objects; wrong answers are re-queued once.
  let run = null;
  function distractors(p, field, n) {
    const pool = shuffle(D.phrases.filter(q => q.id !== p.id && q[field] !== p[field]));
    const same = pool.filter(q => q.unit === p.unit);
    const pick = [...same, ...pool].filter((q, i, a) => a.findIndex(z => z[field] === q[field]) === i).slice(0, n);
    return pick.map(q => q[field]);
  }
  function buildExercises(newOnes, reviewIds) {
    const ex = [];
    newOnes.forEach(p => ex.push({ t: 'intro', p }));
    const mix = [];
    newOnes.forEach(p => {
      mix.push({ t: 'listen', p });
      mix.push({ t: 'meaning', p });
      if (p.r.split(' ').length >= 3) mix.push({ t: 'build', p });
      else mix.push({ t: 'say', p });
    });
    reviewIds.forEach(id => mix.push({ t: shuffle(['listen', 'meaning', 'say'])[0], p: byId[id], review: true }));
    return ex.concat(shuffle(mix));
  }
  function startLesson(key) {
    const [uid, idx] = key.split(':');
    const ps = lessonsOf(uid)[+idx];
    const pastIds = shuffle(Object.keys(S.cards).filter(id => !ps.find(p => p.id === id))).slice(0, 3);
    run = { kind: 'lesson', key, queue: buildExercises(ps, pastIds), total: 0, done: 0, right: 0, wrongOnce: new Set(), newIds: ps.map(p => p.id) };
    run.total = run.queue.length; next();
  }
  function startReview() {
    const ids = shuffle(dueCards()).slice(0, 15);
    if (!ids.length) { $view.replaceChildren(h(`<div class="ex"><div class="done-hero"><h2>Nothing due right now</h2><p class="muted">Every phrase you know is fresh. Do a lesson or a scene instead.</p></div><button class="primary" data-go="home">Back</button></div>`)); return; }
    run = { kind: 'review', queue: ids.map(id => ({ t: shuffle(['listen', 'meaning', 'say', 'say'])[0], p: byId[id], review: true })), total: ids.length, done: 0, right: 0, wrongOnce: new Set() };
    next();
  }
  function frame(inner, opts) {
    const pct = Math.round(100 * run.done / Math.max(1, run.total));
    return h(`<div class="ex"><div class="topbar"><button class="x" data-go="home" aria-label="Quit">×</button><div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div></div>${inner}<div id="fb"></div></div>`);
  }
  function next() {
    if (!run.queue.length) return finish();
    const x = run.queue.shift(); run.cur = x;
    const p = x.p;
    const playRow = `<div class="row"><button class="big-play" data-say="${p.id}" aria-label="Play">▶</button><button class="slow" id="slowBtn" aria-pressed="${slow}">🐢 slow</button></div>`;
    if (x.t === 'intro') {
      $view.replaceChildren(frame(`<span class="eyebrow">New phrase</span><div class="card"><div class="row">${badge(p)}</div><div class="roman">${esc(p.r)}</div><div class="meaning">${esc(p.e)}</div>${p.note ? `<p class="note">${esc(p.note)}</p>` : ''}${srcLine(p)}</div>${playRow}<p class="muted">Listen, then say it out loud twice.</p>${voiceNote()}<button class="primary" data-act="continue">Got it</button>`));
      speak(p.g, p.r); return;
    }
    if (x.t === 'listen') {
      const opts = shuffle([p.e, ...distractors(p, 'e', 3)]);
      $view.replaceChildren(frame(`<span class="eyebrow">What did you hear?</span>${playRow}<div class="opts">${opts.map(o => `<button class="opt" data-pick="${esc(o)}">${esc(o)}</button>`).join('')}</div>`));
      x.answer = p.e; speak(p.g, p.r); return;
    }
    if (x.t === 'meaning') {
      const opts = shuffle([p.r, ...distractors(p, 'r', 3)]);
      $view.replaceChildren(frame(`<span class="eyebrow">How do you say…</span><p class="prompt">${esc(p.e)}</p><div class="opts">${opts.map(o => `<button class="opt" data-pick="${esc(o)}">${esc(o)}</button>`).join('')}</div>`));
      x.answer = p.r; return;
    }
    if (x.t === 'build') {
      const words = p.r.replace(/[?!.,]/g, '').split(' ');
      const extra = shuffle(D.phrases.flatMap(q => q.r.replace(/[?!.,]/g, '').split(' ')).filter(w => !words.includes(w))).slice(0, 3);
      x.tiles = shuffle([...words, ...extra]); x.picked = [];
      $view.replaceChildren(frame(`<span class="eyebrow">Build it</span><p class="prompt">${esc(p.e)}</p><div class="answer-line" id="line"></div><div class="tiles">${x.tiles.map((w, i) => `<button class="tile" data-tile="${i}">${esc(w)}</button>`).join('')}</div><button class="primary" data-act="check">Check</button>`));
      return;
    }
    if (x.t === 'say') {
      $view.replaceChildren(frame(`<span class="eyebrow">Say it out loud</span><p class="prompt">${esc(p.e)}</p><p class="muted">Say it in Gujarati, out loud, then reveal.</p><button class="primary" data-act="reveal">Reveal</button>`));
    }
  }
  function feedback(ok, extraHtml) {
    const x = run.cur, p = x.p;
    chime(ok);
    if (ok) run.right++;
    if (x.review || run.kind === 'review') grade(p.id, ok);
    if (!ok && !run.wrongOnce.has(p.id + x.t)) { run.wrongOnce.add(p.id + x.t); run.queue.push(Object.assign({}, x)); run.total++; }
    run.done++;
    document.querySelectorAll('.opt, .tile, [data-act="check"], [data-act="reveal"]').forEach(b => { b.disabled = true; });
    const fb = document.getElementById('fb');
    fb.replaceChildren(h(`<div class="feedback ${ok ? 'good' : 'bad'}"><strong>${ok ? 'Correct!' : 'Not quite'}</strong><div class="ans"><b>${esc(p.r)}</b> · ${esc(p.e)}</div>${extraHtml || ''}<div class="row"><button class="slow" data-say="${p.id}">▶ hear it</button></div><button class="primary" data-act="continue">Continue</button></div>`));
    fb.querySelector('[data-act="continue"]').focus();
    if (!ok) speak(p.g, p.r);
  }
  function finish() {
    let gained = 0;
    if (run.kind === 'lesson') {
      run.newIds.forEach(learn);
      const first = !S.lessons[run.key];
      S.lessons[run.key] = true;
      gained = (first ? 10 : 5) + run.right;
    } else gained = run.right;
    award(gained);
    const acc = Math.round(100 * run.right / Math.max(1, run.done));
    $view.replaceChildren(h(`<div class="ex"><div class="done-hero"><span class="eyebrow">${run.kind === 'lesson' ? 'Lesson complete' : 'Review complete'}</span><div class="xp">+${gained} XP</div><p class="muted">${acc}% first-time accuracy · streak ${S.streak} day${S.streak === 1 ? '' : 's'}</p><p>Try one of these on someone at home today.</p></div><button class="primary" data-go="home">Continue</button></div>`));
    run = null;
  }

  // ── scenes ─────────────────────────────────────────────
  let scene = null;
  function startScene(id) {
    const s = D.scenes.find(z => z.id === id);
    scene = { s, i: 0, right: 0, firstTry: true, html: '' };
    $view.replaceChildren(h(`<div class="ex"><div class="topbar"><button class="x" data-go="home" aria-label="Quit">×</button><div><h2>${esc(s.title)}</h2><span class="muted">${esc(s.where)}</span></div></div>${voiceNote()}<div class="row"><button class="chip" id="hideEn" aria-pressed="false">Hide English</button><button class="slow" id="slowBtn" aria-pressed="${slow}">🐢 slow</button></div><div class="chat" id="chat"></div><div id="choices" class="opts"></div></div>`));
    sceneStep();
  }
  function sceneStep() {
    const { s } = scene; const chat = document.getElementById('chat'), choices = document.getElementById('choices');
    choices.replaceChildren();
    while (scene.i < s.steps.length && s.steps[scene.i].say) {
      const st = s.steps[scene.i];
      chat.append(h(`<div class="bubble them"><span class="who">${esc(s.who)}</span><span class="r">${esc(st.r)}</span><span class="e">${esc(st.e)}</span><button class="play" data-sayraw="${scene.i}">▶ play</button></div>`));
      if (!scene.spokeAt || scene.spokeAt !== scene.i) { scene.spokeAt = scene.i; speak(st.say, st.r); }
      scene.i++;
    }
    if (scene.i >= s.steps.length) {
      S.scenes[s.id] = true; award(15 + scene.right * 2);
      choices.append(h(`<div class="feedback good"><strong>Conversation done! +${15 + scene.right * 2} XP</strong><span class="ans">${scene.right} of ${s.steps.filter(z => z.reply).length} replies right first time.</span><button class="primary" data-go="home">Back home</button></div>`));
      return;
    }
    const st = s.steps[scene.i]; scene.firstTry = true;
    shuffle(st.reply.map((o, k) => ({ o, k }))).forEach(({ o, k }) => choices.append(h(`<button class="opt" data-reply="${k}">${esc(o.r)}<br><span class="muted" style="font-size:14px">${esc(o.e)}</span></button>`)));
    chat.lastElementChild && chat.lastElementChild.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function sceneReply(k, btn) {
    const st = scene.s.steps[scene.i], o = st.reply[k];
    if (!o.ok) {
      chime(false); btn.classList.add('wrong'); btn.disabled = true; scene.firstTry = false;
      btn.insertAdjacentHTML('beforeend', `<br><span style="font-size:14px">${esc(o.why || 'Try another.')}</span>`);
      return;
    }
    chime(true); if (scene.firstTry) scene.right++;
    document.getElementById('chat').append(h(`<div class="bubble you"><span class="who">You</span><span class="r">${esc(o.r)}</span><span class="e">${esc(o.e)}</span></div>`));
    scene.i++; sceneStep();
  }

  // ── phrasebook & ask-family ────────────────────────────
  function book(family) {
    const kinds = ['all', 'standard', 'sklpc', 'kutchi', 'swahili-loan'].filter(k => k === 'all' || D.phrases.some(p => p.kind === k));
    $view.replaceChildren(h(`<div class="ex"><div class="topbar"><button class="x" data-go="home" aria-label="Back">×</button><h2>${family ? 'Ask family' : 'Phrasebook'}</h2></div>
      ${family ? '<p class="muted">Say each phrase to a parent or grandparent. Mark ✓ if that\'s how your family says it, ✗ if not, and write what they say instead. This outranks every source in the app.</p><button class="secondary" id="copyVerdicts">Copy results</button>' : ''}
      <input class="search" id="q" type="search" placeholder="Search English or Gujarati…" aria-label="Search phrases">
      <div class="toolbar">${kinds.map(k => `<button class="chip" data-kind="${k}" aria-pressed="${bookFilter === k}">${k === 'all' ? 'All' : KIND_LABEL[k]}</button>`).join('')}</div>
      <div class="list" id="list"></div>${voiceNote()}</div>`));
    const paint = () => {
      const q = norm(document.getElementById('q').value);
      const items = D.phrases.filter(p => (bookFilter === 'all' || p.kind === bookFilter) && (!q || norm(p.r + ' ' + p.e).includes(q)));
      document.getElementById('list').replaceChildren(h(items.map(p => {
        const v = S.verdicts[p.id] || {};
        return `<div class="item"><button class="play" data-say="${p.id}" aria-label="Play ${esc(p.r)}">▶</button><div class="row"><span class="r">${esc(p.r)}</span>${badge(p)}</div><div>${esc(p.e)}</div>${srcLine(p)}${family ? `<div class="verdict"><button class="yes" data-v="${p.id}:yes" aria-pressed="${v.v === 'yes'}">✓ we say this</button><button class="no" data-v="${p.id}:no" aria-pressed="${v.v === 'no'}">✗ not us</button><input data-note="${p.id}" value="${esc(v.note || '')}" placeholder="We say…" aria-label="What your family says instead"></div>` : ''}</div>`;
      }).join('') || '<p class="muted">No phrases match.</p>'));
    };
    document.getElementById('q').addEventListener('input', paint);
    $view.querySelector('.toolbar').addEventListener('click', e => { const b = e.target.closest('[data-kind]'); if (!b) return; bookFilter = b.dataset.kind; $view.querySelectorAll('[data-kind]').forEach(c => c.setAttribute('aria-pressed', c === b)); paint(); });
    const copyBtn = document.getElementById('copyVerdicts');
    if (copyBtn) copyBtn.addEventListener('click', () => {
      const txt = JSON.stringify(Object.entries(S.verdicts).map(([id, v]) => ({ id, phrase: byId[id] && byId[id].r, verdict: v.v, we_say: v.note || '' })), null, 1);
      const done = () => { copyBtn.textContent = 'Copied'; setTimeout(() => { copyBtn.textContent = 'Copy results'; }, 1500); };
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done).catch(() => { copyBtn.textContent = 'Copy blocked here. Results are saved in the app'; });
    });
    $view.addEventListener('change', e => { const n = e.target.closest('[data-note]'); if (!n) return; const id = n.dataset.note; S.verdicts[id] = Object.assign(S.verdicts[id] || {}, { note: n.value.trim(), at: today() }); save(); });
    paint();
  }

  // ── routing & events ───────────────────────────────────
  function route(to) {
    if (synth) synth.cancel();
    const v = to || 'home';
    if (v === 'home') home(); else if (v === 'review') startReview(); else if (v === 'book') book(false); else if (v === 'family') book(true);
    window.scrollTo(0, 0);
  }
  document.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.go) return route(t.dataset.go);
    if (t.dataset.lesson) return startLesson(t.dataset.lesson);
    if (t.dataset.scene) return startScene(t.dataset.scene);
    if (t.dataset.say) { const p = byId[t.dataset.say]; return speak(p.g, p.r); }
    if (t.dataset.sayraw) { const st = scene.s.steps[+t.dataset.sayraw]; return speak(st.say, st.r); }
    if (t.id === 'slowBtn') { slow = !slow; t.setAttribute('aria-pressed', slow); return; }
    if (t.id === 'hideEn') { const on = t.getAttribute('aria-pressed') !== 'true'; t.setAttribute('aria-pressed', on); document.getElementById('chat').classList.toggle('no-en', on); document.querySelectorAll('.chat .e').forEach(el => { el.hidden = on; }); return; }
    if (t.dataset.reply !== undefined) return sceneReply(+t.dataset.reply, t);
    if (t.dataset.v) { const [id, v] = t.dataset.v.split(':'); const cur = S.verdicts[id] || {}; S.verdicts[id] = Object.assign(cur, { v: cur.v === v ? undefined : v, at: today() }); if (!S.verdicts[id].v && !S.verdicts[id].note) delete S.verdicts[id]; save(); t.parentElement.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', S.verdicts[id] && b.dataset.v === id + ':' + S.verdicts[id].v)); return; }
    if (!run) return;
    const x = run.cur;
    if (t.dataset.act === 'continue') return next();
    if (t.dataset.pick !== undefined) { const ok = t.dataset.pick === x.answer; t.classList.add(ok ? 'right' : 'wrong'); if (!ok) document.querySelectorAll('.opt').forEach(b => { if (b.dataset.pick === x.answer) b.classList.add('right'); }); return feedback(ok); }
    if (t.dataset.tile !== undefined) { const i = +t.dataset.tile; x.picked.push(i); t.classList.add('used'); const line = document.getElementById('line'); line.append(h(`<button class="tile" data-untile="${i}">${esc(x.tiles[i])}</button>`)); return; }
    if (t.dataset.untile !== undefined) { const i = +t.dataset.untile; x.picked = x.picked.filter(z => z !== i); t.remove(); document.querySelector(`[data-tile="${i}"]`).classList.remove('used'); return; }
    if (t.dataset.act === 'check') { const said = x.picked.map(i => x.tiles[i]).join(' '); return feedback(norm(said) === norm(x.p.r)); }
    if (t.dataset.act === 'reveal') {
      const fb = document.getElementById('fb');
      t.disabled = true;
      fb.replaceChildren(h(`<div class="card"><div class="roman">${esc(x.p.r)}</div><div class="row"><button class="slow" data-say="${x.p.id}">▶ hear it</button></div><p class="muted">Did you say it?</p><div class="pair"><button class="secondary" data-act="self-no">Not quite</button><button class="primary" data-act="self-yes">I said it</button></div></div>`));
      speak(x.p.g, x.p.r); return;
    }
    if (t.dataset.act === 'self-yes' || t.dataset.act === 'self-no') { document.getElementById('fb').replaceChildren(); return feedback(t.dataset.act === 'self-yes'); }
  });

  window.APOLLO = { state: () => S, route, current: () => run && run.cur, save };
  route('home');
})();
