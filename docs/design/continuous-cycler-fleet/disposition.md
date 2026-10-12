# Astra dispositions

Both reviews used read-only Codex CLI with transport-verified `gpt-6-astra`, high
reasoning, and exit 0. Design session `01a13191-cfb1-7973-a722-ded743b8ea71`;
implementation session `01a131a0-a1f4-71d1-ad0e-52b37a6d0de4`. Headers verified
before reading the final reviews. The design reviewer inspected retained sources;
the implementation reviewer also ran small arithmetic/admission probes. Main-loop
numerical and browser runs provide the propagation/performance evidence.

## Design

| Recommendation | Disposition |
|---|---|
| Separate free drift, burn correction and numerical projection; payment does not produce a position correction | Adopted: independent producer records all three. Explicit numerical phase projection supplies recurrence; physical feedback stability is not claimed. Owner subsequently authorized artificial stabilization at this scale. |
| Include burn, residual matching and allowance together under maintenance ceiling | Adopted: total ≤1e-5 per two-circuit macrocycle. Actual total ≈1.02e-8 / 1.05e-8. Both carriers are empty during their last-four-unit correction window. |
| Permanently debit carrier fuel using cumulative Δv rather than repeating tanks | Adopted: actual fuel `10 exp(-cumulativeDV/4)-4`, actual mass/force, unchanged six-unit initial tanks, reserve through the million-unit calendar. No automatic orbital refill. Rider-funded refuelling remains optional future work; upkeep is negligible here. |
| Bound retained, transient, held and resource storage separately | Adopted: clipped eight-unit chunks, 68/40k/24MB retained caps, 2MB/2500-row pending chunks, 16MB packets, one outstanding request, bounded held range and 40/42 resource anchors. Serialized bounds are not heap-byte guarantees. |
| Define recurrence/funding failure ownership | Adopted: whole-service event-left halt, exactly constructed calendar IDs, private preflight and atomic publication. Oversized publication permanently stops without advancing head. |
| Defer extra riders until recurrence/resource gate | Adopted: preserve accepted two-carrier/two-rider choreography in this slice. |

## Implementation

| Finding | Disposition |
|---|---|
| Division/reconstructed-epoch disagreement yields negative local phase and eventual failure | Fixed: exact aliases `k*T` and `(k-1)*T+T` canonicalize to explicit local 0/T, both sides tested at late epochs. Arbitrary neighboring epochs are not epsilon-snapped. |
| Repeated exact reload undercounts imported fuel/cargo | Fixed: shared constructed-event counting uses absolute epoch comparisons; tests cover exact, before and after reloads through cycle4096. |
| Duplicate/corrupt replacement chunks can alter held history | Fixed: replacement/duplicate indices reject; finite ordered sample/arc/ledger/boundary contents and derived bytes/counts validate before assignment. Admitted chunks are cloned; known-bad packets leave clock/history unchanged. Zero-Δv fuel queries clamp floating-point overfill to the anchor tank. |
| Browser locator cannot find Return to live | Fixed: test targets stable Live control ID; complete browser run includes reverse, held/Live, 3D, timeline resize and set switching. |

No changes to the accepted finite admission or legacy compact source fixtures.
