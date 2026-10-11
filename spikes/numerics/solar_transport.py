"""Bounded offline solar-transport compiler. AU, Julian year, metric tonnes.

Inverse curves DESIGN open-loop acceleration keys; only forward DOP853 results
are admitted. No trajectory resets occur at a control or encounter boundary.
"""

from __future__ import annotations

import hashlib
import json
import pickle
from pathlib import Path
from time import monotonic
from types import SimpleNamespace
from typing import Any

import numpy as np
from scipy.integrate import OdeSolution, solve_ivp
from scipy.interpolate import CubicSpline
from scipy.optimize import brentq, root

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "fixtures/model-sets/solar-cycler.json"
AU = 149597870.7
YEAR = 365.25 * 86400
MU = 1.32712440041279419e11 * YEAR**2 / AU**3
OMEGA = np.sqrt(MU)
R_MARS = 1.523679
S = 2 * np.pi / (OMEGA - np.sqrt(MU / R_MARS**3))
VE = 50 / (AU / YEAR)  # Fictional nuclear/electric transport, 50 km/s exhaust.
CAP = 0.25 / (AU * 1000 / YEAR**2)
DURATION = 3 * S + 0.16
GMS = np.array([MU, 398600.435507, 4902.800118, 42828.375816, 126712764.1])
GMS[1:] *= YEAR**2 / AU**3
RADII = np.array([695700, 6378.137 + 200, 1737.4 + 10, 3396.2 + 100, 71492]) / AU
F0 = -np.pi * ((OMEGA * S / (2 * np.pi)) - 2)


def ellipse(radius: float) -> dict:
    def elements(e: float):
        a = radius * (1 + e * np.cos(F0)) / (1 - e * e)
        E = 2 * np.arctan2(np.sqrt(1 - e) * np.sin(F0 / 2), np.sqrt(1 + e) * np.cos(F0 / 2))
        return a, E - e * np.sin(E)

    e = brentq(
        lambda e: np.sqrt(MU / elements(e)[0] ** 3) * S - (2 * np.pi - 2 * elements(e)[1]), 0.1, 0.8
    )
    a, mean = elements(e)
    return dict(a=a, e=e, mean=mean, omega=-F0)


ELEMENTS = ellipse(1.012)


def kepler(t: float, cycle: int = 0) -> np.ndarray:
    a, e = ELEMENTS["a"], ELEMENTS["e"]
    mean = ELEMENTS["mean"] + np.sqrt(MU / a**3) * (t - cycle * S)
    E = mean
    for _ in range(12):
        E -= (E - e * np.sin(E) - mean) / (1 - e * np.cos(E))
    q, radius = np.sqrt(1 - e * e), a * (1 - e * np.cos(E))
    angle = ELEMENTS["omega"] + OMEGA * cycle * S
    c, s = np.cos(angle), np.sin(angle)
    p = np.array([a * (np.cos(E) - e), a * q * np.sin(E), 0])
    v = np.array([-np.sin(E), q * np.cos(E), 0]) * np.sqrt(MU * a) / radius
    return np.array(
        [c * p[0] - s * p[1], s * p[0] + c * p[1], 0, c * v[0] - s * v[1], s * v[0] + c * v[1], 0]
    )


def circular(
    t: float, radius: float, mu: float, phase: float = 0, inclination: float = 0
) -> np.ndarray:
    w = np.sqrt(mu / radius**3)
    a = phase + w * t
    c, s, ci, si = np.cos(a), np.sin(a), np.cos(inclination), np.sin(inclination)
    return np.array(
        [
            radius * c,
            radius * s * ci,
            radius * s * si,
            -radius * w * s,
            radius * w * c * ci,
            radius * w * c * si,
        ]
    )


TAU = brentq(lambda t: np.linalg.norm(kepler(t)[:3]) - R_MARS, 0.1, 0.7)
MARS_PHASE = float(
    np.arctan2(kepler(TAU)[1], kepler(TAU)[0]) - np.sqrt(MU / R_MARS**3) * TAU + 0.012
)
MODEL_KEY = hashlib.sha256(
    np.r_[MU, GMS, RADII, R_MARS, S, MARS_PHASE, VE, CAP].tobytes()
    + b"solar-transport-v1:prescribed-circular:indirect:stable-origin:canonical-knots"
).hexdigest()[:12]


