# Potential-field visualization: first slice

2026-10-12 research and Astra-reviewed feasibility plan, authorized and implemented. See [evidence](../../evidence/potential-field.md), including the open 4K compositor envelope.

The owner subsequently accepted the scalar layer and authorized the darker fade, schematic relief and equilibrium markers. These are now implemented; see [current evidence](../../evidence/relief.md) and [review disposition](relief/disposition.md). The first-slice plan below is preserved as the sequencing rationale.

See the [research report](../../../reports/Orbital%20field%20visualization.md), [review disposition](disposition.md), [review](astra-review.md), and [representation comparison](compact-field-representations.png).

## Scope

Add an optional, default-off ordinary gravitational-potential layer to the compact Aster–Selene cycler exhibit. Begin with quiet tint and roughly 8–12 fixed-value contours, a small numeric legend and fixed per-set compression. Top view first; allow the same physical XY slice in oblique 3D only with an edge-on suppression guard. Ships remain in physical space. The owner subsequently accepted a later schematic relief mode with bodies and ships mapped onto the sheet height; it will remain a presentation option rather than physical altitude.

Use the actual prescribed-source potential `Φ = -Σ μ/|r-b|`, excluding source interiors. Do not change forces, soften gravity, integrate particles or advance the service frontier. Viewing-frame transforms change presentation, not potential values. This first layer does not claim to show full apparent acceleration in rotating or accelerating frames.

## Exact cursor alignment and bounded spatial approximation

The compact source configuration is rigidly rotating. Sample `Φ(0,q)` once in its phase-aligned basis; at every cursor project cached vertices through basis → world at cursor → selected frame → camera. Cache identity includes field definition, basis, bounds, resolution and presentation settings; it excludes cursor epoch and view frame. The scalar is exact in time while the raster and contours approximate space.

Keep one coarse overview plus at most one detail patch. Start at 256² with a 512² sampling ceiling. A separate display worker has one outstanding request and replaceable desired bounds. Continue projecting valid coarse coverage while a patch is built; uncovered areas remain empty. Reuse samples on camera moves rather than canceling useful work continuously. Avoid building a general tiling framework in this slice.

Enforce a provisional 16MiB aggregate field-storage ceiling, including active, pending and replaced buffers. Bound contour output explicitly. Mask cell–body intersections, including a source wholly enclosed by a cell; stop contours and filtered tint from bleeding through physical interiors. Suppress the slice and refinement near edge-on projection rather than attempting an ill-conditioned viewport inverse.

## Gates

1. Verify single-source analytic potential, exterior finite-difference gradient parity with actual gravity, and rotational covariance. Check surface-intersecting cells and tiny bodies inside cells.
2. Check pause, reverse, held-head/Live, reference-frame and set switching. Fields must query the current cursor, never a stale worker epoch. Existing physical outputs/resources remain unchanged.
3. Compare whole-viewer on/off at 4K and 16×, including close zoom, panning, scrubbing, uploads and worker contention. Proposed acceptance targets: incremental total draw p95 ≤3ms and frame-gap p95 regression ≤5ms. Adjust scope if these fail; historical viewer benchmarks do not establish overlay performance.
4. Compare identical epochs/cameras visually: can the owner still follow freight, recognize wells and read contours without distracting contrast changes? Check grayscale and shallow viewing angles. Close-zoom accuracy and appearance are explicit gates, not assumed from the grid cap.

## Independent UI followup

Replace native timeline corner resizing with a top-edge separator. With the bottom anchored, `height = initialHeight + initialY - pointerY`; clamp to 26px–30dvh. Use pointer capture, keyboard resizing and separator semantics, stop propagation into scene orbit/scrub, and retain lane scrolling.

## Later options

If the scalar gate succeeds, add sparse acceleration arrows with stable sampling and explicit magnitude compression. Effective potential then gets its own compact rotating-mode validation, including Coriolis explanation and source-model conventions. A separate relief view can visualize energy height without moving ships. The owner deprioritized vector grids and LIC because the scalar map should already convey slopes. Noncoplanar Solar fields remain separate work. Lagrange-like crosses belong to a separately derived rotating effective-field diagnostic, not extrema of this ordinary potential.
