# Prepared atmospheric arrival

## Physical domain
`entry-flight-v1` / `entry-rk4-v1` is one fixed spherical body, one ship, one finite in-plane witness. The aerodynamic kernel accepts spatial vectors; this exhibit restricts physical spin to Z. Legacy gravity/propulsion Runners, snapshots, sensitivities and planners do not gain atmospheric forces. Unknown entry physical fields and unsupported versions fail validation.

Area uses L², density M/L³, pressure M/(L T²), force M L/T². Fixture units are normalized labels, not real-unit conversions. The fictional atmosphere has reference density200, scale height.025R, smoothstep fade from.16R to.2R and spin.03. Its coefficients are authored for this exhibit, not calibrated Earth or Mars values.

With body-relative r, atmosphere velocity is body velocity + Ω×r. Air-relative u determines q=ρ|u|²/2 and drag=-q(Cd A)u/|u|. Exactly zero airspeed produces zero aero forces. Density is exponential with a C1 fade into vacuum.

Lift projects the outward radial normal into the plane perpendicular to u, normalizes with sqrt(|projection|²+1e-8), and multiplies by drag magnitude, a signed L/D command and an altitude smoothstep. Positive lift points toward local radial up. L/D.25 is an upper bound; radial degeneracy and the lower-atmosphere fade reduce the realized ratio. Cd A remains a declared effective area, independent of the glyph.

## Feedback braking and mass
The authoritative state is (position XYZ, velocity XYZ, fuel). Each RK stage uses m=dry+cargo+fuel and fuel derivative=-|thrust|/exhaustVelocity. Negative fuel or invalid intermediate mass fails; successful recovery requires a positive margin.

Below.025R, smooth engagement reaches full authority at.01R. Desired air-relative velocity is radial inward with speed sqrt(.025²+2*.06*max(0,altitude-supportHeight)). A velocity-gain6 controller compensates gravity and current aerodynamic acceleration. Requested force is saturated against both maximum engine force1.5 and thrust acceleration2. This is a frozen point-mass guidance law, not a solved real vehicle controller. Engine limits apply to thrust; the separately admitted load is the norm of drag+lift+thrust divided by actual mass.

The schematic entry axis is broadside to flow, toward local up, and blends into commanded terminal thrust. It is presentation, not a rigid-body state.

## Canonical propagation and ocean contact
Canonical intervals use the authored grid. A conservative half-clearance neighborhood bounds density, airspeed, thrust and gravity using the nonfuel mass floor. A self-consistent acceleration/speed bound certifies all continuous motion and RK stages outside the actual solid surface. Stage checks verify the enclosure.

Deterministic step doubling rejects normalized state disagreement >2e-11; atmospheric-gradient and controller-timescale criteria also subdivide. Display queries do not change accepted steps.

A support shell at1+1e-5R is an explicit ocean-contact interface, not a collision exception. Near it, a radial-acceleration enclosure establishes monotonic descent; otherwise the interval subdivides. This prevents same-sign endpoints from concealing a grazing crossing. Forty-eight bisections refine the first certified downward crossing. Impact speed plus1e-7 allowance must fit the.06 envelope.

Contact preserves position, freight and fuel, ends thrust, and sets velocity to local water corotation. The event records J=m(v_water-v_before) and removed water-relative energy=m|v_before-v_water|²/2. No claim that this is the inertial kinetic-energy decrease. There is no pad, berth, unload, refuel, launch or autonomous turnaround. After contact the constrained recovery pose rotates analytically with the world.

Exact-time sampling returns the event-right state. Pre-contact drawing ends at the event-left state, preventing interpolation from smearing water's impulse backward.

## Presentation and budgets
Density shading/contours, aerodynamic arrows and glow toggle separately. Arrows rotate as force vectors into the selected frame, without velocity-frame corrections. Both use the same bounded nonlinear force-length scale and distinct colors. Glow represents sqrt(density)*airSpeed³, a qualitative heating proxy; it is not temperature or heat-shield certification. At displayed epochs, force telemetry and commanded heading are evaluated from disposable drawing states.

Caps:8 time units,32768 retained nodes,131072 trial intervals,524288 checked propagation evaluations,20 subdivisions,48 root iterations per accepted contact bracket, bounded drawing grid and12MB display packet. Preparation occurs in the finite worker once; playback is prepared history. Failure never publishes a successful recovered scene.

## Sources
- [NASA drag equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/)
- [Orekit exponential co-rotating atmosphere](https://github.com/CS-SI/Orekit/blob/develop/src/main/java/org/orekit/models/earth/atmosphere/SimpleExponentialAtmosphere.java)
- [Orekit isotropic drag](https://github.com/CS-SI/Orekit/blob/develop/src/main/java/org/orekit/forces/drag/IsotropicDrag.java)
- [NASA/JPL guided atmospheric entry](https://www.jpl.nasa.gov/news/press_kits/mars_2020/landing/mission/)
