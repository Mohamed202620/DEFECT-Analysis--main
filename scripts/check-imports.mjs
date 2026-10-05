// يتحقق إن كل named import في وحدات ES المحلية له export فعلي في الملف المستورد منه،
// وإن كل مسار محلي موجود. بيمسك أخطاء "ملف/تصدير ناقص" قبل ما تطلع شاشة بيضاء في المتصفح.
// التشغيل: node --expose-internals scripts/check-imports.mjs
import fs from "fs";
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const acorn = require("internal/deps/acorn/acorn/dist/acorn");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", "functions", "tests"].includes(e.name)) continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, out); else if (e.name.endsWith(".js")) out.push(f);
  }
  return out;
}
const cache = new Map();
function parse(file) {
  if (cache.has(file)) return cache.get(file);
  const src = fs.readFileSync(file, "utf8");
  const ast = acorn.parse(src, { ecmaVersion: "latest", sourceType: "module", allowHashBang: true });
  const exports = new Set(); let star = [];
  for (const n of ast.body) {
    if (n.type === "ExportNamedDeclaration") {
      if (n.declaration) {
        if (n.declaration.declarations) n.declaration.declarations.forEach(d => { if (d.id.name) exports.add(d.id.name); });
        else if (n.declaration.id) exports.add(n.declaration.id.name);
      }
      (n.specifiers || []).forEach(s => exports.add(s.exported.name));
    } else if (n.type === "ExportDefaultDeclaration") exports.add("default");
    else if (n.type === "ExportAllDeclaration") star.push(n.source.value);
  }
  const info = { ast, exports, star, file };
  cache.set(file, info);
  return info;
}
function resolveExports(file, seen = new Set()) {
  if (seen.has(file)) return new Set(); seen.add(file);
  const info = parse(file); const all = new Set(info.exports);
  for (const s of info.star) {
    const t = path.resolve(path.dirname(file), s);
    if (fs.existsSync(t)) resolveExports(t, seen).forEach(x => all.add(x));
  }
  return all;
}
let errors = 0, checked = 0;
for (const file of walk(root)) {
  let info; try { info = parse(file); } catch (e) { console.log("PARSE", path.relative(root, file), e.message); errors++; continue; }
  const dynamicTargets = [];
  (function visit(n) {
    if (!n || typeof n.type !== "string") return;
    if (n.type === "ImportExpression" && n.source.type === "Literal") dynamicTargets.push(n.source.value);
    for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(visit); else if (v && typeof v.type === "string") visit(v); }
  })(info.ast);
  for (const spec of dynamicTargets) {
    if (!spec.startsWith(".")) continue;
    if (!fs.existsSync(path.resolve(path.dirname(file), spec))) { console.log(`MISSING dynamic import ${spec} in ${path.relative(root, file)}`); errors++; }
  }
  for (const n of info.ast.body) {
    if (n.type !== "ImportDeclaration" && !(n.type === "ExportNamedDeclaration" && n.source)) continue;
    const spec = n.source?.value; if (!spec || !spec.startsWith(".")) continue;
    const target = path.resolve(path.dirname(file), spec);
    if (!fs.existsSync(target)) { console.log(`MISSING FILE ${spec} imported from ${path.relative(root, file)}`); errors++; continue; }
    const ex = resolveExports(target);
    const names = n.type === "ImportDeclaration" ? n.specifiers.filter(s => s.type === "ImportSpecifier").map(s => s.imported.name)
                                                 : n.specifiers.map(s => s.local.name);
    for (const name of names) {
      checked++;
      if (!ex.has(name)) { console.log(`MISSING EXPORT '${name}' from ${spec} (in ${path.relative(root, file)})`); errors++; }
    }
  }
}
console.log(`فُحص ${checked} import مسمّى - أخطاء: ${errors}`);
process.exit(errors ? 1 : 0);
