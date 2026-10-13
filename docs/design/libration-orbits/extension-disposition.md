# Extension design review disposition

2026-10-13. Verified CLI transport: gpt-6-astra/high, read-only, session01a133c8-6c0a-7ca0-b6d6-5405815e0a72, exit0. Reviewer source findings informed implementation; review is not a substitute for numerical/visual evidence.

| Finding | Disposition |
|---|---|
| Moving-surface-v6 is too narrow for launch/return; don't silently loosen it | Added separate mission-surface-v7: two circular sources, one empty moving pad, no freight/transfers. Old v6 unchanged. |
| Reference fit and radial growing-mode feedback need actual conditioning and center-shape gates | Measured canonical finite-response gain, bounded projected phase fitting, horizontal/vertical quadrature amplitudes and full center error; separate finite guide residual claim. |
| Unwrapped phases are authoritative state; controls/physics/resources must commit together | Controller phases live in exact continuation anchor. Engine candidate transaction and frontend staged admission; rejected packets retain prior state. |
| Bound nodes, work, rows, bytes and one held reply | Explicit per-candidate/chunk/retained/reply limits, episodic Runner lifetime and global mission reservation. |
| Need several beats and multiple history windows plus frozen-control oracle |2600unit engine/store rollout, second1320rollout, independent seven-state replay of early/late frozen controls. |
| Real parking and actual endpoint insertion, zero-kick stage ownership | Actual binary parking coast and phase search, fixed hardware, booster recovery, conserved split, exact upper continuations, independent parent-branch oracle. |
| Camera fix doesn't cover near-polar fallback | Accepted limited reported coplanar regression scope; no global spatial continuity claim. |

See [evidence](../../evidence/libration-extensions.md). Implementation review has a separate disposition.
