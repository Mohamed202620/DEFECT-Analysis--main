import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { after, before, beforeEach, test } from "node:test";
import { runInNewContext } from "node:vm";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  orderBy,
  query,
  setDoc,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";
import { parseQrPayload } from "../js/utils/qrPayload.js";

const qrcodeSource = readFileSync(new URL("../js/vendor/qrcode-generator.js", import.meta.url), "utf8");
const qrcode = runInNewContext(`${qrcodeSource}\nqrcode`, {});
globalThis.self = globalThis;
await import("../js/vendor/jsQR.js");
const jsQR = globalThis.jsQR;
const projectId = "demo-defect-rules";
let testEnvironment;

const users = {
  admin: { role: "admin", status: "active", name: "Admin", machineDepartment: "backend" },
  manager: { role: "manager", status: "active", name: "Manager", machineDepartment: "backend" },
  supervisor: { role: "supervisor", status: "active", name: "Supervisor", machineDepartment: "backend" },
  engineer: { role: "engineer", status: "active", name: "Engineer", machineDepartment: "frontend" },
  technician: { role: "technician", status: "active", name: "Technician", machineDepartment: "backend" },
  reporter: { role: "reporter", status: "active", name: "Reporter", machineDepartment: "backend" },
  pending: { role: "pending", status: "pending", name: "Pending", machineDepartment: "backend" },
  disabled: { role: "admin", status: "disabled", name: "Disabled", machineDepartment: "backend" }
};

const ticket = (overrides = {}) => ({
  status: "pending",
  reportedByUid: "reporter",
  description: "Machine stopped",
  assignedTo: null,
  assignedToUid: null,
  updatedAt: "before",
  ...overrides
});

const logData = (userId, action, fromStatus, toStatus, overrides = {}) => ({
  action,
  fromStatus,
  toStatus,
  note: "",
  by: users[userId].name,
  byUid: userId,
  byRole: users[userId].role,
  at: "2026-10-11T09:00:00.000Z",
  ...overrides
});

async function seed(path, data) {
  await testEnvironment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), path), data);
  });
}

function dbFor(userId) {
  return testEnvironment.authenticatedContext(userId).firestore();
}

async function seedBase() {
  for (const [uid, profile] of Object.entries(users)) {
    await seed(`users/${uid}`, profile);
  }
  await seed("machineTypes/backend-press", {
    key: "Backend Press",
    units: ["01"],
    department: "backend",
    active: true
  });
  await seed("machineTypes/frontend-cutter", {
    key: "Frontend Cutter",
    units: [],
    department: "frontend",
    active: true
  });
}

before(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: await readFile(new URL("../firestore.rules", import.meta.url), "utf8")
    }
  });
});

beforeEach(async () => {
  await testEnvironment.clearFirestore();
  await seedBase();
});

after(async () => {
  await testEnvironment?.cleanup();
});

test("active roles can read operational records; pending and disabled accounts cannot", async () => {
  await seed("tickets/shared", ticket());
  for (const uid of ["admin", "manager", "supervisor", "engineer", "technician", "reporter"]) {
    await assertSucceeds(getDoc(doc(dbFor(uid), "tickets/shared")), uid);
  }
  await assertFails(getDoc(doc(dbFor("pending"), "tickets/shared")));
  await assertFails(getDoc(doc(dbFor("disabled"), "tickets/shared")));
});

