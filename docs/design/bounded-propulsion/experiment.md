# Bounded powered-transfer authoring

Inputs were saved before engine implementation with `scripts/propulsion-input.ts`.
The independent authoring search uses augmented seven-state DOP853 (six kinematic
components plus fuel), constant force and exhaust velocity, and two constant
inertial headings with a coast between. Two headings and two durations are the
four unknowns for planar position/velocity rendezvous. It does not use a final
matching impulse. It is an offline route-family witness, not runtime guidance.

Declared input bounds: six inherited outbound/return legs (Kestrel, Wren, Ibis),
forces8/4/2/1 in descending continuation, no more than180 forward evaluations per
force/leg, each powered interval≤45% of flight duration, minimum surface clearance
0.03, terminal state residual<1e-8 and fuel remaining>0.05. Failed/infeasible steps
are retained. Least-squares invalid-domain residuals are deliberately conservative;
a failed seed is not evidence that all finite-thrust routes are infeasible.

The search leaves departure and arrival epochs fixed initially. If a lunar round
trip cannot be admitted, use a small predeclared alternate-time grid or stop at a
validated outbound witness; do not add an uncharged terminal impulse. Production
admission requires independent tight integration, canonical refinement, pre-capture
state comparisons, full-interval safety and finite-resource service/return validation.
The engine review may strengthen these gates before implementation.
