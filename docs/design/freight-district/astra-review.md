# Astra review and disposition

Codex native read-only subagent gpt-6-astra, xhigh, /root/district_review.
Reviewed the architecture against235cace, then the implementation diff.
The agent inspected remote source and ran bounded numerical/transaction probes.
No CLI transport or independent source edits are claimed.

Applied architecture recommendations:
- Prove real latitude support first; keep continuous district equatorial.
- Introduce explicit surface-ports-v5 and reject old-version latitude fields.
- Use a rotating small circle and actual relative tangential speed for launch.
- Certify six-state endpoints through ordinary Runner operations and collisions.
- Release burn duration instead of introducing an online spatial optimizer.
- Derive pad/rocket normals and close cameras from three-dimensional geometry.
- Retain one TrafficEngine for shared stocks and assigned closed routes.
- Start Crown empty, forbid hub imports and track final delivery separately.
- Pass explicit cache source/destination IDs instead of choosing any other port.
- Retain all pulse/key/event epochs and measure separate physical/drawing budgets.
- Preserve old domain restrictions and read-only PreparedFlight semantics.

Review found one scheduling defect: Math.ceil on the window quotient could skip
a departure when loading finished at exactly the same representable epoch.
The parent replaced it with floor plus an actual departure comparison and added
exact-window and delayed-refuelling regressions. Astra independently checked
59994 route/window combinations with no skipped windows after the fix.

Independent reviewer probes:
- All six cached routes vs fresh integration at early, middle and near-calendar
  limit: max six-state difference1.98e-10 and fuel6.34e-11.
- Six cache references,10897 nodes,10688322 serialized owned bytes.
- Removing ground supplies stops onward delivery.
- Scarce hub fuel and limited hub capacity conserve resources to about1e-14;
  different work/advance partitions give identical snapshots.
- Latitude docking position1.09e-12, landing1.82e-10, final fuel.428234.
- Sampled display error at maximum1e6 scale: latitude.0454px, district rewind
  .000635px.

Final disposition: no remaining blocking findings in the reviewed diff.
Full regression, independent DOP853 replay and browser/playback evidence are
separate parent acceptance gates. Subjective owner viewing remains separate.