test("technicians can read their dashboard ticket queries without broadening rules", async () => {
  await seed("tickets/assigned-to-technician", ticket({
    assignedToUid: "technician",
    createdAt: "2026-10-12T07:00:00.000Z"
  }));
  await seed("tickets/reported-by-technician", ticket({
    reportedByUid: "technician",
    createdAt: "2026-10-12T06:00:00.000Z"
  }));
  await seed("tickets/other-ticket", ticket({
    reportedByUid: "reporter",
    createdAt: "2026-10-12T05:00:00.000Z"
  }));

  const technicianTickets = collection(dbFor("technician"), "tickets");
  const assignedQuery = query(
    technicianTickets,
    where("assignedToUid", "==", "technician"),
    orderBy("createdAt", "desc")
  );
  const reportedQuery = query(
    technicianTickets,
    where("reportedByUid", "==", "technician"),
    orderBy("createdAt", "desc")
  );
  const allTickets = query(collection(dbFor("admin"), "tickets"), orderBy("createdAt", "desc"));
  const supervisorTickets = query(collection(dbFor("supervisor"), "tickets"), orderBy("createdAt", "desc"));

  assert.equal((await assertSucceeds(getDocs(assignedQuery))).size, 1);
  assert.equal((await assertSucceeds(getDocs(reportedQuery))).size, 1);
  assert.equal((await assertSucceeds(getDocs(allTickets))).size, 3);
  assert.equal((await assertSucceeds(getDocs(supervisorTickets))).size, 3);
  await assertFails(getDocs(query(
    collection(dbFor("pending"), "tickets"),
    where("assignedToUid", "==", "technician"),
    orderBy("createdAt", "desc")
  )));
});

test("self-service user updates cannot activate an account or escalate a role", async () => {
  await assertFails(updateDoc(doc(dbFor("technician"), "users/technician"), { role: "admin" }));
  await assertFails(updateDoc(doc(dbFor("technician"), "users/technician"), { status: "disabled" }));
  await assertFails(updateDoc(doc(dbFor("pending"), "users/pending"), { status: "active", role: "admin" }));
  await assertFails(updateDoc(doc(dbFor("disabled"), "users/disabled"), { status: "active" }));
});

test("only an active administrator may change another user's role", async () => {
  await assertSucceeds(updateDoc(doc(dbFor("admin"), "users/technician"), { role: "engineer" }));
  await assertFails(updateDoc(doc(dbFor("manager"), "users/technician"), { role: "admin" }));
  await assertFails(updateDoc(doc(dbFor("disabled"), "users/technician"), { role: "admin" }));
});

test("an active reporter can create only a ticket attributed to their own UID", async () => {
  const reporterDb = dbFor("reporter");
  await assertSucceeds(setDoc(doc(reporterDb, "tickets/reporter-created"), {
    status: "pending",
    reportedByUid: "reporter",
    description: "Machine stopped",
    createdAtServer: serverTimestamp(),
    isSelfResolved: false
  }));
  await assertFails(setDoc(doc(dbFor("technician"), "tickets/forged-reporter"), {
    status: "pending",
    reportedByUid: "reporter",
    description: "Machine stopped",
    createdAtServer: serverTimestamp(),
    isSelfResolved: false
  }));
});

test("a manager assigns a ticket and appends a matching, actor-bound history entry atomically", async () => {
  await seed("tickets/assignable", ticket());
  const managerDb = dbFor("manager");
  const batch = writeBatch(managerDb);
  batch.update(doc(managerDb, "tickets/assignable"), {
    status: "assigned",
    assignedTo: users.engineer.name,
    assignedToUid: "engineer",
    updatedAt: "after",
    updatedBy: users.manager.name
  });
  batch.set(
    doc(managerDb, "tickets/assignable/logs/assign-1"),
    logData("manager", "assign", "pending", "assigned")
  );
  await assertSucceeds(batch.commit());
});

test("an attacker cannot append a ticket log or forge an actor for another user's ticket", async () => {
  await seed("tickets/victim-ticket", ticket());
  const attackerDb = dbFor("technician");
  await assertFails(setDoc(
    doc(attackerDb, "tickets/victim-ticket/logs/forged"),
    logData("technician", "assign", "pending", "assigned")
  ));
  await assertFails(setDoc(
    doc(attackerDb, "tickets/victim-ticket/logs/forged-actor"),
    logData("manager", "assign", "pending", "assigned")
  ));
  await assertFails(setDoc(
    doc(attackerDb, "tickets/missing-ticket/logs/orphan"),
    logData("technician", "start", "assigned", "in_progress")
  ));
});

