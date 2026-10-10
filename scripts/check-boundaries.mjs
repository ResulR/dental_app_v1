import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
export function allowed(from, to) {
  const source = from.split("/"),
    target = to.split("/");
  if (source[0] === "packages" && source[1] === "contracts")
    return !(target[0] === "apps");
  if (source[0] === "apps" && target[0] === "apps" && source[1] !== target[1])
    return false;
  if (source[1] === "web" && target[1] === "web") {
    if (source[3] === "shared" && ["features", "app"].includes(target[3]))
      return false;
    if (source[3] === "features" && target[3] === "app") return false;
    if (
      source[3] === "features" &&
      target[3] === "features" &&
      source[4] !== target[4] &&
      path.basename(to) !== "index.ts"
    )
      return false;
  }
  if (source[1] === "api" && target[1] === "api") {
    if (source[3] === "modules" && target[3] === "app") return false;
    if (
      source[3] === "modules" &&
      target[3] === "modules" &&
      source[4] !== target[4] &&
      path.basename(to) !== "index.ts"
    )
      return false;
    const a = path.basename(from),
      b = path.basename(to);
    if (/repository|repositories/.test(a) && /route|controller/.test(b))
      return false;
    if (/route/.test(a) && /repository|repositories/.test(b)) return false;
  }
  return true;
}
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isSymbolicLink()) throw new Error("Source symlink forbidden: " + p);
    return e.isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });
}
export function check() {
  const files = [
    "apps/web/src",
    "apps/api/src",
    "packages/contracts/src",
  ].flatMap((p) => walk(path.join(root, p)));
  const edges = new Map();
  for (const file of files) {
    const from = path.relative(root, file).replaceAll("\\", "/"),
      dependencies = [];
    const ast = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const visit = (node) => {
      let spec;
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      )
        spec = node.moduleSpecifier.text;
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0])
      )
        spec = node.arguments[0].text;
      if (spec) {
        if (spec.startsWith("@dental-lab/") && spec !== "@dental-lab/contracts")
          throw new Error("Non-public workspace import: " + from);
        if (from.startsWith("packages/contracts/") && spec.startsWith("node:"))
          throw new Error("Private platform dependency in contracts");
        if (spec.startsWith(".")) {
          const base = path.resolve(path.dirname(file), spec);
          if (!base.startsWith(root + path.sep))
            throw new Error("Source import outside project: " + from);
          const candidates = [
            base.replace(/\.js$/, ".ts"),
            base.replace(/\.js$/, ".tsx"),
            base + ".ts",
            base + ".tsx",
            path.join(base, "index.ts"),
          ];
          const found = candidates.find(
            (p) => fs.existsSync(p) && fs.statSync(p).isFile(),
          );
          if (!found)
            throw new Error(
              "Unresolved source import: " + from + " -> " + spec,
            );
          const to = path.relative(root, found).replaceAll("\\", "/");
          if (to.startsWith("../") || !allowed(from, to))
            throw new Error("Boundary violation: " + from + " -> " + to);
          dependencies.push(to);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
    edges.set(from, dependencies);
  }
  const visiting = new Set(),
    done = new Set();
  function visit(file) {
    if (visiting.has(file)) throw new Error("Circular source import: " + file);
    if (done.has(file)) return;
    visiting.add(file);
    for (const target of edges.get(file) ?? []) visit(target);
    visiting.delete(file);
    done.add(file);
  }
  for (const file of edges.keys()) visit(file);
  console.log("Import boundaries and cycles OK (" + files.length + " sources)");
}
if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url))
  check();
