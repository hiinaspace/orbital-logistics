# Flexible maintained service

The user accepted flexible departure/arrival/return schedules and relay dwell on
2026-10-09, favoring an active orbital model set over an industrial wall-clock timetable.
**Orison · flexible service** adds a separate `adaptive-relay-v1` runtime; the prior
maintained, analytical and surface fixtures retain their original semantics.

[Astra brief](brief.md), [review](astra-review.md), [transport](review.log) and
[disposition](disposition.md) precede the coupled implementation. Actual transport:
CLI0.153.4, gpt-6-astra/xhigh, read-only session
01a12184-ddd4-7182-b5b1-34c22a06d96b, exit0. This was architecture review, not a
post-implementation review. [Measured evidence](../../evidence/flexible-service.md).

## Ownership and admission

The station owns its state, engine and tank. A captured visitor contributes its
inert mass, cargo and remaining fuel to station thrust calculations; its own engine
is off. Transfer tops the station tank up to capacity by debiting the visitor exactly.
Total attached mass and position/velocity are unchanged by this transfer. The return
is solved from the actual loaded station's released state and the donor's reduced fuel.
Home refueling uses finite origin stock plus the existing explicit clipped imports.
Fuel burned, fuel delivered and burn delta-v have distinct accounting.

One `coupled-service-v1` JSON plan carries both ordinary finite-flight bundles, the
original numerical owner anchor, a complete frozen station-control chain and ownership
schedule. Reconstruction derives every subsequent anchor, attachment and transfer;
it rejects changed hardware, visitor identity, donor fuel, top-up, incomplete or
changed controls and unsupported times. The plan and capture facts are copied/frozen.
Canonical Runner segments provide station and free-flight dynamics. The paid capture
helper is shared with ordinary Runner operations; no display interpolation or runtime
callback supplies a physical target. A standalone late plan needs its prior committed
prefix: the full-stream oracle starts from original epoch-zero states and verifies
all20 admitted base anchors before comparing early/late flight samples.

Idle commitment is eight units. Tentative controller tails remain private. Admission
promotes the complete funded pair and dependent loaded station future together,
without changing an already committed control block. Ownership changes occur only
in the quiet half of a control block and on the canonical1/256 grid. Burn boundaries
retain their authored fractional epochs. A missed capture, delivery or release stops
at its actual event-left state; conditional future station fuel/mass is not consumed
or drawn. Failed plans retry the next control window. The admitted deterministic
flights already prove their whole powered prefix; demand/rescue routing and new
in-flight disturbances are separate extensions.

## Bounded scheduling family

Cheap prograde Lambert seeds rank departures4–16 units after the current control
anchor,12–16-unit flights and8–40-unit relay dwells, on a half-unit candidate grid.
Near-antipodal geometry uses a tangent Hohmann seed. Seeds are never executed burns.
The eight cheapest outbound schedules guide return ranking; at most four complete
coupled candidates are tried. The search uses the hardware force sphere; the old
maintained domain keeps its inscribed cube. Boundary derivatives use inward feasible
probes. Every complete episode remains within the schema's64-unit duration bound.

Each flight leg permits96 trial evaluations and each controller64. A shared work
budget caps visitor evaluations at768 and controller evaluations at4,224 per
opportunity, including private guide/controllers and failed candidates. Final
reconstruction/proof is separately bounded by the episode/horizon/segment limits.
Candidates must keep successful station control, a.05 visitor return reserve and the
station's.1 maintenance reserve. Routine service rejects node states outside
R1.7–3.4, visitor delta-v above.55 or combined visitor/maintenance burned fuel above.32.
These are declared selection policies; unchanged physical clearance certificates
remain authoritative. Compare proven burn cost, then elapsed time/stable ordering;
stop early for an adequate cost≤.26. This is a bounded near-Hohmann family, not a
global optimizer or a claim that a failed window is impossible.

Temporary candidates release their guide/pre-arrival physics once it is no longer
needed. Candidate composed physics has a220,000-node check; promotion has a180,000-node
check, actual world retention65,000, at most28 drawing chunks/six visits, and each reply
and retained view≤8MB. Those composed counts do not measure V8 transient allocation or
all process heap. At most one accepted-but-inadequate best candidate is retained
while testing the remaining candidates. History remains128 units, forecasts up to40
units; idle forecasts can be shorter. Simulation jobs yield in a worker and hold the
logical head until the next controller/admission is ready. This can slow high-warp
playback without blocking camera controls. Refresh drawing immediately if a newer
head exceeds the previous short forecast, rather than waiting for100ms batching.

## Evidence lifetime and reproduction

This directory is bounded durable design/evidence, not a rolling runtime log.
JSON retains the finite witness, three fixed-control step comparisons,512/1536
summaries, frozen streams, selected dense comparisons and one browser profile.
`review.log` retains the verified reviewer transport with trailing whitespace normalized.
Probe physics matches the preserved fixture; archived top-level descriptions/provenance
use the new coupled domain, with frozen controls/traces unchanged. No recording grows with a live run.

```
node --import tsx docs/design/flexible-service/finite-probe.ts
node --import tsx docs/design/flexible-service/refinement.ts
uv run --project spikes/numerics python spikes/numerics/flexible_service_oracle.py
node --import tsx docs/design/flexible-service/online-probe.ts 512
node --import tsx docs/design/flexible-service/online-probe.ts 1536
node --import tsx docs/design/flexible-service/replay-evidence.ts
uv run --project spikes/numerics python spikes/numerics/flexible_online_oracle.py
```

The longer bounded run takes several minutes on natto. Half-unit schedule resolution,
one coplanar visitor and a prescribed perturber are deliberate slice limits. Physical
station phase remains free: fuel delivery and scheduling adapt to it rather than
silently locking it. Visible cadence/choreography still needs user viewing.
