import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("dist", { recursive: true });
const common = {
  bundle: true,
  minify: true,
  target: ["chrome109", "firefox115", "safari15.4"],
  loader: { ".css": "text" },
};
await Promise.all([
  build({
    ...common,
    entryPoints: ["viewer/index.js"],
    outfile: "dist/viewer.js",
    format: "iife",
  }),
  build({
    ...common,
    entryPoints: ["viewer/preview.js"],
    outfile: "dist/preview.js",
    format: "esm",
  }),
  build({
    ...common,
    entryPoints: ["bgs/engine.js"],
    outfile: "dist/engine.js",
    platform: "node",
    format: "esm",
    target: "node20",
  }),
]);
await writeFile(
  "dist/index.html",
  `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#254c4e"><title>Puerto Rico · Preview</title><style>body{margin:0}button,input{font:inherit}</style></head><body><main id="game"></main><script type="module" src="/preview.js"></script></body></html>`,
);
await writeFile(
  "dist/tutorial.html",
  `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Puerto Rico · Learn to play</title><style>body{margin:0}</style></head><body><main id="game"></main><script src="/viewer.js"></script><script>
const params = new URLSearchParams(location.search);
const chapters = ["basics","shipping","citizens","coffee"];
const chapter = params.get("chapter") || "basics";
const next = chapters[chapters.indexOf(chapter)+1];
puertorico.launchTutorial("#game", {chapter,locale:params.get("locale")||navigator.language,nextChapter:next?{title:next,open(){params.set("chapter",next);location.search=params.toString()}}:undefined});
</script></body></html>`,
);
console.log("Built engine, BGS viewer, local preview and tutorials.");
