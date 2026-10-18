// ============================================================
// التحقق قبل نشر dev: FIREBASE_DEV_PROJECT_ID + FIREBASE_DEV_SERVICE_ACCOUNT
// ============================================================
// - يرفض أي معرّف مشروع غير dev-test-37e8a (وخصوصاً مشروع الإنتاج).
// - يرفض حساب خدمة لا يخص نفس مشروع dev (project_id + نطاق client_email).
// - لا يطبع أي جزء من السر في الرسائل أو السجلات.
// عند التشغيل داخل GitHub Actions يكتب في GITHUB_ENV:
//   FIREBASE_DEV_PROJECT_ID_VALIDATED, FIREBASE_DEV_SERVICE_ACCOUNT_NORMALIZED
// ============================================================
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { PRODUCTION_FIREBASE_CONFIG } from "../js/firebaseDefaults.js";
import { DEV_FIREBASE_PROJECT_ID } from "../js/firebaseEnv.js";

function parseServiceAccount(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("FIREBASE_DEV_SERVICE_ACCOUNT is empty.");
  }

  let candidate = value.trim();
  if (
    (candidate.startsWith("'") && candidate.endsWith("'")) ||
    (candidate.startsWith('"') && candidate.endsWith('"'))
  ) {
    candidate = candidate.slice(1, -1).trim();
  }
  if (!candidate) {
    throw new Error("FIREBASE_DEV_SERVICE_ACCOUNT is empty.");
  }

  const parseJson = (json) => {
    const parsed = JSON.parse(json);
    if (typeof parsed !== "string") return parsed;
    try {
      return JSON.parse(parsed);
    } catch {
      return parsed;
    }
  };

  const invalid = () =>
    new Error("FIREBASE_DEV_SERVICE_ACCOUNT is not valid JSON or base64-encoded JSON.");

  try {
    return parseJson(candidate);
  } catch {
    const base64 = candidate.replace(/\s/g, "");
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length % 4 === 1) throw invalid();
    try {
      return parseJson(Buffer.from(base64, "base64").toString("utf8"));
    } catch {
      throw invalid();
    }
  }
}

export function validateDevDeploymentConfig(env = process.env) {
  const projectId = typeof env.FIREBASE_DEV_PROJECT_ID === "string" ? env.FIREBASE_DEV_PROJECT_ID.trim() : "";
  if (!projectId) {
    throw new Error("FIREBASE_DEV_PROJECT_ID is empty.");
  }
  if (projectId === PRODUCTION_FIREBASE_CONFIG.projectId) {
    throw new Error("FIREBASE_DEV_PROJECT_ID must not be the production project.");
  }
  if (projectId !== DEV_FIREBASE_PROJECT_ID) {
    throw new Error(`FIREBASE_DEV_PROJECT_ID must be ${DEV_FIREBASE_PROJECT_ID}.`);
  }

  const serviceAccount = parseServiceAccount(env.FIREBASE_DEV_SERVICE_ACCOUNT);
  const requiredFields = ["type", "project_id", "client_email", "private_key"];
  const missingFields = requiredFields.filter(
    (field) => typeof serviceAccount?.[field] !== "string" || !serviceAccount[field].trim()
  );
  if (missingFields.length > 0) {
    throw new Error(
      `FIREBASE_DEV_SERVICE_ACCOUNT JSON is missing required field(s): ${missingFields.join(", ")}.`
    );
  }

  serviceAccount.private_key = serviceAccount.private_key
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n");

  if (serviceAccount.project_id === PRODUCTION_FIREBASE_CONFIG.projectId) {
    throw new Error("FIREBASE_DEV_SERVICE_ACCOUNT belongs to the production project and is blocked.");
  }
  if (
    serviceAccount.type !== "service_account" ||
    serviceAccount.project_id !== projectId ||
    !serviceAccount.client_email.endsWith(`@${projectId}.iam.gserviceaccount.com`)
  ) {
    throw new Error("FIREBASE_DEV_SERVICE_ACCOUNT must belong to the dev project.");
  }

  return { projectId, serviceAccountJson: JSON.stringify(serviceAccount) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { projectId, serviceAccountJson } = validateDevDeploymentConfig();
    if (process.env.GITHUB_ENV) {
      const escaped = serviceAccountJson
        .replace(/%/g, "%25")
        .replace(/\r/g, "%0D")
        .replace(/\n/g, "%0A");
      process.stdout.write(`::add-mask::${escaped}\n`);
      appendFileSync(
        process.env.GITHUB_ENV,
        `FIREBASE_DEV_PROJECT_ID_VALIDATED=${projectId}\n` +
          `FIREBASE_DEV_SERVICE_ACCOUNT_NORMALIZED=${serviceAccountJson}\n`
      );
    }
    console.log(`Validated dev project (${projectId}) and deployer credential binding.`);
  } catch (error) {
    console.error(`Dev deployment blocked: ${error.message}`);
    process.exitCode = 1;
  }
}
