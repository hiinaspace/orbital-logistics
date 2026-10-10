# Low-orbit shuttle evidence

Fixture: `orison-low-orbit-shuttle.json`. One continuous smoothly steered burn per
flight, Crown radius 1.4, acceleration cap 1.2, force ceiling 32, unchanged tank 6.
The full Orison–Mote field is integrated during both flights; Crown and ground
support are analytical between them.

Offline [variants](../design/low-orbit-shuttle/variants.json):

| Depot radius | Acceleration cap | Burn duration | Delta-v per leg | Round-trip fuel left |
|---|---|---|---|---|
| 1.25 | 1.5 | 1.21640 | 1.82460 | 1.03888 |
| 1.4 | 1.5 | 1.43161 | 2.14741 | .63442 |
| 1.25 | 1.2 | 1.64893 | 1.97871 | .83492 |
| 1.4 | 1.2 | 1.95177 | 2.34212 | .42937 |

The last row is selected for a longer visible gravity turn. These are authored
primary-only seeds; the production four-angle correction uses the full field.

[Runtime evidence](surface-shuttle-runtime.json): 27/31 evaluations, 6,702 retained
physical nodes, 2,080,169-byte view, approximately 1.44sec preparation plus drawing
probe on natto (non-isolated). Final fuel .4293669571043. Dense Hermite flight
drawing differs from physical positions by at most 1.02e-13 in the 1,998-point
probe, approximately 1.02e-7px at maximum zoom. This is finite preparation timing,
not continuous throughput.

Independent original-input seven-state DOP853 replay with steering-knot cuts
agrees to 2.43e-13 position, 3.29e-13 velocity and 1.78e-15 fuel. Oracle tightening
changes sampled states by at most 3.29e-13. Minimum sampled radius exceeds
1.000000999995; production collision certification is separate. Terminal
six-state residuals stay below 1.29e-11, with paid matches and reserve checks.
[Input](surface-shuttle-input.json), [oracle](surface-shuttle-oracle.json).

Focused physical tests exercise sustained thrust, full-field/drawing agreement,
both attachment boundaries, tank accounting and unsupported-domain rejection.
Attitude tests cover exact reversal, short coasts, explicit axes, surface support
and ignition continuity. Browser checks exercise powered flight, reverse scrubbing,
frames, 3D, switching between comparison sets and the original direct-flight
rendezvous ignition. Existing staging and atmospheric mission browser checks
also pass. All 198 simulation tests, four distinct production Chrome checks
(with the direct/shuttle checks repeated after adding ignition assertions),
build/typecheck and configured all-file Ruff-format/lint/ty checks pass.

Screenshots inspected during this pass:
[launch](surface-shuttle-launch.png), [landing](surface-shuttle-landing.png),
[3D](surface-shuttle-oblique.png). Human aesthetic acceptance remains open.

Reproduce:

```sh
uv run --project spikes/numerics python docs/design/low-orbit-shuttle/study.py
npx tsx scripts/surface-shuttle-evidence.ts
uv run --project spikes/numerics python spikes/numerics/surface_shuttle_oracle.py
npm run build
npm run test:sim
PLAYWRIGHT_PREVIEW=1 npx playwright test tests/browser/surface-shuttle.spec.ts tests/browser/direct-surface.spec.ts tests/browser/staging.spec.ts tests/browser/atmospheric-mission.spec.ts --timeout=90000
```
