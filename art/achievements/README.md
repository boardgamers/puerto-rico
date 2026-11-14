# Puerto Rico platform achievement artwork

Original geometry by the Boardgamers achievement-art contribution, dedicated to the public domain under **CC0-1.0** (https://creativecommons.org/publicdomain/zero/1.0/). This dedication covers the generator's artwork and exported SVG/PNG images. No publisher illustrations, photographs, logos, traced components, or third-party icon packs were used. The SVG files are editable vector originals; `scripts/achievement-art.py` is their reproducible source. Text uses system DejaVu Sans Bold (DejaVu font license); the font is not redistributed here.

Semantic authority: `bgs/achievements.js` at canonical baseline `bcf8c98a26412cacaf8ce973bbe4fd3b398f4e0a` (engine 0.3.19, manifest 1), plus the five goods and six roles in `engine/catalog.js`. These are platform badges, **not** the physical cards in `engine/achievements.js`. Coordination issue: https://codeberg.org/boardgamers/boardgamers/issues/595.

## Visual vocabulary

- Warm sand, terracotta roofs, green estate plots, teal sea and cream components; dark outlines remain visible on light and dark grounds.
- Island victory has developed shoreline, harbor boat and victory flag. Puertoma normal has one human governor facing **two** separate role-card fans, with a victory flag.
- Festival claim shows a hand placing a claim token on a pennant tile; its sweep shows a closed all-set bracket, festival garland and checked **ALL** ledger. Personal milestone has one completed card; personal perfection uses the conventional layered-card-set silhouette with a whole-set **ALL** seal. Layer edges and garland are abstract set decoration, not counts of active objectives or a fixed deck size.
- 50 and 70 use scoring ledgers and VP stars, with expanded open-ledger / ascending-token geometry at 70. No victory claim.
- Full city shows twelve occupied urban spaces (4 × 3); full island shows twelve occupied estate spaces, including an explicit gray quarry in the bottom-right. It is not an all-crops condition.
- Expanded city shows exactly two broad two-space buildings, each with a central footprint division. Five-crop estates has corn, fruit, sugar cane, tobacco leaf and coffee bean in five separate plots.
- Treasury has coins retained in an open chest and supporting 20 label (decorative coin silhouettes are not a count requirement).
- Six-core-roles runs clockwise from the top: planter (crop), recruiter (person), builder (hammer), craftsman (produced crate), trader (exchange), captain (anchor), around the governor's selection marker. No seventh smuggler role.

## Reproduction and checks

Use Python 3 with `CairoSVG==2.8.2`, `Pillow==11.3.0`, system Cairo and DejaVu Sans. Run from any directory:

```sh
python scripts/achievement-art.py
pnpm test
pnpm build
node --input-type=module -e "import {packageEngine} from './scripts/package-engine.mjs'; await packageEngine()"
node scripts/test-achievement-package.mjs .local/release/boardgamers-puerto-rico-0.3.20.tgz
```

`manifest.json` records exact stable asset keys, original-source SHA-256, SVG hashes and 256×256 PNG hashes. Exports have transparent corners. `contact-light.png` and `contact-dark.png` show each design at 144px and circular-masked **32/48/64px**. Cairo/font environment differences can alter raster hashes; a second run in the recorded authoring environment produced identical hashes for every export and both contact sheets. Tests pin the evaluator bytes to the baseline and check all 14 IDs, schema, references, image headers, source hashes and unique images. Packed-hook checks execute completed 1–5-participant games and verify replay, source parity and protocol schemas against the extracted retained tarball.

This is a review candidate, **not a publication receipt**. No asset upload, engine POST, activation or remote push was performed. Engine POST activates immediately. Independent visual and code approval plus verification of every uploaded public asset must precede it. The existing later publisher is `scripts/publish-release.mjs` with `BGS_ENGINE_ONLY=1`; it repacks, so its resulting upload bytes must be confirmed against the approved tested tarball hash before activation. Preserve public game version 1, viewer, settings, locales and visibility. Canonical target: Codeberg `boardgamers/puerto-rico` main (`origin`); required mirror: GitHub `boardgamers/puerto-rico` main (`github`).
