// ============================================================
// scripts/build.mjs - خطوة Build الفعلية (كانت: echo "No build step").
//  1) فحص صياغة كل ملفات JS (node --check) - أي خطأ = فشل البناء
//  2) فحص مراجع index.html و manifest.json لملفات محلية موجودة فعلاً
//  3) في CI فقط (أو مع --stamp): استبدال __BUILD_ID__ في sw.js بـ commit SHA
//     عشان كل نشر يعمل كاش Service Worker جديد (بند M5)
// ============================================================
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const errors = [];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", "functions", "scripts"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".js") && !full.includes(`${path.sep}vendor${path.sep}`)) out.push(full);
  }
  return out;
}

// 1) syntax
const jsFiles = [...walk(root), path.join(root, "functions", "index.js"), path.join(root, "functions", "legacyAuth.js")];
for (const file of jsFiles) {
  if (!fs.existsSync(file)) { errors.push(`ملف مفقود: ${path.relative(root, file)}`); continue; }
  const r = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (r.status !== 0) errors.push(`خطأ صياغة في ${path.relative(root, file)}:\n${r.stderr}`);
}

// 2) local asset references
const exists = (p) => fs.existsSync(path.join(root, p.replace(/^\.?\//, "")));
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
for (const m of html.matchAll(/(?:href|src)="((?!https?:|\/\/|data:|#|\/api\/)[^"]+)"/g)) {
  const ref = m[1].split("?")[0];
  if (ref && !exists(ref)) errors.push(`index.html يشير لملف غير موجود: ${ref}`);
}
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
for (const icon of manifest.icons || []) {
  if (!exists(icon.src)) errors.push(`manifest.json يشير لأيقونة غير موجودة: ${icon.src}`);
}

// 3) generate the service worker's core cache list from index.html module entries
const moduleEntries = [];
for (const [, attributes, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
  if (!/\btype\s*=\s*["']module["']/i.test(attributes)) continue;
  const src = attributes.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
  if (src) {
    if (!/^(?:https?:)?\/\//i.test(src)) moduleEntries.push(src.replace(/^\//, ""));
  } else {
    for (const match of body.matchAll(/\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?["']([^"']+)["']/g)) {
      if (match[1].startsWith(".")) moduleEntries.push(path.posix.normalize(match[1]));
    }
  }
}

const moduleAssets = new Set();
const visitModule = (relativePath) => {
  const cleanPath = relativePath.split(/[?#]/, 1)[0].replace(/^\.\//, "");
  const fullPath = path.resolve(root, cleanPath);
  if (!fullPath.startsWith(`${root}${path.sep}`) || !fs.existsSync(fullPath)) {
    errors.push(`وحدة أساسية مفقودة: ${relativePath}`);
    return;
  }
  const asset = `./${path.relative(root, fullPath).split(path.sep).join("/")}`;
  if (moduleAssets.has(asset)) return;
  moduleAssets.add(asset);
  const source = fs.readFileSync(fullPath, "utf8");
  for (const match of source.matchAll(/\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?["']([^"']+)["']/g)) {
    if (match[1].startsWith(".")) {
      visitModule(path.posix.normalize(path.posix.join(path.posix.dirname(asset.slice(2)), match[1])));
    }
  }
};
for (const entry of moduleEntries) visitModule(entry);

const swPath = path.join(root, "sw.js");
let sw = fs.readFileSync(swPath, "utf8");
const assetsStart = "  // GENERATED_MODULE_ASSETS_START";
const assetsEnd = "  // GENERATED_MODULE_ASSETS_END";
const startIndex = sw.indexOf(assetsStart);
const endIndex = sw.indexOf(assetsEnd);
if (startIndex < 0 || endIndex < startIndex) {
  errors.push("sw.js חסר אזור قائمة وحدات التطبيق الأساسية");
} else {
  const generated = [...moduleAssets].sort().map((asset) => `  '${asset}',`).join("\n");
  sw = `${sw.slice(0, startIndex + assetsStart.length)}\n${generated}\n${sw.slice(endIndex)}`;
}

if (errors.length) {
  console.error("❌ فشل البناء:\n" + errors.join("\n"));
  process.exit(1);
}

fs.writeFileSync(swPath, sw);

// 4) stamp service worker build id
if (process.env.CI || process.argv.includes("--stamp")) {
  const buildId = (process.env.GITHUB_SHA || String(Date.now())).slice(0, 12);
  sw = fs.readFileSync(swPath, "utf8");
  if (!sw.includes("__BUILD_ID__")) {
    console.warn("⚠️ sw.js لا يحتوي __BUILD_ID__ (تم ختمه سابقاً؟)");
  } else {
    fs.writeFileSync(swPath, sw.replace("__BUILD_ID__", buildId));
    console.log(`✅ sw.js BUILD_ID = ${buildId}`);
  }
}

console.log(`✅ البناء نجح (${jsFiles.length} ملف JS تم فحصه)`);
