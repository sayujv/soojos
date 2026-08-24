---
name: standup
description: Produce a cross-project status read from the Notion registry showing what is live, what is blocked, and the single next action per project. Use this whenever the user asks what to work on, what's outstanding, "where am I at", "what's blocked", asks for a status update, or starts a session without naming a project.
---

# Standup

Purpose: answer "what do I do next" across every project in under 30 seconds of reading.

## Process

1. Query **Mission Control** for all projects and their stage.
2. Query **Tasks** for anything not `Done`, grouped by project.
3. Query **Automation Log** for runs in the past week that needed intervention.

## Output

Plain markdown, no headers per project, one block:

```
BLOCKED
  <project> — <task> — <what's blocking>

IN FLIGHT
  <project> — <task> — <surface>

NEXT UP (pick one)
  <project> — <the single highest-leverage next action>

NEEDS ATTENTION
  <automation> — <what went wrong> (only if intervention was needed this week)
```

## Rules

- End with one recommendation: which project to work on right now, and why, in one sentence. Make the call — do not present options.
- If nothing is blocked, omit the BLOCKED section entirely rather than writing "none".
- Cap at 20 lines. If there's more, show the highest-priority items and say how many were omitted.