test("ticket transitions are role-checked and cannot change reporter identity", async () => {
  await seed("tickets/ticket-1", ticket());
  await assertFails(updateDoc(doc(dbFor("technician"), "tickets/ticket-1"), {
    status: "assigned",
    assignedTo: "Engineer",
    assignedToUid: "engineer",
    updatedAt: "after",
    updatedBy: users.technician.name
  }));
  await assertFails(updateDoc(doc(dbFor("manager"), "tickets/ticket-1"), {
    status: "closed",
    updatedAt: "after",
    updatedBy: users.manager.name
  }));
  await assertFails(updateDoc(doc(dbFor("manager"), "tickets/ticket-1"), {
    status: "assigned",
    assignedTo: users.engineer.name,
    assignedToUid: "engineer",
    reportedByUid: "manager",
    updatedAt: "after",
    updatedBy: users.manager.name
  }));
});

test("only the assigned active technician or an administrator can start assigned work", async () => {
  await seed("tickets/assigned", ticket({
    status: "assigned",
    assignedTo: users.technician.name,
    assignedToUid: "technician"
  }));
  const technicianDb = dbFor("technician");
  const batch = writeBatch(technicianDb);
  batch.update(doc(technicianDb, "tickets/assigned"), {
    status: "in_progress",
    updatedAt: "after",
    updatedBy: users.technician.name
  });
  batch.set(
    doc(technicianDb, "tickets/assigned/logs/start-1"),
    logData("technician", "start", "assigned", "in_progress")
  );
  await assertSucceeds(batch.commit());

  await seed("tickets/assigned-to-someone-else", ticket({
    status: "assigned",
    assignedTo: users.technician.name,
    assignedToUid: "technician"
  }));
  await assertFails(updateDoc(doc(dbFor("engineer"), "tickets/assigned-to-someone-else"), {
    status: "in_progress",
    updatedAt: "after",
    updatedBy: users.engineer.name
  }));
});

test("an administrator reviews a suggestion with a matching append-only log", async () => {
  await seed("suggestions/suggestion-1", {
    status: "new",
    name: users.reporter.name,
    submittedByUid: "reporter",
    title: "Improve line setup",
    updatedAt: "before"
  });
  const adminDb = dbFor("admin");
  const batch = writeBatch(adminDb);
  batch.update(doc(adminDb, "suggestions/suggestion-1"), {
    status: "under_review",
    updatedAt: "after",
    updatedBy: users.admin.name
  });
  batch.set(
    doc(adminDb, "suggestions/suggestion-1/logs/review-1"),
    logData("admin", "review", "new", "under_review")
  );
  await assertSucceeds(batch.commit());
});

test("an attacker cannot append another user's suggestion log", async () => {
  await seed("suggestions/victim", {
    status: "new",
    name: users.reporter.name,
    submittedByUid: "reporter",
    title: "Suggestion",
    updatedAt: "before"
  });
  await assertFails(setDoc(
    doc(dbFor("technician"), "suggestions/victim/logs/forged"),
    logData("technician", "review", "new", "under_review")
  ));
});

test("display-name matching cannot resubmit a legacy suggestion without submittedByUid", async () => {
  await seed("suggestions/legacy", {
    status: "revision_requested",
    name: users.technician.name,
    title: "Old title",
    problem: "Old problem",
    solution: "Old solution",
    updatedAt: "before"
  });
  await assertFails(updateDoc(doc(dbFor("technician"), "suggestions/legacy"), {
    status: "under_review",
    title: "Changed title",
    problem: "Changed problem",
    solution: "Changed solution",
    updatedAt: "after"
  }));
});

test("a suggestion owner can resubmit by immutable UID, but another matching-name user cannot", async () => {
  await seed("suggestions/owned", {
    status: "revision_requested",
    name: users.reporter.name,
    submittedByUid: "reporter",
    title: "Old title",
    problem: "Old problem",
    solution: "Old solution",
    updatedAt: "before"
  });
  const reporterDb = dbFor("reporter");
  const batch = writeBatch(reporterDb);
  batch.update(doc(reporterDb, "suggestions/owned"), {
    status: "under_review",
    title: "Updated title",
    problem: "Updated problem",
    solution: "Updated solution",
    updatedAt: "after"
  });
  batch.set(
    doc(reporterDb, "suggestions/owned/logs/resubmit-1"),
    logData("reporter", "resubmit", "revision_requested", "under_review")
  );
  await assertSucceeds(batch.commit());

  await seed("suggestions/owned-by-other", {
    status: "revision_requested",
    name: users.technician.name,
    submittedByUid: "reporter",
    title: "Old title",
    problem: "Old problem",
    solution: "Old solution",
    updatedAt: "before"
  });
  await assertFails(updateDoc(doc(dbFor("technician"), "suggestions/owned-by-other"), {
    status: "under_review",
    title: "Changed title",
    problem: "Changed problem",
    solution: "Changed solution",
    updatedAt: "after"
  }));
});

