# Sol · Mars cycler — 2026-10-11

A finite solar-scale exhibit is implemented after two requested Astra reviews and
independent propagation/resource/browser gates. Owner visual acceptance remains next.
[Contract](../design/solar-cycler/README.md),
[review disposition](../design/solar-cycler/disposition.md),
[actual transport metadata](../design/solar-cycler/transport.json).

## Admitted journeys

Wayfarer completes three paid Earth-return turns, carrying a different Peregrine on each
outward leg. Each taxi departs a physical Earth gateway, matches the carrier, rides it,
separates, then matches a physical Mars gateway and delivers one tonne of freight. The
finite history spans6.566 years/2,398.29 days; Earth–Mars synodic spacing is779.95 days.
Moon/Jupiter phases advance independently through all three encounters. The carrier's
long coasts have zero thrust and begin at preceding actual endpoints.

This is fictional 50 km/s exhaust propulsion, not chemical Starship performance or an
admitted ballistic Aldrin cycler. The rejected seed's Earth flyby intersected the surface;
the admitted carrier stays distant and pays its turns. Bodies have real-like GM/radius/
distance proportions but prescribed circular ephemerides; spacecraft see the five-body
field with heliocentric indirect acceleration. Jupiter is context/perturbation, not a
serviced destination. No real mission ephemeris or planetary N-body evolution is claimed.

| Actor | Integrated thrust Δv, km/s | Final fuel, t | Certified acceleration upper bound, m/s² |
|---|---:|---:|---:|
| Wayfarer |23.7861|22.1436|0.01248|
| Peregrine1 |30.2984|7.6387|0.04794|
| Peregrine2 |26.1145|8.8290|0.04344|
| Peregrine3 |35.5402|6.2812|0.17758|

Each engine admits0.25 m/s²/31.25 kN, with at least10% initial-fuel reserve. Taxi figures
include paid capture residuals. The cubic-control acceleration bounds use Bernstein
hulls, not merely sampled peaks. Carrier mass includes the attached taxi; bus burns
occur outside ride intervals. Fuel and cargo are counted once across actors and stocks.
All117 t initial fuel is accounted for as retained inventory or consumption; all3 t cargo
arrives at Mars. Remaining taxi fuel transfers to Mars at explicit retirement. Reverse
scrubbing reconstructs these same event-derived inventories without duplicate transfers.

## Numerical witnesses

- [Independent TypeScript RK4](../design/solar-cycler/numerics.json) runs8,192/16,384 steps
  per frozen burn/coast from admitted initial states, never restarting from drawing
  samples. Nine burn endpoint disagreements against Python DOP853 are at most0.008213 m
  and3.844e-8 m/s. Fuel exponential discrepancies are below8.2e-15, versus1e-6 gate.
  Four zero-thrust coast endpoint disagreements are at most13.183 m and2.251e-6 m/s,
  inside the cruise1 km/0.01 m/s gate. These are segmentwise checks, not a claim of
  independent cumulative mission accuracy at every epoch.
- [Full gateway comparison](../design/solar-cycler/gateway-numerics.json) independently
  integrates RK45 and DOP853 from each gateway's original primary-relative state through
  the complete6.566-year interval, comparing2,052 epochs per gateway. Maximum disagreement
  is25.896 m/0.000550 m/s at Earth and67.888 m/0.001482 m/s at Mars. This uses the cruise
  gate, not the burn-endpoint metre gate. The initial lower-order tolerance failed; the
  refined comparison passed without changing physical bounds or vehicles.
- Independent PVA calibration checks the nested Moon origin and solar conversions.
  Close-burn primary-relative states reconstruct their absolute initial states; stable
  local separations and explicit origin acceleration retain the same full-field equation.
- Six captures have position residuals0.015–1.129 m and velocity residuals no larger
  than1.008e-5 m/s. The admitted caps are100 m/0.01 m/s. Each residual plus0.0001 m/s
  allowance is paid. Canonical event-left state/fuel and right-side correction are
  separately stored and checked; a known-bad large snap tests interpolation leakage.
- [Continuous clearance and display checks](../design/solar-cycler/display-numerics.json)
  certify216,047 intervals with a1,000 m numerical allowance and explicit Earth200 km,
  Mars100 km and Moon10 km surface exclusions. Full-provider Hermite midpoint position
  error is below1.95 m for spacecraft and379 m for gateways: <0.026 pixels at maximum
  zoom. This measures pose interpolation, not a universal polyline tessellation bound.

## Viewer and performance

1× advances one simulated day per real second; default4×, signed maximum±16×. The clock
and schedule show days. Heliocentric, Earth–Sun rotating, Earth/Moon/Mars/Jupiter,
gateway and spacecraft frames retain per-vertex epochs. The unresolved Moon marker
collapses into Earth until zoomed/selected. Existing3D/Follow/Chase, layers and scrolling
timelines are reused. Lifetimes clip frame drawing grids, while physical queries still
reject outside admitted intervals.

The artifact is13,306,228 bytes with85,239 physical rows, below16 MiB/120k budgets. It
loads lazily through the preparation worker; display retains finite strips of roughly
1,800 points per vessel plus exact control/event epochs. Playback has no online planner.
The gateways' full physical providers are compiler inputs; browser Hermite queries never
target a flight. A clean-cache compile reproduces the admitted controls/states in184.61 seconds on natto.
Compiler caches were removed after validation; JSON is self-contained.

[Production browser matrix](../design/solar-cycler/browser-profile.json): installed
headless Chrome on natto,1440×900 and3840×2160, system/Earth/Mars frames at16× for5 seconds
per case, all ordinary layers enabled. Observed frame intervals were16.8 ms atp95,
roughly60 FPS; drawp95≤5.1 ms, maximum7.0 ms. DOM count245–266. No page errors.
This is a local bounded diagnostic, not a hardware-independent performance guarantee.

Final functional browser check covers days/force units, all five body/rotating frames,
all three taxi frames near lifetime boundaries, hidden attached vehicles,3 t delivery,
rewind to1 t delivery, positive/negative16× and solar→Aster–Selene→solar switching.
19 focused simulation checks cover the new contracts and existing model-set/camera/
spatial/playback behavior. Final production build/typecheck and configured Python
Ruff-format/lint/ty hooks pass. Vite retains its pre-existing large-JS-chunk warning;
the new13.3 MB trajectory asset is separate and fetched only when selected.

[System view](solar-cycler.png) and [Earth departure](solar-earth-departure.png) were
visually inspected. These establish readable representative views, not owner acceptance.
Preview4178 remains available, owner tab untouched. Refresh and select **Sol · Mars
cycler**. Continuous resupply and local ground/Moon activity remain later slices.