def body_states(t: float) -> np.ndarray:
    earth = circular(t, 1, MU)
    moon = earth + circular(t, 384400 / AU, GMS[1] + GMS[2], 0.7, np.radians(5.145))
    return np.array(
        [
            np.zeros(6),
            earth,
            moon,
            circular(t, R_MARS, MU, MARS_PHASE, np.radians(1.85)),
            circular(t, 5.2044, MU, 2.8, np.radians(1.3)),
        ]
    )


def gravity(t: float, y: np.ndarray) -> np.ndarray:
    bodies = body_states(t)[:, :3]
    d = bodies - y[:3]
    a = (GMS[:, None] * d / np.linalg.norm(d, axis=1)[:, None] ** 3).sum(axis=0)
    # Nonrotating heliocentric equation, not barycentric inertial coordinates.
    a -= (GMS[1:, None] * bodies[1:] / np.linalg.norm(bodies[1:], axis=1)[:, None] ** 3).sum(axis=0)
    return a


def relative_separations(t, y, reference):
    bodies = body_states(t)[:, :3]
    d = bodies - bodies[reference] - y[:3]
    d[reference] = -y[:3]
    if reference == 1:
        d[2] = circular(t, 384400 / AU, GMS[1] + GMS[2], 0.7, np.radians(5.145))[:3] - y[:3]
    return bodies, d


def gravity_relative(t, y, reference):
    bodies, d = relative_separations(t, y, reference)
    a = (GMS[:, None] * d / np.linalg.norm(d, axis=1)[:, None] ** 3).sum(axis=0)
    a -= (GMS[1:, None] * bodies[1:] / np.linalg.norm(bodies[1:], axis=1)[:, None] ** 3).sum(axis=0)
    return a


def coast(t0: float, t1: float, state: np.ndarray):
    return solve_ivp(
        lambda t, y: np.r_[y[3:], gravity(t, y)],
        (t0, t1),
        state,
        method="DOP853",
        rtol=2e-12,
        atol=2e-14,
        dense_output=True,
        max_step=1 / 64,
    )


def target_port(body: int, radius: float, phase: float, inclination: float, method="DOP853"):
    # Prescribed-body-centered integration of exactly the SAME heliocentric field.
    def absolute(t, relative):
        return body_states(t)[body] + relative

    def derivative(t, y):
        b = body_states(t)[body]
        origin_acc = -MU * b[:3] / np.linalg.norm(b[:3]) ** 3
        return np.r_[y[3:], gravity_relative(t, y, body) - origin_acc]

    initial = circular(0, radius, GMS[body], phase, inclination)
    result = solve_ivp(
        derivative,
        (0, DURATION),
        initial,
        method=method,
        rtol=2e-12 if method == "DOP853" else 2.3e-14,
        atol=2e-15 if method == "DOP853" else 2e-17,
        dense_output=True,
    )
    if not result.success:
        raise RuntimeError(result.message)
    return result, lambda t: absolute(t, result.sol(t))


class SolarSolution:
    """Absolute output of a nonrotating prescribed-origin integration."""

    def __init__(self, raw, body):
        self.raw = raw
        self.body = body
        self.t = raw.t
        self.y = raw.y.copy()
        for i, t in enumerate(self.t):
            self.y[:6, i] += body_states(float(t))[body]
        self.nfev = raw.nfev
        self.success = raw.success
        self.message = raw.message

    def sol(self, t):
        y = self.raw.sol(t).copy()
        if np.ndim(t) == 0:
            y[:6] += body_states(float(t))[self.body]
        else:
            for i, time in enumerate(t):
                y[:6, i] += body_states(float(time))[self.body]
        return y


def origin_acceleration(t, index):
    if index == 0:
        return np.zeros(3)
    bodies = body_states(t)
    b = bodies[index]
    if index == 2:
        d = b[:3] - bodies[1, :3]
        return -MU * bodies[1, :3] - (GMS[1] + GMS[2]) * d / np.linalg.norm(d) ** 3
    return -MU * b[:3] / np.linalg.norm(b[:3]) ** 3


