**Recommend proceeding with two views of one session, after tightening the publication and interaction contract.** Keep the existing numerical domains and renderer. Move lifecycle and performance gates ahead of the two-pane release.

Reviewed checkout `7e9936b`, the relevant source, profiling harness and recorded baseline. Transport metadata confirms `gpt-6-astra`, high effort. No implementation, file edits, additional reviewers or numerical rollouts were performed. Performance figures below are audited records, not fresh measurements.

1. **Highest leverage: separate session publication from presentation—not just globals into classes.**

   The proposed ownership split is correct, but rendering currently performs state transitions: `draw()` changes invalid reference frames and updates tracking; `updatePanels()` also changes frames. Selection silently retargets Follow/Chase. These responsibilities must become explicit before duplicating views. [Drawing behavior](/home/s/code/orbital-logistics/src/main.ts:543), [panel behavior](/home/s/code/orbital-logistics/src/main.ts:353), [tracking](/home/s/code/orbital-logistics/src/main.ts:219).

   A further constraint: a display snapshot is not necessarily reusable until the next worker reply. `TrafficViewStore.view(cursor)` filters plans by their admission epoch and constructs cursor-dependent history and forecasts. **“Same worker revision” is insufficient as a display-cache key.** Preserve each adapter’s cursor/visibility rules. [Store queries](/home/s/code/orbital-logistics/src/traffic/view.ts:36).

2. **Performance evidence supports investigation, but not a specific rendering diagnosis.**

   The baseline compares plain **Top** against relief **3D**: enabling relief changes camera orientation. It also samples different epochs sequentially. This is a useful experience comparison, not an isolated relief-cost experiment. [Harness](/home/s/code/orbital-logistics/docs/design/viewer-polish/profile.mjs:12), [toggle behavior](/home/s/code/orbital-logistics/src/main.ts:799).

   Two consequential findings:
   - Relief already caps its backing surface’s longest dimension at **1024 pixels**. “Use lower-resolution relief” is partly implemented already. The full-resolution foreground and compositing remain separate costs. [Relief allocation](/home/s/code/orbital-logistics/src/view/relief.ts:60).
   - Full-system `refresh` reaches **10.9 ms p95 at 4K**, alongside **9.1 ms draw p95**. These percentiles cannot simply be added, but reconstructing history/timelines can independently consume substantial frame time. Extract and measure this work once per session, not once per pane. [Baseline](/home/s/code/orbital-logistics/docs/design/viewer-polish/baseline.json), [refresh](/home/s/code/orbital-logistics/src/main.ts:176).

   GPU/compositor attribution remains unknown. Neither a DOM-framework change nor a renderer migration is justified.

3. **Disposal is a prerequisite for multiview.**

   `PotentialLayer` owns a worker, patches and relief renderer without a disposal API. `ReliefRenderer.hide()` shrinks its surface but retains buffers/program/context ownership. That is tolerable for one persistent instance; copying the lifecycle into removable panes is insufficient. [Potential ownership](/home/s/code/orbital-logistics/src/view/potential-layer.ts:9), [relief ownership](/home/s/code/orbital-logistics/src/view/relief.ts:31).

   Add explicit close/dispose semantics and aggregate accounting before enabling pane duplication. Initially, two bounded instances are simpler than a shared GPU renderer or general cache scheduler.

4. **Separate the catalog/loading boundary early; keep curation independent of architecture.**

   The eager fixture imports, inline workers and unconditional startup substantiate the proposed landing boundary. [Imports](/home/s/code/orbital-logistics/src/main.ts:66), [startup](/home/s/code/orbital-logistics/src/main.ts:906).

   A metadata-only catalog should serve both the library and landing page. Keep loaders separate so descriptions cannot accidentally pull simulation code into the landing bundle. Initially split the viewer and existing worker bundles; per-domain worker fragmentation can follow measured download or preparation costs.

   The proposed **20 normal / 23 Studies** allocation remains an editorial hypothesis. Do not equate “finite” or “older” with superseded. Search should find Studies without requiring users to expand the group first.

The most consequential decision needs the following worked contract.

| Owner | Owns | Boundary |
|---|---|---|
| `SceneSession` | Domain adapter/store, generation, worker sequencing, playback cursor, frontier, held history, events/resources | Only owner allowed to ingest, request advancement, release history or restart |
| `Viewport` | Frame, camera, tracking target, selection, layers, labels, hits, field resources | Reads session publication; cannot advance or retain independent simulation history |
| `Workspace` | One/two-pane layout, active pane, shared inspector/timeline, rendering budget | Routes commands and schedules one shared frame |

**Publication and drawing**

- At each workspace frame, advance playback once and acquire one coherent presentation packet: scene publication identity, cursor, frontier/history bounds and event/resource queries.
- Both panes consume that packet. A worker reply must never become visible to only one pane.
- Reuse scene descriptors according to the adapter’s existing freshness rules. Do not rebuild `view(cursor)` at 60 Hz merely because the API says “snapshot”; equally, do not reuse it across cursor-dependent admission boundaries incorrectly.
- Resolve unavailable frames and tracking targets before rendering. Drawing may update disposable labels/hit caches, but must not change selection, frame, playback or simulation state.
- Share frame-independent sampling. Projection, relief deformation, occlusion and labels remain pane-local. Every historical vertex retains its own epoch.
- Preserve the existing finite/continuous distinctions, including pending replies while paused, fault validity and known-at forecast visibility. A common adapter should expose these differences rather than silently normalize them.

