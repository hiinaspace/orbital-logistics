# Staged Aster–Selene expedition

The current lunar controls include a [reviewed refinement](../staged-refinement/disposition.md).
The author and original measurements below describe the initial witness; running
that author alone regenerates the old controls. Use the refinement reproduction
instructions for the current programs.

An authored atmospheric launch with a reusable booster, lunar orbiter and
single-piece lander. Atlas separates from Odyssey/Eagle after the boost;
Odyssey parks around Selene while Eagle lands at Tranquility, stays for two
time units, ascends and rendezvous with the actual coasting orbiter. Eagle
rides home attached. Atlas and the combined return vehicle recover in Aster's
atmosphere.

The finite fixture is
[aster-selene-staged-expedition.json](../../../fixtures/model-sets/aster-selene-staged-expedition.json).
The domain is deliberately a fixed phase graph, implemented by
[staged-apollo.ts](../../../src/model-set/staged-apollo.ts), using existing
atmospheric propulsion, canonical vacuum Runner, paid capture, supported
surface poses and absolute-time entry-v3.

## Ownership and mass

There are three hardware inventories. The launch stack is a presentation and
engine-owner assembly, never a fourth tank. Each engine draws exclusively from
its own tank. Attached dry hardware and its remaining protected fuel contribute
to acceleration caps, atmospheric loading and entry braking. There are no
airborne refills or discarded/replaced stages.

| Hardware | Dry mass | Initial fuel | Engine force | Acceleration cap |
| --- | ---: | ---: | ---: | ---: |
| Atlas | .2 | 2.5 | 32 | 3 |
| Odyssey | .85 | 4.2757323163 | 24 | 3 |
| Eagle | .15 | .5711591636 | 3.6 | 3 |

The larger stack preserves the accepted capped boost path by scaling drag area
with its mass ratio. The upper assembly rejoins the accepted mass at separation,
so its insertion, translunar departure and lunar insertion retain their proven
geometry while drawing from Odyssey's actual tank.

Both splits copy the exact preceding canonical position/velocity, with mass
and momentum records. Lunar parking is a canonical all-field coast from the
split. Eagle's capture uses that provider at the same global epoch, charges
Eagle for the residual correction, then starts a new Odyssey return mass law
carrying Eagle's remaining fuel.

## Presentation

Four persistent rows show the launch assembly and three hardware parts.
Attached parts retain tank readouts but have no duplicate glyph or trail.
A selected Eagle-centered or Follow view continues through docking using its
carrier position. Planet–moon rotating, surface, inertial and 3D views remain
available. Tighter default object-centered extents make the small burns readable.

## Authoring and validation

- Authoring work is captured in frozen witnesses. The fixture is the runtime
  input; Python/SciPy is not a browser dependency.
- The Astra review covers phase ownership, tank conservation, paid docking,
  recovery and recurrence.
- scripts/staged-apollo-evidence.ts compiles all canonical owners and writes
  physical samples, accounts, work and contact records.
- spikes/numerics/staged_apollo_oracle.py independently replays the complete
  graph from the initial pad state and three original inventories with DOP853.
  It propagates the moving Moon at absolute epochs and performs its own
  landing/docking fuel debits; it does not restart from TS phase endpoints.
- Simulation tests check exact split states, per-tank ownership, attached mass,
  capture budgets, local step refinement, query ordering and refusals.
- Production browser coverage checks launch, separation, both recoveries,
  lunar landing/ascent/rendezvous, attached centered-frame continuity,
  rewind and switching to/from Beacon.

Continuous recurrence is a separate staged-service domain. The finite compiler
does not mutate its context or interpret a general mission/event language.