def freeze_forward(admitted):
    if admitted.get("refinedKnots"):
        return admitted
    spline = admitted["spline"]
    reference = admitted["reference"]

    def physical(t, y):
        a = spline(t)
        return np.r_[
            y[3:6],
            gravity_relative(t, y, reference) + a - origin_acceleration(t, reference),
            np.linalg.norm(a),
        ]

    # Frozen control knots are canonical event boundaries. No interpolation
    # polynomial change is allowed to hide inside an adaptive physics interval.
    current = np.r_[admitted["result"].raw.y[:6, 0], 0]
    nodes = []
    states = []
    dense_times = []
    interpolants = []
    evaluations = 0
    for left, right in zip(admitted["keys"][:-1], admitted["keys"][1:]):
        part = solve_ivp(
            physical,
            (left, right),
            current,
            method="DOP853",
            rtol=2.3e-14,
            atol=2e-16,
            dense_output=True,
            max_step=right - left,
        )
        if not part.success:
            raise RuntimeError(part.message)
        nodes.extend(part.t if not nodes else part.t[1:])
        states.extend(part.y.T if not states else part.y.T[1:])
        dense_times.extend(part.sol.ts if not dense_times else part.sol.ts[1:])
        interpolants.extend(part.sol.interpolants)
        current = part.y[:, -1]
        evaluations += part.nfev
    raw = SimpleNamespace(
        t=np.array(nodes),
        y=np.array(states).T,
        nfev=evaluations,
        success=True,
        message="Frozen knot boundaries",
        sol=OdeSolution(np.array(dense_times), interpolants),
    )
    actual = SolarSolution(raw, reference)
    admitted["result"] = actual
    admitted["dv"] = float(actual.y[6, -1])
    admitted["refinedKnots"] = True
    return admitted


def design_burn(
    t0: float, t1: float, start: np.ndarray, end: np.ndarray, match_gravity: bool = False
):
    cache_dir = ROOT / "docs/design/solar-cycler/scratch"
    key = hashlib.sha256(
        np.r_[t0, t1, start, end, match_gravity].tobytes() + MODEL_KEY.encode()
    ).hexdigest()[:20]
    cache = cache_dir / f"burn-{key}.pkl"
    if cache.exists():
        admitted = freeze_forward(pickle.loads(cache.read_bytes()))
        cache.write_bytes(pickle.dumps(admitted))
        return admitted
    reference = int(np.argmin(np.linalg.norm(body_states(t1)[:, :3] - end[:3], axis=1)))
    if reference == 2:
        reference = 1
    h = t1 - t0
    coeff = np.zeros((6, 3))
    coeff[0], coeff[1] = start[:3], h * start[3:]
    coeff[2] = h * h * gravity(t0, start) / 2 if match_gravity else np.zeros(3)
    last_acc = gravity(t1, end) if match_gravity else np.zeros(3)
    coeff[3:] = np.linalg.solve(
        np.array([[1, 1, 1], [3, 4, 5], [6, 12, 20]]),
        np.array(
            [
                end[:3] - coeff[:3].sum(axis=0),
                h * end[3:] - coeff[1] - 2 * coeff[2],
                h * h * last_acc - 2 * coeff[2],
            ]
        ),
    )
    keys = np.linspace(t0, t1, 257)
    seed = []
    for t in keys:
        u = (t - t0) / h
        p = sum(coeff[i] * u**i for i in range(6))
        acc = sum(i * (i - 1) * coeff[i] * u ** (i - 2) for i in range(2, 6)) / h**2
        seed.append(acc - gravity(t, p))
    u = (keys - t0) / h
    shape = np.sin(np.pi * u) ** 2
    evaluations = 0
    bases = [CubicSpline(keys, shape), CubicSpline(keys, shape * (2 * u - 1))]
    cached_params = None
    cached_solution = None

    def solution(params):
        nonlocal evaluations, cached_params, cached_solution
        if cached_params is not None and np.array_equal(params, cached_params):
            return cached_solution
        if evaluations > 2_000_000:
            raise RuntimeError("Burn search work budget exceeded")
        values = (
            np.array(seed)
            + shape[:, None] * params[:3]
            + (shape * (2 * u - 1))[:, None] * params[3:]
        )
        spline = CubicSpline(keys, values)

        def derivative(t, y):
            nonlocal evaluations
            evaluations += 1
            if evaluations > 2_000_000:
                raise RuntimeError("Burn force-evaluation budget exceeded")
            a = spline(t)
            bodies, d = relative_separations(t, y, reference)
            r = np.linalg.norm(d, axis=1)
            jac = sum(
                GMS[i] * (3 * np.outer(d[i], d[i]) / r[i] ** 5 - np.eye(3) / r[i] ** 3)
                for i in range(5)
            )
            sens = y[7:].reshape(6, 6)
            forcing = np.c_[np.eye(3) * bases[0](t), np.eye(3) * bases[1](t)]
            ds = np.vstack([sens[3:], jac @ sens[:3] + forcing])
            return np.r_[
                y[3:6],
                gravity_relative(t, y, reference) + a - origin_acceleration(t, reference),
                np.linalg.norm(a),
                ds.ravel(),
            ]

        raw = solve_ivp(
            derivative,
            (t0, t1),
            np.r_[start - body_states(t0)[reference], 0, np.zeros(36)],
            method="DOP853",
            rtol=2.3e-14,
            atol=2e-16,
            dense_output=True,
            max_step=h / 128,
        )
        result = SolarSolution(raw, reference)
        cached_params = params.copy()
        cached_solution = (result, values, spline)
        return cached_solution

    def residual(params):
        result, _, _ = solution(params)
        final = result.y[:6, -1] - end
        return np.r_[final[:3] / h**2, final[3:] / h]

    def jacobian(params):
        result, _, _ = solution(params)
        sens = result.y[7:, -1].reshape(6, 6)
        return np.vstack([sens[:3] / h**2, sens[3:] / h])

    solved = root(residual, np.zeros(6), jac=jacobian, tol=1e-9, options={"maxfev": 64})
    result, values, spline = solution(solved.x)
    error = float(np.max(np.abs(result.y[:6, -1] - end)))
    difference = result.y[:6, -1] - end
    if (
        np.max(np.abs(difference[:3])) > 5e-10
        or np.max(np.abs(difference[3:])) > 2e-8
        or evaluations > 2_000_000
    ):
        raise RuntimeError(f"Burn targeting refused: {error=}, {evaluations=}, {solved.message}")
    dense = np.linspace(t0, t1, 4097)
    acceleration = np.linalg.norm(spline(dense), axis=1)
    c = spline.c
    dt = np.diff(keys)[:, None]
    bernstein = np.array(
        [
            c[3],
            c[3] + c[2] * dt / 3,
            c[3] + 2 * c[2] * dt / 3 + c[1] * dt**2 / 3,
            c[3] + c[2] * dt + c[1] * dt**2 + c[0] * dt**3,
        ]
    )
    bound = float(np.linalg.norm(bernstein, axis=2).max())
    if max(acceleration.max(), bound) > CAP:
        raise RuntimeError(f"Frozen acceleration cap exceeded: {acceleration.max() / CAP}")
    print(
        f"  burn {t0:.4f}–{t1:.4f}: dv={result.y[6, -1] * AU / YEAR:.3f}km/s "
        f"cap={acceleration.max() / CAP:.3f} evals={evaluations}",
        flush=True,
    )
    admitted = dict(
        reference=reference,
        t0=t0,
        t1=t1,
        result=result,
        keys=keys,
        controls=values,
        spline=spline,
        dv=float(result.y[6, -1]),
        error=error,
        evaluations=evaluations,
    )
    admitted = freeze_forward(admitted)
    cache.write_bytes(pickle.dumps(admitted))
    return admitted


