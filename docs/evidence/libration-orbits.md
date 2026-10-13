# Spatial observatories — 2026-10-12

Three finite60-unit sets are prepared by the canonical six-state Runner:
**Sol–Earth · Webb halo**, **Sol–Earth · Gaia Lissajous**, and
**Sol–Earth · Observatory departure**. Their fictional circular binary has
mass fractions .997/.003, separation4, angular rate .125, body radii .65/.1,
and an inertial barycenter at zero. Both analytical body rails supply the exact
accelerations from their mutual gravity. This is circular restricted three-body
physics, not a general numerical N-body model or real mission reconstruction.

## Geometry and programming

The spatial L2 halo starts from a JPL normalized Earth–Moon seed, then differential
correction continues the mass ratio through20 steps to .003. The internal planar
Lyapunov regression closes to4.07e-13; the nonzero-z halo closes to8.65e-12 in
normalized rotating state over one25.7637-unit circuit. Its physical z range is
[-.154735,.240371]; the full native finite coast is neither projected onto a
reference rail nor reset at that period.

The Gaia/WMAP-inspired witness uses an offline spatial center-motion boundary
value problem, with initial y/vx/vz zero, fixed vy/z, and a terminal unstable-mode
condition. The finite60-unit coast shows changing horizontal/vertical phase;
it is not a proof of an exact invariant quasiperiodic torus or indefinite
uncorrected stability. Its linear planar period is25.95996, which is a trail
recommendation only, not a recurrence calendar. Physical z spans[-.127698,.16].

The departure starts in free flight .19 from Earth's center, not at a launch pad.
It coasts to1, thrusts1→3.737767667642739, coasts to12.980459133529555, and thrusts
to14. It then remains in uninterrupted free flight on the halo through60.
Both burns have .04 capped acceleration; their constant inertial headings are
explicit authored controls. There are no impulses, captures, docking corrections
or attitude constraints. Fuel used .06840857177327, final reserve .33159142822673,
from initial .4 and dry mass1/exhaust3. The terminal insertion state matches the
independently specified halo state to1.35e-13 in the oracle. No target-state snap
occurs in production. These are departure/insertion burns; ground ascent remains
outside this finite scene.

## Numerical and admission gates

`uv run --project spikes/numerics python docs/design/libration-orbits/oracle.py`
propagates each frozen initial state with independent DOP853. Coast references
use rotating equations and separately nonrotating primary-relative equations,
including the indirect acceleration of the origin. Insertion uses independent
inertial force sums, split exactly at control boundaries. Tightening differences
are3.14e-10 halo,1.27e-8 Lissajous and7.41e-9 insertion; primary-relative agreement
is2.70e-9/2.33e-8 for the coast witnesses.

`node --import tsx scripts/libration-orbit-evidence.ts` compares full-horizon
position and velocity at241 fixedepochs, using the same frozen seed at every
resolution. The1/64→1/128→1/256 sequence converges. Shipping1/1024 full-horizon
maximum state errors are2.32e-8 halo,4.65e-8 Lissajous and5.72e-8 insertion.
Shipping coast Jacobi variation is below1.5e-15. Paired ±1e-9 inertial-x
perturbations, balanced by separation and orbital speed, grow by about716/1584
over one halo/linear-Lissajous period and4.51e6/1.73e7 by60. Both signed probes
remain safe through the finite horizon. This measures one sensitive direction,
not full mode controllability or a suitable maintenance cadence. Very fine grids eventually
amplify accumulated roundoff in these unstable orbits; smaller steps are not
claimed to improve accuracy without limit. Finite source motion/body clearance
is certified by the existing native Runner. Sampled minimum surface clearances
are .19655/.25321/.09, respectively; sampled minima are summaries, not the
continuous clearance certificate.

Independent refinement episodes join at exact canonical8-unit grid endpoints,
retaining state/fuel. Production uses a single60-unit interval,61,440 grid steps,
65,536 node cap. Preparation measurements here are non-isolated and under.5sec
per scene. Drawing packets have2049/2049/2053 samples and remain below550kB.
Shipping full-horizon validity and no-ports/no-logistics/one-vessel admission
remain independent of rendering. New domain marker is circular-binary-set-v1;
old compact field/state/cache identities remain unchanged.

## Viewer and field polish

Scenes default to oblique **L2 rotating**, a physically translating/rotating
frame around the computed L2 reference, with correct velocity terms. Whole
Sol–Earth rotating, barycentric inertial, body-centered and vessel-centered frames
remain available. Spatial trajectories retain real z; old coplanar relief is
unavailable here. All five equilibrium crosses are derived from this admitted
binary. Existing compact sets retain their actual-field three crosses.

The telescope icon is a small schematic mirror/sunshield. It is presentation,
not vehicle dynamics. Existing rocket/stack glyphs retain their behavior.

Compact relief grids now default to55% strength, adjustable0–100%, with fixed-width
output. Grid/tint/contours/silhouettes share a source-basis circular fade from8
to11. Flat-map patches share the same envelope; rectangular rim strokes are
suppressed, while the edge-on plane hint is circular. Bodies/trajectories and
physical coordinates are unchanged. See [circular fade](relief-circular-fade.png).

33 focused numerical/spatial/camera/glyph/field/steering tests pass. The final
production-browser suite passes23 cases, plus the transparent-grid regression.
New scene coverage includes: all new scenes, frame/camera changes, real-z inspection, finite
rewind/resource reproducibility,16× playback and switching to/from continuous
traffic; grid strength/stable slider width. Isolated production-shader GPU-alpha readback
checks radial attenuation, zero corner/outside pixels, strength scaling and
overview/detail consistency; it does not certify every pan/Follow/fallback
combination.
Screenshots inspected at1080p: [halo](sol-earth-halo.png),
[Lissajous](sol-earth-lissajous.png), [departure](sol-earth-observatory-insertion.png).
Native fixtures reproduce byte-for-byte from the retained solution files with
`uv run --project spikes/numerics python docs/design/libration-orbits/compile_sets.py`.
Configured Ruff-format/lint and ty checks include this slice.
No volumetric field or continuously maintained libration service is claimed.
The new binary's scalar-plane field adapter is a later optional display slice.

[Reviewed plan](../design/libration-orbits/README.md) and
[implementation review](../design/libration-orbits/implementation-review.md)
and [disposition](../design/libration-orbits/implementation-disposition.md)
retain the physics and phase/caching boundaries.
