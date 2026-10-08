"""Synthetic 2:1 "cycler" in the app's fixed-primary two-body world (offline, analytic + DOP853).

Run (from repo root; -I is REQUIRED: this file's name shadows matplotlib's `cycler` dep):
  uv run --project spikes/numerics --group plots python -I \
    docs/design/orbital-model-set/consultant/experiments/cycler/cycler.py

Model: mu=1 primary at origin (surface radius 0.08); massless kinematic ports on circular rails
A (r=1, phase 0) and B (r_B = 2^(2/3), period exactly 2 T_A). The cycler is a ballistic Kepler
ellipse with periapsis r_p=1 (touching A's rail), period P = 4*pi = T_B, a = r_B. It re-meets A
at every periapsis and crosses B's radius at fixed inertial points; B's phase is chosen so B is
at the outbound crossing then. Nothing here uses gravity assists: re-encounter exists only
because the periods are commensurate. No app execution; analytic numbers checked by integration.
"""

from __future__ import annotations

import json
from math import acos, atan2, cos, exp, pi, sin, sqrt
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from scipy.integrate import solve_ivp

OUT = Path(__file__).parent
MU, SURFACE = 1.0, 0.08
DRY, CARGO, VE = 1.0, 0.2, 3.0
TAU = 2 * pi


def kepler_E(M: float, e: float) -> float:
    E = M
    for _ in range(100):
        E -= (E - e * sin(E) - M) / (1 - e * cos(E))
    return E


def rocket_propellant(dvs: list[float], final_mass: float) -> dict:
    """Sequential rocket equation, worked backwards from final mass (dry+cargo, empty tank)."""
    m = final_mass
    for dv in reversed(dvs):
        m *= exp(dv / VE)
    return {"initial_mass": m, "propellant": m - final_mass}


def state_at(nu: float, a: float, e: float) -> np.ndarray:
    """Inertial [x, y, vx, vy] on the ellipse (periapsis along +x, counter-clockwise)."""
    p = a * (1 - e * e)
    r = p / (1 + e * cos(nu))
    vr = sqrt(MU / p) * e * sin(nu)
    vt = sqrt(MU / p) * (1 + e * cos(nu))
    rh = np.array([cos(nu), sin(nu)])
    th = np.array([-sin(nu), cos(nu)])
    return np.concatenate([r * rh, vr * rh + vt * th])


