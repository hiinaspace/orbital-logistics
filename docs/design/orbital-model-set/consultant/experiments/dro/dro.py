"""Planar distant retrograde orbits (DROs) in the m0-binary moon fixture.

Offline design evidence only; never game runtime. Deterministic, standalone.

Fixture fixtures/m0-binary.json is exactly the planar circular restricted
three-body problem with mass ratio mu = 0.02, unit separation and mean motion 1:
primary (mu 0.98) on a radius-0.02 rail at phase pi, moon (mu 0.02) on a
radius-0.98 rail at phase 0, both at rate 1, barycentric origin.

Steps:
1. Rotating frame (moon at (0.98, 0), primary at (-0.02, 0)): single shooting
   from (x0, 0) with velocity (0, vy0), x0 = 0.98 + d on the far side of the
   moon. vy0 < 0 there means clockwise (retrograde) circulation about the moon
   in the rotating frame. vy0 is varied (bracket scan + brentq) until the next
   x-axis crossing (upward, near side) has vx = 0, giving a symmetric periodic
   orbit with period 2 * t_half.
2. The chosen member is converted to the inertial frame at t = 0 (frames
   coincide at t = 0; v_in = v_rot + omega x r) and integrated with the
   fixture's inertial force law and moving rails. Closure is measured by
   rotating the inertial state back into the rotating frame at t = k * P.
3. A two-body comparison at the orbit's mean moon distance.

Reproduce (from repo root):
  uv run --project spikes/numerics --group plots python \
    docs/design/orbital-model-set/consultant/experiments/dro/dro.py
"""

from __future__ import annotations

import json
import math
import platform
from pathlib import Path
from typing import Any

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import scipy
from numpy.typing import NDArray
from scipy.integrate import solve_ivp
from scipy.optimize import brentq

Vector = NDArray[np.float64]
HERE = Path(__file__).resolve().parent
REPO = HERE.parents[5]
FIXTURE = REPO / "fixtures" / "m0-binary.json"

RTOL = 1e-12
ATOL = 1e-14
D_VALUES = (0.10, 0.15, 0.20, 0.25, 0.30)
CHOSEN_D = 0.20
MIN_HORIZON = 24.0
MAX_HORIZON = 64.0


def load_fixture() -> dict[str, Any]:
    """Read the fixture and assert it is the CR3BP setup this script assumes."""
    scenario = json.loads(FIXTURE.read_text())["scenario"]
    bodies = {b["id"]: b for b in scenario["bodies"]}
    primary, moon = bodies["primary"], bodies["moon"]
    assert math.isclose(primary["mu"] + moon["mu"], 1.0)
    for body in (primary, moon):
        rail = body["rail"]
        assert rail["kind"] == "circular" and rail["center"] == [0, 0] and rail["rate"] == 1
    assert math.isclose(primary["rail"]["radius"], moon["mu"])
    assert math.isclose(moon["rail"]["radius"], primary["mu"])
    assert math.isclose(primary["rail"]["phase"], math.pi) and moon["rail"]["phase"] == 0
    return {"primary": primary, "moon": moon}


FX = load_fixture()
MU = float(FX["moon"]["mu"])
MOON_R = float(FX["moon"]["radius"])
PRIMARY_R = float(FX["primary"]["radius"])
MOON_X = 1.0 - MU
PRIMARY_X = -MU


# ---------------------------------------------------------------- rotating frame
def rot_rhs(_t: float, s: Vector) -> Vector:
    x, y, vx, vy = s
    r1 = math.hypot(x - PRIMARY_X, y)
    r2 = math.hypot(x - MOON_X, y)
    ax = 2 * vy + x - (1 - MU) * (x - PRIMARY_X) / r1**3 - MU * (x - MOON_X) / r2**3
    ay = -2 * vx + y - (1 - MU) * y / r1**3 - MU * y / r2**3
    return np.array([vx, vy, ax, ay])


def jacobi(s: Vector) -> float:
    x, y, vx, vy = s
    r1 = math.hypot(x - PRIMARY_X, y)
    r2 = math.hypot(x - MOON_X, y)
    return x * x + y * y + 2 * (1 - MU) / r1 + 2 * MU / r2 - (vx * vx + vy * vy)


def crossing_up(_t: float, s: Vector) -> float:
    return s[1]


# SciPy's event API reads dynamically attached attributes on callbacks.
crossing_up.terminal = True  # ty: ignore[unresolved-attribute]
crossing_up.direction = 1.0  # ty: ignore[unresolved-attribute]


