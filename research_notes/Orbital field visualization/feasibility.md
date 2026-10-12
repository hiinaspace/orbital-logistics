# Potential-field viewer feasibility

## What does the current architecture permit?

### Takeaway
A cached CPU scalar map plus contours is the smallest useful slice. Preserve the existing Canvas viewer; treat a raised rubber sheet as a later renderer experiment.

### Cited Findings
- Watching, frames and scrubbing are the accepted product direction; presentation interpolation never targets or resumes physics. [model-set](/home/s/code/orbital-logistics/docs/model-set.md)
- Rendering is one Canvas 2D context. `draw()` runs every RAF, snapshots camera projection once, and projects path vertices at their own epochs. The current camera is orthographic, with independent yaw/pitch/center/scale and optional Chase rig. [main](/home/s/code/orbital-logistics/src/main.ts:125), [camera](/home/s/code/orbital-logistics/src/model-set/camera.ts:23)
- Frames subtract an origin and rotate axes; velocities additionally include angular velocity. `transformDirection` rotates vectors without translating them. [frames](/home/s/code/orbital-logistics/src/model-set/frames.ts:8)
- Ordinary/compact gravity is a sum of direct point-source attraction with excluded body interiors. Solar dynamics additionally subtract each non-Sun source's acceleration of the heliocentric origin; solar ephemerides include inclined bodies. [ordinary dynamics](/home/s/code/orbital-logistics/src/sim/dynamics.ts:16), [compact](/home/s/code/orbital-logistics/src/compact/physics.ts:7), [solar](/home/s/code/orbital-logistics/src/solar/ephemeris.ts:33)
- Canvas supports affine transforms and drawing cached canvas/ImageBitmap images; OffscreenCanvas supports worker rendering. [transform](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/transform), [drawImage](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage), [OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas)

### Inferences
- Create a pure display-field descriptor: domain/version, units, source masses/radii/positions, exact display epoch, physical slice plane and potential convention. Reuse authoritative analytical body providers, including `solarBodyState`; never infer forces from path samples or minimum seven-pixel body glyphs.
- For direct gravity use Φ = −Σμ/|x−b|. Matching solar heliocentric dynamics requires adding Σ(non-Sun)μ(x·b)/|b|³; its negative gradient gives the existing uniform indirect acceleration. This is a derived formula, requiring gradient tests. A rotating coordinate pullback preserves scalar values; apparent acceleration requires separate centrifugal/origin terms and velocity-dependent Coriolis, which a scalar cannot encode.
- A world-plane map can rotate/translate into any existing physical frame and orthographic camera by one affine projection. No scalar resampling is necessary for camera rotation/pan if its bounds still cover the viewport. Near edge-on, stop refining an almost invisible plane. Chase must move the camera, never redefine the physical slice.
- In compact's fixed-primary/circular-moon field a rigidly rotating map can be reused after an exact provider invariance check. Do not apply that optimization to solar's independently phased bodies.

### Gaps
No overlay benchmark or working renderer exists; no frame-budget claim follows from these API capabilities.

## Which rendering path is practical?

### Takeaway
Color/isoline/vector modes can share bounded display sampling. A depth-rendered surface merits a separate WebGL layer only after the map proves useful.

### Cited Findings
- Production 3840×2160/16× continuous-cycler evidence records draw n=2,568, p95 9.5ms/max18.5ms; frame gaps p95 33.4ms/max50.1ms. Refresh p95 9ms, worker turnaround p95 26.2ms. There were no recorded errors. This is historical host evidence, not a 60fps guarantee. [raw measurement](/home/s/code/orbital-logistics/docs/evidence/continuous-cycler-browser.json), [conditions](/home/s/code/orbital-logistics/docs/evidence/continuous-cycler-fleet.md:66)
- WebGL guidance recommends batching, bounded per-pixel VRAM and optionally smaller backbuffers. [MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)

### Inferences
- MVP: optional low-opacity 256² scalar heatmap, 8–12 isolines, and an independently toggleable sparse vector grid. Fixed per-set transfer function/contour levels avoids flickering auto-normalization. Color/height compression is display-only; contour levels remain physical values. Mask actual body interiors before evaluation; clip contour cells touching interiors rather than inventing softened gravity. Refine near surfaces/saddles only within hard sample/segment caps.
- Use padded, power-of-two world bounds and screen-error-driven LOD; pan within padding reprojects existing tiles, zoom triggers refinement only at LOD thresholds. A 512² Float32 scalar plane plus RGBA image costs about 2MiB before extra copies. Bound cache bytes and dispose on set switch.
- During scrubbing show coarse exact-epoch fields promptly, then refine the latest request. For moving-body fields never silently display a stale map against current bodies. Use a dedicated display worker with one in-flight job/one replaceable desired job, generation IDs, transferable buffers and cancellation between tiles. Keep it independent of the physics worker/request queue and simulation history; do not advance the frontier to compute fields.
- Rubber sheet: first test a coarse projected wire grid using the same camera. A shaded triangle mesh needs depth/occlusion and benefits from WebGL; keep Canvas labels/ships over a pointer-transparent separate layer. Decide explicitly whether sheet occlusion is illustrative or shared with objects; do not accidentally hide ships by fictitious height. Preserve Canvas fallback and release GPU resources on switch.
- Particle/advection is a separate optional teaching mode: deterministic seeds, bounded lifetimes and rewind semantics. Gradient-flow dots depict downhill direction, not orbital trajectories; physical test particles require position/velocity integration. Neither becomes logistics execution.

### Gaps
No synthetic benchmark was run: field-kernel timings would omit contours, uploads, compositing and contention. Existing draw costs leave little justified room for unbounded main-thread work.

## What gates and interaction changes should follow?

### Takeaway
Ship the top-view map only after numerical/display/performance gates, then use owner perception to choose surface or particle development.

### Cited Findings
- Canvas owns pointer capture, drag-to-orbit/pan, click selection and wheel zoom. [input](/home/s/code/orbital-logistics/src/main.ts:782)
- The bottom-docked timeline is limited to30dvh and scrolls, but resizing is currently native `resize: vertical`. [CSS docking](/home/s/code/orbital-logistics/src/style.css:113), [resizing](/home/s/code/orbital-logistics/src/style.css:174)

### Inferences
- Correctness gates: analytic single-body circles/radial arrows; finite-difference −∇Φ versus each domain's force provider outside surfaces; translated/rotated point-value invariance; contour saddle topology; actual-radius masks; solar indirect-term sign; deterministic held/reverse/Live and stale-worker-response rejection. Camera/map changes must leave physical packets/resources byte-identical.
- Proposed performance gates: same 4K/16× production scenario with overlays on/off, rapid pan/zoom/scrub and repeated set switching; target overlay compositing p95≤2ms and no sustained frame-gap regression above5ms versus paired baseline. Cap sampling≤512², vector arrows≤400, contours≤20k segments, cache≤16MiB, one worker job; record queue age and retained bytes. These are proposed acceptance limits, not measurements.
- UI: one optional Field control with color/contour/vector choices, physical plane indication and compact legend; details hold conventions/caveats. Overlays receive no pointer events.
- Tiny followup: replace native resize with an explicit top-edge separator. Pointer capture computes height=startHeight+startY−currentY; retain fixed bottom, clamp26px–30dvh, preserve lane scrolling, add keyboard height adjustment. Stop drag propagation so resizing cannot orbit/scrub the scene. No implementation performed.

### Gaps
Rubber-sheet usefulness, contrast at busy trails, and preferred advection semantics require the owner's visual judgment after a bounded map prototype.
