# Direct surface flight

The cached surface/live-relay exhibit failed the owner's visual gate. This
comparison removes its circular staging interfaces and integrates complete
airless surface/station legs in the full configured Orison–Mote field.

The finite tour launches at 4.276198240330058, docks at 7.25, departs at 7.875,
and lands at 10.848801759669943. Tern keeps one tank and .05 cargo throughout.
Both flights use C1 spherical steering, finite mass-dependent thrust, a 32 force
ceiling and 3 acceleration cap, with the unchanged solid-body collision checks.
Endpoint corrections are numerical residuals, not planned impulses. The selected
visit finds Meridian's tank full; the top-up is zero. A longer 76-unit release
test verifies nonzero loaded station maintenance and resource ownership.

Independent seven-state DOP853 replay starts from each actual flight input,
uses both configured bodies, steered force, and evolving fuel, and splits at
authored steering knots and burn boundaries. Maximum sampled position errors
are 1.665e-12 outbound / 2.518e-12 inbound; velocity errors 1.256e-12 / 2.460e-12;
fuel disagreement <=3.56e-15. Oracle tightening changes state by <=1.95e-11.
Both independent paths stay above the supported COM radius; sampled minima are
1.000001 and 1.0000010000019492. Six-state terminal target errors <=3.51e-12.

An independent station replay retains its original state through capture,
transfer, and release, changing attached nonfuel mass/fuel without resetting
station position or velocity. Sampled station position disagreement <=6.79e-14.
Simulation tests also verify event sides, inventory/berths, conservation, full
field/hardware, actual drawing agreement, absent cache allocation/handoffs,
input rejection, and the longer loaded visit.

Recorded preparation: 2.94 seconds (non-isolated), 21 evaluations per flight,
15,419 retained physical nodes, 2,659,779-byte view, .52124170145598 fuel remaining.
This is a finite preparation measurement, not an online service-speed benchmark.

Validation: 194 simulation tests passed; build/typecheck and configured all-file
Ruff formatting/lint/ty passed. Production Chrome checks cover the new direct
flight plus existing atmospheric mission and staging. New checks inspect close
launch/landing, coast, docking, exact frame invariance, scrubbing, and switching
between cached continuous and direct finite worker modes. Initial browser harness
errors (probe property name and range-input numeric spelling) were corrected;
no production workaround was needed. Screenshot inspection is separate from
owner acceptance.

Artifacts: [runtime](direct-surface-runtime.json),
[oracle](direct-surface-oracle.json),
[input](direct-surface-input.json),
[launch](direct-surface-launch.png),
[flight](direct-surface-flight.png),
[landing](direct-surface-landing.png).
The cached exhibit remains available. Next gate: owner flight-shape comparison;
continuous full-leg dispatch and cache design are still separate work.
