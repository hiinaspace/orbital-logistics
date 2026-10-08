# Consultant recommendation: an orbital model set, not a game

2026-10-07. Independent cross-model consultation (Claude Fable 5.1, `--effort high`,
via `claude -p`) at the user's request, in the same broad style as the earlier Astra
consultation. Research, design and bounded offline experiments only. No app code,
settings, dependencies or git state were changed. Subagents (two Sonnet research
notes, one Opus and one Sonnet experiment) were explicitly model-selected; the root
agent ran two further witnesses through the app's own `Runner` and wrote this synthesis.
Nothing here is authorization to implement; it is a recommendation for the user's
design review.

## Recommendation in one paragraph

Take the user's drift at face value and reframe the product as a **curated orbital
model set**: a small, honest, scrubbable world in which a few named vehicles circulate
on schedules the computer worked out offline, watched through freely chosen reference
frames. The user's ownership comes from choosing and arranging the set and the
viewpoint, not from authoring maneuvers or policies. Build the smallest viewer slice
that tests whether watching stays rewarding across several sessions: overlay a few
validated single-ship runs, add a rotating reference frame, add event jumps and a
per-ship manifest, and ship three synthetic sets that this consultation has already
witnessed physically. Retire the puzzle acceptance gates (voluntary optimization,
courier reorganization) as gates; keep every physics-truthfulness constraint. Defer the
fleet runner, the schedule generator, real ephemerides and 3D until the watching test
says they are wanted. If the test fails, the cheapest honest outcome is that an
existing viewer such as NASA's Eyes already covers the pleasure, and the project can
stop or return to a finite puzzle without regret.

## 1. What the product object is now

The user's own words map cleanly onto the model-railroad hobby, which has already
split this experience in two: **continuous running** (watch trains run on a loop) and
**operations** (timetables, waybills, dispatching). Sources are in
[viewer-sources.md](viewer-sources.md). Published track plans sell as a product in
their own right, and the hobby's own automation (JMRI Operations and Dispatcher)
generates manifests and runs trains automatically while expecting a human to
supervise, not to drive. The user is describing the continuous-running side with
optional, automated operations underneath.

So the product object becomes:

| Model-railroad part | Orbital model set | Who authors it |
| --- | --- | --- |
| Layout | Bodies on prescribed rails, kinematic ports with finite stocks, the scene's units and horizon | Curated by the set, light knobs for the user |
| Rolling stock | A few named ships with dry mass, tank, cargo capacity, identity | Curated by the set, fleet size as a knob |
| Timetable and waybills | Absolute programs (burns, dock/undock, transfers) emitted by an offline set builder | The computer |
| The viewing | Frames, follow cameras, time rate, scrub, event jumps, manifest | The user, live |

The important move is that **the program JSON stays the contract**. Whatever produces
a program offline (hand authoring, the existing targeter, an enumerating dispatcher, a
SciPy shooting script), the viewer executes it through the unchanged canonical
`Runner`. That keeps every existing truthfulness constraint intact: shared
prediction/execution dynamics, canonical checkpoints, paid captures, frames that never
alter a burn, no hidden route selection (the dispatcher's candidate table becomes a
saved artifact, as the earlier Hohmann scan already is). The viewer never computes
routes; it replays and lets the user look.

Honest labelling matters more in a viewer than in a puzzle, because nothing else
pushes back. The product should say, on screen, what the model is: planar;
test-particle spacecraft under prescribed circular rails; impulsive burns; massless
kinematic ports with finite stocks; not a self-consistent massive-body N-body
simulation. The user's phrase "n-body simulation" should not become the label.

## 2. Why watching can be rewarding, and what that implies

Sourced observations (details and URLs in [viewer-sources.md](viewer-sources.md)):

- Model-railroad operations writers describe the pleasure as cars with jobs (waybills),
  trains "making their meets", and a fast clock that gives a session an arc.
- NASA's Eyes is an existing, free, real-ephemeris viewer with time control from 1950
  to 2050, a 2026 "Trajectory View", and Artemis II tracking. It has no fleets, cargo,
  schedules or what-ifs. None of KSP's tracking station, Universe Sandbox, SpaceEngine,
  Orbiter or Celestia offers scheduled traffic as the thing to watch.
