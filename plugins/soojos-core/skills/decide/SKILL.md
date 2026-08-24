---
name: decide
description: Capture an architectural or strategic decision as a durable numbered record so it never gets re-litigated or silently reversed. Use this whenever the user settles a question of approach, picks one option over another, changes direction, or says "let's go with", "we'll use", "decided", or "actually, instead". Also use when a session ends having made a choice that a future session could reasonably contradict.
---

# Decide

Purpose: decisions live in files, not in chat history that gets cleared.

## Where it goes

`./decisions/NNNN-short-slug.md`, zero-padded, next number in sequence. Check the directory first to find the next number.

## Template

```markdown
# NNNN — <decision in one line>

Date: <ISO date>
Status: accepted | superseded by NNNN | reversed

## Context
What forced a choice. Two or three sentences.

## Decision
What was chosen, stated as a directive. "We use scoped API keys per project."

## Alternatives rejected
Each with the one reason it lost. This is the part that stops re-litigation.

## Consequences
What this makes easy, and what it makes hard or expensive later.
```

## Rules

- One decision per file. If it's two decisions, write two files.
- Never edit an accepted record to reflect a change of mind. Write a new record and set the old one's status to `superseded by NNNN`. The trail is the point.
- If `CLAUDE.md` states something this decision contradicts, update `CLAUDE.md` in the same turn and say so.
- Keep each record under 200 words.
