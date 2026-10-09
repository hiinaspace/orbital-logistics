# Maintained multiship exhibit

Bounded implementation following the user's 2026-10-09 authorization. Read
[brief](brief.md) and [Astra review](astra-review.md). Actual transport:
gpt-6-astra/xhigh, Codex CLI0.153.4, read-only, exit0, session
01a12268-3cd2-7c41-b220-9ee53baf7cca. The review covers the verified baseline,
not a final implementation audit.

| Recommendation | Disposition |
|---|---|
| Two assigned relays and one shared ballistic hub | Adopted. Quarter-orbit offset is chosen for earlier staggered flights/fewer failed windows in the finite phase probe, unchanged field/hardware. |
| Separate small runtime; atomic prepare/commit | Adopted. One private transaction clones lifecycle scalars/forks immutable owners; facts and shared stock are processed before sequential planners. Nothing escapes until synchronous installation. |
| Arrival before refuel; no speculative stock reservation | Adopted. Hub has two berths for two ships. Stable ship identity order allocates due requests; shortage retains attachment and retries after eight units. |
| Sealed exact canonical origin intervals | Adapted. Bounded24-entry cache shares completed intervals only, including the entire bundle/anchor/field/policy in its key. Active owners retain their own interval references. |
| Namespace streams and explicit relay reservations | Adopted. Lane identities fence station chunks; episode IDs include ship ID. Assigned relay reservation binds physical plan identity to capture/release. |
| Per-owner failure validity | Adopted. Failed capture/transfer/release stops that dependent pair at event-left. No later station target/frame query; healthy pair continues. |
| One expensive planner and peak accounting | Adopted. Sequential private preparation; unique physical Runner accounting plus conservative speculative guard and bounded cache/display/storage. Measure targets before choosing speed cap. |
| Smaller proof yields | Adopted for network admission. Coupled reconstruction yields between complete canonical blocks/legs instead of synchronously draining the whole proof. Legacy constructor remains compatible. |
| Competition, partition/cache, fault matrix,512 replay, browser | Adopted as evidence gates. Human viewing remains the cadence/taste gate. |

The network is an assigned service exhibit, not a general multi-visitor router.
Both relays have independent paid maintenance and actual attached visitor mass;
Equator remains ballistic with one actual depot stock and import stream. The
common deterministic planning barrier can delay publication but cannot invalidate
another admitted journey. No machine-time deadline changes physical admission.

Artifacts in this directory intentionally survive as bounded review/numerical/
browser evidence. Probe logs are retained; temporary browser reports/services are
cleaned after verification.

## Final envelope

See [implementation evidence](../../evidence/multiship-service.md).512 actual units
complete twelve returns with shared conservation and an independent original-anchor
oracle. Production Chrome1× through160 and2× through512 have no buffer exhaustion;
actual-frame maxima67/50ms. The network cap is2×. Future fleet scaling needs a new
measurement rather than borrowing the old single-visitor4× envelope.

## Evidence indexing

`runtime-tests.log` records the initial window/shortage assertions; the corrected
`runtime-tests-final.log` has the final three runtime checks, including late fault
retention. `full-browser.log` records34 passing checks and the reproduced invalid
comparison query; `browser-fault-final.log` verifies its correction. Browser160/512
JSON/logs record the isolated1×/2× witnesses. Command-log whitespace is normalized;
transport fields and numerical values are preserved. No temporary service is needed
to read these artifacts.
