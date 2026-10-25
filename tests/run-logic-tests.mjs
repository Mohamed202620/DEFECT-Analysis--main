// اختبارات منطقية (بدون شبكة/Firebase) للإصلاحات الأساسية. التشغيل: node tests/run-logic-tests.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// stubs بسيطة لبيئة المتصفح (config.js بيقرأ window/localStorage وقت التحميل)
const _store = new Map();
globalThis.window = globalThis;
globalThis.localStorage = { getItem: k => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => _store.set(k, String(v)), removeItem: k => _store.delete(k), clear: () => _store.clear(), key: i => [..._store.keys()][i], get length() { return _store.size; } };
globalThis.sessionStorage = globalThis.localStorage;
globalThis.document = { getElementById: () => null, addEventListener() {}, documentElement: { lang: "ar", dir: "rtl" }, createElement: () => ({ style: {}, classList: { add() {}, remove() {} } }), querySelector: () => null, body: { appendChild() {} } };
try { Object.defineProperty(globalThis, "navigator", { value: { onLine: true, userAgent: "node" }, configurable: true }); } catch (_) {}
globalThis.addEventListener = () => {};

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

let passed = 0, failed = 0;
const t = async (name, fn) => {
  try { await fn(); passed++; console.log("  ✅", name); }
  catch (e) { failed++; console.log("  ❌", name, "\n     ", e.message); }
};

// ---------- escapeHtml ----------
const { escapeHtml, escapeJsArg, safeUrl } = await import("../js/utils/escapeHtml.js");
const { parseQrPayload } = await import("../js/utils/qrPayload.js");
console.log("escapeHtml");
await t("يهرّب وسوم HTML وعلامات التنصيص", () => {
  assert.equal(escapeHtml(`<img src=x onerror=alert(1)>`), "&lt;img src=x onerror=alert(1)&gt;");
  assert.equal(escapeHtml(`" onmouseover="x`), "&quot; onmouseover=&quot;x");
  assert.equal(escapeHtml(null), ""); assert.equal(escapeHtml(0), "0");
});
await t("escapeJsArg لا يسمح بالخروج من سلسلة onclick", () => {
  const out = escapeJsArg(`');alert(1);//`);
  assert.ok(!out.includes("'") && !out.includes('"') && !out.includes("<"));
});
await t("safeUrl يرفض javascript:", () => {
  assert.equal(safeUrl("javascript:alert(1)"), "");
  assert.ok(safeUrl("https://i.ibb.co/a.png").startsWith("https://"));
});
await t("QR payload parsing preserves raw machine values and extracts structured machine IDs", () => {
  assert.deepEqual(parseQrPayload("Bodymaker 01"), { value: "Bodymaker 01", line: "" });
  assert.deepEqual(parseQrPayload("MID:machine-backend"), { value: "machine-backend", line: "" });
  assert.deepEqual(parseQrPayload('{"m":"Bodymaker","u":"01","line":"1"}'), {
    value: "Bodymaker 01",
    line: "1"
  });
});
const issueViewSource = await readFile(new URL("../js/views/issueView.js", import.meta.url), "utf8");
await t("اسم المُبلّغ في تحذير البلاغ النشط يمر عبر escapeHtml", () => {
  assert.ok(issueViewSource.includes("${escapeHtml(t.reportedBy || t.reporter?.name ||"));
});

