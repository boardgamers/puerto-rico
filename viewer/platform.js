/** Host preferences arrive separately from theme changes. Preserve seat appearance. */
export function mergePreferences(previous, update) {
  return { ...previous, ...update };
}

/** Avatars and supporter badges are images supplied by the platform. */
export function imageUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  if (/^https?:\/\//i.test(value) || /^\/(?!\/)/.test(value)) return value;
  return "";
}

/** The same state/move bridge serves live games and host-managed analysis branches. */
export function viewerLifecycle(ctx, ui, chat) {
  let live,
    replaying = false,
    position = 1,
    playerIndex,
    pending,
    timer;
  const settle = (error) => {
    clearTimeout(timer);
    if (error) pending?.reject(error);
    else pending?.resolve();
    pending = undefined;
  };
  const info = () => {
    if (live)
      ctx.setReplayInfo({
        start: 1,
        current: position,
        end: Math.max(1, live.historyLength),
      });
  };
  const seek = (to) => {
    if (!live || !replaying) return;
    position = Math.max(1, Math.min(Math.max(1, live.historyLength), to));
    ctx.fetchLog({ start: position - 1, end: position - 1 });
    info();
  };
  return {
    move(m) {
      if (replaying || pending)
        return Promise.reject(Error("Move unavailable"));
      return new Promise((resolve, reject) => {
        pending = { resolve, reject, move: m, player: playerIndex };
        timer = setTimeout(() => {
          settle(Error("No confirmation received. Please try again."));
          ctx.fetchState();
        }, 15000);
        if (ctx.move(m) === false) settle(Error("Move rejected"));
      });
    },
    chat,
    onState(s) {
      live = s;
      const awaitingPlacement =
        pending &&
        ((pending.move.type === "assign" &&
          s.tasks.some((t) => t.kind === "assign" && t.p === pending.player)) ||
          (pending.move.type === "orderedPlacement" && !s.placementOrdered));
      if (!replaying) {
        position = Math.max(1, s.historyLength);
        ui.render(s, !!awaitingPlacement);
      } else {
        // An undo or branch replacement may shorten the host history.
        if (position > s.historyLength) seek(s.historyLength);
        info();
      }
      if (!awaitingPlacement) settle();
    },
    onThumbnail: () => ui.thumbnail(),
    onPlayer: (p) => {
      playerIndex = p.index;
      ui.setPlayer(p.index);
    },
    onAvatars: (avatars) => ui.setAvatars(avatars),
    onPreferences: (p) => ui.setPreferences(p),
    onTheme: (p) => ui.setPreferences(p),
    onError: (error) => settle(Error(String(error))),
    onMoveResult(result) {
      // An acknowledgement can precede the authoritative state update.
      if (result.ok) {
        if (pending) ctx.fetchState();
      } else {
        settle(Error(result.error || "Move rejected"));
        ctx.fetchState();
      }
    },
    onReplayStart() {
      replaying = true;
      ui.setEnabled(false);
      info();
    },
    onReplayTo: seek,
    onReplayEnd() {
      replaying = false;
      position = Math.max(1, live?.historyLength ?? 1);
      ui.setEnabled(true);
      if (live) ui.render(live);
    },
    onLog(log) {
      // Late responses for a previous seek must not replace the current frame.
      if (replaying && log.start === position - 1 && log.data?.frames?.[0])
        ui.render(log.data.frames[0]);
      else if (!replaying) ctx.fetchState();
    },
    destroy() {
      settle(Error("Viewer closed"));
      ui.destroy();
    },
  };
}
