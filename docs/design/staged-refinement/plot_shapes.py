"""Plot canonical before/after geometry; no interpolated physical targets."""

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

here = Path(__file__).resolve().parent
rows = json.loads((here / "shape-traces.json").read_text())
fig, axes = plt.subplots(1, 3, figsize=(12, 4), constrained_layout=True)
colors = ["#d48a57", "#167b91"]
for row, color, label in zip(rows, colors, ["Previous", "Refined"], strict=True):
    arc = np.array([q["y"][:2] for q in row["insertion"]])
    axes[0].plot(*arc.T, color=color, label=label)
    axes[0].scatter(*arc[::16].T, color=color, s=10)
    landing = np.array([q["eagle"]["r"][:2] for q in row["ascent"]])
    axes[1].plot(*landing.T, color=color, label=label)
    axes[1].scatter(*landing[[0, -1]].T, color=color, s=18)
    t = np.array([q["eagle"]["t"] for q in row["ascent"]])
    excess = np.array(
        [np.linalg.norm(q["eagle"]["r"]) - np.linalg.norm(q["odyssey"]["r"]) for q in row["ascent"]]
    )
    axes[2].plot(t - t[0], excess, color=color, label=label)
axes[0].set_title("Odyssey insertion · inertial")
axes[0].set_xlabel("x · equal-time dots")
axes[0].set_ylabel("y")
axes[1].add_patch(plt.Circle((0, 0), 0.2, color="#c9d2d9", zorder=0))
axes[1].set_title("Eagle rendezvous · Selene centered")
axes[1].set_xlabel("x relative to Selene")
axes[1].set_ylabel("y relative to Selene")
axes[2].axhline(0, color="#798087", linewidth=0.7)
axes[2].set_title("Radius above simultaneous orbiter")
axes[2].set_xlabel("Time since liftoff")
axes[2].set_ylabel("Eagle radius − Odyssey radius")
for ax in axes[:2]:
    ax.set_aspect("equal", adjustable="datalim")
for ax in axes:
    ax.grid(alpha=0.2)
    ax.legend(fontsize=8)
fig.savefig(here / "shape-comparison.png", dpi=160)
