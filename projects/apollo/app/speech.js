/* Apollo: how Gujarati is really spoken.
 *
 * ladders    the same sentence from formal down to clipped, Gujlish and Kutchi.
 *            Rung: { l: label, r, g, n?: note, src?, conf? }. Rungs without src are
 *            standard or colloquial Gujarati from Claude's own knowledge (unsourced);
 *            Kutchi and "Village" rungs carry their source.
 * reductions the rules behind the short forms.
 * gym        production drills: sentences split into chunks ("|"), with trap chunks
 *            that make the classic mistakes (hu for mane, -o for -i, tu for tame).
 * level      the level check: words, sentences, building, register, recall.
 *
 * Authored 2026-11-05. Not yet checked by an SKLPC speaker: every ladder has a
 * "Your family says…" line so the family's own forms can be recorded.
 */
(function () {
  const VILLAGE = { src: 'https://scielo.org.za/scielo.php?script=sci_arttext&pid=S2224-33802023000300012', conf: 'claimed', n: 'ch → s is documented for Kathiawadi and village Gujarati. Whether your family says it is for them to tell you.' };
  const KUTCHI = (src) => ({ src, conf: 'claimed' });
  const ladders = [
    { id: 'how-are-you', e: 'How are you?', rungs: [
      { l: 'Formal', r: 'aap kem cho?', g: 'આપ કેમ છો?', n: 'Speeches, priests, very senior elders.' },
      { l: 'Everyday', r: 'kem cho?', g: 'કેમ છો?' },
      { l: 'Casual', r: 'kem, majama?', g: 'કેમ, મજામાં?', n: 'Question and expected answer in one breath.' },
      { l: 'Playful', r: 'su chaale?', g: 'સુ ચાલે?', n: '"What\'s going on?" with su for shu and no che.' },
      Object.assign({ l: 'Kutchi', r: 'kien aayo?', g: 'કીં આયો?' }, KUTCHI('https://www.memeraki.com/blogs/posts/the-language-of-kutch'))
    ] },
    { id: 'what-doing', e: 'What are you doing?', rungs: [
      { l: 'Formal', r: 'tame shu karo cho?', g: 'તમે શું કરો છો?' },
      { l: 'Everyday', r: 'shu kare che?', g: 'શું કરે છે?' },
      { l: 'Casual', r: 'su kare?', g: 'સુ કરે?', n: 'shu → su, and the che falls off.' },
      Object.assign({ l: 'Village', r: 'su kare se?', g: 'સુ કરે સે?' }, VILLAGE),
      Object.assign({ l: 'Kutchi', r: 'kuro karyota?', g: 'કુરો કર્યોતા?' }, KUTCHI('https://www.memeraki.com/blogs/posts/the-language-of-kutch'))
    ] },
    { id: 'dont-know', e: "I don't know", rungs: [
      { l: 'Formal', r: 'mane khabar nathi', g: 'મને ખબર નથી' },
      { l: 'Everyday', r: 'khabar nathi', g: 'ખબર નથી', n: '"mane" is understood, so it drops.' },
      { l: 'Casual', r: 'khabar nai', g: 'ખબર નઈ', n: 'nathi → nai.' },
      { l: 'Gujlish', r: 'no idea, yaar', g: 'નો આઇડિયા, યાર' }
    ] },
    { id: 'nothing-much', e: 'Nothing much', rungs: [
      { l: 'Everyday', r: 'kai nahi', g: 'કંઈ નહીં' },
      { l: 'Casual', r: 'kai nai', g: 'કંઈ નઈ' },
      { l: 'Playful', r: 'bas, aaram', g: 'બસ, આરામ', n: '"Just chilling."' },
      { l: 'Gujlish', r: 'bas, chill', g: 'બસ, ચિલ' }
    ] },
    { id: 'lets-go', e: "Let's go", rungs: [
      { l: 'Formal', r: 'chalo, jaiye', g: 'ચાલો, જઈએ' },
      { l: 'Everyday', r: 'chalo', g: 'ચાલો' },
      { l: 'Casual', r: 'chal', g: 'ચાલ', n: 'To one friend or cousin.' },
      { l: 'Village', r: 'haalo', g: 'હાલો', n: 'Heard in Saurashtra and Kutch for "chalo". Check with family.' }
    ] },
    { id: 'heading-off', e: "I'm heading home", rungs: [
      { l: 'Formal', r: 'hu ghare jaau chu', g: 'હું ઘરે જાઉં છું' },
      { l: 'Everyday', r: 'ghare jaau chu', g: 'ઘરે જાઉં છું', n: '"hu" drops: the ending already says "I".' },
      { l: 'Casual', r: 'chal, hu nikdu', g: 'ચાલ, હું નીકળું', n: '"nikdu" = let me head off.' }
    ] },
    { id: 'what-happened', e: 'What happened?', rungs: [
      { l: 'Everyday', r: 'shu thayu?', g: 'શું થયું?' },
      { l: 'Casual', r: 'su thyu?', g: 'સુ થ્યું?', n: 'thayu squeezes to "thyu".' },
      { l: 'Playful', r: 'have shu thayu?', g: 'હવે શું થયું?', n: '"Now what?", with a sigh.' },
      Object.assign({ l: 'Kutchi', r: 'koro thiyo?', g: 'કોરો થીયો?' }, KUTCHI('https://kutchimaadu.com/general/kutchi-language/'))
    ] },
    { id: 'really', e: 'Really?', rungs: [
      { l: 'Everyday', r: 'kharekhar?', g: 'ખરેખર?' },
      { l: 'Casual', r: 'saachu?', g: 'સાચું?' },
      { l: 'Playful', r: 'jaa jaa, khotu!', g: 'જા જા, ખોટું!', n: '"Get out, that\'s not true!" Peers only.' }
    ] },
    { id: 'hungry', e: "I'm hungry", rungs: [
      { l: 'Formal', r: 'mane bhukh lagi che', g: 'મને ભૂખ લાગી છે' },
      { l: 'Casual', r: 'bhukh lagi', g: 'ભૂખ લાગી' },
      { l: 'Playful', r: 'pet ma undar dode che', g: 'પેટમાં ઉંદર દોડે છે', n: '"Mice are running in my stomach": I\'m starving.' },
      Object.assign({ l: 'Kutchi', r: 'muke bhookh lagi aay', g: 'મુકે ભૂખ લગી આય' }, KUTCHI('https://grand3d.in/?page_id=136'))
    ] },
    { id: 'food-good', e: "This food's great", rungs: [
      { l: 'Everyday', r: 'khub saras che', g: 'ખૂબ સરસ છે' },
      { l: 'Casual', r: 'mast che', g: 'મસ્ત છે' },
      { l: 'Playful', r: 'jalsa padi gaya!', g: 'જલસા પડી ગયા!', n: '"What a treat!" Cooks love hearing it.' },
      { l: 'Gujlish', r: 'ekdum first class', g: 'એકદમ ફર્સ્ટ ક્લાસ' }
    ] },
    { id: 'dont-worry', e: "Don't worry", rungs: [
      { l: 'Formal', r: 'chinta na karo', g: 'ચિંતા ના કરો' },
      { l: 'Casual', r: 'chinta na kar', g: 'ચિંતા ના કર' },
      { l: 'Gujlish', r: 'tension na le', g: 'ટેન્શન ના લે' },
      { l: 'Playful', r: 'badhu thai jashe', g: 'બધું થઈ જશે', n: '"It\'ll all sort itself out."' }
    ] },
    { id: 'stop-nagging', e: 'Stop going on about it', rungs: [
      { l: 'Formal', r: 'pachi vaat kariye', g: 'પછી વાત કરીએ', n: 'The polite dodge: "let\'s talk later".' },
      { l: 'Casual', r: 'bas kar ne', g: 'બસ કર ને' },
      { l: 'Playful', r: 'mathu na khaa', g: 'માથું ના ખા', n: '"Don\'t eat my head." Peers only.' }
    ] },
    { id: 'see-you', e: 'See you / bye', rungs: [
      { l: 'Formal', r: 'aavjo', g: 'આવજો' },
      { l: 'Everyday', r: 'chalo, aavjo', g: 'ચાલો, આવજો' },
      { l: 'Casual', r: 'chal, maliye', g: 'ચાલ, મળીએ', n: '"Let\'s meet": see ya.' },
      Object.assign({ l: 'Kutchi', r: 'achija', g: 'અચીજા' }, KUTCHI('https://kutchimaadu.com/general/kutchi-language/'))
    ] },
    { id: 'okay', e: 'Okay / fine', rungs: [
      { l: 'Formal', r: 'saaru', g: 'સારું' },
      { l: 'Everyday', r: 'bhale', g: 'ભલે' },
      { l: 'Casual', r: 'haa, chaalshe', g: 'હા, ચાલશે', n: '"It\'ll do."' },
      { l: 'Gujlish', r: 'ok, yaar', g: 'ઓકે, યાર' }
    ] },
    { id: 'where-are-you', e: 'Where are you?', rungs: [
      { l: 'Formal', r: 'tame kya cho?', g: 'તમે ક્યાં છો?' },
      { l: 'Casual', r: 'kya che?', g: 'ક્યાં છે?' },
      Object.assign({ l: 'Village', r: 'kya se?', g: 'ક્યાં સે?' }, VILLAGE)
    ] },
    { id: 'hold-on', e: 'Hold on a moment', rungs: [
      { l: 'Formal', r: 'thodi vaar thobhjo', g: 'થોડી વાર થોભજો' },
      { l: 'Everyday', r: 'ek minit, haa?', g: 'એક મિનિટ, હા?' },
      { l: 'Casual', r: 'ubho re', g: 'ઊભો રે', n: 'Literally "stay standing". To a woman: "ubhi re".' }
    ] },
    { id: 'full', e: "I'm full", rungs: [
      { l: 'Formal', r: 'bas, pet bharai gayu', g: 'બસ, પેટ ભરાઈ ગયું' },
      { l: 'Casual', r: 'bas bas', g: 'બસ બસ' },
      { l: 'Playful', r: 'have jagya j nathi!', g: 'હવે જગ્યા જ નથી!', n: '"There\'s no room left!"' }
    ] },
    { id: 'told-you', e: 'I told you so!', rungs: [
      { l: 'Everyday', r: 'me kahyu hatu ne!', g: 'મેં કહ્યું હતું ને!' },
      { l: 'Casual', r: 'kidhu tu ne!', g: 'કીધું તું ને!', n: 'kahyu → kidhu, hatu → tu: classic clipped speech.' },
      { l: 'Playful', r: 'joyu? kidhu tu ne!', g: 'જોયું? કીધું તું ને!' }
    ] },
    { id: 'did-you-eat', e: 'Have you eaten?', rungs: [
      { l: 'Formal', r: 'tame jamya?', g: 'તમે જમ્યા?', n: '"jamvu" is the respectful "have a meal".' },
      { l: 'Everyday', r: 'jami lidhu?', g: 'જમી લીધું?' },
      { l: 'Casual', r: 'khadhu?', g: 'ખાધું?', n: '"khaavu" is plain "eat". Fine with peers, blunt with elders.' }
    ] },
    { id: 'are-you-mad', e: 'Are you mad?! (teasing)', rungs: [
      { l: 'Casual', r: 'gaando thayo che?', g: 'ગાંડો થયો છે?', n: 'To a guy. To a girl: "gaandi thai che?".' },
      { l: 'Playful', r: 'tu pagal che ke?', g: 'તું પાગલ છે કે?' },
      { l: 'Gujlish', r: 'tu crazy che, yaar', g: 'તું ક્રેઝી છે, યાર' }
    ] }
  ];

  const reductions = [
    { rule: 'Questions drop "che"', ex: [['shu kare che?', 'su kare?'], ['kya jaay che?', 'kya jaay?']], n: 'In quick talk the question tone does the work.' },
    { rule: 'shu → su', ex: [['shu thayu?', 'su thyu?']], n: 'Heard all over Gujarat in casual speech.' },
    { rule: 'nahi / nathi → nai', ex: [['khabar nathi', 'khabar nai'], ['kai nahi', 'kai nai']] },
    { rule: 'kahyu → kidhu, hatu → tu', ex: [['me kahyu hatu', 'kidhu tu']], n: 'The past squeezes hard in speech.' },
    { rule: '"hu" and "chu" fall away', ex: [['hu ghare jaau chu', 'ghare jaau']], n: 'The verb ending already tells you who.' },
    { rule: 'che → se (village and Kathiawadi speech)', ex: [['kya che?', 'kya se?']], src: VILLAGE.src, n: 'Documented for Kathiawadi Gujarati. Your family may or may not do it.' },
    { rule: '"ne" pushes or softens', ex: [['aav', 'aav ne'], ['kaho', 'kaho ne']], n: '"aav ne" = come on, come! Very common, very warm.' },
    { rule: 'English verb + kar', ex: [['phone karo', 'call kar'], ['maja karo', 'enjoy kar']], n: 'Diaspora Gujlish. Totally normal in UK and Australian families.' },
    { rule: 'Tags: yaar, bhai, re', ex: [['chal', 'chal ne, yaar'], ['shu kare che?', 'su kare, bhai?']] }
  ];

  // Gym: [chunks joined by " | ", gujarati, english, traps[], feminine?]
  const gym = [
    ['mane | bhukh | lagi che', 'મને ભૂખ લાગી છે', "I'm hungry", ['hu', 'chu']],
    ['mane | khabar | nathi', 'મને ખબર નથી', "I don't know", ['hu', 'che']],
    ['tame | kyare | aavsho?', 'તમે ક્યારે આવશો?', 'When will you come? (to an elder)', ['aavish?', 'tu']],
    ['hu | kaale | aavish', 'હું કાલે આવીશ', "I'll come tomorrow", ['aavshe', 'me']],
    ['me | rotli | khadhi', 'મેં રોટલી ખાધી', 'I ate the chapati', ['hu', 'khadho']],
    ['Ba e | thepla | banavya', 'બાએ થેપલાં બનાવ્યાં', 'Ba made thepla', ['Ba', 'banavi']],
    ['dada | aavya | che', 'દાદા આવ્યા છે', 'Dada has arrived', ['aavyo']],
    ['mane | Gujarati | thodu thodu aavde che', 'મને ગુજરાતી થોડું થોડું આવડે છે', 'I speak a little Gujarati', ['hu', 'bolu chu']],
    ['tame | kem | cho?', 'તમે કેમ છો?', 'How are you? (to an elder)', ['che?', 'tu']],
    ['tu | shu | kare che?', 'તું શું કરે છે?', 'What are you doing? (to a cousin)', ['karo cho?', 'tame']],
    ['mane | tamari | yaad aave che', 'મને તમારી યાદ આવે છે', 'I miss you (to an elder)', ['tari', 'hu']],
    ['aapne | kyare | jaishu?', 'આપણે ક્યારે જઈશું?', 'When shall we (you and I) go?', ['ame', 'jaish?']],
    ['mane | gaam | jovu che', 'મને ગામ જોવું છે', 'I want to see the village', ['hu', 'jou chu']],
    ['Ba ne | kaheje | hu aavish', 'બાને કહેજે હું આવીશ', 'Tell Ba I\'ll come (to a cousin)', ['Ba', 'kahejo']],
    ['tamaru | naam | shu che?', 'તમારું નામ શું છે?', "What's your name? (to an adult)", ['taru']],
    ['hu | thaki gayo | chu', 'હું થાકી ગયો છું', "I'm tired", ['thaki gai', 'che'], ['hu | thaki gai | chu', 'હું થાકી ગઈ છું', ['thaki gayo', 'che']]],
    ['mane | aa | nathi gamtu', 'મને આ નથી ગમતું', "I don't like this", ['hu', 'gamyu']],
    ['tame | pan | aavo ne', 'તમે પણ આવો ને', 'Do come too (to an elder)', ['aav', 'tu']],
    ['hu | pachi | phone karish', 'હું પછી ફોન કરીશ', "I'll call later", ['karshe']],
    ['chinta | na | karo', 'ચિંતા ના કરો', "Don't worry (to an elder)", ['kar', 'nathi']],
    ['mane | maaf | karjo', 'મને માફ કરજો', 'Please forgive me', ['karje', 'hu']],
    ['aa | kone | banavyu?', 'આ કોણે બનાવ્યું?', 'Who made this?', ['kon']],
    ['tame | Kenya ma | rahya cho?', 'તમે કેન્યામાં રહ્યા છો?', 'Have you lived in Kenya? (to an elder)', ['rahyo che?']],
    ['pet ma | undar | dode che', 'પેટમાં ઉંદર દોડે છે', "I'm starving (playful)", ['mane']]
  ];

  // Level check. Sections are scored separately: words / sentences / building / register / recall.
  const level = {
    words: ['kaale', 'bhabhi', 'chhaas', 'mosal', 'vevai', 'jeth'],                  // phrase ids, easy → hard
    sentences: ['pat-mane-7', 'sty-ba-nairobi-2', 'sty-ba-nairobi-1', 'sty-thepla-6', 'sty-khetar-1', 'sty-ba-nairobi-8'],
    building: [
      { e: 'I ate the chapati', opts: [['me rotli khadhi', true], ['hu rotli khadhi', false, 'Doing-verbs in the past take "me", not "hu".'], ['me rotli khadho', false, 'rotli is feminine: khadhi.']] },
      { e: "I'm hungry", opts: [['mane bhukh lagi che', true], ['hu bhukh lagi chu', false, 'Hunger happens TO you: mane.'], ['mane bhukh lago che', false, 'bhukh is feminine: lagi.']] },
      { e: 'Dada has arrived (telling Ba)', opts: [['dada aavya che', true], ['dada aavyo che', false, 'Elders take the respectful plural.'], ['dada aavi che', false, 'That\'s the feminine form.']] },
      { e: 'When will you come? (to Kaka)', opts: [['tame kyare aavsho?', true], ['tu kyare aavsho?', false, 'tu and -sho don\'t match, and Kaka gets tame.'], ['tame kyare aavish?', false, '-ish is for "I" or "tu".']] },
      { e: 'Shall we (you and I) go?', opts: [['aapne jaishu?', true], ['ame jaishu?', false, '"ame" leaves the listener out.'], ['aapne jashe?', false, '-she is for he / she / they.']] },
      { e: 'Tell Ba (to your cousin)', opts: [['Ba ne kaheje', true], ['Ba kaheje', false, 'Ba needs "ne": to Ba.'], ['Ba ne kahejo', false, '"kahejo" is respectful. A cousin gets "kaheje".']] }
    ],
    register: ['drill-register:1', 'drill-register:5', 'drill-register:11', 'drill-register:17'], // scene id : reply step index
    recall: ['kem-cho', 'khabar-nathi', 'bhukh', 'yaad-aave', 'kyare-aavsho', 'pet-bharai']
  };

  window.APOLLO_SPEECH = { ladders, reductions, gym, level };
})();
