"""Plot the retained analytic witness; no application data or simulation changes.

Run: uv run --project spikes/numerics --group plots python \
docs/design/topology-study/consultant/plot_routes.py
"""

from __future__ import annotations

import json
from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.lines import Line2D
from matplotlib.patches import Patch

ROOT = Path(__file__).parent
DATA = json.loads((ROOT / "route-results.json").read_text())
WITNESS = DATA["primary_detailed_witness"]
CANDIDATES = WITNESS["candidates"]
COLORS = ["#146f84", "#488b55", "#a76725", "#9ca5ae", "#6c57a1"]
NAMES = [
    "A → B → C → A",
    "A → C → B → A",
    "A → B → A → C → A",
    "A → C → A → B → A",
    "Two dedicated tugs",
]


def main() -> None:
    plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10})
    fig, (scores, times) = plt.subplots(
        1, 2, figsize=(14, 6.6), gridspec_kw={"width_ratios": [1, 1.55]}
    )
    fig.patch.set_facecolor("#fbfcfd")
    fig.suptitle(
        "The route organization changes the answer",
        x=0.055,
        y=0.97,
        ha="left",
        fontsize=20,
        fontweight="bold",
        color="#142d40",
    )
    fig.text(
        0.055,
        0.908,
        "Same two parcels, three circular ports, paid Hohmann transfers, every tug returns home.",
        color="#445767",
        fontsize=11,
    )
    offsets = [(9, 5), (9, 8), (-122, -23), (-117, 25), (-131, 12)]
    for i, candidate in enumerate(CANDIDATES):
        scores.scatter(
            candidate["fuel_used"],
            candidate["completion_time"],
            s=90 if candidate["hardware"] == 1 else 125,
            color=COLORS[i] if candidate["nondominated"] else "white",
            edgecolors=COLORS[i],
            linewidths=1.8,
            marker="o" if candidate["hardware"] == 1 else "D",
            zorder=3,
        )
        scores.annotate(
            NAMES[i],
            (candidate["fuel_used"], candidate["completion_time"]),
            xytext=offsets[i],
            textcoords="offset points",
            fontsize=8.6,
            color=COLORS[i],
        )
    scores.set(xlim=(0.29, 0.475), ylim=(15, 47))
    scores.set_xlabel("Propellant consumed  ↓ better")
    scores.set_ylabel("Time until all active tugs are home  ↓ better")
    scores.set_title("Four different tradeoffs survive", loc="left", pad=18, fontsize=12)
    scores.grid(alpha=0.15)
    scores.text(
        0.03,
        0.035,
        "Among five enumerated organizations.\n"
        "Hollow point: dominated alternative.\nDiamond: two tugs; other points: one.",
        transform=scores.transAxes,
        fontsize=8.5,
        color="#526271",
        va="bottom",
    )
    row = 0
    labels = []
    ticks = []
    for i, candidate in enumerate(CANDIDATES):
        if not candidate["nondominated"]:
            continue
        for vehicle in candidate["vehicles"]:
            y = -row
            labels.append(" → ".join(vehicle["itinerary"]))
            ticks.append(y)
            for leg in vehicle["legs"]:
                times.barh(
                    y,
                    leg["waiting"],
                    left=leg["ready"],
                    height=0.44,
                    color="#e3e8ed",
                    edgecolor="none",
                )
                times.barh(
                    y,
                    leg["duration"],
                    left=leg["departure"],
                    height=0.44,
                    color=COLORS[i],
                    edgecolor="none",
                )
                times.text(
                    (leg["departure"] + leg["arrival"]) / 2,
                    y,
                    leg["source"] + "→" + leg["destination"],
                    ha="center",
                    va="center",
                    color="white",
                    fontsize=8.5,
                )
                times.plot(
                    [
                        leg["ready"] - DATA["constants"]["service_duration"],
                        leg["ready"],
                    ],
                    [y, y],
                    color="#e8a236",
                    lw=9,
                    solid_capstyle="butt",
                )
            times.scatter(
                [vehicle["return_time"]],
                [y],
                marker="|",
                color=COLORS[i],
                s=240,
                zorder=4,
            )
            row += 1
        row += 0.45
    times.set_yticks(ticks, labels)
    times.set(xlim=(0, 46), ylim=(ticks[-1] - 0.85, 0.8))
    times.set_xlabel("Elapsed time")
    times.set_title("The extra waits are caused by orbital phase", loc="left", pad=18, fontsize=12)
    times.grid(axis="x", alpha=0.15)
    times.legend(
        handles=[
            Patch(facecolor="#146f84", label="Flight"),
            Patch(facecolor="#e3e8ed", label="Wait while attached"),
            Line2D([0], [0], color="#e8a236", linewidth=5, label="Load / unload"),
        ],
        loc="upper center",
        bbox_to_anchor=(0.5, -0.17),
        ncol=3,
        frameon=False,
        fontsize=8.7,
    )
    for axis in (scores, times):
        axis.set_facecolor("#fbfcfd")
        axis.spines[["top", "right"]].set_visible(False)
        axis.spines[["bottom", "left"]].set_color("#bcc6ce")
        axis.tick_params(color="#bcc6ce", labelcolor="#344b5a")
    fig.text(
        0.055,
        0.034,
        "Analytical content witness · C phase 1.396263402 rad selected from 72 samples · "
        "No port contention, refueling, or arbitrary traffic lanes.\n"
        "Not a global optimum, application run, sustained-service proof, or playtest. "
        "Source: hohmann_routes.py and route-results.json.",
        fontsize=8.7,
        color="#526271",
        linespacing=1.6,
    )
    fig.subplots_adjust(left=0.07, right=0.975, top=0.79, bottom=0.23, wspace=0.38)
    fig.savefig(ROOT / "route-comparison.png", dpi=160, facecolor=fig.get_facecolor())
    fig.savefig(ROOT / "route-comparison.svg", facecolor=fig.get_facecolor())
    plt.close(fig)


if __name__ == "__main__":
    main()
