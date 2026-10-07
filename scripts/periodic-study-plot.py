"""Render the retained schedule experiment; no invented transfer/cost samples.

Run: uv run --project spikes/numerics --group plots python scripts/periodic-study-plot.py
"""

import json
import math
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

root = Path(__file__).resolve().parents[1]
data = json.loads((root / "docs/design/periodic-transfer/schedule-study.json").read_text())
events = data["aligned"]["events"]
period = data["earliestSameGeometryReuse"]
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10})
fig, axes = plt.subplots(
    3, 1, figsize=(13, 6.7), sharex=True, gridspec_kw={"height_ratios": [1.6, 1, 1]}
)
fig.set_facecolor("#101a22")
for ax in axes:
    ax.set_facecolor("#101a22")
    ax.tick_params(colors="#b7c6d0", length=0)
    for spine in ax.spines.values():
        spine.set_visible(False)
    ax.grid(axis="x", color="#26343f", linewidth=0.6)
    ax.set_axisbelow(True)
    ax.yaxis.label.set_color("#d5e1e7")

home, depot, flight, service, window = (
    "#648090",
    "#b99b72",
    "#65c5b2",
    "#f4d58d",
    "#a599d7",
)
ax = axes[0]
for cycle in range(2):
    offset = cycle * period
    d, a, r, h = [
        offset + t for t in (0.5, 4.629730790872742, 15.497026245592098, 19.626757036464838)
    ]
    start = 0 if cycle == 0 else 19.626757036464838
    end = period + 0.5 if cycle == 0 else 54
    ax.broken_barh([(start, d - start), (h, end - h)], (0.8, 0.36), facecolors=home)
    ax.broken_barh([(a, r - a)], (-1.2, 0.36), facecolors=depot)
    ax.broken_barh([(d, a - d), (r, h - r)], (-0.18, 0.36), facecolors=flight)
    for x, label in ((d, "→ Depot"), (r, "→ Home")):
        ax.text(x + 0.2, 0.32, label, color=flight, fontsize=9)
    for t, lane in ((0 if cycle == 0 else 19.626757036464838, 1), (a, -1)):
        ax.broken_barh([(t, 0.25)], (lane - 0.2, 0.4), facecolors=service)
    ax.text(
        a + 1.0,
        -1.02,
        "unload · refuel · wait",
        color="#101a22",
        va="center",
        fontsize=9,
    )
for i in range(4):
    t = 0.5 + i * data["synodic"]
    ax.axvline(t, color=window, linewidth=0.8, linestyle=(0, (3, 4)), alpha=0.65)
    ax.text(t + 0.15, 1.55, "depart" if i % 2 == 0 else "away", color=window, fontsize=9)
ax.text(20.8, 1.0, "Home · load / wait", color="#101a22", va="center", fontsize=9)
ax.set(
    yticks=[1, 0, -1],
    yticklabels=["Home berth", "Tug in flight", "Depot berth"],
    ylim=(-1.5, 1.9),
)
ax.set_title(
    "Two actual voyages · one repeated recipe",
    loc="left",
    color="#ecf1f4",
    fontsize=17,
    pad=22,
)

times, fuel, capability = [0.0], [0.2], [3 * math.log1p(0.2)]
cargo = 0.0
for event in events:
    t = event["t"]
    times.extend([t, t])
    fuel.extend([fuel[-1], event["propellantAfter"]])
    capability.append(capability[-1])
    cargo = event.get("cargoAfter", cargo)
    capability.append(3 * math.log1p(event["propellantAfter"] / (1 + cargo)))
times.append(54)
fuel.append(fuel[-1])
capability.append(capability[-1])
axes[1].plot(times, fuel, color=flight, linewidth=1.8)
axes[1].axhline(0.05, color="#b99b72", linewidth=0.8, linestyle="--")
axes[1].text(54, 0.05, "  reserve", color=depot, va="center", fontsize=9)
axes[1].set(ylabel="Propellant", ylim=(0, 0.25), yticks=[0.05, 0.15, 0.25])
axes[2].plot(times, capability, color=window, linewidth=1.8)
axes[2].set(ylabel="Available Δv", ylim=(0, 0.75), yticks=[0, 0.35, 0.7], xlim=(-0.3, 54))
axes[2].set_xlabel("Simulation time", color="#d5e1e7", labelpad=10)
axes[2].text(5.2, 0.69, "unload + refuel", color=window, fontsize=9)
axes[2].text(20.2, 0.69, "load changes mass", color=window, fontsize=9)
fig.text(
    0.13,
    0.015,
    "Existing impulse model · finite stocks carried through · "
    "opportunity markers every 15.85 · normalized units",
    color="#9cafbc",
    fontsize=9,
)
fig.subplots_adjust(left=0.13, right=0.94, top=0.87, bottom=0.12, hspace=0.27)
fig.savefig(
    root / "docs/design/periodic-transfer/timeline-budget.png",
    dpi=160,
    facecolor=fig.get_facecolor(),
)
