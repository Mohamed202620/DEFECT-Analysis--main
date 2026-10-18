// ============================================================
// تحقق من أن أهداف نشر dev كلها تابعة لمشروع dev (قبل أي نشر)
//   node scripts/verify-dev-targets.mjs worker   -> /health لـ Worker التطوير
//   node scripts/verify-dev-targets.mjs site     -> موقع Hosting target "dev" موجود فعلاً في مشروع dev
// الفحص الحي (site) يستعمل FIREBASE_DEV_SERVICE_ACCOUNT_NORMALIZED عبر ملف مؤقت يُحذف بعد التنفيذ.
// ============================================================
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PRODUCTION_FIREBASE_CONFIG } from "../js/firebaseDefaults.js";
import { DEV_BACKEND_WORKER_URL, DEV_FIREBASE_PROJECT_ID } from "../js/firebaseEnv.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCTION_ID = PRODUCTION_FIREBASE_CONFIG.projectId;

/** يتحقق من .firebaserc ويرجع { projectId, siteId } لهدف hosting:dev. */
export function readDevHostingTarget(firebaserc) {
  if (firebaserc?.projects?.dev !== DEV_FIREBASE_PROJECT_ID) {
    throw new Error(`.firebaserc: projects.dev must be ${DEV_FIREBASE_PROJECT_ID}.`);
  }
  const sites = firebaserc?.targets?.[DEV_FIREBASE_PROJECT_ID]?.hosting?.dev;
  if (!Array.isArray(sites) || sites.length !== 1 || typeof sites[0] !== "string" || !sites[0]) {
    throw new Error(`.firebaserc: targets.${DEV_FIREBASE_PROJECT_ID}.hosting.dev must list exactly one site.`);
  }
  const siteId = sites[0];
  if (siteId === PRODUCTION_ID || siteId === "my-dev-2026") {
    throw new Error(".firebaserc: the dev Hosting target points to a production-project site.");
  }
  const productionHosting = firebaserc?.targets?.[PRODUCTION_ID]?.hosting || {};
  if (Object.prototype.hasOwnProperty.call(productionHosting, "dev")) {
    throw new Error('.firebaserc: the production project must not define a "dev" Hosting target.');
  }
  if (JSON.stringify(productionHosting).includes(siteId)) {
    throw new Error(".firebaserc: the dev site is also mapped under the production project.");
  }
  return { projectId: DEV_FIREBASE_PROJECT_ID, siteId };
}

/** يتأكد أن siteId ضمن قائمة مواقع مشروع dev (ناتج firebase hosting:sites:list --json). */
export function assertSiteBelongsToProject(listOutput, siteId, projectId = DEV_FIREBASE_PROJECT_ID) {
  const sites = listOutput?.result?.sites ?? listOutput?.sites ?? listOutput?.result;
  if (!Array.isArray(sites)) {
    throw new Error("Unexpected output from firebase hosting:sites:list (no sites array).");
  }
  const match = sites.find((site) => {
    const name = String(site?.name || "");
    const segment = name.split("/sites/")[1];
    const prefix = name.split("/sites/")[0];
    if (segment !== siteId) return false;
    // الاسم الكامل: projects/<ID أو الرقم>/sites/<الموقع>. نرفض فقط معرّف مشروع نصي مختلف.
    const owner = prefix.replace(/^projects\//, "");
    return !owner || /^\d+$/.test(owner) || owner === projectId;
  });
  if (!match) {
    throw new Error(`Hosting site "${siteId}" was not found in project ${projectId}.`);
  }
  return match;
}

/** يتأكد أن Worker التطوير فعلاً في وضع development ومربوط بمشروع وموقع dev. */
export function assertDevWorkerHealth(health, expectedSiteId) {
  if (!health || health.ok !== true) throw new Error("Dev Worker /health is not ok.");
  if (health.environment !== "development") {
    throw new Error(`Dev Worker environment is "${health.environment}", expected "development".`);
  }
  if (health.projectId !== DEV_FIREBASE_PROJECT_ID) {
    throw new Error(`Dev Worker is bound to "${health.projectId}", expected ${DEV_FIREBASE_PROJECT_ID}.`);
  }
  if (expectedSiteId && health.hostingSite !== expectedSiteId) {
    throw new Error(`Dev Worker hosting site "${health.hostingSite}" differs from target "${expectedSiteId}".`);
  }
  if (health.projectId === PRODUCTION_ID || health.hostingSite === PRODUCTION_ID) {
    throw new Error("Dev Worker reports production identifiers.");
  }
  return health;
}

function readFirebaserc() {
  return JSON.parse(readFileSync(path.join(root, ".firebaserc"), "utf8"));
}

async function checkWorker() {
  const { siteId } = readDevHostingTarget(readFirebaserc());
  const response = await fetch(`${DEV_BACKEND_WORKER_URL}/health`, { signal: AbortSignal.timeout(20_000) });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Dev Worker /health returned HTTP ${response.status}.`);
  assertDevWorkerHealth(body, siteId);
  console.log(`Dev Worker verified: development / ${body.projectId} / ${body.hostingSite}`);
}

function checkSite() {
  const { projectId, siteId } = readDevHostingTarget(readFirebaserc());
  const credential = process.env.FIREBASE_DEV_SERVICE_ACCOUNT_NORMALIZED;
  if (!credential) throw new Error("FIREBASE_DEV_SERVICE_ACCOUNT_NORMALIZED is missing (run validate-dev-deploy first).");

  const dir = mkdtempSync(path.join(process.env.RUNNER_TEMP || os.tmpdir(), "dev-sa-"));
  const file = path.join(dir, "sa.json");
  try {
    writeFileSync(file, credential, { mode: 0o600 });
    const result = spawnSync(
      "npx",
      ["--no-install", "firebase", "hosting:sites:list", "--project", projectId, "--json", "--non-interactive"],
      { cwd: root, encoding: "utf8", env: { ...process.env, GOOGLE_APPLICATION_CREDENTIALS: file } }
    );
    if (result.status !== 0) {
      throw new Error(`firebase hosting:sites:list failed (exit ${result.status}).`);
    }
    assertSiteBelongsToProject(JSON.parse(result.stdout), siteId, projectId);
    console.log(`Hosting site "${siteId}" verified inside project ${projectId}.`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const mode = process.argv[2];
    if (mode === "worker") await checkWorker();
    else if (mode === "site") checkSite();
    else throw new Error("Usage: verify-dev-targets.mjs <worker|site>");
  } catch (error) {
    console.error(`Dev deployment blocked: ${error.message}`);
    process.exitCode = 1;
  }
}
