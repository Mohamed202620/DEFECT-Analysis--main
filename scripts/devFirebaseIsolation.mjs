import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_FIREBASE_FUNCTIONS_REGION,
  PRODUCTION_BACKEND_WORKER_URL,
  PRODUCTION_FIREBASE_CONFIG
} from "../js/firebaseDefaults.js";

const REQUIRED_VALUES = [
  "FIREBASE_DEV_PROJECT_ID",
  "FIREBASE_DEV_API_KEY",
  "FIREBASE_DEV_APP_ID",
  "FIREBASE_DEV_AUTH_DOMAIN",
  "FIREBASE_DEV_MESSAGING_SENDER_ID",
  "FIREBASE_DEV_STORAGE_BUCKET",
  "FIREBASE_DEV_BACKEND_WORKER_URL",
  "FIREBASE_DEV_HOSTING_SITE",
  "FIREBASE_DEV_SERVICE_ACCOUNT"
];

function required(env, key) {
  const value = env[key]?.trim();
  if (!value || value.startsWith("<") || /^(todo|placeholder)$/i.test(value)) {
    throw new Error(`Missing or placeholder dev deployment value: ${key}`);
  }
  return value;
}

export function validateDevDeploymentConfig(env = process.env) {
  const values = Object.fromEntries(REQUIRED_VALUES.map(key => [key, required(env, key)]));
  const projectId = values.FIREBASE_DEV_PROJECT_ID;
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
    throw new Error("FIREBASE_DEV_PROJECT_ID is not a valid Firebase project ID.");
  }
  if (projectId === PRODUCTION_FIREBASE_CONFIG.projectId) {
    throw new Error("FIREBASE_DEV_PROJECT_ID must not be the production project.");
  }

  const productionBoundValues = [
    ["FIREBASE_DEV_API_KEY", PRODUCTION_FIREBASE_CONFIG.apiKey],
    ["FIREBASE_DEV_APP_ID", PRODUCTION_FIREBASE_CONFIG.appId],
    ["FIREBASE_DEV_AUTH_DOMAIN", PRODUCTION_FIREBASE_CONFIG.authDomain],
    ["FIREBASE_DEV_MESSAGING_SENDER_ID", PRODUCTION_FIREBASE_CONFIG.messagingSenderId],
    ["FIREBASE_DEV_STORAGE_BUCKET", PRODUCTION_FIREBASE_CONFIG.storageBucket]
  ];
  for (const [key, productionValue] of productionBoundValues) {
    if (values[key] === productionValue) {
      throw new Error(`${key} must come from the separate Firebase dev project.`);
    }
  }

  const hostingSite = values.FIREBASE_DEV_HOSTING_SITE;
  if (
    !/^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/.test(hostingSite) ||
    hostingSite === PRODUCTION_FIREBASE_CONFIG.projectId ||
    hostingSite === "my-dev-2026"
  ) {
    throw new Error("FIREBASE_DEV_HOSTING_SITE must be a new, separate Firebase Hosting site.");
  }

  let workerUrl;
  try {
    workerUrl = new URL(values.FIREBASE_DEV_BACKEND_WORKER_URL);
  } catch {
    throw new Error("FIREBASE_DEV_BACKEND_WORKER_URL must be a valid HTTPS URL.");
  }
  if (
    workerUrl.protocol !== "https:" ||
    workerUrl.origin === new URL(PRODUCTION_BACKEND_WORKER_URL).origin
  ) {
    throw new Error("FIREBASE_DEV_BACKEND_WORKER_URL must point to a separate HTTPS Worker.");
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(values.FIREBASE_DEV_SERVICE_ACCOUNT);
  } catch {
    throw new Error("FIREBASE_DEV_SERVICE_ACCOUNT must contain valid service-account JSON.");
  }
  if (
    serviceAccount.type !== "service_account" ||
    serviceAccount.project_id !== projectId ||
    typeof serviceAccount.client_email !== "string" ||
    !serviceAccount.client_email.endsWith(".iam.gserviceaccount.com") ||
    typeof serviceAccount.private_key !== "string" ||
    !serviceAccount.private_key.includes("-----BEGIN PRIVATE KEY-----") ||
    !serviceAccount.private_key.includes("-----END PRIVATE KEY-----")
  ) {
    throw new Error("FIREBASE_DEV_SERVICE_ACCOUNT must be a service account belonging to the dev project.");
  }

  return {
    projectId,
    apiKey: values.FIREBASE_DEV_API_KEY,
    appId: values.FIREBASE_DEV_APP_ID,
    authDomain: values.FIREBASE_DEV_AUTH_DOMAIN,
    messagingSenderId: values.FIREBASE_DEV_MESSAGING_SENDER_ID,
    storageBucket: values.FIREBASE_DEV_STORAGE_BUCKET,
    backendWorkerUrl: workerUrl.toString().replace(/\/$/, ""),
    hostingSite: values.FIREBASE_DEV_HOSTING_SITE,
    functionsRegion: env.FIREBASE_DEV_FUNCTIONS_REGION?.trim() || DEFAULT_FIREBASE_FUNCTIONS_REGION
  };
}

export function makeDevClientConfig(config) {
  return {
    APP_ENV: "development",
    FIREBASE_PROJECT_ID: config.projectId,
    FIREBASE_API_KEY: config.apiKey,
    FIREBASE_APP_ID: config.appId,
    FIREBASE_AUTH_DOMAIN: config.authDomain,
    FIREBASE_MESSAGING_SENDER_ID: config.messagingSenderId,
    FIREBASE_STORAGE_BUCKET: config.storageBucket,
    FIREBASE_FUNCTIONS_REGION: config.functionsRegion,
    BACKEND_WORKER_URL: config.backendWorkerUrl
  };
}

export function makeDevFirebaseRc(existingRc, config) {
  const next = structuredClone(existingRc);
  next.projects ||= {};
  next.projects.default = PRODUCTION_FIREBASE_CONFIG.projectId;
  next.targets ||= {};
  next.targets[config.projectId] ||= {};
  next.targets[config.projectId].hosting ||= {};
  next.targets[config.projectId].hosting.dev = [config.hostingSite];
  return next;
}

export async function prepareDevDeployment({ env = process.env, root = process.cwd() } = {}) {
  const config = validateDevDeploymentConfig(env);
  const firebasercPath = path.join(root, ".firebaserc");
  const clientConfigPath = path.join(root, "api", "config.js");
  const existingRc = JSON.parse(await readFile(firebasercPath, "utf8"));
  const clientConfig = makeDevClientConfig(config);

  await writeFile(clientConfigPath, `window.APP_CONFIG = Object.freeze(${JSON.stringify(clientConfig)});\n`);
  await writeFile(firebasercPath, `${JSON.stringify(makeDevFirebaseRc(existingRc, config), null, 2)}\n`);
  return config;
}
