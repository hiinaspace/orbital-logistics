# Solar transport

Accepted implementation direction: a watchable fictional Mars cycler using solar-system
proportions, with prepared local interactions. The separate `solar-transport-v1` domain
keeps the existing Runner, lunar services and atmosphere/staging models unchanged.

## Admitted exhibit

**Sol · Mars cycler** contains Wayfarer and three independently funded Peregrine taxis.
Each taxi departs the Earth orbital gateway, matches Wayfarer, rides its outward coast,
then separates and matches the Mars orbital gateway. Each carries one tonne of freight.
The carrier completes three Earth-return turns during a 2,398-day finite history.
Each encounter is solved at its actual epoch; Moon and Jupiter phases continue throughout.
Replay and reverse playback inspect this same immutable history and resource ledger.

This is a **powered** cycler with fictional 50 km/s exhaust vehicles. The initial
near-Aldrin seed required an Earth flyby periapsis inside the planet, so it was rejected.
The admitted branch encounters Earth at a safe distance and explicitly pays a roughly
8 km/s turn each cycle. It does not claim ballistic gravity-assist recurrence, a Starship
performance model, mission ephemerides or continuous resupply. Jupiter and the Moon
contribute gravity and viewing context; this slice has no local lunar or Jupiter traffic.

## Physical contract

Units are AU, Julian year and metric tonne. JPL's Sun/Earth/Moon/Mars/Jupiter-system GMs
and AU conversion set the proportions; Mars/Jupiter satellites must not be added with
those system GMs unchanged. Major bodies follow prescribed circular spatial ephemerides.
The Moon has nested Earth-relative position, velocity and acceleration. Spacecraft see
all five bodies throughout, using a nonrotating heliocentric force law with the indirect
acceleration of the origin. This is spacecraft propagation in a prescribed field, not
self-consistent planetary N-body motion.

Sun-only conics seed geometry. Coast velocity shooting and forward DOP853 propagation
admit the actual multi-body coasts. Every subsequent coast begins at the actual preceding
burn endpoint. A quintic candidate curve only designs acceleration samples; cubic
controls are frozen, then forward-integrated. Neither the curve nor drawing interpolation
resets the physical state. Frozen spline knots split integration intervals. Close burns
use stable, nonrotating primary-relative six-state coordinates while subtracting the
origin's acceleration from the same heliocentric equation.

The engine obeys T=m*a and dm/dt=-m*|a|/ve. Predeclared limits are 0.25 m/s² and 31.25 kN.
Wayfarer has 40 t dry mass and 60 t fuel; each taxi has 5 t dry mass, 1 t cargo and 19 t
fuel. All arrivals retain at least 10% of initial fuel. Attached taxi mass loads Wayfarer;
its turns occur outside attachment intervals. Earth starts with three consignments and
57 t taxi fuel; Mars receives cargo and each taxi's remaining fuel on retirement. Taxi
retirement is explicit, with no resurrection or replenishment disguised as recurrence.

Capture caps are 100 m position and 0.01 m/s relative velocity. Each accepted velocity
residual plus a 0.0001 m/s numerical allowance is charged as propellant. Event-left state
and fuel remain distinct from atomic capture/event-right values. Approach interpolation
uses the left side; resource changes occur only at their epoch. Versioned admission
checks controls, canonical origins, captures, fuel integrals, reserves and attachments.

Continuous clearance certification bounds relative-speed excursion and acceleration
inside a half-clearance neighborhood, subdividing until it certifies each interval.
It excludes Earth's surface plus 200 km, Mars plus 100 km and the Moon plus 10 km.
These margins are exhibit constraints, not operational flight certification.

## Numerical and presentation budgets

Independent TypeScript RK4 compares step-halved integrations against the Python DOP853
burn endpoints (1 m / 0.0001 m/s), fuel (fractional discrepancy <1e-6), and zero-thrust
coasts (1 km / 0.01 m/s). A separate full-horizon RK45/DOP853 gateway comparison uses
the cruise tolerance; it is not a claim of metre accuracy for every six-year orbit.
Exact capture sides and local/absolute initial-state conversion have separate tests.

The compiler bounds root calls, force evaluations and clearance work. The artifact is
limited to 16 MiB, 120,000 aggregate physical rows and 100,000 per stream. The preparation
worker loads it only when selected, admits a complete scene, then publishes one bounded
structured-clone reply. There is no planner on the playback path. Hermite drawing queries
are disposable. Drawing strips retain control/event epochs, with roughly 1,800 samples
per vessel and finite trail/forecast horizons. Unsupported frame epochs break paths;
physical queries still reject outside an admitted provider's interval.

The clock displays days; 1× means one simulated day per real second, default 4× and
maximum ±16×. Solar views have their own extent/zoom settings, a heliocentric view,
Earth–Sun rotating axes, and body/gateway/vessel centered views. The unresolved Moon
marker collapses into Earth at system scale, remaining visible when selected or resolved.
Existing Canvas rendering is retained after the 1440p/4K performance gate.

## Reproduce

```sh
uv run --project spikes/numerics python spikes/numerics/solar_transport.py
node --import tsx scripts/solar-evidence.ts
uv run --project spikes/numerics python spikes/numerics/solar_transport.py --validate-gateways
npm run build
node --import tsx --test tests/sim/solar-transport.test.ts
PLAYWRIGHT_PREVIEW=1 PROFILE_OUTPUT=docs/design/solar-cycler/browser-profile.json npx playwright test tests/browser/solar-transport.spec.ts
```

The compiler's trusted local pickles under `scratch/` are disposable development caches,
keyed by model policy/constants and initial/target states. Remove that directory when the
compile/validation round is finished. It is not a runtime dependency or committed asset.
The checked-in JSON contains all viewer data. [Review disposition](disposition.md) and
[validation evidence](../../evidence/solar-cycler.md) record the admitted boundaries.

## Sources and comparison

[JPL physical parameters](https://ssd.jpl.nasa.gov/astro_par.html) supply the constants.
[NASA's 1993 cycler study](https://ntrs.nasa.gov/citations/19930054986) and
[the circular/real-ephemeris follow-up](https://ntrs.nasa.gov/citations/20060029853)
inspire the recurring transport/taxi geometry; they do not validate this fictional set.
[SpaceX's Starship description](https://new.spacex.com/vehicles/starship) supplies the
orbital-refilling precedent, not the engine assumptions used here.

For comparison, the circular Sun-only Hohmann seed takes 258.87 days and has 2.945 and
2.649 km/s heliocentric endpoint velocity differences. The faster cycler seed reaches
Mars's orbital radius after about 146.5 days, with substantially larger taxi costs.
Those conic comparisons exclude local parking-orbit costs and are not alternative
admitted missions. Selection here favors visible recurring journeys rather than claiming
minimum fuel. Genuine assisted cyclers, a continuous resource calendar and local
Earth/Moon activity are later slices, after this exhibit's visual acceptance.
