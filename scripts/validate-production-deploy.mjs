import { pathToFileURL } from "node:url";
import { PRODUCTION_FIREBASE_CONFIG } from "../js/firebaseDefaults.js";

function parseServiceAccount(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is empty.");
  }

  let candidate = value.trim();
  if (
    (candidate.startsWith("'") && candidate.endsWith("'")) ||
    (candidate.startsWith('"') && candidate.endsWith('"'))
  ) {
    candidate = candidate.slice(1, -1).trim();
  }
  if (!candidate) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is empty.");
  }

  const parseJson = (json) => {
    const parsed = JSON.parse(json);
    if (typeof parsed !== "string") {
      return parsed;
    }

    try {
      return JSON.parse(parsed);
    } catch {
      return parsed;
    }
  };

  let serviceAccount;
  try {
    serviceAccount = parseJson(candidate);
  } catch {
    const base64 = candidate.replace(/\s/g, "");
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length % 4 === 1) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON or base64-encoded JSON.");
    }

    try {
      serviceAccount = parseJson(Buffer.from(base64, "base64").toString("utf8"));
    } catch {
      throw new Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON or base64-encoded JSON.");
    }
  }

  return serviceAccount;
}

export function validateProductionDeploymentConfig(env = process.env) {
  const serviceAccount = parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT);
  const requiredFields = ["type", "project_id", "client_email", "private_key"];
  const missingFields = requiredFields.filter(
    (field) => typeof serviceAccount?.[field] !== "string" || !serviceAccount[field].trim()
  );

  if (missingFields.length > 0) {
    throw new Error(
      `FIREBASE_SERVICE_ACCOUNT JSON is missing required field(s): ${missingFields.join(", ")}.`
    );
  }

  serviceAccount.private_key = serviceAccount.private_key
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n");

  if (
    serviceAccount.type !== "service_account" ||
    serviceAccount.project_id !== PRODUCTION_FIREBASE_CONFIG.projectId ||
    !serviceAccount.client_email.endsWith(
      `@${PRODUCTION_FIREBASE_CONFIG.projectId}.iam.gserviceaccount.com`
    )
  ) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT must belong to the production project.");
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
