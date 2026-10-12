"""Continue a paid forward transfer toward an explicit unpowered middle interval."""

import json
import sys
from pathlib import Path

import numpy as np
from scipy.interpolate import CubicHermiteSpline, CubicSpline
from scipy.optimize import root

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
from spikes.numerics import compact_cycler as m  # noqa: E402

TIGHT = "--tight" in sys.argv
PHASES = {"Cairn": 1.2 if TIGHT else 0.8, "Haven": 0.0}
oldport = m.port


def port(id, t):
    if id == "Cairn":
        return m.rotate([1.00001, 0, 0, m.RATE * 1.00001], m.RATE * t + PHASES[id])
    return oldport(id, t)


setattr(m, "port", port)
setattr(m, "normal", lambda id, t: m.rotate([1, 0, 0, 0], m.RATE * t + PHASES[id])[:2])
s = json.loads(Path("docs/design/compact-cycler/refinement/closer-carrier.json").read_text())[1]
coast = m.forward(5.0, 69.0, np.array(s["initial"])[[0, 1, 3, 4]])


def carrier_at(t):
    return coast.sol(t)[:4]


def convert(q):
    return dict(
        id=q.get("arc", {}).get("id", "Local coast"),
        start=q["t0"],
        end=q["t1"],
        initial=m.state6(q["initial"]),
        endpoint=m.state6(q["end"]),
        oracle=m.oracle(q),
        **({"control": q["arc"]} if "arc" in q else {}),
    )


legs = []
cases = [
    ("Haven launch", 4.0, 9.0, "Haven", None, 1.5, 1.5),
    ("Cairn landing", 16.0, 21.0, None, "Cairn", 1.5, 1.5),
    ("Cairn launch", 22.5, 30.5, "Cairn", None, 2.0, 2.0),
    ("Haven landing", 65.0, 69.0, None, "Haven", 1.0, 1.0),
]
if TIGHT:
    cases = [
        ("Haven launch", 6.0, 9.0, "Haven", None, 0.75, 0.75),
        ("Cairn landing", 16.0, 19.5, None, "Cairn", 0.75, 0.75),
        ("Cairn launch", 21.5, 25.0, "Cairn", None, 0.75, 0.75),
        ("Haven landing", 65.0, 69.0, None, "Haven", 1.0, 1.0),
    ]
