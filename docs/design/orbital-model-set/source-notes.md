# Model-set direction: primary references, 2026-10-07

These are root-agent source checks accompanying the independent Fable consultation.
The latest user request makes observation a sufficient goal; a construction puzzle
or policy-authoring gate is no longer a prerequisite for usefulness.

## Interactive observation is an existing product category

[NASA Eyes](https://science.nasa.gov/eyes/) describes browser-based exploration of
mission data, with time control and spacecraft-following views. It is a relevant
baseline to try before building a general solar-system viewer. The source page
was read; the root agent did not perform a hands-on Eyes usability test.

**Design inference:** our possible distinction is a small, legible transport model
set with coherent vehicle/cargo circulation, accessible reference frames and
optional counterfactuals. Neither exhaustive astronomical coverage nor mandatory
manual flight is necessary. If an existing viewer already satisfies the desired
experience, that is a useful outcome rather than a reason to invent chores.

## Named mission sets require versioned source and model scope

- [Gateway NRHO reference trajectory white paper](https://ntrs.nasa.gov/citations/20190030294),
  David E. Lee, 2019: describes a representative 15-year trajectory. It is a dated
  reference model, not evidence that an arbitrary two-body ellipse represents the
  Gateway orbit, or that a current Artemis architecture has been implemented here.
- [NASA Gateway orbit explanation](https://www.nasa.gov/centers-and-facilities/johnson/lunar-near-rectilinear-halo-orbit-gateway/),
  2022: establishes the NRHO concept and its operational rationale. Dates and
  mission commitments should be checked separately when creating an exhibit.
- [Cycler orbit between Earth and Mars](https://ntrs.nasa.gov/citations/19930054986),
  Byrnes, Longuski and Aldrin, 1993: describes gravity-assisted cycling with
  occasional maneuvers and a numerical multiconic study. This is a concept study,
  not a currently operating service or a trajectory already supported by our app.

The root agent verified these catalog/page descriptions, not their complete
numerical datasets. No source trajectory was downloaded or imported this turn.

## Implementation distinctions worth preserving

The current app has integrated test-spacecraft motion under prescribed gravitating
body paths, canonical simulation/event boundaries, sampled nonrotating centered
frames, layer controls, playback and future preview. It does not integrate all
massive bodies self-consistently, implement Gateway dynamics or a fleet scheduler.
These facts were checked in `src/main.ts`, `src/view/coordinates.ts`, `src/sim/`
and the current milestone evidence.

**Design inference:** separate how a scene is produced from how it is explored.
A manually authored program, an automatically selected finite schedule or sourced
reference states can each support interactive time and camera controls. Sourced
states must not be presented as an independently validated forward integration;
changing a trajectory requires a physically valid calculation or an explicit
illustrative model. This does not call for a generic provider framework now.

Likewise, scheduling among prepared transfer options and optimizing continuous
multi-body trajectories are different tasks. Finite fleet/capacity choices may
require integer decisions; mass-dependent propulsion is not automatically linear.
Start with a working curated scene rather than interpreting the user's automation
preference as a requirement to build an LP/MILP platform.