test("machine-error records must use allowed fields and match the authoritative machine department", async () => {
  const validRecord = {
    errorCode: "E-5",
    errorMessage: "Motor stopped",
    machine: "Backend Press 01",
    machineUnit: "01",
    machineTypeId: "backend-press",
    line: "1",
    cause: "Overload",
    solution: "Reset",
    steps: "Inspect motor",
    createdBy: { name: users.technician.name, phone: "", job: "" },
    department: "backend",
    status: "pending_review",
    createdAt: "2026-10-11T09:00:00.000Z"
  };
  await assertSucceeds(setDoc(doc(dbFor("technician"), "machineErrors/error_E-5"), validRecord));
  await assertFails(setDoc(
    doc(dbFor("technician"), "machineErrors/error_E-6"),
    { ...validRecord, errorCode: "E-6", machine: "Frontend Cutter", machineUnit: "", machineTypeId: "frontend-cutter" }
  ));
  await assertFails(setDoc(
    doc(dbFor("technician"), "machineErrors/error_E-7"),
    { ...validRecord, errorCode: "E-7", injectedField: "<script>alert(1)</script>" }
  ));
});

test("PM, machine-error logs, and checklists require a catalog-backed machine/department pair", async () => {
  const technicianDb = dbFor("technician");
  await assertSucceeds(setDoc(doc(technicianDb, "pmRecords/pm-1"), {
    machine: "Backend Press 01",
    machineTypeId: "backend-press",
    machineUnit: "01",
    department: "backend",
    createdAt: "2026-10-11T09:00:00.000Z"
  }));
  await assertFails(setDoc(doc(technicianDb, "pmRecords/pm-wrong"), {
    machine: "Frontend Cutter",
    machineTypeId: "frontend-cutter",
    department: "backend",
    createdAt: "2026-10-11T09:00:00.000Z"
  }));
  await assertSucceeds(setDoc(doc(technicianDb, "machineErrorLogs/log-1"), {
    machine: "Backend Press",
    machineTypeId: "backend-press",
    errorCode: "E-5",
    scannedBy: { name: users.technician.name, job: "Technician" },
    department: "backend",
    scannedAt: "2026-10-11T09:00:00.000Z"
  }));
  await assertFails(setDoc(doc(technicianDb, "machineErrorLogs/log-wrong"), {
    machine: "Frontend Cutter",
    machineTypeId: "frontend-cutter",
    errorCode: "E-6",
    department: "backend",
    scannedAt: "2026-10-11T09:00:00.000Z"
  }));
  await assertSucceeds(setDoc(doc(technicianDb, "machineChecklists/check-1"), {
    type: "am",
    machine: "Backend Press 01",
    machineTypeId: "backend-press",
    machineUnit: "01",
    department: "backend",
    items: [],
    createdAt: "2026-10-11T09:00:00.000Z"
  }));
  await assertFails(setDoc(doc(technicianDb, "machineChecklists/check-wrong"), {
    type: "am",
    machine: "Frontend Cutter",
    machineTypeId: "frontend-cutter",
    department: "backend",
    items: [],
    createdAt: "2026-10-11T09:00:00.000Z"
  }));
});

test("notification reads and updates stay scoped to the recipient", async () => {
  await seed("notifications/for-reporter", {
    forUid: "reporter",
    type: "new_ticket",
    message: "A ticket needs attention",
    read: false
  });
  await assertSucceeds(getDoc(doc(dbFor("reporter"), "notifications/for-reporter")));
  await assertFails(getDoc(doc(dbFor("technician"), "notifications/for-reporter")));
  await assertSucceeds(updateDoc(doc(dbFor("reporter"), "notifications/for-reporter"), { read: true }));
  await assertFails(updateDoc(doc(dbFor("technician"), "notifications/for-reporter"), { read: true }));
});

