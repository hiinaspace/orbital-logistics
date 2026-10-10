# Astra architecture and implementation review

Reviewer: gpt-6-astra, xhigh, native /root/district_review. Read-only source
inspection and bounded experiments, starting at d0436b5.

Recommended a finite spatial Aster mission before moving-Moon ground service.
Atmospheric force, prescribed-leg, entry guidance and recovered-pose functions
already use spatial vectors. New versioned admission should preserve the planar
versions and fixed-primary/z-spin envelope. Keep real latitude and axial spin;
tilting the entire scene including atmosphere would only change coordinates.

Moving Selene introduces body-relative pad position/velocity, release acceleration
relative to the translating Moon, mixed supported/ballistic ports and near-surface
subdivision costs. It is a separate physical seam rather than a fixture change.

The revised authoring approach is acceptable: independent circular insertion
authors station plane/phase, then freezes that rail before production and the
separate oracle. Do not describe it as solving an arbitrary prescribed inclined
rendezvous. A future inclined cache family must account for orbit-plane recurrence
and actual recovered vehicle transport; do not widen PreparedFlight's Bundle
contract to hide aerodynamic physics.

Findings addressed:
- Version membership must compare actual strings, not String(value), which let a
  singleton-array discriminator bypass planar admission.
- Require steering on every spatial mission arc; downstream view sampling owns
  steering-key epochs.
- Require raw surface radius to agree with body radius plus support height.
- Hide/clip the far pole's axial tick for opaque bodies.
- Avoid sphere self-occlusion of surface polygon chords; implementation instead
  uses exact projected arcs and analytic depth clipping.

Review probes: 20,000 hemisphere classifications had no mismatches. Existing
entry/mission/grid focused tests passed. Preparing the old mission as v1 and v2
with latitude0 gave identical leg node states and recovery times. Parent numerical,
browser and owner acceptance gates remain separate.

Final witness review: no blocking findings. Measured pad latitude26 degrees and
station inclination25.997451 degrees, unchanged atmospheric spin[0,0,.03].
Exact retained-state handoffs at separation, both entry starts and deorbit release.
Paid capture position1.78e-10 and delta-v3.32e-10. Default work15590 nodes,
15624 trials,200156 evaluations,15926 display samples,7984206 serialized bytes.
Both recoveries succeed. Independent parent oracle and visual inspection are
separate evidence in the validation report.
