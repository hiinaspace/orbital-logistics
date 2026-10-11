"""Bounded offline staged Apollo authoring. Production never optimizes controls."""

import json
import math
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import brentq, least_squares

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
D = json.loads((ROOT / "fixtures/model-sets/aster-selene-expedition.json").read_text())
W = json.loads((ROOT / "docs/design/apollo/witness.json").read_text())
P = json.loads((HERE / "prefix-probe.json").read_text())
N = D["scenario"]["bodies"][1]["rail"]["rate"]
PHASE = D["scenario"]["bodies"][1]["rail"]["phase"]
VE = 8.0
Q = 0.15
LS = D["arcs"][4]["start"]
LAND = D["landing"]
LIFT = D["liftoff"]
AIR = D["entry"]["atmosphere"]
U = 7 * math.exp(-3 * (0.78 - 0.3) / 8)
LF = Q * P["lunarSplit"]["propellant"]
OF = U - 1 - LF
HARDWARE = {
    "booster": {
        "id": "Atlas",
        "name": "Atlas",
        "color": "#e3a878",
        "dryMass": 0.2,
        "propellant": 2.5,
        "tankCapacity": 2.5,
        "exhaustVelocity": 8,
        "engine": {"maxThrust": 32, "maxAcceleration": 3},
    },
    "orbiter": {
        "id": "Odyssey",
        "name": "Odyssey",
        "color": "#e6c98b",
        "dryMass": 0.85,
        "propellant": OF,
        "tankCapacity": OF,
        "exhaustVelocity": 8,
        "engine": {"maxThrust": 24, "maxAcceleration": 3},
    },
    "lander": {
        "id": "Eagle",
        "name": "Eagle",
        "color": "#a8d4ce",
        "dryMass": 0.15,
        "propellant": LF,
        "tankCapacity": LF,
        "exhaustVelocity": 8,
        "engine": {"maxThrust": 3.6, "maxAcceleration": 3},
    },
}


def planar(y):
    return np.array([y[0], y[1], y[3], y[4]])


def moon(t):
    a = PHASE + N * t
    return np.array(
        [5 * np.cos(a), 5 * np.sin(a), -5 * N * np.sin(a), 5 * N * np.cos(a)]
    )


def pad(t):
    a = D["ports"][1]["rail"]["phase"] + N * t
    p = 0.20001 * np.array([np.cos(a), np.sin(a)])
    m = moon(t)
    return np.r_[m[:2] + p, m[2:] + N * np.array([-p[1], p[0]])]


def gravity(t, y, soft=False):
    p = y[:2]
    q = moon(t)[:2] - p
    return (
        -p / max(np.linalg.norm(p), 1 if soft else 1e-8) ** 3
        + 0.03 * q / max(np.linalg.norm(q), 0.2 if soft else 1e-8) ** 3
    )


def direction(angles, u):
    v = np.clip(u, 0, 1) * (len(angles) - 1)
    i = min(len(angles) - 2, int(v))
    f = v - i
    f = f * f * (3 - 2 * f)
    delta = (angles[i + 1] - angles[i] + math.pi) % (2 * math.pi) - math.pi
    a = angles[i] + f * delta
    return np.array([math.cos(a), math.sin(a)])