- Zachtronics loop GIFs and OpenTTD/Factorio "watch the base run" are anecdotal but
  consistent: the loop reads as machinery footage once it is a working system.

Inferences for this product, ranked by expected pleasure per unit of work:

1. **Reference frames are the scenery.** The user said the frames were the fun part
   even with no input. The current viewer has only translating frames (inertial,
   body-, ship-, port-centred). A **rotating frame** is the missing one: in the moon
   fixture a distant retrograde orbit is a clean closed loop in the rotating frame and
   an epicyclic swirl in the inertial frame (see `experiments/dro/dro.png`); a Hohmann
   hop seen from a frame co-rotating with its destination port is a drift-and-catch.
   This is a per-sample view transform with zero physics risk, provided displayed
   velocities include the rotation-rate term the charter already warns about.
2. **Identity and jobs.** Name the ships; show each one's cargo and fuel gauge and its
   next event. A parcel with a waybill (Home → Depot) is the orbital car card.
3. **Meets.** Two ships at one port, a taxi meeting a cycler, a tug arriving as another
   leaves. These need more than one ship on screen, which is the one real engineering
   gap (section 4).
4. **A clock with structure.** The synodic period is the timetable. Show the next
   departure window and let the user jump between events; slow down automatically
   near docks, burns and closest approaches; warp through quiet coasts. The existing
   ledger already enumerates the events and the scrub is canonical, so this is UI work.
5. **Honest loops.** A scene whose rails have commensurate periods is *exactly*
   periodic (the 2:1 cycler set below returns to its full initial state every 4π).
   That is a model-railroad loop that is physically true, not a replay reset. Scenes
   with incommensurate periods (the current Home/Depot pair) do not loop and should
   not pretend to.
6. **Light intervention, later.** Fleet size, a fast/cheap policy, dropping one ship
   from the schedule and watching the knock-on. JMRI's authors pair automation with
   supervised hand-off; the orbital analogue is a few knobs that regenerate the
   schedule offline, not a policy editor.

The screensaver failure signature, per the same sources: identical loops with no state
change, no interaction between movers, one viewpoint, no time structure. Items 1 to 5
are the antidotes; none of them is a chore.

## 3. The automation ladder and where the work runs

| Rung | What it means here | Needed for the model set? | Where it runs | Truthfulness contract |
| --- | --- | --- | --- | --- |
| Supply a solved trajectory | A program JSON authored offline (hand, targeter, SciPy) | Yes, already exists (`scripts/m4-fixture.ts`, fixtures) | Offline | Runner executes; oracle cross-checks |
| Schedule over prevalidated transfers | Enumerate departure windows for N ships over a catalogue of validated legs; pick by a stated policy; emit programs | Yes, as the "set builder", after the watching test | Offline script or worker | Candidate table saved; chosen alternative labelled; stocks checked in time order |
| Local targeting | Refine an analytic seed into the actual field | Only for multi-body sets (DRO shuttles) | Offline SciPy shooting first; the app targeter stays fixed-primary | Accepted program revalidated by the Runner |
| Feedback execution / runtime intent | Correct each voyage from its real state | No | Deferred further than before | Unchanged `docs/route-intent.md` seams |
| Global continuous optimization | Optimize trajectories and schedule jointly | No | Not planned | Not needed for pleasure |

The user's "linear programmer" is a wish for automation, not a formulation. For sets
of two to four ships and two or three ports, exhaustive enumeration over a transfer
catalogue (what the Astra witness already did by hand for five organizations) is
simpler, deterministic and fully inspectable, and it respects the integer and
mass-dependent structure that an LP would have to fake. Reach for a solver only if
enumeration becomes combinatorially heavy, which is an untested hypothesis today.

## 4. What this consultation witnessed

Three bounded experiments, all reproducible from the repo root, all with explicit
limits in their READMEs. None is app UI, and none says anything about fun.

