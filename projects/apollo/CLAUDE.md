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

## This project specifically
- Static app in `app/`: `index.html` (page), `app.js` (logic), `data.js` (phrases, units, scenes, who's-who), `grammar.js` (patterns, glossed stories), `speech.js` (register ladders, shortcut rules, gym sentences, level check). No build step.
- New dialogue: write the Gujarati script first, then roman and English, then word glosses. `tools/translit.mjs` checks script against roman, and the check fails if they diverge.
- Published as a private claude.ai Artifact so it works on the phone. `db` + `user` hold progress, family verdicts and saved phrases; `sample` powers Ask and Rehearse. Publish with `root` = `projects/apollo/app` and include `audio/*`.
- After any content change: `node projects/apollo/tools/build_audio.mjs`, then the check.
- Speaking and listening first. Gujarati script drives text-to-speech and is the authoring source; learners see it only through the optional "Show Gujarati script" toggle in stories.
- Add content by editing `data.js`; the check validates it.
