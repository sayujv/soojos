# Constraints

- **Security model:** scoped API keys, not prompt-level permissions. Give keys, not instructions.
- **Never** write to credential files. Enforced by the `soojos-money` hook.
- **Harvesting runs locally.** Reddit and YouTube block datacenter IPs; harvesters run on the Mac under launchd, never on a hosted cron.
- **Context hygiene:** phase → clear → handoff. Situational data is fetched just in time, never pinned.
- **Cost:** build a lot, spend little. Prefer habits and standardisation over new infrastructure.
