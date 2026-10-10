# Spatial atmospheric mission and rotating body grids

Aster · Northern launch & station visit combines the accepted atmospheric staged
mission with real 26-degree northern support. Northhaven follows a small circle
about the unchanged z-axis atmospheric spin. Lantern follows an inclined circular
rail above the atmosphere. Kestrel and Wren separate with identical translational
state and conserved wet mass/momentum. Wren delivers actual cargo, undocks with
its remaining fuel, and returns to the ocean; Kestrel returns independently.

This is a finite prepared exhibit using existing atmospheric leg/entry retained
nodes and display providers. No optimizer runs during playback, and no gravity-only
Runner cache is repurposed for aerodynamic physics. The existing aggregate work,
physical-node and serialized-display limits remain. Replay and scrubbing query the
same prepared records.

atmospheric-mission-v2 and entry-rk4-v2 explicitly admit spatial state and steering.
The old versions retain planar admission. Both use the same spatial force laws,
fuel accounting, certified propagation and dissipative recovery event. Constant
z-spin, one fixed spherical primary, radial atmospheric density, lift-free ascent,
one station and broad ocean recovery remain the supported physical envelope.
Latitude is allowed only on a v5 surface port. Support radius must match the body's
radius plus support height, and every mission arc must provide steering.

author.py seeds controls from the accepted mission but keeps atmospheric spin on
the original z axis. Small changes to the first/last insertion-key azimuths and
burn duration solve circular radius, radial speed and circular speed independently
with DOP853. The resulting plane and phase author Lantern's rail before production
validation. It designs a station served by this exhibit; it does not establish a
general solver for arbitrary inclined station schedules. Original-state oracle
replay uses the frozen rail without fitting any production endpoint.

A future continuous inclined atmospheric service needs occurrence-specific
windows: rotating a cached flight about z also rotates its inclined station plane.
Ocean recovery likewise supplies no implicit transport back to Northhaven.
Moving-Selene ground service separately needs body-relative supported-port
ephemerides, body acceleration in release tests and measured near-surface work.

Planet grids are disposable presentation geometry. Spin comes only from actual
surface support or rotating atmosphere; bodies without a modeled spin have static
body-centered grids. Pad phase remains pad longitude, independent of the grid's
zero meridian. Exact projected circle arcs are clipped analytically at the limb,
keeping pixel stroke widths at extreme zoom without tessellation. See-through mode
adds faint dashed far-side arcs. Axial pole ticks obey sphere occlusion.

Reproduce:

    uv run --project spikes/numerics python docs/design/spatial-atmosphere/author.py
    node --import tsx scripts/atmospheric-mission-evidence.ts fixtures/model-sets/aster-northern-launch.json spatial-atmosphere
    uv run --project spikes/numerics python spikes/numerics/atmospheric_mission_oracle.py --input docs/evidence/spatial-atmosphere-oracle-input.json --output docs/evidence/spatial-atmosphere-oracle.json

Review: astra-review.md. Validation: ../../evidence/spatial-atmosphere.md.
