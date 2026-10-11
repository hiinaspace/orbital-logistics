import json
from pathlib import Path

import numpy as np
from scipy.optimize import brentq

p = Path("docs/design/libration-service/probe.json")
d = json.loads(p.read_text())
f = d["field"]
mu, ms, R, n, ph = [f[k] for k in ["mu", "muMoon", "radius", "rate", "phase"]]


def fn(x):
    return n * n * x - mu / x**2 - ms / (x - R) ** 2


x = brentq(fn, R + 0.001, 20, xtol=5e-324, rtol=1e-15)
t = np.r_[np.linspace(0, 1e6, 100001), [0, 1, 32, 128, 512, 999999, 1e6]]
a = n * t + ph
v = np.array([np.cos(a), np.sin(a)])
y = x * v
moon = R * v
relative = moon - y
g = (
    -mu * y / np.linalg.norm(y, axis=0) ** 3
    + ms * relative / np.linalg.norm(relative, axis=0) ** 3
)
res = g + n * n * y
# Position covariance queried by independent global/local angle arithmetic.
local = np.linspace(0, 32, 1001)
offsets = [0, 32, 1e3, 1e5, 999968]
errs = []
for off in offsets:
    a0 = n * local + ph
    theta = n * off
    c, ss = np.cos(theta), np.sin(theta)
    u = x * np.array([np.cos(a0), np.sin(a0)])
    transformed = np.array([c * u[0] - ss * u[1], ss * u[0] + c * u[1]])
    absolute = x * np.array(
        [np.cos(n * (off + local) + ph), np.sin(n * (off + local) + ph)]
    )
    errs.append(float(np.max(abs(transformed - absolute))))
result = {
    "root": x,
    "scalarResidual": fn(x),
    "maxVectorResidual": float(np.max(np.linalg.norm(res, axis=0))),
    "maxPositionCovarianceError": max(errs),
    "covarianceByOffset": errs,
    "minMoonSurfaceClearance": x - R - 0.2,
    "minAtmosphereClearance": x - 1.2,
}
Path("docs/design/libration-service/equilibrium-probe.json").write_text(
    json.dumps(result, indent=2) + "\n"
)
print(result)