def samples(solution, start: float, end: float, physical_start: np.ndarray | None = None):
    # Frozen display sampling, plus every accepted DOP853 node; no browser query
    # participates in the numerical solver. Cubic Hermite display is disposable.
    times = np.unique(
        np.r_[solution.t, np.linspace(start, end, max(2, int((end - start) * 2048) + 1))]
    )
    ys = solution.sol(times).T
    if physical_start is not None:
        ys = np.array(
            [body_states(float(t))[int(physical_start[0])] + y[:6] for t, y in zip(times, ys)]
        )
    return [[float(t), *map(float, y[:6])] for t, y in zip(times, ys)]


def display_error(rows, provider, captures=()):
    """Disposable Hermite midpoint check against the admitted dense provider."""
    r = np.array(rows)
    a, b = r[:-1, 1:7], r[1:, 1:7].copy()
    epochs = (r[:-1, 0] + r[1:, 0]) / 2
    h = np.diff(r[:, 0])[:, None]
    for capture in captures:
        b[np.where(r[1:, 0] == capture["t"])[0]] = capture["before"]
    position = 0.5 * (a[:, :3] + b[:, :3]) + h * (a[:, 3:] - b[:, 3:]) / 8
    actual = np.array([provider(float(t))[:3] for t in epochs])
    meters = float(np.linalg.norm(position - actual, axis=1).max() * AU * 1000)
    pixels = meters / (AU * 1000) * 1e7
    if pixels > 0.25:
        raise RuntimeError("Solar display interpolation budget exceeded")
    return dict(samples=len(epochs), maxPositionMeters=meters, pixelsAtMaxZoom=pixels)


