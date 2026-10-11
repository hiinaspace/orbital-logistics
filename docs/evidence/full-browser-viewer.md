# Full-browser viewer

The desktop scene now fills the browser viewport instead of stopping at a 1640px
page width and 1000px scene height. Existing selectors, view controls, timeline,
transport and inspector float above the canvas. The inspector and larger timeline
lists scroll independently. At widths below 1000px, the scene and inspector stack;
phone controls wrap and the document remains vertically scrollable.

This is a CSS presentation change. It retains the existing camera, canonical
simulation, physical reference frames, fixtures and pointer-coordinate conversion.

Validation on natto, 2026-10-11:

- `npm run build` passed, including TypeScript.
- `PLAYWRIGHT_PREVIEW=1 npx playwright test tests/browser/responsive-viewer.spec.ts`
  passed five production Chrome checks: 3840×2160, 1440×900, 1024×768, 390×844 and 320×640.
- Desktop canvas bounds exactly match the viewport. Each size has no horizontal
  document overflow and keeps the Layers menu inside the screen.
- Pointer timeline seeking pauses and changes the cursor; dragging the canvas
  changes presentation without changing ship states, stocks, events or time.
  A real unobstructed canvas hit selects that object's identity.
- No browser page errors. Desktop and phone screenshots were inspected for panel
  spacing, scene visibility and controls.

[4K screenshot](full-browser-3840.png), [laptop screenshot](full-browser-1440.png),
[phone screenshot](full-browser-390.png).

These checks establish browser interaction and layout behavior, not owner taste
acceptance. Floating panels can cover scene objects; pan, zoom and Fit remain the
existing ways to inspect the full canvas.
