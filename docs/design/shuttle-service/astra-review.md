# Astra senior review and disposition

Read-only Codex native subagent gpt-6-astra, xhigh, task /root/cache_review.
Two rounds: architecture proposal, then implementation/view-retention inspection.
The reviewer inspected remote source and ran independent bounded code probes.
It did not edit source. This is architectural and targeted numerical review,
not an exhaustive final-diff audit.

Approved scope: one fixed primary, two fixed complete templates/loadouts, one
engine-local cache, analytical terminals and at most two ships.

Applied dispositions:

- Adopted readonly PreparedFlight with prediction/execution using the same
  prepared provider. Fresh Runner test adapters advance; identity returns do
  not. Avoided inheritance exposing incompatible fork/restore/snapshot behavior.
- Retained canonical Runners instead of inventing a new dense physical provider.
  Reviewer measured about6703 nodes for the finite primary-only family; actual
  live fixed loaded/empty templates retain6577.
- Used actual physical pre-capture states for per-occurrence paid matches.
  Installed corrected resources, ledger and after-state, with actual source and
  post-capture rails. Preserved exact local event epochs.
- Pinned the new domain and froze definition identity. Cache keys cover validated
  world/template/loadout/policy; rejected occurrences keep normal retry behavior.
- Resolved the derived single-leg node allowance inside the old65536 maximum,
  with a separate20000 shared-node guard and honest resident cache statistics.
- Reduced drawing density2048→1024. Review predicted roughly88k rows at2048
  versus44k at1024, against the unchanged65536 budget. Actual soak peak48072.
- Removed duplicate dense historical descriptors from assembled new-domain scenes
  while retaining full source history. Kept predecessor/successor rows at trail
  and cursor cuts. Accurate rewind requires rebuilding view(oldCursor); no
  arbitrary old-time dense accuracy is claimed for a current assembled scene.
- Updated hook comments, pinned capture tolerances, and included cache's copied
  bundle/boundary/ledger/key serialization in storage bytes.

Reviewer probes: cached/fresh windows0,1,123 and each last admissible window
matched event kinds, with maximum sampled six-state difference2.50e-10 and
fuel9.89e-11. The reviewer also reproduced the redundant scene expansion and a
missing dense predecessor at the trail cut. The new regression checks both sides
of that cut against fresh propagation.

Main validation adds independent DOP853 replay, conservation/retry/fault/held
cursor tests,1024-unit two-ship soak, close-view error probes and live browser
playback. See the linked evidence for final results and owner viewing scope.
