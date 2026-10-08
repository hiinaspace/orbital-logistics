# Lunar freight experiment — 2026-10-08

The user authorized a bounded lunar freight feasibility experiment after the reviewed
3D foundation, and a prepared set if it worked without an unresolved design decision.
It worked: **Selene · lunar freight** contains three complete depot-to-DRO-to-depot
voyages. [Evidence](../../evidence/lunar-freight.md) records the numerical and resource gates.

## Search and admission

[Declared bounds](experiment.md) preceded the search. The fictional binary and DRO
are inherited from the accepted lunar-loop fixture. This is normalized model content,
not an Earth/Moon mission proposal.

Sixteen outbound seeds vary initial depot phase and flight duration, at one departure
epoch. Two-velocity damped shooting gets at most 64 coast evaluations per seed.
Departure and total delta-v, fuel, clearance and tightening gates admit seven
free-flight rendezvous witnesses. The canonical engine then independently validates
both target and visitor, paid matching, clearance and at least 0.75 units of matched
free flight. Only after that gate did docking support expand.

The three least expensive outbound witnesses seed 48 bounded return searches across
waiting and flight durations. Each admits a complete return after unloading and
explicit finite-stock refueling. The retained programs are static Cartesian impulses
and operations. They are inspectable witnesses, with no global optimality claim.

Retained [input](input.json), [all outbound results](shooting-report.json) and
[all return results](return-report.json) include successful and rejected seeds.
Re-running both Python searches after their final code changes reproduced those
reports byte for byte. Duplicate stdout logs were removed after verification.

## Finite ballistic stations

The new `ballistic-ports-v2` domain accepts a burn-free initial state, epoch, validity
end, integration policy, clearance margin and provenance for each port. For this
slice, all targets must cover exactly the scenario interval. A dedicated canonical
Runner integrates each target in the same field, certifies the full interval with
enlarged safety surfaces, and rejects unsafe or unresolved targets before a voyage
can run. The child Runner has no logistics, preventing recursive target construction.

Capture checks and pays the full relative velocity before attachment. Docked motion
follows the same canonical target provider, and undocking preserves that state.
The target is a freely falling carrier, so constrained dwell grants no maintained
orbit or stationkeeping thrust. The arrival position tolerance is the existing small
attachment approximation. Spatial capture and inclined ballistic dwell/replay have
explicit regression coverage.

The worker emits disposable target drawing samples, including every exact ship event
epoch. View interpolation keeps station icons and docked ships together; the simulation
never consumes those drawing samples. Both orbital and rotating frames remain view-only.

## Content and next choices

Meridian and Nightfall are planet-orbit carriers. Selene Hub follows the DRO. Wren,
Ibis and Plover each deliver 0.16 supplies, refuel from the hub's finite inventory and
return home. The three independently simulated voyages pass combined stock and berth
admission. Their route families and waits create visible choreography without a
runtime scheduler or mandatory authoring UI.

The closer lunar pass in Ibis's return required `h=1/4096`; the set uses that policy
for every ship and station. The independent three-step comparison, pre-attachment
capture residuals and full-trip clearance certificates are retained in the evidence.
The set has a finite 12-unit horizon; Replay rewinds it and its inventories.

The engine is spatial, while this content remains planar in the 2D viewer. Synchronized
analytical views are deferred for user taste feedback. Broader route searches,
maintained stations, real ephemerides, surface facilities and continuous propulsion
remain distinct extensions.
