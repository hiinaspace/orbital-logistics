# Moving Selene ground service

This slice joins the existing binary-world dynamics, northern surface ports, three-dimensional smooth thrust and orbital cargo operations in one finite sortie. Northhaven sits at 20° latitude on the actual moving Selene Moon. Tern carries 0.05 supplies to Crescent, a ballistic depot initially inclined20°, refuels from its finite stock, and lands back at Northhaven.

The Moon and primary retain the original Selene binary rails and both gravity sources act on ship and depot. The pad's physical z-spin is explicitly synchronous with the binary rate 1. Its center of mass sits 1e-6 world units above the body's radius. That absolute support height is intentional: radius scaling it to 2.5e-8 multiplied the conservative close-surface certificate work in Astra's probe. This is a support height, not a collision tolerance.

## Provider and preparation boundary

`moving-surface-ports-v6` admits only two bodies, two ports (one moving surface port and one ballistic target), at most 2 world-time units, and one vessel in the viewer. The surface body's rail is copied from the declared world body during validation; wire-supplied `bodyRail` is ignored and older surface versions reject it. Supported pads must have certified separation from every other body across the whole declared rail envelope.

The world pad provider adds body translation and velocity to the latitude small circle. The normal is evaluated locally. Launch eligibility uses radial gravity relative to the moving body's acceleration. Free-flight integration remains inertial and unchanged. Docking and landing still use canonical target states and pay residual velocity correction.

Prepare once in the existing worker. Count parent and child physical trees together: ceiling 65,536 nodes and 24,000,000 serialized diagnostic bytes. Reject display packets over 12,000,000 bytes. The physical tree and drawing packet are different ownership measures, not heap measurements. Free-flight drawing samples use 65,536 intervals per world-time unit, capped 16,384 per flight and 32,768 total. This replaces the overlapping generic launch-sampling pass for this version when complete flights are already covered. Drawing samples never seed physics.

The pad, close camera, surface readouts and chase camera use the owning body, rather than assuming the first gravity source. Frame-specific fit extents keep the Moon scene legible while inertial/rotating frames retain the full binary overview. Default playback is 0.01×; Replay rewinds this prepared finite occurrence.

## Authoring and reproduction

`author.py` solves an offline boundary-value problem in a translating, unrotated Moon frame with the primary field minus the prescribed Moon acceleration. Physical states are converted back to inertial coordinates. It freezes five smooth steering keys per leg and constant acceleration 38.4; the runtime runs those keys under both gravity sources. Return departure is authored for the actual inclined target phase. Both legs obey the existing 120° adjacent-key turn limit. Return terminal thrust is constrained radial, with whole-flight clearance retained in the optimization.

```sh
uv run --project spikes/numerics python docs/design/moving-selene/author.py --resume
npm run evidence:moving-selene
npm run test:sim
npm run build
PLAYWRIGHT_PREVIEW=1 npx playwright test tests/browser/moving-selene.spec.ts
```

`--resume` replays and verifies frozen controls before assembling the fixture; omit it for bounded reauthoring from the prior northern shuttle seed. Independent evidence uses inertial DOP853 and independently propagates Crescent from its original initial state. It does not import the authoring solver or use production target samples as seeds.

## Next integration gate

This establishes one moving-Moon ground occurrence. Continuous recurrence needs a separately solved second occurrence against the actual inclined ballistic depot. A rigid rotation of this flight does not preserve that target's latitude, phase or tidal evolution. After that witness, an online service can prepare future episodes against bounded target ephemerides. Adding a larger relay exhibit before that check would conceal the new boundary under unrelated traffic.
