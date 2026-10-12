"""Frozen-control designer/oracle for the compact Aster–Selene cycler.

Production TypeScript canonical RK4 admits execution; inverse curves only seed
acceleration commands. DOP853 supplies an independent full coupled-cycle witness.
"""

from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import numpy as np
from scipy.integrate import OdeSolution, solve_ivp
from scipy.interpolate import CubicSpline
from scipy.optimize import brentq, root

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "fixtures/model-sets/compact-cycler-profile.json"
RATE = float(np.sqrt(1.03 / 125))
BEACON = float(brentq(lambda x: RATE**2 * x - 1 / x**2 - 0.03 / (x - 5) ** 2, 5.3, 7))
H = 8.0
PERIOD = 2 * H + 56
VE = 8.0
HEIGHT = 1e-5
TIMES = dict(
    moonLaunch=H,
    boardIn=H + 5,
    releaseIn=H + 18,
    asterLand=H + 24,
    asterUnload=H + 24.5,
    asterRefill=H + 25,
    asterLaunch=H + 30,
    boardOut=H + 36,
    releaseOut=H + 46,
    moonLand=H + 51,
    moonUnload=H + 51.5,
    moonRefill=H + 52,
    carrierLaunch=1.0,
    coastStart=H + 1,
    coastEnd=H + 55,
    carrierDock=2 * H + 55,
    carrierRefill=2 * H + 55.5,
)


def rotate(y, a):
    c, s = np.cos(a), np.sin(a)
    return np.array(
        [c * y[0] - s * y[1], s * y[0] + c * y[1], c * y[2] - s * y[3], s * y[2] + c * y[3]]
    )


def circular(t, r):
    return rotate([r, 0, 0, RATE * r], RATE * t)


def port(id, t):
    if id == "Beacon":
        return circular(t, BEACON)
    if id == "Cairn":
        return circular(t, 1 + HEIGHT)
    if id == "Haven":
        return circular(t, 5 + 0.2 + HEIGHT)
    raise ValueError(id)


def gravity(t, p):
    d = circular(t, 5)[:2] - p
    return -p / np.linalg.norm(p) ** 3 + 0.03 * d / np.linalg.norm(d) ** 3


def state6(y):
    return [float(y[0]), float(y[1]), 0.0, float(y[2]), float(y[3]), 0.0]


def acc_port(id, t):
    return -(RATE**2) * port(id, t)[:2]


def normal(id, t):
    return circular(t, 1)[:2]


def forward(t0, t1, initial, spline=None, sensitivity=False, bases=None):
    def rhs(t, y):
        a = np.zeros(2) if spline is None else spline(t)
        p = y[:2]
        g = gravity(t, p)
        dy = np.r_[y[2:4], g + a, np.linalg.norm(a)]
        if sensitivity:
            assert bases is not None
            ds = [-p, circular(t, 5)[:2] - p]
            jac = sum(
                mu
                * (3 * np.outer(d, d) / np.linalg.norm(d) ** 5 - np.eye(2) / np.linalg.norm(d) ** 3)
                for d, mu in zip(ds, [1.0, 0.03])
            )
            sens = y[5:].reshape(4, 4)
            forcing = np.c_[np.eye(2) * bases[0](t), np.eye(2) * bases[1](t)]
            dy = np.r_[dy, np.vstack([sens[2:], jac @ sens[:2] + forcing]).ravel()]
        return dy

    cuts = [t0, t1] if spline is None else spline.x
    current = np.r_[initial, 0.0, np.zeros(16)] if sensitivity else np.r_[initial, 0.0]
    nodes = []
    states = []
    ts = []
    interpolants = []
    work = 0
    for left, right in zip(cuts[:-1], cuts[1:]):
        part = solve_ivp(
            rhs,
            (left, right),
            current,
            method="DOP853",
            rtol=2.3e-14,
            atol=2e-16,
            dense_output=True,
            max_step=min(0.125, right - left),
        )
        work += part.nfev
        if not part.success or work > 300000:
            raise RuntimeError("Forward work/solver budget")
        nodes.extend(part.t if not nodes else part.t[1:])
        states.extend(part.y.T if not states else part.y.T[1:])
        ts.extend(part.sol.ts if not ts else part.sol.ts[1:])
        interpolants.extend(part.sol.interpolants)
        current = part.y[:, -1]
    return SimpleNamespace(
        t=np.array(nodes),
        y=np.array(states).T,
        sol=OdeSolution(np.array(ts), interpolants),
        nfev=work,
    )


