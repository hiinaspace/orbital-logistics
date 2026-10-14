# Viewer polish and public-entry plan

2026-10-13. Steps1–2 implemented after the reviewed proposal, based on checkout7e9936b and the user's accepted viewer direction. [Astra review](astra-review.md), [disposition](disposition.md), [human clarifications](clarifications.md), [layout sketch](layout-study.png). The original planning pass changed no application code; see [implementation evidence](../../evidence/viewer-workspace.md) for the subsequent workspace slice.

Accepted styling: Flight deck panels with Space Grotesk text/headings and IBM Plex Mono numerical values. Selected set/ship rows use a background fill, without accent stripes. See [copy/style guidance](playback-and-type.md#accepted-combination-and-copy-review).

## Product shape

A curated collection of operating miniature space systems. Public visitors arrive at a descriptive lightweight page; opening an exhibit enters an observation workspace. Watching, changing frames and inspecting a spacecraft remain sufficient. The viewer keeps the current schematic visual language and minimal permanent copy. Explain exhibits in the library/About, not repeated captions or model caveats.

Use a docked workspace rather than fullscreen canvases behind overlapping panels:

- Left collapsible **Sets** drawer: system categories, short category/exhibit descriptions, search and a small Featured group. Close after choosing by default on constrained widths; allow pinning open on a large monitor. Opening a category or reading metadata never loads a simulation.
- Center: one or two viewports, side by side or stacked, with a resizable divider. Each has a compact frame selector, camera control, Fit and a Display popover. Subtle active border. Maximize/restore retains the other pane's settings while suspending its rendering and refinement.
- Right collapsible object list/inspector: belongs visibly to the active viewport. Physical fuel/cargo facts are shared; frame-relative readouts belong to that pane.
- Bottom dock: shared resizable/scrollable activity timeline player. The ruler and all ship lanes seek one playhead; there is no separate scrubber. Play/pause, textual time, bipolar speed and Live/Replay sit in the same docked player, with the familiarity of video-player controls. Timeline names select an actor in the active pane; timeline scrubbing changes the shared time. Optional collapse keeps observation spacious.

First layout presets: **Overview + Chase**, **Inertial + Rotating**, **Top + Front**. They configure two ordinary viewport instances, rather than special new renderers. No recursive splitter tree or floating window manager in the first slice. A future inset can reuse the same viewport lifetime/ownership abstraction.

The layout study uses synthetic diagrams and placeholder telemetry, not the simulation. Its interactive controls demonstrate layout/selection ownership only. Visible helper captions in that study are not a requirement for production.

## Selection, tracking and controls

Selection is independent in each view. Activate on click/pointerdown or keyboard focus entering that view or its controls; pointer traversal never retargets the inspector. Wheel zoom affects the pane under the pointer without changing shared-panel ownership. Keyboard camera commands target the active pane; native form keys remain native. Menus retain their originating pane+session generation, and stale menu actions close/reject rather than target a different view.

Separate **inspection selection** from **camera tracking target**. Follow/Chase captures a target explicitly; inspecting a station or another ship does not suddenly redirect the camera. Show the tracked object in the camera control and offer Track selected. Orbit gestures use the locked tracking pivot while tracking; otherwise the selected-object pivot. Duplicate copies presentation settings/selection/target, activates the duplicate, and shares the existing scene. No link-selection feature is needed initially.

Group controls by purpose:

| Location | Controls |
|---|---|
| Frame | Inertial/system rotating/L2, grouped body/station/ship reference origins |
| Camera | Top/3D/front/side; Follow/Chase and target; Orbit/Pan; Fit |
| View presets | System, Selected, Surface/Entry where applicable; explicit compound camera/frame changes |
| Display → Paths | Orbit guides, Past trails plus length, Future route |
| Display → Appearance | Labels, see-through bodies, atmosphere, entry glow |
| Display → Dynamics | Lagrange points, potential/relief/grid/strength/height, aerodynamic force vectors, capability gated |

Surface/Entry leaves the main row and becomes a deliberate preset. Keep ordinary layer changes local and non-navigating. Resizing/dividers/maximize must preserve camera pose and CSS-pixel scale. Initial extraction preserves established frame-choice behavior; in the polish gate distinguish deliberate frame/preset recentering from accidental fits. Named presets may change frame/pose/zoom. Unavailable references resolve locally with a last-valid pose/fallback, never by mutating another pane or physics during drawing.

## Architecture: one publication, multiple presentations

```
Metadata catalog / lazy exhibit loaders
                  |
            SceneSession
   adapter, worker, one playback clock,
   frontier, history, resources, events
                  |
     coherent presentation publication
       /                         \
Viewport A                   Viewport B
frame/camera/target           frame/camera/target
selection/layers             selection/layers
labels/hits/field             labels/hits/field
       \                         /
       Workspace + activePaneId
         inspector + timeline
```

The session is the only owner allowed to advance/request/ingest/release/restart. Preserve one pending bounded service request, generation/sequence rejection, exact local event times, held future rows, fault validity and existing finite/continuous distinctions. Opening views never creates another simulation, copies a whole history or refuels/replays resources.

A workspace frame advances playback once and acquires one coherent presentation packet for both panes. **Worker revision alone is not a valid display-cache key:** some adapters filter plans by admittedAt≤cursor and build cursor-dependent actual/future coverage. Preserve adapter-specific cursor/visibility boundaries and existing bounded refresh policy; do not simply call view(cursor)60times/second or freeze it until the next reply. An adapter may reuse storage safely without promising cursor-invariant content.

Move state transitions into explicit session/workspace/pane updates before drawing. Rendering may update disposable projection/hit/label caches; it must not select actors, change frames, ingest workers or move the clock. Share frame-independent samples where useful; transformed paths, occlusion, label hysteresis and hit geometry stay local. Historical path vertices retain their own epochs. Reference-frame display and drawing interpolation never become physical targets.

Extract a small finite/continuous session interface around existing domain stores; keep versioned numerical engines. Do not create a universal trajectory schema, rewrite all services or adopt a UI framework simply to split the current906-line entry. Keep canonical Runner independent of UI/DOM/wall time.

Before creating removable panes, add idempotent dispose: event handlers, resize observers, pointer capture, pending field callbacks/workers, canvas backing stores, GL buffers/programs/context ownership. Closing/reloading/returning to landing must cancel late callbacks by generation. Start with two bounded field instances under an aggregate workspace allowance; a shared scalar-patch cache is a later measured optimization, not a prerequisite. Potential remains restricted to fields it actually models.

## Curation and loading

Fully superseded exhibits retire from the public library/registry; there is no Studies/archive UI. Quiet compositions with a different observational purpose remain. Finite versus continuous is not itself a reason to keep both when their content is otherwise the same. [Catalog disposition](catalog.md) separates likely replacements and cases needing a content check.

Remove catalog references first, then audit dependency reachability before deleting display assets/builders. Git keeps retired authored content. Tiny shared-physics regression witnesses or programs used to compile a retained continuous scene remain test/build inputs, not public exhibits. Do not preserve unsupported legacy loaders indefinitely solely because a retired entry once used them; remove only after proving current builds/tests no longer need them.

Use a metadata-only manifest for category/title/summary/tags/recommended view presets. Keep loader code in a separate registry, so importing library descriptions cannot import fixtures or worker code. Load the selected exhibit on entry. First split the viewer and existing workers into ordinary separately cached chunks; per-domain worker splitting follows measured transfer/preparation needs. Heavy JSON/profile assets stay demand-loaded. Avoid duplicate large SceneView copies per pane. Consider typed arrays/binary caches only if allocation/transfer profiling identifies a worthwhile current bottleneck.

## Performance and evidence

Keep Canvas2D foreground and existing WebGL relief initially. DOM counts are only273–374 in the fresh sample, with no evidence of a DOM scene graph bottleneck. Current main bundle is990580bytes decoded /267326encoded in local preview; selected large-scene preparation is6.8–8.3seconds off-thread here. These are local observations, not web/mobile loading guarantees.

The first short baseline compared Top/plain to 3D/relief and different epochs, so it is an experience comparison. Astra caught that confound. A second off/on/off probe holds epoch16, rotating frame and oblique camera fixed:1080p p95frame gaps16.7–16.8ms for all;4K off16.7–16.8ms/on33.4ms. The playing4K relief sample was slower (~66.6ms p95), so dynamic composition still needs investigation. Refresh/history/panel reconstruction is also material: full-system refresh p95~10.9ms at4K, draw~9.1ms (percentiles must not be added as a measured frame total). Compute refresh once per session.

Relief **already caps its longest backing dimension at1024**. Do not present a lower-resolution relief surface as an unimplemented cure. GPU/compositor attribution is unknown; controlled traces follow if total gaps remain unexplained. Diagnostics remain opt-in/bounded and exclude physical state.

Proposed gates, to be tested on named desktop hardware/browser at60Hz:

- Ordinary1080p one/two views: three30-second runs at default and supported maximum playback, frame-gap p95≤18ms. Heavy/4K configured fallback: p95≤35ms. Input-to-visible response p95≤100ms. These are release targets, not current two-pane results.
- Start with a provisional aggregate foreground backing budget around8.3million pixels, with an explicit quality/DPR policy. Measure every visible backing surface and GL allocation separately; the number is a ceiling to test, not proof of acceptable speed. Adaptive drawing may simplify projected paths/labels/resolution, never physics timestep, planned controls or elapsed simulation time. All panes display a common clock/publication even if workspace rendering is throttled.
-20add/remove and representative set-switch cycles: owned workers/listeners/GL allocations return to baseline; retained cache allocations plateau after warmup. Heap snapshots and field byte estimates are partial accounting, not total process/GPU memory.
- Semantic parity uses identical explicit request/reply sequence and epochs, not equal wall-clock play duration. One/two views, frame/layer/preset changes, resizing and quality choices preserve physical states/resources/events. Include captures, faults, reverse, held pending replies, Live and cancellation.

## Static landing and future mobile

The root page contains readable semantic HTML before JavaScript: brief explanation, curated exhibits/posters and an explicit Open viewer action. Hash/query routes work on static hosts and subdirectories without rewrite configuration. Direct exhibit links still enter the viewer intentionally. No backend, SSR framework or service worker is required for this scope.

Gate the arrival boundary with a poster first: before viewer entry there is no viewer bootstrap, simulation worker or heavy fixture/profile download. Then add a tiny prepared-trajectory hero and minimal renderer with its own visible-only clock (~15–24fps), stopped for reduced motion/offscreen/background. Reuse canonical prepared positions, not a hidden full planner. A decorative clip can loop without claiming continuous resource execution. Shared utility imports must not pull the full viewer into the hero. Back/re-entry disposes the initial viewer session; persistence of a background simulation is unnecessary.

Landing targets: mobile-readable at360CSSpx, no horizontal scroll/viewer download; LCP≤2.5s,INP≤200ms,CLS≤0.1 as field goals, with lab/real75th-percentile criteria clearly distinguished. A future mobile viewer starts single-pane with touch controls and capped backing resolution, aiming at sustained30fps on a named real midrange device. Desktop mobile emulation is preliminary. No mobile-viewer promise or deployment/publishing is part of this planning pass.

## Implementation sequence

1. **Loading and ownership foundation:** metadata/loader split; SceneSession and one Viewport extraction. Keep single-view behavior and all physics unchanged. Add explicit selection/tracking transitions and disposal/allocation accounting.
2. **First visible polish slice:** hierarchical library/retirements, reorganized controls, docked inspector/timeline, two-view presets and resize/maximize. Run parity, focus/keyboard, pending-history and performance gates immediately. Owner viewing gate on spacing/active-pane behavior before more layouts.
3. **Measured efficiency pass:** isolate refresh/copy/query/draw/composition costs, loading cancellation and repeated-switch memory. Share sample work, stabilize aggregate quality budgets; change representations/rendering only where evidence supports it. Can overlap earlier steps, not postpone all profiling until UI completion.
4. **Public entry:** static landing/direct links/posters, then tiny optional hero; reduced-motion/noJS/narrow-screen/static-subpath gates. Desktop viewer release polish. Real-device mobile viewer work remains a separate optional slice.

Steps1–2 now have a working two-pane implementation for the human viewing checkpoint. The layout-study screenshot/HTML remains a proposal; implementation.png and two-views.png show the implemented viewer. The static arrival page/hero and real-device mobile viewer remain later slices.

## Current external references

- [Web Vitals](https://web.dev/articles/vitals): landing metrics and field/lab distinction.
- [MDN Canvas optimization](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas): caching/layered canvases/batching and backing-resolution considerations.
- [MDN devicePixelRatio](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio): mobile DPR often>2; squared backing-area cost is an arithmetic inference, not a mobile benchmark.
