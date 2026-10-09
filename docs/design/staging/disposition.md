# Staging review disposition

2026-10-09. Astra through codex exec, verified transport `gpt-6-astra`, `xhigh`, read-only sandbox, exit0, nonempty report. Source claims spot-checked against Runner event retention, snapshot indexing, schema grid rules, model-set preparation and viewer vertex transforms.

| Recommendation | Disposition |
| --- | --- |
| Atomic canonical separation, parent thrust-end then separation then child starts | Adopted. Strict domain admits an ended parent thrust checkpoint; both child Bundles are derived and validated before publishing a SceneView. Coincident child captures/impulses reject. |
| Choose split on common coarsest grid | Adapted. Runner retains thrust-end nodes independently of grid; verified in `runner.ts:#ensure` and snapshot anchor. Require exact thrust-end ledger entry and `snapshot.anchor.t===split`. Child grids begin at that checkpoint, with rounded coverage horizons. Physics never seeds from an arbitrary sample or drawing interpolation. A grid restriction would add no safety at this retained event. |
| One component manifest, reserve upper fuel and account parent once | Adopted. Definition owns hardware/tanks/cargo, derives stack ballast and both children. `stagedAccounts` counts only current owners, reserved upper fuel before separation, and parent fuel consumption once. Global ports come from the mission-start ledger, never sums of local copies. |
| Lifetimes govern all viewer queries; explicit selection and whole-frame fallback | Adopted. Inactive actors remain selectable metadata, lack glyph/hit/physical diagnostics; centered options disable. No fake samples. Historical path vertices outside selected frame lifetime are clipped, with no per-vertex frame switching. Follow stops when its actor retires. |
| Airborne newborn coverage and aggregate storage budgets | Adopted. Dedicated finite segment drawing helper densely samples every flight interval, including birth-to-arrival. Explicit node/sample/serialized budgets cover the whole mission. |
| Require mission completion and an independently propagated split | Adopted. Admission requires paid booster landing, courier docking and completed unload. Oracle branches from its own DOP853 stack result, not production child seeds. Numerical refinements, resource conservation, conflict/fault rejection and lifecycle browser probes are separate checks. |
| Restrict current slice to analytical airless pad/depot | Adopted. One fixed primary, one surface port, one circular port, no sibling-dependent refuel/cargo exchange. Repetition, atmosphere and mixed maintained service remain later slices. |

No further human architecture decision needed. Visual acceptance remains the owner viewing gate.