def burn(id, t0, t1, initial, target, cap, launch=None, landing=None):
    dt = t1 - t0
    c = np.zeros((6, 2))
    c[0] = initial[:2]
    c[1] = dt * initial[2:]
    a0 = (
        gravity(t0, initial[:2])
        if launch is None
        else acc_port(launch, t0) + 0.3 * normal(launch, t0)
    )
    a1 = (
        gravity(t1, target[:2])
        if landing is None
        else acc_port(landing, t1) + 0.3 * normal(landing, t1)
    )
    c[2] = dt**2 * a0 / 2
    c[3:] = np.linalg.solve(
        [[1, 1, 1], [3, 4, 5], [6, 12, 20]],
        [target[:2] - c[:3].sum(0), dt * target[2:] - c[1] - 2 * c[2], dt * dt * a1 - 2 * c[2]],
    )
    keys = np.linspace(t0, t1, 129)
    seed = []
    for t in keys:
        u = (t - t0) / dt
        p = sum(c[i] * u**i for i in range(6))
        a = sum(i * (i - 1) * c[i] * u ** (i - 2) for i in range(2, 6)) / dt**2
        seed.append(a - gravity(t, p))
    u = (keys - t0) / dt
    shape = np.sin(np.pi * u) ** 2
    bases = [CubicSpline(keys, shape), CubicSpline(keys, shape * (2 * u - 1))]
    cached = None
    answer = None
    calls = 0

    def trial(params):
        nonlocal cached, answer, calls
        if cached is not None and np.array_equal(cached, params):
            return answer
        calls += 1
        if calls > 40:
            raise RuntimeError("Burn targeting call budget " + id)
        values = (
            np.array(seed)
            + shape[:, None] * params[:2]
            + (shape * (2 * u - 1))[:, None] * params[2:]
        )
        spline = CubicSpline(keys, values)
        res = forward(t0, t1, initial, spline, True, bases)
        cached = params.copy()
        answer = (res, spline)
        return answer

    def residual(params):
        return (trial(params)[0].y[:4, -1] - target) / [dt * dt, dt * dt, dt, dt]

    def jacobian(params):
        return (
            trial(params)[0].y[5:, -1].reshape(4, 4) / np.array([dt * dt, dt * dt, dt, dt])[:, None]
        )

    solved = root(residual, np.zeros(4), jac=jacobian, tol=1e-10, options={"maxfev": 40})
    res, spline = trial(solved.x)
    actual = forward(t0, t1, initial, spline)
    error = np.max(np.abs(actual.y[:4, -1] - target))
    c = spline.c
    h = np.diff(keys)[:, None]
    hull = np.array(
        [
            c[3],
            c[3] + c[2] * h / 3,
            c[3] + 2 * c[2] * h / 3 + c[1] * h * h / 3,
            c[3] + c[2] * h + c[1] * h * h + c[0] * h**3,
        ]
    )
    bound = float(np.linalg.norm(hull, axis=2).max())
    print(id, "calls", calls, "residual", error, "cap", bound, "dv", actual.y[4, -1], flush=True)
    if error > 1e-9 or bound > cap:
        raise RuntimeError("Burn admission " + id)
    coefficient = np.zeros((128, 4, 3))
    coefficient[:, :, :2] = spline.c.transpose(1, 0, 2)
    arc = dict(
        id=id,
        start=t0,
        end=t1,
        keys=[[float(t), *map(float, spline(t)), 0.0] for t in keys],
        coefficients=coefficient.tolist(),
        initial=state6(initial),
        endpoint=state6(actual.y[:4, -1]),
        accelerationBound=bound,
    )
    return dict(
        t0=t0,
        t1=t1,
        result=actual,
        arc=arc,
        initial=initial.copy(),
        end=actual.y[:4, -1].copy(),
        dv=float(actual.y[4, -1]),
    )


def capture(before, after):
    difference = after - before
    p = float(np.linalg.norm(difference[:2]))
    v = float(np.linalg.norm(difference[2:]))
    if p + 1e-8 >= 1e-7 or v + 1e-8 >= 1e-7:
        raise RuntimeError(f"Capture {p=} {v=}")
    return dict(position=p, velocity=v, paidDeltaV=v + 1e-8)


def oracle(q):
    ts = np.unique(np.r_[np.linspace(q["t0"], q["t1"], 65), q["result"].t[::16], q["t1"]])
    return [
        [float(t), *state6(q["result"].sol(float(t))[:4]), float(q["result"].sol(float(t))[4])]
        for t in ts
    ]