def integrate(
    z,
    start,
    end,
    angles=None,
    force=24.0,
    nonfuel=1.0,
    tight=False,
    soft=False,
    area=0.0,
):
    if end <= start:
        return np.array(z), 1.0

    def rhs(t, y):
        m = nonfuel + y[4]
        actual = min(force, 3 * m) if angles is not None else 0.0
        d = (
            direction(angles, (t - start) / (end - start))
            if angles is not None
            else np.zeros(2)
        )
        air = np.zeros(2)
        if area:
            alt = np.linalg.norm(y[:2]) - 1
            rel = y[2:4] - 0.03 * np.array([-y[1], y[0]])
            u = np.clip(
                (AIR["topHeight"] - alt) / (AIR["topHeight"] - AIR["fadeHeight"]), 0, 1
            )
            rho = (
                AIR["density"]
                * math.exp(-max(0, alt) / AIR["scaleHeight"])
                * u
                * u
                * (3 - 2 * u)
            )
            air = -0.5 * rho * area * np.linalg.norm(rel) * rel / m
        return np.r_[y[2:4], gravity(t, y, soft) + air + actual / m * d, -actual / VE]

    sol = solve_ivp(
        rhs,
        (start, end),
        z,
        method="DOP853",
        rtol=2e-12 if tight else 3e-8,
        atol=2e-13 if tight else 3e-10,
        max_step=min(0.15, (end - start) / 16) if angles is not None else 0.15,
    )
    clear = min(
        float(np.min(np.linalg.norm(sol.y[:2], axis=0) - 1)),
        min(
            float(np.linalg.norm(sol.y[:2, i] - moon(t)[:2]) - 0.2)
            for i, t in enumerate(sol.t)
        ),
    )
    return sol.y[:, -1], clear


def arc(identity, t, end, angles, throttle=1.0):
    angles = list(map(float, angles))
    vectors = [[math.cos(a), math.sin(a), 0] for a in angles]
    return {
        "id": identity,
        "start": float(t),
        "end": float(end),
        "direction": vectors[0],
        "throttle": throttle,
        "steering": {
            "kind": "spherical-smoothstep-v1",
            "keys": [
                {
                    "offset": (end - t)
                    if i == len(vectors) - 1
                    else (end - t) * i / (len(vectors) - 1),
                    "direction": v,
                }
                for i, v in enumerate(vectors)
            ],
        },
    }


def angles(a):
    return np.unwrap(
        [
            math.atan2(k["direction"][1], k["direction"][0])
            for k in a["steering"]["keys"]
        ]
    )


def skeleton():
    d = {
        k: D[k]
        for k in [
            "schemaVersion",
            "name",
            "description",
            "provenance",
            "extent",
            "ports",
            "entry",
        ]
    }
    d.update(
        modelVersion="staged-apollo-v1",
        id="aster-selene-staged-expedition",
        name="Aster–Selene · Staged expedition",
        description="Atlas launches Odyssey and Eagle. Eagle lands on Selene and rejoins Odyssey for the flight home.",
        provenance="Prepared fictional staged expedition. Exact zero-kick splits, protected vehicle tanks, paid finite lunar rendezvous and two atmospheric recoveries.",
        world={k: v for k, v in D["scenario"].items() if k != "ship"},
        hardware=HARDWARE,
        stack={
            "id": "Atlas-stack",
            "name": "Atlas · Odyssey · Eagle",
            "color": "#e6c98b",
        },
        launch=D["launch"],
        boosterSeparation=0.78,
        ascentEnd=D["ascentEnd"],
        lunarSeparation=LS,
        landing=LAND,
        liftoff=LIFT,
        lunarDock=44.0,
        entryStart=D["entryStart"],
        boosterEntryStart=1.4,
        programs={
            "stack": [D["arcs"][0]],
            "orbiterOutbound": D["arcs"][1:4],
            "lander": [D["arcs"][4], D["arcs"][5]],
            "orbiterReturn": D["arcs"][6:],
            "booster": [],
        },
        dragAreas={"stack": 0.015 * (U + 2.7) / 7, "upper": 0.015, "booster": 0.015},
    )
    return d


# Orbiter is one all-field coast. It is targetable, never a prescribed lunar rail.
zsplit = np.r_[planar(P["lunarSplit"]["y"]), P["lunarSplit"]["propellant"] - LF]


def rhs_orb(t, y):
    return np.r_[y[2:], gravity(t, y)]


