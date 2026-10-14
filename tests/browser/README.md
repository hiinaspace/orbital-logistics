The workspace suite exercises the public eleven-set library, shared playback and
independent views. It replaces the historical single-canvas/standalone-scrubber
browser suite, whose selectors and retired set registrations no longer exist.
Those tests remain in Git. The numerical suites in ../sim remain unchanged,
including historical fixture/program witnesses required by retained services.

Run `npm run build && PLAYWRIGHT_PREVIEW=1 npm run test:browser` for the production
bundle gate, or `npm run test:browser` for the Vite development server.
