# Faster bounded service planning

2026-10-09. User accepted stable focus and smooth buffered1× service, then
authorized numerical simplification and a measured, potentially set-specific
speed limit. This slice first takes the lower semantic risk improvement suggested
by the [stationkeeping research](../../../reports/Efficient%20orbital%20stationkeeping.md):
replace coordinate probes with propagated control sensitivities.

## Numerical contract

Adaptive station controls and both visitor legs opt into sensitivity shooting.
Existing maintained and prepared routes retain the default finite-difference
solver. Every candidate still runs the canonical Runner, its clearance
certificates, force/mass laws and event boundaries. The terminal tolerance remains
2e-11; coupled admission still checks paid captures, donor/station reserves,
aggregate docked mass, corridor, burn budget and frozen-owner reconstruction.
No stationkeeping objective, physical step, schedule search domain or fuel budget
has been relaxed.

The optional gravity Jacobian is calculated alongside the existing acceleration:
`G = sum(mu * (3 dd^T/r^5 - I/r^3))`. A tangent sweep follows the Runner's actual
retained RK4 intervals, including safety subdivisions. Six columns differentiate
two fixed-epoch inertial force vectors. Gravity stages share the dynamics function;
powered stages use the executed anchored mass law. For an uncapped pulse,
`dm/dp = anchorMassGradient - elapsed * d|force|/dp / exhaustVelocity`, and
`d(force/m)/dp = I/m - force * (dm/dp)/m²`. Fuel sensitivity survives the coast
between pulses and enters the next pulse's mass anchor.

This matrix guides Newton updates; it is never a propagation checkpoint or an
admission substitute. The tangent's reconstructed stages can have tiny rounding
differences from the force/throttle representation, and at zero force it uses a
zero mass subgradient. Canonical line search and final convergence remain
authoritative. Cap transitions, depleted fuel and steered arcs are unsupported by
this tangent family and return to finite probes. Both physical evaluations and
tangent attempts consume the same deterministic, bounded numerical-work budget.
No wall-clock timeout chooses a route or changes physics.

## Playback decision

The sensitivity-only experiment with16 units of lead measured4×,8× and16× through
256 actual units in production Chrome. All three drained the reserve; 8× achieved
5.98× and16× achieved8.29× on this host, with visible holds. Numerical speedup alone
does not make high warp continuous.

The production policy therefore primes32 actual units and limits **Orison ·
flexible service** to4×. That reserve gives eight seconds of planning runway at
the maximum rate. The total128-unit retention is unchanged, leaving96 units
behind the cursor at full lead. Playback still advances through acknowledged
facts, stops at the actual head on exhaustion, and respects pause, hidden-tab,
fault and historical scrub behavior. Other sets retain16×; switching into the
flexible set clamps the carried rate and switching out restores the slider range.
There is no automatic rate escalation or machine-dependent route selection.

## Evidence and limits

See [evidence](../../evidence/sensitivity-planning.md), `browser-256.json` for the
16-unit experiment, and `browser-512.json` for the final32-unit/4× test.
`timing-512.json` and `replay-512.json` retain the numerical work counters and
generated control stream. The long Node timing overlaps later regression work
and is not an isolated throughput benchmark. `oracle-input.json` reconstructs
the frozen stream from its original anchors through528, including the last
admitted future journey; `oracle.json` is the independent DOP853 comparison.

The raw wall-clock evidence concerns installed headless Chrome154.0.8037.97 on natto's Ryzen
7 7840U and this bounded, coplanar set.4× is a conservative product envelope, not
a promise for every browser/device or a proof for arbitrary future station/fuel
states. Slower playback remains available. The optional performance witness fails
if supported rates lose more than5% wall-clock throughput, hold for600ms, or drain
the reserve. A separate element/deadband controller remains a future policy
experiment; it is unnecessary to expose an unmeasured higher speed now.

All artifacts here are durable, bounded evidence for this slice. Existing
responsive-service and flexible-service baselines are retained unchanged.
