Found two **P2 issues** worth fixing. Both concern rendering; neither challenges the owner-approved schematic relief.

1. **Close-zoom refinement can exclude the surface under the followed object.**
   [potential-layer.ts:41](/home/s/code/orbital-logistics/src/view/potential-layer.ts:41) derives bounds by inverting the **physical z=0 plane**, then uses that patch as the entire relief mesh. Synthetic height shifts the visible surface outside those bounds, especially when Follow centers the displaced glyph.

   A lightweight reproduction using the actual camera and layer code placed `(2,0)` at screen center with the standard oblique orientation, gain `3`, and scale `2000`. The selected mesh covered `x=[−3,−1], y=[−6.25,−4.25]`, excluding that point entirely. This can leave the followed ship without its underlying sheet or introduce visible patch edges.

   **Fix:** derive conservative coverage from the permitted height range, including frame-origin height subtraction. Retain bounded overview coverage while refining. Add a coverage assertion for close Follow in both inertial and named frames.

2. **Switching to relief can exceed the declared 16 MiB aggregate allowance.**
   [potential-layer.ts:48](/home/s/code/orbital-logistics/src/view/potential-layer.ts:48) allocates relief rendering without reserving its canvas and mesh against existing patches and pending work. The admission check only guards worker requests; [relief.ts:53](/home/s/code/orbital-logistics/src/view/relief.ts:53) grows its resources independently.

   Using actual sampled patches and layer/mesh code with mocked graphics calls, a square viewport with an admitted pending detail request reported:

   - Flat: **15,772,000 bytes**
   - After enabling relief: **19,528,412 bytes**
   - Limit: **16,777,216 bytes**, with no reported error

   This exceeds the implementation’s own logical accounting by **2,751,196 bytes**, independently of driver residency. The edge-on branch also retains the flat backing canvas, increasing overlap.

   **Fix:** reserve aggregate capacity before relief allocation or resize, accounting for pending work and retained patches. Evict dispensable caches or reduce resolution before committing. Exercise mode switches and viewport resizing while a detail request remains outstanding.

Verification otherwise supports the core design: the potential matches compact direct gravity; the three equilibrium roots use the actual rotating force; frame-origin height subtraction and historical vertex epochs are consistent in the inspected paths. Context-loss handling reaches the ordinary-map fallback. The focused potential-field test file passed.

No edits, delegation, browser rollouts, or expensive experiments were performed. The reproductions verify projection coverage and logical allocation accounting—not GPU appearance, residency, or current frame-time performance.
