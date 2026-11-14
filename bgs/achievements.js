// Platform badges, deliberately separate from the physical Achievement cards.
import { scoreBreakdown } from "../engine/index.js";
import { BUILDINGS, GOODS, ROLES } from "../engine/catalog.js";

/** @type {import('@boardgamers/protocol/engine').AchievementManifest} */
const manifest = {
  revision: 2,
  achievements: [
    ["island-victory", "Island victory", "Win a multiplayer game outright."],
    [
      "puertoma-normal",
      "Puertoma: normal",
      "Win outright against both Puertomas on normal difficulty.",
    ],
    [
      "all-festival-objectives",
      "Festival sweep",
      "Finish having personally claimed every active Festival objective (at least one).",
    ],
    [
      "all-personal-achievements",
      "Personal perfection",
      "Finish with every card in your active personal Achievement set completed (at least one).",
    ],
    [
      "festival-claim",
      "Festival participant",
      "Finish having claimed at least one Festival objective.",
    ],
    [
      "personal-achievement",
      "Personal milestone",
      "Finish with at least one completed personal Achievement card.",
    ],
    ["fifty-points", "Fifty points", "Finish with at least 50 total points."],
    [
      "seventy-points",
      "Seventy points",
      "Finish with at least 70 total points.",
    ],
    ["full-city", "Full city", "Finish with all 12 city spaces built."],
    [
      "full-island",
      "Full island",
      "Finish with all 12 island spaces occupied.",
    ],
    [
      "expanded-city",
      "Expanded city",
      "Finish with at least two expanded (two-space) buildings.",
    ],
    [
      "five-crop-estates",
      "Five-crop estates",
      "Finish owning an estate for each of the five crops.",
    ],
    ["twenty-coins", "Treasury", "Finish with at least 20 coins."],
    [
      "six-core-roles",
      "Versatile governor",
      "Choose each of the six core roles at least once in a completed game.",
    ],
  ].map(([id, name, description]) => ({
    id,
    name,
    description,
    icon: { type: "asset", key: `achievement-${id}` },
  })),
};

/** @returns {import('@boardgamers/protocol/engine').AchievementManifest} */
export function achievementDefinitions() {
  return structuredClone(manifest);
}

/** @returns {import('@boardgamers/protocol/engine').SeatAchievements[]} */
export function achievements(s) {
  // Cancellation/practice eligibility also belongs to the platform: its metadata
  // is not passed to this hook. Tutorial and analysis are engine-owned markers.
  if (
    !s ||
    s.finished !== true ||
    s.tutorial ||
    s.analysis ||
    s.practice ||
    s.cancelled ||
    s.canceled ||
    !["points", "workers", "city"].includes(s.endReason) ||
    !Array.isArray(s.tasks) ||
    s.tasks.length ||
    !Array.isArray(s.players) ||
    s.players.length < 2 ||
    !Array.isArray(s.expansions)
  )
    return [];
  const totals = s.players.map((_, seat) => scoreBreakdown(s, seat));
  if (totals.some((v) => !Number.isFinite(v.total) || !Number.isFinite(v.tie)))
    return [];
  const solo = s.options?.hostedSolo === true;
  if (
    solo &&
    (!s.puertoma ||
      s.players.length !== 3 ||
      s.players[0].puertoma ||
      !s.players.slice(1).every((p) => p.puertoma))
  )
    return [];
  const festival = s.expansions.some((x) =>
    ["festival", "festival-cards"].includes(x),
  );
  return s.players.flatMap((a, seat) => {
    if (solo && seat !== 0) return [];
    const value = totals[seat];
    const better = totals.some(
      (v) =>
        v.total > value.total || (v.total === value.total && v.tie > value.tie),
    );
    const tied = totals.some(
      (v, i) => i !== seat && v.total === value.total && v.tie === value.tie,
    );
    const outcome = better ? "loss" : tied ? "draw" : "win";
    const earned = [];
    const award = (id, condition) => {
      if (condition) earned.push(id);
    };
    award("island-victory", !s.puertoma && outcome === "win");
    award(
      "puertoma-normal",
      solo && s.puertoma.difficulty === "normal" && outcome === "win",
    );
    const festivals = festival ? (s.festivals ?? []) : [];
    const cards = s.expansions.includes("achievements")
      ? (a.achievements ?? [])
      : [];
    award(
      "all-festival-objectives",
      festivals.length > 0 && festivals.every((f) => f.claimed === seat),
    );
    award(
      "all-personal-achievements",
      cards.length > 0 && cards.every((c) => c.completed === true),
    );
    award(
      "festival-claim",
      festivals.some((f) => f.claimed === seat),
    );
    award(
      "personal-achievement",
      cards.some((c) => c.completed === true),
    );
    award("fifty-points", value.total >= 50);
    award("seventy-points", value.total >= 70);
    award(
      "full-city",
      a.buildings.reduce((n, b) => n + BUILDINGS[b.id].size, 0) === 12,
    );
    award("full-island", a.estates.length === 12);
    award(
      "expanded-city",
      a.buildings.filter((b) => BUILDINGS[b.id].size === 2).length >= 2,
    );
    award(
      "five-crop-estates",
      GOODS.every((g) => a.estates.some((e) => e.id === g)),
    );
    award("twenty-coins", a.coins >= 20);
    const roles = new Set(
      (s.history ?? [])
        .filter((h) => h.p === seat && h.move.type === "role")
        .map((h) => h.move.id),
    );
    award(
      "six-core-roles",
      ROLES.every((r) => roles.has(r)),
    );
    return [{ seat, earned, outcome }];
  });
}

/** @type {Pick<import('@boardgamers/protocol/engine').Engine, 'achievementDefinitions' | 'achievements'>} */
export const achievementHooks = { achievementDefinitions, achievements };
