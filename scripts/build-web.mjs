import { build } from "vite";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { isPublicShellRequest } from "./shell-cache-policy.mjs";
await build({ root: "apps/web", configFile: "apps/web/vite.config.mjs" });
const dist = path.resolve("apps/web/dist");
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error("Symlink in shell build");
    return entry.isDirectory() ? files(target) : [target];
  });
}
const built = files(dist).sort();
const assets = built.map(
  (file) => "/" + path.relative(dist, file).replaceAll("\\", "/"),
);
if (
  assets.some(
    (url) =>
      !/^\/(assets\/[^/]+\.(js|css)|index\.html|manifest\.webmanifest|icon\.svg|icon-(192|512)\.png)$/.test(
        url,
      ),
  )
) {
  throw new Error("Non-public file in shell build");
}
const hash = createHash("sha256");
for (const file of built)
  hash.update(path.relative(dist, file)).update(fs.readFileSync(file));
const cache = "dental-lab-shell-" + hash.digest("hex").slice(0, 16);
const worker = `const ASSETS = ${JSON.stringify(assets)};
const CACHE = ${JSON.stringify(cache)};
const isPublicShellRequest = ${isPublicShellRequest.toString()};
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, {credentials:"omit", cache:"reload"})))));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith("dental-lab-shell-") && name !== CACHE).map((name) => caches.delete(name)))));
});
self.addEventListener("fetch", (event) => {
  if (!isPublicShellRequest(event.request.url, event.request.method, self.location.origin, ASSETS)) return;
  const pathname = new URL(event.request.url).pathname;
  const target = pathname === "/" ? "/index.html" : pathname;
  event.respondWith(caches.open(CACHE).then((cache) => cache.match(target)).then((response) => response || fetch(event.request)));
});
`;
fs.writeFileSync(path.join(dist, "sw.js"), worker);
fs.writeFileSync(
  path.join(dist, "shell-assets.json"),
  JSON.stringify({ cache, assets }, null, 2) + "\n",
);
console.log(
  "Public shell built; no API/media caching:",
  assets.length,
  "assets",
);
