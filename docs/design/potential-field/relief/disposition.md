# Relief review disposition — 2026-10-12

Verified transport: `gpt-6-astra`, `high`, read-only, session `01a1326a-a519-71f3-a522-513b6f406dd4`, exit 0 and nonempty output. Cost unavailable. [Brief](brief.md), [review](astra-review.md), [transport](astra-review.log).

| Recommendation | Disposition |
| --- | --- |
| P2: relief refinement can exclude a followed glyph because it inverts z=0 | Adopted. Invert the entire permitted synthetic-height slab, including named-frame origin-height subtraction. Use a conservative patch or the overview. Numerical reproduction and a close Follow browser coverage assertion pass. |
| P2: mode switching can exceed 16MiB with retained flat patches/pending work | Adopted. Cancel the independent field worker and evict its detail cache before relief allocation; reduce the unused flat canvas to 1×1, including edge-on entry. Relief evaluates the field analytically and needs no pending flat job. Sender identity guards discard late replies. Delayed 512² work followed by relief/flat switching passes. |
| Core force, roots, per-epoch mapping and schematic preference are supported | Retained. Owner-approved artificial height is presentation only; glyphs, trails and camera pivots share the deformation. Physical velocity/attitude axes remain schematic. |

Main spot checks reproduced the coverage issue algebraically, confirmed aggregate overlap in the old allocation order, verified the new force residuals against canonical compact gravity and inspected Top/relief/Moon images. Thirteen focused field/camera/trail tests and production browser gates passed. GPU driver residency is not certified by the logical byte bound; visual taste remains owner-reviewed.

Current worst-case relief accounting: 1024² color/depth allowance 8,388,608 bytes, ≤291² mesh vertices/indices 2,695,848 bytes, retained overview ≤1,484,288 bytes and 1×1 flat canvas 4 bytes. No pending field job/detail cache in this mode. Total ≤12,568,748; adding the mesh-construction typed arrays gives ≤15,264,596, below 16,777,216. Flat re-entry frees the relief framebuffer and retains only bounded geometry; its existing request admission evicts dispensable detail before reserving a new job. These are logical allocation limits, not browser-process RSS limits.

See [implementation evidence](../../../evidence/relief.md).
