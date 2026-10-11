import { pathToFileURL } from "node:url";
import { PRODUCTION_FIREBASE_CONFIG } from "../js/firebaseDefaults.js";

export function validateProductionDeploymentConfig(env = process.env) {
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT || "");
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT must contain valid service-account JSON.");
  }

  if (
    serviceAccount.type !== "service_account" ||
    serviceAccount.project_id !== PRODUCTION_FIREBASE_CONFIG.projectId ||
    typeof serviceAccount.client_email !== "string" ||
    !serviceAccount.client_email.endsWith(
      `@${PRODUCTION_FIREBASE_CONFIG.projectId}.iam.gserviceaccount.com`
    ) ||
    typeof serviceAccount.private_key !== "string"
  ) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT must belong to the production project.");
  }

  const developmentProjectId = env.FIREBASE_DEV_PROJECT_ID?.trim();
  if (developmentProjectId === PRODUCTION_FIREBASE_CONFIG.projectId) {
    throw new Error("FIREBASE_DEV_PROJECT_ID must not be the production project.");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    validateProductionDeploymentConfig();
    console.log("Validated production project and deployer project binding.");
  } catch (error) {
    console.error(`Production deployment blocked: ${error.message}`);
    process.exitCode = 1;
  }
}
