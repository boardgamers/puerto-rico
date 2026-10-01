import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import "./build.mjs";
const root = resolve("dist"),
  port = Number(process.env.PORT ?? 5251);
createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      ),
      path = resolve(root, pathname === "/" ? "index.html" : pathname.slice(1));
    if (!path.startsWith(root + "/")) {
      res.writeHead(403).end();
      return;
    }
    const content = await readFile(path);
    res
      .writeHead(200, {
        "Content-Type":
          {
            ".js": "text/javascript",
            ".css": "text/css",
            ".html": "text/html",
          }[extname(path)] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      })
      .end(content);
  } catch {
    res.writeHead(404).end();
  }
}).listen(port, "127.0.0.1", () =>
  console.log(`Puerto Rico preview: http://127.0.0.1:${port}/?locale=fr`),
);
