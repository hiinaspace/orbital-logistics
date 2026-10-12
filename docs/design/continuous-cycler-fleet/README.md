# Continuous maintained cycler exhibit

**Aster–Selene · Continuous cycler fleet** repeats the accepted later-carrier visit:
Pipit rides Wayfarer outward/Nomad home; Wren makes the opposite exchange. Surface
dwell and real lunar/Aster parking remain. Each rider completes one round trip per
two-circuit macrocycle (241.00935265445608 units), with funded turnaround at Cairn.
There is no Beacon stop or broad carrier manoeuvre.

The carriers use an explicitly stabilized recurring model. A frozen four-unit C1
correction window at macrocycle end is empty of riders. Native forward admission
measures commanded Δv and remaining position/velocity error against the rotated
navigation seed, then permits a tightly bounded numerical phase projection. This
projection imposes recurrence; paying the residual allowance does not demonstrate
physical feedback stability or physically produce the tiny position correction.
The owner explicitly accepted artificial stabilization at this exhibit scale.
Independent evidence separates uncorrected drift, burn correction and projection.

`recurring-cycler-profile-v1` is separate from finite `cycler-fleet-profile-v1`.
Full macrocycle admission retains moving-body safety enclosures, C1 control/force
caps, native physical boarding nodes, paid captures, landing reserves and shared
berths. Total maintenance (commands + residual matching + allowance) is ≤1e-5 per
carrier/macrocycle; acceleration ≤1e-5, force ≤1e-4. The actual Δv is ~1e-8, mostly
the explicit numerical allowance. Maintenance is hidden from the large-burn
schematic; its detailed ledger remains in the prepared template.

Geometry and acceleration commands can rotate/recur while tanks cannot. Carrier
fuel derives from cumulative Δv: `10 exp(-DV/4)-4`; actual tank mass sets force and
carried riders add their own mass only over their own attachment intervals. Fuel
is permanently debited, with no orbital refill. The conservative calendar bound
retains ≥0.6 fuel through1,000,000 time units. Rider fuel/cargo renewal occurs only
at the admitted funded ground reload events; delivery consumption/imports remain
cumulative and reversible under scrubbing. Future useful maintenance costs could
be replenished by riders, as suggested by the owner.

The cache uses an explicit canonical phase grid for this version. Arbitrary
periods do not preserve the legacy absolute RK4 grid: late absolute-epoch replays
are separately tested against the same gravity and controls. Display samples are
never physical targets. Finite profiles are rejected by the recurrence compiler; continuous playback
requires the separately admitted template and retained bounds.

## Runtime and storage

The worker admits the entire macrocycle once, then publishes immutable clipped
**eight-unit drawing chunks**, without rerunning the solver or physics on playback.
A single clock commits exact constructed event timestamps. The preparation holds
at most360k advances/600k enclosure checks; source≤2.5MB and template≤6MB. Repeated
operations use absolute event comparisons, not unguarded quotient/floor arithmetic.
`k*T` and `(k-1)*T+T` are exact calendar aliases with explicit left/right handling.

The common head has32 units of lead and4 natural carrier periods of actual history
(482.018705 units); total visible retention is514.018705 units. Worker/frontend
caches each admit ≤68 chunks, ≤40k core drawing rows and ≤24MB serialized drawing.
One candidate chunk ≤2500 rows/2MB, one outstanding reply ≤16MB; a held response
cannot extend the retained range beyond514.018705 units. Frontend admission rejects
replacement chunks, invalid finite data and dishonest budgets before changing
clock, resources or held history. Admitted chunks are cloned. Resource anchors are
capped40 (42 with a held prefix). Shared templates and scene arrays retain shared
objects; these serialized bounds do not promise equal JavaScript heap size.

Funding/capture/maintenance failure halts the whole dependent service before its
event; no partial resource/capture publication. Packet preflight failure leaves
the published head unchanged and permanently stops that engine. Pause/held history,
reverse within retention and Return to live reuse existing viewer semantics. Replay
remains finite-only. Indefinite persistence, recovery/rescue and a general scheduler
are outside this prepared exhibit.

## Viewer

Cycler recommendation is a **two-loop trail**, with per-set remembered **0.25–2×**
length adjustment in Layers. Decay scales with that span; the old hard four-unit
exponential cap was suppressing long-loop history. Retention-edge fading remains.
The timeline has a30dvh maximum, vertical scrolling and a vertical resize handle.
Extra carrier/rider density can be a later content gate; two carriers/two riders
remain intentionally fixed here.

```sh
uv run --project spikes/numerics python spikes/numerics/recurring_cycler.py
node --import tsx --test tests/sim/continuous-cycler-fleet.test.ts tests/sim/trails.test.ts
npm run build
PLAYWRIGHT_PREVIEW=1 npx playwright test tests/browser/continuous-cycler-fleet.spec.ts
```

See [review dispositions](disposition.md) and [evidence](../../evidence/continuous-cycler-fleet.md).