ORBIT = solve_ivp(
    rhs_orb,
    (LS, 60),
    zsplit[:4],
    method="DOP853",
    rtol=2e-13,
    atol=2e-14,
    max_step=0.05,
    dense_output=True,
)
start = np.r_[pad(LIFT), Q * P["landing"]["propellant"]]


def solve_ascent():
    normal = D["ports"][1]["rail"]["phase"] + N * LIFT
    arrival = 44.5
    first = np.array(
        [normal, 0.83270909, 0.74584106, 0.80783301, 3.50578174, 5.65101022]
    )
    tail = np.array([1.92035994, 1.81831688, 2.00343666, 5.05343616, 7.73615653])
    # Refine keys so every authored spherical turn stays below 120 degrees.
    refine = lambda x: np.interp(
        np.linspace(0, len(x) - 1, 2 * len(x) - 1), np.arange(len(x)), x
    )
    first = refine(first)
    tail = refine(tail)
    seed = np.r_[first[1:], 0.98356271, tail, 0.55056065]

    def run(x, tight=False):
        first = np.r_[normal, x[:10]]
        dur = x[10]
        tail = x[11:20]
        brake = x[20]
        y, c0 = integrate(
            start,
            LIFT,
            LIFT + dur,
            first,
            force=0.72,
            nonfuel=0.15,
            tight=tight,
            soft=not tight,
        )
        y, c1 = integrate(
            y, LIFT + dur, arrival - brake, nonfuel=0.15, tight=tight, soft=not tight
        )
        y, c2 = integrate(
            y,
            arrival - brake,
            arrival,
            tail,
            force=0.72,
            nonfuel=0.15,
            tight=tight,
            soft=not tight,
        )
        return y, min(c0, c1, c2), first, tail

    def residual(x, tight=False, regularize=True):
        y, clear, first, tail = run(x, tight)
        r = list(100 * (y[:4] - ORBIT.sol(arrival))) + [100 * min(0, clear - 5e-6)]
        r.extend(100 * np.maximum(0, np.abs(np.diff(first)) - 2.05))
        r.extend(100 * np.maximum(0, np.abs(np.diff(tail)) - 2.05))
        if regularize:
            r.extend(1e-4 * (x - seed))
        return np.array(r)

    lo = seed - 0.25
    hi = seed + 0.25
    lo[10] = 0.5
    hi[10] = 1.6
    lo[20] = 0.15
    hi[20] = 1.2
    print("Ascent target", arrival, ORBIT.sol(arrival), "initial", start, flush=True)
    sol = least_squares(
        residual,
        seed,
        bounds=(lo, hi),
        diff_step=1e-4,
        max_nfev=150,
        ftol=1e-8,
        xtol=1e-9,
        gtol=1e-7,
        verbose=1,
    )
    print("coarse", sol.cost, sol.x, run(sol.x)[:2], flush=True)
    sol = least_squares(
        lambda x: residual(x, True, False),
        sol.x,
        bounds=(lo, hi),
        diff_step=2e-6,
        max_nfev=100,
        ftol=1e-12,
        xtol=1e-12,
        gtol=1e-10,
        verbose=1,
    )
    y, clear, first, tail = run(sol.x, True)
    print(
        "fine",
        sol.cost,
        sol.x,
        "clear",
        clear,
        "residual",
        y[:4] - ORBIT.sol(arrival),
        flush=True,
    )
    result = {
        "lunarDock": arrival,
        "start": start.tolist(),
        "parameters": sol.x.tolist(),
        "arrival": y.tolist(),
        "target": ORBIT.sol(arrival).tolist(),
        "clearance": clear,
        "residual": (y[:4] - ORBIT.sol(arrival)).tolist(),
        "arcs": [
            arc("lunar-ascent", LIFT, LIFT + sol.x[10], first, 0.2),
            arc("lunar-rendezvous", arrival - sol.x[20], arrival, tail, 0.2),
        ],
    }
    (HERE / "ascent-witness.json").write_text(json.dumps(result, indent=2) + "\n")
    if max(abs(y[:4] - ORBIT.sol(arrival))) > 2e-7 or clear < 0:
        raise RuntimeError("Ascent unresolved")
    return result