def surface_hit(_t: float, s: Vector) -> float:
    r1 = math.hypot(s[0] - PRIMARY_X, s[1]) - PRIMARY_R
    r2 = math.hypot(s[0] - MOON_X, s[1]) - MOON_R
    return min(r1, r2)


surface_hit.terminal = True  # ty: ignore[unresolved-attribute]


def half_orbit(x0: float, vy0: float) -> tuple[float, Vector] | None:
    """Integrate to the next upward x-axis crossing; None if it never comes back."""
    sol = solve_ivp(
        rot_rhs,
        (0.0, 20.0),
        np.array([x0, 0.0, 0.0, vy0]),
        method="DOP853",
        rtol=RTOL,
        atol=ATOL,
        events=(crossing_up, surface_hit),
    )
    if sol.t_events[0].size == 0:
        return None
    return float(sol.t_events[0][0]), sol.y_events[0][0]


def residual(x0: float, vy0: float) -> float:
    """vx at the half-period crossing, required to be on the near side (x < moon)."""
    out = half_orbit(x0, vy0)
    if out is None or not (MOON_X - 0.6 < out[1][0] < MOON_X):
        return math.nan
    return float(out[1][2])


def find_dro(d: float, guess: float) -> dict[str, Any]:
    x0 = MOON_X + d
    # Scan vy0 around the guess for a sign change of the crossing residual.
    grid = guess * np.linspace(0.6, 1.4, 81)
    values = [residual(x0, float(v)) for v in grid]
    candidates = []
    for i in range(len(grid) - 1):
        a, b, fa, fb = grid[i], grid[i + 1], values[i], values[i + 1]
        if math.isfinite(fa) and math.isfinite(fb) and fa * fb < 0:
            candidates.append((float(a), float(b)))
    if not candidates:
        finite = [abs(v) for v in values if math.isfinite(v)]
        return {
            "d": d,
            "converged": False,
            "reason": "no residual sign change in scan",
            "min_abs_residual_in_scan": min(finite) if finite else None,
        }
    # Pick the bracket closest to the guess.
    a, b = min(candidates, key=lambda ab: abs(0.5 * (ab[0] + ab[1]) - guess))
    vy0 = float(brentq(lambda v: residual(x0, v), a, b, xtol=1e-15, rtol=1e-15, maxiter=200))
    crossing = half_orbit(x0, vy0)
    assert crossing is not None, "Converged shooting solution lost its axis crossing"
    t_half, s_half = crossing
    period = 2 * t_half
    s0 = np.array([x0, 0.0, 0.0, vy0])
    full = solve_ivp(
        rot_rhs,
        (0.0, period),
        s0,
        method="DOP853",
        rtol=RTOL,
        atol=ATOL,
        dense_output=True,
    )
    ts = np.linspace(0.0, period, 20001)
    ys = full.sol(ts)
    d_moon = np.hypot(ys[0] - MOON_X, ys[1])
    d_prim = np.hypot(ys[0] - PRIMARY_X, ys[1])
    # Retrograde check: signed angular momentum about the moon in rotating frame.
    h = (ys[0] - MOON_X) * ys[3] - ys[1] * ys[2]
    end = full.y[:, -1]
    return {
        "d": d,
        "converged": True,
        "x0_rot": x0,
        "vy0_rot": vy0,
        "half_crossing_vx_residual": float(s_half[2]),
        "half_crossing_x": float(s_half[0]),
        "period": period,
        "jacobi": jacobi(s0),
        "jacobi_drift_one_period": jacobi(end) - jacobi(s0),
        "rotating_closure_one_period": {
            "position": float(np.linalg.norm(end[:2] - s0[:2])),
            "velocity": float(np.linalg.norm(end[2:] - s0[2:])),
        },
        "min_moon_center_distance": float(d_moon.min()),
        "max_moon_center_distance": float(d_moon.max()),
        "time_mean_moon_distance": float(d_moon.mean()),
        "min_moon_surface_clearance": float(d_moon.min() - MOON_R),
        "min_primary_center_distance": float(d_prim.min()),
        "min_primary_surface_clearance": float(d_prim.min() - PRIMARY_R),
        "retrograde_about_moon_all_samples": bool(np.all(h < 0)),
        "_curve": ys[:2],
    }