for id, a, b, origin, dest, first, last in cases:
    start = port(origin, a) if origin else carrier_at(a)
    target = port(dest, b) if dest else carrier_at(b)
    seed = m.burn(id, a, b, start, target, 4.0 if TIGHT else 3.0, launch=origin, landing=dest)
    arc = seed["arc"]
    poly = CubicSpline.construct_fast(
        np.array(arc["coefficients"])[:, :, :2].transpose(1, 0, 2),
        np.array(arc["keys"])[:, 0],
    )
    keys = np.unique(
        np.r_[
            np.linspace(a, a + first, 33),
            np.linspace(a + first, b - last, 33),
            np.linspace(b - last, b, 33),
        ]
    )
    base = poly(keys)
    der = poly(keys, 1)
    shape_rows = []
    dshape_rows = []
    mask = []
    dmask = []
    for t in keys:
        u = (t - a) / first if t <= a + first else (b - t) / last if t >= b - last else 1.0
        L = first if t <= a + first else last
        sign = 1 if t <= a + first else -1
        mask.append(1 - 3 * u * u + 2 * u**3 if u <= 1 else 0)
        dmask.append(sign * (-6 * u + 6 * u * u) / L if u <= 1 else 0)
        row = []
        dr = []
        for left, r in [(a, a + first), (b - last, b)]:
            v = (t - left) / (r - left)
            row.append(2 * np.sin(np.pi * v) ** 2 / (r - left) if 0 < v < 1 else 0.0)
            dr.append(2 * np.pi * np.sin(2 * np.pi * v) / (r - left) ** 2 if 0 < v < 1 else 0.0)
        shape_rows.append(row)
        dshape_rows.append(dr)
    mask = np.array(mask)
    dmask = np.array(dmask)
    shape = np.array(shape_rows)
    dshape = np.array(dshape_rows)
    bs = [CubicHermiteSpline(keys, shape[:, i], dshape[:, i]) for i in [0, 1]]
    params = np.zeros(4)
    success = True
    for lam in np.linspace(0, 1, 9):
        blend = (1 - lam) + lam * mask
        bv = base * blend[:, None]
        bd = der * blend[:, None] + base * (lam * dmask)[:, None]
        cache = None
        answer = None
        calls = 0
        anchor = params.copy()

        def trial(p):
            global cache, answer, calls
            if cache is not None and np.array_equal(cache, p):
                return answer
            calls += 1
            if calls > 35:
                raise RuntimeError("call budget")
            total = anchor + p
            sp = CubicHermiteSpline(
                keys,
                bv + shape[:, 0, None] * total[:2] + shape[:, 1, None] * total[2:],
                bd + dshape[:, 0, None] * total[:2] + dshape[:, 1, None] * total[2:],
            )
            q = m.forward(a, b, start, sp, True, bs)
            cache = p.copy()
            answer = (q, sp)
            return answer

        def res(p):
            return (trial(p)[0].y[:4, -1] - target) / np.array([b - a, b - a, 1, 1])

        def jac(p):
            return trial(p)[0].y[5:, -1].reshape(4, 4) / np.array([b - a, b - a, 1, 1])[:, None]

        try:
            z = root(
                res,
                np.zeros(4),
                jac=jac,
                tol=1e-10,
                options={"maxfev": 35, "factor": 0.3},
            )
            q, sp = trial(z.x)
            if np.max(np.abs(q.y[:4, -1] - target)) > 1e-8:
                raise RuntimeError("residual")
            params = anchor + z.x
            print("CONTINUE", id, lam, "calls", calls, "dv", q.y[4, -1], flush=True)
        except RuntimeError as e:
            print("REJECT", id, lam, str(e), flush=True)
            success = False
            break
    if not success:
        continue
    parts = []
    actual = start.copy()
    cost = 0.0
    for left, r in [(a, a + first), (a + first, b - last), (b - last, b)]:
        iscoast = left == a + first
        pk = np.linspace(left, r, 129)
        spline = None if iscoast else CubicHermiteSpline(pk, sp(pk), sp(pk, 1))
        q = m.forward(left, r, actual, spline)
        ts = np.linspace(left, r, 513)
        ys = q.sol(ts).T
        if (
            min(np.linalg.norm(y[:2]) - 1 for y in ys) < -1e-8
            or min(np.linalg.norm(y[:2] - m.circular(t, 5)[:2]) - 0.2 for t, y in zip(ts, ys))
            < -1e-8
        ):
            print("REJECT collision", id, left, flush=True)
            success = False
            break
        if spline:
            c = spline.c
            h = np.diff(pk)[:, None]
            hull = np.array(
                [
                    c[3],
                    c[3] + c[2] * h / 3,
                    c[3] + 2 * c[2] * h / 3 + c[1] * h * h / 3,
                    c[3] + c[2] * h + c[1] * h * h + c[0] * h**3,
                ]
            )
            bound = float(np.linalg.norm(hull, axis=2).max())
            if bound > (4 if TIGHT else 3):
                print("REJECT cap", id, bound, flush=True)
                success = False
                break
            coeff = np.zeros((128, 4, 3))
            coeff[:, :, :2] = c.transpose(1, 0, 2)
            control = dict(
                id=id + (" departure" if left == a else " arrival"),
                start=left,
                end=r,
                keys=[[float(t), *map(float, spline(t)), 0.0] for t in pk],
                coefficients=coeff.tolist(),
            )
        part = dict(
            t0=left,
            t1=r,
            initial=actual.copy(),
            end=q.y[:4, -1],
            result=q,
            dv=q.y[4, -1],
            **({"arc": control} if spline else {}),
        )
        parts.append(convert(part))
        actual = np.asarray(part["end"])
        cost += part["dv"]
    if success:
        m.capture(actual, target)
        legs.append(dict(id=id, start=a, end=b, dv=float(cost), parts=parts))
        print("ADMITTED", id, cost, flush=True)
Path(
    "docs/design/compact-cycler/refinement/" + ("homotopy-tight.json" if TIGHT else "homotopy.json")
).write_text(json.dumps(dict(legs=legs, padPhases=PHASES), separators=(",", ":")) + "\n")
