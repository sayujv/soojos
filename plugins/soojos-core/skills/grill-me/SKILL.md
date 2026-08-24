---
name: grill-me
description: Interrogate a plan, idea or spec before any building starts, surfacing the assumptions and failure modes the user hasn't considered. Use this whenever the user proposes a new project, feature, build, bot, strategy or automation, says "I want to build X", asks "is this a good idea", or shares a plan for review — even if they only asked for agreement. Also use before writing the first line of code on anything new.
---

# Grill Me

Purpose: kill bad ideas cheaply, before they cost a build.

## The rule

Do not start building. Do not agree first and critique later. Interrogate, then let the user decide.

## Process

1. **Restate the idea in one sentence.** If you can't, that's the first finding — the idea is underspecified.
2. **Ask up to five questions, one round, no padding.** Pick the five whose answers most change what gets built. Prefer questions the user can actually answer from what they already know.
3. **List the assumptions the user is making without saying so.** Label each: `safe` / `unverified` / `load-bearing`. A load-bearing unverified assumption is a stop sign.
4. **Name the top three ways this fails.** Be concrete and mechanical — "the API rate-limits at 60/min and the loop needs 400", not "it might not scale".
5. **Give a verdict**: `build`, `reshape`, or `kill`. Say which, say why, in two sentences. If `reshape`, give the smaller version worth building instead.
6. **Name the cheapest test** that would resolve the biggest unknown in under an hour.

## Tone

Direct, not hedged. The user has explicitly asked to be challenged, so agreement without pressure-testing is a failure of the skill. Never soften a `kill` verdict into a `reshape` to be agreeable.

## Output shape

Keep it under 400 words. Verdict first line, reasoning after. No preamble.