def certify(rows: list, max_step: float = 1 / 8192):
    # Lipschitz clearance certificate on each dense-output subinterval: clearance
    # > upper relative-speed excursion, with a conservative gravitational/control
    # acceleration bound in the half-clearance neighborhood. Refine if needed.
    minima = np.full(5, np.inf)
    work = 0
    for segment in rows:
        res = segment["result"]
        ts = np.unique(
            np.r_[res.t, np.arange(segment["t0"], segment["t1"], max_step), segment["t1"]]
        )
        for a, b in zip(ts[:-1], ts[1:]):
            queue = [(float(a), float(b))]
            while queue:
                left, r = queue.pop()
                y = res.sol(left)[:6]
                bodies = body_states(left)
                ds = np.linalg.norm(bodies[:, :3] - y[:3], axis=1)
                clear = ds - RADII
                minima = np.minimum(minima, clear)
                if clear.min() <= 0:
                    raise RuntimeError(f"Surface exclusion failed at {left}: {clear}")
                bound = float(np.sum(GMS / (RADII + clear / 2) ** 2)) + CAP + 0.01
                rel_speed = np.linalg.norm(bodies[:, 3:] - y[3:], axis=1)
                h = r - left
                work += 1
                if work > 2_000_000:
                    raise RuntimeError("Clearance certification work exceeded")
                # Prescribed rail acceleration is separately bounded (Moon includes Earth).
                rail_acc = np.array(
                    [
                        0,
                        MU,
                        MU + (GMS[1] + GMS[2]) / (384400 / AU) ** 2,
                        MU / R_MARS**2,
                        MU / 5.2044**2,
                    ]
                )
                if np.all(rel_speed * h + (bound + rail_acc) * h * h / 2 < clear / 2) and np.all(
                    clear / 2 > 1000 / (AU * 1000)
                ):
                    continue
                if h < 1e-10:
                    raise RuntimeError("Unsupported close approach")
                m = (left + r) / 2
                queue.extend([(left, m), (m, r)])
    return dict(minClearanceAU=minima.tolist(), intervals=work, numericalAllowanceMeters=1000)