def solve_return():
    ascent = json.loads((HERE / "ascent-witness.json").read_text())
    lander_fuel = ascent["arrival"][4] - (0.15 + ascent["arrival"][4]) * -math.expm1(
        -np.linalg.norm(
            np.array(ascent["arrival"][2:4]) - np.array(ascent["target"][2:])
        )
        / 8
    )
    nonfuel = 1 + lander_fuel
    departure = 47.15
    initial = np.r_[ORBIT.sol(departure), zsplit[4]]
    transfer = math.pi * ((1.4 + 5 - 0.3) / 2) ** 1.5
    a = math.atan2(moon(departure)[3], moon(departure)[2]) + math.pi
    seed = np.r_[a, a, a + math.pi, a + math.pi, 0.065, 0.08, transfer]

    def run(x, tight=False):
        d0, d1, dur = x[-3:]
        end = departure + dur
        z, c0 = integrate(
            initial,
            departure,
            departure + d0,
            x[:2],
            nonfuel=nonfuel,
            tight=tight,
            soft=not tight,
        )
        z, c1 = integrate(
            z, departure + d0, end - d1, nonfuel=nonfuel, tight=tight, soft=not tight
        )
        z, c2 = integrate(
            z, end - d1, end, x[2:4], nonfuel=nonfuel, tight=tight, soft=not tight
        )
        r = np.linalg.norm(z[:2])
        v = z[2:4]
        residual = np.array(
            [
                r - 1.4,
                np.dot(z[:2], v) / r,
                (z[0] * v[1] - z[1] * v[0]) / r - 1 / math.sqrt(1.4),
                min(0, min(c0, c1, c2) - 1e-4),
            ]
        )
        return z, residual, min(c0, c1, c2)

    def residual(x, tight=False, regularize=True):
        r = 100 * run(x, tight)[1]
        if regularize:
            r = np.r_[
                r, 1e-5 * np.diff(x[:2]), 1e-5 * np.diff(x[2:4]), 1e-6 * (x - seed)
            ]
        return r

    lo = np.r_[seed[:4] - 1.3, 0.008, 0.008, transfer * 0.65]
    hi = np.r_[seed[:4] + 1.3, 0.8, 0.8, transfer * 1.6]
    print("Return initial", departure, initial, nonfuel, seed, flush=True)
    sol = least_squares(
        residual,
        seed,
        bounds=(lo, hi),
        diff_step=1e-4,
        max_nfev=180,
        ftol=1e-9,
        xtol=1e-10,
        gtol=1e-7,
        verbose=1,
    )
    print("coarse return", sol.cost, sol.x, flush=True)
    sol = least_squares(
        lambda x: residual(x, True, False),
        sol.x,
        bounds=(lo, hi),
        diff_step=2e-6,
        max_nfev=120,
        ftol=1e-12,
        xtol=1e-12,
        gtol=1e-10,
        verbose=1,
    )
    z, res, clear = run(sol.x, True)
    x = sol.x
    end = departure + x[-1]
    print("fine return", sol.cost, x, "clear", clear, "residual", res, flush=True)
    if max(abs(res)) > 2e-7 or clear < 0:
        raise RuntimeError("Return unresolved")
    arcs = [
        arc("transearth-injection", departure, departure + x[-3], x[:2]),
        arc("earth-orbit-insertion", end - x[-2], end, x[2:4]),
    ]
    parking = z.copy()
    deorbit_t = end + 2 * math.pi * 1.4**1.5
    z, _ = integrate(z, end, deorbit_t, nonfuel=nonfuel, tight=True)
    initial_deorbit = z.copy()
    angle = math.atan2(z[3], z[2]) + math.pi

    def peri(duration):
        y, _ = integrate(
            initial_deorbit,
            deorbit_t,
            deorbit_t + duration,
            [angle, angle],
            nonfuel=nonfuel,
            tight=True,
        )
        r = np.linalg.norm(y[:2])
        energy = np.dot(y[2:4], y[2:4]) / 2 - 1 / r
        h = y[0] * y[3] - y[1] * y[2]
        e = math.sqrt(1 + 2 * energy * h * h)
        return h * h / (1 + e), y

    duration = brentq(lambda dur: peri(dur)[0] - 1.055, 0.001, 0.1)
    _, z = peri(duration)
    arcs.append(arc("deorbit", deorbit_t, deorbit_t + duration, [angle, angle]))
    result = {
        "departure": departure,
        "initial": initial.tolist(),
        "landerFuel": lander_fuel,
        "nonfuel": nonfuel,
        "parameters": x.tolist(),
        "parkingEpoch": end,
        "parkingState": parking.tolist(),
        "entryStart": deorbit_t + duration,
        "entryState": z.tolist(),
        "clearance": clear,
        "residual": res.tolist(),
        "arcs": arcs,
    }
    (HERE / "return-witness.json").write_text(json.dumps(result, indent=2) + "\n")
    return result


