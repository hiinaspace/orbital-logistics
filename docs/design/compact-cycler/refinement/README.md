# Cycler refinement authoring

Frozen admitted v2 input is `refined-controls.json`. Production source is regenerated
by `uv run --project spikes/numerics python spikes/numerics/compact_cycler_refined.py`
(the existing compact_cycler.py CLI dispatches to this too). This freshly replays the
whole coupled journey with DOP853 and recomputes all oracles/captures/fuel, without
re-running targeting or using inverse curve positions.

To reproduce the bounded authoring exploration, run from repository root:

1. `uv run --project spikes/numerics python docs/design/compact-cycler/refinement/search.py`
2. `uv run --project spikes/numerics python docs/design/compact-cycler/refinement/compile.py`
3. `uv run --project spikes/numerics python docs/design/compact-cycler/refinement/homotopy.py --tight`
4. `uv run --project spikes/numerics python docs/design/compact-cycler/refinement/freeze.py`
5. Regenerate the independent source, then run native admission/convergence tests.

The search and continuation are bounded offline experiments, not an online optimizer.
Nine continuation stages freeze endpoint controls while bringing middle thrust to zero.
Unrestricted two-pulse trials and direct prescribed coast-endpoint proposals produced
collision/over-cap/unavailable candidates; those were rejected. Retained logs distinguish
them from the selected witness. Intermediate large JSON outputs were removed after
freezing; the scripts regenerate them. The default homotopy case preserves the earlier
less-local candidate for comparison; `--tight` selects the published choreography.

[Evidence](../../../evidence/compact-refinement.md), [review disposition](disposition.md).

Discarded pulse/prescribed-endpoint experiment scripts were removed; their logs
remain failure provenance rather than runnable production sources.
