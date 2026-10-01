import {
  mkdir,
  readFile,
  writeFile,
  copyFile,
  mkdtemp,
  rm,
} from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

export async function packageEngine() {
  const { name, version, description } = JSON.parse(
    await readFile("package.json", "utf8"),
  );
  const out = resolve(".local/release");
  const staging = await mkdtemp(join(tmpdir(), "puerto-rico-engine-"));
  try {
    await mkdir(out, { recursive: true });
    await mkdir(join(staging, "dist"));
    await copyFile("dist/engine.js", join(staging, "dist/engine.js"));
    await writeFile(
      join(staging, "package.json"),
      JSON.stringify(
        {
          name,
          version,
          description,
          private: true,
          type: "module",
          files: ["dist/engine.js"],
          main: "dist/engine.js",
          engines: { node: ">=20" },
        },
        null,
        2,
      ),
    );
    const [packed] = JSON.parse(
      execFileSync("npm", ["pack", "--json", "--pack-destination", out], {
        cwd: staging,
        encoding: "utf8",
      }),
    );
    assert.deepEqual(packed.files.map((f) => f.path).sort(), [
      "dist/engine.js",
      "package.json",
    ]);
    const tarball = join(out, packed.filename);
    const unpacked = join(staging, "unpacked");
    await mkdir(unpacked);
    execFileSync("tar", ["-xzf", tarball, "-C", unpacked]);
    const engine = await import(
      pathToFileURL(join(unpacked, "package/dist/engine.js"))
    );
    for (const players of [2, 3, 4, 5]) {
      let state = engine.init(players, [], {}, `release-${players}`);
      assert.equal(state.expansions.length, 5);
      let moves = 0;
      while (!engine.ended(state) && moves++ < 6000)
        state = engine.moveAI(state);
      assert.ok(
        engine.ended(state),
        `Packed engine completes a ${players}-player game`,
      );
      assert.equal(engine.rankings(state).length, players);
    }
    console.log(
      `Packed ${name}@${version}: only bundled engine + manifest; 2–5-player games passed.`,
    );
    return { tarball, name, version };
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}