def assemble():
    """Freeze solved controls; refresh dependent fuel diagnostics without search."""
    up = json.loads((HERE / "ascent-witness.json").read_text())
    back = json.loads((HERE / "return-witness.json").read_text())
    booster = json.loads((HERE / "booster-witness.json").read_text())
    speed = np.linalg.norm(np.array(up["arrival"][2:4]) - np.array(up["target"][2:]))
    lander_fuel = up["arrival"][4] - (0.15 + up["arrival"][4]) * -math.expm1(-speed / 8)
    nonfuel = 1 + lander_fuel
    t = up["lunarDock"]
    z = np.r_[ORBIT.sol(t), zsplit[4]]
    checkpoints = []
    for control in back["arcs"]:
        if control["start"] > t:
            z, _ = integrate(z, t, control["start"], nonfuel=nonfuel, tight=True)
        z, _ = integrate(
            z,
            control["start"],
            control["end"],
            angles(control),
            nonfuel=nonfuel,
            tight=True,
        )
        t = control["end"]
        checkpoints.append({"name": control["id"], "t": t, "state": z.tolist()})
    back.update(
        landerFuel=float(lander_fuel),
        nonfuel=float(nonfuel),
        entryState=z.tolist(),
        checkpoints=checkpoints,
    )
    (HERE / "return-witness.json").write_text(json.dumps(back, indent=2) + "\n")
    d = skeleton()
    d.update(
        lunarDock=up["lunarDock"], entryStart=back["entryStart"], boosterEntryStart=1.14
    )
    d["programs"]["lander"] = [D["arcs"][4]] + up["arcs"]
    d["programs"]["orbiterReturn"] = back["arcs"]
    d["programs"]["booster"] = [booster["canonical"][0]["arc"]]
    (ROOT / "fixtures/model-sets/aster-selene-staged-expedition.json").write_text(
        json.dumps(d, indent=2) + "\n"
    )
    witness = {
        "purpose": "Frozen staged mission authoring; production admission and independent whole-mission oracle are separate",
        "hardware": HARDWARE,
        "massContract": booster["massContract"],
        "lunarSplit": P["lunarSplit"],
        "landerAscent": up,
        "orbiterReturn": back,
        "booster": booster,
    }
    (HERE / "witness.json").write_text(json.dumps(witness, indent=2) + "\n")
    print("Frozen fixture assembled", d["id"], "entry", d["entryStart"])


if __name__ == "__main__":
    import sys

    if "--ascent" in sys.argv:
        solve_ascent()
    elif "--return" in sys.argv:
        solve_return()
    else:
        assemble()
