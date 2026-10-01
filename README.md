# Puerto Rico: Special Edition

Implementation for Boardgamers Space, targeting **Puerto Rico 1897: Special Edition** and the official June 2026 errata. Version 1 is published as a **private beta** on [BGS](https://boardgamers.space/boardgame/puerto-rico), with Unlisted disabled. The engine package is `@boardgamers/puerto-rico@0.1.1`; English and French are configured in the platform metadata.

```sh
pnpm install
pnpm dev
# http://127.0.0.1:5251/?locale=fr
```

The local preview lets you play one seat with two ordinary bots. Its initial building selection is performed automatically so you can start with role selection. The actual engine has the full shared building selection phase. Local progress is saved in the browser. The small local toolbar offers undo, opponent turns, restart and light/dark; it is absent from the hosted viewer.

## Edition configuration

`release-config.js` defines one fixed Special Edition configuration. `bgs/engine.js` uses it regardless of creation-form expansion fields; the BGS metadata intentionally exposes **no expansion picker or game options**. The core engine in `engine/index.js` accepts independent expansion switches for future configuration, simulation and tests.

Implemented modules:

- Base game, 2–5 players, including the classic two-player rules.
- New Buildings: all 14 building types and cost-constrained shared market selection.
- Citizens: 20 citizens, 8 building types, occupancy-dependent effects and scoring.
- Smuggler: all four actions, role capture, surplus worker/citizen choices.
- Festival: three shared objectives and physical resource reservations.
- Festival Activities: all 12 activity definitions, three drawn per game.

**Not complete:** the 30-card Achievements deck has not been found in the official resources. It is deliberately not enabled or replaced with invented cards. Puertoma is not implemented; the preview bots use the normal human rules. See [source notes](docs/sources.md), including a Festival/unique-building ambiguity that needs a ruling before release.

The engine accepts the optional `costSwap`, `alternativeStart`, `tailorLimit` and `pairingRestrictions` balance variants internally. They are disabled in the fixed configuration and not exposed in the UI.

## Viewer and integration

- French and English, using the platform locale; no language controls.
- Distinct goods pictograms; color is supplementary.
- Paper, terracotta and sea-green visual theme in light/dark modes; original vector town illustration, larger corn and a repeat-privilege pictogram.
- Editable worker allocation, goods storage, building details, private shipping, final scoring.
- Contextual role warnings explain unavailable actions before committing a choice, including role coins and building rewards. They remain advisory; legal strategic choices are preserved.
- Desktop and mobile layout, incremental DOM updates, native page and modal scrolling.
- BGS chat and replay, concealed VP totals, server-only randomness and future draws.
- Deterministic ordinary bots for local testing and BGS bot seats.

## Validation

```sh
pnpm test           # rule scenarios, legal complete games, resource conservation, replay
pnpm build          # dist/engine.js, dist/viewer.js, local sandbox
pnpm test:browser   # 320/390/768/1440px, real viewer events, chat/journal scrolling
```

The implementation remains a preview pending playtesting, the missing card data, and the rule ambiguity noted above. Original vector UI artwork is in `viewer/icons.js`; reference scans in `.local/` are ignored and never bundled.

## Private BGS publication

`pnpm publish:private` builds the bundles, packages only the self-contained engine and its manifest, checks complete 2–5-player games from the extracted package, and uploads the engine/viewer to BGS. The script reads the admin token from `~/.bgs` without logging it, preserves the existing game/request identity, refuses to replace a public version, and verifies the private/listed flags and CDN bytes. It grants beta access to `coyotte508` if needed. Metadata snapshots and package artifacts stay in ignored `.local/release/`.

The hosted bundle has no local preview controls or runtime asset dependencies. Global BGS locale and color-blind preferences are handled by the viewer; expansion switches remain internal. Tutorials are not yet registered.
