import { mountTutorial } from "./tutorial.js";
import { registerViewer } from "@boardgamers/protocol/viewer";
import { ChatController } from "@boardgamers/protocol/chat";
import { mountGame } from "./ui.js";
import { viewerLifecycle } from "./platform.js";
registerViewer(
  "puertorico",
  (ctx) => {
    const chat = new ChatController();
    let lifecycle;
    const ui = mountGame(ctx.target, {
      chat,
      onOpenPlayer: ctx.openPlayer,
      onOpenChat: ctx.openChat,
      onMove: (move) => lifecycle.move(move),
    });
    lifecycle = viewerLifecycle(ctx, ui, chat);
    return lifecycle;
  },
  { tutorial: mountTutorial },
);
