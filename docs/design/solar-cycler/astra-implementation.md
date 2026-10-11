**Three P2 findings; no P1 found.** The numerical-frame formulation looks consistent, but the pending independent replay remains an acceptance gate.

1. **P2 — Taxi-centered frames can throw during ordinary drawing.**  
   [Frame transformation](/home/s/code/orbital-logistics/src/model-set/frames.ts:17) queries the vessel at each vertex epoch, while [orbit drawing](/home/s/code/orbital-logistics/src/main.ts:541) spans epochs outside a taxi’s finite lifetime. Checking the current cursor’s validity does not protect those vertices. A direct probe reproduced `Solar query outside admitted interval` for Peregrine-2.

   **Fix/check:** Clip drawing intervals to the selected frame provider’s validity and break unavailable path segments. Selecting each taxi-centered frame with orbits, trails and forecasts enabled must remain exception-free near both lifetime boundaries.

2. **P2 — Capture changes leak into the approach interval, and the ledger loses their fuel debit.**  
   The compiler [replaces capture endpoint rows with post-capture states](/home/s/code/orbital-logistics/spikes/numerics/solar_transport.py:599). [State and fuel interpolation](/home/s/code/orbital-logistics/src/solar/query.ts:23) then uses those event-right rows for times before capture. Meanwhile, [capture ledger construction](/home/s/code/orbital-logistics/src/solar/view.ts:41) records identical before/after propellant and zero fuel used.

   The current first capture produced approximately **4 mm position and 0.032 mm/s velocity** differences at the preceding interval’s midpoint when comparing post-capture versus preserved pre-capture endpoints. The admitted 100 m position snap permits substantially larger artifacts.

   **Fix/check:** Preserve event-left state and fuel for approach interpolation; apply capture atomically at its epoch. Assert correct left/right limits and a ledger fuel debit matching the paid residual plus allowance.

3. **P2 — Admission does not enforce the new canonical-state or capture contract.**  
   [Preparation](/home/s/code/orbital-logistics/src/solar/view.ts:26) validates row shape and coefficient dimensions but omits canonical local-state consistency and capture limits. In-memory mutations removing `localInitial`/`referenceBody`, or setting a capture’s recorded position error to **10 km**, were both admitted.

   **Fix/check:** Reject missing/nonfinite canonical metadata, verify local-to-heliocentric initial-state agreement, and validate capture records against endpoints and paid costs. Also assert attachment/burn non-overlap: the carrier’s fuel law assumes its own mass during burns. These are internal generation checks, without requiring an external-input framework.

The inspected physics supports the intended contract:

- Primary-relative propagation subtracts the prescribed origin’s acceleration while retaining heliocentric indirect gravity and stable local separations. I found no force switch or hidden trajectory reset; subsequent carrier coasts start from actual burn endpoints.
- Compiler targeting uses propagated providers, independently of drawing samples. Main/frame branches use explicit solar providers.
- Separate taxi retirement transfers remaining fuel to Mars; the read-only endpoint accounting probe conserved **117 t** of initial propellant, including consumption. Attached-mass display accounting is compatible with the stated burn-free ride intervals.

The independent script currently checks **burn endpoints**. Its success would not by itself establish full-horizon gateway/coast accuracy or event-side correctness. Keep the **1 m / 0.1 mm/s** gate pending; verify local/absolute initial-state agreement alongside it.

Review stayed read-only, with six source-read batches and small in-memory probes. No edits, delegation, compiler run or full test suite. No human taste decision is needed for these findings.