test("active users may send only well-formed notifications attributed to themselves", async () => {
  const reporterDb = dbFor("reporter");
  await assertSucceeds(setDoc(doc(reporterDb, "notifications/to-manager"), {
    forUid: "manager",
    type: "new_ticket",
    message: "A new ticket was reported",
    read: false,
    createdByUid: "reporter"
  }));
  await assertFails(setDoc(doc(reporterDb, "notifications/forged-sender"), {
    forUid: "manager",
    type: "new_ticket",
    message: "A new ticket was reported",
    read: false,
    createdByUid: "manager"
  }));
  await assertFails(setDoc(doc(reporterDb, "notifications/extra-field"), {
    forUid: "manager",
    type: "new_ticket",
    message: "A new ticket was reported",
    read: false,
    createdByUid: "reporter",
    arbitrary: true
  }));
});

test("machine catalog is readable by active users but writable only by administrators", async () => {
  await assertSucceeds(getDoc(doc(dbFor("technician"), "machineTypes/backend-press")));
  await assertFails(setDoc(doc(dbFor("technician"), "machineTypes/new-machine"), {
    key: "Unauthorized Machine",
    units: [],
    department: "backend"
  }));
  await assertSucceeds(setDoc(doc(dbFor("admin"), "machineTypes/new-machine"), {
    key: "Admin Machine",
    units: [],
    department: "backend"
  }));
});

test("unmatched breakdown paths stay denied instead of falling through a permissive catch-all", async () => {
  await assertFails(setDoc(doc(dbFor("technician"), "breakdowns/unmatched"), { status: "open" }));
});

test("QR image scan resolves a catalog machine and submits a permitted checklist", async () => {
  const qrText = "MID:backend-press";
  const qr = qrcode(4, "M");
  qr.addData(qrText);
  qr.make();
  const moduleCount = qr.getModuleCount();
  const scale = 8;
  const quietZone = 4;
  const dimension = (moduleCount + quietZone * 2) * scale;
  const pixels = new Uint8ClampedArray(dimension * dimension * 4);

  for (let y = 0; y < dimension; y += 1) {
    for (let x = 0; x < dimension; x += 1) {
      const row = Math.floor(y / scale) - quietZone;
      const column = Math.floor(x / scale) - quietZone;
      const dark = row >= 0 && column >= 0 && row < moduleCount && column < moduleCount
        && qr.isDark(row, column);
      const offset = (y * dimension + x) * 4;
      const value = dark ? 0 : 255;
      pixels[offset] = value;
      pixels[offset + 1] = value;
      pixels[offset + 2] = value;
      pixels[offset + 3] = 255;
    }
  }

  const decoded = jsQR(pixels, dimension, dimension);
  assert.equal(decoded?.data, qrText, "the camera decoder reads the QR payload");
  const scanned = parseQrPayload(decoded.data);
  assert.deepEqual(scanned, { value: "backend-press", line: "" });

  const technicianDb = dbFor("technician");
  const machineSnapshot = await getDoc(doc(technicianDb, "machineTypes", scanned.value));
  assert.equal(machineSnapshot.data()?.department, "backend", "scan resolves the registered machine");

  await assertSucceeds(setDoc(doc(technicianDb, "machineChecklists/qr-am-1"), {
    type: "am",
    machine: "Backend Press",
    machineTypeId: machineSnapshot.id,
    department: machineSnapshot.data().department,
    items: [{ id: "guards", result: "ok" }],
    createdAt: "2026-10-11T09:00:00.000Z"
  }));
  await assertFails(setDoc(doc(technicianDb, "machineChecklists/qr-am-forged"), {
    type: "am",
    machine: "Frontend Cutter",
    machineTypeId: "frontend-cutter",
    department: "backend",
    items: [],
    createdAt: "2026-10-11T09:00:01.000Z"
  }));
});
