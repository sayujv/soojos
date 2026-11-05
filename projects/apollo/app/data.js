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
    { id: 'greet', title: 'Saying hello', blurb: 'Greet anyone, from Ba to a cousin' },
    { id: 'respect', title: 'Respect & address', blurb: 'tu or tame, -bhai and -ben, touching feet, the respectful plural' },
    { id: 'family', title: 'Family', blurb: 'Who is who: kaka, mami, foi and the rest' },
    { id: 'kin2', title: 'In-laws & extended family', blurb: 'vevai, vevan, mosal, bhanej: words English doesn\'t have' },
    { id: 'food', title: 'At the table', blurb: 'Eating, refusing seconds, praising the cook, hosting' },
    { id: 'daily', title: 'Everyday talk', blurb: 'Where, when, what, shopping and haggling' },
    { id: 'learner', title: "Learner's lifelines", blurb: 'Stay in Gujarati when you get lost' },
    { id: 'feel', title: 'Feelings & manners', blurb: 'Tired, happy, sorry, missing someone' },
    { id: 'banter', title: 'Banter & reactions', blurb: 'Really?, wow, I\'m joking, stop fussing' },
    { id: 'call', title: 'The phone call', blurb: 'Calling relatives in Kutch, Kenya or the UK' },
    { id: 'care', title: 'Health & care', blurb: 'Checking on an elder who isn\'t well' },
    { id: 'samaj', title: 'Samaj & gaam', blurb: 'Which gaam?, whose son?, mandir and old stories' },
    { id: 'occasions', title: 'Festivals & occasions', blurb: 'New Year, weddings, birthdays, and a besnu' },
    { id: 'kutch', title: 'Kutchi flavour', blurb: 'How SKLPC speech differs, from public sources' }
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
    p('jsk', 'greet', 'jai shri krishna', 'જય શ્રી કૃષ્ણ', 'Hello / goodbye (devotional greeting)', { note: 'Many SKLPC families are Swaminarayan followers and greet with "jai Swaminarayan" instead. Use whichever your family uses. The Family tab is where to record it.' }),
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
    p('aahi-aav', 'daily', 'ahi aav', 'અહીં આવ', 'Come here (informal)'),
    p('beso', 'daily', 'beso', 'બેસો', 'Please sit'),
    p('chalo', 'daily', 'chalo', 'ચાલો', "Let's go / alright then"),

    // ── feel ──────────────────────────────────────────────
    p('gamyu', 'feel', 'mane gamyu', 'મને ગમ્યું', 'I liked it'),
    p('maja-aavi', 'feel', 'maja aavi', 'મજા આવી', 'That was fun'),
    p('thaki-gayo', 'feel', 'hu thaki gayo chu', 'હું થાકી ગયો છું', "I'm tired", { note: 'The ending follows your gender: a man says "gayo", a woman "gai".', f: { r: 'hu thaki gai chu', g: 'હું થાકી ગઈ છું' } }),
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

    // ── respect ───────────────────────────────────────────
    p('tame', 'respect', 'tame', 'તમે', 'You (respectful, also plural)', { note: 'Use with every elder, every in-law, and anyone you don\'t know well. When unsure, use tame.' }),
    p('aap', 'respect', 'aap', 'આપ', 'You (very formal)', { note: 'For speeches, priests and letters. In family talk it sounds stiff, or sarcastic.' }),
    p('aavo', 'respect', 'aavo', 'આવો', 'Come (respectful)', { note: '"aav" for a child or close cousin. "aavo" for anyone older. The same pattern runs through every verb: bes/beso, kar/karo, jo/juo.' }),
    p('bes', 'respect', 'bes', 'બેસ', 'Sit (informal: kids, close cousins)', { note: 'To an elder this sounds like an order. Say "beso".' }),
    p('jami-le', 'respect', 'jami le', 'જમી લે', 'Eat up (informal)', { note: 'Ba says this to you. You say "jami lo" back to her.' }),
    p('taru-naam', 'respect', 'taru naam shu che?', 'તારું નામ શું છે?', "What's your name? (to a child)", { note: '"taru" is the informal "your". With an adult, always "tamaru".' }),
    p('haa-ji', 'respect', 'haa ji', 'હા જી', 'Yes (extra respectful)', { note: 'Softer and more deferential than a plain "haa". Good with elders.' }),
    p('pagge-laagu', 'respect', 'pagge laagu', 'પગે લાગું', 'I touch your feet (greeting an elder)', { note: 'Said while bending to touch an elder\'s feet: at festivals, arrivals, departures and before exams. Expect a blessing back.' }),
    p('sukhi-raho', 'respect', 'sukhi raho', 'સુખી રહો', 'Be happy (an elder\'s blessing)', { note: 'Only elders give blessings. You receive them. Reply "tamara ashirvaad".' }),
    p('bhai-suffix', 'respect', 'Rameshbhai', 'રમેશભાઈ', 'Ramesh + bhai: how you name an older man', { note: 'Add -bhai to a man\'s name and -ben to a woman\'s. A bare first name sounds rude for anyone older than you, even your parents\' friends.' }),
    p('ben-suffix', 'respect', 'Geetaben', 'ગીતાબેન', 'Geeta + ben: how you name an older woman'),
    p('bapa-suffix', 'respect', 'Devjibapa', 'દેવજીબાપા', 'Devji + bapa: an elderly man, with deep respect', { note: 'Common in Kutch and Saurashtra for grandfathers and village elders. Check how your family uses it.' }),
    p('ma-suffix', 'respect', 'Kankuma', 'કંકુમા', 'Kanku + ma: an elderly woman, with deep respect', { note: 'The female counterpart of -bapa. Check how your family uses it.' }),
    p('motabhai', 'respect', 'motabhai', 'મોટાભાઈ', 'Elder brother (what you call him)', { note: 'Many families expect you to call an elder brother or elder cousin "motabhai", not by his name.' }),
    p('motaben', 'respect', 'motaben', 'મોટાબેન', 'Elder sister (what you call her)'),
    p('bapuji-aavya', 'respect', 'bapuji aavya che', 'બાપુજી આવ્યા છે', 'Father has arrived (respectful plural)', { note: 'When you talk ABOUT an elder, the verb goes plural: "aavya". It\'s the clearest sign of a respectful speaker.' }),
    p('bhai-aavyo', 'respect', 'bhai aavyo che', 'ભાઈ આવ્યો છે', 'My (younger) brother has arrived', { note: 'Singular "aavyo" for someone younger. Plural for a little brother sounds sarcastic.' }),

    // ── kin2 ──────────────────────────────────────────────
    p('sasra', 'kin2', 'sasra', 'સસરા', 'Father-in-law'),
    p('sasu', 'kin2', 'sasu', 'સાસુ', 'Mother-in-law'),
    p('jamai', 'kin2', 'jamai', 'જમાઈ', 'Son-in-law', { note: 'A jamai is treated as an honoured guest in his wife\'s family home. Expect to be fed a lot.' }),
    p('vahu', 'kin2', 'vahu', 'વહુ', 'Daughter-in-law'),
    p('vevai', 'kin2', 'vevai', 'વેવાઈ', "Your child's father-in-law", { note: 'Once two children marry, their fathers call each other vevai and their mothers vevan. English has no word for it.' }),
    p('vevan', 'kin2', 'vevan', 'વેવાણ', "Your child's mother-in-law"),
    p('banevi', 'kin2', 'banevi', 'બનેવી', "Sister's husband", { note: 'Many families say "jijaju" instead, which is warmer.' }),
    p('jijaju', 'kin2', 'jijaju', 'જીજાજુ', "Sister's husband (affectionate)"),
    p('nanand', 'kin2', 'nanand', 'નણંદ', "Husband's sister"),
    p('diyar', 'kin2', 'diyar', 'દિયર', "Husband's younger brother"),
    p('jeth', 'kin2', 'jeth', 'જેઠ', "Husband's elder brother", { note: 'Traditionally treated with great formality by his younger brother\'s wife.' }),
    p('bhatrijo', 'kin2', 'bhatrijo', 'ભત્રીજો', "Brother's son (nephew)", { note: 'A brother\'s daughter is "bhatriji".' }),
    p('bhanej', 'kin2', 'bhanej', 'ભાણેજ', "Sister's son or daughter", { note: 'Mama often calls his sister\'s son "bhaana" affectionately.' }),
    p('mosal', 'kin2', 'mosal', 'મોસાળ', "Your mother's family home", { note: 'Children traditionally spend holidays at the mosal. The mosal brings the "mameru" gifts at weddings.' }),
    p('pitrai', 'kin2', 'pitrai bhai', 'પિતરાઈ ભાઈ', "Cousin (father's side)", { note: 'In everyday speech most people call cousins plain "bhai" and "ben".' }),
    p('sagaa', 'kin2', 'sagaa', 'સગાં', 'Relatives', { note: 'Often doubled as "sagaa-vahala": relatives and loved ones.' }),
    p('kutumb', 'kin2', 'kutumb', 'કુટુંબ', 'The wider family'),

    // ── food (more) ───────────────────────────────────────
    p('naasto', 'food', 'chaa naasto karo', 'ચા નાસ્તો કરો', 'Have some tea and snacks', { note: 'The first thing any host says. Refusing outright is rude, so take a little.' }),
    p('jamine-jajo', 'food', 'jamine jajo', 'જમીને જજો', 'Eat before you go', { note: 'Hosts insist. It\'s polite to refuse once. They will ask again.' }),
    p('kone-banavyu', 'food', 'aa kone banavyu?', 'આ કોણે બનાવ્યું?', 'Who made this?', { note: 'Ask it after tasting and it\'s a compliment. Follow with "khub saras che".' }),
    p('mithu-ochu', 'food', 'mithu ochu che', 'મીઠું ઓછું છે', 'It needs more salt', { note: '"mithu" means salt here, but also "sweet". Context decides.' }),
    p('na-bas', 'food', 'naa, bas, have nahi', 'ના, બસ, હવે નહીં', 'No, enough, no more now'),
    p('thepla', 'food', 'thepla', 'થેપલાં', 'Thepla (spiced flatbread)'),
    p('bhakhri', 'food', 'bhakhri', 'ભાખરી', 'Bhakhri (thick, crisp flatbread)'),
    p('kadhi-khichdi', 'food', 'kadhi khichdi', 'કઢી ખીચડી', 'Kadhi and khichdi'),
    p('chhaas', 'food', 'chhaas', 'છાશ', 'Buttermilk'),
    p('gol', 'food', 'gol', 'ગોળ', 'Jaggery'),

    // ── daily (more) ──────────────────────────────────────
    p('kai-nahi', 'daily', 'kai nahi', 'કંઈ નહીં', 'Nothing much'),
    p('hamna-nahi', 'daily', 'hamna nahi', 'હમણાં નહીં', 'Not now / not yet'),
    p('fari-aavjo', 'daily', 'fari aavjo', 'ફરી આવજો', 'Come again'),
    p('ketla-nu', 'daily', 'aa ketla nu che?', 'આ કેટલાનું છે?', 'How much is this?'),
    p('monghu', 'daily', 'bahu monghu che', 'બહુ મોંઘું છે', "It's too expensive"),
    p('ochu-karo', 'daily', 'thodu ochu karo ne, bhai', 'થોડું ઓછું કરો ને, ભાઈ', 'Bring it down a bit, bhai', { note: 'Shopkeepers and strangers are "bhai" or "ben", never a bare name.' }),

    // ── learner ───────────────────────────────────────────
    p('thodu-aavde', 'learner', 'mane Gujarati thodu thodu aavde che', 'મને ગુજરાતી થોડું થોડું આવડે છે', 'I speak a little Gujarati'),
    p('shikhu-chu', 'learner', 'hu Gujarati shikhu chu', 'હું ગુજરાતી શીખું છું', "I'm learning Gujarati", { note: 'Elders light up at this. Say it early and they\'ll slow down for you.' }),
    p('kevi-rite', 'learner', 'Gujarati ma kevi rite kahevay?', 'ગુજરાતીમાં કેવી રીતે કહેવાય?', 'How do you say it in Gujarati?'),
    p('ene-shu', 'learner', 'ene shu kahevay?', 'એને શું કહેવાય?', "What's that called?"),
    p('eno-arth', 'learner', 'eno arth shu?', 'એનો અર્થ શું?', 'What does that mean?'),
    p('saachu-bolyo', 'learner', 'hu saachu bolyo?', 'હું સાચું બોલ્યો?', 'Did I say it right?', { note: 'The ending follows your gender: "bolyo" (man), "boli" (woman).', f: { r: 'hu saachu boli?', g: 'હું સાચું બોલી?' } }),
    p('sudharjo', 'learner', 'mane sudharjo', 'મને સુધારજો', 'Please correct me'),
    p('ek-vaar', 'learner', 'ek vaar fari', 'એક વાર ફરી', 'One more time'),
    p('english-ma', 'learner', 'English ma kaho ne', 'ઇંગ્લિશમાં કહો ને', 'Say it in English, please', { note: 'Your last resort. Try "eno arth shu?" first.' }),
    p('samjai-gayu', 'learner', 'haa, samjai gayu', 'હા, સમજાઈ ગયું', 'Yes, I understood'),
    p('pachi-shu', 'learner', 'pachi shu thayu?', 'પછી શું થયું?', 'Then what happened?', { note: 'The best way to keep an elder telling a story, and to keep yourself listening.' }),

    // ── banter ────────────────────────────────────────────
    p('kharekhar', 'banter', 'kharekhar?', 'ખરેખર?', 'Really?'),
    p('are-vah', 'banter', 'are vah!', 'અરે વાહ!', 'Oh wow!'),
    p('shu-vaat', 'banter', 'shu vaat che!', 'શું વાત છે!', 'No way! / Look at you!', { note: 'Said with a smile when someone shows off something good.' }),
    p('majak', 'banter', 'majak karu chu', 'મજાક કરું છું', "I'm joking"),
    p('bhale', 'banter', 'bhale', 'ભલે', 'Okay, fine / as you wish'),
    p('khabar-che', 'banter', 'haa haa, khabar che', 'હા હા, ખબર છે', 'Yes, yes, I know'),
    p('jo-to', 'banter', 'jo to!', 'જો તો!', 'Look at that!'),
    p('chup-thaa', 'banter', 'chup thaa!', 'ચૂપ થા!', 'Shush! (teasing a cousin)', { note: 'Only with someone your age or younger. To an elder it\'s shocking.' }),
    p('nakhra', 'banter', 'nakhra na kar', 'નખરાં ના કર', 'Stop being dramatic (informal)'),
    p('gusso', 'banter', 'gusso na karo', 'ગુસ્સો ના કરો', "Don't be angry"),
    p('sharam', 'banter', 'mane sharam aave che', 'મને શરમ આવે છે', "I'm embarrassed"),
    p('chalo-have', 'banter', 'chalo have', 'ચાલો હવે', "Right, let's go now"),

    // ── care ──────────────────────────────────────────────
    p('shu-thayu', 'care', 'tamne shu thayu?', 'તમને શું થયું?', "What's wrong? (respectful)"),
    p('taav', 'care', 'taav aavyo che', 'તાવ આવ્યો છે', 'I have a fever'),
    p('maathu', 'care', 'maathu dukhe che', 'માથું દુખે છે', 'My head hurts'),
    p('pet-dukhe', 'care', 'pet dukhe che', 'પેટ દુખે છે', 'My stomach hurts'),
    p('dava', 'care', 'dava lidhi?', 'દવા લીધી?', 'Did you take your medicine?'),
    p('doctor', 'care', 'doctor ne batavyu?', 'ડૉક્ટરને બતાવ્યું?', 'Did you see the doctor?'),
    p('aaram', 'care', 'aaram karo', 'આરામ કરો', 'Rest (respectful)'),
    p('saru-thai', 'care', 'jaldi saru thai jaay', 'જલ્દી સારું થઈ જાય', 'Get well soon'),
    p('chinta-thay', 'care', 'mane tamari chinta thay che', 'મને તમારી ચિંતા થાય છે', 'I worry about you'),
    p('dhyan-rakhjo', 'care', 'dhyan rakhjo', 'ધ્યાન રાખજો', 'Take care', { note: 'The standard way to end a call with an elder. To someone younger: "dhyan rakhje".' }),

    // ── samaj ─────────────────────────────────────────────
    p('kya-gaam', 'samaj', 'tame kya gaam na?', 'તમે કયા ગામના?', 'Which village is your family from?', { note: 'Often the first question at any SKLPC gathering. Know your answer.' }),
    p('amaru-gaam', 'samaj', 'amaru gaam Kutch ma che', 'અમારું ગામ કચ્છમાં છે', 'Our village is in Kutch', { note: 'Better still, name it: "amaru gaam ___ che".' }),
    p('kono-dikro', 'samaj', 'tu kono dikro?', 'તું કોનો દીકરો?', 'Whose son are you?', { f: { r: 'tu koni dikri?', g: 'તું કોની દીકરી?', e: 'Whose daughter are you?' }, note: 'Elders place you by your father. Answer with his name plus -bhai.' }),
    p('hu-no-dikro', 'samaj', 'hu Rameshbhai no dikro chu', 'હું રમેશભાઈનો દીકરો છું', "I'm Rameshbhai's son", { note: 'Your father\'s name, with -bhai. Set it under Me → About you.', f: { r: 'hu Rameshbhai ni dikri chu', g: 'હું રમેશભાઈની દીકરી છું', e: "I'm Rameshbhai's daughter" } }),
    p('aapno-samaj', 'samaj', 'aapno samaj', 'આપણો સમાજ', 'Our community', { note: '"aapno" is the inclusive "our": yours and mine together.' }),
    p('jai-swaminarayan', 'samaj', 'jai Swaminarayan', 'જય સ્વામિનારાયણ', 'Greeting among Swaminarayan followers', { note: 'Many SKLPC families are Swaminarayan satsangis (UK temples include Shree Kutch Satsang Swaminarayan). Check whether yours greets this way.' }),
    p('mandir', 'samaj', 'mandir jaiye', 'મંદિર જઈએ', "Let's go to the temple"),
    p('darshan', 'samaj', 'darshan karva jaiye', 'દર્શન કરવા જઈએ', "Let's go for darshan"),
    p('prasad', 'samaj', 'prasad lo', 'પ્રસાદ લો', 'Take some prasad', { note: 'Take it with your right hand, or both hands cupped.' }),
    p('kenya', 'samaj', 'tame Kenya ma rahya cho?', 'તમે કેન્યામાં રહ્યા છો?', 'Have you lived in Kenya?', { note: 'Many SKLPC families came via Kenya, Uganda or Tanzania. Elders love telling these stories.' }),
    p('juna-divaso', 'samaj', 'juna divaso ni vaat karo ne', 'જૂના દિવસોની વાત કરો ને', 'Tell me about the old days'),

    // ── occasions ─────────────────────────────────────────
    p('saal-mubarak', 'occasions', 'saal mubarak', 'સાલ મુબારક', 'Happy New Year (Gujarati New Year, the day after Diwali)', { note: 'Said on Bestu varas, usually with "pagge laagu" to elders.' }),
    p('nutan-varsh', 'occasions', 'nutan varshabhinandan', 'નૂતન વર્ષાભિનંદન', 'Happy New Year (formal)'),
    p('diwali', 'occasions', 'Diwali ni shubhkamna', 'દિવાળીની શુભકામના', 'Happy Diwali'),
    p('janmadin', 'occasions', 'janmadin mubarak', 'જન્મદિન મુબારક', 'Happy birthday'),
    p('abhinandan', 'occasions', 'abhinandan', 'અભિનંદન', 'Congratulations'),
    p('lagan', 'occasions', 'lagan kyare che?', 'લગ્ન ક્યારે છે?', "When's the wedding?"),
    p('kankotri', 'occasions', 'kankotri', 'કંકોતરી', 'Wedding invitation card'),
    p('chanllo', 'occasions', 'chanllo', 'ચાંલ્લો', 'Cash gift at a wedding or function', { note: 'The amount is usually written down in a book, so families remember to return the favour.' }),
    p('mameru', 'occasions', 'mameru', 'મામેરું', "Gifts from the mother's family (mosal) at a wedding"),
    p('besnu', 'occasions', 'besnu', 'બેસણું', 'Prayer meeting after a death', { note: 'Dress plainly, fold your hands, sit quietly, speak little. No "kem cho", no jokes.' }),
    p('dukh-thayu', 'occasions', 'saambhli ne bahu dukh thayu', 'સાંભળીને બહુ દુઃખ થયું', 'I was very sorry to hear it'),
    p('shanti', 'occasions', 'bhagwan emna aatma ne shanti aape', 'ભગવાન એમના આત્માને શાંતિ આપે', 'May God give their soul peace', { note: '"emna" is the respectful plural for the person who died.' }),

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
    },
    {
      id: 'bestu-varas', title: 'New Year at Dada\'s', who: 'Dada', where: 'Bestu varas morning, the day after Diwali',
      steps: [
        { say: 'આવ દીકરા! સાલ મુબારક.', r: 'aav dikra! saal mubarak.', e: 'Come in, son! Happy New Year.' },
        { reply: [
          { r: 'saal mubarak, dada. pagge laagu', e: 'Happy New Year, Dada. I touch your feet', ok: true },
          { r: 'saal mubarak! tu kem che?', e: 'Happy New Year! How are you? (informal)', why: '"tu kem che" to Dada is rude. Elders get "tame kem cho".' },
          { r: 'janmadin mubarak', e: 'Happy birthday', why: "That's happy birthday." }
        ] },
        { say: 'સુખી રહો, ખૂબ આગળ વધો.', r: 'sukhi raho, khub aagal vadho.', e: 'Be happy, go far.' },
        { reply: [
          { r: 'tamara ashirvaad, dada', e: 'All thanks to your blessings, Dada', ok: true },
          { r: 'sukhi raho, dada', e: 'Be happy, Dada', why: 'Blessings flow from elder to younger. You receive, not give.' },
          { r: 'mane khabar nathi', e: "I don't know", why: "He's blessing you, not asking anything." }
        ] },
        { say: 'મીઠાઈ ખા. ઘૂઘરા બાએ બનાવ્યા છે.', r: 'mithai khaa. ghughra ba e banavya che.', e: 'Have some sweets. Ba made the ghughra.' },
        { reply: [
          { r: 'are vah! ba, khub saras che', e: "Oh wow! Ba, they're really good", ok: true },
          { r: 'naa, bas, have nahi', e: 'No, enough, no more', why: "You haven't tried one yet. Refuse after, not before." },
          { r: 'mithu ochu che', e: 'Needs more salt', why: 'Criticising Ba\'s ghughra on New Year? Brave.' }
        ] },
        { say: 'આ વર્ષે લગ્ન ક્યારે કરવાના?', r: 'aa varshe lagan kyare karvana?', e: 'So when are you getting married this year?' },
        { reply: [
          { r: 'majak karo cho, dada! pachi vaat kariye', e: "You're joking, Dada! Let's talk later", ok: true },
          { r: 'nakhra na kar', e: 'Stop being dramatic (informal)', why: 'Informal and cheeky. Never to Dada.' },
          { r: 'kankotri', e: 'Wedding invitation', why: 'The invitation comes much later!' }
        ] }
      ]
    },
    {
      id: 'besnu', title: 'At a besnu', who: 'Kaki', where: 'A prayer meeting for a family friend who has passed away',
      steps: [
        { say: 'આવો, બેસો.', r: 'aavo, beso.', e: 'Come, sit.' },
        { reply: [
          { r: 'jai shri krishna, kaki', e: 'A quiet greeting, hands folded', ok: true },
          { r: 'kem cho kaki? majama?', e: 'How are you, Kaki? All good?', why: 'Asking if everyone is "majama" at a besnu sounds careless.' },
          { r: 'are vah!', e: 'Oh wow!', why: 'Far too cheerful for a besnu.' }
        ] },
        { say: 'બહુ અચાનક થયું.', r: 'bahu achanak thayu.', e: 'It happened so suddenly.' },
        { reply: [
          { r: 'saambhli ne bahu dukh thayu', e: 'I was very sorry to hear it', ok: true },
          { r: 'koi vaandho nahi', e: 'No problem', why: '"No problem" is the worst thing you could say here.' },
          { r: 'kharekhar?', e: 'Really?', why: 'Sounds like doubt or gossip. Offer sympathy instead.' }
        ] },
        { say: 'એ તમને બહુ યાદ કરતા.', r: 'e tamne bahu yaad karta.', e: 'He often spoke of you.' },
        { reply: [
          { r: 'bhagwan emna aatma ne shanti aape', e: 'May God give his soul peace', ok: true },
          { r: 'shu vaat che!', e: 'No way! / Look at that!', why: 'An exclamation of delight. Very wrong here.' },
          { r: 'jamine jajo', e: 'Eat before you go', why: "That's what a host says to guests." }
        ] },
        { say: 'આવવા બદલ આભાર, બેટા.', r: 'aavva badal aabhar, beta.', e: 'Thank you for coming, dear.' },
        { reply: [
          { r: 'dhyan rakhjo, kaki', e: 'Take care, Kaki', ok: true },
          { r: 'saal mubarak', e: 'Happy New Year', why: 'Festival greeting. Wrong occasion.' },
          { r: 'chalo have', e: "Right, let's go now", why: 'Sounds like you\'re glad to leave. Keep it gentle.' }
        ] }
      ]
    },
    {
      id: 'kono-dikro', title: 'Whose son are you?', who: 'Elder at the samaj', where: 'The samaj hall, after a function',
      steps: [
        { say: 'જય સ્વામિનારાયણ. તું કોનો દીકરો?', r: 'jai Swaminarayan. tu kono dikro?', e: 'Jai Swaminarayan. Whose son are you?' },
        { reply: [
          { r: 'jai Swaminarayan. hu Rameshbhai no dikro chu', e: "Jai Swaminarayan. I'm Rameshbhai's son", ok: true },
          { r: 'hu Ramesh no dikro chu', e: "I'm Ramesh's son", why: 'To an elder, your father is "Rameshbhai". The bare name sounds disrespectful.' },
          { r: 'tamaru naam shu che?', e: "What's your name?", why: 'Answer his question first, then ask yours.' }
        ] },
        { say: 'અરે! તમે કયા ગામના?', r: 'are! tame kya gaam na?', e: 'Oh! Which village is your family from?' },
        { reply: [
          { r: 'amaru gaam Kutch ma che', e: 'Our village is in Kutch', ok: true },
          { r: 'Perth ma varsaad che', e: "It's raining in Perth", why: 'He asked about your gaam, not the weather.' },
          { r: 'mane sharam aave che', e: "I'm embarrassed", why: 'No need to be shy. Name your gaam. Ask your parents if you don\'t know it!' }
        ] },
        { say: 'સરસ. તને ગુજરાતી આવડે છે?', r: 'saras. tane Gujarati aavde che?', e: 'Nice. Do you know Gujarati?' },
        { reply: [
          { r: 'thodu thodu aavde che. hu shikhu chu', e: "A little. I'm learning", ok: true },
          { r: 'naa', e: 'No', why: "You're speaking it right now. Give yourself credit." },
          { r: 'English ma kaho ne', e: 'Say it in English', why: "Don't give up yet!" }
        ] },
        { say: 'શાબાશ! બાપુજીને મારા જય સ્વામિનારાયણ કહેજે.', r: 'shabash! bapuji ne mara jai Swaminarayan kaheje.', e: 'Well done! Give your father my regards.' },
        { reply: [
          { r: 'haa ji, kahish', e: "Yes, I'll tell him", ok: true },
          { r: 'bhai aavyo che', e: 'My brother has arrived', why: 'Off topic, and nobody asked about your brother.' },
          { r: 'chup thaa!', e: 'Shush!', why: 'Never to an elder.' }
        ] }
      ]
    },
    {
      id: 'ba-unwell', title: "Ba isn't well", who: 'Ba', where: 'A phone call to Ba, who has a fever',
      steps: [
        { say: 'હેલો દીકરા… મને થોડો તાવ છે.', r: 'hello dikra… mane thodo taav che.', e: 'Hello, son… I have a bit of a fever.' },
        { reply: [
          { r: 'tamne shu thayu, ba? doctor ne batavyu?', e: "What's wrong, Ba? Have you seen the doctor?", ok: true },
          { r: 'tu kem che?', e: 'How are you? (informal)', why: '"tu" to Ba. Elders get "tame".' },
          { r: 'maja aavi', e: 'That was fun', why: "That's 'it was fun'. Not the moment." }
        ] },
        { say: 'હા, કાલે બતાવ્યું. દવા આપી છે.', r: 'haa, kaale batavyu. dava aapi che.', e: 'Yes, I saw him yesterday. He gave me medicine.' },
        { reply: [
          { r: 'saru. dava lidhi?', e: 'Good. Have you taken it?', ok: true },
          { r: 'abhinandan', e: 'Congratulations', why: 'Congratulations on the fever? No.' },
          { r: 'bhale', e: 'Okay, fine', why: 'Too flat. Show you care.' }
        ] },
        { say: 'હા, લીધી. તું ચિંતા ના કર.', r: 'haa, lidhi. tu chinta na kar.', e: "Yes, I took it. Don't you worry." },
        { reply: [
          { r: 'mane tamari chinta thay che. aaram karo', e: 'I worry about you. Rest', ok: true },
          { r: 'tame pan chinta na kar', e: "Don't you worry either (mixed)", why: '"na kar" is informal: Ba says it to you. Back to her it\'s "na karo".' },
          { r: 'chalo have', e: "Right, let's go now", why: "Don't rush off a sick grandmother." }
        ] },
        { say: 'હા બેટા. તું ક્યારે આવીશ?', r: 'haa beta. tu kyare aavish?', e: 'Yes, child. When will you visit?' },
        { reply: [
          { r: 'jaldi aavish, ba. dhyan rakhjo', e: "I'll come soon, Ba. Take care", ok: true },
          { r: 'dhyan rakhje', e: 'Take care (informal)', why: '"rakhje" is for someone younger. To Ba: "rakhjo".' },
          { r: 'jo to!', e: 'Look at that!', why: 'Means "look at that!".' }
        ] }
      ]
    },
    {
      id: 'rishta', title: "The aunties' question", who: 'Masi', where: "A cousin's engagement party",
      steps: [
        { say: 'કેમ છે બેટા? બહુ મોટો થઈ ગયો!', r: 'kem che beta? bahu moto thai gayo!', e: "How are you, dear? You've grown so much!" },
        { reply: [
          { r: 'majama, masi. tame kem cho?', e: 'Fine, Masi. How are you?', ok: true },
          { r: 'majama. tu kem che?', e: 'Fine. How are you? (informal)', why: 'She can say "kem che" to you. You say "tame kem cho" to her.' },
          { r: 'pet dukhe che', e: 'My stomach hurts', why: 'Too much information.' }
        ] },
        { say: 'હવે તારો વારો. છોકરી જોઈ?', r: 'have taro vaaro. chhokri joi?', e: "Now it's your turn. Found a girl yet?" },
        { reply: [
          { r: 'hamna nahi, masi', e: 'Not yet, Masi', ok: true },
          { r: 'nakhra na kar', e: 'Stop being dramatic', why: 'Cheeky and informal, to an elder.' },
          { r: 'abhinandan', e: 'Congratulations', why: 'Save that for the engaged couple.' }
        ] },
        { say: 'અમારી ઓળખાણમાં એક સારી છોકરી છે…', r: 'amari olkhaan ma ek saari chhokri che…', e: 'We know a nice girl…' },
        { reply: [
          { r: 'bhale masi, pachi vaat kariye', e: "Sure Masi, let's talk later", ok: true },
          { r: 'chup thaa!', e: 'Shush!', why: 'Rude to any elder, even a meddling one.' },
          { r: 'mane samjayu nahi', e: "I didn't understand", why: 'You understood perfectly. Nice try.' }
        ] },
        { say: 'હા હા. ચાલ, જમી લે.', r: 'haa haa. chaal, jami le.', e: 'Ha ha. Come on, go and eat.' },
        { reply: [
          { r: 'haa, chalo masi', e: "Yes, let's go, Masi", ok: true },
          { r: 'tame pan jami le', e: 'You eat too (informal)', why: '"jami le" is how she talks to you. To her: "jami lo".' },
          { r: 'dava lidhi?', e: 'Did you take your medicine?', why: 'Wrong moment.' }
        ] }
      ]
    },
    {
      id: 'mehman', title: 'Guests at the door', who: 'Kaka', where: 'Kaka and Kaki drop in unannounced',
      steps: [
        { say: 'જય શ્રી કૃષ્ણ! ઘરે કોઈ છે?', r: 'jai shri krishna! ghare koi che?', e: 'Jai Shri Krishna! Anyone home?' },
        { reply: [
          { r: 'aavo aavo, kaka! beso', e: 'Come in, come in, Kaka! Sit', ok: true },
          { r: 'aav, bes', e: 'Come, sit (informal)', why: 'Informal forms. To Kaka: "aavo, beso".' },
          { r: 'aavjo', e: 'Goodbye', why: "That's goodbye. They just arrived." }
        ] },
        { say: 'ના ના, બસ પાંચ મિનિટ માટે આવ્યા છીએ.', r: 'naa naa, bas paanch minit maate aavya chhiye.', e: "No no, we've only come for five minutes." },
        { reply: [
          { r: 'chaa naasto to karo', e: 'At least have tea and a snack', ok: true },
          { r: 'bhale, aavjo', e: 'Fine, bye', why: 'Letting a guest go without offering anything? Ba would never forgive you.' },
          { r: 'kharekhar?', e: 'Really?', why: 'Push back with an offer, not a question.' }
        ] },
        { say: 'સારું, પણ થોડી જ ચા.', r: 'saaru, pan thodi ja chaa.', e: 'Okay, but just a little tea.' },
        { reply: [
          { r: 'haa, ane jamine jajo', e: 'Sure. And eat before you go', ok: true },
          { r: 'naa, bas', e: 'No, enough', why: "That's refusing food, and you're the host." },
          { r: 'gusso na karo', e: "Don't be angry", why: "No one's angry." }
        ] },
        { say: 'ના બેટા, આજે નહીં. આવતી વખતે.', r: 'naa beta, aaje nahi. aavti vakhate.', e: 'No dear, not today. Next time.' },
        { reply: [
          { r: 'saaru kaka, fari aavjo', e: 'Okay Kaka, come again', ok: true },
          { r: 'chalo have', e: "Right, let's go now", why: 'Sounds like you want them gone.' },
          { r: 'aav', e: 'Come (informal)', why: 'Informal, and they\'re leaving, not arriving.' }
        ] }
      ]
    },
    {
      id: 'bhuj-bazaar', title: 'Bargaining in Bhuj', who: 'Shopkeeper', where: 'A bandhani shop in Bhuj bazaar',
      steps: [
        { say: 'આવો, શું જોઈએ?', r: 'aavo, shu joie?', e: 'Welcome, what are you after?' },
        { reply: [
          { r: 'aa ketla nu che?', e: 'How much is this?', ok: true },
          { r: 'tamaru naam shu che?', e: "What's your name?", why: "He's selling, not socialising." },
          { r: 'maaf karjo', e: "I'm sorry", why: 'Nothing to apologise for.' }
        ] },
        { say: 'બે હજાર રૂપિયા.', r: 'be hajaar rupiya.', e: 'Two thousand rupees.' },
        { reply: [
          { r: 'bahu monghu che! thodu ochu karo ne, bhai', e: 'Too expensive! Bring it down a bit, bhai', ok: true },
          { r: 'barabar', e: 'Right, exactly', why: 'Never accept the first price in a bazaar.' },
          { r: 'chup thaa!', e: 'Shush!', why: 'Rude to a stranger.' }
        ] },
        { say: 'તમારા માટે પંદરસો.', r: 'tamara maate pandarso.', e: 'For you, fifteen hundred.' },
        { reply: [
          { r: 'saaru bhai, aapo', e: 'Fine, bhai, I\'ll take it', ok: true },
          { r: 'naa, bas, have nahi', e: 'No, enough, no more', why: "That's how you refuse food." },
          { r: 'aav', e: 'Come (informal)', why: 'Informal, and to a stranger.' }
        ] },
        { say: 'આભાર. ફરી આવજો!', r: 'aabhar. fari aavjo!', e: 'Thank you. Come again!' },
        { reply: [
          { r: 'aavjo, bhai', e: 'Bye, bhai', ok: true },
          { r: 'sukhi raho', e: 'Be happy (blessing)', why: "That's an elder's blessing. Not yours to give a shopkeeper." },
          { r: 'ashirvaad aapjo', e: 'Bless me', why: 'Asking a shopkeeper for blessings is odd.' }
        ] }
      ]
    },
    {
      id: 'cousin', title: 'Cousin banter', who: 'Nikhil', where: 'Your younger cousin, at a family barbecue',
      steps: [
        { say: 'એ ભાઈ! શું કરે છે?', r: 'e bhai! shu kare che?', e: "Hey bro! What're you up to?" },
        { reply: [
          { r: 'kai nahi. tu shu kare che?', e: 'Nothing much. What about you?', ok: true },
          { r: 'kai nahi. tame shu karo cho?', e: 'Nothing. And you? (respectful)', why: '"tame" to your younger cousin sounds stiff, like you\'re annoyed.' },
          { r: 'pagge laagu', e: 'I touch your feet', why: "He's your younger cousin!" }
        ] },
        { say: 'મેં તારો ફોટો જોયો. શું વાત છે!', r: 'me taro photo joyo. shu vaat che!', e: 'I saw your photo. Look at you!' },
        { reply: [
          { r: 'chup thaa! majak na kar', e: "Shush! Don't tease", ok: true },
          { r: 'maaf karjo', e: "I'm sorry / forgive me", why: 'Way too formal for banter.' },
          { r: 'tamara ashirvaad', e: 'Thanks to your blessings', why: "Your little cousin can't bless you." }
        ] },
        { say: 'હા હા! ચાલ, ક્રિકેટ રમવા જઈએ?', r: 'haa haa! chaal, cricket ramva jaiye?', e: 'Ha! Come on, shall we play cricket?' },
        { reply: [
          { r: 'haa, chaal!', e: "Yeah, let's go!", ok: true },
          { r: 'beso', e: 'Please sit (respectful)', why: '"beso" is a respectful "sit". Wrong word, wrong register.' },
          { r: 'dhyan rakhjo', e: 'Take care (respectful)', why: 'A goodbye for elders.' }
        ] }
      ]
    },
    {
      id: 'mosal-call', title: 'Video call to Mama', who: 'Mama', where: 'Your mother\'s brother, in Nairobi',
      steps: [
        { say: 'ઓહો! ભાણા, કેમ છે?', r: 'oho! bhaana, kem che?', e: 'Oho! My boy, how are you?' },
        { reply: [
          { r: 'majama, mama. mami kem che?', e: 'Fine, Mama. How is Mami?', ok: true },
          { r: 'majama, kaka. tame kem cho?', e: 'Fine, Kaka. How are you?', why: 'He\'s your MOTHER\'S brother: "mama". Kaka is your father\'s brother.' },
          { r: 'majama. tu kem che?', e: 'Fine. How are you? (informal)', why: '"tu" to Mama. He gets "tame".' }
        ] },
        { say: 'મજામાં. નૈરોબીમાં હવે ગરમી છે.', r: 'majama. Nairobi ma have garmi che.', e: 'She\'s fine. It\'s hot in Nairobi now.' },
        { reply: [
          { r: 'Perth ma varsaad che', e: "It's raining in Perth", ok: true },
          { r: 'tame kya gaam na?', e: 'Which village are you from?', why: "He's your mama. You know his gaam!" },
          { r: 'abhinandan', e: 'Congratulations', why: 'Congratulations on the heat?' }
        ] },
        { say: 'મોસાળ ક્યારે આવે છે?', r: 'mosal kyare aave che?', e: 'When are you coming to your mosal?' },
        { reply: [
          { r: 'aavta varshe aavish, mama', e: "I'll come next year, Mama", ok: true },
          { r: 'kaale', e: 'Tomorrow', why: 'Unless you have a ticket for tomorrow!' },
          { r: 'mane khabar nathi', e: "I don't know", why: 'True, maybe, but cold. Give him something.' }
        ] },
        { say: 'સારું. ધ્યાન રાખજે, બેટા.', r: 'saaru. dhyan rakhje, beta.', e: 'Good. Take care, son.' },
        { reply: [
          { r: 'tame pan dhyan rakhjo, mama', e: 'You take care too, Mama', ok: true },
          { r: 'tu pan dhyan rakhje', e: 'You take care too (informal)', why: '"rakhje" is the informal form he used for you. Back to him: "rakhjo".' },
          { r: 'saal mubarak', e: 'Happy New Year', why: 'Wrong occasion.' }
        ] }
      ]
    },
    {
      id: 'foi-story', title: "Foi's story", who: 'Foi', where: 'After dinner. Foi is telling a long story and you\'re losing the thread',
      steps: [
        { say: 'તે દિવસે ગામમાં બહુ વરસાદ પડ્યો, અને નદી છલકાઈ ગઈ…', r: 'te divase gaam ma bahu varsaad padyo, ane nadi chhalkai gai…', e: 'That day it poured in the village, and the river overflowed…' },
        { reply: [
          { r: 'chhalkai? eno arth shu, foi?', e: '"chhalkai"? What does that mean, Foi?', ok: true },
          { r: 'aavjo', e: 'Goodbye', why: "She's mid-story." },
          { r: 'tikhu che', e: "It's spicy", why: "That's about food. She's telling a story." }
        ] },
        { say: 'છલકાઈ ગઈ એટલે પાણી બહાર આવી ગયું.', r: 'chhalkai gai etle paani bahar aavi gayu.', e: '"Overflowed" means the water came out over the banks.' },
        { reply: [
          { r: 'haa, samjai gayu', e: 'Yes, I understood', ok: true },
          { r: 'mane sudharjo', e: 'Please correct me', why: "She hasn't corrected you. You haven't said anything yet." },
          { r: 'naa', e: 'No', why: 'Let her know you followed.' }
        ] },
        { say: 'પછી બાપુજી બધા ઢોર લઈને ટેકરી પર ગયા.', r: 'pachi bapuji badha dhor laine tekri par gaya.', e: 'Then Bapuji took all the cattle up the hill.' },
        { reply: [
          { r: 'dhire bolo ne, foi', e: 'A bit slower please, Foi', ok: true },
          { r: 'chup thaa!', e: 'Shush!', why: 'Never to Foi.' },
          { r: 'bas, pet bharai gayu', e: "Enough, I'm full", why: 'Food again. She\'s telling a story.' }
        ] },
        { say: 'હા હા, ધીરે બોલું. ઢોર એટલે ગાય ભેંસ.', r: 'haa haa, dhire bolu. dhor etle gaay bhens.', e: 'All right, slower. "dhor" means cows and buffaloes.' },
        { reply: [
          { r: 'are vah! pachi shu thayu?', e: 'Wow! Then what happened?', ok: true },
          { r: 'jamine jajo', e: 'Eat before you go', why: "That's what a host says when guests leave." },
          { r: 'tu kono dikro?', e: 'Whose son are you?', why: 'You\'re asking Foi whose son she is.' }
        ] }
      ]
    },
    {
      id: 'drill-register', title: 'Drill: tu or tame?', who: 'Drill', where: 'Twelve quick calls. Pick the form that fits the person.', drill: true,
      steps: [
        { cue: 'Ba is standing. Ask her to sit.' },
        { reply: [{ r: 'beso, ba', e: 'Please sit, Ba', ok: true }, { r: 'bes, ba', e: 'Sit, Ba (informal)', why: '"bes" is for kids and close cousins.' }] },
        { cue: 'Your 8-year-old cousin is across the room. Call him over.' },
        { reply: [{ r: 'ahi aav', e: 'Come here (informal)', ok: true }, { r: 'ahi padharo', e: 'Kindly come here (very formal)', why: '"padharo" is for honoured guests. To a kid it\'s comic.' }] },
        { cue: 'Kaka picks up the phone. Ask how he is.' },
        { reply: [{ r: 'kem cho, kaka?', e: 'How are you, Kaka?', ok: true }, { r: 'kem che, kaka?', e: 'How are you, Kaka? (informal)', why: '"kem che" goes with "tu". Kaka gets "kem cho".' }] },
        { cue: "Your dad's friend Mahesh walks in. Greet him by name." },
        { reply: [{ r: 'jai shri krishna, Maheshbhai', e: 'Jai Shri Krishna, Maheshbhai', ok: true }, { r: 'jai shri krishna, Mahesh', e: 'Jai Shri Krishna, Mahesh', why: 'An older man gets -bhai, or "kaka". Never the bare name.' }] },
        { cue: 'At a stall, get the shopkeeper\'s attention.' },
        { reply: [{ r: 'bhai, aa ketla nu che?', e: 'Bhai, how much is this?', ok: true }, { r: 'aye, aa ketla nu che?', e: 'Oi, how much is this?', why: 'Strangers are "bhai" or "ben". "aye" is rude.' }] },
        { cue: 'Tell Ba that Dada has arrived.' },
        { reply: [{ r: 'dada aavya che', e: 'Dada has arrived (respectful)', ok: true }, { r: 'dada aavyo che', e: 'Dada has arrived (singular)', why: 'Talking about an elder takes the respectful plural: "aavya".' }] },
        { cue: 'Tell Ba that your little brother has arrived.' },
        { reply: [{ r: 'bhai aavyo che', e: 'Bhai has arrived', ok: true }, { r: 'bhai aavya che', e: 'Bhai has arrived (respectful)', why: 'Respectful plural for your little brother sounds sarcastic.' }] },
        { cue: "Ask your friend's grandmother her name." },
        { reply: [{ r: 'tamaru naam shu che, ba?', e: "What's your name, Ba?", ok: true }, { r: 'taru naam shu che?', e: "What's your name? (informal)", why: '"taru" is for kids. Elders get "tamaru".' }] },
        { cue: 'Bestu varas. Greet Dada properly.' },
        { reply: [{ r: 'saal mubarak, dada. pagge laagu', e: 'Happy New Year, Dada. I touch your feet', ok: true }, { r: 'hi dada!', e: 'Hi Dada!', why: 'At Bestu varas, elders expect "pagge laagu" and a bow.' }] },
        { cue: 'End a call with Kaka.' },
        { reply: [{ r: 'dhyan rakhjo, kaka', e: 'Take care, Kaka', ok: true }, { r: 'dhyan rakhje, kaka', e: 'Take care, Kaka (informal)', why: '"rakhje" is for someone younger. Kaka gets "rakhjo".' }] },
        { cue: 'Your cousin keeps teasing you. Tell him to stop.' },
        { reply: [{ r: 'chup thaa!', e: 'Shush!', ok: true }, { r: 'maaf karjo, chup raho', e: 'Excuse me, please be quiet', why: 'So formal it sounds like a teacher. Cousins get "chup thaa".' }] },
        { cue: 'Ba is serving you. Tell her to eat too.' },
        { reply: [{ r: 'ba, tame pan jami lo', e: 'Ba, you eat too', ok: true }, { r: 'ba, tu pan jami le', e: 'Ba, you eat too (informal)', why: 'Ba says "jami le" to you. Back to her it\'s "tame… jami lo".' }] }
      ]
    },
    {
      id: 'drill-kin', title: "Drill: who's who?", who: 'Drill', where: 'Name the relative. The ones English lumps together as "uncle" and "aunt".', drill: true,
      steps: [
        { cue: "Your father's younger brother." },
        { reply: [{ r: 'kaka', e: "Father's younger brother", ok: true }, { r: 'mama', e: "Mother's brother", why: 'Mama is on your mother\'s side.' }] },
        { cue: "Your father's ELDER brother." },
        { reply: [{ r: 'mota pappa', e: "Father's elder brother", ok: true }, { r: 'kaka', e: "Father's younger brother", why: 'Kaka is the younger one. The elder is "mota pappa" (some families say "mota bapa").' }] },
        { cue: "Your mother's sister." },
        { reply: [{ r: 'masi', e: "Mother's sister", ok: true }, { r: 'foi', e: "Father's sister", why: '"foi" is your father\'s sister.' }] },
        { cue: "Your father's sister's husband." },
        { reply: [{ r: 'fuva', e: "Foi's husband", ok: true }, { r: 'masa', e: "Masi's husband", why: 'Masa is married to masi (mother\'s side).' }] },
        { cue: "Your mother's brother's wife." },
        { reply: [{ r: 'mami', e: "Mama's wife", ok: true }, { r: 'kaki', e: "Kaka's wife", why: 'Kaki is on your father\'s side.' }] },
        { cue: "Your sister's husband." },
        { reply: [{ r: 'jijaju', e: "Sister's husband", ok: true }, { r: 'jeth', e: "A woman's husband's elder brother", why: '"jeth" is a different relation entirely.' }] },
        { cue: "Your brother's son." },
        { reply: [{ r: 'bhatrijo', e: "Brother's son", ok: true }, { r: 'bhanej', e: "Sister's child", why: '"bhanej" is a SISTER\'s child.' }] },
        { cue: "Your mother's parents' home, where you spend the holidays." },
        { reply: [{ r: 'mosal', e: "Mother's family home", ok: true }, { r: 'sasru', e: "In-laws' home", why: '"sasru" is your spouse\'s family home.' }] },
        { cue: "Your sister's father-in-law, as your parents call him." },
        { reply: [{ r: 'vevai', e: "Child's father-in-law", ok: true }, { r: 'sasra', e: 'Father-in-law', why: 'He\'s HER sasra. To your parents he\'s "vevai".' }] }
      ]
    }

  ];

  // Who's who: how to address each relation. "say" = what you call them; "you" = tu or tame.
  const guide = [
    { group: "Dad's side", rows: [
      ["Dad's father", 'dada', 'tame', ''],
      ["Dad's mother", 'ba / dadi', 'tame', 'In many families "ba" also means mother. Check yours.'],
      ["Dad's elder brother", 'mota pappa', 'tame', 'Some families say "mota bapa".'],
      ["Dad's younger brother", 'kaka', 'tame', ''],
      ["Kaka's wife", 'kaki', 'tame', ''],
      ["Dad's sister", 'foi', 'tame', ''],
      ["Foi's husband", 'fuva', 'tame', ''],
      ['Their children (your cousins)', 'bhai / ben, or motabhai / motaben if older', 'tu (younger), varies (older)', 'Older cousins: follow what your parents do.']
    ] },
    { group: "Mum's side (your mosal)", rows: [
      ["Mum's father", 'nana', 'tame', ''],
      ["Mum's mother", 'nani', 'tame', ''],
      ["Mum's brother", 'mama', 'tame', 'He may call you "bhaana" (sister\'s boy).'],
      ["Mama's wife", 'mami', 'tame', ''],
      ["Mum's sister", 'masi', 'tame', ''],
      ["Masi's husband", 'masa', 'tame', '']
    ] },
    { group: 'Your generation', rows: [
      ['Elder brother', 'motabhai', 'tame or tu (family habit)', 'Many families frown on using his bare name.'],
      ['Elder sister', 'motaben', 'tame or tu (family habit)', ''],
      ['Younger sibling', 'their name, or bhai / ben', 'tu', ''],
      ["Brother's wife", 'bhabhi', 'tame', ''],
      ["Sister's husband", 'jijaju / banevi', 'tame', 'A jamai in her family: treat him as an honoured guest.'],
      ["Brother's son / daughter", 'bhatrijo / bhatriji', 'tu', ''],
      ["Sister's son / daughter", 'bhanej', 'tu', '']
    ] },
    { group: 'Through marriage', rows: [
      ["Spouse's father / mother", 'sasra / sasu (often "pappa" / "mummy" to their face)', 'tame', ''],
      ["Your child's in-laws", 'vevai / vevan', 'tame', 'Formal and respectful on both sides.'],
      ["Daughter's husband", 'jamai (call him by name + "kumar" or just his name)', 'tame', 'Varies by family.'],
      ["Son's wife", 'vahu', 'tu or tame (family habit)', ''],
      ["Husband's sister", 'nanand', 'varies', ''],
      ["Husband's younger / elder brother", 'diyar / jeth', 'tame (jeth always)', ''],
      ["Wife's brother / sister", 'saalo / saali', 'tame', '"saalo" is also a common insult. To his face, use his name + bhai.']
    ] },
    { group: 'Outside the family', rows: [
      ['An older man', 'name + bhai, or "kaka"', 'tame', 'Never a bare first name.'],
      ['An older woman', 'name + ben, or "masi" / "kaki"', 'tame', ''],
      ['A village elder', 'name + bapa / ma, or "bapa" / "ba"', 'tame', 'Common in Kutch and Saurashtra.'],
      ['Shopkeeper, driver, stranger', 'bhai / ben', 'tame', ''],
      ['Priest at the mandir', 'maharaj / swami', 'tame (or aap)', ''],
      ['Any child', 'their name, or beta / dikra', 'tu', '']
    ] }
  ];

  window.APOLLO_DATA = { units, phrases, scenes, guide };
})();
