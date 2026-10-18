import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
export async function publishGallery(token) {
  const base = "https://admin.boardgamers.space/api/admin/gameinfo/puerto-rico";
  const headers = { Authorization: `Bearer ${token}` };
  const gallery = [];
  for (const [name, caption] of [
    ["board", "Develop your island and choose roles"],
    ["buildings", "Plan your city in the building market"],
    ["mobile", "Play on mobile"],
  ]) {
    const asset = `screenshot-release-${name}`;
    const response = await fetch(`${base}/assets/${asset}`, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "image/png" },
      body: await readFile(`.local/release/gallery/${name}.png`),
    });
    if (!response.ok) throw Error(`Screenshot ${name}: ${response.status}`);
    gallery.push({ asset, caption });
  }
  const response = await fetch(`${base}/gallery`, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ gallery }),
  });
  if (!response.ok) throw Error(`Gallery save: ${response.status}`);
  const saved = await (await fetch(`${base}/1`, { headers })).json();
  assert.deepEqual(saved.gallery, gallery);
  for (const { asset } of gallery)
    assert(
      (await fetch(saved.assets[asset].url)).ok,
      `Public screenshot ${asset}`,
    );
  return gallery;
}

// Also usable independently after generating the release gallery.
if (
  process.argv[1] &&
  import.meta.url ===
    (await import("node:url")).pathToFileURL(process.argv[1]).href
) {
  const { homedir } = await import("node:os");
  const token = (await readFile(`${homedir()}/.bgs`, "utf8")).trim();
  console.log(JSON.stringify(await publishGallery(token)));
}
