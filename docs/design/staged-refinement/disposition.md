# Astra review disposition

2026-10-11, natto. User requested a bounded aesthetic refinement, then added NASA
Eyes-style reverse playback and offline real-mission references. The review ran
read-only through `codex exec -m gpt-6-astra` with high effort; the actual model and
effort are verified in [the transport log](astra-review.log). Main implementation
ran gpt-6.1-sol/high; the lander search and reference analysis ran gpt-6-sol/high.

| Review recommendation | Disposition and evidence |
| --- | --- |
| Diagnose the apparent L1 stop before changing world scale. | Accepted. At the slow point Odyssey is near Selene, about1.00 from estimated L1. Inertial cancellation explains some slowing; the173.7° insertion turn in0.1075 adds the visible flip. Neither world geometry nor frames changed. |
| Constrain orbital direction and heading topology before optimizing cost. | Accepted. Eagle now coasts prograde, with minimum lunar angular momentum +0.01872 instead of −0.02417. Its two burns use three keys each and turn26.45°/124.66° instead of301.6°/346.0°. |
| Try longer insertion with lower acceleration while preserving downstream geometry. | Accepted. Three coherent later-handoff candidates passed the canonical compiler. Index2 preserves the original ballistic state at30.35, extends the burn to0.9586, and lowers peak acceleration from3 to0.2076. The final combined mission includes the new fuel mass. |
| Prefer radius excess ≤0.03 and turn ≤120° per burn. | Adapted as taste targets, not established feasibility bounds. Selected radius excess0.06761 and final turn124.66° retain exact capture while substantially improving baseline0.14033. A later-dock candidate saves only0.00128 radius excess but turns144.17°; rejected. No physical tolerance was relaxed to meet a taste score. |
| Allow surface dwell and docking time to move. | Accepted. Liftoff42.18389 and dock45.37020 replace40.66441/44.5. Descent, surface location, parking trajectory and departure47.15 remain. |
| Bound the search rather than expanding a heading grid. | Adapted narrowly. Lander used12 initial starts plus6 targeted dwell seeds, with3 polished branches and2 exact finalists. Arrival used3 old-handoff trials and3 coherent later-handoff branches. One softer-brake probe failed and was discarded. Retained scripts/logs record these branches; no open-ended optimization loop. |
| Revalidate whole mission, attached mass, captures and numerical accuracy. | Accepted. The combined compiler, shape/ownership/half-step tests, DOP853 whole-graph cycles0/17/9000, and canonical h/2/h/4 passes all succeed. Return fuel/recovery remain derived from actual changed inventories. |
| Keep aesthetics distinct from numerical optimality. | Accepted. Lower cost and coherent geometry are measured; visual inspection in inertial and rotating views supports the change. This is a prepared witness, not a claim of globally optimal transfers. |

The reverse speed control is presentation only. Its signed logarithmic scale has
an exact zero center, finer slow-speed resolution, and unchanged absolute per-set
caps. Moving away from zero resumes in that direction; the separate Pause button
continues to hold playback while a preferred nonzero speed is adjusted. Double
clicking the control centers it. Play at zero restores the previous direction.
Finite replay works in either direction. Continuous reverse uses held retained
history, stops at its oldest epoch, and does not request forward planning; Live
restores positive speed and releases held history. A worker reply already in flight
may advance the published head once without moving the held cursor.

[Real mission references](../mission-reference/README.md) are offline data with
explicit sources, frames, epochs and limits. They are not app assets or navigation
oracles. The Artemis II trace is a free-return flyby, while the documentary Apollo11
ascent/phasing/docking sequence is the relevant comparison for Eagle.
