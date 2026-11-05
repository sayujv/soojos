# Apollo — spoken SKLPC Gujarati, for conversation confidence

Category: personal
Stage: building

## Read before working
- Approved brief and definition of done: `../../.soojos/briefs/2026-11-05-apollo.md`
- Dialect research report: `../../knowledge/reports/2026-11-05-apollo-sklpc-dialect.md`
- Prior decisions (binding): `../../decisions/`

## Standing rules
- Verify before claiming done: `node projects/apollo/test/check.mjs` must pass.
- Every non-standard phrase carries a source URL, a date and a confidence. Standard Gujarati from general knowledge is labelled `unsourced` — never relabel it as dialect.
- The family verdict (Ask family tab, stored in the artifact's `progress` db doc) outranks every web source.

## This project specifically
- Static app in `app/`: `index.html` (page), `app.js` (logic), `data.js` (all phrases, units, scenes). No build step.
- Published as a private claude.ai Artifact so it works on the phone; `db` + `user` capabilities hold progress and family verdicts.
- Listening only, no script taught. Gujarati script is stored solely to drive text-to-speech.
- Add content by editing `data.js`; the check validates it.
