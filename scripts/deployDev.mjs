// نشر Hosting target "dev" إلى مشروع dev-test-37e8a فقط (يدوياً من نسخة محلية موثوقة).
// - لا يستعمل مشروع الإنتاج أبداً ويمرّر --project صراحةً.
// - يولّد api/config.js الخاص بـ dev مؤقتاً (من متغيرات FIREBASE_DEV_*) ثم يعيد الملف الأصلي.
// - لا ينشر Firestore rules/indexes/Functions (استخدم npm run deploy:dev:rules عند الحاجة).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PRODUCTION_FIREBASE_CONFIG } from "../js/firebaseDefaults.js";
import { DEV_FIREBASE_PROJECT_ID } from "../js/firebaseEnv.js";
import { buildDevAppConfig, renderDevConfigFile } from "./generate-dev-config.mjs";
import { readDevHostingTarget } from "./verify-dev-targets.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function buildDevDeployArgs(projectId = DEV_FIREBASE_PROJECT_ID) {
  if (projectId !== DEV_FIREBASE_PROJECT_ID || projectId === PRODUCTION_FIREBASE_CONFIG.projectId) {
    throw new Error(`Refusing to deploy dev to "${projectId}"; only ${DEV_FIREBASE_PROJECT_ID} is allowed.`);
  }
  return ["deploy", "--only", "hosting:dev", "--project", projectId];
}

function main() {
  const projectId = (process.env.FIREBASE_DEV_PROJECT_ID || DEV_FIREBASE_PROJECT_ID).trim();
  const args = buildDevDeployArgs(projectId);
  readDevHostingTarget(JSON.parse(readFileSync(path.join(root, ".firebaserc"), "utf8")));

  const configPath = path.join(root, "api", "config.js");
  const original = existsSync(configPath) ? readFileSync(configPath, "utf8") : null;
  try {
    const appConfig = buildDevAppConfig({ ...process.env, FIREBASE_DEV_PROJECT_ID: projectId });
    writeFileSync(configPath, renderDevConfigFile(appConfig));
    const result = spawnSync("firebase", args, { cwd: root, stdio: "inherit" });
    if (result.error) {
      console.error("Firebase CLI could not be started; install and authenticate the CLI first.");
      return 1;
    }
    return result.status ?? 1;
  } finally {
    if (original !== null) writeFileSync(configPath, original);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`Dev deployment blocked: ${error.message}`);
    process.exitCode = 1;
  }
}
