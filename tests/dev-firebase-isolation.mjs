import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  makeDevClientConfig,
  makeDevFirebaseRc,
  validateDevDeploymentConfig
} from "../scripts/devFirebaseIsolation.mjs";
import {
  PRODUCTION_BACKEND_WORKER_URL,
  PRODUCTION_FIREBASE_CONFIG
} from "../js/firebaseDefaults.js";

const developmentEnv = () => ({
  FIREBASE_DEV_PROJECT_ID: "maintenance-defect-dev",
  FIREBASE_DEV_API_KEY: "dev-web-api-key",
  FIREBASE_DEV_APP_ID: "1:123456789:web:abcdef",
  FIREBASE_DEV_AUTH_DOMAIN: "maintenance-defect-dev.firebaseapp.com",
  FIREBASE_DEV_MESSAGING_SENDER_ID: "123456789",
  FIREBASE_DEV_STORAGE_BUCKET: "maintenance-defect-dev.firebasestorage.app",
  FIREBASE_DEV_BACKEND_WORKER_URL: "https://maintenance-defect-dev.example.workers.dev",
  FIREBASE_DEV_HOSTING_SITE: "maintenance-defect-dev",
  FIREBASE_DEV_SERVICE_ACCOUNT: JSON.stringify({
    type: "service_account",
    project_id: "maintenance-defect-dev",
    client_email: "firebase-deployer@maintenance-defect-dev.iam.gserviceaccount.com",
    private_key: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----"
  })
});

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log("  ✅", name);
};

console.log("Dev Firebase isolation");
test("missing configuration is rejected", () => {
  assert.throws(() => validateDevDeploymentConfig({}), /Missing or placeholder/);
});
test("production Firebase project and credentials are rejected", () => {
  const env = developmentEnv();
  env.FIREBASE_DEV_PROJECT_ID = PRODUCTION_FIREBASE_CONFIG.projectId;
  assert.throws(() => validateDevDeploymentConfig(env), /must not be the production project/);
  const credentials = developmentEnv();
  credentials.FIREBASE_DEV_API_KEY = PRODUCTION_FIREBASE_CONFIG.apiKey;
  assert.throws(() => validateDevDeploymentConfig(credentials), /must come from the separate/);
});
test("production Worker and mismatched deployer account are rejected", () => {
  const worker = developmentEnv();
  worker.FIREBASE_DEV_BACKEND_WORKER_URL = PRODUCTION_BACKEND_WORKER_URL;
  assert.throws(() => validateDevDeploymentConfig(worker), /separate HTTPS Worker/);
  const account = developmentEnv();
  account.FIREBASE_DEV_SERVICE_ACCOUNT = JSON.stringify({
    ...JSON.parse(account.FIREBASE_DEV_SERVICE_ACCOUNT),
    project_id: PRODUCTION_FIREBASE_CONFIG.projectId
  });
  assert.throws(() => validateDevDeploymentConfig(account), /belonging to the dev project/);
});
test("valid inputs create a dev-only client config and target mapping", () => {
  const config = validateDevDeploymentConfig(developmentEnv());
  const client = makeDevClientConfig(config);
  assert.equal(client.APP_ENV, "development");
  assert.equal(client.FIREBASE_PROJECT_ID, "maintenance-defect-dev");
  assert.equal(client.BACKEND_WORKER_URL, "https://maintenance-defect-dev.example.workers.dev");
  assert.notEqual(client.FIREBASE_PROJECT_ID, PRODUCTION_FIREBASE_CONFIG.projectId);

  const rc = makeDevFirebaseRc({
    projects: { default: PRODUCTION_FIREBASE_CONFIG.projectId },
    targets: {
      [PRODUCTION_FIREBASE_CONFIG.projectId]: {
        hosting: { main: [PRODUCTION_FIREBASE_CONFIG.projectId] }
      }
    }
  }, config);
  assert.equal(rc.projects.default, PRODUCTION_FIREBASE_CONFIG.projectId);
  assert.equal(rc.targets[PRODUCTION_FIREBASE_CONFIG.projectId].hosting.dev, undefined);
  assert.deepEqual(rc.targets[config.projectId].hosting.dev, [config.hostingSite]);
  assert.deepEqual(rc.targets[PRODUCTION_FIREBASE_CONFIG.projectId].hosting.main, [PRODUCTION_FIREBASE_CONFIG.projectId]);
});
test("checked-in Firebase target keeps dev out of production", async () => {
  const rc = JSON.parse(await readFile(new URL("../.firebaserc", import.meta.url), "utf8"));
  assert.equal(rc.projects.default, PRODUCTION_FIREBASE_CONFIG.projectId);
  assert.equal(
    rc.targets[PRODUCTION_FIREBASE_CONFIG.projectId].hosting.main[0],
    PRODUCTION_FIREBASE_CONFIG.projectId
  );
  assert.equal(rc.targets[PRODUCTION_FIREBASE_CONFIG.projectId].hosting.dev, undefined);
});
test("dev and production workflows use isolated project IDs and credentials", async () => {
  const [devWorkflow, mainWorkflow] = await Promise.all([
    readFile(new URL("../.github/workflows/firebase-hosting-dev.yml", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/firebase-hosting-main.yml", import.meta.url), "utf8")
  ]);

  const devProjectInputs = [...devWorkflow.matchAll(/^\s*projectId:\s*(.+)$/gm)].map(([, value]) => value.trim());
  const mainProjectInputs = [...mainWorkflow.matchAll(/^\s*projectId:\s*(.+)$/gm)].map(([, value]) => value.trim());
  assert.deepEqual(devProjectInputs, ["${{ vars.FIREBASE_DEV_PROJECT_ID }}"]);
  assert.deepEqual(mainProjectInputs, [PRODUCTION_FIREBASE_CONFIG.projectId]);
  assert.match(devWorkflow, /FIREBASE_DEV_SERVICE_ACCOUNT/);
  assert.doesNotMatch(devWorkflow, /secrets\.FIREBASE_SERVICE_ACCOUNT/);
  assert.match(mainWorkflow, /secrets\.FIREBASE_SERVICE_ACCOUNT/);
  assert.doesNotMatch(mainWorkflow, /FIREBASE_DEV_/);

  const configuredDevProjectId = process.env.FIREBASE_DEV_PROJECT_ID?.trim();
  if (configuredDevProjectId) {
    assert.notEqual(configuredDevProjectId, PRODUCTION_FIREBASE_CONFIG.projectId);
  }
});

console.log(`Dev isolation tests: ${passed} passed`);