# ---------------------------------------------------------------- inertial frame
def rails(t: float) -> tuple[Vector, Vector]:
    """Fixture rails: center + radius * (cos(phase + rate t), sin(phase + rate t))."""
    p, m = FX["primary"]["rail"], FX["moon"]["rail"]
    primary = p["radius"] * np.array([math.cos(p["phase"] + t), math.sin(p["phase"] + t)])
    moon = m["radius"] * np.array([math.cos(m["phase"] + t), math.sin(m["phase"] + t)])
    return primary, moon


def inertial_rhs(t: float, s: Vector) -> Vector:
    acc = np.zeros(2)
    for mu, pos in zip((FX["primary"]["mu"], FX["moon"]["mu"]), rails(t), strict=True):
        rel = pos - s[:2]
        acc += mu * rel / np.linalg.norm(rel) ** 3
    return np.concatenate((s[2:], acc))


def to_rotating(t: float, s: Vector) -> Vector:
    c, sn = math.cos(t), math.sin(t)
    rot = np.array([[c, sn], [-sn, c]])  # R(-t)
    r = s[:2]
    v = s[2:] - np.array([-r[1], r[0]])  # subtract omega x r
    return np.concatenate((rot @ r, rot @ v))


def inertial_check(dro: dict[str, Any]) -> dict[str, Any]:
    x0, vy0, period = dro["x0_rot"], dro["vy0_rot"], dro["period"]
    s_rot0 = np.array([x0, 0.0, 0.0, vy0])
    s_in0 = np.array([x0, 0.0, 0.0, vy0 + x0])  # v_in = v_rot + (-y, x)
    horizon = min(max(3 * period, MIN_HORIZON), MAX_HORIZON)
    sol = solve_ivp(
        inertial_rhs,
        (0.0, horizon),
        s_in0,
        method="DOP853",
        rtol=RTOL,
        atol=ATOL,
        dense_output=True,
    )
    assert sol.success, sol.message
    closure = []
    k = 1
    while k * period <= horizon + 1e-12:
        t = k * period
        e = to_rotating(t, sol.sol(t)) - s_rot0
        closure.append(
            {
                "k": k,
                "t": t,
                "position_error": float(np.linalg.norm(e[:2])),
                "velocity_error": float(np.linalg.norm(e[2:])),
            }
        )
        k += 1
    ts = np.linspace(0.0, horizon, int(horizon * 2000) + 1)
    ys = sol.sol(ts)
    d_moon = np.empty_like(ts)
    d_prim = np.empty_like(ts)
    jac = np.empty_like(ts)
    for i, t in enumerate(ts):
        primary, moon = rails(float(t))
        d_moon[i] = np.linalg.norm(ys[:2, i] - moon)
        d_prim[i] = np.linalg.norm(ys[:2, i] - primary)
        jac[i] = jacobi(to_rotating(float(t), ys[:, i]))
    return {
        "initial_inertial_state": [float(v) for v in s_in0],
        "horizon": horizon,
        "periods_in_horizon": horizon / period,
        "nfev": int(sol.nfev),
        "closure_rotating_frame": closure,
        "max_moon_center_distance": float(d_moon.max()),
        "min_moon_center_distance": float(d_moon.min()),
        "min_moon_surface_clearance": float(d_moon.min() - MOON_R),
        "min_primary_center_distance": float(d_prim.min()),
        "min_primary_surface_clearance": float(d_prim.min() - PRIMARY_R),
        "max_abs_jacobi_drift": float(np.max(np.abs(jac - jac[0]))),
        "_xy": ys[:2],
        "_ts": ts,
    }


# ---------------------------------------------------------------- figure
RAMP = (
    "#86b6ef",
    "#5598e7",
    "#2a78d6",
    "#1c5cab",
    "#104281",
)  # ordinal blue, light->dark
INK, MUTED, GRID, SURFACE = "#1f1f1e", "#6b6b66", "#d9d8d4", "#fcfcfb"


