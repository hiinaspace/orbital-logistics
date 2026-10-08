# Continuous analytical traffic

User-authorized 2026-10-08 after acceptance of bounded propulsion. The Astra senior
review is complete: [verified brief](brief.md), [report](astra-review.md),
[transport](astra-transport.json), [disposition](disposition.md).
Actual CLI transport was gpt-6-astra/xhigh, exit0. This reviewed architecture before
implementation; it is not a final-diff audit.

## Runtime ownership

`TrafficEngine` owns global time, per-ship route occurrence/stage, shared station
stocks, atomic services, actual external imports/exports, cumulative paid fuel,
retry windows and fault commits. It receives no DOM, worker, rendering or wall-clock
input. Exact event batches use configured ship order and do not yield halfway.
`advanceTo` yields between batches/grid epochs under a bounded work count.

`Runner` owns a finite local flight episode, from actual serviced departure loadout
and source rail state, without an artificial initial docking pair. Its entire
accepted prediction is computed before departure. Facts become actual only when
the fleet reaches their epoch. Original local event timestamps accompany global
ones, including exact capture; the local horizon is padded to the grid. Capture
success is distinct from the legacy puzzle objective. Local station inventories
never merge into fleet stocks. Finishing a flight commits its usage once.

The dispatcher uses two independently witnessed powered transfer templates in a
fixed-primary, coplanar prograde two-station system. It computes the next integer
synodic window from a reference epoch, rotates the inertial thrust directions, then
revalidates the generated flight with the canonical Runner. It is not a new shooting
optimizer. Failed admission or stock shortage retries a strictly later window;
unsupported loadouts/domain become unavailable. A flight fault freezes a last-known
marker and isolates that ship. Shared invariant/worker failure pauses the run.

Finite station buffers have signed anchored flows. Anchor imports cargo/fuel; Kiln
exports cargo and imports fuel. Only actual accepted import/export counts at full or
empty buffers. Those external boundaries are explicit supply assumptions, not a
manufacturing, stationkeeping or closed-economy simulation. Services recheck and
atomically debit/credit stocks at completion. A retry after completed service keeps
its real loadout.

## History and playback

The worker retains128 time units of1/16 drawing-grid frames, exact left/right event
states, a left resource-flow anchor, bounded event/admission metadata and one active
canonical Runner per ship. The main thread receives incremental upserts with an
eviction watermark and allows one outstanding request, limited to1 time unit ahead.
The worker advances at most128 grid/event batches per reply. CPU yielding is not a
ship failure. The tested calendar ceiling is1,000,000.

The main display store contains disposable views, not restart checkpoints or fake
physics horizons. The cursor can inspect retained past; a projection only uses
plans that had been admitted by that cursor epoch. Future accepted flight segments
are shown, but unplanned later service/departure is not invented. Forecast extends12
time units beyond the acknowledged head; only committed history is scrubbable.

Pause freezes the cursor immediately and stops new requests. One pending bounded
reply may acknowledge a newer held head; main-thread eviction is deferred so it
cannot erase the inspected cursor. Play replays history with the engine held until
catching the head. Live jumps to the acknowledged head and resumes advancement.
Restart makes a fresh seeded world and generation; switching sets terminates the
old worker. Hiding the tab pauses and discards wall-clock debt. History is memory
only; reload starts anew. Faulted ships have no reference-frame origin after their
last-known epoch, and no invented continuing trail.

## Evidence and extension seam

[Implementation evidence](../../evidence/continuous-traffic.md) covers rolling
retention, conservation, retries, real paid failures and later-window independent
DOP853 replay. [Template probe](template-probe.md) preceded the implementation.

A future dispatcher can choose new routes/loadouts/windows, while preserving the
admitted-episode/fleet-commit boundary. Lunar continuation, maintained stations,
stationkeeping triggers, rescue/fuel handoffs, demand routing, persistence and a3D
camera remain separate slices. No runtime state is reconstructed from display
interpolation.
