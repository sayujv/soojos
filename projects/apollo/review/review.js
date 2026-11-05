/* Apollo family check: a long, plain list for a native speaker to mark.
 * Built from the app's own content (data.js, grammar.js, speech.js), so every
 * sentence the learner sees can be checked. Answers go to the artifact's db
 * collection "answers" (one doc per item per reviewer) and to localStorage. */
(function () {
  'use strict';
  const D = window.APOLLO_DATA, G = window.APOLLO_GRAMMAR, SP = window.APOLLO_SPEECH;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const h = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content; };
  const $ = id => document.getElementById(id);

  // ── 1. Questions about the family: the assumptions everything else rests on ──
  const Q = (id, q, ex, g) => ({ id: 'q:' + id, q, ex: ex || '', g: g || '', type: 'q' });
  const questions = [
    Q('ba', 'We call Dad\'s mother "ba".', 'Or do you say "dadi", "motiba", something else?', 'બા'),
    Q('dada', 'We call Dad\'s father "dada".', 'Or "bapa", "dadaji"…?', 'દાદા'),
    Q('mota-pappa', 'We call Dad\'s ELDER brother "mota pappa".', 'Or "mota bapa", "bapuji", "motabhai"…?', 'મોટા પપ્પા'),
    Q('kaka', 'We call Dad\'s YOUNGER brother "kaka", and his wife "kaki".', '', 'કાકા, કાકી'),
    Q('nana-nani', 'We call Mum\'s parents "nana" and "nani".', '', 'નાના, નાની'),
    Q('motabhai', 'Children call an older brother "motabhai" (not his name).', 'And an older sister "motaben"?', 'મોટાભાઈ'),
    Q('jijaju', 'We call a sister\'s husband "jijaju".', 'Or "banevi", or by name + bhai?', 'જીજાજુ'),
    Q('home-lang', 'At home our family mostly speaks Gujarati, not Kutchi.', 'If it\'s a mix, say how: "Gujarati but with Kutchi words like…"'),
    Q('kutchi-words', 'We mix Kutchi words into our Gujarati.', 'Which ones? Type a few below.'),
    Q('kien-aayo', 'We say "kien aayo?" (Kutchi) for "how are you?".', 'Or always "kem cho?"', 'કીં આયો?'),
    Q('achija', 'We say "achija" (Kutchi) for "bye".', 'Or "aavjo"?', 'અચીજા'),
    Q('aaun', 'We say "aaun" (Kutchi) instead of "hu" for "I".', '', 'આઉં'),
    Q('se', 'We say "se" instead of "che", e.g. "su kare se?".', 'Some families in Kutch and Kathiawad do.', 'સુ કરે સે?'),
    Q('su', 'In casual talk we say "su" instead of "shu" ("su kare?").', '', 'સુ કરે?'),
    Q('haalo', 'We say "haalo" for "let\'s go" (instead of "chalo").', '', 'હાલો'),
    Q('jsn', 'We greet elders with "Jai Swaminarayan".', 'Or "Jai Shri Krishna", or both?', 'જય સ્વામિનારાયણ'),
    Q('pagge', 'We touch elders\' feet and say "pagge laagu".', 'What do elders say back? ("sukhi raho"?)', 'પગે લાગું'),
    Q('bhai-ben', 'We call older family friends name + "bhai" / "ben", or "kaka" / "masi".', '', 'રમેશભાઈ, ગીતાબેન'),
    Q('bapa-ma', 'For village elders we add "-bapa" (men) and "-ma" (women), e.g. "Devjibapa".', '', 'દેવજીબાપા'),
    Q('swahili', 'Older relatives use Swahili words like "saani" (plate), "boga" (veg), "sufrio" (pot).', 'Any others? Type them below.', 'સાની, બોગા'),
    Q('jamvu', 'We say "jamvu" for eating a meal (respectful) and "khaavu" for eating in general.', '', 'જમવું, ખાવું'),
    Q('chovis', 'We call our 24 villages "chovis gaam".', '', 'ચોવીસ ગામ'),
    Q('ujamni', 'The big UK community gathering is called "Ujamni".', '', 'ઉજમણી'),
    Q('ashadhi', 'Our family celebrates Kutchi New Year, "Ashadhi Bij".', '', 'અષાઢી બીજ'),
    Q('besnu', 'At a "besnu" we say "saambhli ne bahu dukh thayu".', 'What would you say?', 'સાંભળીને બહુ દુઃખ થયું'),
    Q('gaam', 'Our family\'s gaam is…', 'Type the village name below. If both sides differ, give both.'),
    Q('route', 'Our family came to the UK / Australia via East Africa.', 'Which country: Kenya, Uganda, Tanzania? Or straight from India?'),
    Q('short-forms', 'There are short forms or words our family uses that most Gujaratis wouldn\'t.', 'Please type as many as you can think of, with what they mean.')
  ];

  // ── 2. Everything in the app, grouped ──
  const fromPhrase = p => ({
    id: 'phrase:' + p.id, e: p.e, r: p.r, g: p.g,
    alt: p.f ? `A woman says: ${p.f.r}` : '',
    claim: p.note || (p.std ? `Standard Gujarati would be "${p.std}".` : ''),
    tag: p.kind === 'standard' ? '' : ({ colloquial: 'Casual', kutchi: 'Kutchi', sklpc: 'SKLPC', 'swahili-loan': 'Swahili' })[p.kind] || ''
  });
  const unitItems = ids => D.phrases.filter(p => ids.includes(p.unit)).map(fromPhrase);
  const guideItems = D.guide.flatMap((g, gi) => g.rows.map(([who, say, you, note], ri) => ({ id: `guide:${gi}:${ri}`, e: `${g.group}: ${who}`, r: say, g: '', claim: `They get "${you}".${note ? ' ' + note : ''}` })));
  const ladderItems = SP.ladders.flatMap(ld => ld.rungs.map((rg, i) => ({ id: `lad:${ld.id}:${i}`, e: `${ld.e} · ${rg.l.toLowerCase()} way`, r: rg.r, g: rg.g, claim: rg.n || '', tag: rg.l })));
  const ruleItems = SP.reductions.map((rd, i) => ({ id: `rule:${i}`, e: 'Shortcut: ' + rd.rule, r: rd.ex.map(([a, b]) => `${a} → ${b}`).join('   ·   '), g: '', claim: rd.n || `People really shorten it like this.`, type: 'rule' }));
  const sceneItems = D.scenes.flatMap(sc => sc.steps.map((st, i) => {
    if (st.say) return { id: `scene:${sc.id}:${i}`, e: st.e, r: st.r, g: st.say, ctx: `${sc.title} · ${sc.who} says` };
    if (st.reply) {
      const ok = st.reply.find(o => o.ok), wrong = st.reply.find(o => !o.ok);
      const cue = sc.steps[i - 1] && sc.steps[i - 1].cue;
      return { id: `scene:${sc.id}:${i}`, e: ok.e, r: ok.r, g: '', ctx: `${sc.title} · ${cue ? cue : 'you reply'}`, claim: wrong ? `Saying "${wrong.r}" here would be wrong: ${wrong.why}` : '' };
    }
    return null;
  }).filter(Boolean));
  const storyItems = G.stories.flatMap(st => st.lines.map((l, i) => ({ id: `story:${st.id}:${i}`, e: l.e, r: l.r, g: l.g, ctx: `${st.title} · ${l.who}` })));
  const grammarItems = G.patterns.flatMap(pt => [
    { id: `pat:${pt.id}:why`, e: 'Rule: ' + pt.title, r: '', g: '', claim: pt.why, type: 'rule' },
    ...pt.rows.map(([r, g, e], i) => ({ id: `pat:${pt.id}:${i}`, e, r, g, ctx: pt.title }))
  ]);

  const sections = [
    { id: 'family', title: 'About our family', blurb: 'Quick questions about how YOUR family talks. These matter most.', items: questions },
    { id: 'greet', title: 'Greetings & respect', blurb: 'Hello, tu / tame, -bhai / -ben, touching feet.', items: unitItems(['greet', 'respect']) },
    { id: 'kin', title: 'Family words', blurb: 'What we call each relative.', items: [...unitItems(['family', 'kin2']), ...guideItems] },
    { id: 'everyday', title: 'Everyday talk', blurb: 'Food, daily life, feelings, health, phone calls.', items: unitItems(['food', 'daily', 'feel', 'call', 'care', 'learner']) },
    { id: 'casual', title: 'Casual talk & teasing', blurb: 'Short forms, slang, fillers, idioms.', items: [...unitItems(['banter', 'wit', 'flow']), ...ruleItems, ...ladderItems] },
    { id: 'community', title: 'Community & occasions', blurb: 'Samaj, gaam, mandir, weddings, festivals, besnu.', items: unitItems(['samaj', 'occasions']) },
    { id: 'kutchi', title: 'Kutchi words', blurb: 'Taken from Kutchi websites. Does OUR family use them?', items: unitItems(['kutch']) },
    { id: 'convos', title: 'Conversations', blurb: 'Lines from the practice conversations, in order.', items: sceneItems },
    { id: 'stories', title: 'Stories', blurb: 'Longer everyday dialogues.', items: storyItems },
    { id: 'grammar', title: 'Grammar rules', blurb: 'How the app explains Gujarati grammar.', items: grammarItems }
  ];
  // de-duplicate identical sentences across sections (first one wins)
  const seen = new Set();
  sections.forEach(s => { s.items = s.items.filter(it => { const k = it.type === 'q' ? it.id : (it.r + '|' + it.e).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }); });
  const ALL = sections.flatMap(s => s.items);
  const byId = Object.fromEntries(ALL.map(it => [it.id, it]));

  // ── 3. Answers: localStorage always, artifact db when available ──
  const KEY = 'apollo.review.v1';
  let A = {}; let reviewer = ''; let SENT = {};
  try { const raw = JSON.parse(localStorage.getItem(KEY) || '{}'); A = raw.a || {}; reviewer = raw.name || ''; SENT = raw.sent || {}; } catch (e) { /* storage blocked */ }
  let db = null, uid = null, online = false;
  const pending = new Map(); let flushT = null;
  function persist(id) {
    try { localStorage.setItem(KEY, JSON.stringify({ a: A, name: reviewer, sent: SENT })); } catch (e) { /* */ }
    if (id) pending.set(id, true);
    clearTimeout(flushT); flushT = setTimeout(flush, 700);
    paintStatus('saving');
  }
  async function flush() {
    if (!db || !uid) { paintStatus(online ? 'saved' : 'local'); return; }
    const ids = [...pending.keys()]; pending.clear();
    try {
      await Promise.all(ids.map(id => {
        const a = A[id] || {}, it = byId[id] || {};
        return db.doc('answers/' + (id + '~' + uid).replace(/[^A-Za-z0-9_\-.~:@+]/g, '_')).set({ item: id, by: uid, name: reviewer, v: a.v || '', say: a.say || '', c: a.c || '', r: it.r || '', e: it.e || it.q || '', at: new Date().toISOString() });
      }));
      paintStatus('saved');
    } catch (e) { ids.forEach(id => pending.set(id, true)); paintStatus('error'); }
  }
  function paintStatus(s) {
    const el = $('status'); if (!el) return;
    el.dataset.s = s;
    el.textContent = { saving: 'Saving…', saved: 'Saved', local: 'Saved on this phone', error: 'Couldn\'t save online just now. Your answers are kept on this device.' }[s];
  }
  (async () => {
    try {
      if (!window.claude || !window.claude.use) return paintStatus('local');
      const [d, u] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!d || !u) return paintStatus('local');
      const id = await u.id(); if (!id) return paintStatus('local');
      db = d; uid = id; online = true;
      const snap = await db.collection('answers').where('by', '==', uid).get();
      (snap.docs || []).forEach(doc => { const x = doc.data() || {}; if (x.item && !(A[x.item] && A[x.item].v)) A[x.item] = { v: x.v || '', say: x.say || '', c: x.c || '' }; if (x.name && !reviewer) reviewer = x.name; });
      Object.keys(A).forEach(k => pending.set(k, true));
      persist(); render();
    } catch (e) { paintStatus('local'); }
  })();

  // ── 3b. Sending without an account: compact text over WhatsApp, and importing it back ──
  const VCODE = { yes: 'y', close: '~', no: 'n', unsure: '?', some: 's' }, VBACK = { y: 'yes', '~': 'close', n: 'no', '?': 'unsure', s: 'some' };
  const clean = t => String(t || '').replace(/[|\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
  const line = id => { const a = A[id] || {}; return [id, VCODE[a.v] || '', a.c === 'yes' ? 'y' : a.c === 'no' ? 'n' : '', clean(a.say)].join('|'); };
  const sig = id => JSON.stringify(A[id] || {});
  const unsent = () => ALL.filter(it => answered(it) && SENT[it.id] !== sig(it.id)).map(it => it.id);
  function parts(ids) {
    const out = []; let cur = [];
    const head = (i, n) => `APOLLO1|${clean(reviewer) || 'family'}|${i}/${n}\nAnswers for Sayuj's Gujarati app. Please don't edit this message.`;
    for (const id of ids) {
      const trial = [...cur, line(id)];
      if (cur.length && encodeURIComponent(head(9, 9) + '\n' + trial.join('\n')).length > 3000) { out.push(cur); cur = [line(id)]; }
      else cur = trial;
    }
    if (cur.length) out.push(cur);
    return out.map((ls, i) => ({ ids: ls.map(l => l.split('|')[0]), text: head(i + 1, out.length) + '\n' + ls.join('\n') }));
  }
  function importText(txt) {
    const lines = String(txt || '').split(/\r?\n/);
    let name = '', n = 0;
    for (const l of lines) {
      const hd = l.match(/^APOLLO1\|([^|]*)\|/); if (hd) { name = name || hd[1].trim(); continue; }
      const f = l.split('|'); if (f.length < 4 || !byId[f[0].trim()]) continue;
      const id = f[0].trim();
      A[id] = { v: VBACK[f[1].trim()] || '', c: f[2].trim() === 'y' ? 'yes' : f[2].trim() === 'n' ? 'no' : '', say: f.slice(3).join('|').trim() };
      pending.set(id, true); n++;
    }
    if (name && !reviewer) reviewer = name;
    persist();
    return { n, name };
  }

  // ── 4. Audio: the app's pre-rendered Gujarati clips ──
  const AUDIO = { map: null, clips: {} };
  (async () => { try { const idx = await (await fetch('audio/index.json')).json(); AUDIO.map = idx.map; await Promise.all(idx.packs.map(pk => fetch('audio/' + pk).then(r => r.json()).then(o => Object.assign(AUDIO.clips, o)).catch(() => {}))); } catch (e) { /* */ } })();
  let clip = null;
  function play(g) {
    const k = AUDIO.map && AUDIO.map[g], b = k && AUDIO.clips[k];
    if (b) { try { if (clip) clip.pause(); clip = new Audio('data:audio/mpeg;base64,' + b); clip.play().catch(() => {}); } catch (e) { /* */ } return; }
    try { const u = new SpeechSynthesisUtterance(g); u.lang = 'gu-IN'; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { /* */ }
  }

  // ── 5. Rendering ──
  const answered = it => { const a = A[it.id]; return !!(a && (a.v || a.say || a.c)); };
  const countDone = items => items.filter(answered).length;
  let current = null, onlyOpen = false, shown = 30;
  const V_ITEM = [['yes', '✓ Yes, we say it'], ['close', '≈ Nearly'], ['no', '✗ No'], ['unsure', '? Not sure']];
  const V_Q = [['yes', '✓ Yes'], ['some', '≈ Sometimes'], ['no', '✗ No'], ['unsure', '? Not sure']];
  function itemHtml(it) {
    const a = A[it.id] || {}, isQ = it.type === 'q', isRule = it.type === 'rule';
    const opts = isQ ? V_Q : V_ITEM;
    return `<article class="it ${answered(it) ? 'done' : ''}" data-id="${esc(it.id)}">
      ${it.ctx ? `<p class="ctx">${esc(it.ctx)}</p>` : ''}
      ${isQ ? `<p class="q">${esc(it.q)}</p>${it.ex ? `<p class="ex">${esc(it.ex)}</p>` : ''}` : `<p class="en">${esc(it.e)}</p>`}
      ${it.r || it.g ? `<div class="ours">${it.g ? `<button class="play" data-play="${esc(it.g)}" aria-label="Play">▶</button>` : ''}<div>${!isQ && it.r ? `<b>${esc(it.r)}</b>` : ''}${it.g ? `<span class="gu" lang="gu">${esc(it.g)}</span>` : ''}${it.tag ? ` <span class="tag">${esc(it.tag)}</span>` : ''}</div></div>` : ''}
      ${it.alt ? `<p class="ex">${esc(it.alt)}</p>` : ''}
      ${!isRule ? `<div class="vb" role="group" aria-label="${isQ ? 'Is this true for our family?' : 'Is this how we say it?'}">${opts.map(([v, l]) => `<button data-v="${v}" aria-pressed="${a.v === v}">${l}</button>`).join('')}</div>` : ''}
      ${it.claim ? `<div class="claim"><p><span class="lbl">${isRule ? 'The app says' : 'Our note'}</span> ${esc(it.claim)}</p><div class="vb small" role="group" aria-label="Is this note right?"><span>Is this right?</span><button data-c="yes" aria-pressed="${a.c === 'yes'}">Yes</button><button data-c="no" aria-pressed="${a.c === 'no'}">No</button></div></div>` : ''}
      <input class="say" data-say value="${esc(a.say || '')}" placeholder="${isQ ? 'What do we say? (optional)' : isRule ? 'Comments (optional)' : 'How would you say it?'}" aria-label="How would you say it">
    </article>`;
  }
  function home() {
    current = null;
    const total = ALL.length, done = countDone(ALL);
    $('view').replaceChildren(h(`
      <section class="hero">
        <p class="kicker">કેમ છો! Kem cho!</p>
        <h1>Help Sayuj speak like our family</h1>
        <p>Sayuj is learning to speak Gujarati the way <b>our</b> family does. An AI wrote these sentences from books and websites, so some will be wrong, too formal, or not how we say it.</p>
        <p>For each one, tap <b>✓ Yes</b>, <b>≈ Nearly</b> or <b>✗ No</b>. If we'd say it differently, type how. Short forms, slang and Kutchi words are exactly what's needed. Where there's a note, tell us if the note is right. Press ▶ to hear it (the voice is a robot).</p>
        <p class="small">No account needed. Answers save on this phone as you go. When you've done some, the green button at the bottom sends them to Sayuj on WhatsApp. Do a few at a time, and skip anything you're unsure of.</p>
      </section>
      <label class="name">Your name <input id="who" value="${esc(reviewer)}" placeholder="e.g. Mummy" autocomplete="given-name"></label>
      <div class="overall"><div class="bar"><i style="width:${Math.round(100 * done / total)}%"></i></div><span>${done} of ${total} checked</span></div>
      <div class="secs">${sections.map(s => { const d = countDone(s.items); return `<button class="sec" data-sec="${s.id}"><span><b>${esc(s.title)}</b><small>${esc(s.blurb)}</small></span><span class="cnt ${d === s.items.length ? 'full' : ''}">${d}/${s.items.length}</span></button>`; }).join('')}</div>
      ${sendCard()}
      <details class="import"><summary>For Sayuj: add answers someone sent you</summary>
        <p class="small">Paste the WhatsApp message(s) here, all parts together if there were several.</p>
        <textarea id="impText" rows="5" placeholder="APOLLO1|Mummy|1/2 …"></textarea>
        <button class="ghost" id="impBtn">Add these answers</button><p class="small" id="impMsg" role="status"></p>
      </details>`));
    window.scrollTo(0, 0);
  }
  function sendCard() {
    const ids = unsent(), ps = parts(ids), any = ALL.some(answered);
    if (!any) return `<div class="send"><h3>Sending your answers</h3><p class="small">${online ? 'Your answers save online automatically, so there is nothing to send.' : 'When you\'ve answered some, a button here sends them to Sayuj on WhatsApp. No account needed.'}</p></div>`;
    return `<div class="send"><h3>${online ? 'Your answers are saved online' : 'Send your answers to Sayuj'}</h3>
      ${online ? '<p class="small">Sayuj can already see them. You can still send them on WhatsApp if you like.</p>' : '<p class="small">Tap to open WhatsApp with your answers typed in, choose Sayuj, and press send.</p>'}
      ${ps.length ? ps.map((pt, i) => `<a class="wa" href="https://wa.me/?text=${encodeURIComponent(pt.text)}" target="_blank" rel="noopener" data-part="${i}">Send ${pt.ids.length} ${ids.length === pt.ids.length ? 'new answers' : 'answers'}${ps.length > 1 ? ` (part ${i + 1} of ${ps.length})` : ''} on WhatsApp</a>`).join('') : '<p class="sent">✓ Everything has been sent. Answer more and a new button appears.</p>'}
      <button class="ghost" id="copyAll">Copy my answers instead</button>
      <p class="small">If WhatsApp doesn't open, use "Copy" and paste it into a message to Sayuj.</p></div>`;
  }
  let lastParts = [];
  function section(id, keepScroll) {
    const s = sections.find(x => x.id === id); current = id;
    const list = onlyOpen ? s.items.filter(it => !answered(it)) : s.items;
    const idx = sections.indexOf(s), next = sections[idx + 1];
    const y = window.scrollY;
    $('view').replaceChildren(h(`
      <div class="sechead"><button class="back" data-home aria-label="All sections">← All sections</button><h2>${esc(s.title)}</h2><p>${esc(s.blurb)}</p>
        <div class="overall"><div class="bar"><i style="width:${Math.round(100 * countDone(s.items) / s.items.length)}%"></i></div><span>${countDone(s.items)} of ${s.items.length}</span></div>
        <label class="toggle"><input type="checkbox" id="onlyOpen" ${onlyOpen ? 'checked' : ''}> Hide the ones I've done</label></div>
      <div class="items">${list.slice(0, shown).map(itemHtml).join('') || '<p class="empty">All done here. Shabash! 🙏</p>'}</div>
      ${list.length > shown ? `<button class="more" id="more">Show more (${list.length - shown} left)</button>` : next ? `<button class="more" data-sec="${next.id}">Next: ${esc(next.title)} →</button>` : ''}`));
    if (!keepScroll) window.scrollTo(0, 0); else window.scrollTo(0, y);
  }
  function render() { if (current) section(current, true); else home(); }

  // ── 6. Events ──
  document.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.sec) { shown = 30; return section(t.dataset.sec); }
    if (t.hasAttribute('data-home')) return home();
    if (t.id === 'more') { shown += 30; return section(current, true); }
    if (t.dataset.play) return play(t.dataset.play);
    const art = t.closest('.it'); if (!art) {
      if (t.id === 'copyAll') {
        const ids = ALL.filter(answered).map(it => it.id);
        const txt = `APOLLO1|${clean(reviewer) || 'family'}|1/1\nAnswers for Sayuj's Gujarati app. Please don't edit this message.\n` + ids.map(line).join('\n');
        const done = () => { t.textContent = 'Copied! Paste it to Sayuj'; setTimeout(() => { t.textContent = 'Copy my answers'; }, 2500); };
        try { navigator.clipboard.writeText(txt).then(done, () => fallbackCopy(txt, t)); } catch (err) { fallbackCopy(txt, t); }
      }
      if (t.id === 'impBtn') {
        const r = importText($('impText').value);
        $('impMsg').textContent = r.n ? `Added ${r.n} answers${r.name ? ' from ' + r.name : ''}.${online ? ' They are saved online.' : ''}` : 'No answers found. Paste the whole message, starting with APOLLO1.';
        if (r.n) setTimeout(home, 1500);
      }
      return;
    }
    const id = art.dataset.id, a = A[id] = A[id] || {};
    if (t.dataset.v) { a.v = a.v === t.dataset.v ? '' : t.dataset.v; art.querySelectorAll('[data-v]').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === a.v)); }
    if (t.dataset.c) { a.c = a.c === t.dataset.c ? '' : t.dataset.c; art.querySelectorAll('[data-c]').forEach(b => b.setAttribute('aria-pressed', b.dataset.c === a.c)); }
    art.classList.toggle('done', answered(byId[id]));
    persist(id); paintProgress();
  });
  document.addEventListener('click', e => {
    const a = e.target.closest('a.wa'); if (!a) return;
    const ps = parts(unsent()), pt = ps[+a.dataset.part]; if (!pt) return;
    pt.ids.forEach(id => { SENT[id] = sig(id); });
    persist(); setTimeout(home, 600);
  });
  document.addEventListener('change', e => {
    if (e.target.id === 'who') {
      reviewer = e.target.value.trim(); Object.keys(A).forEach(k => pending.set(k, true)); persist();
      const sc = document.querySelector('.send'); if (sc) sc.replaceWith(h(sendCard()));
      return;
    }
    if (e.target.id === 'onlyOpen') { onlyOpen = e.target.checked; shown = 30; return section(current); }
    const inp = e.target.closest('[data-say]'); if (!inp) return;
    const art = inp.closest('.it'), id = art.dataset.id;
    A[id] = Object.assign(A[id] || {}, { say: inp.value.trim() });
    art.classList.toggle('done', answered(byId[id]));
    persist(id); paintProgress();
  });
  function paintProgress() {
    const s = sections.find(x => x.id === current); if (!s) return;
    const d = countDone(s.items), bar = document.querySelector('.sechead .bar i'), lbl = document.querySelector('.sechead .overall span');
    if (bar) bar.style.width = Math.round(100 * d / s.items.length) + '%'; if (lbl) lbl.textContent = `${d} of ${s.items.length}`;
  }
  function fallbackCopy(txt, btn) {
    const ta = h(`<textarea class="copybox" readonly>${esc(txt)}</textarea>`).firstChild;
    btn.after(ta); ta.focus(); ta.select(); btn.textContent = 'Select all and copy the text below';
  }

  window.APOLLO_REVIEW = { sections, answers: () => A, count: () => ALL.length, flush, importText };
  home();
})();
