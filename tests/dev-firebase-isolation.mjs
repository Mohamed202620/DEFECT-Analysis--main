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

console.log("Shared Firebase project for dev Hosting");
test("dev and main Hosting targets are separate sites in the existing project", async () => {
  const rc = JSON.parse(await readFile(new URL("../.firebaserc", import.meta.url), "utf8"));
  assert.equal(rc.projects.default, PRODUCTION_FIREBASE_CONFIG.projectId);
  assert.deepEqual(rc.targets[PRODUCTION_FIREBASE_CONFIG.projectId].hosting.dev, ["my-dev-2026"]);
  assert.deepEqual(rc.targets[PRODUCTION_FIREBASE_CONFIG.projectId].hosting.main, [
    PRODUCTION_FIREBASE_CONFIG.projectId
  ]);
});
test("dev deploy targets the dev site in the existing project with its authorized credential", async () => {
  const [devWorkflow, mainWorkflow] = await Promise.all([
    readFile(new URL("../.github/workflows/firebase-hosting-dev.yml", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/firebase-hosting-main.yml", import.meta.url), "utf8")
  ]);

  const mainProjectInputs = [...mainWorkflow.matchAll(/^\s*projectId:\s*(.+)$/gm)].map(([, value]) => value.trim());
  assert.match(devWorkflow, /projectId:\s*maintenance-defect-system/);
  assert.match(devWorkflow, /target:\s*dev/);
  assert.match(devWorkflow, /node scripts\/validate-production-deploy\.mjs/);
  assert.doesNotMatch(devWorkflow, /FIREBASE_DEV_/);
  assert.deepEqual(mainProjectInputs, [PRODUCTION_FIREBASE_CONFIG.projectId]);
  assert.match(mainWorkflow, /Validate production deploy credential project/);
  assert.match(mainWorkflow, /permissions:\s*\n\s+contents: read/);

  for (const workflow of [devWorkflow, mainWorkflow]) {
    assert.match(workflow, /FIREBASE_SERVICE_ACCOUNT:\s*\$\{\{\s*secrets\.FIREBASE_SERVICE_ACCOUNT\s*\}\}/);
    assert.match(workflow, /firebaseServiceAccount:\s*\$\{\{\s*env\.FIREBASE_SERVICE_ACCOUNT_NORMALIZED\s*\}\}/);
  }
  // Production Hosting must be gated by the GitHub "production" environment (runbook: approvals §3);
  // the dev workflow must not use it, so dev pushes never wait on or consume production approval.
  assert.match(mainWorkflow, /^  deploy:\n(?:.*\n)*?    environment: production$/m);
  assert.doesNotMatch(devWorkflow, /^\s{4}environment:/m);
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
