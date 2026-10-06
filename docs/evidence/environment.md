# Environment and tooling — 2026-10-06

Verified on host `natto`, checkout `/home/s/code/orbital-logistics`, branch
`codex/initial-planning`. Planning task: `01a11364-cfb4-76c3-946a-257edc35cab3`.
New local repository; no remote configured. Initial checkout had no files. Vault
project note and charter were untracked at inspection; unrelated work preserved.

| Tool | Observed version |
| --- | --- |
| Node | 22.22.1 |
| npm | 11.4.2 |
| uv | 0.11.7 |
| Google Chrome | 154.0.8037.97 |
| Vite | 8.3.3 |
| TypeScript | 7.0.2 |
| tsx | 4.23.15 |
| @playwright/test | 1.63.0 |
| Codex CLI | 0.153.4 |

npm dependencies pinned exactly in package.json + package-lock.json. `npm install`
completed (92 packages added, audit found zero vulnerabilities at install time).
No system runtime changes or browser installation needed. Node satisfies current
[Vite's documented requirement](https://vite.dev/guide/).
Playwright can drive installed Google Chrome via `channel: chrome`, per its
[official browser documentation](https://playwright.dev/docs/browsers).

Checks:

- `npm run test:browser`: installed Chrome successfully loaded Vite page, drew
  opaque Canvas pixels, received module-worker reply, and had no page errors.
- Initial typecheck caught missing Vite CSS import declarations. Added
  `src/vite-env.d.ts`; subsequent `npm run build` passed (static assets and module worker emitted).
- This smoke check does not test an editor, physical propagation, production
  bundle browser behavior, full interaction latency, or other browsers.

Test-created Vite server is managed by Playwright and stopped on test completion.

Final shell verification includes the retained-sample viewer: frame selection and
preview epoch input update successfully in installed Chrome with no page errors.
`docs/evidence/viewer.png` was captured and visually inspected. It is a diagnostic
view of precomputed samples, not a live predictor or completed editor. The browser
check initially needed a more specific status selector because HTML `<output>`
also exposes status semantics; it passes after that selector correction.

A separate pure-compute browser experiment (`node spikes/browser-benchmark.mjs`)
ran the actual spike RK4 in installed headless Chrome: horizon 6, h=1/512,
one ship/two sources/one impulse, 3 discarded warmups + 9 measured runs.
Median 8.7 ms, range 5.7–12.3 ms. Endpoint matches the retained edited fixture.
Raw result: `browser-benchmark.json`. This excludes pointer-to-paint, worker
transfer and drawing; it is not the M1 interaction-latency acceptance test.
The script closes both its browser and local Vite server in `finally`.
