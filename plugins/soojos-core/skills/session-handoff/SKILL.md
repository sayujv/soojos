---
name: session-handoff
description: Write a handoff note that lets a fresh session resume work with no loss of context, before clearing context or ending a work block. Use this whenever the user says they're wrapping up, switching projects, running /clear, running low on context, or asks "where were we" / "pick up where we left off". Also use proactively when a long build session reaches a natural phase boundary.
---

# Session Handoff

Purpose: make context disposable. If the handoff is good, clearing costs nothing.

## When to write one

- Before `/clear` or `/compact`
- At the end of a phase in the phase → clear → handoff loop
- Before switching to a different project
- Any time context is above roughly 70% used

## Where it goes

Append to `./context/handoff.md` in the current project. Newest entry at the top, under a `## <ISO date> — <phase name>` heading. Create the file if missing.

## What to write

Six sections, no more. Facts only — no summary of the conversation.

1. **State** — what is true right now that wasn't at session start. Files created/changed, decisions made, things installed.
2. **Working** — what has been verified to work, and how it was verified. Untested code is not "working"; say so.
3. **Broken / open** — known failures, half-finished edits, anything left in a bad state.
4. **Next action** — one action, specific enough to start immediately. Not "continue the build".
5. **Landmines** — anything a fresh session would plausibly get wrong: a non-obvious path, a flag that must be set, an approach already tried and rejected.
6. **Decisions to log** — anything from this session that belongs in `./decisions/`. If there's something, offer to write it.

## Rules

- Never write "we discussed X". Write what was concluded.
- Be blunt about what's unfinished. An optimistic handoff wastes the next session.
- Keep it under 300 words. A handoff nobody reads is worse than none.
