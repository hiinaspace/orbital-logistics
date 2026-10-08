# Tracking camera — 2026-10-08

The user accepted the 3D viewer and requested following a ship at close zoom while
keeping an inertial frame, chase viewing and orbit gestures about the selection.

**Track → Follow** centers the current selection while preserving angle and zoom.
It changes only the camera center at the cursor's epoch. Every path vertex keeps its
original epoch and physical frame transformation; inertial paths retain their shape.
Pan and pointer-anchored zoom leave an offset from the tracked object. Selecting a
new object recenters tracking. **Off** freezes the current camera pose.

**Chase** looks forward from behind and above, using velocity relative to the first
massive body, with the orbital angular-momentum normal as up. This is an orthographic
schematic view, so there is no perspective distance/collision boom. Its deterministic
rig derives entirely from the displayed position/velocity; scrubbing, rewind and
playback speed do not accumulate camera lag. A least-aligned-axis fallback handles
zero velocity/radial/zero-position states. At an authored instantaneous impulse a
velocity-aligned view can turn instantaneously as well. Attitude is not inferred.

The standard yaw/pitch controls operate within the chase rig. Pan/zoom offsets are
stored in the current reference-frame axes, rather than a hidden wall-clock spring.
Changing View to a preset leaves Chase for Follow. Fit turns tracking off and frames
the scene while preserving viewing angle; Surface view also releases tracking.
Set changes reset tracking. Fault/unavailable ships release tracking at their last
valid pose rather than following an extrapolated state. Frame changes retain the
tracking choice, and frame physics remains independent.

An orbit gesture pivots around the selected object and keeps its projected position
fixed, including off-center selections. Shift/right/middle drag and Top still pan.
Camera axes can include a frozen or moving orthonormal rig; this is presentation
only and is never serialized as a physical command or passed to the simulation.

Unit checks cover arbitrary/degenerate orthonormal rigs and pivot preservation.
Production browser checks cover close zoom, unchanged physical state and inertial
frame, chase rewind identity, Off/frozen behavior, scene reset and selected pivots.
Human control feel remains a viewing gate.