**Shuttle overlay through the app's Runner** (`experiments/shuttle/`). Two tugs fly the
accepted M4 patient program staggered by one synodic period (15.854), each as an
independent single-ship run of the unchanged `Runner` to horizon 64. Both complete and
return docked. Merging their ledgers in time order against one shared stock shows no
contention for two tugs (Depot fuel 0.25 → 0.05), and that a third refuel visit would
over-draw Depot fuel. Conclusion: an overlay of independent runs is honest exactly when
an offline shared-stock check passes, and that check is twenty lines. A shared-stock
fleet runner is only needed for sets where contention is part of the show.

**Synthetic 2:1 cycler** (`experiments/cycler/`, SciPy, no app run). Ports A (r=1) and
B (r=2^(2/3), period exactly twice A's) and a ballistic ellipse with periapsis at A and
period 4π. The cycler re-meets A every period and B at a fixed crossing every period
with zero burns (DOP853 distances at re-encounter ≤ 3e-11 over three periods). Riding it
is not free: boarding from A costs relative speed 0.170 and alighting onto B 0.299, total
0.470 against Hohmann's 0.204, about 2.3× the Δv and 2.4× the propellant, in exchange for
a flight of 2.40 instead of 4.62. The alighting cost comes from a 21.7° flight-path angle
at equal speed. This is the honest, toy-scale version of the real cycler fact that the
taxi pays for the flyby. It re-encounters only because the periods were chosen
commensurate; a massless port cannot supply the Earth gravity assist that rotates the
real Aldrin cycler's line of apsides. The whole scene is exactly periodic at 4π.

**Planar DRO in the existing moon fixture** (`experiments/dro/`). `fixtures/m0-binary.json`
is a genuine barycentric planar circular restricted three-body setup with mass ratio
0.02. A family of distant retrograde orbits about the moon converged by single shooting
(five members, residuals ≤ 5e-15). The chosen member (x₀=1.18, period 2.790, moon-centre
distance 0.19 to 0.245) was then run through the **app's own RK4 Runner** with only the
ship state changed: status `horizon` to t=24, rotating-frame closure 2.4e-11 after one
period at the default step and 2.5e-12 at half step. A DRO is the orbit Artemis I
actually flew (about 70,000 km beyond the Moon); it is representable in 2D today with no
new physics. An NRHO is not (section 5). No transfer into the DRO was computed; the
current targeter cannot do it, an offline shooting script could.

## 5. Real mission sets: what 2D can show honestly

Sourced in [mission-sources.md](mission-sources.md); status facts as of 2026-10-07.

- **Artemis II flew** 2026-04-01 to 04-10 as a free-return lunar flyby. **Artemis III**
  is now a crewed low-Earth-orbit docking test in 2027, per NASA's page updated
  2026-10-06. **Gateway was paused** "in its current form" on 2026-03-24; its final
  funding disposition is unresolved in the sources found. Both lander contractors said
  they do not prefer NRHO. So an "Artemis/Gateway NRHO set" would be a documented
  concept or legacy plan, not a live program, and should be labelled so.
- **NRHO** (southern L2, 9:2 synodic resonance, period ≈6.56 d, perilune radius ≈3,400 km,
  apolune ≈71,000 km) is a 3D halo-family orbit passing over a lunar pole. A planar
  model cannot show it. The planar stand-in is the DRO above, which is also the orbit
  Artemis I really used.
- **Aldrin cycler** (a=1.60 AU, e=0.393, two vehicles, one loop per 2.135-year synodic
  period) depends on an Earth gravity assist each cycle; Mars encounter speeds are of
  order 6 to 12 km/s and Earth 5 to 7 km/s (the V∞ figures came from search excerpts,
  not the papers' text; treat as approximate). A fixed-Sun planar toy with a massless
  Earth cannot reproduce the apse rotation. A toy with a *massive* Earth on a rail could
  in principle, but at realistic mass ratio and flyby altitude the fixed-step RK4 and
  clearance certificate would almost certainly hit the work limit; at an exaggerated
  mass ratio (like the moon fixture's 0.02) it might work. Untested hypothesis.

Recommendation: **synthetic sets first, named sets later, never a named set at the
wrong physics without a label.** The three synthetic sets already witnessed cover the
three shapes the user named: a shuttle service, a cycler, a station in a three-body
orbit. If the user's pleasure turns out to need real names, dates and scale, NASA's Eyes
already provides exactly that for real missions, and the honest next question is what
this project adds beyond it (fleets, cargo, what-ifs, frames), not whether to rebuild it.

## 6. Key choices, with a recommendation each

| Choice | Options | Recommendation | Why |
| --- | --- | --- | --- |
| Product object | Puzzle game; policy/dispatch game; curated model set viewer | **Curated model set viewer** with optional light knobs | Matches the user's stated pleasure and the evidence from the demos; removes the unresolved "what does the player author" problem instead of solving it |
| Multi-ship | Overlay independent runs; shared-stock fleet runner; joint handoffs | **Overlay first**, with the offline stock check; fleet runner only after the watching test passes | The `targetReference` pattern in `main.ts` already draws a second Runner; the shuttle witness shows when overlay is honest |
| Schedule automation | Hand-authored programs; enumerating set builder; LP/MILP | **Hand-authored for the test, enumerating set builder next**, no solver | Inspectable candidate tables satisfy "no hidden route selection"; small sets don't need a solver |
| Frames | Keep translating frames; add rotating (synodic, port-co-rotating) | **Add rotating frames first** | Highest pleasure per effort, zero physics risk, and the DRO/cycler sets need them to read |
| Content | Synthetic; named-real; both | **Three synthetic sets now**, named sets only with honest labels | Section 5 |
| Time | Free scrub only; event list with jumps and auto-slow | **Event jumps and auto-slow** | Ledger and canonical scrub exist; it is UI |
| Acceptance gates | Keep M4 product gate / courier probe; retire | **Retire as gates**, keep the puzzles as a sandbox mode | The new goal does not require authored decisions |
| Runtime intent, recipes, joint handoffs | Build; defer | **Defer further** | Nothing in a viewer needs them; offline compilation replaces them |

## 7. The smallest discriminating experience test

Build a "set viewer" slice on the current app, roughly in this order and no larger:

1. A **set bundle**: one scenario plus up to four programs, each validated by the
   existing schema, drawn as additional runners with their own trails, names and gauges.
   Shared playback, scrub and frame selection. Port stocks are checked offline by the
   shuttle script's method and the set is refused if contention exists.
2. A **rotating frame** option for scenes with a circular-rail body or a port, as a
   view-only transform of every sample at its own epoch.
3. An **event list** built from the ledgers with jump-to and automatic slow-down near
   events, and a **manifest panel** (ship, job, cargo, fuel, next event).
4. **Three sets**, all witnessed above: the two-tug shuttle service on the existing
   Home/Depot fixture; the 2:1 cycler with its two ports (ballistic cycler as the ship,
   taxi legs added only when the overlay exists); the DRO station in the moon fixture
   (viewer-only; a shuttle to it needs an offline shooting script, which is a nice
   bounded follow-up, not a prerequisite).

Then the user watches, with no authoring, in short sessions on at least three separate
days, and keeps a few lines per session: which frames were used, whether events were
jumped to, whether the urge to edit something arose, whether the session was
unprompted. The author of the slice should also record what felt like a chore.

Pass: unprompted return on at least three days, at least two frames used by choice,
and at least one moment the user would describe to someone else. Then invest in the
set builder, the shared-stock fleet runner, the cycler taxi and the DRO shuttle.

Falsifiers, and what each would mean:

- **No second unprompted session.** The pleasure was novelty. Do not build the fleet
  runner; the project can stop here honestly, or stay a sandbox.
- **The user keeps reaching for the editor.** Authoring is the pleasure after all.
  Return to the finite mission-design direction the earlier consultation kept open.
- **The user wants real names, dates and scale.** Evaluate NASA's Eyes first; only
  then consider ephemerides and 3D, which is an engine rewrite.
- **Only the inertial frame gets used.** Drop further frame work; invest in identity
  and events instead.

## 8. What changes relative to the previous proposals

| Previous element | Disposition | Reason |
| --- | --- | --- |
| Player-authored object (journey, courier organization) | **No longer required** | The user does not want to design policies; ownership moves to set choice and viewpoint |
| Three-port courier probe as the next gate | **Retire as a gate**; its witness becomes a candidate set | Voluntary reorganization is not the goal; the scene itself is still good content |
| Recipe/timeline compiler | **Stay deferred**; replaced by an offline set builder emitting absolute programs | Repetition becomes a schedule property, not a runtime language |
| M3b joint handoffs, runtime intent | **Defer further** | A viewer needs neither |
| Multi-ship | **Promoted**, but as overlay then shared-stock runner, not joint handoffs | It is the one thing "watching a fleet" needs |
| Rotating frame ("when the fixture benefits") | **Promoted to first viewer feature** | Frames are the stated pleasure; the DRO only reads in one |
| Nondominated solution tables, scoring | **Demote to gauges and manifests** | Information, not acceptance |
| Manual editor, targeter, puzzles | **Keep as a sandbox/inspection mode**; not the product centre | They are the debugger and the authoring tool for sets |
| Physics and truthfulness constraints | **Unchanged** | A viewer with nothing pushing back needs them more, not less |
| Replay/export | **Keep**; loop capture becomes more relevant for exactly periodic sets | Shareable loops are a documented pleasure in adjacent hobbies |

## 9. What would justify the bigger moves later

- **Real ephemerides / 3D**: only the third falsifier above, and only after comparing
  against NASA's Eyes. Out-of-plane dynamics, SPICE-style data and 3D cameras are an
  engine and renderer rewrite; nothing in the witnessed sets needs them.
- **Adaptive / higher-order integration**: only when a wanted scene fails the clearance
  certificate or work budget. The candidate trigger is a massive-Earth gravity-assist
  cycler; try it at an exaggerated mass ratio first.
- **A scheduling solver**: only when the enumerating set builder cannot cover a wanted
  set. Expect this beyond roughly four ships and three ports, untested.
- **Shared-stock fleet runner**: when a set's point is contention (a depot running dry,
  a berth in use). The shuttle witness shows the current fixture reaches that at the
  third refuel.

## 10. Facts, inferences, hypotheses

**Sourced facts** (URLs in the two source notes): model-railroad operations vocabulary
and JMRI automation; NASA's Eyes feature set and its lack of fleets; Artemis II dates
and profile; Artemis III redefinition and Gateway pause; NRHO and DRO parameters; Aldrin
cycler elements and the need for Earth gravity assists; JPL periodic-orbit catalogue
conventions. Weakly sourced: cycler V∞ magnitudes (search excerpts), Eyes' use of SPICE.

**Computed here**: the three witnesses in `experiments/`, with tolerances and limits in
their READMEs and JSON. The DRO was additionally executed by the app's own Runner.

**Inferences**: the model-railroad mapping; the ranking of pleasure mechanisms; the
automation ladder; the claim that overlay-plus-offline-stock-check is honest; the claim
that a rotating frame is the highest-value viewer feature; that NASA's Eyes is the right
comparison if "real" is what matters.

**Untested hypotheses**: that watching stays rewarding over several sessions (the whole
point of the test in section 7); that a massive-Earth toy cycler is integrable under the
current step policy; that enumeration suffices as the set builder; that exactly periodic
sets are more pleasant to watch than non-periodic ones.

## Artifacts and provenance

- `recommendation.md` (this file), `README.md` (index and reproduction).
- `mission-sources.md`, `viewer-sources.md`: subagent research notes, each fact tagged.
- `experiments/shuttle/`: `fleet-overlay.ts`, `results.json`, `README.md` (app Runner).
- `experiments/cycler/`: `cycler.py`, `results.json`, `cycler.png`, `README.md` (SciPy).
- `experiments/dro/`: `dro.py`, `results.json`, `dro.png`, `app-runner-check.ts`,
  `app-runner-check.json`, `README.md` (SciPy, then app Runner).

Operational notes: no authentication or tool failures in the root session. Subagent web
fetches hit a few paywalls, 403/429 responses and a binary PDF; each is recorded under
"Operational issues" in the respective notes and the affected claims are marked weak.
