# Platform badges (manifest revision 1)

`bgs/achievements.js` exports the optional protocol 0.11.0 hooks through
`bgs/engine.js`. These are account badges, **not** additions to the physical
Achievement deck in `engine/achievements.js`. Stable hyphenated IDs must not be
repurposed. Default platform artwork is used: no durable uploaded asset keys
have been verified, and no production upload is part of this change.

## Objective semantics

See `docs/sources.md` for the edition, June 2026 errata, deck transcription and
Festival reservation caveat. No game rules or objective requirements change.

- **Festival sweep** requires every objective in the nonempty active global
  `s.festivals` array to have `claimed === seat`. Festival objectives are
  first-claim-only: collectively clearing the table is not a personal sweep.
  Either `festival` or `festival-cards` must be enabled. Seat zero is valid.
- **Personal perfection** requires every card in the player's nonempty active
  `achievements` array to have `completed === true`, with `achievements` enabled.
  This means the dealt/chosen set (normally four), not all 30 physical cards.
  Completion is latched; final inventory need not still satisfy the card.
- Partial-completion badges use those same sets and variant guards.

Authoritative implementation: `setupFestival`, `completedFestivals`,
`checkFestival`, `setupAchievements`, `selectAchievement`, and
`checkAchievements` in `engine/index.js`; card predicates in
`engine/achievements.js`. No historical event requirement is reconstructed from
final inventories.

## Curated manifest

| ID | Requirement at a completed game |
| --- | --- |
| island-victory | Outright multiplayer win |
| puertoma-normal | Outright hosted solo win on normal |
| all-festival-objectives | Personally claim all active Festival objectives |
| all-personal-achievements | Complete all owned personal cards |
| festival-claim | Claim at least one Festival |
| personal-achievement | Complete at least one owned card |
| fifty-points | Final total at least 50 |
| seventy-points | Final total at least 70 |
| full-city | Exactly 12 built city spaces |
| full-island | Exactly 12 countryside tiles |
| expanded-city | At least two two-space buildings, occupancy not required |
| five-crop-estates | Own an estate of each of the five crops |
| twenty-coins | At least 20 coins remaining |
| six-core-roles | Choose Planter, Recruiter, Builder, Craftsman, Trader, Captain |

All non-victory feats are independent of outcome. Roles are read from committed
move history (not the bounded journal). City space sizes and crops come from the
catalog. Scores use `scoreBreakdown`, including personal-card/Puertoma bonuses.

## Outcomes, eligibility and purity

Require `finished === true`, no pending tasks, and a natural `points`, `workers`
or `city` end reason. Triggering the end condition before the round finishes is
not enough. Tutorials, analysis, and explicit practice/cancellation markers are
excluded. `createAnalysis` now marks its fork, and `replay` preserves that marker.
Live replay remains eligible; querying either hook never mutates state or RNG.
Older unmarked analysis saves cannot be distinguished from real games. Only the
engine-owned analysis marker is newly preserved by replay; ad hoc practice or
cancellation flags are defensive direct-state guards, not persisted platform
eligibility records. The platform must enforce those restrictions on replays too.

BGS owns account eligibility, cancellations, practice metadata and bot/drop
filtering not represented in engine state; no invented account-service lookup
is made here. `dropPlayer` only marks a replacement bot. Multiplayer bot seats
use normal human rules, not Puertoma rules.

Outcomes compare all players' final total, then coins plus crates. Shared best
results are draws, not outright-win badges. Hosted solo returns **only seat 0**,
but explicitly compares against both virtual Puertomas. Hosted creation currently
fixes **normal** difficulty. The 14-badge MVP therefore includes only the normal
solo victory badge. Easy/hard are supported by the core engine but absent from
the manifest because hosted creation does not expose them. Adding a new setup
option is outside this badge change; no picker has been added. Ordinary
multiplayer never earns a solo badge.

Tests: `test/platform-achievements.test.js` plays real completed multiplayer and
hosted solo games, validates official runtime schemas, checks deterministic
replay/purity, and uses cloned final fixtures for all-vs-missing-one, empty and
disabled sets, finality/analysis, solo win/loss/draw, and numeric/role boundaries.
