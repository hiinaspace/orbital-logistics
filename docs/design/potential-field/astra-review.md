**I recommend the brief’s revised Canvas approach, narrowed to the compact field first.** Its physical interpretation is sound. The main correction is to make the rotating-basis cache—not asynchronous cursor-epoch sampling—the implementation contract.

I read the brief, all three research notes, synthesis, relevant physics/frame/rendering code, and stored performance evidence; I also spot-checked the primary sources. No edits, delegation, or experiments.

1. **The draft still promises more temporal accuracy than its worker design provides.**
   The [report’s sampling proposal](</home/s/code/orbital-logistics/reports/Orbital field visualization.md:35>) and feasibility note suggest refining the latest cursor epoch asynchronously. For continuously moving sources, that either displays an older field or repeatedly hides/discards results. Generation IDs prevent obsolete results from winning; they do not eliminate computation latency.

   The [brief’s revised approach](/home/s/code/orbital-logistics/docs/design/potential-field/brief.md:13) fixes this for compact. Its source configuration rotates rigidly, so, writing \(R(t)\) for rotation through `RATE*t`,
   \[
   \Phi(t,R(t)q)=\Phi(0,q).
   \]
   Sample once in that basis, then transform each cached point through **basis → world at cursor \(t\) → selected frame at \(t\) → current camera**. This provides exact epoch alignment, subject to ordinary floating-point error; raster and contour approximation remain separate spatial errors. The existing [camera projection](/home/s/code/orbital-logistics/src/model-set/camera.ts:25) is affine, and [Canvas supports that transform](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/transform).

   Keep cursor epoch and selected viewing frame out of the scalar-cache identity. They affect projection, not cached values. Field definition, basis, bounds, resolution and presentation settings determine reuse.

2. **The physical distinctions are correct; keep them visible in the quantity names.**
   [Compact gravity](/home/s/code/orbital-logistics/src/compact/physics.ts:3) really is direct attraction from fixed Aster plus prescribed circular Selene, without an indirect term. Ordinary \(\Phi=-\sum\mu/r\) therefore matches that implementation. The solar note’s **positive** linear potential term is also correct: its negative gradient supplies the subtraction in [solarGravity](/home/s/code/orbital-logistics/src/solar/ephemeris.ts:33).

   “Gravitational potential” and “gravitational acceleration” can remain the same quantities when the viewing frame changes. In ship-centered views, those arrows do **not** describe apparent ship-relative acceleration. That limitation follows directly from the [frame implementation](/home/s/code/orbital-logistics/src/model-set/frames.ts:8).

   Compact’s \(\Phi_{\mathrm{eff}}=\Phi-\tfrac12n^2(x^2+y^2)\) is valid for its co-rotating dynamics; Coriolis remains velocity-dependent. The [MIT derivation](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/9579/sicm_edition_2.zip/chapter001.html#%_sec_1.6.1) supports that distinction. Defer this second quantity: otherwise the first layer risks promising an explanation of parking, stability or route accessibility that ordinary potential cannot deliver.

   One concrete source-convention trap: [heyoka’s notebook](https://bluescarni.github.io/heyoka.py/notebooks/Periodic%20orbits%20in%20the%20CR3BP.html) defines its helper’s `C` as \(\Omega-T\), half the conventional \(2\Omega-|v|^2\), and uses a different primary-axis convention. Its visualization is a useful precedent; its numerical thresholds cannot be copied into this field.

3. **Coverage and close zoom are the unresolved renderer risks—not basic projection.**
   A 512² ceiling bounds work but establishes no useful spatial accuracy. A whole-system grid can poorly resolve Selene’s surface and become visibly coarse during close tracking.

   Keep one coarse overview plus at most one bounded detail patch initially. Continue reprojecting valid coarse coverage while refinement runs; leave uncovered areas empty. A camera move should not invalidate otherwise reusable field data or cause perpetual cancellation.

   Surface masking must detect **cell–body intersection**, not merely invalid corner samples: a small body can lie entirely inside a cell whose corners are exterior. Contours and filtered tint also need protection against bleeding through the excluded region.

   Oblique projection is feasible, but flattening a plane near edge-on makes viewport inversion ill-conditioned. Stop refinement and suppress the layer near that limit. Projected arrows also need not appear perpendicular to projected contours; that is expected foreshortening, not a force error.

4. **The performance gates disagree and should be reconciled.**
   The report proposes ≤2 ms compositing and ≤5 ms frame-gap regression; the brief proposes roughly +3 ms draw and ≤50 ms frame gaps. The [stored baseline](/home/s/code/orbital-logistics/docs/evidence/continuous-cycler-browser.json) confirms draw p95 9.5 ms and frame-gap p95 33.4 ms, but measures no field overlay.

   Prefer a paired whole-viewer comparison, with **incremental total draw p95 ≤3 ms and frame-gap p95 regression ≤5 ms** as provisional targets. Include refinement, bitmap upload, contours and contention; hot-cache compositing alone misses the likely hitches. Count pending and replaced buffers toward the memory cap.

**The bounded next slice I would approve for implementation planning:**

- One compact cycler exhibit; ordinary potential only, default off. Quiet tint, sparse fixed-value contours and a small numeric legend with fixed compression.
- Static rotating-basis cache, cursor-time reprojection, Top first and a guarded oblique-plane view. Preserve existing valid frame behavior and ship positions.
- One display worker, one outstanding request plus replaceable desired bounds, 256² initial sampling, 512² ceiling and 16 MiB total field storage. No general tiling framework.
- Verify analytic single-source behavior, exterior gradient parity, rotational covariance, masks and paused/reverse/Live/frame-switch alignment. Then perform paired browser profiling and one owner viewing gate.
- Add sparse acceleration arrows only after the scalar layer is readable. Defer effective potential, relief, LIC, particles and solar coverage.
- Treat the top-edge timeline grip as an independent small change; the proposed upward-drag height calculation matches the current bottom docking.

The Canvas prototype has a credible exact-cursor design. Its remaining gates are spatial fidelity, measured cost and whether it actually helps the freight scene read.
