**Keep the finite scope, but hold UI wiring until the complete two-round-trip native witness passes.** I found no demonstrated physical impossibility; feasibility remains unproved.

Baseline verification: branch/HEAD match `codex/model-set-viewer` / `27a430b`. The retained artifact matches the stated period, 185,100 baseline nodes/checks, and numerical errors. Native source confirms the field, 80-unit integration limit, supported step sizes, and interval enclosure. These were source/artifact checks, not reproduced simulations. The six-file audit did not independently verify GenericRunner limits or the claimed 385 oracle epochs.

1. **P1 — Complete-service feasibility is the immediate blocker.**
   [author.py:144](/home/s/code/orbital-logistics/docs/design/compact-cycler/redesign/author.py:144) authors one round trip and ends after its Cairn return. It does not establish the second absolute-epoch trip, native capture residuals, or chronological fuel/force accounting. Before UI work, require both trips against the actual native carrier, all four paid landings/captures as applicable, every landing reserve, and aggregate budgets. A failed candidate should trigger retargeting, as the brief proposes—not relaxed tolerances.

2. **P1 — Make the native integration admission contract explicit.**
   [physics.ts:21](/home/s/code/orbital-logistics/src/compact/physics.ts:21) accepts a caller-supplied acceleration bound, defaulting to zero; it does not verify that the cubic obeys that bound. It also inserts every control key into integration cuts without checking containment. The new adapter must validate control intervals/keys, certify the acceleration bound used by enclosure, and enforce the fixed field supported by this integrator. Counterexamples: an understated bound, an out-of-interval key, and a profile field differing from the hardcoded field must reject before propagation.

3. **P2 — Specify the four-delivery resource ledger precisely.**
   [brief.md:21](/home/s/code/orbital-logistics/docs/design/compact-cycler/redesign/brief.md:21) says “reserve at both landings,” although two round trips imply four landings. Require the reserve at **every** landing, and explicit reloads for each subsequent `.15` delivery. Define capture payment, unloading, funded refilling/loading, and departure order at shared epochs. Test a deficient refill and an omitted reload; neither may silently produce the advertised next delivery.

4. **P2 — Reusing `ownSample` needs an attached-mass wrapper.**
   [query.ts:18](/home/s/code/orbital-logistics/src/compact/query.ts:18) returns the actor’s own mass. Attached shuttle mass is added separately inside `sampleCompact` at line 40. Bypassing that function is correct for finite time, but must preserve its mass addition explicitly. Test board/release event-left and event-right values, separate tanks, and full-horizon queries without wrapping.

The proposed separate finite domain, exact native handoff nodes, actual endpoint continuation, and complete private admission are appropriate. Continuous correction/resource closure can remain deferred.

Read-only review completed; no implementation, simulations, or review subprocesses run.
