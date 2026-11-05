/* Apollo grammar layer: patterns (how the language works) and stories (long
 * dialogues written in Gujarati script, romanised with the Apollo scheme and
 * glossed word by word). Authored 2026-11-05 from the working grammar in
 * knowledge/reports/2026-11-05-gujarati-spoken-grammar.md. Standard spoken
 * Gujarati; not yet checked by family.
 *
 * Pattern row: [roman, gujarati, english]  (english must be unique in a pattern)
 * Story line:  { who, g, r, e, w: [[roman word(s), meaning], ...] }
 */
(function () {
  const patterns = [
    {
      id: 'pronouns', title: 'I, you, we', tag: 'Pronouns',
      why: 'Gujarati has two words for "we". "ame" means we, not including you. "aapne" means we, including you. Tell your mum "ame jaiye chiye" and you are leaving her behind. And "tame" is both respectful-you and you-all.',
      rows: [
        ['hu', 'હું', 'I'],
        ['tu', 'તું', 'you (informal: kids, close cousins)'],
        ['tame', 'તમે', 'you (respectful, or more than one)'],
        ['e', 'એ', 'he / she / that one'],
        ['ame', 'અમે', 'we (not including you)'],
        ['aapne', 'આપણે', 'we (including you)'],
        ['teo', 'તેઓ', 'they (formal, or a respected he / she)'],
        ['e loko', 'એ લોકો', 'they (everyday speech)']
      ]
    },
    {
      id: 'to-be', title: 'am, is, are', tag: 'chu · che · cho',
      why: 'The little word at the end of most sentences changes with the person: chu for I, che for he / she / informal you, chiye for we, cho for respectful you. "nathi" is the negative for every person. In fast speech "chhe" sounds like "che".',
      rows: [
        ['hu majama chu', 'હું મજામાં છું', "I'm fine"],
        ['tu ghare che?', 'તું ઘરે છે?', 'are you at home? (informal)'],
        ['e ghare che', 'એ ઘરે છે', 'he / she is at home'],
        ['ame Perth ma chiye', 'અમે પર્થમાં છીએ', "we're in Perth"],
        ['tame kya cho?', 'તમે ક્યાં છો?', 'where are you? (respectful)'],
        ['teo Kutch ma che', 'તેઓ કચ્છમાં છે', "they're in Kutch"],
        ['e ghare nathi', 'એ ઘરે નથી', "he / she isn't at home"]
      ]
    },
    {
      id: 'present', title: 'Doing things now', tag: 'Present tense',
      why: 'Take the stem (kar = do, jaa = go), add the person ending (-u, -e, -iye, -o), then chu / che / chiye / cho. The same form means "I do" and "I\'m doing". Vowel stems like jaa squeeze: jaau, jaay, jaiye, jaao.',
      rows: [
        ['hu karu chu', 'હું કરું છું', 'I do / I am doing'],
        ['tu kare che', 'તું કરે છે', 'you do (informal)'],
        ['e kare che', 'એ કરે છે', 'he / she does'],
        ['ame kariye chiye', 'અમે કરીએ છીએ', 'we do'],
        ['tame karo cho', 'તમે કરો છો', 'you do (respectful)'],
        ['hu jaau chu', 'હું જાઉં છું', 'I go / I am going'],
        ['tu jaay che', 'તું જાય છે', 'you go (informal)'],
        ['ame jaiye chiye', 'અમે જઈએ છીએ', 'we go'],
        ['tame jaao cho', 'તમે જાઓ છો', 'you go (respectful)']
      ]
    },
    {
      id: 'future', title: 'Will', tag: 'Future tense',
      why: 'Add -ish for I and informal you, -she for he / she / they, -ishu for we, -sho for respectful you. "kaale aavish" = I\'ll come tomorrow. "tame aavsho ne?" = you will come, won\'t you?',
      rows: [
        ['hu aavish', 'હું આવીશ', "I'll come"],
        ['tu aavish', 'તું આવીશ', "you'll come (informal)"],
        ['e aavshe', 'એ આવશે', 'he / she will come'],
        ['ame aavishu', 'અમે આવીશું', "we'll come"],
        ['tame aavsho', 'તમે આવશો', "you'll come (respectful)"],
        ['hu karish', 'હું કરીશ', "I'll do it"],
        ['e karshe', 'એ કરશે', 'he / she will do it'],
        ['tame karsho?', 'તમે કરશો?', 'will you do it? (respectful)']
      ]
    },
    {
      id: 'past-move', title: 'Went and came', tag: 'Past · agrees with you',
      why: 'For going, coming, sitting and sleeping, the past ending follows the speaker\'s gender: a man says "hu gayo", a woman "hu gai". Elders take the plural even when they are one person: "Dada aavya", "Ba aavya".',
      rows: [
        ['hu gayo', 'હું ગયો', 'I went (man speaking)'],
        ['hu gai', 'હું ગઈ', 'I went (woman speaking)'],
        ['e aavyo', 'એ આવ્યો', 'he came'],
        ['e aavi', 'એ આવી', 'she came'],
        ['ame gaya', 'અમે ગયા', 'we went'],
        ['Dada aavya', 'દાદા આવ્યા', 'Dada came (respectful plural)'],
        ['hu betho', 'હું બેઠો', 'I sat (man speaking)']
      ]
    },
    {
      id: 'past-do', title: 'Ate and said', tag: 'Past · the "me" flip',
      why: 'For doing-verbs (eat, see, say, make) the past flips. "I" becomes "me", and the verb agrees with the THING, not with you. "me khadhu" = I ate (it). "me rotli khadhi" = I ate the chapati: rotli is feminine, so -i. "Ba e banavyu" = Ba made it.',
      rows: [
        ['me khadhu', 'મેં ખાધું', 'I ate'],
        ['me rotli khadhi', 'મેં રોટલી ખાધી', 'I ate the chapati (rotli is feminine)'],
        ['me laadu khadho', 'મેં લાડુ ખાધો', 'I ate the laddu (laadu is masculine)'],
        ['te shu kahyu?', 'તેં શું કહ્યું?', 'what did you say? (informal)'],
        ['tame shu kahyu?', 'તમે શું કહ્યું?', 'what did you say? (respectful)'],
        ['ene joyu', 'એણે જોયું', 'he / she saw it'],
        ['Ba e banavyu', 'બાએ બનાવ્યું', 'Ba made it'],
        ['ame chaa pidhi', 'અમે ચા પીધી', 'we drank tea (chaa is feminine)']
      ]
    },
    {
      id: 'commands', title: 'Asking someone to do something', tag: 'Three levels',
      why: 'Bare stem to a kid (kar), -o to anyone you respect (karo), and -je / -jo for "please do it, later" (karje informal, karjo respectful). Add "ne" to soften: "aavo ne" = do come.',
      rows: [
        ['kar', 'કર', 'do it (to a kid or close cousin)'],
        ['karo', 'કરો', 'please do it (respectful)'],
        ['karjo', 'કરજો', 'please do it, later (respectful)'],
        ['karje', 'કરજે', 'do it later (informal)'],
        ['aav', 'આવ', 'come (informal)'],
        ['aavo ne', 'આવો ને', 'do come (soft, respectful)'],
        ['jo', 'જો', 'look (informal)'],
        ['juo', 'જુઓ', 'look (respectful)']
      ]
    },
    {
      id: 'negation', title: 'Not', tag: 'nathi · nahi · na',
      why: '"nathi" for is-not and does-not right now. "nahi" for won\'t and flat refusals. "na" before a command for don\'t. "hu nathi jato" = I\'m not going (man; a woman says "jati").',
      rows: [
        ['mane khabar nathi', 'મને ખબર નથી', "I don't know"],
        ['hu nathi jato', 'હું નથી જતો', "I'm not going (man speaking)"],
        ['e ghare nathi', 'એ ઘરે નથી', "he / she isn't home"],
        ['hu nahi aavu', 'હું નહીં આવું', "I won't come"],
        ['naa, nahi joie', 'ના, નહીં જોઈએ', "no, I don't want it"],
        ['chinta na karo', 'ચિંતા ના કરો', "don't worry (respectful)"],
        ['bahar na jaish', 'બહાર ના જઈશ', "don't go out (informal)"]
      ]
    },
    {
      id: 'mane', title: 'Feelings happen to you', tag: 'mane · tamne',
      why: 'Hunger, liking, knowing and missing aren\'t things you do. They happen to you. So the sentence starts with "mane" (to me), "tamne" (to you, respectful) or "ene" (to him / her). "mane Gujarati aavde che" = Gujarati comes to me.',
      rows: [
        ['mane bhukh lagi che', 'મને ભૂખ લાગી છે', "I'm hungry"],
        ['tamne bhukh lagi che?', 'તમને ભૂખ લાગી છે?', 'are you hungry? (respectful)'],
        ['mane gamyu', 'મને ગમ્યું', 'I liked it'],
        ['ene na gamyu', 'એને ના ગમ્યું', "he / she didn't like it"],
        ['mane yaad aave che', 'મને યાદ આવે છે', 'I miss it / it comes back to me'],
        ['mane Gujarati aavde che', 'મને ગુજરાતી આવડે છે', 'I know how to speak Gujarati'],
        ['mane kaam che', 'મને કામ છે', 'I have something to do'],
        ['mane gaam jovu che', 'મને ગામ જોવું છે', 'I want to see the village']
      ]
    },
    {
      id: 'postpositions', title: 'In, at, to, from', tag: 'Little words that stick on',
      why: 'These come AFTER the word, and are often glued on: ghar + ma = gharma (in the house). "ne" marks who something goes to: "Ba ne aapo" = give it to Ba.',
      rows: [
        ['ghar ma', 'ઘરમાં', 'in the house'],
        ['ghare', 'ઘરે', 'at home'],
        ['Ba ne', 'બાને', 'to Ba'],
        ['Perth thi', 'પર્થથી', 'from Perth'],
        ['tamari saathe', 'તમારી સાથે', 'with you (respectful)'],
        ['mara maate', 'મારા માટે', 'for me'],
        ['mandir paase', 'મંદિર પાસે', 'near the temple'],
        ['table par', 'ટેબલ પર', 'on the table']
      ]
    },
    {
      id: 'possession', title: 'My, your, whose', tag: '-no · -ni · -nu · -na',
      why: '"Of" changes shape to match the thing owned: -o masculine, -i feminine, -u neuter, -a plural or respected. maro dikro, mari dikri, maru ghar, mara kaka. Respect reaches grammar: kaka takes the plural.',
      rows: [
        ['maro dikro', 'મારો દીકરો', 'my son'],
        ['mari dikri', 'મારી દીકરી', 'my daughter'],
        ['maru ghar', 'મારું ઘર', 'my house'],
        ['mara kaka', 'મારા કાકા', 'my uncle (respected, so plural)'],
        ['tamaru naam', 'તમારું નામ', 'your name (respectful)'],
        ['Ba ni rotli', 'બાની રોટલી', "Ba's chapatis"],
        ['Rameshbhai no dikro', 'રમેશભાઈનો દીકરો', "Rameshbhai's son"],
        ['aapnu gaam', 'આપણું ગામ', 'our village (yours and mine)']
      ]
    },
    {
      id: 'questions', title: 'Question words', tag: 'shu · kon · kya',
      why: 'Question words sit where the answer would go, not at the front: "tame kya jaao cho?" = you where go? = where are you going? Watch "kya" (where) vs "kayu" (which).',
      rows: [
        ['shu?', 'શું?', 'what?'],
        ['kon?', 'કોણ?', 'who?'],
        ['kya?', 'ક્યાં?', 'where?'],
        ['kyare?', 'ક્યારે?', 'when?'],
        ['kem?', 'કેમ?', 'why? / how?'],
        ['ketlu?', 'કેટલું?', 'how much?'],
        ['kayu?', 'કયું?', 'which one?'],
        ['kevi rite?', 'કેવી રીતે?', 'in what way?']
      ]
    },
    {
      id: 'kutchi-mirror', title: 'Kutchi mirror', tag: 'Dialect · from public sources',
      dialect: true,
      why: 'The same ideas in Kutchi, as recorded in general Kutchi guides (not yet confirmed for SKLPC families). Kutchi swaps the core words but keeps the shape: muke (to me) works just like mane, and aay sits where che goes.',
      rows: [
        ['kien aayo?', 'કીં આયો?', 'Kutchi for "kem cho?"'],
        ['aaun', 'આઉં', 'Kutchi for "hu" (I)'],
        ['aain', 'આંઈ', 'Kutchi for "tame" (respectful you)'],
        ['achanto', 'અચાંતો', 'Kutchi for "aavu chu" (I\'m coming)'],
        ['vinanto', 'વિનાંતો', 'Kutchi for "jaau chu" (I\'m going)'],
        ['koro?', 'કોરો?', 'Kutchi for "shu?" (what?)'],
        ['muke bhookh lagi aay', 'મુકે ભૂખ લગી આય', 'Kutchi for "mane bhukh lagi che"'],
        ['achija', 'અચીજા', 'Kutchi for "aavjo" (bye)']
      ]
    }
  ];

  const stories = [
    {
      id: 'ba-nairobi', title: 'How Ba got to Nairobi', cast: 'You and Ba', level: 'Past tense, "used to"',
      lines: [
        { who: 'You', g: 'બા, તમે કેન્યા કેવી રીતે ગયા?', r: 'ba, tame Kenya kevi rite gaya?', e: 'Ba, how did you end up in Kenya?', w: [['tame', 'you (respectful)'], ['kevi rite', 'how / in what way'], ['gaya', 'went (plural for respect)']] },
        { who: 'Ba', g: 'તારા દાદા પહેલાં ગયા. હું લગ્ન પછી ગઈ.', r: 'tara dada pehla gaya. hu lagan pachi gai.', e: 'Your Dada went first. I went after the wedding.', w: [['tara', 'your (informal; plural to match Dada)'], ['pehla', 'first / before'], ['lagan', 'wedding'], ['pachi', 'after'], ['gai', 'went (woman speaking)']] },
        { who: 'Ba', g: 'વહાણમાં આઠ દિવસ લાગ્યા.', r: 'vahan ma aath divas laagya.', e: 'The ship took eight days.', w: [['vahan', 'ship'], ['ma', 'in'], ['aath', 'eight'], ['divas', 'days'], ['laagya', 'took (time)']] },
        { who: 'You', g: 'અરે વાહ! તમને બીક ના લાગી?', r: 'are vah! tamne bik na laagi?', e: "Wow! Weren't you scared?", w: [['tamne', 'to you (respectful)'], ['bik', 'fear'], ['na', 'not'], ['laagi', 'struck (feminine, to match bik)']] },
        { who: 'Ba', g: 'લાગી ને! હું તો અઢાર વરસની હતી.', r: 'laagi ne! hu to adhaar varas ni hati.', e: 'Of course I was! I was only eighteen.', w: [['laagi ne', 'it did, of course'], ['to', 'as for me / only'], ['adhaar', 'eighteen'], ['varas ni', 'years old (feminine)'], ['hati', 'was (woman)']] },
        { who: 'Ba', g: 'નૈરોબીમાં તારા દાદાની દુકાન હતી.', r: 'Nairobi ma tara dada ni dukaan hati.', e: 'Your Dada had a shop in Nairobi.', w: [['dada ni', "Dada's (feminine, to match dukaan)"], ['dukaan', 'shop'], ['hati', 'was (feminine)']] },
        { who: 'You', g: 'દુકાનમાં શું વેચતા?', r: 'dukaan ma shu vechta?', e: 'What did they sell in the shop?', w: [['shu', 'what'], ['vechta', 'used to sell (plural for respect)']] },
        { who: 'Ba', g: 'બધું જ! ખાંડ, ચોખા, કાપડ…', r: 'badhu j! khaand, chokha, kaapad…', e: 'Everything! Sugar, rice, cloth…', w: [['badhu', 'everything'], ['j', '(emphasis: really)'], ['khaand', 'sugar'], ['chokha', 'rice (uncooked)'], ['kaapad', 'cloth']] },
        { who: 'You', g: 'અને કચ્છની યાદ આવતી?', r: 'ane Kutch ni yaad aavti?', e: 'And did you miss Kutch?', w: [['Kutch ni', "of Kutch"], ['yaad', 'memory'], ['aavti', 'used to come (missing = memory comes)']] },
        { who: 'Ba', g: 'રોજ. પણ આપણું કુટુંબ ત્યાં હતું, એટલે સારું લાગતું.', r: 'roj. pan aapnu kutumb tya hatu, etle saaru laagtu.', e: 'Every day. But our family was there, so it felt all right.', w: [['roj', 'every day'], ['pan', 'but'], ['aapnu', 'our (including you)'], ['kutumb', 'family'], ['tya', 'there'], ['etle', 'so'], ['laagtu', 'used to feel']] },
        { who: 'You', g: 'મને વધારે કહો ને, બા.', r: 'mane vadhare kaho ne, ba.', e: 'Tell me more, Ba.', w: [['mane', 'to me'], ['vadhare', 'more'], ['kaho ne', 'do tell (soft, respectful)']] }
      ]
    },
    {
      id: 'thepla', title: 'Making thepla with Ba', cast: 'Ba and you', level: 'Commands: informal and respectful',
      lines: [
        { who: 'Ba', g: 'આવ, આજે તને થેપલાં શીખવાડું.', r: 'aav, aaje tane thepla shikhvadu.', e: "Come, today I'll teach you thepla.", w: [['aav', 'come (informal)'], ['aaje', 'today'], ['tane', 'to you (informal)'], ['shikhvadu', "let me teach"]] },
        { who: 'Ba', g: 'પહેલાં લોટ લે, અને એમાં મેથી નાખ.', r: 'pehla lot le, ane ema methi naakh.', e: 'First take the flour, and put fenugreek in it.', w: [['lot', 'flour'], ['le', 'take (informal)'], ['ema', 'in it'], ['methi', 'fenugreek leaves'], ['naakh', 'put in (informal)']] },
        { who: 'You', g: 'કેટલી મેથી નાખું?', r: 'ketli methi naakhu?', e: 'How much methi should I put in?', w: [['ketli', 'how much (feminine, to match methi)'], ['naakhu', 'shall I put']] },
        { who: 'Ba', g: 'એક મુઠ્ઠી. પછી હળદર, મરચું, અને મીઠું.', r: 'ek mutthi. pachi haldar, marchu, ane mithu.', e: 'One handful. Then turmeric, chilli and salt.', w: [['mutthi', 'handful'], ['haldar', 'turmeric'], ['marchu', 'chilli'], ['mithu', 'salt']] },
        { who: 'Ba', g: 'હવે દહીં નાખીને લોટ બાંધ.', r: 'have dahi naakhi ne lot baandh.', e: 'Now add yogurt and knead the dough.', w: [['have', 'now'], ['dahi', 'yogurt'], ['naakhi ne', 'after adding'], ['baandh', 'knead / bind (informal)']] },
        { who: 'You', g: 'આટલું બરાબર છે?', r: 'aatlu barabar che?', e: 'Is this right?', w: [['aatlu', 'this much / like this'], ['barabar', 'right']] },
        { who: 'Ba', g: 'થોડું કડક છે. થોડું પાણી ઉમેર.', r: 'thodu kadak che. thodu paani umer.', e: "It's a bit stiff. Add a little water.", w: [['kadak', 'stiff / hard'], ['umer', 'add (informal)']] },
        { who: 'Ba', g: 'શાબાશ! હવે વણીને તવી પર શેક.', r: 'shabash! have vani ne tavi par shek.', e: 'Well done! Now roll it out and cook it on the tava.', w: [['vani ne', 'after rolling out'], ['tavi', 'griddle'], ['par', 'on'], ['shek', 'roast / cook (informal)']] },
        { who: 'You', g: 'બા, તમે પહેલાં ચાખો.', r: 'ba, tame pehla chaakho.', e: 'Ba, you taste it first.', w: [['tame', 'you (respectful)'], ['chaakho', 'taste (respectful)']] },
        { who: 'Ba', g: 'સરસ બન્યાં છે! તારી વહુ નસીબદાર હશે.', r: 'saras banya che! tari vahu nasibdaar hashe.', e: "They've turned out lovely! Your wife will be lucky.", w: [['banya che', 'have turned out'], ['tari', 'your (informal)'], ['vahu', 'wife (the family\'s daughter-in-law)'], ['nasibdaar', 'lucky'], ['hashe', 'will be']] }
      ]
    },
    {
      id: 'khetar', title: 'Pappa calls about the farm', cast: 'Pappa and his elder brother', level: 'Brothers: respect and future plans',
      lines: [
        { who: 'Pappa', g: 'મોટાભાઈ, જય શ્રી કૃષ્ણ. ખેતરનું શું છે?', r: 'motabhai, jai shri krishna. khetar nu shu che?', e: "Motabhai, Jai Shri Krishna. How's the farm?", w: [['motabhai', 'elder brother (what he calls him)'], ['khetar nu', 'of the farm'], ['shu che', 'what is (the news)']] },
        { who: 'Mota pappa', g: 'આ વરસે વરસાદ સારો પડ્યો.', r: 'aa varse varsaad saaro padyo.', e: 'The rain was good this year.', w: [['aa varse', 'this year'], ['varsaad', 'rain'], ['saaro', 'good (masculine, to match varsaad)'], ['padyo', 'fell']] },
        { who: 'Mota pappa', g: 'કપાસ અને એરંડા વાવ્યા છે.', r: 'kapas ane eranda vaavya che.', e: "We've sown cotton and castor.", w: [['kapas', 'cotton'], ['eranda', 'castor (a big Kutch crop)'], ['vaavya che', 'have sown']] },
        { who: 'Pappa', g: 'સારું. મજૂર મળે છે?', r: 'saaru. majur male che?', e: 'Good. Can you find labourers?', w: [['majur', 'labourers'], ['male che', 'are found / available']] },
        { who: 'Mota pappa', g: 'મુશ્કેલ છે. બધા જુવાનિયા શહેરમાં જાય છે.', r: 'mushkel che. badha juvaniya shaher ma jaay che.', e: "It's hard. All the young ones go to the city.", w: [['mushkel', 'difficult'], ['badha', 'all'], ['juvaniya', 'young people'], ['shaher ma', 'to the city']] },
        { who: 'Pappa', g: 'અને આપણે બધા પરદેશમાં.', r: 'ane aapne badha pardes ma.', e: 'And all of us abroad.', w: [['aapne', 'we (including him)'], ['pardes ma', 'abroad']] },
        { who: 'Mota pappa', g: 'હા. એટલે જ કહું છું, છોકરાને ગામ બતાવો.', r: 'haa. etle j kahu chu, chhokra ne gaam batavo.', e: "Yes. That's exactly why I say: show the boy the village.", w: [['etle j', "that's exactly why"], ['kahu chu', 'I say'], ['chhokra ne', 'to the boy'], ['batavo', 'show (respectful)']] },
        { who: 'Pappa', g: 'આવતા શિયાળે આવીશું.', r: 'aavta shiyale aavishu.', e: "We'll come next winter.", w: [['aavta', 'coming / next'], ['shiyale', 'in winter'], ['aavishu', 'we will come']] },
        { who: 'Mota pappa', g: 'પાકું? તો ખેતરમાં એક દિવસ રાખજો.', r: 'paku? to khetar ma ek divas rakhjo.', e: 'Promise? Then keep a day for the farm.', w: [['paku', 'for sure / promise'], ['to', 'then'], ['rakhjo', 'keep (respectful, later)']] },
        { who: 'Pappa', g: 'પાકું. ભાભીને જય શ્રી કૃષ્ણ કહેજો.', r: 'paku. bhabhi ne jai shri krishna kahejo.', e: 'Promise. Give my Jai Shri Krishna to bhabhi.', w: [['bhabhi ne', "to bhabhi (elder brother's wife)"], ['kahejo', 'please tell (respectful)']] }
      ]
    },
    {
      id: 'sisters', title: 'Mum and Masi gossip', cast: 'Two sisters on the phone', level: 'Sisters use "tu" with each other',
      lines: [
        { who: 'Masi', g: 'મોટીબેન, તને ખબર છે? પ્રિયાની સગાઈ નક્કી થઈ.', r: 'motiben, tane khabar che? Priya ni sagai nakki thai.', e: "Big sis, have you heard? Priya's engagement is fixed.", w: [['motiben', 'big sister (how a younger sister addresses her)'], ['tane', 'to you (informal)'], ['sagai', 'engagement'], ['nakki thai', 'got settled']] },
        { who: 'Mummy', g: 'ખરેખર? કોની સાથે?', r: 'kharekhar? koni saathe?', e: 'Really? To whom?', w: [['kharekhar', 'really'], ['koni saathe', 'with whom']] },
        { who: 'Masi', g: 'માધાપરના પટેલ. છોકરો લંડનમાં ડૉક્ટર છે.', r: 'Madhapar na Patel. chhokro London ma doctor che.', e: 'The Madhapar Patels. The boy is a doctor in London.', w: [['Madhapar na', 'from Madhapar (a gaam near Bhuj)'], ['chhokro', 'the boy']] },
        { who: 'Mummy', g: 'અરે વાહ! એનાં મમ્મી-પપ્પાને હું ઓળખું છું.', r: 'are vah! ena mummy-pappa ne hu olkhu chu.', e: 'Oh wow! I know his parents.', w: [['ena', 'his (plural, respectful)'], ['ne', '(marks who)'], ['olkhu chu', 'I know (a person)']] },
        { who: 'Mummy', g: 'એ લોકો બહુ સારા છે.', r: 'e loko bahu saara che.', e: "They're very good people.", w: [['e loko', 'they'], ['bahu', 'very'], ['saara', 'good (plural)']] },
        { who: 'Masi', g: 'લગ્ન ડિસેમ્બરમાં છે. તું આવીશ ને?', r: 'lagan December ma che. tu aavish ne?', e: "The wedding's in December. You'll come, won't you?", w: [['lagan', 'wedding'], ['tu', 'you (sisters use tu)'], ['aavish ne', "you'll come, right?"]] },
        { who: 'Mummy', g: 'કેમ નહીં! અને સયુજ પણ આવશે.', r: 'kem nahi! ane Sayuj pan aavshe.', e: 'Of course! And Sayuj will come too.', w: [['kem nahi', 'why not / of course'], ['pan', 'also'], ['aavshe', 'will come']] },
        { who: 'Masi', g: 'સરસ. એને કહેજે, ગુજરાતીમાં બોલજે!', r: 'saras. ene kaheje, Gujarati ma bolje!', e: 'Great. Tell him: speak in Gujarati!', w: [['ene', 'to him'], ['kaheje', 'tell (informal, later)'], ['bolje', 'speak (informal, later)']] },
        { who: 'Mummy', g: 'એ શીખે છે! રોજ પ્રેક્ટિસ કરે છે.', r: 'e shikhe che! roj practice kare che.', e: "He's learning! He practises every day.", w: [['shikhe che', 'is learning'], ['roj', 'every day'], ['kare che', 'does']] }
      ]
    },
    {
      id: 'morning', title: 'Morning rush', cast: 'Mummy and you', level: 'Everyday informal Gujarati',
      lines: [
        { who: 'Mummy', g: 'ઊઠ, સાત વાગી ગયા!', r: 'uth, saat vaagi gaya!', e: "Get up, it's already seven!", w: [['uth', 'get up (informal)'], ['saat', 'seven'], ['vaagi gaya', 'has struck (the hour)']] },
        { who: 'You', g: 'પાંચ મિનિટ, મમ્મી…', r: 'paanch minit, mummy…', e: 'Five minutes, Mum…', w: [['paanch', 'five']] },
        { who: 'Mummy', g: 'કોઈ પાંચ મિનિટ નહીં. નાહી લે, નાસ્તો ઠંડો થાય છે.', r: 'koi paanch minit nahi. naahi le, naasto thando thaay che.', e: "No five minutes. Have your bath, breakfast is getting cold.", w: [['koi … nahi', 'no … at all'], ['naahi le', 'have a bath (informal)'], ['naasto', 'breakfast / snack'], ['thando thaay che', 'is getting cold']] },
        { who: 'You', g: 'આજે નાસ્તામાં શું છે?', r: 'aaje naasta ma shu che?', e: "What's for breakfast today?", w: [['naasta ma', 'for breakfast']] },
        { who: 'Mummy', g: 'બટાકા પૌંઆ. અને તારી ચામાં ખાંડ ઓછી નાખી છે.', r: 'bataka pauva. ane tari chaa ma khaand ochi naakhi che.', e: "Potato poha. And I've put less sugar in your tea.", w: [['bataka', 'potato'], ['pauva', 'flattened rice (poha)'], ['khaand', 'sugar'], ['ochi', 'less (feminine, to match khaand)'], ['naakhi che', 'have put']] },
        { who: 'You', g: 'કેમ? મને મીઠી ચા ગમે છે!', r: 'kem? mane mithi chaa game che!', e: 'Why? I like sweet tea!', w: [['kem', 'why'], ['mithi', 'sweet (feminine, to match chaa)'], ['game che', 'is liked (feelings happen to you)']] },
        { who: 'Mummy', g: 'ડૉક્ટરે શું કહ્યું હતું? યાદ છે?', r: 'doctor e shu kahyu hatu? yaad che?', e: 'What did the doctor say? Remember?', w: [['doctor e', 'the doctor (the "me"-type past)'], ['kahyu hatu', 'had said'], ['yaad che', 'is remembered']] },
        { who: 'You', g: 'હા હા, ખબર છે. ચાલો, હું નહાવા જાઉં છું.', r: 'haa haa, khabar che. chalo, hu nahva jaau chu.', e: "Yes, yes, I know. Okay, I'm going for my bath.", w: [['khabar che', 'I know'], ['nahva', 'to bathe'], ['jaau chu', "I'm going"]] },
        { who: 'Mummy', g: 'અને જતાં પહેલાં બાને ફોન કરજે.', r: 'ane jata pehla Ba ne phone karje.', e: 'And call Ba before you leave.', w: [['jata pehla', 'before going'], ['Ba ne', 'to Ba'], ['karje', 'do (informal, later)']] }
      ]
    },
    {
      id: 'dada-gaam', title: 'Dada on village life', cast: 'You and Dada', level: '"Used to" and village words',
      lines: [
        { who: 'You', g: 'દાદા, ગામમાં તમારો દિવસ કેવો હતો?', r: 'dada, gaam ma tamaro divas kevo hato?', e: 'Dada, what was your day like in the village?', w: [['tamaro', 'your (masculine, to match divas)'], ['divas', 'day'], ['kevo', 'what kind of (masculine)'], ['hato', 'was (masculine)']] },
        { who: 'Dada', g: 'અમે સવારે ચાર વાગે ઊઠતા.', r: 'ame savare chaar vaage uthta.', e: 'We used to get up at four in the morning.', w: [['ame', 'we (not you)'], ['savare', 'in the morning'], ['chaar vaage', "at four o'clock"], ['uthta', 'used to get up']] },
        { who: 'Dada', g: 'પહેલાં ગાય-ભેંસ દોહવાની, પછી ખેતર.', r: 'pehla gaay-bhens dohvani, pachi khetar.', e: 'First milk the cows and buffaloes, then the fields.', w: [['gaay', 'cow'], ['bhens', 'buffalo'], ['dohvani', 'to milk'], ['khetar', 'field / farm']] },
        { who: 'You', g: 'સ્કૂલ ક્યારે જતા?', r: 'school kyare jata?', e: 'When did you go to school?', w: [['kyare', 'when'], ['jata', 'used to go (plural for respect)']] },
        { who: 'Dada', g: 'સ્કૂલ? બપોર સુધી. પછી પાછા ખેતરમાં.', r: 'school? bapor sudhi. pachi pacha khetar ma.', e: 'School? Till midday. Then back to the fields.', w: [['bapor', 'midday'], ['sudhi', 'until'], ['pacha', 'back']] },
        { who: 'Dada', g: 'સાંજે બધા ચોરામાં ભેગા થતા.', r: 'saanje badha chora ma bhega thata.', e: 'In the evening everyone gathered at the chora.', w: [['saanje', 'in the evening'], ['chora', 'village square / meeting place'], ['bhega thata', 'used to gather']] },
        { who: 'You', g: 'ચોરામાં શું કરતા?', r: 'chora ma shu karta?', e: 'What did you do there?', w: [['shu', 'what'], ['karta', 'used to do (plural for respect)']] },
        { who: 'Dada', g: 'વાતો, ભજન, અને થોડી લડાઈ પણ!', r: 'vaato, bhajan, ane thodi ladai pan!', e: 'Chatting, bhajans, and a bit of fighting too!', w: [['vaato', 'talk / chats'], ['bhajan', 'devotional songs'], ['ladai', 'fighting'], ['pan', 'also']] },
        { who: 'You', g: 'હા હા! મને ગામ જોવું છે.', r: 'haa haa! mane gaam jovu che.', e: 'Ha! I want to see the village.', w: [['mane … jovu che', 'I want to see (to me, seeing is)']] },
        { who: 'Dada', g: 'જરૂર જજે. ત્યાં બધા આપણા જ છે.', r: 'jarur jaje. tya badha aapna j che.', e: "Do go. Everyone there is our own.", w: [['jarur', 'definitely'], ['jaje', 'go (informal, later)'], ['tya', 'there'], ['aapna j', 'our very own']] }
      ]
    }
  ];

  window.APOLLO_GRAMMAR = { patterns, stories };
})();
