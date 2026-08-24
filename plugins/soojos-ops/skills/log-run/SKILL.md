---
name: log-run
description: Record what a work session produced into the Notion registry — Automation Log, Tasks, and Spend & Revenue — so the trust ladder and spend tracking stay current without manual data entry. Use this whenever a build session finishes, an automation runs, money is spent or earned, or the user says "log this", "update Notion", or "mark that done".
---

# Log Run

Purpose: the registry stays accurate without the user touching Notion.

## Database IDs

| Database | ID |
| --- | --- |
| Mission Control | `b03e046eb0d34609ab472bd82bfb3af2` |
| Tasks | `907d0eee1fc544aca439fef67b38c05b` |
| Spend & Revenue | `dc79f953b9ea40dca1a2045defa99a56` |
| Automation Log | `8a53f6afca2540949075d7a18d229533` |

Workspace: "sayujvarsani's Space HQ".

## What to log where

- **Automation Log** — any automation that ran, with outcome and whether it needed intervention. This is the trust-ladder evidence: an automation only graduates to more autonomy on a record of clean runs.
- **Tasks** — status changes on existing tasks; new tasks discovered during the session. Always set the `Project` relation.
- **Spend & Revenue** — any API spend, subscription, or revenue. Never guess an amount; if unknown, say so and skip the row rather than inventing one.
- **Mission Control** — only when a project's stage actually changes.

## Rules

- Read before writing. Query for an existing row and update it rather than creating a duplicate.
- Multi-select values go in as JSON array strings, e.g. `["Chat", "Claude Code"]`.
- Report back in one line per row written. No summary paragraph.
- If the Notion connection fails, say so immediately and hand back the rows as markdown for manual paste — do not silently drop them.

## Known limits

- There is no native "this month" filter. Use `is within → the past month`, or a fixed date range that needs manual updating.
- Group-level Sum on Amount columns cannot be set through the API; it needs one click per column group in the Notion UI.
