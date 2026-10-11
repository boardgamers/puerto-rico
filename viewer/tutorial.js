import { FORCE_DARK_THEME } from "./theme.js";
import { createTutorial } from "@boardgamers/protocol/tutorial";
import { stripSecret } from "../engine/index.js";
import { tutorialOptions } from "../tutorial/scenarios.js";
import { tutorialTranslator } from "../tutorial/i18n.js";
import { mountGame } from "./ui.js";
import { translator } from "./i18n.js";
import guideCss from "./tutorial.css";

export async function mountTutorial(
  target,
  { chapter, locale = "en", onProgress, nextChapter },
) {
  const t = tutorialTranslator(locale);
  let storage;
  try {
    storage = window.localStorage;
  } catch {
    /* Lessons also work without persistence. */
  }
  const controller = await createTutorial({
    ...tutorialOptions(chapter, t),
    storage,
    onProgress,
  });
  const root = document.createElement("div");
  root.className = "pr-tutorial";
  root.lang = t.locale;
  root.dir = t.locale === "fa" ? "rtl" : "ltr";
  const style = document.createElement("style");
  style.textContent = guideCss;
  const guide = document.createElement("details");
  guide.className = "pr-tutorial-guide";
  guide.open = true;
  const heading = document.createElement("summary");
  const progress = document.createElement("span");
  progress.className = "tutorial-progress";
  const title = document.createElement("strong");
  title.setAttribute("aria-live", "polite");
  heading.append(progress, title);
  const body = document.createElement("div");
  body.className = "tutorial-guide-body";
  const text = document.createElement("p");
  const feedback = document.createElement("p");
  feedback.className = "tutorial-feedback";
  feedback.setAttribute("role", "status");
  const error = document.createElement("p");
  error.className = "tutorial-error";
  error.setAttribute("role", "alert");
  const hint = document.createElement("details");
  const hintTitle = document.createElement("summary");
  hintTitle.textContent = t("tutorial.guide.hint");
  const hintText = document.createElement("p");
  hint.append(hintTitle, hintText);
  const controls = document.createElement("div");
  controls.className = "tutorial-controls";
  function button(id, glyph, action) {
    const node = document.createElement("button");
    node.type = "button";
    node.dataset.tutorialControl = id;
    node.title = node.ariaLabel = t(`tutorial.guide.${id}`);
    node.textContent = glyph ?? t(`tutorial.guide.${id}`);
    node.addEventListener("click", action);
    controls.append(node);
    return node;
  }
  const previous = button("previous", "‹", () => controller.previousStep());
  const retry = button("retry", "↻", () => controller.restartStep());
  const restart = button("restart", "↤", () => controller.restart());
  const showArea = button("showArea", "◎", () => {
    const area = targetArea(controller.snapshot.target);
    if (!area) return;
    // Open only the relevant native disclosure before scrolling; no nested scroller.
    for (let node = area; node && node !== game; node = node.parentElement) {
      if (node instanceof HTMLDetailsElement) node.open = true;
    }
    area.classList.add("tutorial-highlight");
    const rect = area.getBoundingClientRect();
    window.scrollBy({
      top: rect.top - guide.getBoundingClientRect().height - 12,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  });
  const advance = button("continue", null, () => controller.continue());
  advance.className = "tutorial-primary";
  const next = button("next", null, () => nextChapter?.open());
  next.className = "tutorial-primary";
  const saving = document.createElement("small");
  saving.className = "tutorial-saving";
  body.append(text, feedback, error, hint, controls, saving);
  guide.append(heading, body);
  const game = document.createElement("div");
  game.className = "tutorial-game";
  root.append(style, guide, game);
  target.append(root);
  const ui = mountGame(game, { onMove: (move) => controller.play(move) });
  const theme = matchMedia("(prefers-color-scheme: dark)");
  function updateTheme() {
    root.classList.toggle("dark", FORCE_DARK_THEME || theme.matches);
    ui.setPreferences({ locale: t.locale, dark: theme.matches });
  }
  updateTheme();
  theme.addEventListener("change", updateTheme);
  ui.setPlayer(0);
  const targets = {
    roles: ".roles",
    actions: ".action-dock",
    plantations: ".player-board .estates",
    city: ".player-board .city-grid",
    harbor: ".port",
    festival: ".festival-section",
    production: ".production-overview",
    players: ".player-strip",
  };
  function targetArea(name) {
    return targets[name] ? game.querySelector(targets[name]) : null;
  }
  let lastStep = -1,
    nextVisible = false;
  function navigation() {
    const visible =
      !!nextChapter && controller.snapshot.completed && guide.open;
    next.hidden = !visible;
    if (visible !== nextVisible) nextChapter?.onVisibilityChange?.(visible);
    nextVisible = visible;
  }
  guide.addEventListener("toggle", navigation);
  const unsubscribe = controller.subscribe((snapshot) => {
    ui.setEnabled(
      !snapshot.canContinue && !snapshot.completed && !snapshot.busy,
    );
    const visibleState = stripSecret(snapshot.state, 0);
    visibleState.players[0].name = translator(t.locale)("you");
    ui.render(visibleState);
    game
      .querySelectorAll(".tutorial-highlight")
      .forEach((node) => node.classList.remove("tutorial-highlight"));
    const area = targetArea(snapshot.target);
    area?.classList.add("tutorial-highlight");
    title.textContent = snapshot.title;
    progress.textContent = snapshot.completed
      ? "✓"
      : `${snapshot.step + 1} / ${snapshot.total}`;
    progress.ariaLabel = snapshot.completed
      ? t("tutorial.guide.complete")
      : t("tutorial.guide.progress")
          .replace("{step}", snapshot.step + 1)
          .replace("{total}", snapshot.total);
    text.textContent = snapshot.text;
    feedback.textContent = snapshot.feedback;
    feedback.hidden = !snapshot.feedback;
    error.textContent = snapshot.error;
    error.hidden = !snapshot.error;
    hintText.textContent = snapshot.hint;
    hint.hidden = !snapshot.hint;
    advance.hidden = !snapshot.canContinue;
    for (const node of [previous, retry, restart, advance, next])
      node.disabled = snapshot.busy;
    previous.disabled ||= snapshot.step === 0;
    showArea.hidden = !area;
    saving.textContent = snapshot.saved ? "" : t("tutorial.guide.unsaved");
    saving.hidden = snapshot.saved;
    if (lastStep !== snapshot.step || snapshot.error) {
      guide.open = true;
      hint.open = false;
      if (lastStep !== -1 && guide.getBoundingClientRect().bottom < 0)
        guide.scrollIntoView({ block: "start" });
    }
    lastStep = snapshot.step;
    navigation();
  });
  return () => {
    unsubscribe();
    theme.removeEventListener("change", updateTheme);
    guide.removeEventListener("toggle", navigation);
    if (nextVisible) nextChapter?.onVisibilityChange?.(false);
    controller.destroy();
    ui.destroy();
    root.remove();
  };
}
