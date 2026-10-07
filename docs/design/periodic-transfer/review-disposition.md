# Astra review disposition — 2026-10-07

One requested external review completed via Codex CLI 0.153.4, read-only sandbox,
`gpt-6-astra`, `xhigh`, OpenAI provider, exit 0 and nonempty final output.
[Transport](astra-transport.txt) was checked before reading/synthesizing the
[review](astra-review.md). Flat-rate subscription; no per-call dollar cost returned.
No second reviewer or subagent was launched. Main-agent model: `gpt-6.1-sol`.

The review inspected the live draft on app-source checkpoint `617fdc2`; no app
source changed during review. Small measurement/diagram notes were added while
it ran. Its raw review describes the first experiment, which gave the second Home
load an extra 0.05 fuel. The final experiment removes that exception and starts
Home service on arrival, following the adopted identical-recipe semantics.

| Recommendation | Disposition | Result |
| --- | --- | --- |
| Merge repeat, assistance, timing and runtime decisions around departure ownership | Adopted | Authored departures/durations, arrival-relative service, derived waiting. Later departure commitments do not silently slide. |
| No independent editable Wait block; edits regenerate both occurrences as a draft | Adopted | One recipe, two occurrences, accepted execution immutable, no occurrence overrides initially. |
| Compile sequentially from simulated prefixes before adding runtime scheduler insertion | Adopted as staging | Each leg resolves from its own state; source intent persists separately. Explicitly not runtime feedback. Preserve a pure resolver contract for later conditional/rolling execution. |
| Do not use terminal-velocity-only matching as first reusable transfer | Adopted | First abstraction is complete dock-to-dock transfer. Low-level terminal match remains a later template component. |
| Repeated geometry does not require different burn components when only mass changes | Adopted | Tests distinguish phase/duration-driven trajectory changes from cargo/fuel-driven accounting changes. No fake requirement that every voyage must have different burns. |
| Remove extra second-voyage Home refuel from main witness | Adopted and reproduced | Identical quantities complete 0.4 cargo by 51.334523, consuming 0.259747567 fuel, retaining 0.140252433. Diagram and measurements regenerated. |
| Current patient/express routes do not demonstrate faster cadence | Adopted | Both miss the next cheap outbound opportunity. Require actual delivery-spacing/opportunities-served witnesses before claiming cadence improvement. Immediate-repeat failure only rejects copying those burns at that epoch. |
| “Failed departure stays docked” needs preflight/transaction, not just event ordering | Adopted and reproduced | Raw runner undocks then rejects an unaffordable burn. Existing editor full-plan preflight prevents accepting it. Future runtime expansion must validate before committing undock. |
| Move propulsion comparison before second-ship scheduling | Adopted | Recipe/timeline gate → economical/generous impulse/finite-thrust study → joint conflict → bounded cadence/runtime. Phase clocks are fixture-specific, not universal torchship UI. |
| More fuel does not expand the current helper's component/branch domain | Adopted and code-checked | Port helper hardcodes ±0.25, CCW and <1 revolution. Broader validated domain/authored witnesses required for generous-impulse comparisons. |
| Keep seeds/work limits in advanced diagnostics; bounded helper does not prove agency | Adopted | Normal editing centers on dates, durations, load/refuel and route; classify resource, unsupported-domain and unresolved-search failures separately. Human revision gate remains essential. |
| Cost slices before a 2D opportunity map; show downstream readiness as well as local cost | Adopted | Departure and duration slices first. 2D map follows observed coupled-choice need; no global-optimum claim from slices. |
| Three deliveries plus gap/window/accounting constraints before cadence claims | Adopted | Later bounded-cadence gate exposes two gaps and includes terminal return/reserve. No indefinite-sustainability claim. |

## Main-agent spot checks

- Re-ran `scripts/periodic-study.ts` after removing extra fuel and rebinding Home
  reload to actual first return. Both voyages complete; resource ledgers reconcile,
  h/h2 fuel discrepancy <9e-13, varied scrub/advance partitions identical. These
  checks reuse the calibrated model and are not a fresh independent oracle.
- [Raw-runner check](load-bearing-checks.json): set patient ship fuel to 0.0001;
  at t=0.5 ledger contains Undock followed by Burn rejected and no dockedPortId.
- Inspected `src/planning/rendezvous.ts:23`: explicit ±0.25 departure bounds,
  CCW/zero-revolution branch and clearance. `src/editor/session.ts:87` validates
  the full draft and accuracy before replacing accepted execution.
- Patient return 19.626757 and express return 18 both exceed the next outbound
  opportunity 16.353883. This confirms the cadence qualification without relying
  on the reviewer's unsuccessful early-return attempts.
- Checked impulse application and gravity: cargo/fuel alter used propellant, not
  commanded velocity increments or acceleration from gravity in this test-body model.
- The steering family proposed for finite thrust is our bounded next experiment,
  not reviewer-verified feasibility. Neither the review nor this study playtested
  comparison games, proved torchship interest, or implemented reusable commands.

## Human taste decisions retained

Default proposal: players author the schedule/route and helpers calculate precise
paid burns, with manual flight available. The next hands-on gate decides whether
those choices feel sufficiently authored and whether long waits are satisfying
choreography. The following same-puzzle propulsion comparison decides how much
ballistic curvature versus direct high-thrust motion the game should emphasize.
No permanent chemical-only or torch-only commitment is made by this plan.
