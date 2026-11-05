# A working grammar of spoken Gujarati (for Apollo)

Question (2026-11-05): what model of spoken Gujarati should Apollo's content generator work from, so that new dialogues are grammatical and not just memorised phrases?
Projects affected: Personal (Apollo).

## Status

Most of this is Claude's own working knowledge of Gujarati. The parts marked with a source were confirmed against search snippets; full pages couldn't be opened from this session. Everything Apollo generates from this model is labelled "Standard, not checked by family". The family verdict in the app overrides it.

## The model

### 1. Pronouns
- I: hu (હું)
- you, informal: tu (તું)
- you, respectful or plural: tame (તમે)
- you, very formal: aap (આપ)
- he / she / that: e (એ)
- they: teo (તેઓ), or e loko in speech
- we: **ame (અમે) excludes the listener; aapne (આપણે) includes them.** Source: Wiktionary paradigm and UPenn pronoun page (see table).

### 2. Copula
- Present: chu / che / chiye / cho (છું / છે / છીએ / છો).
- Negative: nathi (નથી) for every person.
- Past: hato / hati / hatu / hata (agrees in gender and number).
- Source: Wikibooks *Gujarati/Present*.

### 3. Present tense
Stem + person ending + copula. "hu karu chu", "tame karo cho". Vowel stems contract: jaau, jaay, jaiye, jaao.

### 4. Future
- Endings: -ish (I, and tu), -she (e, teo), -ishu (ame), -sho (tame).
- Source: Wiktionary જવું (to go) conjugation table, and a learner page.

### 5. Past of motion and other intransitive verbs
- Agrees with the subject's gender: gayo (man), gai (woman), gaya (plural or respectful).
- Elders take the plural even when they are one person: "Dada aavya".

### 6. Past of transitive verbs (ergative)
- The subject takes the oblique/ergative form: me, te, ene / emne, "Ba e".
- The verb agrees with the object: "me rotli khadhi" (rotli is feminine), "me laadu khadho" (laadu is masculine), "me khadhu" (no object stated, so neuter).
- Source: Peter Hook (U. Michigan) on Gujarati ergativity, and the Wikipedia "Gujarati grammar" page.

### 7. Commands
- Bare stem to intimates: kar.
- -o to anyone respected: karo.
- Future imperative -je (informal) / -jo (respectful), meaning "do it later" or more politely: karje, karjo.
- "ne" after the verb softens it.
- Source: UPenn CCAT imperative lesson.

### 8. Negation
- nathi: present ("hu nathi jato", with -to/-ti/-tu agreeing with gender).
- nahi: future and refusals.
- na: before an imperative, and in some past forms.

### 9. Dative experiencer
- Feelings, needs, knowing and liking take a dative subject: mane / tamne / ene + verb.
- Examples: "mane bhukh lagi che", "mane gamyu", "mane Gujarati aavde che", "mane gaam jovu che" (I want to see the village).
- The search found no source for this; it is Claude's own analysis.

### 10. Postpositions
- They follow the noun, often written joined: -ma (in), -e (at: ghare), -ne (to, and definite objects), -thi (from), -nu/-no/-ni/-na (of), maate (for), saathe (with), paase (near), par (on).

### 11. Genitive agreement
- "Of" agrees with the thing possessed: maro dikro, mari dikri, maru ghar, mara kaka.
- Respect shows up in grammar: "mara kaka" takes the plural form.

### 12. Register is grammatical, not just lexical
- Respect is not only the choice of tu or tame. It also shows in:
  - the imperative ending (bes vs beso)
  - plural agreement when talking *about* elders (aavya vs aavyo)
  - genitive agreement (tara dada, plural)
  - the -je vs -jo future imperative
- Apollo's drills test all four.

## Kutchi contrasts (from knowledge/reports/2026-11-05-apollo-sklpc-dialect.md, all `claimed`)

aaun = hu · aain = tame · achanto / vinanto = aavu chu / jaau chu · koro = shu · kada = kya · muke = mane · aay = che · achija = aavjo. The sentence shapes are the same as in Gujarati, so the patterns above carry over and only the core words change.

## Romanisation (the Apollo scheme)

- **Converter:** `projects/apollo/tools/translit.mjs` turns Gujarati script into English-reader roman.
- **Spelling rules:**
  - aa for long a
  - i and u for both vowel lengths
  - ch for both ચ and છ
  - sh for શ and ષ
  - the nasal mark (anusvara) as n before a consonant, and silent at the end of a word
- **Inherent-a dropping:** the inherent "a" is dropped at the end of a word, and in the vowel–consonant–a–consonant–vowel position.
- **Use:** an independent check that hand-written roman matches the script. In 413 pairs, 10 differ loosely, all of them loanwords or nasal endings, and none differ substantially.

## How Apollo uses this

- `app/grammar.js` holds 13 patterns (tables plus explanations, with drills generated from the tables) and 6 stories. The stories are written in Gujarati script first, then romanised and glossed word by word.
- The check fails if any gloss word is missing from its line, or if any roman doesn't match its script.

## Sources

| Claim | Source | Date |
| --- | --- | --- |
| ame exclusive / aapne inclusive | https://en.wiktionary.org/wiki/%E0%AA%85%E0%AA%AE%E0%AA%BE%E0%AA%B0%E0%AB%81%E0%AA%82 ; https://ccat.sas.upenn.edu/plc/gujarati/pronouns.htm | accessed 2026-11-05 |
| Present = stem + person marker + copula; copula chhũ / chhe / chhie / chho | https://kwx.liehendr.com/content/wikibooks_en_all_maxi_2021-03/A/Gujarati/Present | accessed 2026-11-05 |
| Future -ish (jaīś) | https://en.wiktionary.org/wiki/%E0%AA%9C%E0%AA%B5%E0%AB%81%E0%AA%82 | accessed 2026-11-05 |
| Ergative on transitive subjects in preterite / perfect; verb agrees with object | https://public.websites.umich.edu/~pehook/gujflerg.html ; https://www.wikiwand.com/en/articles/Gujarati_grammar | accessed 2026-11-05 |
| Future imperative -je / -jo; -ne softener | https://ccat.sas.upenn.edu/plc/gujarati/imperative.htm | accessed 2026-11-05 |
| Kutchi Gujarati shows object agreement linked to ergative subject marking | https://glowlinguistics.org/36/pdf/structural_asymmetries_-_the_view_from_kutchi_gujarati_and_marwari.pdf | accessed 2026-11-05 |
