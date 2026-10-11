import { pathToFileURL } from "node:url";
import { PRODUCTION_BACKEND_WORKER_URL } from "../js/firebaseDefaults.js";

export function validateDevWorkerHealth(workerUrl, expected, response) {
  let worker;
  try {
    worker = new URL(workerUrl);
  } catch {
    throw new Error("FIREBASE_DEV_BACKEND_WORKER_URL must be a valid HTTPS Worker URL.");
  }
  if (
    worker.protocol !== "https:" ||
    worker.origin === new URL(PRODUCTION_BACKEND_WORKER_URL).origin ||
    worker.pathname !== "/" ||
    worker.search ||
    worker.hash
  ) {
    throw new Error("Dev deployment requires a separate HTTPS Worker origin.");
  }

  if (!response.ok || new URL(response.url).origin !== worker.origin) {
    throw new Error("Dev Worker health check failed or redirected to another origin.");
  }

  let health;
  try {
    health = response.body;
  } catch {
    throw new Error("Dev Worker returned invalid health data.");
  }

  if (
    health?.ok !== true ||
    health.environment !== "development" ||
    health.projectId !== expected.projectId ||
    health.hostingSite !== expected.hostingSite
  ) {
    throw new Error("Dev Worker must report the configured dev project and Hosting site.");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const workerUrl = process.env.FIREBASE_DEV_BACKEND_WORKER_URL?.trim();
    const projectId = process.env.FIREBASE_DEV_PROJECT_ID?.trim();
    const hostingSite = process.env.FIREBASE_DEV_HOSTING_SITE?.trim();
    if (!workerUrl || !projectId || !hostingSite) {
      throw new Error("Missing FIREBASE_DEV_BACKEND_WORKER_URL, FIREBASE_DEV_PROJECT_ID, or FIREBASE_DEV_HOSTING_SITE.");
    }

    const response = await fetch(`${workerUrl.replace(/\/+$/, "")}/health`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000)
    });
    const body = await response.json().catch(() => null);
    validateDevWorkerHealth(workerUrl, { projectId, hostingSite }, {
      ok: response.ok,
      url: response.url,
      body
    });
    console.log("Validated dev Worker environment, Firebase project, and Hosting site.");
  } catch (error) {
    console.error(`Dev deployment blocked: ${error.message}`);
    process.exitCode = 1;
  }
}
