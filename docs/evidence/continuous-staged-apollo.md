# Staged service recurrence

`Aster–Selene · Staged service` repeats the admitted finite staged mission using
one cached physical context and the unchanged global world rails. Atlas, Odyssey
and Eagle keep their identities, dry hardware, tanks and cumulative consumption.
The launch stack is an assembly glyph, not an extra inventory.

The synodic period is 103.385316481873. Atlas recovers at 2.872848358156;
Odyssey with Eagle aboard recovers at 79.513861832801. Each recovery has its own
hidden supported transport at recovery+4. All parts are home before stack
reappearance at period−3 and the supported refill at period−2.

Per-trip measured fuel deficits are 1.581522301968 for Atlas,
1.801134667995 for Odyssey and 0.249265212385 for Eagle: 3.631922182348 total,
below the fixture's four-unit standing import cap. Ground supply imports and
debits each measured deficit into its own tank. Protected child fuel is retained
through both splits, lunar landing, paid rendezvous and the return assembly.

Validation on natto, 2026-10-11:

```
npm run typecheck
STAGED_SERVICE_EVIDENCE=1 node --import tsx --test \
  tests/sim/continuous-staged-apollo.test.ts tests/sim/staged-service.test.ts
```

All five focused tests passed. Four tests use an explicitly synthetic prepared
context to isolate calendar/accounting behavior. The integration test uses the
real canonical compiler and emits [the measured report](continuous-staged-apollo.json).

- Unique three-part inventory and owner seams are checked on both event sides.
  Refilling changes remaining fuel but preserves cumulative consumption.
- Exact and off-grid drawing queries agree with the canonical samples at the
  checked epochs to 1.91e−11 in position and 2.82e−8 in fuel/assembly mass.
  Attached-child drawing uses the carrier's dense pose; pre-split booster fuel
  follows the active stack tank rather than a coarser child history.
- Period, split, reassembly and refill queries remain exact at cycle 9000.
  Position, velocity, attitude and aerodynamic vectors rotate together.
- Every hidden actor remains at zero opacity, including Eagle after docking and
  during Odyssey's recovery fade. Per-cycle terminal braking spans are retained.
- The position-only state and display-origin helpers equal the full drawing
  query at checked boundaries, off-grid epochs, later cycles, supported ground
  transport and the final calendar. Camera origin holds the recovered pose,
  then blends to Cairn during stack fade; the actual ground state stays on Cairn.
- Worker-prepared rows preserve a held cursor and resource anchor through a reply,
  release evicts expired history, and invalid template rows reject before the
  published frontier changes.
- The calendar ends exactly at 1,000,000 after 9,672 supported refills. Final
  aggregate fuel balance error is 7.28e−12. No sample, boundary or rendering arc
  extends beyond the final epoch.

Measured storage remains independent of trip count:

| Item | Measured maximum in this run | Admission cap |
| --- | ---: | ---: |
| Cached physical nodes | 101,366 | 160,000 |
| Recorded physical storage | 33.930MB | 60MB |
| Initial worker packet | 28.445MB | 64MB |
| Late first packet with three cycles | 54.096MB | 64MB |
| Later packet with three new cycles | 38.333MB | 48MB |
| Retained drawing storage | 38.326MB | 84MB |
| Retained drawing samples | 106,682 | 240,000 |

Packet sizes use JSON byte measurements as an admission diagnostic. Normal
incremental replies reuse the cached template and already-published cycle rows;
a cycle transition adds about 12.8MB rather than copying all retained history.
The 128-unit history, 32-unit lead and per-cycle 28MB cap bound materialization.

This establishes the recurrence adapter, accounting, storage and display seams.
Independent flight accuracy is covered by the finite mission's oracle/refinement
work; these drawing comparisons are not an independent dynamics oracle.
Production playback and the object-centered rendering performance pass are
recorded separately in [the viewer timing report](staged-viewer-performance.json).
Owner visual acceptance remains separate from automated browser checks.
