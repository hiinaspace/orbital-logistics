# Lunar return profile pass — 2026-10-10

The accepted continuous lunar set retains Northhaven, inclined Crescent, moving
Selene and synchronous spin. Returns now use a bounded deorbit/coast/terminal
profile and a small local departure search, with the original continuous powered
descent available as fallback. The set remains an exhibit rather than an optimum.

## Exact saved-flight comparison

The retained 60-trial authoring experiment compares four old saved flights with
fixed 0.012 coasts. All selected controls pass the full canonical Runner.

| Saved flight | Old return delta-v | Coast return delta-v | Reduction | Departure shift |
| --- | ---: | ---: | ---: | ---: |
| 0 | 2.371 | 1.954 | 17.6% | +0.000 |
| 1 | 2.537 | 2.156 | 15.0% | -0.012 |
| 4 | 3.476 | 2.475 | 28.8% | -0.012 |
| 10 | 3.218 | 2.177 | 32.4% | +0.000 |

[Exact metrics](lunar-return-comparison.json) retain the baseline commit and values.
The [Moon-relative projection comparison](../../spikes/lunar-return/paths.png)
shows visibly reduced bends, including removal of a small loop in flight 4. Those
offline choices demonstrate the family, not the precise subsequently evolving
online seed sequence. Fuel and summed steering turns are only shape proxies; one
selected path is longer than its baseline. Human viewing remains the aesthetics
gate. No extra pad or faster lunar rotation was introduced.

## Full-calendar sequential service

The unchanged 64-unit calendar completed normally:

- 89 complete admitted round trips/4.45 supplies, versus 68/3.40 previously.
- All 89 returns used the coasting family;29 planning retries versus 71 before.
- Minimum returned propellant 0.975080389, versus 0.123253011 before; guard remains 0.1.
- 607.065898 fuel used across 89 trips, about 6.82 per trip versus 7.59 before.
- Average return delta-v 2.145665. Actual workloads 37,700 targeting evaluations and
18,212,148 RK stages, including failed probes.
- Peak aggregate physical serialization 34,324,946 bytes, below 40 MB.
- Peak view 22,175,796 bytes, packet 7,399,894 bytes and 32,966 retained drawing samples.
- Worst drawing error at maximum camera scale 0.164007px (including the coast),
with depot interpolation 0.128547px.

The fixture calendar and resource/capture checks are unchanged.32 private physical
candidate refusals were exercised without halting service. In particular, the
t≈14.7117 candidate that previously allocated 44.7 MB now refuses within its
preparation allowance; later trips continue. Failure draws/refuels/seeds remain
unpublished until a whole trip admits.

See [rollout](lunar-service-rollout.json). The 349.998s evidence-script runtime was
collected concurrently with the full test suite and browser; it is not a comparable
isolated performance benchmark against the earlier 194.797s run.

## Numerical and runtime checks

- Canonical parent-step convergence 1/4096,1/8192 and 1/16384, with unchanged globally
anchored 1/8192 depot targets.
- Independent inertial DOP853 replay carries position/velocity/fuel through deorbit,
free coast and terminal braking; only actual arrival/landing performs capture.
Explicit free-coast probes and all-body coast clearance are included.
- 231 simulation tests passed, including request/work partition invariance,
held history, completed-physics retirement, bitwise future leases, coast fuel/state
continuity, and byte-limited/unlimited canonical parity.
- The original trial residual/continuous canonical safety and 0.1 reserve remain
required; no free snapping or relaxed tolerances were added.

The new preparation-only Runner node-insertion allowance counts actual node
serialization before retaining a new node. The lunar caller reserves 64 KiB for
bundle/ledger/event sides/final head mutations and 512 bytes per ballistic node.
The source domain pins two ports, two five-key/full-throttle seed arcs and eight
operations. Accepted physics is identical with/without sufficient allowance;
exhausted private preparations return work-limit and release before fallback/retry.

[Astra review](../design/lunar-return/astra-review.md) approved the bounded family,
separate seeds, cold fallback, physical/drawing lifetimes and actual byte accounting.

Independent replay maximum canonical-grid ship errors were 6.60e−12 position,
3.75e−10 velocity and 1.26e−10 propellant across the four witnesses, including coast
probes. The coarser 1/4096 parent witness had maximum velocity error 1.86e−9.
Independent coast Moon clearance was at least 0.00564408; the depot's complete
64-unit independent calendar agrees to 2.87e−10 position/6.22e−9 velocity.

A fresh production-browser run reached t=2.1001 after 105s at the maximum 0.02×,
with no page/traffic errors. Pause/held pose, rewind, camera drag, all reference
frames, Live and switching between fixed/network/lunar sets passed. An earlier
run concurrent with the full suite reached only 1.7779 by the same wall-time gate
without errors; the fresh run establishes the unloaded playback witness rather
than claiming identical speed under arbitrary contention.
