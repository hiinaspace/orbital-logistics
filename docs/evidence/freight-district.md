# Freight district and northern shuttle evidence

Astra senior review: ../design/freight-district/astra-review.md.
Committed artifacts distinguish independent numerical checks, runtime bounds,
browser checks and subjective viewing. Owner viewing of these new sets is pending.

## Numerical and logistics checks

freight-district-input.json contains eighteen cached district occurrences
(six routes at early,512-unit and near-calendar-limit windows) and the two
spatial northern flights. freight-district-oracle.json replays all20 using
independent seven-state DOP853 with separate rail geometry and steering law.

Maximum differences across those cases:
- Position2.965e-10, velocity1.320e-10, fuel6.099e-11.
- Oracle tolerance refinement2.006e-13.
- Full six-state terminal target error3.035e-10.
- Sampled radius stays above1.0000009; canonical interval collision certification
  remains a separate production check.

The finite witness performs ordinary loading, launch, paid docking, unloading,
refuelling, undocking and landing. Landing residual is1.823e-10 position and
1.281e-10 velocity; fuel remaining.428234. Latitude stays20degrees on support,
and its inclined orbit/flight have nonzero z position and velocity. Tests cover
high-latitude marginal-thrust rejection, old-version rejection, exact attachment,
physical thrust attitude, replay snapshots and cache misuse on inclined targets.

## Runtime

freight-district-runtime.json records1024 simulated units:
- Completed legs Tern82, Ibis45, Wren63.
- Crown unload2.05; terminal delivery1.375 (.575Meridian,.8Lantern).
- Two initial stock waits; zero flight-planning, fault or unavailable failures.
- Six immutable references,10897 physical nodes,10688322 serialized owned bytes.
  Limits six/16000/12MB; serialized diagnostic size is not JS heap usage.
- Retained drawing peak16510 rows within65536.
- Assembled view peak4930859bytes; eight-unit delta peak3067172bytes.
- Fuel balance error5.685e-13, cargo1.444e-15.
- Cold six-family preparation281.6ms; warm occurrence admissions.280–.720ms.
- Largest eight-unit advance343.7ms, including dense drawing construction.
  These timings are from the authoring host, not universal browser guarantees.

freight-district-capacity.json extends operation to2048 units. Crown reaches its
full1-unit capacity by1536. Stock pressure causes17 resource waits; all ships
continue afterward, reaching149/90/127 completed legs. No flight failure occurs.
Fuel balance remains5.685e-13 and cargo2.998e-15; drawing peak remains16510.
Stopping ground supply exhausts onward deliveries; a missing freighter capture
keeps its cargo on the failed ship while Tern and Wren continue. Different work
partitions produce identical snapshots. Exact-window/refuelling regressions
cover the floating-point schedule defect found by review.

Reproduction:
- node --import tsx scripts/freight-district-evidence.ts
- node --import tsx scripts/freight-district-capacity.ts
- uv run --project spikes/numerics python spikes/numerics/freight_district_oracle.py

## Browser and presentation

29 production Chrome browser checks passed across the new district/latitude
sets, previous cached/finite flights, traffic, viewer, camera, tracking and
steering. The new live check measures18 seconds each at1x and2x:
- Effective playback.99973x and1.99963x.
- Largest measured animation frame gap16.8ms at both speeds.
- Shared destination cargo, all six references, pause with pending reply, old
  cursor scrub, frame invariance, live resume and cross-domain switches passed.
- Northern launch/landing are visible in3D and close tangent views; supported
  rocket/pad normals use actual latitude.

Screenshots were inspected by the parent: freight-district-network.png,
northern-shuttle-3d.png and northern-shuttle-landing.png. Additional launch views
are retained. These checks do not substitute for the owner's aesthetics review.


## Final regression gate

Build/typecheck, all209 simulation tests, all29 selected production browser
checks and numerical Ruff/ty checks pass. A pre-existing attitude unit fixture
was completed with real support geometry after the new normal helper exposed
its missing radius/center fields. Historical test screenshots/metrics were
restored; only new-slice artifacts are retained.
