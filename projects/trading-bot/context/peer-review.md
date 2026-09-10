# IBKR reciprocal technical review

Authorized by Sayuj on 10 September 2026; see /Users/sayuj/soojos/decisions/0006-reciprocal-claude-astra-review.md. Applies to Claude and Astra/GPT equally.

The author prepares a commit and change packet. The other assistant inspects the actual diff and relevant instructions, verifies meaningful tests where accessible, and records:

- Author and independent reviewer.
- Repository, worktree, base commit and reviewed commit.
- Change purpose and scope.
- Findings with file/line references and required fixes.
- Actual verification commands, results and limits of access.
- PASS, CHANGES REQUESTED or BLOCKED, and the next authorized action.

A verdict applies only to the recorded commit. New changes require re-review. A summary-only review is preliminary. PASS does not authorize deployment, money, credential changes, protected-policy edits, pushes or merging to main. Never click security or transaction approvals on the other assistant's behalf. Keep existing STOP, budgets, governance, protected controls and single-writer worktrees.

Refresh the original Equities CLAUDE.md and current handoff before work. Put repository review artifacts under artifacts/ through core/artifacts.py; append its handoff at the end. Use this shared SoojOS handoff for coordination when the source repository is not being changed. A cloud chat may require a supplied diff or an existing connector; local paths alone do not establish access. Direct message receipt is not independent review or proof a build ran.

Initial Claude review target: passive collector at /Users/sayuj/soojos/.worktrees/task-20260910-equities-passive-preflight, commit 4bd3bd5aecf4abb6af11f1d71e8a9d8f35fd86da, files projects/trading-bot/prototype/{README.md,preflight.py,test_preflight.py}. Next Claude-authored change must be handed back with its exact commit/evidence for Astra review.
