The workspace suite exercises the public eleven-set library, shared playback and
independent views. It replaces the historical single-canvas/standalone-scrubber
browser suite, whose selectors and retired set registrations no longer exist.
Those tests remain in Git. The numerical suites in ../sim remain unchanged,
including historical fixture/program witnesses required by retained services.

Run `npm run build && PLAYWRIGHT_PREVIEW=1 npm run test:browser` for the production
bundle gate, or `npm run test:browser` for the Vite development server.

`npm run test:firefox` exercises the locally installed Firefox through geckodriver
against the production preview on port4178. Override `FIREFOX_TEST_URL` for another
server. It creates a throwaway profile under the repo's `.scratch/`, opens the
native frame dropdown, checks its DOM stability while paused, and exercises
playback, sidebar resizing and four potential/relief scenes. It closes its browser,
driver and profile on completion. `GECKODRIVER_BIN` can select a driver explicitly;
on Snap installations it uses the packaged driver binary so the parent can stop it.
Screenshots go to `test-results/firefox-ui/`, or `FIREFOX_TEST_OUTPUT_DIR`. Use a
separate output directory if running concurrently with Playwright, which clears
`test-results/` at startup. The test never connects to a personal Firefox profile.
