# MSCANCO Release and Recovery Runbook

This runbook is for an authorized release operator. It documents procedures; the commands below have **not** been run against Firebase production. Never use production data or credentials for local Emulator tests.

## Pre-release checks

Run from the reviewed commit with a clean working tree:

```sh
npm ci
npm test
npm run test:rules
npm run lint
npm run build
npm audit --omit=dev
npm audit
```

`test:rules` starts only the Firestore Emulator with the fixed `demo-defect-rules` project ID. It must not be changed to a real Firebase project ID.

Review both audit results. Production-only auditing does not cover development and CI tools; unresolved high or critical findings in either dependency set require remediation or explicit documented risk acceptance before release.

Before approval, verify the release artifact and commit, review the Firestore rules/index diff, check the Firebase Console project and Hosting target through an authorized read-only process, and confirm that the production rules match the reviewed source. Client-side configuration and this repository alone cannot prove the deployed Firebase state.

## Deployment approvals

1. Deploy only from a reviewed pull request merged to the protected `main` branch.
2. Require at least two independent approvals, including a code owner for authorization/rules changes. Require all checks, including `npm run test:rules`, to pass; dismiss stale approvals after new commits.
3. Require an authorized production environment approval before the main Hosting workflow can access its deploy credential. Limit who can approve and who can modify workflow/branch protections.
4. Review the exact target project, Hosting site, changed assets, service-worker build ID, rules, indexes, and recovery point immediately before approval.
5. For rules or indexes, use an explicit project selection and obtain a separate approval from the Firebase owner. Do not infer the active production project from a developer's local `.firebaserc`.
6. GitHub Actions in the deployment workflows are pinned to immutable commit SHAs. Re-verify their upstream source and release tag before changing a pin.

The repository workflows currently trigger on pushes to their named branches. Repository protection and required-environment approvals are GitHub settings, not guaranteed by workflow YAML; an administrator must verify and configure them.

## Publishing Firestore rules and indexes

The Hosting workflow deploys Hosting only. Rules and indexes go out through the manual workflow `Deploy Firestore Rules and Indexes (manual)` (`.github/workflows/deploy-firestore-rules.yml`): run it from `main` after merging any change to `firestore.rules` or `firestore.indexes.json`. It runs the Emulator rules tests first and requires the `production` environment approval. Confirm the effective rules in Firebase Console afterwards.

## Firebase Hosting rollback

1. Announce an incident and pause further releases. Record the current Hosting release/version, affected site, commit, and incident owner.
2. In Firebase Console, open **Hosting → the production site → Release history**.
3. Select the last known-good release and use **Rollback**. Confirm the site/project shown in the console before approving.
4. Verify the public site, sign-in, core ticket/PM workflows, and QR flow using approved smoke-test accounts. Record the new rollback release/version and time.
5. Keep the failing version and logs for diagnosis. Do not delete releases or attempt to rewrite Git history.

Hosting rollback restores hosted files only. It does not roll back Firestore rules, indexes, user data, Cloud Functions, or a Cloudflare Worker.

## Firestore rules and indexes recovery

1. Identify the last reviewed commit containing the known-good `firestore.rules` and `firestore.indexes.json`. Preserve the current versions for incident analysis.
2. Ask the Firebase owner to confirm the exact target project and approve the recovery. Do not use an implicit/default project.
3. From a clean checkout of the selected commit, run the Emulator rules suite and inspect the index diff before any production action.
4. With a separately authorized production credential and explicit project ID, deploy only the needed resources:

   ```sh
   firebase deploy --only firestore:rules,firestore:indexes --project <EXPLICIT_PROJECT_ID>
   ```

   Omit either resource selector if that resource does not require recovery. Never include Hosting or Functions unless separately approved.
5. Verify the effective rules and index state in Firebase Console or another authorized read-only method. Keep the deployment result and commit in the incident record.

Rules/index rollback can immediately change which operations clients may perform. Check for index build completion and expected query behavior before closing the incident.

## Firestore data backup and restore

### Backup readiness

