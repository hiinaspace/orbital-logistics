# Orthographic spatial viewer — 2026-10-08

The user selected a 3D viewer and controls, validated on simple noncoplanar maneuvers,
before stationkeeping. This slice uses the existing spatial engine and Canvas2D
renderer; no dynamics/schema/solver migration is needed. The earlier Astra-reviewed
spatial engine contract remains in force. No new external design review is claimed.

## Camera and frame ownership

`src/model-set/camera.ts` is pure disposable drawing geometry. A camera owns yaw,
pitch, a three-component center in the selected physical frame, and pixels per world
unit. Its orthonormal right/up/toward basis projects all three coordinates; depth is
positive toward the viewer. The camera follows the existing frame transform, which
continues to use position, velocity and rotating-frame angular velocity at each
vertex's own epoch. Camera changes never rotate a burn or alter a Runner query.

Orthographic projection keeps the schematic scale consistent across a wide scene.
Top is the original XY view; oblique 3D, Front/XZ and Side/YZ are explicit presets.
Free orbit wraps yaw and clamps pitch at the poles. Pan follows screen axes; wheel
zoom anchors the pointer in the screen plane through the camera center. Zoom limits
remain 20..1m pixels per world unit. Fit resets center/scale while retaining orientation.
Set switches reset the camera, with oblique as the spatial witness default and Top
for historical sets. Surface view explicitly selects Top and close scale.

Left drag orbits in 3D. Shift/right/middle drag pans; an Orbit/Pan toggle changes the
default gesture. Top drags pan. Focused-canvas arrows orbit, Shift-arrows pan, T
returns overhead and F fits. Dragging never edits a trajectory. Clicking retains
inspection and the overlap chooser. Readouts labeled Z position/velocity refer to the
physical frame, not camera depth. UI help lives in existing optional details.

## Visibility

Bodies remain schematic opaque disks with the projected sphere's front hemisphere
as depth boundary. Their minimum seven-pixel glyph is also their visible/pickable
shadow. Body disks draw far-to-near. Lines split analytically at cylinder/sphere
intersections, classify intervals against the union of body shadows, then stroke
visible pieces. Current icons draw far-to-near; hidden points are omitted from label
requests and picking. A body is picked at the clicked front hemisphere rather than
its center depth. This prevents selecting a rear ship through a foreground globe.
Visible icons at the same screen position keep the existing chooser.

Paths retain their sample times and age fading. Clipping uses the bodies displayed
at the current cursor epoch. Current thrust and future exhaust whiskers transform
through both the physical frame and camera; their existing force scale foreshortens
when the thrust points toward the viewer. This does not interpolate physical steering.

## Validation witness and boundary

The generated crossing-plane set has two fixed-radius circular ships and two paid
Cartesian impulses per ship. The first changes plane at an ascending/descending node;
the second restores it at the opposite node. Their node axes and inclination changes
differ. Separate original-orbit beacons make the departures visible. Programs, rocket
fuel, event sides and safety are checked using the existing Runner, independent
DOP853 and a separately propagated closed-form circular solution at three step sizes.

[Evidence](../evidence/spatial-viewer.md) records camera geometry, selection/occlusion,
production browser interactions, continuous-service regression and drawing accuracy.
The witness deliberately uses impulses to isolate spatial geometry. Existing finite
propulsion is projected unchanged. Variable steering, new spatial transfer solving,
stationkeeping, arbitrary ground latitude/spin axes, atmosphere and staging are outside
this slice; human camera/readability review remains the next gate.