def compile_profile():
    study = json.loads((ROOT / "docs/design/compact-cycler/refined-candidates.json").read_text())
    seed = next(q for q in study if q["radius"] == 6.2 and q["offset"] == -0.04 and q["h"] == 8)
    shift = H - 4
    start = rotate(seed["start"], RATE * shift)
    goal = rotate(seed["end"], RATE * shift)
    # Correct the seed's coast endpoint under the strict independent oracle policy.
    p0 = start[:2].copy()
    t0, t1 = TIMES["coastStart"], TIMES["coastEnd"]
    solved = root(
        lambda v: forward(t0, t1, np.r_[p0, v]).y[:2, -1] - goal[:2],
        start[2:],
        tol=1e-10,
        options={"maxfev": 40},
    )
    start = np.r_[p0, solved.x]
    dep = burn("Beacon departure", 1.0, t0, port("Beacon", 1.0), start, 0.15)
    coast = forward(t0, t1, dep["end"])
    coastq = dict(t0=t0, t1=t1, result=coast, initial=dep["end"], end=coast.y[:4, -1], dv=0.0)
    insertion = burn(
        "Beacon arrival",
        t1,
        TIMES["carrierDock"],
        coast.y[:4, -1],
        port("Beacon", TIMES["carrierDock"]),
        0.15,
    )
    carrier: list[dict[str, Any]] = [dep, coastq, insertion]

    def carrier_at(t):
        return next(q for q in carrier if q["t0"] <= t <= q["t1"])["result"].sol(t)[:4]

    ccap = capture(insertion["end"], port("Beacon", TIMES["carrierDock"]))
    carrier_cost = dep["dv"] + insertion["dv"] + ccap["paidDeltaV"]
    carrier_final = 10 * np.exp(-carrier_cost / VE) - 4
    if carrier_final < 0.6:
        raise RuntimeError("Carrier reserve")
    legs: list[dict[str, Any]] = []
    caps = []
    half = []
    fuel = 3.0
    used = 0.0
    for id, a, b, origin, destination in [
        ("Haven launch", TIMES["moonLaunch"], TIMES["boardIn"], "Haven", None),
        ("Cairn landing", TIMES["releaseIn"], TIMES["asterLand"], None, "Cairn"),
        ("Cairn launch", TIMES["asterLaunch"], TIMES["boardOut"], "Cairn", None),
        ("Haven landing", TIMES["releaseOut"], TIMES["moonLand"], None, "Haven"),
    ]:
        initial = port(origin, a) if origin else carrier_at(a)
        target = port(destination, b) if destination else carrier_at(b)
        leg = burn(id, a, b, initial, target, 3.0, launch=origin, landing=destination)
        cap = capture(leg["end"], target)
        fuel = (1.15 + fuel) * np.exp(-(leg["dv"] + cap["paidDeltaV"]) / VE) - 1.15
        used += leg["dv"] + cap["paidDeltaV"]
        legs.append(leg)
        caps.append(cap)
        if destination:
            print("half fuel", fuel, "dv", used, flush=True)
            if fuel < 0.3:
                raise RuntimeError("Shuttle reserve")
            half.append(dict(fuel=fuel, dv=used))
            fuel = 3.0
            used = 0.0
    segments = [
        dict(
            id=q.get("arc", {}).get("id", "Coast"),
            start=q["t0"],
            end=q["t1"],
            initial=state6(q["initial"]),
            endpoint=state6(q["end"]),
            oracle=oracle(q),
            **({"control": q["arc"]} if "arc" in q else {}),
        )
        for q in carrier + legs
    ]
    profile = dict(
        schemaVersion=1,
        modelVersion="compact-cycler-profile-v1",
        period=PERIOD,
        rate=RATE,
        beaconRadius=BEACON,
        step=1 / 512,
        height=HEIGHT,
        exhaustVelocity=VE,
        times=TIMES,
        carrier=dict(
            id="Wayfarer",
            name="Wayfarer · cycler",
            dryMass=4.0,
            fuel=6.0,
            cargo=0.0,
            maxAcceleration=0.15,
            maxForce=1.5,
            color="#efc689",
        ),
        shuttle=dict(
            id="Pipit",
            name="Pipit",
            dryMass=1.0,
            fuel=3.0,
            cargo=0.15,
            maxAcceleration=3.0,
            maxForce=12.45,
            color="#84cbd4",
        ),
        segments=segments,
        proof=dict(
            carrierFuel=carrier_final,
            halves=half,
            captures=[ccap, *caps],
            coastFraction=54 / PERIOD,
        ),
    )
    OUT.write_text(json.dumps(profile, separators=(",", ":")) + "\n")
    print("profile", OUT.stat().st_size, profile["proof"], flush=True)


if __name__ == "__main__":
    compile_profile()
