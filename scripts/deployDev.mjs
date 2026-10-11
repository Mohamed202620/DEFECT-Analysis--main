import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PRODUCTION_FIREBASE_CONFIG } from "../js/firebaseDefaults.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = spawnSync(
  "firebase",
  ["deploy", "--only", "hosting:dev", "--project", PRODUCTION_FIREBASE_CONFIG.projectId],
  { cwd: root, stdio: "inherit" }
);

if (result.error) {
  console.error("Firebase CLI could not be started; install and authenticate the CLI first.");
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
