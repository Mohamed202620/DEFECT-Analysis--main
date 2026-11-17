import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PRODUCTION_FIREBASE_CONFIG } from "../js/firebaseDefaults.js";
import { validateProductionDeploymentConfig } from "../scripts/validate-production-deploy.mjs";

let passed = 0;
const pending = [];
const test = (name, fn) => {
  pending.push(
    Promise.resolve()
      .then(fn)
      .then(() => {
        passed++;
        console.log("  ✅", name);
      })
  );
};

console.log("Production Firebase Hosting isolation");
test("production workflow deploys sequentially to the only configured main target", async () => {
  const [rc, firebaseConfig, mainWorkflow] = await Promise.all([
    readFile(new URL("../.firebaserc", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../firebase.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../.github/workflows/firebase-hosting-main.yml", import.meta.url), "utf8")
  ]);

  assert.equal(rc.projects.default, PRODUCTION_FIREBASE_CONFIG.projectId);
  assert.deepEqual(Object.keys(rc.targets), [PRODUCTION_FIREBASE_CONFIG.projectId]);
  assert.deepEqual(Object.keys(rc.targets[PRODUCTION_FIREBASE_CONFIG.projectId].hosting), ["main"]);
  assert.deepEqual(rc.targets[PRODUCTION_FIREBASE_CONFIG.projectId].hosting.main, [
    PRODUCTION_FIREBASE_CONFIG.projectId
  ]);
  assert.deepEqual(firebaseConfig.hosting.map(({ target }) => target), ["main"]);

  assert.match(mainWorkflow, /Validate production deploy credential project/);
  assert.match(mainWorkflow, /permissions:\s*\n\s+contents: read/);
  assert.match(mainWorkflow, /^  deploy:\n(?:.*\n)*?    environment: production$/m);
  assert.match(mainWorkflow, /firebase deploy --only firestore:rules,firestore:indexes --project maintenance-defect-system/);
  assert.match(mainWorkflow, /firebase deploy --only hosting:main --project maintenance-defect-system/);
  assert.match(mainWorkflow, /GOOGLE_APPLICATION_CREDENTIALS/);
  assert.match(mainWorkflow, /firebase-production-deploy/);
  assert.ok(mainWorkflow.indexOf("npm run test:rules") < mainWorkflow.indexOf("Deploy Firestore (if changed), then Hosting"));
});

test("shared deploy credential must belong to the existing Firebase project", () => {
  const credential = (
    project_id = PRODUCTION_FIREBASE_CONFIG.projectId,
    private_key = "never-print-this"
  ) =>
    JSON.stringify({
      type: "service_account",
      project_id,
      client_email: `deployer@${project_id}.iam.gserviceaccount.com`,
      private_key
    });
  const validate = (value) => validateProductionDeploymentConfig({
    FIREBASE_SERVICE_ACCOUNT: value
  });

  assert.doesNotThrow(() => validateProductionDeploymentConfig({
    FIREBASE_SERVICE_ACCOUNT: credential(PRODUCTION_FIREBASE_CONFIG.projectId)
  }));
  assert.doesNotThrow(() => validate(` \n ${credential()} \n `));
  assert.doesNotThrow(() => validate(`'${credential()}'`));
  assert.doesNotThrow(() => validate(`"${credential()}"`));
  const base64Credential = validate(Buffer.from(credential()).toString("base64"));
  assert.equal(JSON.parse(base64Credential).project_id, PRODUCTION_FIREBASE_CONFIG.projectId);
  const escapedNewlineCredential = validate(credential(undefined, "line one\\nline two"));
  assert.equal(JSON.parse(escapedNewlineCredential).private_key, "line one\nline two");
  assert.throws(
    () => validateProductionDeploymentConfig({}),
    /FIREBASE_SERVICE_ACCOUNT is empty/
  );
  assert.throws(() => validate(" \n "), /FIREBASE_SERVICE_ACCOUNT is empty/);
  const invalidSecret = "not-json-secret";
  assert.throws(
    () => validate(invalidSecret),
    (error) => {
      assert.match(error.message, /not valid JSON or base64-encoded JSON/);
      assert.doesNotMatch(error.message, new RegExp(invalidSecret));
      return true;
    }
  );
  assert.throws(
    () => validate(credential("another-firebase-project")),
    /must belong to the production project/
  );

  for (const field of ["type", "project_id", "client_email", "private_key"]) {
    const incomplete = JSON.parse(credential());
    delete incomplete[field];
    assert.throws(
      () => validate(JSON.stringify(incomplete)),
      new RegExp(`missing required field\\(s\\): ${field}`)
    );
  }
});

await Promise.all(pending);
console.log(`Shared Firebase deployment tests: ${passed} passed`);
