# Continuous whole-flight shuttle evidence

The single-primary analytical service reuses both complete accepted gravity
turns. Canonical integration occurs once per route family; each occurrence
rotates the full flight and pays its actual phase capture.

The1024-unit two-ship rollout completes82 flight legs per ship (41 round trips),
delivers4.1 supplies and has no planning, control, arrival or resource faults.
Cache entries plateau at two;164 reuse hits;6577 physical nodes remain resident.
Peak retained drawings48072/65536, assembled view6,511,266/8,000,000 bytes.
An eight-unit batched incremental delta peaks4,567,925 bytes. Resource balance
errors: fuel4.27e-13, cargo1.50e-14. Runtime records explicitly separate serialized
owned cache data7,601,088 bytes from unmeasured JavaScript heap allocation.

Cold preparation/admission of both references measured232.4ms. Warm occurrence
admissions measured.262–.519ms in six representative cases. An eight-unit batch
can also include dense drawing construction; its measured maximum386.7ms is
recorded separately. These are non-isolated natto observations, not a guarantee
for arbitrary networks.

Independent original-bundle DOP853 replays both routes at first,512 and near the
million-unit calendar limit. Position agreement<=1.34e-10, velocity<=2.09e-10,
fuel<=1.35e-11; oracle refinement<=3.15e-13. Minimum sampled radius
>=1.00000099999989; normal Runner clearance certification remains authoritative.
The oracle explicitly treats the private negative pad prelude as supported and
starts free flight at local zero. An initial oracle run incorrectly integrated
that support interval as free fall; fixing this independent setup resolved its
.004-state discrepancy without changing production physics.

At1024 drawing samples/unit, the off-grid Hermite position probe differs from
physical positions by<=1.28e-13 and velocity<=1.02e-9. Inertial, surface-rotating
and Crown-rotating chord probes stay within.203px at maximum zoom. Tests separately
cover rebuilt historical cursor/trail-cut brackets for both ships. Older queries
through the latest assembled scene remain coarse; seek rebuilds local precision.

Production Chrome2x observation advances at1.9978x over20.04seconds, maximum
animation-frame gap16.8ms. The browser also checks pause acknowledgement, scrubbed
launch/landing, frames,3D, smooth physical powered axes, return-to-live and switching
between finite/cached sets. Screenshots were inspected.

[Runtime](shuttle-service-runtime.json), [input](shuttle-service-input.json),
[oracle](shuttle-service-oracle.json), [browser timing](shuttle-service-playback.json),
[launch](shuttle-service-launch.png), [landing](shuttle-service-landing.png),
[network view](shuttle-service-network.png).

All203 simulation tests and20 distinct production Chrome checks pass (new live
set, finite comparison, existing traffic/viewer cases); the new live check is
repeated. Build/typecheck and configured all-file Python hooks pass. Human visual
acceptance of repeated flights remains separate. Maintained/perturbed targets
and larger networks are not yet covered by this exact rotational cache.

Reproduce:

```sh
npx tsx scripts/shuttle-service-evidence.ts
uv run --project spikes/numerics python spikes/numerics/shuttle_service_oracle.py
npm run build
npm run test:sim
PLAYWRIGHT_PREVIEW=1 npx playwright test tests/browser/shuttle-service.spec.ts tests/browser/surface-shuttle.spec.ts tests/browser/traffic.spec.ts tests/browser/viewer.spec.ts --timeout=90000
```
