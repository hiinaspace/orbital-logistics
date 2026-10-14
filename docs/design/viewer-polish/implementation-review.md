Found three concrete regressions against `HEAD:src/main.ts` (`53cc00b`):

1. **[P2] Restarting or switching sets permanently breaks relief in that pane.** [viewport.ts:739](/home/s/code/orbital-logistics/src/viewer/viewport.ts:739) disposes the field renderer and recreates it using the same canvases. [relief.ts:53](/home/s/code/orbital-logistics/src/view/relief.ts:53) explicitly loses the WebGL context; nothing restores it or replaces the canvas. Enable Relief, then Restart: subsequent initialization encounters the lost context and disables Relief. Reserve context loss for permanent pane removal, or replace the canvas during reset.

2. **[P2] Maximizing can exceed the aggregate 8.3MP backing-store limit.** [workspace.ts:27](/home/s/code/orbital-logistics/src/viewer/workspace.ts:27) budgets only visible panes, but [viewport.ts:746](/home/s/code/orbital-logistics/src/viewer/viewport.ts:746) leaves the hidden pane’s foreground backing allocated. Its resize handler also returns immediately while hidden. At budget-saturating dimensions, maximizing an equal split retains roughly 4.15MP while allocating 8.3MP for the visible pane—roughly 12.45MP total. Release hidden foreground backing or include it in allocation accounting.

3. **[P2] T no longer selects Top while the canvas has focus.** [viewport.ts:708](/home/s/code/orbital-logistics/src/viewer/viewport.ts:708) compares the key with `'session.t'`, an extraction error replacing the original `'t'`. The document handler explicitly excludes pane descendants, so it cannot compensate. Restore the literal `'t'`.

The inspected session paths retain the original first-ingest ordering, held-reply predicate, cursor-dependent refresh checks, and bounded request guard. I found no additional simulation owner introduced by the second pane.

`npm run typecheck` passes. Findings are source-verified; browser lifecycle and playback parity were not exercised. No edits, service launches, or delegation.
