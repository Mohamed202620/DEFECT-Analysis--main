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

if (errors.length) {
  console.error("❌ فشل البناء:\n" + errors.join("\n"));
  process.exit(1);
}

// 3) stamp service worker build id
if (process.env.CI || process.argv.includes("--stamp")) {
  const swPath = path.join(root, "sw.js");
  const buildId = (process.env.GITHUB_SHA || String(Date.now())).slice(0, 12);
  const sw = fs.readFileSync(swPath, "utf8");
  if (!sw.includes("__BUILD_ID__")) {
    console.warn("⚠️ sw.js لا يحتوي __BUILD_ID__ (تم ختمه سابقاً؟)");
  } else {
    fs.writeFileSync(swPath, sw.replace("__BUILD_ID__", buildId));
    console.log(`✅ sw.js BUILD_ID = ${buildId}`);
  }
}

console.log(`✅ البناء نجح (${jsFiles.length} ملف JS تم فحصه)`);
