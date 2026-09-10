# Automatic Claude partnership handoffs

Authorized by Sayuj on 10 September 2026: execute the approved work, provide a summary for Claude, and automate typing/input of that summary in the Claude app. This authorizes in-scope status messages in the existing partnership conversation. It does not authorize changing Claude project instructions, account settings, credentials, financial controls or excluded projects.

Destination verified in the signed-in Claude desktop app:
- Project: SoojOS — https://claude.ai/project/019eef0a-d16a-7440-b45e-a791e4f22c61
- Conversation: Integrating Claude and GPT for collaborative projects — https://claude.ai/chat/c3921ae7-ea92-40a4-8ff6-2a3c11b323eb

Run this as part of the existing `partnership-desk-check` heartbeat after ordinary queue work and at meaningful checkpoints. Do not create another recurring automation. Keep its half-hour cadence and notification preferences. The local Mac, usable Claude session and computer-use access must be available; scheduled activation does not prove future delivery.

## Select material updates

Read current shared handoffs, policy/approval, scope readiness and terminal task outboxes. Compare stable factual content against the last delivered source manifest. Exclude tick timestamps, accounting-only refreshes and the handoff-delivery task itself. A new verified result, substantive project change, resolved/new blocker, changed user instruction or capital decision is material. An unchanged queue or a mere acknowledgement is not.

Keep one concise latest summary at `context/desk/claude-handoff-latest.md` and immutable dated copies under `context/desk/claude-handoffs/`. Use an ID `CLAUDE-HANDOFF-<sha256 prefix>` derived from the stable source manifest. Store delivery states in `/Users/sayuj/.soojos/desk/claude-handoff-deliveries.jsonl`: ID, destination, source fingerprint, content hash, saved-summary path, attempted_at, state (prepared/attempting/delivered/ambiguous/pending), verified_at and acknowledgement excerpt when present. These receipts contain no credentials. Never call a message delivered merely because it was typed.

## Deliver and verify

1. Check STOP (including dangling symlink) before preparing, before typing and before sending. Preserve desk time, worker, chain and financial controls. Log a bounded native Codex handoff work unit when sending; it is bookkeeping for the existing user-authorized update, not a new build/review family.
2. Use Computer Use to select the exact existing Claude conversation above. Read the current URL/title and newest messages. Preserve any user draft and never interrupt an active response. If the intended surface is unavailable or occupied, retain the pending summary; do not post elsewhere or create duplicate conversations.
3. Before a send, verify the existing signed-in personal Max/Pro account and that Usage credits are off within one hour. Read only; do not change a setting. Respect provider quota messages. Native CLI reviews still use the separate approved desk worker; this UI route is the user's requested continuity delivery, not an API/proxy fallback.
4. Reconcile any prior attempting/ambiguous receipt against the visible conversation before retrying. If the same handoff ID already appears as a sent message, mark delivered and do not resend. If absence cannot be established, keep ambiguous and report it. Persist attempting before the final send, with the exact summary ID/hash.
5. Paste a self-contained summary labelled From Astra/Codex, posted on Sayuj's behalf. Include actual changes, verified tests, branch/commit/path evidence, current blockers, measured new cash, unknown usage, queued next work and pending decisions. Local paths are evidence pointers: never claim that a web chat can read them. Do not include credentials, raw private transcripts, account balances, or unrelated project details.
6. Ask Claude only to acknowledge receipt and flag corrections from existing context in a brief reply. Do not ask it to launch tools, delegate, spend or independently continue the portfolio from this message. Receiving a handoff is not independent verification. For a substantive review/build, queue a properly scoped work unit through current controls.
7. Verify that the exact ID and message appear in the destination conversation. Record delivered only after visible verification. Read the acknowledgement if available and preserve factual corrections/dissent for the next authorized task. No automatic response-to-response conversation loop.
8. Summaries consolidate all material changes since the last verified delivery. Do not send one per small file edit, repeat unchanged blockers each half-hour, or treat a Claude acknowledgement as new work requiring another summary. Notify Sayuj only of a material result, correction, failure or required action.

If automatic approval review rejects a delivery, preserve the exact pending message and report the stated action/reason. Do not switch tools or destinations to route around the rejection.
