"""Permanent offline research illustration; no simulation or browser implementation.

Run: uv run --project spikes/numerics --group plots python \
    docs/design/potential-field/illustrate_compact_field.py

Exact compact source field at co-rotating phase zero. Potential is per unit mass.
Height and color clipping only affect this illustration; interior samples are masked.
"""

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import Normalize
from matplotlib.patches import Circle

OMEGA = np.sqrt(1.03 / 125)
LIMITS = (-1.05, -0.10)
LEVELS = [-1.0, -0.8, -0.6, -0.45, -0.35, -0.28, -0.22, -0.18, -0.14]
OUTPUT = Path(__file__).with_name("compact-field-representations.png")


def potential(x, y):
    """Return ordinary/effective potential and true-radius interior mask."""
    r = np.hypot(x, y)
    m = np.hypot(x - 5, y)
    interior = (r <= 1) | (m <= 0.2)
    with np.errstate(divide="ignore", invalid="ignore"):
        ordinary = -1 / r - 0.03 / m
    effective = ordinary - 0.5 * OMEGA**2 * (x**2 + y**2)
    return np.where(interior, np.nan, ordinary), np.where(interior, np.nan, effective)


def main():
    plt.rcParams.update({"font.size": 10, "axes.titlesize": 13, "font.family": "DejaVu Sans"})
    x, y = np.meshgrid(np.linspace(-7, 7, 300), np.linspace(-6, 6, 260))
    ordinary, effective = potential(x, y)
    fig = plt.figure(figsize=(18, 6.7), facecolor="#f7f9fa")
    grid = fig.add_gridspec(1, 3, left=0.04, right=0.96, bottom=0.25, top=0.80, wspace=0.18)
    norm = Normalize(*LIMITS)
    cmap = plt.get_cmap("cividis")
    flat_axes = []
    for index, (field, title) in enumerate(
        [
            (ordinary, "Ordinary gravitational potential"),
            (effective, "Co-rotating effective potential"),
        ]
    ):
        ax = fig.add_subplot(grid[0, index])
        flat_axes.append(ax)
        ax.set_facecolor("#e9eef1")
        ax.pcolormesh(x, y, field, cmap=cmap, norm=norm, shading="auto", rasterized=True)
        lines = ax.contour(
            x, y, field, levels=LEVELS, colors="#fafafa", linewidths=0.65, alpha=0.65
        )
        ax.clabel(lines, inline=True, fontsize=7, fmt="%.2f")
        for cx, radius, name in [(0, 1, "Aster"), (5, 0.2, "Selene")]:
            ax.add_patch(Circle((cx, 0), radius, facecolor="#23313c", edgecolor="white", lw=0.9))
            ax.annotate(
                name,
                (cx, 0),
                xytext=(0, 12 if cx else 0),
                textcoords="offset points",
                ha="center",
                va="center",
                color="white",
                fontsize=9,
                weight="bold",
            )
        qx, qy = np.meshgrid(np.arange(-6, 7, 2), np.arange(-4, 5, 2))
        r, m = np.hypot(qx, qy), np.hypot(qx - 5, qy)
        valid = (r > 1.3) & (m > 0.5)
        qx, qy, r, m = qx[valid], qy[valid], r[valid], m[valid]
        gx = -qx / r**3 + 0.03 * (5 - qx) / m**3
        gy = -qy / r**3 - 0.03 * qy / m**3
        if index:
            gx, gy = gx + OMEGA**2 * qx, gy + OMEGA**2 * qy
        length = np.hypot(gx, gy)
        ax.quiver(
            qx,
            qy,
            gx / length,
            gy / length,
            angles="xy",
            scale_units="xy",
            scale=2.5,
            color="white",
            alpha=0.55,
            width=0.003,
            headwidth=3,
        )
        ax.set(
            title=title,
            xlabel="x · model length",
            ylabel="y · model length",
            xlim=(-7, 7),
            ylim=(-6, 6),
            aspect="equal",
        )
        ax.tick_params(labelsize=8)
        ax.spines[["top", "right"]].set_visible(False)
    ax = fig.add_subplot(grid[0, 2], projection="3d")
    height = np.clip(ordinary, *LIMITS)
    ax.plot_surface(
        x,
        y,
        height,
        rcount=100,
        ccount=100,
        cmap=cmap,
        norm=norm,
        linewidth=0,
        antialiased=True,
        alpha=0.95,
    )
    ax.view_init(elev=32, azim=-62)
    ax.set(
        title="Schematic ordinary-potential height",
        xlabel="x",
        ylabel="y",
        zlabel="display height h = clipped Φg\nnot physical Z",
        xlim=(-7, 7),
        ylim=(-6, 6),
        zlim=LIMITS,
    )
    ax.set_box_aspect((14, 12, 5))
    ax.tick_params(labelsize=8)
    color_ax = fig.add_axes((0.24, 0.145, 0.52, 0.018))
    colorbar = fig.colorbar(
        plt.cm.ScalarMappable(norm=norm, cmap=cmap),
        cax=color_ax,
        orientation="horizontal",
        extend="both",
    )
    colorbar.set_label("Potential per unit mass · fixed color/height range [−1.05, −0.10]")
    fig.suptitle(
        "One compact field, three analytical representations",
        x=0.04,
        y=0.96,
        ha="left",
        fontsize=21,
        weight="bold",
        color="#23313c",
    )
    fig.text(
        0.04,
        0.88,
        "Φg = −1/rA − 0.03/rS      Φeff = Φg − ½ω²(x² + y²)      ω = √(1.03/125) ≈ 0.09077",
        fontsize=12,
        color="#374b59",
    )
    fig.text(
        0.04,
        0.022,
        "Phase zero: Aster (0, 0), μ=1, radius=1; Selene (5, 0), μ=0.03, radius=0.2. "
        "True body interiors are excluded.\n"
        "Arrows show normalized −∇Φ direction only; effective arrows assume zero rotating "
        "velocity and omit Coriolis. Surface height is a diagram, not terrain or orbital motion.",
        fontsize=10,
        linespacing=1.65,
        color="#374b59",
    )
    fig.savefig(OUTPUT, dpi=150, facecolor=fig.get_facecolor())
    plt.close(fig)
    print(OUTPUT)


if __name__ == "__main__":
    main()
