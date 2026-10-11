# Overlapping expeditions evidence

Fixture: `fixtures/model-sets/aster-selene-crossings.json`.
Commands: `npm run evidence:crossings`, `npm run test:sim`,
`npm run build` and
`PLAYWRIGHT_PREVIEW=1 npx playwright test tests/browser/crossings.spec.ts tests/browser/continuous-apollo.spec.ts tests/browser/apollo.spec.ts`.

## Accounting, ownership and physics

The 620-unit instrumented rollout completes 11 expeditions and 11 funded refills,
with one physical compilation and no targeting optimizer. Aggregate fuel balance
differs by at most 7.11e-15. The local craft remains healthy. Physical ownership
peaks at 102,398 nodes and 32,461,779 serialized bytes. Worker and frontend each
peak at six cycle strips, about 52.82 MB; frontend retained drawing samples peak
at 159,887 including local history. The retained template is shared once inside
each process, but worker/frontend strips are distinct owners.
The initial packet is about 25.71 MB; ordinary packets are a few kilobytes and
a new-cycle packet carries one roughly 9 MB strip. Raw counters, timing and
orbiter witness samples are in [crossings.json](crossings.json).

All 238 simulation tests pass; focused expedition tests were rerun after the
exact-threshold fixes. They cover the delayed supported prelude, unchanged
global body/gravity covariance, actor-specific pad ownership, exact event
samples, lunar occupancy, per-ship queries, funded aggregate consumption,
held cursor through a reply, bounds and rejection without published mutation.
A chunked/uninterrupted local replay agrees to 1e-13; halving h to 1/512 stays
within 1e-8. Injecting an initial orbital collision preserves a last-known
fault at epoch 0 beyond history eviction while both expeditions continue.

## Independent replay

The independent DOP853 local replay runs through 320 units and differs from
production by at most 1.410e-10 in state components. Its sampled planetary
radius ranges from 1.41392 to 1.59440, with at least 0.21392 clearance above
atmospheric top. Runtime interval guards cover both solid bodies and air.
See [crossings-oracle.json](crossings-oracle.json).

Argosy's independent mission replay rotates the controls and antipodal home
pad, then integrates at its actual delayed global epoch without changing world
rails. First and cycle 17 trips pass the unchanged 1e-3 whole-mission gate,
2e-6 local capture gates, positive clearances and bounded recovery speed.

| Argosy cycle | Maximum state difference | Recovery epoch difference | Recovery state difference |
| --- | --- | --- | --- |
|0|3.541e-5|7.116e-5|1.741e-5|
|17|4.589e-5|9.629e-5|2.023e-5|

Reports: [first](apollo-oracle-cycle-0-half.json) and
[late](apollo-oracle-cycle-17-half.json). Production force, load and fuel
limits are unchanged. Numerical ruff formatting/lint and ty checks pass.

## Browser and performance

All three production-browser scenarios pass: finite, single continuous and
crossings. The new scenario watches 16× playback across multiple introductions,
then checks both ground sites, phased launches, Tranquility support, atmospheric
return, hidden transport, explicit refill, Wren-centered and rotating frames,
held camera/pose, Return to live and switching/reinitialization. No browser
exceptions or simulation faults were recorded. Screenshots:
[launch](crossings-launch.png), [entry](crossings-entry.png) and
[overview](crossings-overview.png), visually inspected during implementation.

The first loaded run, concurrent with the full suite and numerical jobs, observed
11.67× advancement at a 16× setting and a 200 ms maximum RAF gap. It is retained in
[crossings-browser-loaded.json](crossings-browser-loaded.json).
After heavy jobs finished, a clean run observed 15.67× with no main-thread
long tasks and a 66.7 ms maximum RAF gap. The final delivery rerun observed
15.64×, 359 frames, eleven 51–72 ms long tasks and a 100.1 ms maximum RAF gap.
See [crossings-browser.json](crossings-browser.json). These are bounded
headless-Chrome/host measurements, not a guarantee for arbitrary fleet sizes or
machines.

The initial probe's roughly 679 ms main-thread cycle construction was moved
into the existing background worker. Frontend missing-row access now fails
instead of falling back to synchronous construction. Separately counted caches
plateau during the rollout. This solves the measured recurring construction
problem without changing physical fidelity.

## Review and product gate

[Astra review](../design/overlapping-expeditions/astra-review.md) found no
remaining source blocker after the fixes. Its independent seam probe passed 50
assertions across both actors and cycles 0,1,10,17 and 9000. Exact braking and
hide/refill thresholds now restore canonical epochs without epsilon snapping.

The user accepted the previous one-ship continuous exhibit through 16× without
errors or hitches. This larger exhibit awaits their aesthetic/playback evaluation
before adding a libration-region station or staged mission.
