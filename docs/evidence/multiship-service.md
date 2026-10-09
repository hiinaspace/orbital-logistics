# Maintained multiship exhibit — 2026-10-09

User-authorized continuation after the faster flexible-service slice, with one
Astra senior architecture review. [Brief, transport and disposition](../design/multiship-service/README.md).
The review verified the baseline and identified atomic publication, owner validity
and aggregate speculative storage as requirements; it is not a final code audit.

## Implemented contract

**Orison · relay network** has Equator (ballistic, two berths), Meridian and
quarter-phase-offset Solstice (independently paid maintained relays), and Tern/Ibis
assigned respectively to those relays. Existing Orison/Mote gravity, hardware,
clearance, capture tolerances and economical transfer family remain unchanged.
Each relay still has one assigned visitor; this is not arbitrary multi-visitor routing.

`maintained-network-v1` owns one actual frontier, finite depot stock and clipped
import/debit anchor. Private transactions process physical facts, stable-identity
refuels, then sequential bounded admissions. Only a complete epoch installs its
resources, plans, owner streams, event cursors and head. An unmet refuel stays attached
and retries after eight units. The two-berth hub needs no speculative fuel allocation.

`coupled-service-v1` still proves both finite legs, paid captures, actual captured
mass, exact donor debit/top-up and the loaded station controls together. Its network
proof yields between canonical blocks/legs. Sealed ballistic hub intervals use
exact full-bundle/anchor/field/policy keys; the cache is bounded to24 entries.
Station streams have explicit owner identities and ship-namespaced episode/control
IDs. No display interpolation enters any physical target or propagation origin.

Transient accounting deduplicates shared Runners and includes registered committed/
private owners, retained best trials, reconstruction copies, scratch pieces and
conservative solver/allocation allowances before allocating. Rejected scopes release
promptly. Guards are400,000 transient and140,000 retained physical nodes,16MB serialized reply/
held rows, bounded episode/chunk/frame history,32 committed lead and128 total
retention. The calendar stops at10,000 units. Unexpected invariants stop at the last
published head. These are enforced bounds, not device-independent performance claims.

Coupled capture/transfer/release faults stop the affected visitor/station at event-left,
without ghost mass or fuel credit. The other assignment continues. The stopped owner
keeps one terminal chunk/marker even after its epoch leaves retained history; later
physical/frame queries reject. Its comparison marker cannot request a nonexistent
future. General free-flight fault recovery and shared-relay queues remain later work.

## Numerical evidence

- Finite phase probe160: both offsetsπ/π/2 work in the unchanged field. Quarter-offset
  Ibis starts at14 rather than23, has two failed planning epochs rather than four,
  and lower visitor burn (.4474 versus.4703). Total visitor+station burn is nearly
  identical; phase choice prioritizes staggered cadence, not global optimization.
- Final actual512 rollout: seven admitted pairs per lane, six paid returns per ship
  (twelve total), fourteen positive funded top-ups in the admitted programs, thirteen
  bounded failed opportunities/retries and zero failed station controls. Outbound
  flights overlap14–20; first inbound flights overlap45.5–52.5. Actual maintenance
  fuel delivered by512 is.72530549. [Programs/controls/resources](../design/multiship-service/replay-512.json).
- Recorded retained peak122,985 physical nodes, conservative transient peak260,959;
  cache2,283 hits/68 misses. Maximum incremental packet3,969,983 bytes; full retained
  snapshot9,464,333 bytes. The512 run's wall time includes overlapping verification
  work and is not the playback performance witness.
- Independent original-anchor DOP853 replay integrates each physical lane in the
  same prescribed field through528/536, with every admitted paid capture and funded
  mass transition checked. Dense early/late visitor samples and all station/base
  anchors compare with canonical execution. A separate independent chronological
  ledger allocates actual refuels from one hub stock/import stream. Maximum compared
  visitor/station state differences are4.88e-11/1.10e-11; refinement4.19e-10. Shared resource
  error8.74e-11; aggregate fuel-balance error4.00e-15.
  [Oracle](../design/multiship-service/oracle.json),
  [input](../design/multiship-service/oracle-input.json).