def compile_set():
    began = monotonic()
    print("Compiling physical gateway providers", flush=True)
    scratch = ROOT / "docs/design/solar-cycler/scratch"
    scratch.mkdir(exist_ok=True)
    cache = scratch / f"gateways-{MODEL_KEY}.pkl"
    if cache.exists():
        earth_result, mars_result = pickle.loads(cache.read_bytes())
    else:
        earth_result, _ = target_port(1, 0.00065, 0.2, np.radians(15))
        mars_result, _ = target_port(3, 0.0003, 0.6, np.radians(12))
        cache.write_bytes(pickle.dumps((earth_result, mars_result)))

    def earth_port(t):
        return body_states(t)[1] + earth_result.sol(t)

    def mars_port(t):
        return body_states(t)[3] + mars_result.sol(t)

    print(f"  gateways done in {monotonic() - began:.1f}s", flush=True)
    carrier_segments: list[dict[str, Any]] = []
    seeds: list[dict[str, Any]] = []
    for index in range(4):
        t0 = 0.0 if index == 0 else index * S + 0.015
        t1 = (index + 1) * S - 0.015
        start = kepler(t0, index)
        destination = kepler(t1, index)[:3]
        calls = 0

        def shoot(v):
            nonlocal calls
            calls += 1
            if calls > 80:
                raise RuntimeError("Coast shooting work budget exceeded")
            trial = coast(t0, t1, np.r_[start[:3], v])
            return trial.y[:3, -1] - destination

        seed_cache = scratch / f"coast-{MODEL_KEY}-{index}.pkl"
        solved = (
            root(shoot, start[3:], tol=1e-10)
            if not seed_cache.exists()
            else pickle.loads(seed_cache.read_bytes())
        )
        if not seed_cache.exists():
            seed_cache.write_bytes(pickle.dumps(solved))
        if calls > 80 or np.linalg.norm(shoot(solved.x)) > 1e-9:
            raise RuntimeError(f"Coast shooting failed: {index=}, {calls=}, {solved.message}")
        initial = np.r_[start[:3], solved.x]
        result = coast(t0, t1, initial)
        seeds.append(dict(t0=t0, t1=t1, result=result))
        print(
            f"  coast {index + 1}: calls={calls}, "
            f"endpoint AU={np.linalg.norm(result.y[:3, -1] - destination):.3g}",
            flush=True,
        )
    carrier_segments.append(seeds[0])
    for cycle in range(1, 4):
        prior = carrier_segments[-1]
        upcoming = seeds[cycle]
        burn = design_burn(
            prior["t1"],
            upcoming["t0"],
            prior["result"].y[:6, -1],
            upcoming["result"].y[:6, 0],
            True,
        )
        carrier_segments.append(burn)
        if cycle < 3:
            # Integrate again from the ACTUAL end, never reset to the seed target.
            result = coast(upcoming["t0"], upcoming["t1"], burn["result"].y[:6, -1])
            carrier_segments.append(dict(t0=upcoming["t0"], t1=upcoming["t1"], result=result))
        else:
            result = coast(upcoming["t0"], DURATION, burn["result"].y[:6, -1])
            carrier_segments.append(dict(t0=upcoming["t0"], t1=DURATION, result=result))

    def carrier_at(t):
        seg = next(s for s in carrier_segments if s["t0"] <= t <= s["t1"])
        return seg["result"].sol(t)[:6]

    proof = certify(carrier_segments)
    gateway_proofs = []
    for index, res in [(1, earth_result), (3, mars_result)]:
        absolute = SimpleNamespace(
            t=res.t, sol=lambda t, index=index, res=res: body_states(t)[index] + res.sol(t)
        )
        gateway_proofs.append(certify([dict(t0=0.0, t1=DURATION, result=absolute)]))
    vessels = []
    display_proofs = {}
    bus_rows = []
    bus_arcs = []
    dv = 0.0
    for i, seg in enumerate(carrier_segments):
        new = samples(seg["result"], seg["t0"], seg["t1"])
        for row in new:
            local_dv = float(seg["result"].sol(row[0])[6]) if "dv" in seg else 0
            row.extend([100 * np.exp(-(dv + local_dv) / VE) - 40, dv + local_dv])
        bus_rows.extend(new if not bus_rows else new[1:])
        if "dv" in seg:
            bus_arcs.append(
                dict(
                    id=f"turn-{i}",
                    start=seg["t0"],
                    end=seg["t1"],
                    keys=[[float(t), *map(float, a)] for t, a in zip(seg["keys"], seg["controls"])],
                    coefficients=seg["spline"].c.transpose(1, 0, 2).tolist(),
                    initial=seg["result"].y[:6, 0].tolist(),
                    endpoint=seg["result"].y[:6, -1].tolist(),
                    referenceBody=seg["reference"],
                    localInitial=seg["result"].raw.y[:6, 0].tolist(),
                )
            )
            dv += seg["dv"]
    if bus_rows[-1][7] < 6:
        raise RuntimeError("Carrier 10% fuel reserve failed")
    vessels.append(
        dict(
            id="Wayfarer",
            name="Wayfarer · powered cycler",
            color="#efc689",
            dryMass=40,
            initialFuel=60,
            cargo=0,
            rows=bus_rows,
            arcs=bus_arcs,
            coasts=[
                dict(
                    start=q["t0"],
                    end=q["t1"],
                    initial=q["result"].y[:6, 0].tolist(),
                    endpoint=q["result"].y[:6, -1].tolist(),
                )
                for q in carrier_segments
                if "dv" not in q
            ],
            events=[],
        )
    )
    delivery_dv = []
    for cycle in range(3):
        # Separate finite visiting craft; each carries one funded consignment.
        t0, dock = cycle * S, cycle * S + 0.025
        release, arrive = cycle * S + TAU - 0.035, cycle * S + TAU + 0.025
        print(f"Compiling taxi {cycle + 1}", flush=True)
        outbound = design_burn(t0, dock, earth_port(t0), carrier_at(dock))
        inbound = design_burn(release, arrive, carrier_at(release), mars_port(arrive))
        taxiproof = certify([outbound, inbound])
        rows = samples(outbound["result"], t0, dock)
        ride_times = np.linspace(dock, release, max(2, int((release - dock) * 2048)))
        rows.extend([[float(t), *map(float, carrier_at(float(t)))] for t in ride_times[1:]])
        rows.extend(samples(inbound["result"], release, arrive)[1:])
        capture_out = carrier_at(dock) - outbound["result"].y[:6, -1]
        capture_in = mars_port(arrive) - inbound["result"].y[:6, -1]
        if max(np.linalg.norm(capture_out[:3]), np.linalg.norm(capture_in[:3])) * AU * 1000 > 100:
            raise RuntimeError(
                f"Taxi geometric capture limit: {cycle=}, "
                f"out={np.linalg.norm(capture_out[:3]) * AU * 1000}, "
                f"in={np.linalg.norm(capture_in[:3]) * AU * 1000}"
            )
        if (
            max(np.linalg.norm(capture_out[3:]), np.linalg.norm(capture_in[3:])) * AU * 1000 / YEAR
            > 0.01
        ):
            raise RuntimeError("Taxi velocity capture limit")
        allowance = 0.0001 / (AU * 1000 / YEAR)
        paid_out = float(np.linalg.norm(capture_out[3:])) + allowance
        paid_in = float(np.linalg.norm(capture_in[3:])) + allowance
        cost = outbound["dv"] + inbound["dv"] + paid_out + paid_in
        for row in rows:
            if row[0] == dock:
                row[1:7] = carrier_at(dock).tolist()
            if row[0] == arrive:
                row[1:7] = mars_port(arrive).tolist()
        if 25 * np.exp(-cost / VE) - 6 < 1.9:
            raise RuntimeError("Taxi 10% reserve failed")
        for row in rows:
            t = row[0]
            spent = (
                float(outbound["result"].sol(t)[6])
                if t < dock
                else outbound["dv"]
                if t <= release
                else outbound["dv"] + float(inbound["result"].sol(t)[6])
            )
            if t >= dock:
                spent += paid_out
            if t >= arrive:
                spent += paid_in
            row.extend([25 * np.exp(-spent / VE) - 6, spent])
        vessels.append(
            dict(
                id=f"Peregrine-{cycle + 1}",
                name=f"Peregrine {cycle + 1}",
                color=["#84cbd4", "#b9a2e6", "#91ce9b"][cycle],
                dryMass=5,
                initialFuel=19,
                cargo=1,
                start=t0,
                end=arrive,
                rows=rows,
                arcs=[
                    dict(
                        id=label,
                        start=seg["t0"],
                        end=seg["t1"],
                        keys=[
                            [float(t), *map(float, a)] for t, a in zip(seg["keys"], seg["controls"])
                        ],
                        coefficients=seg["spline"].c.transpose(1, 0, 2).tolist(),
                        initial=seg["result"].y[:6, 0].tolist(),
                        endpoint=seg["result"].y[:6, -1].tolist(),
                        referenceBody=seg["reference"],
                        localInitial=seg["result"].raw.y[:6, 0].tolist(),
                    )
                    for label, seg in [("Earth departure", outbound), ("Mars approach", inbound)]
                ],
                events=[
                    dict(t=dock, kind="dock", label="Board Wayfarer"),
                    dict(t=release, kind="undock", label="Leave Wayfarer"),
                    dict(t=arrive, kind="dock", label="Mars gateway arrival"),
                    dict(t=arrive, kind="transfer", label="Deliver consignment"),
                ],
                proof=taxiproof,
                captures=[
                    dict(
                        t=dock,
                        positionErrorMeters=float(np.linalg.norm(capture_out[:3]) * AU * 1000),
                        velocityErrorMetersS=float(
                            np.linalg.norm(capture_out[3:]) * AU * 1000 / YEAR
                        ),
                        paidDeltaV=paid_out,
                        before=outbound["result"].y[:6, -1].tolist(),
                        beforeFuel=float(25 * np.exp(-outbound["dv"] / VE) - 6),
                        afterFuel=float(25 * np.exp(-(outbound["dv"] + paid_out) / VE) - 6),
                    ),
                    dict(
                        t=arrive,
                        positionErrorMeters=float(np.linalg.norm(capture_in[:3]) * AU * 1000),
                        velocityErrorMetersS=float(
                            np.linalg.norm(capture_in[3:]) * AU * 1000 / YEAR
                        ),
                        paidDeltaV=paid_in,
                        before=inbound["result"].y[:6, -1].tolist(),
                        beforeFuel=float(
                            25 * np.exp(-(outbound["dv"] + paid_out + inbound["dv"]) / VE) - 6
                        ),
                        afterFuel=float(25 * np.exp(-cost / VE) - 6),
                    ),
                ],
            )
        )
        # Coupled release/capture epochs get exact provider nodes, even where
        # an ordinary coast drawing grid would not contain those epochs.
        for epoch in [dock, release]:
            import bisect

            i = bisect.bisect_left([r[0] for r in bus_rows], epoch)
            if i == len(bus_rows) or bus_rows[i][0] != epoch:
                previous = bus_rows[i - 1]
                bus_rows.insert(
                    i, [float(epoch), *map(float, carrier_at(epoch)), previous[7], previous[8]]
                )
        delivery_dv.append(cost * AU / YEAR)

        def taxi_at(t):
            if dock < t < release:
                return carrier_at(t)
            return (outbound if t <= dock else inbound)["result"].sol(t)[:6]

        display_proofs[vessels[-1]["id"]] = display_error(rows, taxi_at, vessels[-1]["captures"])
    display_proofs["Wayfarer"] = display_error(bus_rows, carrier_at)
    # Export only useful gateway drawing strips; the physical providers remain
    # continuous over the entire finite exhibit and targeting never uses these.
    ports = []
    for body, res, provider, name in [
        (1, earth_result, earth_port, "Earth gateway"),
        (3, mars_result, mars_port, "Mars gateway"),
    ]:
        events = [v["start"] if body == 1 else v["end"] for v in vessels[1:]]
        times = np.unique(np.r_[res.t, np.linspace(0, DURATION, 8193), events])
        ports.append(
            dict(
                id=name,
                body=body,
                rows=[[float(t), *map(float, provider(float(t)))] for t in times],
            )
        )
        display_proofs[name] = display_error(ports[-1]["rows"], provider)
    total_dv = dv * AU / YEAR
    artifact = dict(
        schemaVersion=1,
        modelVersion="solar-transport-v1",
        id="solar-cycler",
        name="Sol · Mars cycler",
        duration=DURATION,
        extent=2.55,
        units=dict(length="AU", time="year", mass="tonne"),
        mu=MU,
        synodic=S,
        marsPhase=MARS_PHASE,
        exhaustVelocity=VE,
        maxAcceleration=CAP,
        maxForce=CAP * 125,
        carrierElements=ELEMENTS,
        vessels=vessels,
        ports=ports,
        proof=dict(
            carrier=proof,
            gateways=gateway_proofs,
            origins=[
                dict(t=t, index=i, acceleration=origin_acceleration(t, i).tolist())
                for t in [0.0, 0.42, 2.9, 6.2]
                for i in range(5)
            ],
            carrierDeltaVkmS=total_dv,
            taxiDeltaVkmS=delivery_dv,
            interpolation=display_proofs,
            elapsedSeconds=monotonic() - began,
        ),
        description=(
            "A fictional powered Mars cycler with three Earth-to-Mars consignments. "
            "Circular solar-system proportions, physical gateway orbits "
            "and finite rendezvous burns."
        ),
        provenance=(
            "Precomputed forward multi-body propagation in AU/Julian-year/tonnes. "
            "Prescribed circular planets; heliocentric indirect gravity; "
            "no real mission ephemeris. "
            "Fictional 50 km/s exhaust vehicles. The carrier pays its Earth turn: "
            "this is not a ballistic Aldrin cycler. "
            "Small local operations and launches are outside this exhibit."
        ),
    )
    text = json.dumps(artifact, separators=(",", ":")) + "\n"
    if len(text.encode()) > 16 * 1024 * 1024:
        raise RuntimeError("Solar artifact byte budget")
    temporary = OUT.with_suffix(".json.tmp")
    temporary.write_text(text)
    temporary.replace(OUT)
    print(json.dumps(artifact["proof"], indent=2), flush=True)
    print(f"artifact {OUT.stat().st_size / 1e6:.2f}MB", flush=True)


