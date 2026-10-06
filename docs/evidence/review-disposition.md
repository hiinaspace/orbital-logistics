# Astra review disposition — 2026-10-06

Transport checked before synthesizing: CLI startup says `model: gpt-6-astra`,
`reasoning effort: xhigh`, provider OpenAI, read-only sandbox. Exit code 0;
nonempty final review retained as `astra-review.md`. Reviewer self-report said
model/effort unavailable; the transport supplies the evidence. Flat-rate Codex
review, no per-call dollar figure returned; do not invent a cost.

The review began before the user clarified CoaDE-tutorial-first and before the
KSP/mod reference study. Those preferences supersede its proposed moon-first
opening. Its technical and interaction findings still apply. The review observed
some artifacts during active spike revisions; the final numerics note records
current values and limitations. No claim that the raw review describes a frozen
initial source revision.

| Recommendation | Disposition | Concrete resulting change |
| --- | --- | --- |
| First edit needs an objective and an early human check | **Adopted** | Tutorial-derived orbit-shaping target band; intentional move, undo and opposite change before full queue polish. Full M1 gate still required. |
| Open with pinned moon maneuver and a moon pass band | **Adapted** | User chose CoaDE tutorial first. Use its manual prefix and a two-body goal; retain the feasible moon band as a later diagnostic/encounter exercise. No new tutorial campaign. |
| Overview + encounter close-up, stable camera during manipulation | **Adopted** | Hold view scale during handle editing; add contextual close-up when moon pass becomes the task. Current retained viewer auto-fits only per frame; it is not an editor. |
| Semantic encounter identity differs from numerical root bracket | **Adopted** | Body/kind/time window identifies selected encounter; root brackets regenerate per revision. Missing/ambiguous events are explicit. Saved snap epochs do not silently move after upstream edits. |
| RK4 supported for retained paths, not unrestricted editing | **Adopted** | Validate reachable handle bounds and near-body termination; conservative unsupported-region stop permitted. Never execute unchecked paths through surfaces. |
| Add event-time, relative-velocity and classification accuracy | **Adopted** | Refined encounter diagnostics and step-refinement classification gates join position/pixel tolerances. |
| Disposable endpoints must not become checkpoints | **Adopted** | Canonical runner spec includes grid/event cursor, horizon extension and snapshot/reload partition tests; current immutable sample queries are insufficient. |
| Simplify first queue tie handling | **Adopted** | Reject duplicate burn epochs in M1; surface termination precedes coincident burn. Richer atomic logistics order comes with M3. |
| Keep TS + Python but withdraw “fastest” implication | **Adopted** | Justify by verified checkout and small model. Python native delivery need not be ported. SciPy independent oracle stays part of multi-body validation; PyKEP variational/CR3BP tools remain a later concrete option. |
| Measure first actual drag before worker/approximation work | **Adopted** | Pure browser propagation measured separately; input-to-paint is still unverified. Start accurate bounded predictions; worker/cancellation when needed, approximation only with evidence. |
| M2 should begin with narrow two-body targeting | **Adopted** | Fixed epochs, bounded player-seed correction, explicit angular sense/revolution/clearance checks for every trial, charge arrival matching, reject ill-conditioned/infeasible solve. |

Load-bearing main-agent checks:

- Inspected barycentric source formulas and independent NumPy acceleration; oracle
  error report supports short-fixture RK4 recommendation, not universal accuracy.
- Reproduced arbitrary endpoint continuation error `1.04913e-5` for h=0.25,
  endpoint 0.6 then 0.75 versus canonical continuation.
- Reproduced a 5x seed burn producing sampled moon-center distance ~0.01276,
  inside radius 0.025. This confirms the edit-domain warning; no collision-safe
  runtime has been implemented.
- Inspected installed CoaDE tutorial messages and focus sequence, including the
  no-mouse-hold handle instruction. Exact live interaction remains unobserved.

No second senior review was run; this is the main agent's disposition of the
single requested Astra review, including the subsequent human steering.