- Cache disabled, reversed fixture order, irregular requests and small work yields
  preserve plans, current physical states, events and resource anchors. Every inspected
  yielded packet has coherent lane frontiers and no premature event/admission/stock.
- Simultaneous mirrored return requests with only one funded refuel allocate to Ibis
  by stable identity; Tern stays attached, receives no ghost credit and later recovers
  from the same import stream. Earlier flights remain admitted.
- Capture/transfer/release failures in either lane preserve event-left fuel, stop only
  the dependent pair and permit healthy repeat service. A new view created at224
  after Tern's t=20 fault has left history still retains its explicit terminal marker
  and rejects a later station-frame query.

## Browser and verification

Production installed-Chrome tests validate both lanes, maintained inspector/timelines,
shared stocks, selection, Follow/frame changes, exact held poses, scrubbing/live,
set-specific speed clamping and fixed/continuous set switches. A real runtime fault
packet is also presented to the UI: inspector/marker remain usable, the invalid frame
is disabled, and scrubbing before the fault restores it. Browser regression exposed
and fixed the selected failed station's future comparison-marker query; a subsequent
harness assertion uses the actual native option.disabled property.

The full simulation run passed168 checks. Final focused definition/runtime checks
include one additional allocation-before-limit guard and late-fault retention, giving
169 distinct numerical checks. Full browser34 passed/3 optional skipped/1 identified
fault-display failure, then the corrected fault case passed separately (35 distinct
regular checks). Build/typecheck and Python Ruff-format/lint/ty hooks pass.

Isolated installed-Chrome production playback on natto (Ryzen7 7840U):

| Display rate / through | Effective rate | Worst actual-frame gap | p95 / p99 gap | Minimum execution lead | Buffer underflows |
|---|---|---|---|---|---|
| 1× / 160 | 0.9996× | 66.7ms | 17 / 33ms | 26.92 | 0 |
| 2× / 512 | 1.9997× | 50.1ms | 17 / 33ms | 17.77 | 0 |

Startup is6.5–7.0s including scene loading/priming. Layer-toggle handlers measured
1.3ms while the planner was pending; this is synchronous handler duration, not an
end-to-end input-latency claim. The actual display-epoch probe runs at animation-frame
cadence, separately from the100ms published inspector clock. Workload, storage and
planning frames are recorded in [1× measurement](../design/multiship-service/browser-160.json)
and [2× measurement](../design/multiship-service/browser-512.json). No concurrent owned
numerical/reviewer workload ran during these performance witnesses. View data at
measurement endpoints is8.85–9.49MB; worker/display guards remain enforced.

The new set is capped at2×; flexible single-visitor service retains4× and prepared/
analytical/surface sets retain16×. Both long playback cases passed, bringing the
browser checks to35 distinct regular plus two isolated performance witnesses. This
is a measured envelope for this fixture/host/browser, not a promise for arbitrary
future fleets or slower devices.

## Reproduction and limits

```sh
node --import tsx docs/design/multiship-service/rollout.ts 512
uv run --project spikes/numerics python spikes/numerics/network_service_oracle.py
node --import tsx --test tests/sim/network-definition.test.ts tests/sim/network-runtime.test.ts
PLAYWRIGHT_PREVIEW=1 npx playwright test tests/browser/network-service.spec.ts
NETWORK_RATES=1 NETWORK_THROUGH=160 PLAYWRIGHT_PREVIEW=1 npx playwright test tests/browser/network-service.spec.ts --grep 'measure actual'
NETWORK_RATES=2 NETWORK_THROUGH=512 PLAYWRIGHT_PREVIEW=1 npx playwright test tests/browser/network-service.spec.ts --grep 'measure actual'
```

The new scene is planar, viewed through the existing orthographic3D controls. The
massive field remains prescribed; no mutual station/ship gravity or collisions are
claimed. Cargo .05 stays aboard; this service delivers stationkeeping propellant.
More actors/fields/routes, rescue/demand dispatch, persistence and staging are separate
slices. Human viewing of cadence/readability remains the next taste gate.
