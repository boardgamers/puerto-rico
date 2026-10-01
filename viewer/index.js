import { registerViewer } from "@boardgamers/protocol/viewer";
import { ChatController } from "@boardgamers/protocol/chat";
import { mountGame } from "./ui.js";
registerViewer("puertorico", (ctx) => {
  const chat = new ChatController();
  let live,
    replaying = false,
    position = 1,
    pending,
    timer;
  const ui = mountGame(ctx.target, {
    chat,
    onOpenPlayer: ctx.openPlayer,
    onMove: (m) =>
      new Promise((resolve, reject) => {
        pending = { resolve, reject };
        timer = setTimeout(() => {
          pending = null;
          ctx.fetchState();
          reject(Error("No confirmation received. Please try again."));
        }, 15000);
        ctx.move(m);
      }),
  });
  const info = () => {
    if (live)
      ctx.setReplayInfo({
        start: 1,
        current: position,
        end: live.historyLength,
      });
  };
  const seek = (to) => {
    if (!live) return;
    position = Math.max(1, Math.min(live.historyLength, to));
    ctx.fetchLog({ start: position - 1, end: position - 1 });
    info();
  };
  return {
    chat,
    onState(s) {
      live = s;
      if (!replaying) {
        position = s.historyLength;
        ui.render(s);
      }
      if (pending) {
        clearTimeout(timer);
        pending.resolve();
        pending = null;
      }
    },
    onPlayer(p) {
      ui.setPlayer(p.index);
    },
    onPreferences: (p) => ui.setPreferences(p),
    onTheme: (p) => ui.setPreferences(p),
    onError(err) {
      clearTimeout(timer);
      pending?.reject(Error(String(err)));
      pending = null;
    },
    onMoveResult(result) {
      if (result.ok || !pending) return;
      clearTimeout(timer);
      pending.reject(Error(result.error || "Move rejected"));
      pending = null;
      ctx.fetchState();
    },
    onReplayStart() {
      replaying = true;
      ui.setEnabled(false);
      info();
    },
    onReplayTo: seek,
    onReplayEnd() {
      replaying = false;
      ui.setEnabled(true);
      if (live) ui.render(live);
    },
    onLog(log) {
      if (replaying && log.start === position - 1 && log.data?.frames?.[0])
        ui.render(log.data.frames[0]);
      else if (!replaying) ctx.fetchState();
    },
    destroy() {
      clearTimeout(timer);
      pending?.reject(Error("Viewer closed"));
      ui.destroy();
    },
  };
});
