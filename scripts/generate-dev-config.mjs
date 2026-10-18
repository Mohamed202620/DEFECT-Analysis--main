// ============================================================
// توليد api/config.js الخاص ببيئة dev (يُستخدم عند نشر dev فقط)
// ============================================================
// الملف المحفوظ في المستودع (api/config.js) يبقى كما هو. هذا السكربت يكتب نسخة
// dev في مساحة عمل CI قبل النشر. القيم هي إعدادات Firebase Web العامة لمشروع
// dev-test-37e8a (ليست أسراراً) وتأتي من متغيرات GitHub، ولا تُخترع هنا.
// أي قيمة ناقصة أو تخص الإنتاج => فشل (نفس فحص الواجهة في js/firebaseEnv.js).
//
// الاستخدام:  node scripts/generate-dev-config.mjs [مسار_الإخراج]
// ============================================================
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DEFAULT_FIREBASE_FUNCTIONS_REGION } from "../js/firebaseDefaults.js";
import {
  APP_ENV_DEV,
  DEV_BACKEND_WORKER_URL,
  DEV_FIREBASE_PROJECT_ID,
  DEV_HOSTING_HOSTNAMES,
  resolveFirebaseRuntimeConfig
} from "../js/firebaseEnv.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function buildDevAppConfig(env = process.env) {
  const pick = (name) => (typeof env[name] === "string" ? env[name].trim() : "");
  const projectId = pick("FIREBASE_DEV_PROJECT_ID");
  if (projectId !== DEV_FIREBASE_PROJECT_ID) {
    throw new Error(`FIREBASE_DEV_PROJECT_ID must be ${DEV_FIREBASE_PROJECT_ID}.`);
  }

  const missing = ["FIREBASE_DEV_API_KEY", "FIREBASE_DEV_APP_ID", "FIREBASE_DEV_MESSAGING_SENDER_ID"].filter(
    (name) => !pick(name)
  );
  if (missing.length) {
    throw new Error(`Missing dev Firebase web config variable(s): ${missing.join(", ")}.`);
  }

  const appConfig = {
    APP_ENV: APP_ENV_DEV,
    FIREBASE_API_KEY: pick("FIREBASE_DEV_API_KEY"),
    FIREBASE_APP_ID: pick("FIREBASE_DEV_APP_ID"),
    FIREBASE_AUTH_DOMAIN: pick("FIREBASE_DEV_AUTH_DOMAIN") || `${projectId}.firebaseapp.com`,
    FIREBASE_MESSAGING_SENDER_ID: pick("FIREBASE_DEV_MESSAGING_SENDER_ID"),
    FIREBASE_PROJECT_ID: projectId,
    FIREBASE_STORAGE_BUCKET: pick("FIREBASE_DEV_STORAGE_BUCKET") || `${projectId}.firebasestorage.app`,
    FIREBASE_FUNCTIONS_REGION: pick("FIREBASE_DEV_FUNCTIONS_REGION") || DEFAULT_FIREBASE_FUNCTIONS_REGION,
    BACKEND_WORKER_URL: pick("FIREBASE_DEV_BACKEND_WORKER_URL") || DEV_BACKEND_WORKER_URL
  };

  // نفس فحص وقت التشغيل، على مضيف dev: يمنع توليد إعدادات مخلوطة أو تخص الإنتاج.
  resolveFirebaseRuntimeConfig({ appConfig, hostname: DEV_HOSTING_HOSTNAMES[0] });
  return appConfig;
}

export function renderDevConfigFile(appConfig) {
  return (
    "// مولَّد بواسطة scripts/generate-dev-config.mjs لنشر dev فقط - لا يُحفظ في المستودع.\n" +
    `window.APP_CONFIG = Object.freeze(${JSON.stringify(appConfig, null, 2)});\n`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const out = path.resolve(root, process.argv[2] || "api/config.js");
    const appConfig = buildDevAppConfig();
    writeFileSync(out, renderDevConfigFile(appConfig));
    console.log(`Wrote dev runtime config for ${appConfig.FIREBASE_PROJECT_ID} to ${path.relative(root, out)}`);
  } catch (error) {
    console.error(`Dev config generation blocked: ${error.message}`);
    process.exitCode = 1;
  }
}