def main() -> None:
    rA = 1.0
    rB = 2 ** (2 / 3)
    TA = TAU * rA**1.5
    P = TAU * rB**1.5
    assert abs(P - 2 * TA) < 1e-12
    a = rB
    e = 1 - rA / a
    r_apo = 2 * a - rA
    nB = rB**-1.5  # = 0.5

    # --- crossing of r = rB: r = a(1 - e cos E) = a  =>  cos E = 0
    E_out, E_in = pi / 2, 3 * pi / 2
    t_out = (E_out - e * sin(E_out)) / sqrt(MU / a**3)
    t_in = (E_in - e * sin(E_in)) / sqrt(MU / a**3)
    nu_out = acos(-e)  # cos nu = (cos E - e)/(1 - e cos E) = -e, sin nu > 0
    nu_in = TAU - nu_out
    assert abs(kepler_E(sqrt(MU / a**3) * t_out, e) - E_out) < 1e-12
    phaseB = (nu_out - nB * t_out) % TAU  # B at outbound crossing at t_out (and t_out + kP)

    def rel(nu: float, r_port: float, port_angle: float):
        s = state_at(nu, a, e)
        vc = sqrt(MU / r_port)
        vp = vc * np.array([-sin(port_angle), cos(port_angle)])
        dv = s[2:] - vp
        rh = s[:2] / np.linalg.norm(s[:2])
        th = np.array([-rh[1], rh[0]])
        return s, vp, dv, float(np.linalg.norm(dv)), float(dv @ rh), float(dv @ th)

    # A encounter at periapsis (nu=0): A angle 0
    sA, _vA, _dvA, relA, relA_r, relA_t = rel(0.0, rA, 0.0)
    # B outbound / inbound
    sBo, vBo, _dvBo, relBo, relBo_r, relBo_t = rel(nu_out, rB, nu_out)
    ang_B_at_in = (phaseB + nB * t_in) % TAU
    _sBi, _vBi, _dvBi, relBi, relBi_r, relBi_t = rel(nu_in, rB, nu_in)  # if B were there
    offset_in = atan2(sin(ang_B_at_in - nu_in), cos(ang_B_at_in - nu_in))
    # actual relative speed if inertial positions coincided is relBi; B is NOT there:
    p = a * (1 - e * e)
    gamma = atan2(sqrt(MU / p) * e * sin(nu_out), sqrt(MU / p) * (1 + e * cos(nu_out)))
    speed_x = float(np.linalg.norm(sBo[2:]))

    # --- Hohmann A -> B
    at = (rA + rB) / 2
    h1 = sqrt(2 / rA - 1 / at) - sqrt(1 / rA)
    h2 = sqrt(1 / rB) - sqrt(2 / rB - 1 / at)
    tH = pi * at**1.5
    # Hohmann window wait for the cycler scene's B phase: A angle = t_d, B at arrival must be
    # t_d + pi:  phaseB + nB (t_d + tH) = t_d + pi (mod 2pi)  -> t_d = (phaseB + nB tH - pi)/(1-nB)
    wait_H = ((phaseB + nB * tH - pi) / (1 - nB)) % (TAU / (1 - nB))

    cyc_dvs = [relA, relBo]
    hoh_dvs = [h1, h2]
    fuel_cyc = rocket_propellant(cyc_dvs, DRY + CARGO)
    fuel_hoh = rocket_propellant(hoh_dvs, DRY + CARGO)

    # --- numerical verification (DOP853 in fixed-primary field)
    s0 = state_at(0.0, a, e)

    def rhs(_t, y):
        k = -MU / np.hypot(y[0], y[1]) ** 3
        return [y[2], y[3], k * y[0], k * y[1]]

    ts = sorted({k * P for k in (1, 2, 3)} | {t_out + k * P for k in (0, 1, 2)})
    sol = solve_ivp(
        rhs,
        (0, 3 * P),
        s0,
        method="DOP853",
        rtol=1e-12,
        atol=1e-14,
        t_eval=ts,
        dense_output=True,
    )
    assert sol.success
    dense = solve_ivp(rhs, (0, 3 * P), s0, method="DOP853", rtol=1e-12, atol=1e-14, max_step=0.01)
    rmin = float(np.min(np.hypot(dense.y[0], dense.y[1])))

    def port(r_port, phase, t):
        ang = phase + r_port**-1.5 * t
        return r_port * np.array([cos(ang), sin(ang)])

    errA, errB = {}, {}
    for k in (1, 2, 3):
        y = sol.sol(k * P)
        errA[f"t={k}P={k * P:.6f}"] = float(np.linalg.norm(y[:2] - port(rA, 0.0, k * P)))
    for k in (0, 1, 2):
        t = t_out + k * P
        y = sol.sol(t)
        errB[f"t_x+{k}P={t:.6f}"] = float(np.linalg.norm(y[:2] - port(rB, phaseB, t)))
    # integrated relative velocity at B encounter (checks the analytic tabulated value)
    yb = sol.sol(t_out)
    vB_num = sqrt(MU / rB) * np.array([-sin(nu_out), cos(nu_out)])
    relB_num = float(np.linalg.norm(yb[2:] - vB_num))
    energy_drift = float(
        abs(
            0.5 * (sol.sol(3 * P)[2:] @ sol.sol(3 * P)[2:])
            - 1 / np.hypot(*sol.sol(3 * P)[:2])
            + 1 / (2 * a)
        )
    )

    results = {
        "provenance": {
            "script": "cycler.py",
            "integrator": "scipy solve_ivp DOP853, rtol=1e-12, atol=1e-14",
            "app_execution": False,
            "reference": "docs/design/topology-study/consultant/hohmann_routes.py conventions",
        },
        "model_limits": [
            (
                "Massless kinematic ports cannot give gravity assists; the cycler re-meets A only "
                "because P = 2 T_A = T_B exactly (2:1 commensurate periods)."
            ),
            (
                "Not the Aldrin cycler: that uses Earth flybys each synodic period to rotate the "
                "line of apsides; here nothing rotates it and none is needed."
            ),
            (
                "Boarding/alighting are idealized instantaneous impulses (|relative velocity|, any "
                "direction); no docking with a moving elliptical target exists in the app (ports "
                "only), a multi-ship runner would be needed."
            ),
            ("Single scenario with hand-picked radii; no claim about fun or generalization."),
            (
                "Times in A-phase-0 convention; taxi must wait at A until t=kP (A is at periapsis "
                "only then) and the cycler comes through every P=4*pi=12.57."
            ),
        ],
        "geometry": {
            "mu": MU,
            "surface_radius": SURFACE,
            "r_A": rA,
            "T_A": TA,
            "r_B": rB,
            "T_B": P,
            "cycler_a": a,
            "cycler_e": e,
            "cycler_r_peri": rA,
            "cycler_r_apo": r_apo,
            "cycler_period": P,
            "periapsis_clearance_above_surface": rA - SURFACE,
            "numerical_min_radius_over_3_periods": rmin,
        },
        "crossing_outbound": {
            "t_x": t_out,
            "eccentric_anomaly": E_out,
            "true_anomaly": nu_out,
            "flight_path_angle_rad": gamma,
            "flight_path_angle_deg": gamma * 180 / pi,
            "cycler_speed": speed_x,
            "circular_speed_B": sqrt(1 / rB),
            "relative_velocity_radial": relBo_r,
            "relative_velocity_tangential": relBo_t,
            "relative_speed_analytic": relBo,
            "relative_speed_integrated": relB_num,
            "relative_speed_check": "2 v sin(gamma/2) since speeds are equal",
            "relative_speed_formula_value": 2 * speed_x * sin(gamma / 2),
            "B_phase_required": phaseB,
            "B_rate": nB,
        },
        "crossing_inbound": {
            "t_in": t_in,
            "true_anomaly": nu_in,
            "B_angle_at_t_in": ang_B_at_in,
            "angular_offset_B_minus_cycler_rad": offset_in,
            "B_is_there": abs(offset_in) < 1e-6,
            "note": "B is not at the inbound crossing (offset shown); "
            "relative speed below applies only to a hypothetical B phased there.",
            "relative_speed_if_phased_there": relBi,
            "relative_velocity_radial": relBi_r,
            "relative_velocity_tangential": relBi_t,
        },
        "encounter_A": {
            "t": "k*P",
            "cycler_speed_peri": float(np.linalg.norm(sA[2:])),
            "circular_speed_A": 1.0,
            "relative_speed_board": relA,
            "relative_velocity_radial": relA_r,
            "relative_velocity_tangential": relA_t,
        },
        "cycler_route": {
            "flight_time_A_to_B": t_out,
            "board_dv": relA,
            "alight_dv": relBo,
            "total_dv": relA + relBo,
            "propellant_taxi_dry1_cargo0.2_ve3": fuel_cyc,
        },
        "hohmann_route": {
            "dv1": h1,
            "dv2": h2,
            "total_dv": h1 + h2,
            "flight_time": tH,
            "wait_for_window_with_this_B_phase": wait_H,
            "propellant_taxi_dry1_cargo0.2_ve3": fuel_hoh,
        },
        "verification": {
            "ship_to_A_distance": errA,
            "ship_to_B_distance": errB,
            "max_distance_error": max([*errA.values(), *errB.values()]),
            "energy_error_after_3_periods": energy_drift,
        },
        "reproduction": {
            "ship_state_xyvxvy": [float(v) for v in s0],
            "ship_state_note": "at t=0 at periapsis co-located with A; a taxi is NOT this ship: it "
            "must burn to reach it",
            "ports": [
                {
                    "id": "A",
                    "rail": {
                        "kind": "circular",
                        "center": [0, 0],
                        "radius": rA,
                        "rate": rA**-1.5,
                        "phase": 0.0,
                    },
                },
                {
                    "id": "B",
                    "rail": {
                        "kind": "circular",
                        "center": [0, 0],
                        "radius": rB,
                        "rate": rB**-1.5,
                        "phase": phaseB,
                    },
                },
            ],
            "scenario_rate_rule": "rate = sqrt(mu / r^3) exactly",
            "rate_check": {"A": sqrt(MU / rA**3), "B": sqrt(MU / rB**3)},
        },
    }
    (OUT / "results.json").write_text(json.dumps(results, indent=2, allow_nan=False) + "\n")
    plot(a, e, rA, rB, phaseB, nu_out, t_out, vBo, sBo, relBo)
    print(
        json.dumps(
            {
                k: results[k]
                for k in (
                    "crossing_outbound",
                    "cycler_route",
                    "hohmann_route",
                    "verification",
                )
            },
            indent=1,
        )
    )
    print("inbound:", results["crossing_inbound"])
    print("rmin", rmin, "encA", relA)


