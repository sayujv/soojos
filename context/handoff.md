# Handoff — 2026-11-05

## Apollo (spoken SKLPC Gujarati app)
- Brief: `.soojos/briefs/2026-11-05-apollo.md`. Brain: `projects/apollo/CLAUDE.md`.
- Live: https://claude.ai/artifact/UWau6HvAqzDKKR6t55Re3q (private, db+user capabilities; progress doc at `progress/<userId>`).
- Content:
  - 94 phrases across 7 units: 70 standard (unsourced), 18 Kutchi, 2 SKLPC, 4 Swahili loans.
  - 3 role-play scenes.
- Check: `node projects/apollo/test/check.mjs` passes. It covers content validation, every unit's first lesson, review, all scenes, Ask-family persistence, dark mode, 0 console errors and no sideways scroll at 390px.
- Research: `knowledge/reports/2026-11-05-apollo-sklpc-dialect.md`. Snippet-only because the session network blocked all page fetches, so everything is rated `claimed` at most.

## Next
1. Sayuj uses the Ask-family tab with a parent. Then read the verdicts with ArtifactData `list progress`, fold them into data.js and republish.
2. Re-run research with network access, or on the Mac: panjokutch.com, cal.org PDF, freelang, sklpc.com, YouTube Kutchi Patel comedy.
3. Grow the standard core to about 300 phrases and add scenes (wedding, mandir, shopping in Bhuj).
