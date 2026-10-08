# Astra propulsion review disposition — 2026-10-08

Transport verified before reading: codex0.153.4, gpt-6-astra/xhigh, exit0, session
01a11c6d-c32b-7573-b479-0455410f68b2. Review was read-only, no delegation. Main owner
spot-checked direct RK4 call sites, v2 unknown-field reconstruction, fuel display
and the interval endpoint/cap/depletion algebra. Claims hold. No human decision blocks.

| Recommendation | Disposition |
| --- | --- |
| Fixed propulsion mode and anchored exact mass law for every RK stage | Adopted; State6 remains kinematics, fuel/accounting live alongside it. |
| Start/end/cap/depletion canonical boundaries and explicit simultaneous order | Adopted; endpoint stage uses preceding mode, public endpoint exposes post-event mode. |
| New canonical schema/modelv3 with legacy propulsion-free conversion | Adopted; retain original JSON and one production dynamics implementation; reject legacy propulsion fields before conversion. |
| Partial fuel/usage and interrupted-arc accounting | Adopted; sample cumulative usage is authoritative, closing ledger never double charges it. |
| Powered acceleration added to clearance certificate, actual direction norm | Adopted; convergence remains separate from safety. |
| Four-control local family, Wren before Ibis, retain higher thrust if lowering fails | Adopted; independent fixed-time experiments already support complete Wren trips at force2/4. Failure is domain-limited, no general solver claim. |
| Separate residual scales and bounded evaluation accounting | Adopted; explicit normalized position/velocity scales and retained failure outcomes. |
| Pre-snap residual plus numerical allowance below1e-7, no explicit impulses in demos | Adopted; independent augmented-state DOP853 and three fixed-program RK4 resolutions required. |
| Smooth resource display and thrust telemetry/spans | Adopted; event-left resources preserve discrete service/refuel/capture changes. |
| No current human architecture question | Adopted; content/appearance remain hands-on taste checks after implementation. |
