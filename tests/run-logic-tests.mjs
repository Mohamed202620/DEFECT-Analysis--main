// اختبارات منطقية (بدون شبكة/Firebase) للإصلاحات الأساسية. التشغيل: node tests/run-logic-tests.mjs
import assert from "node:assert/strict";

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
  parseAlarmLine, analyzeAlarmRows, evaluateRow, mergeRowSets, buildKnownCodes,
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

console.log(`\nالنتيجة: ${passed} نجح / ${failed} فشل`);
process.exit(failed ? 1 : 0);
