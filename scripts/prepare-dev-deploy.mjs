import { prepareDevDeployment } from "./devFirebaseIsolation.mjs";

try {
  const config = await prepareDevDeployment();
  console.log(`Validated isolated dev Firebase project: ${config.projectId}`);
} catch (error) {
  console.error(`Dev deployment blocked: ${error.message}`);
  process.exitCode = 1;
}