def plot(family: list[dict[str, Any]], chosen: dict[str, Any], inertial: dict[str, Any]) -> None:
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10, 5), dpi=110, facecolor=SURFACE)
    for ax in (ax1, ax2):
        ax.set_facecolor(SURFACE)
        ax.set_aspect("equal")
        ax.tick_params(colors=MUTED, labelsize=8)
        for spine in ax.spines.values():
            spine.set_color(GRID)
    ok = [m for m in family if m["converged"]]
    for color, m in zip(RAMP, ok, strict=False):
        lw = 2.0 if m is chosen else 1.2
        ax1.plot(
            *m["_curve"],
            color=color,
            lw=lw,
            label=f"d = {m['d']:.2f}, P = {m['period']:.3f}" + (" (chosen)" if m is chosen else ""),
        )
    ax1.add_patch(plt.Circle((MOON_X, 0), MOON_R, color=MUTED))
    ax1.annotate("moon", (MOON_X, 0), (MOON_X, 0.04), color=INK, fontsize=8, ha="center")
    ax1.add_patch(plt.Circle((PRIMARY_X, 0), PRIMARY_R, color=MUTED))
    ax1.annotate("primary", (PRIMARY_X, 0), (PRIMARY_X, 0.1), color=INK, fontsize=8, ha="center")
    ax1.set_xlim(-0.15, 1.45)
    ax1.set_ylim(-0.75, 0.75)
    ax1.set_title("Rotating frame: planar DRO family (mu = 0.02)", color=INK, fontsize=10)
    ax1.legend(fontsize=7, frameon=False, labelcolor=INK, loc="upper left")

    th = np.linspace(0, 2 * np.pi, 400)
    ax2.plot(
        0.98 * np.cos(th),
        0.98 * np.sin(th),
        color=GRID,
        lw=1,
        ls="--",
        label="moon rail",
    )
    shown = inertial["_ts"] <= 3 * chosen["period"]
    ax2.plot(
        *inertial["_xy"][:, shown],
        color=RAMP[3],
        lw=1.2,
        label="ship, inertial integration, moving rails",
    )
    ax2.add_patch(plt.Circle((PRIMARY_X, 0), PRIMARY_R, color=MUTED))
    ax2.add_patch(plt.Circle((MOON_X, 0), MOON_R, color=MUTED))
    ax2.annotate(
        "moon at t = 0",
        (MOON_X, 0),
        (MOON_X - 0.1, 0.07),
        color=INK,
        fontsize=8,
        ha="center",
    )
    ax2.annotate(
        "primary (rail r = 0.02\nis inside its disc)",
        (PRIMARY_X, 0),
        (PRIMARY_X, 0.12),
        color=INK,
        fontsize=8,
        ha="center",
    )
    ax2.plot(*inertial["_xy"][:, 0], "o", ms=5, color=INK, label="ship at t = 0")
    ax2.set_xlim(-1.35, 1.35)
    ax2.set_ylim(-1.35, 1.35)
    ax2.set_title(
        f"Inertial frame: d = {chosen['d']:.2f} DRO, t = 0..3P = 0..{3 * chosen['period']:.3f}",
        color=INK,
        fontsize=10,
    )
    ax2.legend(fontsize=7, frameon=False, labelcolor=INK, loc="upper left")
    fig.tight_layout()
    fig.savefig(HERE / "dro.png", facecolor=SURFACE)
    plt.close(fig)


def main() -> None:
    family: list[dict[str, Any]] = []
    guess = -(math.sqrt(MU / D_VALUES[0]) + D_VALUES[0])  # Kepler retrograde minus frame spin
    for d in D_VALUES:
        member = find_dro(d, guess)
        family.append(member)
        if member["converged"]:
            guess = member["vy0_rot"]  # continuation from previous member
    chosen = next(m for m in family if m["converged"] and math.isclose(m["d"], CHOSEN_D))
    inertial = inertial_check(chosen)
    mean_d = chosen["time_mean_moon_distance"]
    kepler = {
        "radius": mean_d,
        "circular_speed": math.sqrt(MU / mean_d),
        "period": 2 * math.pi * math.sqrt(mean_d**3 / MU),
        "dro_period": chosen["period"],
        "note": "isolated-moon circular orbit at the DRO's time-mean moon distance",
    }
    plot(family, chosen, inertial)

    def clean(obj: dict[str, Any]) -> dict[str, Any]:
        return {k: v for k, v in obj.items() if not k.startswith("_")}

    results = {
        "provenance": {
            "fixture": str(FIXTURE.relative_to(REPO)),
            "mu": MU,
            "moon_surface_radius": MOON_R,
            "primary_surface_radius": PRIMARY_R,
            "integrator": "scipy.integrate.solve_ivp DOP853",
            "rtol": RTOL,
            "atol": ATOL,
            "python": platform.python_version(),
            "numpy": np.__version__,
            "scipy": scipy.__version__,
            "frames": "rotating: moon (0.98,0), primary (-0.02,0); inertial coincides at t=0",
        },
        "family": [clean(m) for m in family],
        "chosen_d": CHOSEN_D,
        "chosen_inertial": clean(inertial),
        "ship_state_json": inertial["initial_inertial_state"],
        "two_body_comparison": kepler,
    }
    (HERE / "results.json").write_text(json.dumps(results, indent=2) + "\n")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
