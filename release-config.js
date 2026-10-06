// Game creation uses this fixed edition. Expansion switches are engine configuration,
// intentionally not exposed in the published viewer or the BGS game creation form.
export const MODULES = {
  "new-buildings": true,
  citizens: true,
  smuggler: true,
  festival: true,
  "festival-cards": true,
  achievements: true,
};
export const RELEASE = {
  name: "Puerto Rico: Special Edition",
  expansions: Object.keys(MODULES).filter((id) => MODULES[id]),
  options: { autoForcedActions: true },
};
