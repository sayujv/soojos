/* Apollo content. Single source of truth for phrases, units and scenes.
 *
 * Phrase fields
 *   id    stable key (progress and family verdicts hang off it — never rename)
 *   unit  unit id
 *   r     romanised, English-reader spelling (what the learner sees)
 *   g     Gujarati script — used ONLY to drive text-to-speech, never shown as a lesson
 *   e     English meaning
 *   kind  standard | sklpc | kutchi | swahili-loan
 *   conf  unsourced (standard core only) | anecdote | claimed | verified
 *   src   source URL (or "apollo:standard-core" for unsourced standard Gujarati)
 *   date  publication date, or access date
 *   std   (dialect items) the standard Gujarati equivalent, romanised
 *   note  usage note
 */
(function () {
  const CORE = { kind: 'standard', conf: 'unsourced', src: 'apollo:standard-core', date: '2026-11-05' };
  const p = (id, unit, r, g, e, x) => Object.assign({ id, unit, r, g, e }, CORE, x || {});
  // k(): a sourced dialect item in the 'kutch' unit.
  const k = (id, r, g, e, std, conf, src, note, kind, date) =>
    ({ id, unit: 'kutch', r, g, e, std: std || '', kind: kind || 'kutchi', conf, src, date: date || '2026-11-05', note: note || '' });

  const units = [
    { id: 'greet', title: 'Saying hello', blurb: 'Greet anyone, from Ba to a cousin', icon: 'namaste' },
    { id: 'family', title: 'Family', blurb: 'Who is who: kaka, mami, foi and the rest', icon: 'family' },
    { id: 'food', title: 'At the table', blurb: 'Eating, refusing seconds, praising the cook', icon: 'food' },
    { id: 'daily', title: 'Everyday talk', blurb: 'Where, when, what, and asking again', icon: 'chat' },
    { id: 'feel', title: 'Feelings & manners', blurb: 'Tired, happy, sorry, missing someone', icon: 'heart' },
    { id: 'call', title: 'The phone call', blurb: 'Calling relatives in Kutch, Kenya or the UK', icon: 'phone' },
    { id: 'kutch', title: 'Kutchi flavour', blurb: 'How SKLPC speech differs, from public sources', icon: 'kutch' }
  ];

  const phrases = [
    // ── greet ─────────────────────────────────────────────
    p('kem-cho', 'greet', 'kem cho?', 'કેમ છો?', 'How are you? (respectful)', { note: 'Use with elders and anyone you call "tame".' }),
    p('majama', 'greet', 'majama', 'મજામાં', "I'm fine / all good", { note: 'The standard reply to kem cho.' }),
    p('ane-tame', 'greet', 'ane tame?', 'અને તમે?', 'And you?'),
    p('tu-kem-che', 'greet', 'tu kem che?', 'તું કેમ છે?', 'How are you? (to a cousin or someone younger)', { note: '"tu" is informal. Never use it to Ba or an uncle.' }),
    p('haa', 'greet', 'haa', 'હા', 'Yes'),
    p('naa', 'greet', 'naa', 'ના', 'No'),
    p('saru', 'greet', 'saaru', 'સારું', 'Good / okay'),
    p('barabar', 'greet', 'barabar', 'બરાબર', 'Right / exactly / correct'),
    p('aavjo', 'greet', 'aavjo', 'આવજો', 'Goodbye (literally "do come again")'),
    p('jsk', 'greet', 'jai shri krishna', 'જય શ્રી કૃષ્ણ', 'Hello / goodbye (devotional greeting)'),
    p('naam-shu', 'greet', 'tamaru naam shu che?', 'તમારું નામ શું છે?', "What's your name?"),
    p('maru-naam', 'greet', 'maru naam Sayuj che', 'મારું નામ સયુજ છે', 'My name is Sayuj'),

    // ── family ────────────────────────────────────────────
    p('ba', 'family', 'ba', 'બા', 'Grandmother (in many families, also mother)', { note: 'Which one depends on the family. Check yours.' }),
    p('dada', 'family', 'dada', 'દાદા', "Grandfather (father's father)"),
    p('bapuji', 'family', 'bapuji', 'બાપુજી', 'Father (respectful)'),
    p('kaka', 'family', 'kaka', 'કાકા', "Father's younger brother"),
    p('kaki', 'family', 'kaki', 'કાકી', "Kaka's wife"),
    p('mota-pappa', 'family', 'mota pappa', 'મોટા પપ્પા', "Father's elder brother"),
    p('mama', 'family', 'mama', 'મામા', "Mother's brother"),
    p('mami', 'family', 'mami', 'મામી', "Mama's wife"),
    p('foi', 'family', 'foi', 'ફોઈ', "Father's sister"),
    p('fuva', 'family', 'fuva', 'ફુવા', "Foi's husband"),
    p('masi', 'family', 'masi', 'માસી', "Mother's sister"),
    p('masa', 'family', 'masa', 'માસા', "Masi's husband"),
    p('bhabhi', 'family', 'bhabhi', 'ભાભી', "Brother's wife"),
    p('dikro', 'family', 'dikro', 'દીકરો', 'Son'),
    p('dikri', 'family', 'dikri', 'દીકરી', 'Daughter'),
    p('ghare-kon', 'family', 'tamara ghare kon kon che?', 'તમારા ઘરે કોણ કોણ છે?', 'Who all is at your home?'),
    p('aa-kaka', 'family', 'aa mara kaka che', 'આ મારા કાકા છે', 'This is my uncle (father\'s brother)'),

    // ── food ──────────────────────────────────────────────
    p('jamvanu-taiyar', 'food', 'jamvanu taiyar che', 'જમવાનું તૈયાર છે', 'Food is ready'),
    p('jami-lo', 'food', 'jami lo', 'જમી લો', 'Come and eat'),
    p('bhukh', 'food', 'mane bhukh lagi che', 'મને ભૂખ લાગી છે', "I'm hungry"),
    p('pet-bharai', 'food', 'bas, pet bharai gayu', 'બસ, પેટ ભરાઈ ગયું', "Enough, I'm full"),
    p('thodu-vadhare', 'food', 'thodu vadhare aapo', 'થોડું વધારે આપો', 'Give me a little more'),
    p('khub-saras', 'food', 'khub saras che', 'ખૂબ સરસ છે', "It's really good"),
    p('chaa-pisho', 'food', 'chaa pisho?', 'ચા પીશો?', 'Will you have some tea?'),
    p('paani-aapo', 'food', 'paani aapo', 'પાણી આપો', 'Please pass the water'),
    p('rotli', 'food', 'rotli', 'રોટલી', 'Chapati'),
    p('daal-bhaat', 'food', 'daal bhaat', 'દાળ ભાત', 'Dal and rice'),
    p('shaak', 'food', 'shaak', 'શાક', 'Vegetable curry'),
    p('tikhu', 'food', 'tikhu che', 'તીખું છે', "It's spicy"),

    // ── daily ─────────────────────────────────────────────
    p('shu-kare', 'daily', 'shu kare che?', 'શું કરે છે?', 'What are you doing? (informal)'),
    p('kya-jay', 'daily', 'kya jaay che?', 'ક્યાં જાય છે?', 'Where are you going? (informal)'),
    p('ghare-jau', 'daily', 'hu ghare jaau chu', 'હું ઘરે જાઉં છું', "I'm going home"),
    p('kyare-aavsho', 'daily', 'kyare aavsho?', 'ક્યારે આવશો?', 'When will you come? (respectful)'),
    p('aaje', 'daily', 'aaje', 'આજે', 'Today'),
    p('kaale', 'daily', 'kaale', 'કાલે', 'Tomorrow, or yesterday', { note: 'Same word for both. The verb tense tells you which.' }),
    p('khabar-nathi', 'daily', 'mane khabar nathi', 'મને ખબર નથી', "I don't know"),
    p('samjayu-nahi', 'daily', 'mane samjayu nahi', 'મને સમજાયું નહીં', "I didn't understand"),
    p('dhire-bolo', 'daily', 'dhire bolo', 'ધીરે બોલો', 'Speak slowly, please'),
    p('fari-bolo', 'daily', 'fari bolo ne', 'ફરી બોલો ને', 'Say it again, please'),
    p('aahi-aav', 'daily', 'aahi aav', 'અહીં આવ', 'Come here (informal)'),
    p('beso', 'daily', 'beso', 'બેસો', 'Please sit'),
    p('chalo', 'daily', 'chalo', 'ચાલો', "Let's go / alright then"),

    // ── feel ──────────────────────────────────────────────
    p('gamyu', 'feel', 'mane gamyu', 'મને ગમ્યું', 'I liked it'),
    p('maja-aavi', 'feel', 'maja aavi', 'મજા આવી', 'That was fun'),
    p('thaki-gayo', 'feel', 'hu thaki gayo chu', 'હું થાકી ગયો છું', "I'm tired", { note: 'Said by a man. A woman says "thaki gai chu".' }),
    p('thandi', 'feel', 'mane thandi laage che', 'મને ઠંડી લાગે છે', "I'm cold"),
    p('chinta-na', 'feel', 'chinta na karo', 'ચિંતા ના કરો', "Don't worry"),
    p('maaf-karjo', 'feel', 'maaf karjo', 'માફ કરજો', "I'm sorry / forgive me"),
    p('vandho-nahi', 'feel', 'koi vaandho nahi', 'કોઈ વાંધો નહીં', 'No problem'),
    p('tabiyat', 'feel', 'tamari tabiyat kem che?', 'તમારી તબિયત કેમ છે?', 'How is your health?', { note: 'Ask this of elders. They will notice.' }),
    p('yaad-aave', 'feel', 'mane tamari yaad aave che', 'મને તમારી યાદ આવે છે', 'I miss you'),

    // ── call ──────────────────────────────────────────────
    p('hu-bolu', 'call', 'hello, hu Sayuj bolu chu', 'હેલો, હું સયુજ બોલું છું', "Hello, it's Sayuj speaking"),
    p('badha-kem', 'call', 'badha kem che?', 'બધા કેમ છે?', 'How is everyone?'),
    p('badha-majama', 'call', 'ghare badha majama che', 'ઘરે બધા મજામાં છે', 'Everyone at home is well'),
    p('varsad', 'call', 'Perth ma varsaad che', 'પર્થમાં વરસાદ છે', "It's raining in Perth"),
    p('kyare-aavo', 'call', 'tame Perth kyare aavo cho?', 'તમે પર્થ ક્યારે આવો છો?', 'When are you coming to Perth?'),
    p('pachi-vaat', 'call', 'pachi vaat kariye', 'પછી વાત કરીએ', "Let's talk later"),
    p('ashirvad', 'call', 'ashirvaad aapjo', 'આશીર્વાદ આપજો', 'Bless me (said to elders, often when touching their feet)'),

    // ── kutch: dialect layer. Every item is sourced; none is SKLPC-verified yet. ──
    // Research 2026-11-05 (knowledge/reports/2026-11-05-apollo-sklpc-dialect.md). Sources were
    // read through search snippets only; full pages were blocked by the session network.
    // Gujarati script here is our own spelling, used only to drive text-to-speech.
    k('kien-aayo', 'kien aayo?', 'કીં આયો?', 'How are you? (polite)', 'kem cho?', 'claimed', 'https://www.memeraki.com/blogs/posts/the-language-of-kutch', 'Four sources, four spellings: kien / kin / kii / kiy aayo. The Kutchi "kem cho".'),
    k('achija', 'achija', 'અચીજા', 'Bye (literally "do come again")', 'aavjo', 'claimed', 'https://kutchimaadu.com/general/kutchi-language/', 'Kutchi for "aavjo". Found on three blogs that may copy each other.'),
    k('aaun', 'aaun', 'આઉં', 'I', 'hu', 'claimed', 'https://khojawiki.org/Kutchi', 'Kutchi "I". Both sources are Muslim Kutchi communities, so check that SKLPC use it.'),
    k('aain', 'aain', 'આંઈ', 'You (respectful, to an elder)', 'tame', 'claimed', 'https://www.memeraki.com/blogs/posts/the-language-of-kutch', 'Like "tame". "tu" stays the informal you.'),
    k('chovis-gaam', 'chovis gaam', 'ચોવીસ ગામ', 'The twenty-four villages (the SKLPC home villages around Bhuj)', '', 'claimed', 'https://www.asian-voice.com/News/UK/Chovis-Gaam-Ujamni-2025-draws-over-9,000-attendees', 'How the community names itself. Kodki, Bharasar and Samatra are confirmed as three of them.', 'sklpc', '2025-09-21'),
    k('achanto', 'achanto', 'અચાંતો', "I'm coming", 'aavu chu', 'claimed', 'https://www.memeraki.com/blogs/posts/the-language-of-kutch', 'Kutchi "ach-" (come) is Gujarati "aav-".'),
    k('vinanto', 'vinanto', 'વિનાંતો', "I'm going", 'jaau chu', 'claimed', 'https://www.memeraki.com/blogs/posts/the-language-of-kutch', 'Kutchi "vin-/van-" (go) is Gujarati "jaa-".'),
    k('aain-achota', 'aain achota?', 'આંઈ અચોતા?', 'Are you coming? (polite)', 'tame aavo cho?', 'claimed', 'https://www.memeraki.com/blogs/posts/the-language-of-kutch'),
    k('kada-vanota', 'kada vanota?', 'કડા વનોતા?', 'Where are you going? (polite)', 'tame kya jaao cho?', 'claimed', 'https://www.memeraki.com/blogs/posts/the-language-of-kutch', '"kada" = where, Gujarati "kya".'),
    k('koro-thiyo', 'koro thiyo?', 'કોરો થીયો?', 'What happened?', 'shu thayu?', 'claimed', 'https://kutchimaadu.com/general/kutchi-language/', '"koro" = what, Gujarati "shu".'),
    k('kuro-karyota', 'kuro karyota?', 'કુરો કર્યોતા?', 'What are you doing?', 'shu karo cho?', 'claimed', 'https://www.memeraki.com/blogs/posts/the-language-of-kutch', 'Also spelled "koro kareyeinto".'),
    k('chhado-hane', 'chhado hane', 'છડો હણે', 'Drop it now / leave it', 'chhodo have', 'claimed', 'https://en.wikipedia.org/wiki/Kutchi_language', 'Given as a Gujarati-ised Kutchi form used by Hindus of rural Kutch. Very likely SKLPC territory.'),
    k('muke-bhookh', 'muke bhookh lagi aay', 'મુકે ભૂખ લગી આય', "I'm hungry", 'mane bhukh lagi che', 'claimed', 'https://grand3d.in/?page_id=136', '"muke" = to me (mane). "aay" = is (che).'),
    k('maf-karija', 'maf karija', 'માફ કરીજા', 'Sorry / forgive me', 'maaf karjo', 'claimed', 'https://grand3d.in/?page_id=136'),
    k('khapey', 'khapey', 'ખપે', 'I want / it is needed', 'joie', 'claimed', 'https://kutchimaadu.com/general/kutchi-language/'),
    k('ker', 'ker?', 'કેર?', 'Who?', 'kon?', 'claimed', 'https://kutchimaadu.com/general/kutchi-language/'),
    k('bapa', 'bapa', 'બાપા', 'Father', 'bapuji / pappa', 'claimed', 'https://grand3d.in/?page_id=136', 'Some families use "bapa" for grandfather or an elder uncle. Check yours.'),
    k('ma', 'ma', 'મા', 'Mother', 'ba / mummy', 'claimed', 'https://grand3d.in/?page_id=136'),
    k('ujamni', 'ujamni', 'ઉજમણી', 'The annual SKLPC UK community celebration', '', 'claimed', 'https://www.asian-voice.com/News/UK/Chovis-Gaam-Ujamni-2025-draws-over-9,000-attendees', 'Also named in the SKLPC (UK) 2024 trustees\' report. Over 9,000 attended in 2025.', 'sklpc', '2025-09-21'),
    k('ashadhi-bij', 'ashadhi bij', 'અષાઢી બીજ', 'Kutchi New Year', '', 'claimed', 'https://ianslive.in/pm-modi-extends-ashadhi-bij-greetings-to-kutchi-community-worldwide--20250627102437', 'Celebrated across all Kutch communities, not just SKLPC.', 'kutchi', '2025-06-27'),
    k('saani', 'saani', 'સાની', 'Plate', 'thaali', 'claimed', 'https://en.wikipedia.org/wiki/Kutchi-Swahili', 'From Swahili "sahani". Recorded among East-African Kutchi, mainly Muslim families. Ask if your family uses it.', 'swahili-loan'),
    k('boga', 'boga', 'બોગા', 'Vegetables', 'shaak', 'claimed', 'https://www.saada.org/tides/article/tongue-tied', 'From Swahili "mboga". East-African Kutchi.', 'swahili-loan'),
    k('dizi', 'dizi', 'ડીઝી', 'Banana', 'kela', 'claimed', 'https://www.saada.org/tides/article/tongue-tied', 'From Swahili "ndizi". East-African Kutchi.', 'swahili-loan'),
    k('karibu', 'karibu', 'કરીબુ', 'Welcome / you\'re welcome', 'padharo', 'anecdote', 'https://pentransmissions.com/2023/12/19/our-tongues-were-forked-along-lines-of-migration/', 'Swahili, used by an East-African Gujarati Hindu family. Not a Kutchi Patel source.', 'swahili-loan', '2023-12-19')
  ];

  // Scenes: role-play conversations. "say" lines come from the other person;
  // "reply" steps offer choices and exactly one is ok:true.
  const scenes = [
    {
      id: 'chai-with-ba', title: 'Chai with Ba', who: 'Ba', where: "Ba's kitchen, Sunday afternoon",
      steps: [
        { say: 'આવ દીકરા, કેમ છે?', r: 'aav dikra, kem che?', e: 'Come, son, how are you?' },
        { reply: [
          { r: 'majama, ba. ane tame?', e: "Fine, Ba. And you?", ok: true },
          { r: 'tu kem che?', e: 'How are you? (informal)', why: '"tu" is too casual for Ba.' },
          { r: 'aavjo', e: 'Goodbye', why: "You've only just arrived." }
        ] },
        { say: 'હું પણ મજામાં. ચા પીશ?', r: 'hu pan majama. chaa pish?', e: "I'm fine too. Will you have tea?" },
        { reply: [
          { r: 'haa, thodi aapo', e: 'Yes, give me a little', ok: true },
          { r: 'mane khabar nathi', e: "I don't know", why: 'She asked a yes/no question.' },
          { r: 'tikhu che', e: "It's spicy", why: "That's about the food, not tea." }
        ] },
        { say: 'થેપલાં પણ ખા. ભૂખ લાગી છે?', r: 'thepla pan khaa. bhukh laagi che?', e: 'Have some thepla too. Are you hungry?' },
        { reply: [
          { r: 'haa, mane bhukh lagi che', e: "Yes, I'm hungry", ok: true },
          { r: 'maaf karjo', e: "I'm sorry", why: 'No need to apologise here.' },
          { r: 'dhire bolo', e: 'Speak slowly', why: 'You understood her fine.' }
        ] },
        { say: 'લે, વધારે લે.', r: 'le, vadhare le.', e: 'Here, take more.' },
        { reply: [
          { r: 'bas, pet bharai gayu. khub saras che!', e: "Enough, I'm full. It's really good!", ok: true },
          { r: 'paani aapo', e: 'Pass the water', why: "She's offering food. Answer that first." },
          { r: 'chalo', e: "Let's go", why: 'Leaving mid-meal is rude.' }
        ] }
      ]
    },
    {
      id: 'call-kaka', title: 'Phone call to Kaka', who: 'Kaka', where: 'A call to Kutch on a Sunday morning',
      steps: [
        { say: 'હેલો? કોણ બોલે છે?', r: 'hello? kon bole che?', e: "Hello? Who's speaking?" },
        { reply: [
          { r: 'hello, hu Sayuj bolu chu', e: "Hello, it's Sayuj speaking", ok: true },
          { r: 'tamaru naam shu che?', e: "What's your name?", why: 'He asked who you are. Say your name.' },
          { r: 'naa', e: 'No', why: 'That doesn\'t answer "who".' }
        ] },
        { say: 'અરે સયુજ! કેમ છો? ઘરે બધા કેમ છે?', r: 'are Sayuj! kem cho? ghare badha kem che?', e: 'Oh Sayuj! How are you? How is everyone at home?' },
        { reply: [
          { r: 'majama, kaka. ghare badha majama che', e: 'Fine, Kaka. Everyone at home is well', ok: true },
          { r: 'mane samjayu nahi', e: "I didn't understand", why: 'Fine to use if you really didn\'t follow him. Here you did.' },
          { r: 'aa mara kaka che', e: 'This is my uncle', why: "You're talking TO kaka." }
        ] },
        { say: 'સરસ. પર્થમાં શું ચાલે છે?', r: 'saras. Perth ma shu chaale che?', e: "Good. What's going on in Perth?" },
        { reply: [
          { r: 'Perth ma varsaad che', e: "It's raining in Perth", ok: true },
          { r: 'jami lo', e: 'Come and eat', why: "That's an invitation to eat." },
          { r: 'maaf karjo', e: "I'm sorry", why: 'Nothing to apologise for.' }
        ] },
        { say: 'સારું. ક્યારે કચ્છ આવે છે?', r: 'saaru. kyare Kutch aave che?', e: 'Okay. When are you coming to Kutch?' },
        { reply: [
          { r: 'mane khabar nathi, kaka. tamari tabiyat kem che?', e: "I don't know, Kaka. How is your health?", ok: true },
          { r: 'kaale', e: 'Tomorrow / yesterday', why: "Unless you're flying out tomorrow!" },
          { r: 'beso', e: 'Please sit', why: "He's on the phone." }
        ] },
        { say: 'બરાબર છે. ચાલો, પછી વાત કરીએ. જય શ્રી કૃષ્ણ.', r: 'barabar che. chalo, pachi vaat kariye. jai shri krishna.', e: "I'm alright. OK, let's talk later. Jai Shri Krishna." },
        { reply: [
          { r: 'jai shri krishna, kaka. ashirvaad aapjo', e: 'Jai Shri Krishna, Kaka. Bless me', ok: true },
          { r: 'shu kare che?', e: 'What are you doing?', why: "He's saying goodbye." },
          { r: 'thodu vadhare aapo', e: 'Give me a little more', why: 'Food phrase, wrong moment.' }
        ] }
      ]
    },
    {
      id: 'ujamni-elder', title: 'An elder at the Ujamni', who: 'Mota bapa', where: 'Chovis Gaam Ujamni, Northolt. He speaks Kutchi; you answer however you can.',
      dialect: true,
      steps: [
        { say: 'કીં આયો દીકરા?', r: 'kien aayo dikra?', e: 'How are you, son?' },
        { reply: [
          { r: 'majama, bapa. ane tame?', e: 'Fine, bapa. And you?', ok: true },
          { r: 'achija', e: 'Bye', why: 'You only just met him. "achija" is goodbye.' },
          { r: 'chhado hane', e: 'Drop it now', why: "That's how you end an argument, not answer a greeting." }
        ] },
        { say: 'આઉં મજામાં. કડા વનોતા?', r: 'aaun majama. kada vanota?', e: "I'm fine. Where are you going?" },
        { reply: [
          { r: 'hu chaa leva jaau chu', e: "I'm going to get some tea", ok: true },
          { r: 'koro thiyo?', e: 'What happened?', why: '"kada" means where. He asked where you\'re going.' },
          { r: 'ker?', e: 'Who?', why: 'He asked where, not who.' }
        ] },
        { say: 'સારું. તારા બાપા ક્યાં છે?', r: "saaru. tara bapa kya che?", e: 'Good. Where is your father?' },
        { reply: [
          { r: 'ghare che. kaale aavshe', e: "He's at home. He'll come tomorrow", ok: true },
          { r: 'muke bhookh lagi aay', e: "I'm hungry", why: 'True, maybe, but he asked about your father.' },
          { r: 'maf karija', e: 'Sorry', why: 'Nothing to apologise for.' }
        ] },
        { say: 'ભલે. અચીજા, દીકરા.', r: 'bhale. achija, dikra.', e: 'Alright. Come again, son.' },
        { reply: [
          { r: 'achija, bapa. ashirvaad aapjo', e: 'Bye, bapa. Bless me', ok: true },
          { r: 'kien aayo?', e: 'How are you?', why: "That's hello. He's saying goodbye." },
          { r: 'khapey', e: 'I want', why: 'Wrong moment.' }
        ] }
      ]
    }
  ];

  window.APOLLO_DATA = { units, phrases, scenes };
})();