const [indexSource, brandingSource, attachmentPickerSource] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../js/branding.js", import.meta.url), "utf8"),
  readFile(new URL("../js/components/attachmentPicker.js", import.meta.url), "utf8")
]);
const [pmApiSource, managerDesktopSource] = await Promise.all([
  readFile(new URL("../js/services/pmApi.js", import.meta.url), "utf8"),
  readFile(new URL("../js/views/managerDesktop/ManagerDesktopHome.js", import.meta.url), "utf8")
]);
await t("manager dashboard PM card uses PM work orders of the current month", () => {
  assert.match(managerDesktopSource, /fetchPmOrdersApi\(\)/);
  assert.doesNotMatch(managerDesktopSource, /fetchPmRecordsApi\(\)/);
  assert.match(managerDesktopSource, /pmMonthTotal/);
  assert.match(managerDesktopSource, /let _managerDesktopLoadInFlight = null/);
  assert.match(managerDesktopSource, /if \(!_managerDesktopLoadInFlight\)/);
});
await t("PWA viewport leaves browser zoom available", () => {
  const viewport = indexSource.match(/<meta name="viewport" content="([^"]+)"/)?.[1] || "";
  assert.ok(viewport.includes("width=device-width"));
  assert.ok(!/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i.test(viewport));
  assert.ok(!indexSource.includes("touches.length > 1"));
  assert.ok(!indexSource.includes("gesturestart"));
});
await t("light theme applies a light base palette while dark remains dark", () => {
  assert.match(indexSource, /:root\s*\{[\s\S]*?--app-main-bg:\s*#f1f5f9/i);
  assert.match(indexSource, /\.dark,[\s\S]*?--app-main-bg:\s*#0f172a/i);
  assert.match(indexSource, /--app-card-bg:\s*#ffffff/i);
  assert.match(indexSource, /--app-text:\s*#0f172a/i);
});
await t("mobile header controls expose at least 44px touch targets", () => {
  assert.ok((brandingSource.match(/min-w-\[44px\] min-h-\[44px\]/g) || []).length >= 4);
});
await t("attachment processing failures are announced visibly", async () => {
  const { initAttachmentPicker } = await import("../js/components/attachmentPicker.js");
  const groupId = "attachmentFailureTest";
  const errorClasses = new Set(["hidden"]);
  const errorNode = {
    textContent: "",
    classList: {
      add: name => errorClasses.add(name),
      remove: name => errorClasses.delete(name)
    }
  };
  const emptyNode = { classList: { add() {}, remove() {} } };
  const gridNode = { innerHTML: "", querySelectorAll: () => [] };
  const cameraInput = { value: "", onchange: null };
  const nodes = new Map([
    [`${groupId}_camera_btn`, { onclick: null }],
    [`${groupId}_gallery_btn`, { onclick: null }],
    [`${groupId}_camera_input`, cameraInput],
    [`${groupId}_gallery_input`, { onchange: null }],
    [`${groupId}_preview_grid`, gridNode],
    [`${groupId}_empty_text`, emptyNode],
    [`${groupId}_error`, errorNode]
  ]);
  const originalGetElementById = document.getElementById;
  const originalConsoleError = console.error;
  let errorLogged = false;
  document.getElementById = id => nodes.get(id) || null;
  console.error = () => { errorLogged = true; };

  try {
    window.currentLang = "en";
    initAttachmentPicker(groupId);
    cameraInput.onchange({
      target: {
        files: [{ type: "text/plain", name: "invalid.txt", size: 1 }],
        value: "selected"
      }
    });
    await new Promise(resolve => setImmediate(resolve));

    assert.match(errorNode.textContent, /Could not process "invalid\.txt"/);
    assert.equal(errorClasses.has("hidden"), false);
    assert.equal(cameraInput.value, "");
    assert.equal(errorLogged, true);
  } finally {
    document.getElementById = originalGetElementById;
    console.error = originalConsoleError;
    delete window.currentLang;
  }

  assert.match(attachmentPickerSource, /role="alert" aria-live="polite"/);
});

const reportData = await import("../js/utils/reportData.js");
await t("custom report range includes full final day and excludes adjacent records", () => {
  const start = new Date("2026-04-01T00:00:00");
  const end = new Date("2026-04-02T23:59:59.999");
  const fixture = [
    { id: "before", createdAt: new Date(start.getTime() - 1).toISOString() },
    { id: "start", createdAt: start.toISOString() },
    { id: "last-millisecond", createdAt: end.toISOString() },
    { id: "after", createdAt: new Date(end.getTime() + 1).toISOString() },
    { id: "missing-date" }
  ];
  const result = reportData.filterRecordsByDateRange(fixture, "custom", "2026-04-01", "2026-04-02");
  assert.deepEqual(result.map(record => record.id), ["start", "last-millisecond"]);
});
await t("invalid and reversed custom report ranges fail explicitly", () => {
  assert.throws(
    () => reportData.filterRecordsByDateRange([], "custom", "2026-04-03", "2026-04-02"),
    /must not be after/
  );
  assert.throws(
    () => reportData.filterRecordsByDateRange([], "custom", "not-a-date", ""),
    /Invalid report start date/
  );
});
await t("monthly ticket status totals classify reopened consistently and sum to total", () => {
  const fixture = [
    { status: "pending" },
    { status: "assigned" },
    { status: "reopened" },
    { status: "resolved" },
    { status: "closed" },
    { status: "legacy-new-state" }
  ];
  const counts = reportData.getMonthlyTicketStatusCounts(fixture);
  assert.deepEqual(counts, { total: 6, closed: 1, resolved: 1, inProgress: 2, pending: 2 });
  assert.equal(counts.pending + counts.inProgress + counts.resolved + counts.closed, counts.total);
  assert.equal(reportData.formatReportTicketStatus("reopened", true), "In Progress");
  assert.equal(reportData.formatReportTicketStatus("reopened", false), "قيد التنفيذ");
});
await t("report filename date uses the local calendar date", () => {
  const localDate = new Date(2026, 0, 1, 0, 15);
  assert.equal(reportData.localDateStamp(localDate), "2026-01-01");
});

const { buildChecklistTemplateDocument } = await import("../js/services/checklistTemplateSync.js");
const { isOfflineActionOwnedBy } = await import("../js/services/offlineQueue.js");
const checklistDraft = {
  collection: "machineAmTemplates",
  targetId: "Machine 01",
  items: [{ id: "item-1" }],
  loadedVersion: 1,
  updatedAt: "2026-10-11T00:00:00.000Z",
  updatedBy: "Manager"
};
await t("offline checklist sync creates the next version and preserves history", () => {
  const firstSave = buildChecklistTemplateDocument(checklistDraft);
  assert.equal(firstSave.templateVersion, 2);
  assert.deepEqual(firstSave.history, [{
    version: 1,
    updatedAt: checklistDraft.updatedAt,
    updatedBy: checklistDraft.updatedBy,
    itemsCount: 1
  }]);

  const nextSave = buildChecklistTemplateDocument(
    { ...checklistDraft, loadedVersion: 2 },
    { templateVersion: 2, history: [{ version: 1 }] }
  );
  assert.equal(nextSave.templateVersion, 3);
  assert.equal(nextSave.history.length, 2);
});
await t("offline checklist sync refuses invalid targets and stale versions", () => {
  assert.throws(() => buildChecklistTemplateDocument({ ...checklistDraft, collection: "users" }), /Invalid checklist template action/);
  assert.throws(
    () => buildChecklistTemplateDocument(checklistDraft, { templateVersion: 2 }),
    /Checklist version conflict/
  );
});
const [ticketsApiSource, ticketDetailsSource, checklistApiSource, checklistIndexesSource, checklistViewSource, mainWorkflowSource] = await Promise.all([
  readFile(new URL("../js/services/ticketsApi.js", import.meta.url), "utf8"),
  readFile(new URL("../js/components/TicketDetailsModal.js", import.meta.url), "utf8"),
  readFile(new URL("../js/services/checklistApi.js", import.meta.url), "utf8"),
  readFile(new URL("../firestore.indexes.json", import.meta.url), "utf8"),
  readFile(new URL("../js/views/ChecklistBuilderView.js", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/firebase-hosting-main.yml", import.meta.url), "utf8")
]);
const suggestionsApiSource = await readFile(new URL("../js/services/suggestionsApi.js", import.meta.url), "utf8");
await t("unknown ticket log statuses are escaped before timeline rendering", () => {
  assert.match(ticketDetailsSource, /\$\{statusLabel\(log\.toStatus\) \|\| escapeHtml\(log\.toStatus \|\| ""\)\}/);
});
await t("report API index failures are not returned as empty successful reports", () => {
  const ticketsReport = ticketsApiSource.slice(
    ticketsApiSource.indexOf("export async function fetchTicketsForReportApi"),
    ticketsApiSource.indexOf("export async function fetchTicketsForSearchApi")
  );
  const suggestionsReport = suggestionsApiSource.slice(
    suggestionsApiSource.indexOf("export async function fetchSuggestionsForReportApi"),
    suggestionsApiSource.indexOf("export async function fetchSuggestionsForSearchApi")
  );
  assert.ok(ticketsReport.includes('return { status: "error", message: error?.message || "حدث خطأ غير متوقع" }'));
  assert.ok(suggestionsReport.includes('return { status: "error", message: error?.message || "حدث خطأ غير متوقع" }'));
  assert.ok(!ticketsReport.includes('return { status: "success", data: [] }'));
  assert.ok(!suggestionsReport.includes('return { status: "success", data: [] }'));
});
await t("scoped dashboard UID queries have composite indexes and surface missing-index errors", () => {
  const indexes = JSON.parse(checklistIndexesSource);
  for (const identityField of ["reportedByUid", "assignedToUid"]) {
    assert.ok(indexes.indexes.some(index =>
      index.collectionGroup === "tickets" &&
      index.queryScope === "COLLECTION" &&
      index.fields.some(field => field.fieldPath === identityField && field.order === "ASCENDING") &&
      index.fields.some(field => field.fieldPath === "createdAt" && field.order === "DESCENDING")
    ), `${identityField} dashboard query needs a descending createdAt index`);
  }
  const ticketsFetch = ticketsApiSource.slice(
    ticketsApiSource.indexOf("export async function fetchTicketsApi"),
    ticketsApiSource.indexOf("export async function fetchDashboardSnapshotApi")
  );
  assert.match(ticketsFetch, /const clauses = \[orderBy\("createdAt", "desc"\)\]/);
  assert.match(ticketsFetch, /where\("reportedByUid", "==", myUid\), \.\.\.clauses/);
  assert.match(ticketsFetch, /where\("assignedToUid", "==", myUid\), \.\.\.clauses/);
  assert.match(ticketsFetch, /return \{ status: "error", code: error\?\.code, message: error\?\.message \}/);
  assert.doesNotMatch(ticketsFetch, /emptyResultOnMissingIndex/);
});
await t("technician and operator dashboard summaries opt into all-ticket metrics", () => {
  const dashboardSnapshot = ticketsApiSource.slice(
    ticketsApiSource.indexOf("export async function fetchDashboardSnapshotApi"),
    ticketsApiSource.indexOf("export async function fetchTicketCountsApi")
  );
  assert.match(dashboardSnapshot, /!hasFullDataAccess\(role\) && !includeAllTickets/);
  assert.match(dashboardSnapshot, /getCountFromServer\(ticketsRef\)/);
  return readFile(new URL("../js/workflow.js", import.meta.url), "utf8").then(workflowSource => {
    assert.ok(workflowSource.includes('includeAllTickets: role === "technician" || role === "operator"'));
  });
});
await t("checklist offline queue is connected to the sync dispatcher", () => {
  assert.ok(checklistViewSource.includes("loadedVersion: loadedTemplateVersion"));
  assert.ok(ticketsApiSource.includes('type === "save_checklist_template"'));
  assert.ok(ticketsApiSource.includes("buildChecklistTemplateDocument"));
});
await t("offline actions are replayed only for their original authenticated user", () => {
  assert.equal(isOfflineActionOwnedBy({ ownerUid: "user-a" }, "user-a"), true);
  assert.equal(isOfflineActionOwnedBy({ ownerUid: "user-a" }, "user-b"), false);
  assert.equal(isOfflineActionOwnedBy({ action: { type: "close" } }, "user-b"), false);
  assert.equal(isOfflineActionOwnedBy({ ownerUid: "user-a" }, ""), false);
  assert.ok(ticketsApiSource.includes("Preserving offline action without matching owner identity"));
});
await t("checklist history reads are bounded and covered by a composite index", () => {
  assert.ok(checklistApiSource.includes('orderBy("createdAt", "desc")'));
  assert.ok(checklistApiSource.includes("limit(maxCount)"));
  assert.ok(checklistApiSource.includes("limit(1)"));
  assert.ok(checklistApiSource.includes("maxCount < 1 || maxCount > 100"));
  assert.ok(checklistApiSource.includes("if (!url)"));
  assert.ok(!checklistApiSource.includes("photo: url || null"));
  const indexes = JSON.parse(checklistIndexesSource);
  assert.ok(indexes.indexes.some(index =>
    index.collectionGroup === "machineChecklists" &&
    ["machine", "type", "createdAt"].every(field =>
      index.fields.some(entry => entry.fieldPath === field)
    )
  ));
});
await t("deployment workflows require app and rules tests and immutable action pins", () => {
  for (const workflow of [mainWorkflowSource]) {
    assert.ok(workflow.includes("run: npm test"));
    assert.ok(!workflow.includes("continue-on-error"));
    assert.ok(workflow.includes("run: npm run test:rules"));
    assert.match(workflow, /uses:\s*[^@\n]+@[0-9a-f]{40}/i);
    assert.doesNotMatch(workflow, /uses:\s*[^@\n]+@v\d+/i);
    assert.match(workflow, /uses:\s*actions\/setup-java@[0-9a-f]{40}/i);
    assert.match(workflow, /java-version:\s*21/);
  }
});
const [machineErrorsSource, errorScannerSource, knowledgeBaseSource, firestoreRules, firestoreIndexes, suggestionsSource] = await Promise.all([
  readFile(new URL("../js/services/machineErrorsApi.js", import.meta.url), "utf8"),
  readFile(new URL("../js/errorScanner.js", import.meta.url), "utf8"),
  readFile(new URL("../js/knowledgeBase.js", import.meta.url), "utf8"),
  readFile(new URL("../firestore.rules", import.meta.url), "utf8"),
  readFile(new URL("../firestore.indexes.json", import.meta.url), "utf8"),
  readFile(new URL("../js/services/suggestionsApi.js", import.meta.url), "utf8")
]);
await t("machine-error writes enforce pending review and stable code identity", () => {
  const rulesStart = firestoreRules.indexOf("match /machineErrors/{errorId}");
  const rulesEnd = firestoreRules.indexOf("match /machineErrorLogs/{logId}", rulesStart);
  const rules = firestoreRules.slice(rulesStart, rulesEnd);
  assert.ok(rules.includes('errorId == "error_" + request.resource.data.errorCode'));
  assert.ok(rules.includes('request.resource.data.status == "pending_review"'));
  assert.ok(rules.includes('request.resource.data.status == "verified"'));
  assert.ok(machineErrorsSource.includes('doc(db, "machineErrors", machineErrorDocumentId(normalized))'));
  assert.ok(machineErrorsSource.includes('status: "pending_review"'));
  assert.ok(machineErrorsSource.includes('existing.status !== "success"'));
  assert.ok(machineErrorsSource.includes("getMachineTypeReference(restPayload.machine)"));
  assert.ok(pmApiSource.includes("getMachineTypeReference(payload.machine)"));
  assert.ok(checklistApiSource.includes("getMachineTypeReference(payload?.machine)"));
});
await t("untrusted machine-error content is escaped before HTML rendering", () => {
  assert.match(errorScannerSource, /\$\{escapeHtml\(data\.(errorCode|cause|solution|steps)/);
  for (const field of ["errorCode", "cause", "solution", "steps"]) {
    assert.ok(errorScannerSource.includes(`escapeHtml(data.${field}`), `${field} must be escaped`);
  }
});
await t("machine-error history query has its index and reports retrieval errors", () => {
  const indexes = JSON.parse(firestoreIndexes);
  assert.ok(indexes.indexes.some(index =>
    index.collectionGroup === "machineErrorLogs" &&
    index.fields.some(field => field.fieldPath === "errorCode") &&
    index.fields.some(field => field.fieldPath === "scannedAt")
  ));
  assert.ok(machineErrorsSource.includes('return { status: "error", message: error?.message || "حدث خطأ غير متوقع", data: [] }'));
  assert.ok(errorScannerSource.includes("if (result.status === 'error')"));
  assert.ok(errorScannerSource.includes("tr.historyLoadError"));
  assert.ok(knowledgeBaseSource.includes("periodLoadError = result.status === 'error'"));
  assert.ok(knowledgeBaseSource.includes("tr.periodLoadError"));
});
await t("ticket and Kaizen transitions commit status and history together", () => {
  assert.ok(ticketsApiSource.includes("async function updateTicketWithLog"));
  assert.ok(ticketsApiSource.includes("batch.update(doc(db, \"tickets\", ticketId), updateData)"));
  assert.ok(ticketsApiSource.includes("batch.set(doc(collection(db, \"tickets\", ticketId, \"logs\"))"));
  assert.ok(suggestionsSource.includes("async function updateSuggestionWithLog"));
  assert.ok(suggestionsSource.includes('batch.update(doc(db, "suggestions", suggestionId), updateData)'));
  assert.ok(suggestionsSource.includes('doc(collection(db, "suggestions", suggestionId, "logs"))'));
});

// ---------- phone ----------
const P = await import("../js/utils/phoneUtils.js");
console.log("phone normalization");
await t("كل صيغ نفس الرقم تعطي نفس الإيميل القياسي", () => {
  const forms = ["01001234567", "٠١٠٠١٢٣٤٥٦٧", "+20 100 123 4567", "0020 1001234567", "1001234567", "201001234567", "۰۱۰۰۱۲۳۴۵۶۷", "٠١٠٠-١٢٣-٤٥٦٧"];
  const set = new Set(forms.map(P.phoneToCanonicalAuthEmail));
  assert.equal(set.size, 1); assert.ok([...set][0].startsWith("01001234567@"));
});
await t("أرقام غير صالحة تُرفض", () => {
  assert.equal(P.normalizePhone("").ok, false); assert.equal(P.normalizePhone("12").ok, false); assert.equal(P.normalizePhone("abc").ok, false);
});
await t("الدخول يجرّب الصيغ القديمة للحسابات القديمة", () => {
  const c = P.phoneAuthEmailCandidates("01001234567");
  assert.ok(c.includes("201001234567@maintenance-defect-system.local"));
});
const { extractErrorCode } = await import("../js/utils/machineErrorOcr.js");
console.log("machine-screen OCR code extraction");
await t("يستخرج أكواد الأعطال مع اختلاف المسافات والشرطات", () => {
  assert.equal(extractErrorCode("ALARM HISTORY\nERR 204"), "ERR204");
  assert.equal(extractErrorCode("FAULT: 108"), "FAULT108");
  assert.equal(extractErrorCode("F - 05"), "F-05");
  assert.equal(extractErrorCode("E 05"), "E05");
});
await t("يصحح التباس OCR بين الحروف والأرقام ويدعم الأرقام العربية", () => {
  assert.equal(extractErrorCode("ERR 2O4"), "ERR204");
  assert.equal(extractErrorCode("E-٠٥"), "E-05");
});
await t("لا يعتبر عنوان ALARM HISTORY كود عطل", () => {
  assert.equal(extractErrorCode("ALARM HISTORY\nNo active alarms"), "");
  assert.equal(extractErrorCode("ALARM HISTORY 21"), "");
});
const ocr = await import("../js/utils/machineErrorOcr.js");
const {
  parseAlarmLine, analyzeAlarmRows, analyzeAlarmReadSets, evaluateRow, mergeRowSets, buildKnownCodes,
  clampCropRect, pickLineNearCenter, findCenterTextBand, normalizeForOcr, suggestKbMatches,
  rotateGray, estimateSkewAngle, findTextRegion, cropGray, medianLineHeight, preprocessDocumentGray
} = ocr;
const { renderRowsListHtml, renderRowCardHtml, renderRowInfoHtml } = await import("../js/utils/errorRowsView.js");

console.log("machine-fault OCR: literal codes, per-row KB matching, multi-fault screens");
const OCR_KB = [
  { errorCode: "059", errorMessage: "SHEET DELIVERY DID NOT GET SHEET", machine: "Palletizer", status: "verified" },
  { errorCode: "060", errorMessage: "SHEET DELIVERY DROPPED SHEET", machine: "Palletizer" },
  { errorCode: "113", errorMessage: "AIR TABLE NOT ENABLED", machine: "Palletizer" },
  { errorCode: "E5", errorMessage: "MOTOR OVERLOAD", machine: "Palletizer" },
  { errorCode: "ES", errorMessage: "EMERGENCY STOP PRESSED", machine: "Palletizer" },
  { errorCode: "X77", errorMessage: "OTHER MACHINE FAULT", machine: "Labeler" }
];
const ocrEval = (code, extra = {}) => evaluateRow({ code, confidence: 90, message: "", ...extra }, OCR_KB, { machineType: "Palletizer" });
const ocrLines = (arr, c = 85) => arr.map((text, i) => ({ text, confidence: c, bbox: { x0: 0, x1: 900, y0: i * 40, y1: i * 40 + 30 } }));

await t("الكود يُحفظ حرفياً: O59 تبقى O59 مع بديل للعرض فقط، و059 بلا التباس", () => {
  const r = parseAlarmLine("O59-SHEET DELIVERY DID NOT GET SHEET");
  assert.equal(r.code, "O59"); assert.equal(r.altCode, "059"); assert.equal(r.suspect, true);
  const clean = parseAlarmLine("30 AM 059-SHEET DELIVERY DID NOT GET SHEET");
  assert.equal(clean.code, "059"); assert.equal(clean.suspect, false);
  assert.equal(parseAlarmLine("I13-AIR TABLE NOT ENABLED").code, "I13");
});
await t("E5 وES يُقرآن كما هما، وES لا يُقرأ إلا لو موجود في الـ KB", () => {
  assert.equal(parseAlarmLine("E5 MOTOR OVERLOAD").code, "E5");
  assert.equal(parseAlarmLine("ES EMERGENCY STOP PRESSED", { knownCodes: buildKnownCodes(OCR_KB) }).code, "ES");
  assert.equal(parseAlarmLine("ES EMERGENCY STOP PRESSED"), null);
});
await t("الضجيج وعمود الوقت لا يصيرون أعطالاً", () => {
  assert.equal(parseAlarmLine("30 AM"), null);
  assert.equal(parseAlarmLine("NE9"), null);
  assert.equal(parseAlarmLine("NE9 AM ILL"), null);
  assert.equal(parseAlarmLine("059 SHEET DELIVERY DID NOT GET SHEET").code, "059");   // الشرطة المفقودة
});
await t("المطابقة بالكود الحرفي + الماكينة: E5/ES لا يُخلطان، O59 لا يُحسب مطابقاً", () => {
  assert.equal(ocrEval("059").status, "matched");
  const e5 = ocrEval("E5");
  assert.equal(e5.match.state, "exact");
  assert.deepEqual(e5.match.lookalikes.map(e => e.errorCode), ["ES"]);
  assert.equal(e5.status, "review");
  assert.equal(ocrEval("ES").match.entries[0].errorCode, "ES");
  const o59 = ocrEval("O59", { suspect: true, altCode: "059" });
  assert.equal(o59.match.state, "possible");
  assert.equal(o59.status, "review");
  assert.equal(ocrEval("999").status, "unknown");
  assert.equal(ocrEval("X77").match.state, "other-machine");
  assert.equal(ocrEval("059", { confidence: 45 }).status, "review");
  assert.equal(ocrEval("059", { conflict: "060" }).status, "review");
  assert.equal(ocrEval("059", { manual: true, confidence: 0 }).status, "matched");
});
await t("عدة أعطال في شاشة واحدة: صفوف منفصلة بلا خلط كود/وصف، والمكرر يُدمج", () => {
  const screen = ["ALARM HISTORY", "Message", "30 AM 059-SHEET DELIVERY DID NOT GET SHEET", "56 AM 060-SHEET DELIVERY DROPPED SHEET",
    "37 AM 059-SHEET DELIVERY DID NOT GET SHEET", "00 AM 113-AIR TABLE NOT ENABLED", "43 AM 031-TIPPED CAN IN PATTERN RITE", "NE9", "iil"];
  const { rows, ignored } = analyzeAlarmRows(ocrLines(screen), OCR_KB, { machineType: "Palletizer" });
  assert.deepEqual(rows.map(r => r.code), ["059", "060", "113", "031"]);
  assert.equal(rows[0].message, "SHEET DELIVERY DID NOT GET SHEET");
  assert.equal(rows[0].occurrences, 2);
  assert.ok(rows.every(r => !/^\d/.test(r.message)));
  assert.equal(rows[3].status, "unknown");
  assert.ok(!ignored.includes("ALARM HISTORY"));
  assert.equal(analyzeAlarmRows(ocrLines(["Main menu", "Speed 120 ppm", "شاشة التحكم"]), OCR_KB).rows.length, 0);
});
await t("مجموعة OCR قابلة للتكرار: الإنجليزية والعربية والأرقام الملتبسة والثقة والضجيج", () => {
  const fixtures = [
    { text: "059-SHEET DELIVERY DID NOT GET SHEET", confidence: 85, code: "059", status: "matched" },
    { text: "٠٥٩-تعذر تغذية الورق", confidence: 85, code: "059", status: "matched" },
    { text: "O59-SHEET DELIVERY DID NOT GET SHEET", confidence: 85, code: "O59", status: "review" },
    { text: "059-SHEET DELIVERY DID NOT GET SHEET", confidence: 45, code: "059", status: "review" },
    { text: "SPEED 120 PPM", confidence: 90, code: null, status: null }
  ];
  let extracted = 0;
  let missed = 0;
  let falseConfirmed = 0;
  for (const fixture of fixtures) {
    const { rows } = analyzeAlarmRows([{ text: fixture.text, confidence: fixture.confidence }], OCR_KB, { machineType: "Palletizer" });
    const row = rows[0];
    if (fixture.code && row?.code === fixture.code) extracted++;
    if (fixture.code && row?.code !== fixture.code) missed++;
    if (row && row.status === "matched" && fixture.status !== "matched") falseConfirmed++;
    assert.equal(row?.code || null, fixture.code, fixture.text);
    assert.equal(row?.status || null, fixture.status, fixture.text);
  }
  assert.equal(extracted, 4);
  assert.equal(missed, 0);
  assert.equal(falseConfirmed, 0);
});
await t("يتعرف على كود قاعدة المعرفة عندما يقرأ OCR الكود وحده", () => {
  const { rows } = analyzeAlarmRows(ocrLines(["ALARM HISTORY", "059", "SHEET DELIVERY DID NOT GET SHEET"]), OCR_KB, { machineType: "Palletizer" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].code, "059");
  assert.equal(rows[0].status, "matched");
  assert.equal(analyzeAlarmRows(ocrLines(["999"]), OCR_KB, { machineType: "Palletizer" }).rows.length, 0);
});
await t("قراءات OCR الاحتياطية تُحلل وتُدمج بدل عرضها كنص خام فقط", () => {
  const fallback = analyzeAlarmReadSets([
    ocrLines(["059-SHEET DELIVERY DID NOT GET SHEET", "060-SHEET DELIVERY DROPPED SHEET"], 72),
    ocrLines(["059-SHEET DELIVERY DID NOT GET SHEET", "060-SHEET DELIVERY DROPPED SHEET"], 80),
    ocrLines(["059-SHEET DELIVERY DID NOT GET SHEET", "060-SHEET DELIVERY DROPPED SHEET"], 90)
  ], OCR_KB, { machineType: "Palletizer" });
  assert.deepEqual(fallback.rows.map(row => row.code), ["059", "060"]);
  assert.equal(fallback.rows[0].confidence, 90);
  assert.equal(fallback.rows[0].occurrences, 1);
});
await t("دمج قراءتين: نفس الكود صف واحد، وكودان لنفس السطر => conflict لا يُعتمد", () => {
  const a = analyzeAlarmRows(ocrLines(["059-SHEET DELIVERY DID NOT GET"], 70), OCR_KB).rows;
  const b = analyzeAlarmRows(ocrLines(["059-SHEET DELIVERY DID NOT GET SHEET"], 88), OCR_KB).rows;
  const same = mergeRowSets(a, b);
  assert.equal(same.length, 1); assert.equal(same[0].confidence, 88); assert.equal(same[0].message, "SHEET DELIVERY DID NOT GET SHEET");
  const x = analyzeAlarmRows(ocrLines(["059-SHEET DELIVERY DID NOT GET SHEET"], 80), OCR_KB).rows;
  const y = analyzeAlarmRows(ocrLines(["060-SHEET DELIVERY DROPPED SHEET"], 70), OCR_KB).rows;
  const conflict = mergeRowSets(x, y);
  assert.equal(conflict.length, 1); assert.equal(conflict[0].conflict, "060");
  assert.equal(evaluateRow(conflict[0], OCR_KB, { machineType: "Palletizer" }).status, "review");
});
await t("واجهة الصفوف: HTML بلا حقن، الكود الملتبس لا يظهر مطابقاً، وتنبيه E5/ES ظاهر", () => {
  const tr = new Proxy({}, { get: (_, key) => `[${String(key)}]` });
  const evil = evaluateRow({ id: "r1", code: "E5", message: "<img src=x onerror=alert(1)>", confidence: 90, occurrences: 1 }, OCR_KB, { machineType: "Palletizer" });
  const html = renderRowCardHtml(evil, tr);
  assert.ok(!html.includes("<img src=x"));
  assert.ok(html.includes("&lt;img"));
  const info = renderRowInfoHtml(evil, { ...tr, lookalikeWarn: "تنبيه {codes}", matchExact: "x", pendingReviewStatus: "p", verifiedStatus: "v" });
  assert.ok(info.includes("تنبيه ES"));
  const o59 = evaluateRow({ id: "r2", code: "O59", altCode: "059", suspect: true, confidence: 90, message: "m" }, OCR_KB, { machineType: "Palletizer" });
  const list = renderRowsListHtml([evil, o59], tr);
  assert.ok(!list.includes("[rowMatched]"));
  assert.ok(list.includes("errRowUseKb('r2','059')"));
});
await t("clampCropRect وpickLineNearCenter وfindCenterTextBand وnormalizeForOcr وsuggestKbMatches", () => {
  const r = clampCropRect({ x: 0.95, y: 0.99, w: 0.3, h: 0.1 });
  assert.ok(r.x + r.w <= 1.0000001 && r.y + r.h <= 1.0000001 && r.h >= 0.025);
  const lines = [
    { text: "060-SHEET DELIVERY DR", confidence: 80, bbox: { y0: 0, y1: 14 } },
    { text: "059-SHEET DELIVERY DID NOT GET SHEET", confidence: 88, bbox: { y0: 60, y1: 100 } },
    { text: "113-AIR TABLE NOT ENABLED", confidence: 80, bbox: { y0: 150, y1: 170 } }
  ];
  assert.match(pickLineNearCenter(lines, 160)[0].text, /^059/);
  const ink = new Float32Array(100);
  for (let y = 0; y < 4; y++) ink[y] = 0.3;
  for (let y = 40; y < 62; y++) ink[y] = 0.3;
  for (let y = 94; y < 100; y++) ink[y] = 0.3;
  const band = findCenterTextBand(ink);
  assert.ok(band.top >= 38 && band.top <= 41 && Number.isFinite(band.gapAbove));
  const garbage = ["تي جاه يضق ري رن ge 3¥ er, am ب بجي 7", "M 79-8 DELIVERY UID", "GET SF ل اصع امه الهو"];
  assert.equal(suggestKbMatches(garbage, OCR_KB, { machineType: "Palletizer" })[0].code, "059");
  assert.equal(suggestKbMatches(["QWERTY ZXCVB"], OCR_KB, {}).length, 0);
  const W = 200, H = 40, lum = new Uint8Array(W * H);
  const isText = (x, y) => y >= 14 && y < 26 && x >= 20 && x < 180 && ((x >> 1) % 3 !== 0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) lum[y * W + x] = Math.max(0, Math.min(255, 200 - Math.round(y * 1.5) + (isText(x, y) ? 55 : 0)));
  const n = normalizeForOcr(lum, W, H, { rx: 30, ry: 12 });
  assert.equal(n.textIsBright, true);
});
await t("تصحيح الميل: يُقدَّر ويُصحَّح لميل +4° و-6°، وصورة مستقيمة/فاضية => 0", () => {
  const W = 500, H = 360, base = new Uint8Array(W * H).fill(255);
  for (let k = 0; k < 7; k++) for (let y = 40 + k * 38; y < 54 + k * 38; y++) for (let x = 60; x < W - 60; x++) if (((x >> 2) + k) % 5 !== 0) base[y * W + x] = 20;
  for (const a of [4, -6]) {
    const est = estimateSkewAngle(rotateGray(base, W, H, a), W, H);
    assert.ok(Math.abs(est + a) <= 0.75, `ميل ${a}: مقدّر ${est}`);
  }
  assert.equal(estimateSkewAngle(base, W, H), 0);
  assert.equal(estimateSkewAngle(new Uint8Array(W * H).fill(255), W, H), 0);
  const region = findTextRegion(base, W, H);
  assert.ok(region.x0 >= 20 && region.x0 <= 60 && region.x1 <= W - 20);
  assert.equal(cropGray(base, W, region).gray.length, (region.x1 - region.x0 + 1) * (region.y1 - region.y0 + 1));
  assert.equal(medianLineHeight([{ bbox: { y0: 0, y1: 20 } }, { bbox: { y0: 0, y1: 30 } }, { bbox: { y0: 0, y1: 40 } }]), 30);
});
await t("كود صحيح بوصف لا يشبه المسجّل => review (لا matched)، وبوصف مقارب يبقى matched", () => {
  const bad = ocrEval("059", { message: "XQZ WVT LLKP RRTT" });
  assert.equal(bad.descMismatch, true);
  assert.equal(bad.status, "review");
  const partial = ocrEval("059", { message: "SHEET DELIVERY DID NOT GET SHEET" });
  assert.equal(partial.status, "matched");
  assert.equal(partial.descMismatch, false);
  const edited = ocrEval("059", { message: "ما يهمش", manual: true });
  assert.equal(edited.status, "matched");
});
await t("صف بثقة OCR أقل من 30% لا يظهر كعطل (ويدخل الأسطر غير المفهومة فقط)", () => {
  const { rows, ignored } = analyzeAlarmRows([
    { text: "ES SI EDIE EE A ES ORI OCG ERS", confidence: 15 },
    { text: "113-AIR TABLE NOT ENABLED", confidence: 90 }
  ], OCR_KB, { machineType: "Palletizer" });
  assert.deepEqual(rows.map(r => r.code), ["113"]);
  assert.equal(ignored.length, 1);
});
await t("preprocessDocumentGray: شاشة بقطبيتين (عنوان غامق على فاتح + جدول أبيض على أحمر) => الصورتان تحتويان الحبر الصحيح", () => {
  const W = 320, H = 200, lum = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = y < 40 ? 225 : 66;                                   // شريط عنوان فاتح + جدول أحمر غامق
    if (y >= 14 && y < 26 && x >= 40 && x < 280 && ((x >> 1) % 3 !== 0)) v = 30;   // نص العنوان غامق
    for (let k = 0; k < 4; k++) {
      const y0 = 60 + k * 32;
      if (y >= y0 && y < y0 + 14 && x >= 40 && x < 280 && ((x >> 1) % 3 !== 0)) v = 255;   // نص الصفوف أبيض
    }
    lum[y * W + x] = v;
  }
  const { cropped, croppedDark } = preprocessDocumentGray(lum, W, H);
  const rowInk = (g, w, h, y0, y1) => { let n = 0, d = 0; for (let y = y0; y < y1; y++) for (let x = 0; x < w; x++) { n++; if (g[y * w + x] < 128) d++; } return d / n; };
  // قطبية "النص فاتح": صفوف الجدول لازم تظهر غامقة (حبر واضح)، وفي "النص غامق" العنوان هو الغامق
  const tableInkBright = rowInk(cropped.gray, cropped.w, cropped.h, Math.round(cropped.h * 0.4), cropped.h);
  const headerInkDark = rowInk(croppedDark.gray, croppedDark.w, croppedDark.h, 0, Math.round(croppedDark.h * 0.25));
  assert.ok(tableInkBright > 0.05, "جدول: " + tableInkBright);
  assert.ok(headerInkDark > 0.03, "عنوان: " + headerInkDark);
});
await t("المنطق في السيرفر مطابق للعميل", () => {
  const L = require("../functions/legacyAuth.js");
  for (const f of ["01001234567", "٠١٠٠١٢٣٤٥٦٧", "+20 100 123 4567", "0020 1001234567", "+44 7911 123456", "123"]) {
    const client = P.normalizePhone(f);
    assert.equal(L.normalizePhone(f).canonical, client.canonical, f);
    assert.equal(L.normalizePhone(f).ok, client.ok, f);
  }
});

// ---------- legacy auth ----------
console.log("legacyAuth");
await t("PBKDF2 legacy يتحقق صح/غلط + plaintext + stripping", async () => {
  const c = require("node:crypto"); const L = require("../functions/legacyAuth.js");
  const salt = c.randomBytes(16).toString("hex");
  const h = c.pbkdf2Sync("secret1", Buffer.from(salt, "hex"), 150000, 32, "sha256").toString("hex");
  assert.ok(L.verifyLegacyPassword("secret1", { passwordHash: h, salt }));
  assert.ok(!L.verifyLegacyPassword("nope", { passwordHash: h, salt }));
  assert.ok(L.verifyLegacyPassword("p", { password: "p" }));
  assert.deepEqual(Object.keys(L.stripLegacySecrets({ a: 1, passwordHash: h, salt, password: "x" })), ["a"]);
});

// ---------- status / overdue / MTTR ----------
const S = await import("../js/ticketStatusConstants.js");
const ST = await import("../js/statistics.js");
console.log("status / overdue / MTTR");
const hoursAgo = (h) => new Date(Date.now() - h * 3600e3).toISOString();
await t("resolved بانتظار التأكيد > 24 ساعة يُحتسب متأخراً", () => {
  assert.equal(S.isOverdueTicket({ status: "resolved", resolvedAt: hoursAgo(30), createdAt: hoursAgo(40) }), true);
  assert.equal(S.isOverdueTicket({ status: "resolved", resolvedAt: hoursAgo(2), createdAt: hoursAgo(10) }), false);
  assert.equal(S.isOverdueTicket({ status: "closed", createdAt: hoursAgo(9999) }), false);
});
await t("بلاغ قديم جداً مفتوح = متأخر", () => {
  assert.equal(S.isOverdueTicket({ status: "assigned", priority: "High", createdAt: hoursAgo(24 * 60) }), true);
});
await t("MTTR يقسم على العينات الصالحة فقط", () => {
  const ok = { status: "closed", createdAt: hoursAgo(10), resolvedAt: hoursAgo(8) };           // 2h
  const bad = { status: "closed", createdAt: hoursAgo(5), resolvedAt: hoursAgo(20) };          // ساعة جهاز خاطئة
  const r = ST.computeMTTR([ok, bad]);
  assert.equal(r.sampleSize, 1); assert.ok(Math.abs(r.avgHours - 2) < 0.01);
});
await t("MTTR يفضّل أوقات السيرفر", () => {
  const r = ST.computeMTTR([{ status: "closed", createdAt: hoursAgo(1), resolvedAt: hoursAgo(1), createdAtServer: hoursAgo(10), resolvedAtServer: hoursAgo(6) }]);
  assert.ok(Math.abs(r.avgHours - 4) < 0.01);
});

// ---------- permissions (H5 / M1) ----------
const PERM = await import("../js/permissions.js");
console.log("ticket actions / identity");
const asUser = (role, uid, name) => { localStorage.setItem("userId", uid); localStorage.setItem("name", name); PERM.setCurrentRole(role); };
const keys = (t) => PERM.getTicketActions(t).map(a => a.key);
await t("الأدمن لا يرى 'إصلاح ذاتي' على بلاغ غيره", () => {
  asUser("admin", "A1", "Admin");
  assert.ok(!keys({ status: "pending", reportedByUid: "U9", reportedBy: "Ali" }).includes("self_resolve"));
});
await t("المُبلّغ الفعلي يرى 'إصلاح ذاتي' على بلاغه المعلّق", () => {
  asUser("technician", "U9", "Ali");
  assert.ok(keys({ status: "pending", reportedByUid: "U9", reportedBy: "Ali" }).includes("self_resolve"));
});
await t("اسمان متطابقان بـ UID مختلف لا يتداخلان", () => {
  asUser("technician", "U2", "Ali");
  const k = keys({ status: "assigned", assignedToUid: "U1", assignedTo: "Ali", reportedByUid: "U7", reportedBy: "Sara" });
  assert.ok(!k.includes("start") && !k.includes("resolve"), "ظهرت أزرار لفني مش هو المُسند: " + k.join(","));
});
await t("المدير لا يستطيع تأكيد إغلاق بلاغ أصلحه هو بنفسه (إصلاح ذاتي)", () => {
  asUser("manager", "M1", "Mona");
  const k = keys({ status: "resolved", isSelfResolved: true, resolvedByUid: "M1", reportedByUid: "M1", reportedBy: "Mona" });
  assert.ok(!k.includes("confirm"), k.join(","));
});
await t("المدير يستطيع تأكيد إصلاح ذاتي قام به غيره", () => {
  asUser("manager", "M1", "Mona");
  const k = keys({ status: "resolved", isSelfResolved: true, resolvedByUid: "U9", reportedByUid: "U9", reportedBy: "Ali" });
  assert.ok(k.includes("confirm"), k.join(","));
});
await t("تطابق الاسم وحده لا يعرض إعادة إرسال مقترح قديم بلا submittedByUid", () => {
  asUser("technician", "U2", "Ali");
  const actions = PERM.getSuggestionActions({
    status: "revision_requested",
    name: "Ali"
  }).map(action => action.key);
  assert.ok(!actions.includes("resubmit"), actions.join(","));
});

console.log("PM work orders");
const PM_STATUS = await import("../js/ticketStatusConstants.js");
const [pmViewSrc, pmTicketsApiSource] = await Promise.all([
  readFile(new URL("../js/views/PmOrdersView.js", import.meta.url), "utf8"),
  readFile(new URL("../js/services/ticketsApi.js", import.meta.url), "utf8")
]);
await t("بلاغ PM المعلّق لا يُحتسب متأخراً بينما CM المعلّق القديم يُحتسب", () => {
  const old = new Date(Date.now() - 100 * 3600 * 1000).toISOString();
  assert.equal(PM_STATUS.isOverdueTicket({ status: "pending", maintenanceType: "PM", priority: "High", createdAt: old }), false);
  assert.equal(PM_STATUS.isOverdueTicket({ status: "pending", maintenanceType: "CM", priority: "High", createdAt: old }), true);
});
await t("المدير يرى اختصار 'فتح أمر PM' بدل 'تصنيف' على بلاغ PM، ويظل 'تصنيف' للبلاغ غير المصنّف", () => {
  asUser("manager", "M1", "Mona");
  const pm = keys({ status: "pending", maintenanceType: "PM", reportedByUid: "U9" });
  assert.ok(pm.includes("open_pm_orders") && !pm.includes("review"), pm.join(","));
  const fresh = keys({ status: "pending", reportedByUid: "U9" });
  assert.ok(fresh.includes("review") && !fresh.includes("open_pm_orders"), fresh.join(","));
});
await t("دورة CM: بلاغ assigned يعرض الإسناد/البدء للفني المُسند كما كان", () => {
  asUser("technician", "T1", "Tech");
  const k = keys({ status: "assigned", maintenanceType: "CM", assignedToUid: "T1", assignedTo: "Tech", reportedByUid: "U9" });
  assert.ok(k.includes("start") && k.includes("resolve"), k.join(","));
});
await t("تصنيف PM: لا إسناد إجباري، لا تغيير للحالة، ولا مستند جديد (تحديث البلاغ نفسه مع رقم PM في دفعة واحدة)", () => {
  const pmBranch = pmTicketsApiSource.slice(pmTicketsApiSource.indexOf("existing.maintenanceType === \"PM\""), pmTicketsApiSource.indexOf("export async function fetchPmOrdersApi"));
  const payload = pmBranch.slice(pmBranch.indexOf("batch.update(ticketRef"), pmBranch.indexOf("catch (sequenceError)"));
  assert.ok(payload.includes("maintenanceType: \"PM\"") && !/\bstatus:/.test(payload) && !pmBranch.includes("addDoc("), "فرع PM يغيّر الحالة أو ينشئ مستنداً");
  assert.ok(pmBranch.includes("commitWithSequence(\"pmOrders\""), "رقم PM لا يُحجز من تسلسل أوامر الصيانة");
  assert.ok(pmBranch.includes("duplicate: true"), "لا حارس تكرار");
});
await t("أوامر PM: الجلب بنطاق صلاحيات والتعديل مقصور على المخوّلين", () => {
  assert.ok(pmTicketsApiSource.includes('where("reportedByUid", "==", myUid))') && pmTicketsApiSource.includes("hasFullDataAccess(role)"));
  assert.ok(pmTicketsApiSource.includes("ليست لديك صلاحية تخطيط أوامر الصيانة الوقائية"));
  assert.ok(pmViewSrc.includes("canPlanPmOrders()"));
});
await t("فلتر التاريخ يرجع لتاريخ الإنشاء للأوامر غير المجدولة", () => {
  assert.ok(pmViewSrc.includes("localDateValue(order.plannedDate) || localDateValue(order.createdAt)"));
});
await t("تصدير PM: يستخدم exportToExcel/exportToPdf مع RTL وتواريخ منسّقة", () => {
  assert.ok(pmViewSrc.includes("exportToExcel(title, headers, rows") && pmViewSrc.includes("exportToPdf(title"));
  assert.ok(pmViewSrc.includes('dir="${isEn() ? "ltr" : "rtl"}"'));
  assert.ok(!pmViewSrc.includes('order.createdAt || "",'), "تاريخ ISO خام في التصدير");
});
await t("المدير والمهندس يريان خيار تصنيف PM على البلاغات المسندة والقائمة", () => {
  asUser("manager", "M1", "Mona");
  const mgrAssigned = keys({ status: "assigned", maintenanceType: "CM", assignedToUid: "T1", reportedByUid: "U9" });
  assert.ok(mgrAssigned.includes("classify_pm"), "المدير لا يرى classify_pm على بلاغ assigned: " + mgrAssigned.join(","));
  asUser("engineer", "E1", "Eng");
  const engAssigned = keys({ status: "assigned", maintenanceType: "CM", assignedToUid: "T1", reportedByUid: "U9" });
  assert.ok(engAssigned.includes("classify_pm"), "المهندس لا يرى classify_pm على بلاغ assigned: " + engAssigned.join(","));
  asUser("technician", "T1", "Tech");
  const techAssigned = keys({ status: "assigned", maintenanceType: "CM", assignedToUid: "T1", reportedByUid: "U9" });
  assert.ok(!techAssigned.includes("classify_pm"), "الفني يرى classify_pm بشكل غير مصرح: " + techAssigned.join(","));
});
await t("واجهة PM تدعم تحديد الأوامر المتعددة وفلتر توقف الخط الميداني", () => {
  assert.ok(pmViewSrc.includes("selectedOrderIds"), "غياب selectedOrderIds في PmOrdersView");
  assert.ok(pmViewSrc.includes("pmQuickDowntimeBtn"), "غياب زر توقف الخط السريع");
  assert.ok(pmViewSrc.includes("openPmOrdersWithFilter"), "غياب openPmOrdersWithFilter");
});

console.log("Search & Filter Workflow Integration");
const [mSearchSrc, mSearchViewSrc, reportsViewSrc, ticketsBoardSrc, mgrDesktopTicketsSrc] = await Promise.all([
  readFile(new URL("../js/maintenanceSearch.js", import.meta.url), "utf8"),
  readFile(new URL("../js/views/MaintenanceSearchView.js", import.meta.url), "utf8"),
  readFile(new URL("../js/views/reportsView.js", import.meta.url), "utf8"),
  readFile(new URL("../js/ticketsBoard.js", import.meta.url), "utf8"),
  readFile(new URL("../js/views/managerDesktop/ManagerDesktopTickets.js", import.meta.url), "utf8")
]);

await t("البحث المتقدم: يشمل رقم البلاغ ومسار الصيانة PM/CM والحالة والأولوية والملاحظات", () => {
  assert.ok(mSearchSrc.includes("recordNumberSearchText(r)"), "رقم البلاغ غير مدرج في بحث MaintenanceSearch");
  assert.ok(mSearchSrc.includes("r.maintenanceType"), "مسار الصيانة غير مدرج في بحث MaintenanceSearch");
  assert.ok(mSearchSrc.includes("routeFilter"), "فلتر مسار الصيانة غير مطبق في MaintenanceSearch");
  assert.ok(mSearchSrc.includes("isOverdueTicket"), "فلتر البلاغات المتأخرة غير مطبق في MaintenanceSearch");
  assert.ok(mSearchViewSrc.includes("mRouteFilter"), "غياب قائمة مسار الصيانة في MaintenanceSearchView");
});

await t("شيت تقرير البلاغات Excel: يحتوي عمود مسار الصيانة (PM/CM) لتسهيل الفرز الميداني", () => {
  assert.ok(reportsViewSrc.includes("مسار الصيانة"), "غياب عمود مسار الصيانة في تقارير Excel بالعربية");
  assert.ok(reportsViewSrc.includes("Route"), "غياب عمود مسار الصيانة في تقارير Excel بالإنجليزية");
  assert.ok(reportsViewSrc.includes("صيانة وقائية PM"), "غياب تمييز PM في شيت البلاغات");
});

await t("لوحة متابعة البلاغات: تدعم البحث المباشر وإلغاء التصفية ولافتة فلتر كروت الرئيسية", () => {
  assert.ok(ticketsBoardSrc.includes("handleTicketsBoardSearch"), "غياب handleTicketsBoardSearch في ticketsBoard");
  assert.ok(ticketsBoardSrc.includes("clearTicketsBoardSearch"), "غياب clearTicketsBoardSearch في ticketsBoard");
  assert.ok(ticketsBoardSrc.includes("activeBannerHtml"), "غياب لافتة التصفية النشطة في ticketsBoard");
});

await t("لوحة الديسكتوب للمدير: البحث النصي يشمل رقم البلاغ ومسار PM/CM والحالة والملاحظات", () => {
  assert.ok(mgrDesktopTicketsSrc.includes("matchIssueId"), "غياب بحث issueId في ManagerDesktopTickets");
  assert.ok(mgrDesktopTicketsSrc.includes("matchRoute"), "غياب بحث مسار الصيانة في ManagerDesktopTickets");
  assert.ok(mgrDesktopTicketsSrc.includes("matchNotes"), "غياب بحث الملاحظات في ManagerDesktopTickets");
});

await t("استعلامات البحث والتقارير: تبحث بالـ UID والاسم معاً لتطابق النتائج مع قاعدة البيانات", () => {
  assert.ok(pmTicketsApiSource.includes("where(\"reportedByUid\", \"==\", myUid)") && pmTicketsApiSource.includes("where(\"reportedBy\", \"==\", myName)"), "غياب استعلام الاسم والـ UID معاً في تذاكر البحث/التقارير");
});

// ---------- PM periodic plans: schedule & execution logic (تنفيذ فعلي) ----------
console.log("PM Periodic Plans");
const pmS = await import("../js/utils/pmSchedule.js");
const [pmApiSrc, pmViewSrc2, pmTicketsSrc2, rulesSrc] = await Promise.all([
  readFile(new URL("../js/services/pmApi.js", import.meta.url), "utf8"),
  readFile(new URL("../js/views/PmOrdersView.js", import.meta.url), "utf8"),
  readFile(new URL("../js/services/ticketsApi.js", import.meta.url), "utf8"),
  readFile(new URL("../firestore.rules", import.meta.url), "utf8")
]);

await t("مواعيد PM: التواريخ المحلية بلا انزياح يوم ونهاية الشهر لا تتجاوز", () => {
  assert.equal(pmS.calculateNextDueDate("2026-10-14", "daily"), "2026-10-15");
  assert.equal(pmS.calculateNextDueDate("2026-10-14", "weekly"), "2026-10-21");
  assert.equal(pmS.calculateNextDueDate("2026-01-31", "monthly"), "2026-02-28");
  assert.equal(pmS.calculateNextDueDate("2028-01-31", "monthly"), "2028-02-29");
  assert.equal(pmS.calculateNextDueDate("2026-11-30", "quarterly"), "2027-02-28");
  assert.equal(pmS.calculateNextDueDate("2026-08-31", "semi_annual"), "2027-02-28");
  assert.equal(pmS.calculateNextDueDate("2028-02-29", "annual"), "2029-02-28");
  assert.equal(pmS.calculateNextDueDate("2026-10-14", "custom", 10), "2026-10-24");
  assert.equal(pmS.calculateNextDueDate("2026-10-14T22:30:00.000Z", "daily").length, 10);
  assert.equal(pmS.parseLocalDate("2026-02-31"), null);
});

await t("حالة الاستحقاق: متأخر/اليوم/قريب/أول تنفيذ/ساري وفئات الإحصائيات متنافية", () => {
  const key = d => pmS.toDateKey(new Date(Date.now() + d * 86400000));
  assert.equal(pmS.calculateDueStatus(key(-3), "x").status, "overdue");
  assert.equal(pmS.calculateDueStatus(key(0), "x").status, "due_today");
  assert.equal(pmS.calculateDueStatus(key(2), "x").status, "due_soon");
  assert.equal(pmS.calculateDueStatus(key(10), null).status, "never_executed");
  assert.equal(pmS.calculateDueStatus(key(10), "2026-01-01").status, "upcoming");
  const plans = [
    { nextDueDate: key(-1) }, { nextDueDate: key(0), lastExecution: { executedAt: "2026-01-01" } },
    { nextDueDate: key(1), lastExecution: { executedAt: "2026-01-01" } }, { nextDueDate: key(20) },
    { nextDueDate: key(20), lastExecution: { executedAt: "2026-01-01" } }
  ];
  const buckets = plans.map(pmS.getPlanDueBucket);
  assert.deepEqual(buckets, ["due", "due", "upcoming", "never", "upcoming"]);
});

await t("نتيجة التنفيذ تُشتق من المهام (لا مكتمل مع مهام ناقصة ولا جزئي بلا مهام منفذة)", () => {
  const T = (...st) => st.map((status, i) => ({ id: "t" + i, text: "m" + i, status, note: "" }));
  assert.equal(pmS.resolveExecutionResult(T("done", "done"), "completed"), "completed");
  assert.equal(pmS.resolveExecutionResult(T("done", "not_done"), "completed"), "completed_partial");
  assert.equal(pmS.resolveExecutionResult(T("not_done", "not_done"), "completed_partial"), "deferred");
  assert.equal(pmS.resolveExecutionResult(T("done", "not_done"), "deferred"), "deferred");
  assert.equal(pmS.sanitizeExecutionTasks([{ id: "a", text: " x ", status: "weird" }])[0].status, "not_done");
});

await t("تحديث الخطة بعد التنفيذ: المكتمل يقدّم الموعد ويزيد العدّاد، المؤجل لا يغيّره، وإعادة الإرسال لا تكرر", () => {
  const plan = { frequency: "monthly", nextDueDate: "2026-10-01", executionCount: 2 };
  const base = { executionId: "ex_1", executedAt: "2026-10-12T09:00:00", executedBy: "A", executedByUid: "u", technicianName: "A", tasksSummary: { total: 1, done: 1, notDone: 0 }, notes: "" };
  const done = pmS.buildPlanPatchAfterExecution(plan, { ...base, result: "completed" });
  assert.equal(done.nextDueDate, "2026-11-12");
  assert.equal(done.executionCount, 3);
  assert.equal(done.lastExecution.result, "completed");
  const deferred = pmS.buildPlanPatchAfterExecution(plan, { ...base, result: "deferred" });
  assert.equal(deferred.nextDueDate, "2026-10-01");
  assert.equal(deferred.executionCount, undefined);
  assert.equal(deferred.lastExecution, undefined);
  assert.equal(deferred.lastDeferral.executionId, "ex_1");
  assert.equal(pmS.buildPlanPatchAfterExecution({ ...plan, lastExecution: { executionId: "ex_1" } }, { ...base, result: "completed" }), null);
  const custom = pmS.buildPlanPatchAfterExecution({ frequency: "custom", customDays: 10, nextDueDate: "2026-10-01" }, { ...base, result: "completed_partial" });
  assert.equal(custom.nextDueDate, "2026-10-22");
});

await t("تعديل الخطة: التاريخ اليدوي يُحترم، وتغيير الدورية يُحسب من آخر تنفيذ، وبدونهما يبقى الموعد", () => {
  const existing = { frequency: "monthly", nextDueDate: "2026-11-12", lastExecution: { executedAt: "2026-10-12T09:00:00" } };
  assert.equal(pmS.resolveNextDueOnEdit({ existing, startDate: "2026-11-20", frequency: "monthly", customDays: null }), "2026-11-20");
  assert.equal(pmS.resolveNextDueOnEdit({ existing, startDate: "2026-11-12", frequency: "weekly", customDays: null }), "2026-10-19");
  assert.equal(pmS.resolveNextDueOnEdit({ existing, startDate: "2026-11-12", frequency: "monthly", customDays: null }), "2026-11-12");
});

await t("pmApi: منع تكرار الخطة، حفظ ذري للتنفيذ، معرّف تنفيذ حتمي، وإعادة تصدير الأسماء الأصلية", () => {
  assert.ok(pmApiSrc.includes("duplicate: true") && pmApiSrc.includes("snap.exists()"), "غياب منع تكرار الخطة");
  assert.ok(pmApiSrc.includes("writeBatch(db)") && pmApiSrc.includes("batch.set(execRef") && pmApiSrc.includes("batch.update(planRef"), "التنفيذ والخطة ليسا في batch واحد");
  assert.ok(pmApiSrc.includes("clientToken") && pmApiSrc.includes("existingExec.exists()"), "غياب idempotency للتنفيذ");
  assert.ok(pmApiSrc.includes("export { PM_FREQUENCIES, getFrequencyLabel, calculateNextDueDate, calculateDueStatus }"));
  assert.ok(!pmApiSrc.includes("orderBy(\"machine\")") && !pmApiSrc.includes("where(\"planId\", \"==\", planId), orderBy"), "استعلام يحتاج فهرساً مركباً");
});

await t("واجهة PM: لا inline handler يعتمد على متغيرات module، والدوال العامة مُعرّضة على window", () => {
  assert.ok(!/onclick="closePlanEditModal\(\)"|onclick="closeExecutionModal\(\)"|onclick="closeHistoryModal\(\)"/.test(pmViewSrc2));
  assert.ok(!pmViewSrc2.includes("onchange=\"planModalState") && !pmViewSrc2.includes("executionModalState.result = this.value") && !pmViewSrc2.includes("onchange=\"executionModalState"));
  for (const fn of ["closePlanEditModal", "closeExecutionModal", "closeHistoryModal", "updatePlanTaskText", "setExecutionTaskNote", "setExecutionResult"]) {
    assert.ok(pmViewSrc2.includes(`window.${fn} =`), `غياب window.${fn}`);
  }
  assert.ok(pmViewSrc2.includes("syncPlanStateFromDom") && pmViewSrc2.includes("syncExecutionStateFromDom"), "غياب مزامنة الحقول قبل إعادة الرسم");
});

await t("بطاقة الخطة المطبوعة فارغة، والـ QR لبطاقة الخطة يفتح تسجيل التنفيذ", () => {
  assert.ok(pmViewSrc2.includes('pmStatus: "planned"') && pmViewSrc2.includes("planCard: true"));
  assert.ok(!pmViewSrc2.includes("lastExecution?.technicianName || label"), "اسم الفني السابق يظهر على البطاقة");
  assert.ok(pmViewSrc2.includes("pmPlans.find(item => item.id === ref)") && pmViewSrc2.includes("openRecordPmExecutionModal(plan.id)"));
});

await t("أوامر PM: الإسناد من التخطيط ينقل الحالة (assign/reassign/release) ولا يقبل إنهاءً يدوياً", () => {
  assert.ok(pmTicketsSrc2.includes("transitionPmTicketAfterPlanning"));
  assert.ok(pmTicketsSrc2.includes('action: "assign"') && pmTicketsSrc2.includes('action: "reassign"') && pmTicketsSrc2.includes('action: "release"'));
  assert.ok(pmTicketsSrc2.includes('const allowedStatuses = ["unplanned", "planned", "in_progress", "deferred"]'));
  assert.ok(pmTicketsSrc2.includes("PMF-${ticketId}"), "أمر المتابعة غير حتمي");
  assert.ok(pmTicketsSrc2.includes('action: "start"') && pmTicketsSrc2.includes("بدء تلقائي"));
});

await t("قواعد Firestore: الفني يسجل تنفيذ الخطة بحقول التنفيذ فقط وسجل التنفيذ ينسب لصاحبه", () => {
  assert.ok(rulesSrc.includes('function pmExecutionPatchOk()') && rulesSrc.includes('k.hasOnly(["lastExecution", "lastDeferral", "nextDueDate", "executionCount", "updatedAt", "updatedBy"])'));
  assert.ok(rulesSrc.includes('request.resource.data.get("executedByUid", "") == request.auth.uid'));
});


// ---------- الترقيم التسلسلي الموحد ----------
const { formatSequenceNumber, parseRecordNumber, normalizeRecordNumber, displayRecordNumber, recordNumberSearchText, SEQUENCE_PREFIXES } = await import("../js/utils/recordNumber.js");
const { allocateAndCommit } = await import("../js/utils/sequenceCore.js");
console.log("Sequence numbering");
await t("الصيغة المختصرة تبدأ من 001 ولكل نوع بادئته", () => {
  assert.equal(formatSequenceNumber("tickets", 1), "BR-001");
  assert.equal(formatSequenceNumber("suggestions", 2), "KZ-002");
  assert.equal(formatSequenceNumber("pmOrders", 3), "PM-003");
  assert.equal(formatSequenceNumber("tickets", 1000), "BR-1000");
  assert.throws(() => formatSequenceNumber("tickets", 0));
  assert.throws(() => formatSequenceNumber("unknown", 1));
  assert.equal(new Set(Object.values(SEQUENCE_PREFIXES)).size, Object.keys(SEQUENCE_PREFIXES).length, "بادئات مكررة");
});
await t("السجلات القديمة (5 خانات) تُعرض مختصرة ويُعثر عليها بالبحث بأي صيغة", () => {
  assert.equal(normalizeRecordNumber("BR-00012"), "BR-012");
  assert.deepEqual(parseRecordNumber("#br012"), { prefix: "BR", number: 12 });
  assert.equal(parseRecordNumber("IS-1730000000000-ab12"), null);
  assert.equal(displayRecordNumber({ unifiedNumber: "KZ-00005", id: "x" }), "KZ-005");
  assert.equal(displayRecordNumber({ issueId: "IS-1", id: "x" }), "IS-1");
  assert.equal(displayRecordNumber({ unifiedNumber: "PLAN-L1-M" }), "PLAN-L1-M");
  const hay = recordNumberSearchText({ unifiedNumber: "BR-00012", originalUnifiedNumber: "BR-00003" }).toLowerCase();
  for (const q of ["br-012", "br012", "br-00012", "br-003"]) assert.ok(hay.includes(q), q);
});

// محاكاة Firestore: قاعدة CAS (العدّاد +1 فقط) + دفعة ذرّية، مع تداخل المستخدمين
function makeFakeStore() {
  const store = { counter: 0, records: new Map(), commits: 0 };
  const deps = {
    sleep: async () => {},
    readCounter: async () => { await Promise.resolve(); return store.counter; },
    commit: async (type, next, unifiedNumber, addWrites) => {
      await new Promise(r => setTimeout(r, Math.random() * 3));      // تأخير الشبكة
      const writes = [];
      addWrites({ set: (id, data) => writes.push([id, data]) }, unifiedNumber);
      if (next !== store.counter + 1) { const e = new Error("Missing or insufficient permissions."); e.code = "permission-denied"; throw e; }
      if (writes.some(([id]) => store.records.has(id) && id.startsWith("fixed"))) { const e = new Error("denied"); e.code = "permission-denied"; throw e; }
      store.counter = next; store.commits++;
      for (const [id, data] of writes) store.records.set(id, data);
    }
  };
  return { store, deps };
}
await t("40 مستخدماً متزامناً: أرقام فريدة متتالية 001..040 بلا تكرار ولا فجوات", async () => {
  const { store, deps } = makeFakeStore();
  deps.maxAttempts = 100;
  const results = await Promise.all(Array.from({ length: 40 }, (_, i) =>
    allocateAndCommit("tickets", (batch, num) => batch.set(`t${i}`, { unifiedNumber: num }), deps)));
  const nums = results.map(r => r.unifiedNumber).sort();
  assert.equal(new Set(nums).size, 40);
  assert.equal(nums[0], "BR-001"); assert.equal(nums[39], "BR-040");
  assert.equal(store.counter, 40);
  for (const [, rec] of store.records) assert.ok(results.some(r => r.unifiedNumber === rec.unifiedNumber));
});
await t("رفض غير متعلق بالسباق (قاعدة السجل) لا يستهلك رقماً ولا يُعاد في حلقة", async () => {
  const { store, deps } = makeFakeStore();
  store.records.set("fixed-1", { unifiedNumber: "BR-X" });
  await assert.rejects(() => allocateAndCommit("tickets", (b, n) => b.set("fixed-1", { unifiedNumber: n }), deps), /denied/);
  assert.equal(store.counter, 0);
  const ok = await allocateAndCommit("tickets", (b, n) => b.set("fixed-2", { unifiedNumber: n }), deps);
  assert.equal(ok.unifiedNumber, "BR-001");
});
await t("أخطاء الشبكة تُرمى فوراً بدون إعادة محاولة", async () => {
  let calls = 0;
  const deps = { sleep: async () => {}, readCounter: async () => 0, commit: async () => { calls++; const e = new Error("offline"); e.code = "unavailable"; throw e; } };
  await assert.rejects(() => allocateAndCommit("tickets", () => {}, deps), /offline/);
  assert.equal(calls, 1);
});
const [seqApiSrc, firestoreRulesSrc, ...creatorSrcs] = await Promise.all([
  "../js/services/sequenceApi.js", "../firestore.rules",
  "../js/services/ticketsApi.js", "../js/services/suggestionsApi.js", "../js/services/defectsApi.js",
  "../js/services/machineErrorsApi.js", "../js/services/checklistApi.js", "../js/services/pmApi.js"
].map(f => readFile(new URL(f, import.meta.url), "utf8")));
await t("sequenceApi لا يعتمد على حزم غير متاحة في المتصفح (firebase/firestore, runTransaction)", () => {
  assert.doesNotMatch(seqApiSrc, /from\s+["']firebase\//);
  assert.doesNotMatch(seqApiSrc, /runTransaction\s*\(|import\s*\{[^}]*runTransaction/);
});
await t("كل مسارات الإنشاء تحجز الرقم والسجل معاً (commitWithSequence) بدل حجز منفصل", () => {
  for (const src of creatorSrcs) { assert.doesNotMatch(src, /allocateUnifiedNumber/); }
  const used = creatorSrcs.map(src => (src.match(/commitWithSequence\("(\w+)"/g) || []).join(","));
  const all = used.join(",");
  for (const type of ["tickets", "pmOrders", "suggestions", "defects", "machineErrors", "checklists", "pmRecords"]) {
    assert.ok(all.includes(`("${type}"`) || creatorSrcs.some(src => src.includes(`sequenceType`)) && type === "tickets", `النوع ${type} بلا مسار حجز ذرّي`);
  }
});
await t("قواعد counters: بداية من 1، +1 فقط، ربط البادئة بالمعرّف، وإعادة الضبط للأدمن فقط", () => {
  const block = firestoreRulesSrc.slice(firestoreRulesSrc.indexOf("match /counters/{counterId}"));
  assert.ok(block.includes("current == 1") && block.includes("resource.data.current + 1"));
  assert.ok(block.includes("counterPrefixMatches(counterId") && block.includes("isAdmin()") && block.includes("current == 0"));
  assert.ok(block.includes("allow delete: if false"));
});

console.log(`\nالنتيجة: ${passed} نجح / ${failed} فشل`);
process.exit(failed ? 1 : 0);
