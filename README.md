# Puerto Rico — 1897 Special Edition

[Play now at boardgamers.space](https://boardgamers.space/boardgame/puerto-rico)

Implementation for Boardgamers Space, targeting **Puerto Rico 1897: Special Edition** and the official June 2026 errata. Version 1 is published as a **private beta** on [BGS](https://boardgamers.space/boardgame/puerto-rico), with Unlisted disabled. The engine package is `@boardgamers/puerto-rico@0.3.0`. The viewer follows the global BGS language preference.

```sh
pnpm install
pnpm dev
# http://127.0.0.1:5251/?locale=fr
```

The local preview lets you play one seat with two ordinary bots. For the rules-based solo opponent, open `http://127.0.0.1:5251/?mode=puertoma&locale=fr` (optionally `&difficulty=easy` or `&difficulty=hard`). Solo begins by choosing four of six Achievement cards; its save is separate from the ordinary preview, whose existing session is preserved.

Automatic forced moves are off by default. Each player can opt in with “Automatically play forced moves” in the BGS sidebar game settings. Bots still play automatically.

Building selection is automatic by default. Enable “Choose buildings” when creating a BGS game to select the market in turn. In the local preview, use `?chooseBuildings=true&locale=fr` to try the interactive setup. Local progress is saved in the browser. The small local toolbar offers undo, opponent turns, restart and light/dark; it is absent from the hosted viewer.

## Edition configuration

`release-config.js` defines one fixed Special Edition configuration. `bgs/engine.js` uses it regardless of creation-form expansion fields; the BGS metadata intentionally exposes **no expansion picker**. The core engine in `engine/index.js` accepts independent expansion switches for future configuration, simulation and tests.

Implemented modules:

- Base game, 2–5 players, including the classic two-player rules.
- New Buildings: all 14 building types and cost-constrained shared market selection.
- Citizens: 20 citizens, 8 building types, occupancy-dependent effects and scoring.
- Smuggler: all four actions, role capture, surplus worker/citizen choices.
- Festival: three shared objectives and physical resource reservations.
- Festival Activities: all 12 activity definitions, three drawn per game.
- Achievements: the complete 30-card deck, secret dealing, optional internal draft, automatic completion and endgame scoring.
- Puertoma: exact eight-card tiebreaker deck, shared action tracker, permanent workers, estate production, building levels and reservations, all 12 ability types, three difficulty levels and expansion interactions. Available by choosing 1 player on BGS, through local solo preview, or internal `options.puertoma = { humans: 1, difficulty: "normal" }` with three total seats.

The fixed multiplayer BGS configuration includes all six expansion modules. Choose **1 player** on BGS to start a solo game against **two automatic Puertomas** at normal difficulty. Their turns resolve automatically on the server; the platform tracks only the human participant, while the viewer and replay show all three boards and final scores. Hosted multiplayer bot seats continue to use the human rules. See [source notes](docs/sources.md) for provenance and the Festival unique-building marker interpretation.

The engine accepts the optional `costSwap`, `alternativeStart`, `tailorLimit`, `pairingRestrictions` and `achievementDraft` balance variants internally. They are disabled in the fixed configuration and not exposed in the UI.

## Viewer and integration

- All 16 BGS locales: English, German, French, Polish, Romanian, Greek, Hindi, Russian, Danish, Brazilian Portuguese, Korean, Traditional Chinese, Vietnamese, Italian, Dutch and Persian (RTL). Catalogs were translated directly, without translation APIs; coverage tests check every key and placeholder.
- Distinct goods pictograms; color is supplementary.
- Paper, terracotta and sea-green visual theme in light/dark modes; original vector town illustration, larger corn and a repeat-privilege pictogram.
- Editable worker allocation, goods storage, building payment choices, private shipping, Achievement selection and final scoring.
- Contextual role warnings explain unavailable actions before committing a choice, including role coins and building rewards. They remain advisory; legal strategic choices are preserved.
- Desktop and mobile layout, incremental DOM updates, native page and modal scrolling.
- BGS chat, full replay and postgame analysis; optional visible VP totals, server-only randomness and future draws.
- Platform avatars, seat colors, supporter badges and distinct player symbols in colorblind mode. Theme changes preserve player identity.
- Mobile Festival and production details start collapsed, with production totals still visible. Current actions stay in the bottom dock; dialogs, disabled controls and the journal support native touch scrolling.
- Deterministic ordinary bots for local testing and BGS bot seats.

## Validation

```sh
pnpm test           # rule scenarios, legal complete games, resource conservation, replay
pnpm build          # dist/engine.js, dist/viewer.js, local sandbox
pnpm test:browser   # 320/390/768/1440px, real viewer events, chat/journal scrolling
```

This private version still needs broader playtesting. The Festival marker interpretation is noted above. Original vector UI artwork is in `viewer/icons.js`; reference scans in `.local/` are ignored and never bundled.

## Private BGS publication

`pnpm publish:private` builds the bundles, packages only the self-contained engine and its manifest, checks complete 1–5-player games from the extracted package, and uploads the engine/viewer to BGS. The script reads the admin token from `~/.bgs` without logging it, preserves the existing game/request identity, refuses to replace a public version, and verifies the private/listed flags and CDN bytes. It grants beta access to `coyotte508` if needed. Metadata snapshots and package artifacts stay in ignored `.local/release/`.

The hosted bundle has no local preview controls or runtime asset dependencies. Global BGS locale and color-blind preferences are handled by the viewer; expansion switches remain internal. Tutorials are not yet registered.

Enable “Show everyone’s VP” at game creation to reveal accumulated VP tokens to all players and spectators. It is off by default; uncompleted Achievement cards remain private. For a separate local preview with visible VP, add `&showVP=true` to the URL.

## Replay, journal and platform compatibility

The journal retains the latest 200 events. Older score contributions are accumulated by player and source, so the score breakdown remains accurate. Replay keeps the actual accepted move sequence. Undo restores its previous branch instead of appending undo events; regression tests repeatedly undo and replay the same action to check that state size does not accumulate. Replay frames are private to the requesting seat, and postgame analysis disables forced-move automation so each branch can be explored explicitly. Analysis is unavailable during live games to protect hidden objectives and future draws.

Chat opens from the button next to the journal. On a host/SDK exposing `openChat` and advertising `platformChat`, it opens the native BGS chat. Protocol 0.9 hosts retain the functional SDK chat dialog. Native chat requires the corresponding platform PR and a protocol package upgrade; no unsupported messages are sent to older hosts.

The publisher sets **Puerto Rico** as the title and **1897 Special Edition** as the subtitle, uploads the original tightly cropped vector pictogram, and selects it as the BGS icon. It uploads hand-written metadata and setup-label translations through the manual translation endpoint. If an older host returns 404 for that endpoint, the game upload completes and the script explicitly reports `translationsPending`; the overlays remain ready in `.local/release/manual-translations.json`. Run the publisher again after the platform endpoint is deployed to apply them. It never calls automatic translation endpoints.
