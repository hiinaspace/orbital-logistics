# Full Aster–Selene service

The first combined exhibit reuses the refined staged mission, adds the funded
Haven–Beacon lunar courier, and integrates Wren plus a new inclined lunar satellite,
Solace. Cairn, Tranquility, Haven and Beacon are distinct exclusive terminals.
The seven selectable lanes include the launch assembly; they are not seven
independently fueled vehicles. Prepared routes keep their original physical field,
controls and ownership. There is no fleet optimizer or new demand economy.

`aster-system-v1` is a separate strict composition. A single StagedServiceEngine
owns the three physical staged tanks and their prepared mission. CourierService,
also used by the existing Beacon exhibit, owns its paid flight cache and funded
parcel/refill facts. Two OrbiterStreams own eight-unit canonical free-flight chunks.
The staged period (~103.3853), courier period (32), and orbiter chunk period (8)
remain independent. They share a publication frontier, not a repeating common cycle.

Advancement is private until all components, complete drawing rows, resource
anchors and aggregate guards admit. Unexpected rejection permanently poisons that
worker generation; mutated child export cursors are not retried. The UI keeps the
last published packet, plays out its available buffer, and reports the stop. A
passive orbiter fault stays isolated, with an explicit last valid epoch that remains
invalid for subsequent physical/frame queries after its history is evicted.

Frontend ingestion forks the staged/courier container maps, prepares orbiter rows
and resource anchors, checks component and combined retained sizes, then swaps the
complete candidate. Rows/templates are immutable shared data. A held incoming reply
preserves the old playback anchor; Live releases it. Retention remains 128 units
with 32 units of prepared lead and one outstanding worker request.

Limits for this fixed composition:

| Ownership | Limit |
|---|---:|
| Retained physical nodes / serialized storage | 200,000 / 70 MB |
| Private construction nodes / serialized storage | 220,000 / 80 MB |
| Cold / incremental packet | 64 / 48 MB |
| Drawing rows, excluding reusable templates | 275,000 / 96 MB |
| Retained free-craft rows | 11,000 / 4 MB |

Templates are accounted separately (~15.95 MB). Both worker/frontend drawing
copies and the single incoming packet have bounded owners; these serialized counts
are diagnostics, not promises about JS heap size. Existing individual component
limits still apply. The cold three-cycle witness includes all templates and rows.

The selected planned line uses fixed absolute dyadic epoch markers and a faint
continuous support curve. Playback clipping never resets their phase. Visibility
and pose come from the prepared provider at each marker epoch, including reassembly,
hidden recovery and event-right state. Zoom chooses a nested density grid; drawing
never invokes propagation. At most 4,096 marker intervals are considered, with a
floating-point allowance at the 32-unit display span. Camera tracking can change
pixels without changing the physical anchor.

Timeline labels have a nonshrinking single-line column, narrow-screen ellipsis and
full-name tooltip. Existing row/button identities and the bounded scrolling panel
are preserved. Stage burns remain on their physical actor's lane.

Production profiling retains Canvas2D/DOM/SVG. One-draw camera projection snapshots
axes once; ordered staged drawing rows merge without Map/sort reconstruction;
immutable free-craft rows cache their serialized size instead of reserializing on
every panel refresh; wholly offscreen segments skip path/occlusion work with a
stroke/miter margin. `window.orbitalProfile.start()/stop()` is an opt-in bounded
presentation diagnostic and has no simulation authority.

See [review disposition](disposition.md), [implementation review](implementation-review.md)
and [validation](../../evidence/aster-system.md).
