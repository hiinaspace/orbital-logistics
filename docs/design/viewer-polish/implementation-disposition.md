# Implementation review disposition

Reviewer transport: gpt-6-astra/high, Codex CLI read-only, session
01a13809-9a3d-7720-88ea-568529f432a8, exit0. Source-verified review; the reviewer
performed no browser validation. See implementation-review.md and the compact
transport log. The main loop independently reproduced/checked the findings.

| Finding | Disposition |
|---|---|
| Reset reused a deliberately lost GL context | Adopted. Dispose and replace the two field canvases on each session generation, so context events and ownership cannot bleed into a new set. |
| Maximized view retained hidden foreground backing | Adopted. Suspend hidden pane refinement and shrink its foreground backing to1×1. Restore dimensions on reveal without refitting or changing camera scale. |
| Canvas T key compared against an extracted identifier string | Adopted. Restore literal T; add focused-canvas keyboard coverage. |
| Session retains first-ingest/held/cursor refresh/bounded request behavior | Confirmed by comparison; exercised in the workspace browser suite. |

Additional main-loop follow-up: mountWorkspace has idempotent teardown of its RAF,
shared session/worker, all panes, global input/visibility listeners and diagnostic
properties. A later arrival page can import/mount/dispose the viewer without
leaving a hidden simulation. This pass does not implement that arrival page.

Final main-loop gates also caught and corrected preset fitting before split resize,
and repeated scans/transforms at4K. Exact display indexing and position-only system
projection brought the correctly fitted4K comparison from50ms back to33.4ms frame
p95. See the evidence and finalspot data; no extra numerical simplification or
backing-quality reduction was introduced. Diagnostic renderedEpoch separates the
last painted camera pose from immediate clock/UI updates in browser assertions.
