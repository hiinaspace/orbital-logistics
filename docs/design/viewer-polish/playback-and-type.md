# Integrated player and typography audition

2026-10-13. User accepted the docked arrangement and requested two refinements: remove the duplicated standalone scrubber; audition understated control-room/modular-panel typography and trim. These are presentation refinements to the reviewed architecture, not numerical/worker changes.

## One seeking surface

The ship lanes and common ruler are the player seek surface. A single playhead spans the lanes. Click/drag any plot area to seek the shared session; lane names still select an actor in the active view. Put play/pause, restart, textual simulation time, the bipolar speed control and Live/Replay in the same bottom player panel. No second progress slider. The player stays visible; its familiarity comes from grouping and affordances rather than hiding essential simulation controls.

- A hover timestamp previews the position; it does not seek merely from pointer movement.
- Collapsing ship lanes retains the common seek ruler and control band.
- Preserve reverse→0pause→forward and fine slow-speed adjustment. Positive/negative playback still reads shared history; it never reverses the physical worker.
- Use actual scenario time units. A finite scene may show current/end; continuous scenes show current time and Live/frontier rather than implying a fixed total duration.
- On seeking, preserve existing held-history/pending-reply semantics. Pin the displayed axis bounds for the gesture so an arriving worker packet cannot move the point under the pointer. Restore prior play state into held playback on release, returning to Live only under the existing policy. Cancellation must release gesture ownership cleanly.
- Keyboard seeking belongs to the common ruler, actor selection to names. Keep keyboard focus stable through refresh; preserve accessible time/speed names and native form behavior. Timeline resizing remains separate from seeking.

The standalone study demonstrates ruler/lane seeking, one shared playhead, play/pause/reverse, zero-speed detent, Live and collapsed-lane seeking. It manipulates sample presentation time over0–20; the spacecraft diagrams and telemetry remain illustrative, not a simulation.

## Three style directions

| Direction | Type | Trim |
|---|---|---|
|A · Telemetry|IBM Plex Sans + IBM Plex Mono|Cool graphite, compact type, fine machined borders and light raised controls.|
|B · Flight deck|Barlow body + Barlow Condensed headings + IBM Plex Mono values|Warm gray-green modules, engraved-looking section labels, shallow beveled keys and recessed slider grooves.|
|C · Observatory|Space Grotesk + IBM Plex Mono|Deep blue panels, softer corners and more geometric lettering.|

Current recommendation: B's panel trim, with Barlow or IBM Plex chosen after the same-layout comparison. Keep body text straightforward; put most character in headings, numerical typography and small controls. Use restrained gradients/edges and a limited amber accent. The fonts, palette and trim are independent design choices: the study permits a separate Typeface override and Panel trim toggle.

The light Style study toolbar is audition-only, not planned production chrome. All font files are local Latin subsets, with source records and OFL license texts under fonts/. No runtime font service is used. The current audition downloads245860bytes of candidate fonts across11files; a chosen production pairing should include only its used faces/weights. Retain candidate assets with this design record until selection, then prune unused production assets.

Sources: [IBM Plex](https://github.com/IBM/plex), [Barlow](https://github.com/jpt/barlow), [Space Grotesk](https://github.com/floriankarsten/space-grotesk). Google Fonts' upstream distribution supplied the unmodified WOFF2 Latin subsets; exact URLs/bytes are recorded in fonts/sources.json and family license files are retained.

## Viewing and evidence

- Interactive full layout: http://127.0.0.1:4180/layout-study.html
- Side-by-side font/control samples: http://127.0.0.1:4180/font-comparison.html
- Repro: `uv run --project spikes/numerics python -m http.server 4180 --bind 127.0.0.1 --directory docs/design/viewer-polish`, then `node docs/design/viewer-polish/audition-evidence.mjs`.
- This local review server is intentional and can stop after typography selection. It serves only this design directory; viewer4178 is unchanged.
- Chrome screenshots and platform-font readback verify the actual custom headings loaded for all three variants. Interaction checks cover seek, speed, collapse, trim and independent selection; no external browser requests/page exceptions occurred. This is prototype verification, not integrated viewer/mobile performance evidence.

Next application implementation should use the unified player and selected visual tokens from the start, alongside the previously reviewed Session/Viewport extraction. No new external senior review is needed merely to choose fonts or rearrange the same shared seek control.