**Selection and focus**

- Activate a pane on pointerdown or focus entering that pane, including its controls. Pointer traversal and hover do not activate it.
- Wheel zoom affects the pane beneath the pointer without switching the shared inspector. Keyboard camera commands target the active pane; form controls retain their normal keys.
- Shared inspector and timeline visibly identify their owning pane. Interacting with these shared panels does not change that ownership.
- Selection changes inspection/highlighting. Follow/Chase captures a separate `targetId`; changing selection does not move the camera. Show the tracked object and provide “Track selected.”
- When tracking is active, orbit gestures pivot around the tracking target; otherwise retain selection-pivot behavior. This avoids inspecting another ship unexpectedly changing the next orbit gesture.
- Timeline names select an actor in the active pane. Timeline scrubbing changes the shared time. These should remain distinct actions.
- Ship the first comparison with independent selections. Defer linked selection; duplication already supports same-ship comparisons.

**Camera and pane lifecycle**

- Duplicate copies presentation settings and selection, shares the session, and becomes active. It never reloads the set.
- Divider resize preserves camera center, orientation and CSS-pixel scale; it changes the visible extent. The current automatic `fit()` on resize must go. [Resize behavior](/home/s/code/orbital-logistics/src/main.ts:812).
- Plain frame changes preserve the current physical viewing pose where representable. Fit is explicit. Named presets may intentionally change frame, pose and scale together.
- If a reference becomes unavailable, fall back locally to inertial using its last valid pose and show a brief explanation. Do not fit or retarget the other pane.
- Maximize suspends the hidden pane’s rendering/refinement work while retaining its settings. Close releases workers, listeners, observers, pointer capture, canvas allocations and GL resources.
- Scene changes invalidate outstanding loads and callbacks by generation, reset pane-specific object references, and retain layout. Late dynamic imports must not resurrect a departed session.
- Returning to the landing page disposes the viewer session initially. Background preservation is unnecessary scope.

For the remaining proposal, my disposition is:

| Proposal | Disposition |
|---|---|
| Two-pane horizontal/vertical comparison | **Adopt.** No recursive splits, floating windows or detached views yet. |
| Camera/Display controls and explicit presets | **Adopt.** Keep frame, tracking and inspection conceptually distinct. |
| Collapsible hierarchical library | **Adapt.** Close it after choosing a set by default; three persistent columns would crowd split views. |
| Static landing and lightweight hero | **Adopt.** Poster first; animated clip after the loading boundary passes. No simulation imports through shared hero utilities. |
| Whole-workspace pixel budget | **Adapt.** Treat 8.3 M foreground pixels as an allocation ceiling to test, not evidence of acceptable performance. Existing 4K relief already misses the proposed envelope. |
| Broad adapter/schema cleanup or renderer rewrite | **Defer.** Extract only the interfaces needed by the present viewer. |

Recommended release order:

1. Metadata catalog/loading boundary; Session and Viewport extraction with one-pane parity.
2. Explicit selection/tracking/focus transitions, disposal and allocation accounting.
3. Two-pane comparison plus compact controls/library; immediate performance and human viewing gate.
4. Static landing/direct links, then the small hero. Mobile viewer remains separate.

The acceptance gates should be concrete:

| Area | Proposed gate |
|---|---|
| Semantic parity | Same explicit request/reply sequence and fixed epochs produce identical physical states, resources and events across one/two panes and layer/frame changes. Include capture boundaries, reverse, held pending replies, faults and scene switching. Do not compare equal wall-clock durations and expect equal frontiers. |
| Request ownership | Pane operations cause zero simulation initialization/restart requests; at most one service request remains outstanding globally. |
| Interaction | Pointer crossing never retargets the inspector; keyboard focus survives panel refresh; tracking remains locked while inspecting another actor; resize/maximize preserves camera state. |
| Desktop performance | On named hardware at 60 Hz, three bounded 30-second runs: ordinary 1080p one/two-pane frame-gap p95 ≤18 ms; heavy/4K configured fallback p95 ≤35 ms; input-to-visible-response p95 ≤100 ms. Test default and maximum supported playback rates separately. |
| Attribution | Repeat identical camera/epoch comparisons with relief off/on; record refresh, panels, ingestion and complete frame gaps. Use a bounded GPU/compositor trace only if gaps remain unexplained. |
| Lifecycle/storage | Twenty duplicate/close and representative set-switch cycles: exact owned worker/resource counts return to baseline; retained cache allocations plateau after warmup. Treat JS heap and estimated field bytes as partial accounting, not total GPU/process memory. |
| Landing | No viewer code, fixture profiles or simulation workers before explicit entry. Verify no-JS content, reduced motion, Back/re-entry, invalid links and direct links under a static subpath. |
| Mobile | First release: readable landing at 360 CSS pixels without horizontal scrolling or viewer download. Viewer support requires a named real device, touch interaction checks and sustained 30 fps testing. |

Retain the landing’s LCP ≤2.5 s, INP ≤200 ms and CLS ≤0.1 targets, but distinguish lab checks from the official 75th-percentile field criteria. [Web Vitals guidance](https://web.dev/articles/vitals).

The genuinely human decisions are the Featured/Studies selection, whether the two-pane composition feels spacious enough, and which scene best introduces the project. None blocks the ownership refactor. The optional “same ship versus different ships” question also need not block it: duplication plus independent selection supports both.
