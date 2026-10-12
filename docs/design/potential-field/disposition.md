# Potential-field review disposition

Research and recommended next scope, 2026-10-12. No viewer implementation or overlay performance measurement has occurred.

Transport verified before synthesis: `gpt-6-astra`, `high`, read-only, session `01a131fa-bbfa-7c83-b712-d2b9d76ac366`, exit 0, nonempty review. Subscription cost unavailable. See [review](astra-review.md) and [retained transport header](astra-review.log).

| Recommendation | Disposition |
| --- | --- |
| Eliminate asynchronous epoch lag using the compact field's rotating symmetry | Adopted. Sample a static field basis and project basis → world at cursor → selected frame → camera. Cursor/frame do not invalidate scalar caches. |
| Start with ordinary gravitational potential, defer effective potential | Adopted. Tint and sparse fixed-value contours first; rotating diagnostics require a separate contract including Coriolis and model-specific conventions. |
| Bound close-zoom refinement rather than claiming one grid handles every scale | Adopted. One coarse overview and at most one detail patch; keep covered coarse data visible during refinement. |
| Mask cell–body intersections and filtered interior bleed | Adopted. Corner-only validity is insufficient when a small moon lies within a cell. |
| Guard edge-on projection | Adopted. Suppress the plane and refinement near the ill-conditioned projection limit. |
| Measure whole-viewer incremental cost and count pending buffers | Adopted. Proposed p95 draw increment ≤3ms, frame-gap regression ≤5ms; 16MiB covers active, pending and replaced field data. These are targets, not results. |
| Avoid importing standard CR3BP locations/Jacobi thresholds | Adopted. Compact is fixed-primary direct gravity, not the standard barycentric model; heyoka's helper also uses a half-normalized constant. |
| Keep timeline top-edge resizing independent | Adopted. Small followup in the first implementation slice, with fixed bottom and pointer/keyboard handling. |
| Defer arrows, relief, LIC, particles and Solar | Adopted for the first gate. Later representations remain options, selected by readability rather than completeness. |

Main-loop spot checks covered compact force/source motion, view-frame direction transforms, the affine camera, and primary-source distinctions between field flow, acceleration and effective potential. The symmetry follows directly from fixed-primary gravity and the circular secondary. Close-zoom sampling, projected readability and runtime headroom remain unverified. The offline figure demonstrates mathematical representations only.

The resulting [next-slice plan](README.md) and [research report](../../../reports/Orbital%20field%20visualization.md) are ready for owner review. Application behavior is unchanged.
