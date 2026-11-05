# Apollo — spoken SKLPC Gujarati, for conversation confidence

Category: personal
Stage: building

## Read before working
- Approved brief and definition of done: `../../.soojos/briefs/2026-11-05-apollo.md`
- Dialect research report: `../../knowledge/reports/2026-11-05-apollo-sklpc-dialect.md`
- Working grammar (generate new content from this): `../../knowledge/reports/2026-11-05-gujarati-spoken-grammar.md`
- Prior decisions (binding): `../../decisions/`

## Standing rules
- Verify before claiming done: `node projects/apollo/test/check.mjs` must pass.
- Every non-standard phrase carries a source URL, a date and a confidence. Standard Gujarati from general knowledge is labelled `unsourced` — never relabel it as dialect.
- The family verdict (Ask family tab, stored in the artifact's `progress` db doc) outranks every web source.

## Family check (native-speaker review)
- Page: `review/` → https://claude.ai/artifact/N3E4x1Z5TArJvfA3mddZjp (db: `answers`, one doc per item per reviewer: item, by, name, v, c, say).
- Read answers with ArtifactData `list` on `answers`. Item ids map back: `phrase:<id>`, `scene:<id>:<step>`, `lad:<ladder>:<rung>`, `story:<id>:<line>`, `pat:<id>:<row|why>`, `guide:<g>:<r>`, `rule:<i>`, `q:<question>`.
- v = yes/close/no/unsure (questions: yes/some/no/unsure); c = verdict on the note; say = how they'd say it. Their "say" outranks everything: fold it into data.js / speech.js as the family form, then rebuild audio and run both checks.
- No-account path: answers stay on the reviewer's phone; the green button opens WhatsApp with `APOLLO1|name|i/n` messages (lines `id|v|c|say`; v y/~/n/?/s, c y/n). Sayuj pastes them into "Add answers someone sent you" on the same page, which writes them to db `answers`. Or he pastes them to Claude directly: the format is the same.
- Public, no-sign-in copy: `review/family-check.html` (generated: `node projects/apollo/tools/build_standalone.mjs` after editing review/index.html), served from the public repo at https://raw.githack.com/sayujv/soojos/apollo-app/projects/apollo/review/family-check.html. It has no db, so answers come back over WhatsApp.
- Check: `node projects/apollo/test/review_check.mjs`.

## This project specifically
- Static app in `app/`: `index.html` (page), `app.js` (logic), `data.js` (phrases, units, scenes, who's-who), `grammar.js` (patterns, glossed stories), `speech.js` (register ladders, shortcut rules, gym sentences, level check). No build step.
- New dialogue: write the Gujarati script first, then roman and English, then word glosses. `tools/translit.mjs` checks script against roman, and the check fails if they diverge.
- Published as a private claude.ai Artifact so it works on the phone. `db` + `user` hold progress, family verdicts and saved phrases; `sample` powers Ask and Rehearse. Publish with `root` = `projects/apollo/app` and include `audio/*`.
- After any content change: `node projects/apollo/tools/build_audio.mjs`, then the check.
- Speaking and listening first. Gujarati script drives text-to-speech and is the authoring source; learners see it only through the optional "Show Gujarati script" toggle in stories.
- Add content by editing `data.js`; the check validates it.
