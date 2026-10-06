# Agent notes

## Product decisions

- Target **Puerto Rico 1897: Special Edition**, including the June 2026 errata. Keep one fixed release configuration (`release-config.js`); expansion switches are internal, with no expansion picker in BGS or the viewer.
- Read [source notes](docs/sources.md) before changing rules. Achievements and Puertoma use the sourced decks documented there. Festival's unique-building reservation remains an explicit interpretation. Choosing one platform participant automatically creates two virtual Puertomas; multiplayer bot seats still use human rules. Keep those modes distinct, and do not invent components.
- Use BGS locale and color-blind preferences, without duplicate controls. Favor readable pictograms with tooltips; colors must not be the only identifiers. Role warnings remain advisory, never forbidding a legal strategic choice.
- The local preview skips the market draft and saves progress in the browser. Preserve the user's session; use a separate browser context for destructive playtests.

## BGS publication

- Slug `puerto-rico`, version **1** stays **private** (`public: false`), with **Unlisted off** and English/French supported. Making it public needs an explicit request.
- Use `pnpm publish:private`; see [README](README.md#private-bgs-publication). It packages, uploads and verifies the engine/viewer and metadata. Admin credentials come from `~/.bgs`; never print or commit the token.
- Bump the package version for engine changes. Ship `dist/engine.js` and the self-contained `dist/viewer.js` (global `puertorico`), never the local sandbox. Do not register tutorial metadata until playable BGS tutorials exist.
- Source repositories are public on Codeberg (`origin`) and GitHub (`github`); push commits to both. Git delivery and BGS publication are separate.

## Checks

Use `pnpm test` for engine changes, `pnpm build` for bundles, and `pnpm test:browser` for UI behavior. Preserve native mobile scrolling, including gestures starting on disabled buttons and scrolling inside chat/journal.

## BGS publication and Git delivery

Whenever changes are published to BGS, commit the corresponding source, tests,
dependency/lockfile changes and version bumps, then push them to this repository's
`main` or `master` release branch in the same task. A BGS upload or a push only to
a feature branch does not complete delivery. This is standing authorization to
commit and push published changes without asking for separate confirmation.

Fetch and integrate the latest release-branch changes, run the relevant repository
checks, and push without force. Update any public mirrors required by this repo's
existing workflow too. Keep credentials, generated artifacts excluded by the repo,
and unrelated unfinished work out of the commit. Verify the remote branch contains
the delivered commit and report any blocker instead of claiming delivery.
