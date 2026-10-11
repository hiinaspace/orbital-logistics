# Astra review disposition — 2026-10-11

Two requested read-only Codex CLI passes completed with actual transport
`gpt-6-astra`, reasoning `high`, exit 0 and nonempty reports. Architecture session
`01a12c7d-4ffd-7463-a1bf-341cc60eec17`; implementation session
`01a12cac-8059-7713-9d3b-6d59cd615287`. Headers/logs remain beside the reports.
Model metadata establishes transport, not correctness; findings were checked separately.

| Recommendation/finding | Disposition and checked consequence |
|---|---|
| Forward physical propagation owns execution; inverse curves only design controls | Adopted. Frozen cubic accelerations, canonical knot boundaries, actual-endpoint coast continuation. Independent TS RK4 reproduces all nine burn endpoints and four coasts. |
| Include complete declared field and heliocentric indirect acceleration | Adopted. Sun/Earth/Moon/Mars/Jupiter at actual epochs; nested Moon PVA calibration and stable primary-relative gravity. A missing Moon-origin acceleration in the new compiler was fixed before admission. |
| Do not admit the seed's subterranean Earth flyby | Adopted. Distant safe encounter and paid Earth turn; named fictional powered cycler. The review independently reconstructed the rejected seed geometry. |
| Freeze engines, mass, payload and reserves before solving | Adopted. 50 km/s exhaust, 0.25 m/s², 31.25 kN, 1 t per taxi and 10% fuel reserve. Failed early forward coasts were retargeted, not rescued by larger tanks/engines. |
| One transfer first, then actual-epoch three-cycle continuation | Adopted. First transfer/return feasibility preceded the full artifact. Moon/Jupiter do not reset with the Earth–Mars calendar. Three new visiting taxis replace unlimited resurrection/refilling. |
| Event/resource ownership and attached mass | Adopted. 117 t initial fuel conserved including consumption; 3 t cargo delivered. Exact boarding/release nodes, bus composite mass and no bus burns while carrying a taxi. Mars receives remaining taxi fuel at retirement. |
| Bound work, memory and browser costs | Adopted. Lazy worker preparation, 16 MiB artifact/reply, 120k aggregate rows, bounded route/certificate work, finite strips. Production 1440p/4K diagnostics at16× retain Canvas. |
| Taxi-frame orbit vertices can query outside lifetime (implementation P2) | Adapted. The direct physical probe reproduced a rejected out-of-range query, but existing projection already broke invalid segments; it did not establish a browser exception. Orbit grids now additionally clip to frame lifetime. All three taxi frames were exercised near both boundaries with enabled layers, without page errors. |
| Capture right-side rows leak into preceding interpolation; zero ledger debit (P2) | Adopted. Explicit before state/fuel, atomic right side, paid residual plus allowance. Known-bad 99-unit capture fixture proves the left-side test detects leakage; actual ledger debit tests cover all six captures. |
| Canonical metadata/captures insufficiently checked on preparation (P2) | Adopted. Missing/inconsistent local origins, oversized controls, 10 km capture claims, unpaid fuel and overlapping carrier burns reject before publication. Fuel rows independently follow the exhaust law. |
| Full gateway/coast checks required beyond burn endpoint oracle | Adopted with distinct tolerances. All cruise coasts and complete six-year gateway providers use1 km/0.01 m/s comparison; frozen burn endpoints use1 m/0.0001 m/s. This does not claim full-history metre accuracy or optimal trajectories. |
| Add orbital tanker/lunar activity after carrier/taxi feasibility | Deferred. This finite cycler is the solar-scale integration gate. Ground launch/atmosphere and continuous resupply remain independent next slices. |

A smooth-curve design alone did not pass: the first full-field continuation missed its
endpoints and exhausted fuel. Retargeting and freezing the actual control law addressed
that. AU-to-local conditioning and adaptive intervals crossing spline knots explained
later numerical failures; canonical primary-relative states and explicit knot boundaries
resolved the independently measured discrepancy without weakening comparison/capture
limits. A lower-order whole-horizon gateway comparison also required tighter tolerances;
its initial failed result was not admitted.

No new authoring/puzzle UI or real mission-fidelity claim is introduced. Human
choreography/pacing preference remains a viewing gate; no pending architecture approval.
