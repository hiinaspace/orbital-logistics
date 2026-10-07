# Independent game-design consultation artifacts

Created 2026-10-07 for the user's design reconsideration. These are retained,
small research artifacts associated with that decision. Their intended lifetime
is through selection/rejection of the next gameplay experiment; the analytical
witness can remain as provenance if incorporated into a future level. They do not
modify or implement the application. No temporary services were started.

- [Recommendation](recommendation.md): diagnosis, genre comparison, alternatives,
  recommendation, physical witness, and next decision gates.
- [Primary-source reference notes](reference-notes.md): developer descriptions and
  stated design intent for Zachtronics, Factorio, Mini Metro, and Rail Route.
- [Analytical experiment](hohmann_routes.py): circular three-port route enumeration.
- [Results](route-results.json): compact 72-phase/five-organization sweep and full
  ledgers for the selected five-organization witness. The selection rule and
  domain limitations are part of the artifact.
- [Figure script](plot_routes.py), [PNG](route-comparison.png), and
  [SVG](route-comparison.svg): the physical witness's score and elapsed-time views.

Run from `/home/s/code/orbital-logistics` using the existing numerical environment:

```sh
uv run --project spikes/numerics python docs/design/topology-study/consultant/hohmann_routes.py
uv run --project spikes/numerics --group plots python docs/design/topology-study/consultant/plot_routes.py
uv run --project spikes/numerics ruff format --config spikes/numerics/pyproject.toml --check docs/design/topology-study/consultant/*.py
uv run --project spikes/numerics ruff check --config spikes/numerics/pyproject.toml docs/design/topology-study/consultant/*.py
uv run --project spikes/numerics --group plots ty check docs/design/topology-study/consultant/hohmann_routes.py docs/design/topology-study/consultant/plot_routes.py
```

No new Python project or dependency configuration was created. The pure analytic
experiment is independent of app code. It is not an application fixture or a
playtest. It excludes joint handoffs, port contention, refueling, production,
finite thrust, gravity assists, and unrestricted trajectory optimization.