def plot(a, e, rA, rB, phaseB, nu_out, t_out, vB, sB, relB) -> None:
    ink, muted = "#222222", "#777777"
    cyc, cA, cB = "#1b6ca8", "#c2571a", "#2a8f5b"
    nu = np.linspace(0, TAU, 600)
    p = a * (1 - e * e)
    r = p / (1 + e * np.cos(nu))
    fig, ax = plt.subplots(figsize=(6.4, 6.0), dpi=150)
    th = np.linspace(0, TAU, 400)
    ax.plot(rA * np.cos(th), rA * np.sin(th), color=cA, lw=1, ls="--")
    ax.plot(rB * np.cos(th), rB * np.sin(th), color=cB, lw=1, ls="--")
    ax.plot(r * np.cos(nu), r * np.sin(nu), color=cyc, lw=2)
    ax.add_patch(plt.Circle((0, 0), SURFACE, color=ink))
    ax.plot([1], [0], "o", color=cA, ms=9, mec="white", mew=2)
    pB = sB[:2]
    ax.plot([pB[0]], [pB[1]], "o", color=cB, ms=9, mec="white", mew=2)
    # velocity arrows at B encounter (scale 1.0 length per unit speed)
    vc = sB[2:]
    vp = vB
    ax.annotate(
        "",
        xy=pB + vc,
        xytext=pB,
        arrowprops={"arrowstyle": "-|>", "color": cyc, "lw": 1.8},
    )
    ax.annotate(
        "",
        xy=pB + vp,
        xytext=pB,
        arrowprops={"arrowstyle": "-|>", "color": cB, "lw": 1.8},
    )
    ax.annotate(
        "",
        xy=pB + vc,
        xytext=pB + vp,
        arrowprops={"arrowstyle": "-|>", "color": ink, "lw": 1.2, "ls": ":"},
    )
    ax.text(
        -2.55,
        1.0,
        f"relative speed (dotted)\n= {relB:.3f}",
        color=ink,
        fontsize=8,
    )
    ax.text(1.04, -0.14, "A encounter (periapsis)\nrel. speed 0.17", color=ink, fontsize=8)
    ax.text(
        pB[0] - 0.9,
        pB[1] + 0.52,
        "B outbound encounter\narrows: cycler (blue), B (green)",
        color=ink,
        fontsize=8,
    )
    ax.text(
        -1.6,
        -2.35,
        "cycler ellipse (blue); rails A (orange), B (green) dashed",
        color=muted,
        fontsize=8,
    )
    ax.set_aspect("equal")
    ax.set_xlim(-2.6, 2.6)
    ax.set_ylim(-2.6, 2.6)
    ax.set_title(
        f"2:1 ballistic cycler, inertial frame (t_x = {t_out:.3f}, P = 4pi)",
        fontsize=10,
        color=ink,
    )
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    ax.tick_params(labelsize=8, colors=muted)
    ax.grid(alpha=0.15)
    fig.tight_layout()
    fig.savefig(OUT / "cycler.png")
    plt.close(fig)


if __name__ == "__main__":
    main()
