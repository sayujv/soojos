---
name: deepen
description: "Before starting any substantial, open-ended, or high-stakes task, write a short task brief that restates what the user is really trying to achieve and names the outside check that will prove the result right, then wait for a go-ahead. Make sure to use this skill whenever the user asks to build, implement, research, design, set up, backtest, or automate something multi-step, whenever a request could be read more than one way, and for anything touching money, trading, IBKR, credentials, or data that is hard to undo, even if the user does not ask for a brief. Skip it for small, clearly specified edits, renames, lookups, and follow-ups inside a task that already has an approved brief."
---

# deepen

Closes the gap between what the user meant and what Claude understood, before any cost is spent building the wrong thing. The idea is a deeper version of the task, not a bigger one. Do not add features or widen scope.

Adapted from a prompt in a post by Felix Rieseberg on being more ambitious with AI.

## When to run it

Run it when the task is multi-step, ambiguous, or expensive to get wrong. Skip it when the request is a small, precise edit, or when the user says "just do it", "no brief" or similar. Run it once per task. Do not repeat it on follow-up messages inside the same task.

## Procedure

Write the brief in 200 words or fewer. Concrete items only, no padding.

1. **Intent.** One or two sentences: the outcome the user wants and why, in your own words. This is the line the user will correct if you have misread them, so make it specific.
2. **Deeper version.** What a top practitioner in this field would do here that the user has not asked for. Keep it to what changes the quality of the result. Do not widen scope.
3. **Raw material.** The primary sources or data to start from, rather than summaries someone else already digested.
4. **Methods and tools.** The specific approach and tools you will use.
5. **Outside check.** What, other than you or the user, would show the result is right. A test run, a published number to reproduce, a data validation, a tool that returns pass or fail. If no such check exists, say so and propose one. If none can be built, say the result will be unverified.
6. **Open questions.** At most two things that would change the plan. Omit if none.

Then ask: "Proceed with this, or correct it?" and stop. Do not start building until the user confirms.

## After approval

Save the approved brief to `.soojos/briefs/YYYY-MM-DD-<slug>.md` in the current repo, creating the folder if needed. Include the exact command that runs the outside check. This keeps the intent and the definition of done alive after /clear, a new session, or a handoff to another agent. At the start of a task, if a matching brief already exists there, read it and confirm it still holds instead of writing a new one.

Work to the brief. The outside check is the definition of done. Run it and report the result. Never mark work complete on your own judgment alone, and never grade your own output as the final check.

## Cost discipline

The brief is one cheap pass. Do not spawn subagents to write it. Do not read large files to write it. If the task is small enough that the brief would be longer than the work, skip it.

## Example

Request: "Implement the overnight return anomaly for the equities desk."

- **Intent:** Test whether the published overnight-versus-intraday effect survives our data and our costs, as a go/no-go on this strategy family.
- **Deeper version:** Replicate the paper's own result first on its own sample period before testing anything out of sample.
- **Raw material:** The paper's stated rules and daily open and close series, not a blog summary.
- **Methods and tools:** Encode the rule exactly as published, value-weighted, then out-of-sample with realistic costs and a Monte Carlo on the result.
- **Outside check:** The paper's published alphas on its own sample. If the replication does not land close, the implementation is wrong and nothing downstream counts.
- **Open questions:** Which universe and breakpoints should define "large cap"?

Proceed with this, or correct it?
