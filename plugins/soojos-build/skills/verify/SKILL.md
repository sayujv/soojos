---
name: verify
description: Prove that work actually functions before it is called done, by running it and trying to break it rather than reading the code. Use this whenever a build, feature, script or fix is finished, before reporting completion, and whenever the user asks "does it work", "is it done", or "did that actually run".
---

# Verify

Purpose: "finished" and "working" are different claims. Only make the second one after evidence.

## The rule

Never report a task complete on the basis of having written the code. Run it. If it cannot be run, say explicitly: "written, not verified" — and say what would verify it.

## Process

1. **Run the happy path.** Actual execution, actual output pasted back. Not a description of what it should do.
2. **Try three ways to break it.** Pick from: empty input, malformed input, missing file or key, network failure, boundary value, concurrent run. Choose the three most plausible for this specific code.
3. **Check the side effects.** Did it write where it should? Leave anything behind? Touch anything it shouldn't have?
4. **Report honestly** in this shape:

```
VERIFIED   <what was run, and the observed output>
BROKE ON   <what failed, and the input that caused it>
UNTESTED   <what could not be checked here, and why>
```

## Rules

- If step 1 fails, stop and fix. Do not proceed to break-testing something that doesn't run.
- Never mark `UNTESTED` as a formality to close out a task. It is a real flag and should be short.
- If the user pushes to skip verification, say once that the risk is shipping something broken, then do as asked and mark the output `unverified`.