def validate_gateways():
    """Independent RK45 versus DOP853 over each complete provider horizon."""
    began = monotonic()
    results = []
    for body, radius, phase, inclination in [(1, 0.00065, 0.2, 15), (3, 0.0003, 0.6, 12)]:
        primary, _ = target_port(body, radius, phase, np.radians(inclination))
        secondary, _ = target_port(body, radius, phase, np.radians(inclination), "RK45")
        epochs = np.unique(
            np.r_[np.linspace(0, DURATION, 2049), [cycle * S + TAU + 0.025 for cycle in range(3)]]
        )
        difference = primary.sol(epochs) - secondary.sol(epochs)
        position = np.linalg.norm(difference[:3], axis=0) * AU * 1000
        velocity = np.linalg.norm(difference[3:], axis=0) * AU * 1000 / YEAR
        row = dict(
            body=body,
            samples=len(epochs),
            maxPositionMeters=float(position.max()),
            maxVelocityMetersS=float(velocity.max()),
            primaryNfev=primary.nfev,
            secondaryNfev=secondary.nfev,
        )
        print(row, flush=True)
        if position.max() > 1000 or velocity.max() > 0.01:
            raise RuntimeError("Full-horizon gateway method comparison failed")
        results.append(row)
    (ROOT / "docs/design/solar-cycler/gateway-numerics.json").write_text(
        json.dumps(dict(results=results, elapsedSeconds=monotonic() - began), indent=2) + "\n"
    )


if __name__ == "__main__":
    import sys

    if "--validate-gateways" in sys.argv:
        validate_gateways()
    else:
        compile_set()