- Enable and periodically test Firestore point-in-time recovery and/or scheduled backups for the production database, after the data owner approves retention and cost.
- Keep on-demand exports in a restricted Cloud Storage bucket with versioning/retention, access logging, and a location appropriate to the Firestore database. A backup in the same failure domain is not sufficient by itself.
- Before a high-risk migration or release, record the latest successful backup/export ID, timestamp, project, database, retention deadline, and a successful restore-test reference.
- A Firestore export is a recovery input, not proof of a tested restore. Practice importing into an isolated recovery project and validate record counts and critical relationships.

### On-demand export

Only an authorized operator should execute this after confirming the explicit production project and destination bucket:

```sh
gcloud firestore export gs://<RESTRICTED_BACKUP_BUCKET>/<UNIQUE_BACKUP_PATH> \
  --project=<EXPLICIT_PROJECT_ID>
```

Protect the export and its metadata as production data. Do not paste export paths, customer data, or credentials into public logs/issues.

### Recovery procedure

1. Declare the incident, stop or constrain writes if approved, and record the affected time range and recovery point.
2. Preserve a fresh export of the current state when possible; do not overwrite or delete the only known-good backup.
3. Prefer Firestore point-in-time recovery into a **new recovery database/project** within the configured retention window. Otherwise import the selected export into an isolated recovery project first:

   ```sh
   gcloud firestore import gs://<RESTRICTED_BACKUP_BUCKET>/<UNIQUE_BACKUP_PATH> \
     --project=<ISOLATED_RECOVERY_PROJECT_ID>
   ```

4. Validate collection/document counts, user-to-record relationships, timestamps, attachments/references, and application smoke tests against the recovery environment. Confirm rules/indexes there separately.
5. For production restoration, obtain explicit data-owner and incident-commander approval, document downtime and data-loss boundaries, take a current-state backup, and follow the approved migration/cutover plan. A bulk import into an existing database is not a general-purpose point-in-time rollback and may leave newer records or overwrite matching documents.
6. Verify production behavior and data after an approved cutover. Record the recovery source, operator, approvers, commands, timestamps, and validation evidence.

Never run import/restore commands against production as a test. This repository does not establish whether PITR, scheduled backups, retention, or restore permissions are enabled in the live project.

## Post-release verification

- Confirm the production Hosting release/version and serving site.
- Verify Authentication, an authorized ticket lifecycle, PM submission, notification privacy, and QR scan-to-checklist submission with approved test accounts and data.
- Confirm the reviewed rules/indexes were actually deployed; check rules/indexes separately from the Hosting release.
- Monitor Firebase/Worker error rates and permission-denied events. Keep the rollback release and backup references available until the release owner closes the window.

## Sequential record numbers: reset before official launch

Numbers are per record type and short: `BR-001` (tickets), `PM-001` (PM orders), `KZ-001` (Kaizen), `ME-001`, `CL-001`, `PR-001`, `DF-001`. Each number is reserved in the same atomic batch that writes the record (rules enforce `counters/{type}.current` increases by exactly 1), so numbers are never duplicated or skipped.

To start from 001 at launch, **after test data has been cleaned by the data owner**, sign in as an active admin and run once from the browser console:

```js
const seq = await import('/js/services/sequenceApi.js');
await seq.resetSequenceCountersForLaunch({ dryRun: true }); // report only
await seq.resetSequenceCountersForLaunch();                  // resets counters only
```

The function only writes `counters/*`. It refuses (per type) while any record with that prefix still exists, and never touches records, relations, users or permissions. Deploy the updated `firestore.rules` before the Hosting release.

## Cloudflare Worker rollback

1. Identify the last known-good Worker version/deployment ID and its corresponding commit. Preserve the failing deployment and logs.
2. From a reviewed checkout of that commit, redeploy with the authorized Wrangler credential and explicit environment/account:

   ```sh
   npx wrangler deploy --env production
   ```

   (Use the environment that matches production; confirm the target account and Worker name before running.)
3. Verify Worker health (e.g. `/health` or equivalent), CORS, push/VAPID flow, and secret handling with approved test data. Confirm no secrets were printed in logs.
4. If the Worker must be taken offline, revert to the previous deployment via the Cloudflare dashboard's version history or `wrangler rollback` (where available) rather than editing code ad hoc.
5. Record deployment ID, commit, operator, approver, and verification evidence in the incident record. Worker rollback does not roll back Firestore rules, indexes, Hosting, or data.
