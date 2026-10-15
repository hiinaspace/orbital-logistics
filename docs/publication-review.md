# Publication review — 2026-10-14

Scope: a bounded prepublication review of the current tracked tree, reachable Git
objects, package metadata, bundled assets and the new public transcript. This is not
a claim that an automated pattern scan proves the absence of every possible secret.
No repository visibility, DNS, Cloudflare or account settings were changed.

## Licensing

- Original code: `LICENSE` and npm metadata now specify **Unlicense**, following
  the owner's preference. `private: true` prevents accidental npm publication; it
  does not prevent an open-source release.
- Bundled fonts: Space Grotesk and IBM Plex Mono use **SIL OFL 1.1**. Their original
  copyright/reserved-name notices were already adjacent to the source font files.
  Complete copies now also ship in `public/THIRD-PARTY-NOTICES.txt`.
- Vite's injected browser preload helper is **MIT**; its copyright/license notice
  also ships in that file. There are no application runtime npm dependencies.
- The locked development dependency graph records MIT, Apache-2.0, MPL-2.0, ISC
  and BSD-3-Clause licenses. The MPL packages are Lightning CSS and its platform
  binaries, used by the build rather than included in the viewer. Build dependencies
  are installed separately, not vendored or relicensed by the project.
- Numerical research uses separately installed NumPy/SciPy and optional Matplotlib
  tooling. Font-study alternatives retain their adjacent OFL files. Screenshots,
  plots, generated trajectories and schematic art are project-produced. No mission
  SPK kernels, third-party videos or proprietary art were found among tracked files.

Reference: [Unlicense](https://unlicense.org/),
[SIL OFL FAQ](https://openfontlicense.org/ofl-faq/), and installed dependency notices.
The project's license does not replace the retained third-party licenses.

## Sensitive material

The initial reachable-history scan inspected3371 objects, including2249 blobs
(2046 text-like blobs),119,224,279 bytes total.
It found no matches for private-key blocks, common GitHub/OpenAI/Anthropic/AWS token
formats, JWTs, credential-bearing URLs or quoted credential assignments. Only the
intended Hiina contact address appeared in the email scan. Git author and committer
identities were also Hiina. This is a local pattern/metadata review, not token
validation against any provider.

**Actual privacy finding:** eight raw review logs included copied personal memory
or unrelated project context. All36 raw review/agent execution log bodies in the
current tree were replaced with short public stubs. Their filenames remain so old
references still resolve; model/effort header metadata and links to written reviews
are retained. Written reviews, dispositions and numerical/browser evidence remain.
Ordinary local checkout paths in historical stack traces are not credentials; raw
session identifiers and operational context are excluded from the public transcript.
Scratch and publication artifacts are ignored to reduce accidental additions.

## Release boundary

**Do not expose the existing development history as-is.** Removing material from
HEAD does not remove its historical Git objects. Keep this private repository as
the development archive and seed a public repository from the scrubbed tree, or
explicitly plan a complete history rewrite before changing repository visibility.
No history was rewritten by this pass.

`git archive HEAD` exports only the committed current tree, with no `.git` history,
ignored artifacts, credentials or untracked research notes. A clean release can be
seeded from that reviewed export. Do not copy the existing `.git` directory into
the public checkout. The old development commit links are not a public source of
truth for that clean release; the build transcript and retained evidence provide
its design history instead.

The static site is a different boundary: Vite emits only the three selected HTML
entries, their imported assets and `public/` files. Review logs, session records,
Git data and numerical tooling are not deployed. The transcript exports only the
reviewed owner messages and condensed summaries. Site deployment and source
publication remain separate, unexecuted operations.

## Validation and release artifact

- `npm run build` passes, producing three HTML documents plus the Markdown export.
- Six production entry/browser tests pass, including all105 transcript exchanges,
  chapter navigation, no-JS/narrow reading, the Markdown download, bundled notices
  and plain static hosting under a subdirectory.
- Desktop1440px and narrow360px transcript screenshots were inspected; no overflow
  or browser errors were observed. The transcript adds about109KB HTML (34KB gzip),
  86KB optional Markdown and less than1KB dedicated CSS, with no client JS in the
  production transcript entry.
- `npm audit --json` reports zero known vulnerabilities for the installed lockfile.
- `publication/orbital-logistics-source.tar.gz` is a local, ignored, clean-tree
  snapshot prepared after the publication commit. It contains neither Git history
  nor scratch/untracked files. Recreate it after subsequent changes before release:
  `git archive --format=tar.gz --prefix=orbital-logistics/ --output=publication/orbital-logistics-source.tar.gz HEAD`.

The source-release artifact is separate from `dist/`, which remains the static-site
upload directory. Neither has been uploaded by this review.
