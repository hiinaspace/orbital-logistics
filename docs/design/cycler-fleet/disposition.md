# Astra disposition

Transport: `gpt-6-astra`, high reasoning, read-only Codex CLI; session
`01a13169-5042-72c0-bcb7-1361337666eb`, exit 0. Verified transport header before
reading critique. Reviewer inspected sources and retained evidence, not new runs.

| Recommendation | Disposition |
|---|---|
| Resolve initial/final and lunar ground occupancy before claiming a fleet | Adopted: Cairn explicitly has two schematic berths; Haven retains one. Admission checks every half-open phase boundary over the complete horizon. Carriers each have one rider berth. Both event sides are tested. |
| Correct ascent baseline and compare whole lunar departure | Adopted: frozen source ascent is 0.842684, connection 0.861004, total 1.703688. New ascent remains 0.842684; parking is ballistic; connection 0.318923, total 1.161607 (about 32% lower). Full return reserve is checked. |
| Check drawing accuracy before thinning curved coasts | Adopted: disposable drawing intervals retain boundaries/control knots and subdivide on native quarter probes above 1e-6 position / 1e-5 velocity. Independent DOP853 drawing comparisons and production browser close views gate publication. No drawing sample becomes a target. |
| Shift both position and velocity, then separately admit each carrier | Adopted: positive-time periodic solution supplies only the second carrier seed. Each full forward physical history is independently propagated; no modulo/reset. Rotated controls are freshly replayed at absolute epochs. |
| Carrier identity must own physics, display and attached mass | Adopted: explicit outbound/inbound carrier IDs, exact native boarding/release, separate rider tanks, per-ride parent identity and carrier berth validation. Wrong parent fixtures reject and event-side mass tests cover both carriers. |

Finite gate only: one complete round trip per rider. Indefinite carrier stability,
continuous scheduling and optimality are not claimed. Existing single-carrier v1
fixture and admission remain available and regression-tested.
