import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepareDevDeployment } from "./devFirebaseIsolation.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generatedFiles = [".firebaserc", "api/config.js"];
const originals = new Map();
let exitCode = 1;

try {
  for (const relativePath of generatedFiles) {
    originals.set(relativePath, await readFile(path.join(root, relativePath)));
  }

  const config = await prepareDevDeployment({ root });
  const result = spawnSync(
    "firebase",
    ["deploy", "--only", "hosting:dev", "--project", config.projectId],
    { cwd: root, stdio: "inherit" }
  );

  if (result.error) {
    throw new Error("Firebase CLI could not be started; install and authenticate the CLI first.");
  }
  exitCode = result.status ?? 1;
} catch (error) {
  console.error(`Dev deployment blocked: ${error.message}`);
} finally {
  for (const [relativePath, contents] of originals) {
    if (contents) await writeFile(path.join(root, relativePath), contents);
  }
}

process.exitCode = exitCode;
