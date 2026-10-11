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
  assert.deepEqual(rc.targets[config.projectId].hosting.dev, [config.hostingSite]);
  assert.deepEqual(rc.targets[PRODUCTION_FIREBASE_CONFIG.projectId].hosting.main, [PRODUCTION_FIREBASE_CONFIG.projectId]);
});
test("dev workflow no longer references production project or deploy secret", async () => {
  const workflow = await readFile(new URL("../.github/workflows/firebase-hosting-dev.yml", import.meta.url), "utf8");
  assert.match(workflow, /FIREBASE_DEV_SERVICE_ACCOUNT/);
  assert.match(workflow, /projectId: \$\{\{ vars\.FIREBASE_DEV_PROJECT_ID \}\}/);
  assert.doesNotMatch(workflow, /FIREBASE_SERVICE_ACCOUNT(?!_DEV)/);
  assert.doesNotMatch(workflow, /projectId:\s*maintenance-defect-system/);
});

console.log(`Dev isolation tests: ${passed} passed`);
