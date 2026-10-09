**Proceed with the assigned-relay topology and a small, separate network runtime.** It is a useful hobby-prototype slice. The main gaps are atomic publication across yielded work, per-station fault validity, and enforceable aggregate storage bounds.

The review supports these dispositions; it does **not** establish that two lanes fit the proposed performance envelope.

**Evidence audit**

- **Verified — source:** the existing domain explicitly requires one visitor, two stations and single berths. Reusing its physics components is reasonable; composing two complete engines would preserve separate inventories and frontiers. [Validation](/home/s/code/orbital-logistics/src/maintained/world.ts:23), [engine ownership](/home/s/code/orbital-logistics/src/adaptive/engine.ts:20).
- **Verified — source:** planning uses an 80-unit guide, at most four coupled candidates, paid captures, and loaded-station reconstruction. `AdaptiveWorld.fork()` shares chunk objects; `CoupledTrip` also constructs private replay worlds. Those are materially different storage cases. [Planner](/home/s/code/orbital-logistics/src/adaptive/planner.ts:11), [fork](/home/s/code/orbital-logistics/src/adaptive/world.ts:23), [reconstruction](/home/s/code/orbital-logistics/src/adaptive/plan.ts:44).
- **Verified — fresh checks:** the existing adaptive runtime test file passed. A read-only startup probe took 257 single-work-budget calls; its two longest calls were approximately **513 ms and 511 ms**. A generator-work count therefore does not bound responsiveness. The constructor drains replay generators synchronously. [Proof work](/home/s/code/orbital-logistics/src/adaptive/plan.ts:49).
- **Verified — retained artifacts:** seven schedules match the older replay; the current report records 3,000 trial evaluations and the oracle records 14 captures through 528. **Unverified here:** reproducing those historical numerical/browser results, the intermediate 8,876 comparison, and current preview/browser state.
- **Unknown:** second-relay phase feasibility, two-lane 1× performance, and compliance with 400k/140k/16MB limits. The existing browser measurement tracks a published clock updated around 100 ms; it does not establish smooth frame presentation. [Measurement method](/home/s/code/orbital-logistics/tests/browser/planning-throughput.spec.ts:14).

| Decision | Disposition | Required action |
|---|---|---|
| Three stations, two fixed assignments | **Adopt** | Keep identical existing hardware and one shared Mote field. Select the second phase through a finite numerical witness. Do not require simultaneous initial departures. |
| Runtime reuse | **Adopt with a narrow seam** | One network engine owns the actual frontier, hub ledger and publication. Two lane records own visitor lifecycle; each relay owns its physical stream. Reuse planning/dynamics, without extracting a general scheduler framework. |
| Commit/yield semantics | **Adapt — resolve before implementation** | Preparation returns private results. One synchronous commit publishes the entire epoch. Accept that a bounded planning barrier can delay the common head in wall-clock time. |
| Reservations and fuel | **Adopt arrival-before-refuel** | Two ships and two hub berths remove the need for speculative arrival allocation. Debit actual stock at service completion; an unfunded ship stays attached and retries. |
| Forecast sharing | **Adapt** | Share sealed canonical hub intervals. Keep loaded relay forecasts owner-specific. Namespace all station chunks, events and episode IDs. |
| Failure isolation | **Adapt — view changes required** | Represent validity separately for each failed ship/station. Healthy lanes continue; invalid station futures disappear without globally truncating their history. |
| Storage and speed limits | **Provisional** | Keep the proposed numbers as acceptance targets. Measure and enforce them across all owners, speculative work and held display data before claiming support. |

The concrete commit contract should be small and explicit. At epoch `t`, derive a private transaction from committed state: apply clipped imports once, process due physical facts and service completions in a documented stable order, then prepare eligible new admissions against that resulting loadout. Yield during solving and proof. Before publication, check that each result still matches its visitor loadout and frozen station prefix. Finally install the resource anchor, ownership transitions, accepted plans, event cursor and frontier together, without yielding.

A failed candidate becomes a bounded retry outcome within that transaction. An unexpected invariant failure stops at the last published state. **Do not let lane A’s preparation mutate public state before yielding to prepare lane B.** The current single-lane promotion mutates its engine directly; wrapping that lifecycle twice is insufficient. [Current promotion](/home/s/code/orbital-logistics/src/adaptive/engine.ts:33).

