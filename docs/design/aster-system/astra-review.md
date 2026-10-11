**Proceed with the proposed first slice, with changes to publication, marker anchoring, and performance gates.** A second staged expedition is unnecessary before viewing this composition.

I verified against HEAD `d2a987e`, compared fixtures directly, and ran focused checks across four test files; the command passed in 30 seconds. Bodies, epoch, units, and atmosphere match exactly between staged and Beacon sources. Existing actor/port IDs do not collide. The staged storage figures match retained reports. The independent-oracle and ~59/34 FPS claims have supporting artifacts; I did **not** rerun those measurements. Repository files were unchanged.

1. **Highest priority: define atomic publication, including failure after component advancement.**

   The composition is physically reasonable: `prepareCourier` accepts a scenario, station, and courier definition independently of fleet topology; `OrbiterStream` supplies canonical free flight. Extract a small courier service owning its accounting and drawing cycles, and let `aster-system-v1` own the common publication boundary. Preserve separate clocks *within* that boundary: staged period ≈103.3853, courier period 32, orbiter chunks 8. There is no common repeating cycle to assume.

   The missing contract is what happens when final packet construction fails. [`StagedServiceEngine`](/home/s/code/orbital-logistics/src/staged-service/engine.ts:65) advances resources/frontier before `delta()` checks aggregate limits; exporting prepared cycles also marks them exported before that check. [`LibrationEngine`](/home/s/code/orbital-logistics/src/libration/engine.ts:64) has similar ordering. These are usable components, but their methods are not rollback transactions.

   **Recommended bounded contract:**
   
   - Keep component advancement private; validate courier operations, extend both orbiters, construct drawing data, merge resource anchors, then validate the complete packet.
   - Publish one common frontier only after every component and aggregate guard succeeds.
   - On an unexpected failure, permanently halt that worker generation at the last published packet. Do not retry mutated child engines whose export cursors may already have advanced.
   - Prevalidate frontend ingestion before changing any visible store. Holding only the displayed frontier while partially mutating its backing stores is insufficient.
   - Passive-orbiter faults remain isolated, with explicit validity epochs; test forecast faults, held playback, and frame queries after fault-history eviction.

   **Cheapest falsifier:** force rejection after staged advancement but before publication. Assert unchanged visible frontier, resources, poses, and held history, with no later partial publication.

   Initial accounting must count three staged tanks once, plus Kestrel’s fuel and initial parcel. The stack is an assembly identity, not additional inventory.

2. **Budget the actual composition; inherited limits are not automatically sufficient.**

   The retained measurements give:

   | Physical ownership | Nodes | Serialized storage |
   |---|---:|---:|
   | Staged cache | 100,677 | 30.88 MB |
   | Courier cache | 46,817 | 16.98 MB |
   | Subtotal before orbiters | **147,494** | **47.86 MB** |
   | With both orbiters at their existing retained caps | **187,494** | **63.86 MB** |

   Consequently, Beacon’s 165k-node/60 MB aggregate limits cannot cover the full permitted envelope. **Proposed:** 200k nodes/70 MB for retained physical ownership in this fixed composition, conditional on measuring and separately bounding construction peaks. These are serialized-storage diagnostics, not browser heap guarantees. [`OrbiterStream` limits](/home/s/code/orbital-logistics/src/expedition/orbiter.ts:34)

   Keep staged’s 64 MB cold/48 MB incremental packet limits as initial admission targets, then test the *combined* cold three-cycle packet and coincident cycle arrivals. Do not size from the 27 MB startup packet alone. Count templates, both free-craft drawing arrays, worker/frontend copies, and the held incoming reply explicitly. Existing fleet drawing counters omit the orbiter from their byte total. [`Current accounting`](/home/s/code/orbital-logistics/src/expedition/fleet-view.ts:43)

   Admit the new inclined lunar satellite separately. Existing Wren evidence establishes the provider, not that an arbitrary lunar initial state remains suitable at h=1/256.

3. **Choose fixed epoch markers first; retain arclength markers as a visual refinement.**

   The sliding dash diagnosis is verified: the selected plan begins at the current ship and uses native `[3,5]` dashing. [`Drawing code`](/home/s/code/orbital-logistics/src/main.ts:557)

   Prefer **A**, with nested dyadic epoch grids, bounded density, and the proposed faint support curve. Anchor epochs to a stable mission occurrence or absolute grid; resolve positions through prepared display data, without invoking physics on the main thread. Preserve event sides and break paths across hidden transport, absence, and faults.

   Crucially, do not anchor markers to the reconstructed `v.samples`: it contains moving `oldest`, `cursor`, and `end` samples. [`View reconstruction`](/home/s/code/orbital-logistics/src/staged-service/view.ts:68)

   B can work if cumulative lengths belong to immutable segments and retain their prefix phase through eviction. However, inertial world-arclength spacing does not guarantee pleasing projected spacing in rotating or ship-centered frames. That weakens its advantage over A for this first slice.

   **Gate:** at unchanged frame/zoom, overlapping visible history retains identical marker identities, epochs, and world positions after playback clipping, extension, eviction, and reverse scrub. Camera tracking may move their pixels; it must not select different physical anchors.

4. **Keep Canvas/DOM; make the profile distinguish reconstruction, projection, and rasterization.**

   The existing measurements support a CPU-query optimization benefit, not a GPU bottleneck. Source inspection shows several plausible remaining costs: scanning retained samples per frame, repeated scans per powered arc, per-vertex frame transforms, and rebuilding views/fuel graphs/timelines around 10 Hz. The 0.1-pixel path reduction happens **after projection**. [`Render loop`](/home/s/code/orbital-logistics/src/main.ts:543), [`refreshTraffic`](/home/s/code/orbital-logistics/src/main.ts:131)

   Adopt the proposed viewport/frame matrix, with these refinements:

   - Pin comparable simulation epochs, zoom, CSS viewport, and device-pixel ratio.
   - Add frozen-epoch rendering and separate panel-refresh/path-layer ablations. Bodies-only alone leaves UI reconstruction active.
   - Record mean FPS, p95/p99/max frame gaps, worker turnaround, clone/ingestion time, and buffer depletion. Measure startup and cycle seams separately from steady playback.
   - Keep >30 FPS at 1440 and >24 FPS at 4K as proposed minimums. Reproducible >200 ms stalls require disposition even when average FPS passes.
   - Reduce scanned/projected geometry and repeated reconstruction before migrating renderers. Preserve event boundaries and close-entry shape when decimating display data.

   A 10-second window at 1× need not cross any important seam: choose those windows deliberately.

The seven selectable rows and four ports are sufficient to test the intended variety; they do not represent seven simultaneously independent ships. Keep stage rows, widen labels with nonshrinking width and ellipsis, and preserve existing button identity. The remaining human decision is whether the resulting scene feels sufficiently active—not whether another ground origin must be built beforehand.

