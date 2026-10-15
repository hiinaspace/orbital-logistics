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

## Initial October14 release recommendation

**The original development history was unsafe to expose as-is.** Removing material from
HEAD does not remove its historical Git objects. Keep this private repository as
the development archive and seed a public repository from the scrubbed tree, or
explicitly plan a complete history rewrite before changing repository visibility.
That initial pass did not rewrite history; the October15 follow-up below supersedes
this recommendation for the local and reachable remote history.

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
- The clean-tree export was inspected:1493 files, approximately45MB compressed,
  with no Git/scratch/untracked payloads or credential-pattern matches.
- `publication/orbital-logistics-source.tar.gz` is a local, ignored, clean-tree
  snapshot prepared after the publication commit. It contains neither Git history
  nor scratch/untracked files. Recreate it after subsequent changes before release:
  `git archive --format=tar.gz --prefix=orbital-logistics/ --output=publication/orbital-logistics-source.tar.gz HEAD`.

The source-release artifact is separate from `dist/`, which remains the static-site
upload directory. At that review point the static site had not been uploaded. The
rewritten source branch was pushed on October15 as described below.

## October15 in-place history rewrite

The owner authorized losing the old hashes to retain the existing repository.
A private recovery copy was made outside the project, then git-filter-repo2.47.0
rewrote all local branch histories and the app's standalone snapshot-tree refs in
an isolated mirror. Temporary wrapper commits let the filter visit those trees;
they were removed before the cleaned refs were installed in this checkout.

- Replaced36 original historical raw log blobs, including all eight known private
  context blobs. Retained all81 implementation commits and the public written
  reviews/model headers.
- Verified the current source tree hash was identical before/after the rewrite.
  Untracked owner research notes were hashed before/after and retained unchanged.
- Updated local refs atomically with expected-old-value checks, expired old
  reflogs, pruned unreachable objects and verified that every original raw blob
  was absent locally. The temporary rewrite mirror was removed.
- GitHub had one private branch, zero forks and zero open/closed pull requests.
  Replaced that branch using an explicit force-with-lease against its observed tip.
  The repository is still private; no visibility, DNS or site deployment changed.
- Build and all seven production entry/browser cases passed before the rewrite;
  the rewrite changed no source files. Figure links and transcript styling are
  documented in the entry evidence.

**Remaining remote privacy boundary:** authenticated GitHub API lookups still
retrieve two original raw blobs by their SHA after the force-push. The cleaned
reachable history is in place, but server-side cached/unreachable data has not
been purged. A second inspection of the eight flagged bodies found no credentials,
private keys, recognizable secret tokens or LAN IP addresses. They contain local
paths, host/user names, tooling context and short notes about other projects.

The owner accepted this as incidental nonpublic metadata worth rewriting, but not
sensitive enough to warrant a GitHub Support purge. Server-side cleanup is optional,
not a publication blocker. Repository visibility remains private for the owner's
own review and later decision. The unsent Support draft and original-object pointers
remain outside the source tree in the private recovery folder.

[GitHub's removal procedure](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
explains the cached-object boundary. Do not merge or restore old history from the
private recovery copy into this cleaned branch.

## October15 soft deployment

The owner authorized public static hosting at `orbital.hiina.space` while retaining
private repository visibility for further review. Only the production `dist` tree
was uploaded to Cloudflare Pages; the site includes the intended public transcript,
not Git history or local recovery material. See the [deployment record](deployment/cloudflare-pages.md).
