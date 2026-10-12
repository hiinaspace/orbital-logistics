"""Candidate geometry, integrated ballistically; not viewer admission."""

import json
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from scipy.integrate import solve_ivp

HERE = Path(__file__).parent
N = np.sqrt(1.03 / 125)
c = json.loads((HERE / "native.json").read_text())["candidate"]


def rhs(t, q):
    x, y, vx, vy = q
    p = np.array([x, y])
    d = np.array([5 - x, -y])
    a = -p / np.linalg.norm(p) ** 3 + 0.03 * d / np.linalg.norm(d) ** 3
    return [vx, vy, a[0] + N * N * x + 2 * N * vy, a[1] + N * N * y - 2 * N * vx]


ts = np.linspace(0, c["period"], 4097)
q = solve_ivp(
    rhs,
    (0, ts[-1]),
    c["initial"],
    method="DOP853",
    rtol=2.3e-13,
    atol=2e-15,
    max_step=0.05,
    t_eval=ts,
)
rot = q.y[:2].T
C, S = np.cos(N * ts), np.sin(N * ts)
inertial = np.c_[C * rot[:, 0] - S * rot[:, 1], S * rot[:, 0] + C * rot[:, 1]]
fig, axs = plt.subplots(1, 2, figsize=(12, 6), facecolor="#101923", layout="constrained")
for ax, positions, title in zip(axs, [inertial, rot], ["Aster inertial", "Aster–Selene rotating"]):
    ax.set_facecolor("#101923")
    for spine in ax.spines.values():
        spine.set_color("#647080")
    ax.tick_params(colors="#a8bac9")
    ax.set_title(title, color="white")
    ax.add_patch(plt.Circle((0, 0), 1, color="#50759c"))
    ax.add_patch(plt.Circle((0, 0), 5, fill=False, color="#718093", linestyle=":", alpha=0.5))
    ax.plot(*positions.T, color="#f1c778", linewidth=1.5)
    for i in np.linspace(100, 4000, 12, dtype=int):
        d = positions[i + 4] - positions[i - 4]
        ax.annotate(
            "",
            xy=positions[i] + 2 * d,
            xytext=positions[i],
            arrowprops=dict(arrowstyle="->", color="#f1c778"),
        )
    if title.endswith("rotating"):
        ax.add_patch(plt.Circle((5, 0), 0.2, color="#b0b6bf"))
        ax.text(5, -0.55, "Selene", color="#c2d2df", ha="center")
    else:
        for i in [0, 1024, 2048, 3072]:
            ax.add_patch(plt.Circle((5 * C[i], 5 * S[i]), 0.2, color="#b0b6bf", alpha=0.65))
    ax.plot(*positions[0], "o", color="white", markersize=4)
    ax.set_aspect("equal")
    ax.set_xlim(-7, 7)
    ax.set_ylim(-7, 7)
fig.suptitle("Ballistic pass-through candidate · one complete cycle · no thrust", color="white")
fig.savefig(HERE / "candidate.png", dpi=160, facecolor=fig.get_facecolor())
