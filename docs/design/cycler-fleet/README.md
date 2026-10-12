# Aster–Selene later-pass fleet

Two unpowered, time-phased carriers replace the need to chase one departing pass.
Pipit rides Wayfarer outward and Nomad home; Wren makes the opposite exchange.
Each rider finishes its lunar visit, waits on Haven, launches early and spends
roughly 10.75 time units in a real lunar parking orbit before a short two-pulse
connection to the later carrier. The accepted long Aster parking intervals remain.

The circular prescribed lunar field has a time/rotation symmetry: rotate both
position and velocity of a time-shifted solution by the opposite lunar phase to
obtain another seed. The second carrier is seeded from the first at half its
rotating-frame period, rotated by `-rate*period/2`. This is a numerical seed, not
a perpetual analytic ephemeris. Both carriers are independently integrated over
all 224.014027 time units. Their inertial orientations differ along with the
encounter phases; these are not arbitrary copies of a Kepler ellipse.

`cycler-fleet-profile-v1` is a separate bounded finite admission contract. It uses
the unchanged fixed-primary field, STEP=1/512, cubic steering, airless supported
pads, independently paid captures, actual mass/fuel and funded parcel reloads.
Carrier physics ignores attachment mass only because acceleration is gravitational
and neither carrier thrusts. Display mass includes each rider only during its
actual ride interval; rider resources never become carrier resources.

Cairn is an explicitly two-berth schematic ground terminal; Haven and each carrier
have one berth. Half-open phase intervals permit release/launch at an arrival
boundary; full coverage, paid event sides and every interval's occupancy are
validated privately before one worker publication. No joint online scheduler is
introduced. One mission per rider keeps the finite gate bounded.

Production reserves at most 360k native advances / 600k enclosure checks before
integration, local 180k/240k ceilings, 2.5MB source, 6MB template, 32k drawing rows
and 16MB conservative JSON reply. Calibration scales only physical work bounds
for h/2 and h/4. Drawing thinning preserves control knots and event boundaries;
three interior probes per interval trigger adaptive subdivision at 1e-6 position
or 1e-5 velocity error relative to native history. This is a measured drawing
accuracy gate, not a mathematical error bound for unlimited zoom.

Authoring: `search.py` checks twelve launch/boarding candidates, with per-shooting
trial budgets and sampled clearance rejection. The best successful witness is
frozen in `lunar-return.json`. Sampled authoring clearance is not certification;
`spikes/numerics/cycler_fleet.py` replays independent DOP853 oracles, and native
admission certifies every physical interval with moving-body enclosure checks.
The producer publishes the artifact only after all complete captures and fuel
reserves pass. The native/browser tests below are the final gates.

```sh
uv run --project spikes/numerics python spikes/numerics/cycler_fleet.py
node --import tsx --test tests/sim/cycler-fleet.test.ts
npm run build
PLAYWRIGHT_PREVIEW=1 npx playwright test tests/browser/cycler-fleet.spec.ts
```

See [Astra disposition](disposition.md) and
[validation evidence](../../evidence/cycler-fleet.md).