For this prototype, keep that deterministic barrier. The brief’s promise that retries “don’t stop independent established journeys” should mean **they do not invalidate those journeys**, not that another lane’s planning can never delay publication. Avoid wall-clock admission deadlines, which would make results depend on machine speed. Split reconstruction/proof between canonical blocks or legs so a nominal yield budget does useful work.

Forecast ownership and storage need these specific rules:

- One hub provider owns a canonical eight-unit interval chain. Share only completed intervals through a read-only sampling interface. Keys must cover the model/body field, original chain identity, exact anchor, interval, grid and safety policy—not merely epoch and step.
- A relay’s promoted controls and ownership events remain immutable. An unloaded guide is a private planning aid; it cannot replace the loaded station’s future.
- Represent a reservation as `{stationId, shipId, tripId, capture, release, forecastIdentity}` with half-open occupancy `[capture, release)`. Fixed assignments need no general reservation solver.
- Namespace chunk identities by owner. Existing chunks use `t/8`, and the view merges by that ID; combining two streams unchanged would overwrite one. [Chunk creation](/home/s/code/orbital-logistics/src/adaptive/world.ts:57), [view merge](/home/s/code/orbital-logistics/src/adaptive/view.ts:25).
- Run **one expensive speculative planner at a time**, alongside at most two admitted episodes. Count unique shared Runners once, but include private guides, retained best candidates, solver trials and reconstruction copies. Release rejected candidates promptly. The current candidate check occurs after construction, so it is not a hard peak-allocation bound. [Current check](/home/s/code/orbital-logistics/src/adaptive/plan.ts:108).

For fuel, no future hub-stock reservation is necessary: the round trip already proves an affordable return before departure. On returning, attachment may precede fuel availability. Retry at a fixed cadence, preserving paid fuel and berth occupancy; “bounded retry” must mean bounded work, not guaranteed eventual supply. Keep station tanks outside the hub inventory, and count attached visitor fuel once even though it contributes to station thrust mass.

Failure isolation requires more than changing `halt` into a lane flag. The current view globally truncates on halt, while station rendering requests a position at the current epoch. [Global truncation](/home/s/code/orbital-logistics/src/adaptive/view.ts:24), [station rendering](/home/s/code/orbital-logistics/src/main.ts:482).

Use explicit per-owner validity:

- An outbound failure invalidates the station stream from its first unmet attachment dependency.
- Failed transfer or release stops dependent station evolution at that event’s left state.
- A visitor failure after successful release does not invalidate independent station maintenance.
- A common hub-trajectory failure is a shared dependency failure.

Retain last-known markers, but reject later physical queries and reference-frame use. Show unresolved fuel as last-known inventory, not a current physical measurement.

The evidence gates should run in this order:

1. **Finite two-lane witness:** both relays receive positive funded top-ups and perform loaded maintenance; both visitors complete paid returns; flights visibly overlap. Propagate both stations in the unchanged common field.
2. **Actual competition:** force simultaneous refuel requests with enough stock for only one. Verify deterministic allocation, one debit/import stream, shortage recovery and unchanged already-admitted flights.
3. **Yield/cache equivalence:** compare cache enabled/disabled, different request sizes and work budgets, and reordered input arrays. Inspect every yielded packet for partial publication—not just final equality.
4. **Fault dependency matrix:** fail capture, transfer and release in either lane, including alongside another lane’s same-epoch event. Verify continued healthy progress, preserved paid prefixes, station-marker validity and historical scrubbing.
5. **512-unit accounting/oracle:** replay from original anchors with one shared hub and both loaded station streams. Independently check resource transactions and event-left/right states as well as trajectories. Exercise eviction and worst-case candidate retention.
6. **Production playback:** establish 1× first with 32-unit lead and 128 total retention. Measure throughput, underflows, actual frame gaps, interaction latency and storage peaks. Attempt 2× afterward; retain a short human viewing gate for cadence and smoothness.

**Blockers:** specify the atomic commit boundary and per-owner failure-validity contract before implementing the runtime. The second-phase witness and measured storage/performance envelope block acceptance, not initial development. No further human architecture decision is necessary.

I edited no files and spawned no reviewers. New untracked network implementation files appeared during the pass; this review covers the brief and cited `e44f76b` baseline, not that concurrent implementation.
