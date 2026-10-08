# Synthetic 2:1 cycler (offline, analytic + DOP853; no app execution)

Run from repo root: `uv run --project spikes/numerics --group plots python -I docs/design/orbital-model-set/consultant/experiments/cycler/cycler.py`
(`-I` is required: the filename `cycler.py` otherwise shadows matplotlib's `cycler` dependency.)
Outputs: `results.json` (all numbers, provenance, limits), `cycler.png`.

Setup: mu=1; A r=1 phase 0; B r=2^(2/3) (T_B = 4pi = 2 T_A), phase 0.749091.
Cycler: ballistic ellipse, r_p=1, a=2^(2/3), e=0.370, r_apo=2.175, P=4pi, periapsis clearance 0.92.

| quantity | cycler | Hohmann A->B |
|---|---|---|
| leg 1 (A) | board dv 0.1705 | 0.1077 |
| leg 2 (B) | alight dv 0.2991 | 0.0959 |
| total dv | 0.4695 | 0.2036 |
| flight time | 2.402 | 4.623 |
| propellant (dry 1 + cargo 0.2, ve 3) | 0.2033 | 0.0843 |

Why alighting is costly: at r=r_B the cycler speed equals B's circular speed (0.7937) but its
flight-path angle is 21.7 deg, so |dv| = 2 v sin(gamma/2) = 0.299 (radial 0.294, tangential -0.056).
Inbound crossing would cost the same (0.299) but B is 1.50 rad away from it, so not usable here.
Window wait: with this B phase a Hohmann departure needs a 12.4 wait (the cycler also only
passes A at t = kP = 12.57k); both are phase-gated, neither is "free".
Verification: DOP853 over 3P (37.7): ship-A distance at P,2P,3P <= 2.8e-11; ship-B at t_x+kP
<= 1.5e-11; integrated B relative speed matches analytic to 6e-13; min radius 1.000.

Shown: a commensurate-period ballistic path re-encounters A and B repeatedly with zero burns
for the path itself; riding it still costs ~2.3x the Hohmann dv and 2.4x propellant here, in
exchange for 48% shorter flight time and no further burns once aboard.
NOT shown: no gravity assist is possible (massless ports); re-encounter exists only because
periods were chosen 2:1, unlike the real Aldrin cycler whose Earth flybys rotate the line of
apsides each synodic period. No app run. Docking with a moving elliptical target is not
supported (ports only); a multi-ship runner would be needed. One hand-picked case; nothing
about fun or generality. Boarding/alighting modelled as one idealized impulse each.

Reproduction snippet (schema requires rate = sqrt(mu/r^3); cycler state at t=0, co-located with A):
```json
{"ship.state": [1.0000000000000002, 0.0, 0.0, 1.1704868538572157], "ports": [{"id": "A", "rail": {"kind": "circular", "center": [0, 0], "radius": 1.0, "rate": 1.0, "phase": 0.0}}, {"id": "B", "rail": {"kind": "circular", "center": [0, 0], "radius": 1.5874010519681994, "rate": 0.5, "phase": 0.7490909866390751}}]}
```
