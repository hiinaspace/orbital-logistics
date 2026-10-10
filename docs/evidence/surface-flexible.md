# Orison surface relay service

The new **Orison · Surface relay service** set reuses prepared airless launch and exact-pad descent paths while solving orbital flight and loaded Meridian stationkeeping live. Default playback is 1x, capped at 2x. Surface view and slower playback show the local detail; ordinary frames/3D/Follow/Chase show the service cycle.

## Numerical and rolling evidence

Final 1,024-unit runtime witness completes 15 funded returns and admits the next tour, with zero planning retries and zero stationkeeping failures. Maximum fuel-balance error is 4.27e-14. Shared templates retain 7,392 packed nodes/473,088 bytes per realm; retained view peaks at 6,603,824 bytes, 26 chunks and three visits. Existing budgets are unchanged. Non-isolated runtime cost is recorded in surface-flexible-runtime.json; it is not an isolated wall-clock viewer throughput result.

Independent DOP853 replays the original loaded station stream through 1,096, including visitor capture, funded top-up and release. Sampled station errors are position <=1.70e-11, velocity <=3.22e-12 and fuel <=2.35e-14. Early/late outbound/inbound legs agree to <=1.06e-12 position from their exact admitted initial anchors. Surface cache samples across early/late phases agree to <=4.40e-10 state error and <=3.70e-13 fuel error. Position error is <.00041px at maximum 1e6px/radius zoom. Surface forces are generated from actual mass and the same steering law, rather than interpolating force directions.

The primary-only surface approximation is separate from this numerical error: representative full-field unconstrained point references differ by <=.000340 radius position and <=.000429 velocity. The ground operation model switches at named paid interfaces. Those diagnostic references are not a full-field landing proof.

Runtime/resource evidence: [runtime](surface-flexible-runtime.json), [oracle](surface-flexible-oracle.json), [inputs](surface-flexible-input.json). Replay with npx tsx scripts/surface-flexible-evidence.ts then uv run --project spikes/numerics python spikes/numerics/surface_flexible_oracle.py.

## Verification

The new simulation cases check acceleration geometry across load/rotation, force saturation and reserve rejection, one tank and complete touchdown-before-refuel, exact event times, loaded ownership, held history, subsequent admission, corrupted handoff rejection, and immutable forecasts across all three dependency failures. Browser checks exercise launch/descent whiskers and actual force, surface/3D/see-through viewing, 2x live playback, two completed tours, rewind/refuelling and fixed/continuous worker changes. 191 simulation tests pass. The final fault-knowledge assertions also pass in a focused three-test rerun after the view refinement. Four distinct production Chrome checks pass: the new surface service, existing flexible service, staging, and atmospheric mission. The final new-service/atmospheric checks were repeated against the final bundle. The old atmospheric test hit its 30-second overall limit during concurrent numerical work; an isolated rerun with a 90-second test limit passes in 9.8 seconds, without changing its assertions. Build/typecheck and configured all-file Ruff format/lint/ty hooks pass.

The actual-frame 2x browser interval sustains 1.99943x, minimum committed lead 21.963 units, zero buffer-underflow frames, and maximum frame gap 50.1ms. This is a measured interval on the development host, not a guarantee for other browsers or larger networks. [Playback witness](surface-flexible-playback.json). Both close screenshots were inspected; see-through bodies exposes the far-side 3D launch and the top surface view shows descent to Equator.

Architecture review and dispositions: [Astra disposition](../design/surface-flexible/disposition.md).
