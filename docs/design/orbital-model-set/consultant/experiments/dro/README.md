# Planar DRO in the m0-binary moon fixture (offline witness)

**What this shows.** `fixtures/m0-binary.json` is the planar CR3BP with mu = 0.02. In
that system, planar distant retrograde orbits (DROs) about the moon exist. Single
shooting (perpendicular x-axis crossings, brentq on vx at the half period) converged
for all five far-side offsets d = 0.10, 0.15, 0.20, 0.25 and 0.30. All crossing
residuals are below 5e-15, and every sampled point circulates retrograde about the moon.
For the chosen member, d = 0.20: x0 = 1.18, vy0_rot = -0.564178, P = 2.79037 and
C_J = 2.90744. Its moon-center distance stays between 0.190 and 0.245, a surface
clearance of at least 0.165 (moon radius 0.025). It stays at least 0.810 from the
primary center.

The member was integrated in the inertial frame with the fixture's own force law and
both rails moving, using DOP853 with rtol 1e-12 and atol 1e-14, to t = 24 (8.6 P). The
rotating-frame closure error is 2.3e-12 / 4.2e-12 (position / velocity) at 1 P,
4.1e-12 / 7.4e-12 at 2 P, 3.8e-12 / 8.1e-12 at 3 P and 2.2e-11 / 4.4e-11 at 8 P. The
maximum Jacobi drift is 5.7e-12. An isolated-moon circular orbit at the DRO's
time-mean distance (0.221) would have speed 0.301 and period 4.63, against the DRO's
2.79. This is not a Keplerian moon orbit.

**What this does NOT show.**
- The app was not executed. The app's RK4 runner, step policy and `certifiedCoast` were
  not run on this state.
- No transfer from a low moon orbit (or anywhere else) into the DRO was computed. No
  delta-v budget is claimed.
- No stability or stationkeeping claim is made beyond the integrated horizon (t = 24).
  The small closure growth is consistent with the tolerances. It is not a stability
  proof, and no monodromy or eigenvalue analysis was done.
- NRHO and out-of-plane behavior are out of scope (2D model).

**Chosen initial state.** This is the inertial, barycentric state at t = 0 with the
moon at (0.98, 0), in the app's `ship.state` format `[x, y, vx, vy]`:
`[1.18, 0.0, 0.0, 0.6158221495873256]`

**Reproduce** (from the repo root, ~4 s):
`uv run --project spikes/numerics --group plots python docs/design/orbital-model-set/consultant/experiments/dro/dro.py`
The script writes `results.json` (all numbers plus provenance: fixture, mu,
tolerances, python/numpy/scipy versions) and `dro.png`. The PNG's left panel is the
rotating-frame family. Its right panel is the chosen orbit in the inertial frame for
3 P under the moving rails.

**Addendum: app Runner check (root consultant, same day).** `app-runner-check.ts` loads
`fixtures/m0-binary.json` unchanged except the ship state above, horizon 24, no burns, and
runs the app's canonical RK4 `Runner`. Status `horizon` (no unsupported approach, no
work limit). Rotating-frame closure after 1/2/3/8 periods: 2.4e-11 / 2.6e-11 / 5.7e-11 /
1.4e-10 position at the fixture's default step 1/512, and 2.5e-12 / 2.6e-12 / 5.8e-12 /
1.4e-11 at step 1/1024 (about tenfold better, consistent with the fourth-order method).
Minimum moon-centre distance 0.1901 in both. Numbers in `app-runner-check.json`.
Reproduce: `npx tsx docs/design/orbital-model-set/consultant/experiments/dro/app-runner-check.ts`.
So this DRO is a viewer-only scene the current engine can host today, without any new physics.
