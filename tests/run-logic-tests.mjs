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
const { analyzeAlarmLines, parseAlarmLine } = await import("../js/utils/machineErrorOcr.js");
console.log("machine-screen OCR line analysis + KB validation");
const OCR_KB = [
  { errorCode: "059", errorMessage: "SHEET DELIVERY DID NOT GET SHEET", machine: "Palletizer" },
  { errorCode: "060", errorMessage: "SHEET DELIVERY DROPPED SHEET", machine: "Palletizer" },
  { errorCode: "113", errorMessage: "AIR TABLE NOT ENABLED", machine: "Palletizer" },
  { errorCode: "E05", errorMessage: "MOTOR OVERLOAD", machine: "Palletizer" }
];
const ocrLines = (arr, c = 85) => arr.map(text => ({ text, confidence: c }));
const ALARM_SCREEN = ["ALARM HISTORY", "Message", "30 AM 059-SHEET DELIVERY DID NOT GET SHEET", "56 AM 060-SHEET DELIVERY DROPPED SHEET",
  "38 AM 060-SHEET DELIVERY DROPPED SHEET", "19 AM 059-SHEET DELIVERY DID NOT GET SHEET", "00 AM 113-AIR TABLE NOT ENABLED",
  "43 AM 031-TIPPED CAN IN PATTERN RITE", "NE9", "- ALARM HISTORY 1", "iil"];
await t("Alarm History: لا NE9 ولا عنوان كمرشح، وأكثر من عطل => Needs Review بدون تعبئة", () => {
  const r = analyzeAlarmLines(ocrLines(ALARM_SCREEN), OCR_KB);
  assert.deepEqual(r.candidates.map(c => c.code).sort(), ["031", "059", "060", "113"]);
  assert.equal(r.status, "review");
  assert.equal(r.selected, null);
  assert.equal(r.candidates[0].code, "059");
});
await t("عطل واحد موجود في KB بثقة كافية => confirmed، وO59 يصحَّح لـ 059", () => {
  assert.equal(analyzeAlarmLines(ocrLines(["10 AM 113-AIR TABLE NOT ENABLED"]), OCR_KB).status, "confirmed");
  const r = analyzeAlarmLines(ocrLines(["O59-SHEET DELIVERY DID NOT GET SHEET"]), OCR_KB);
  assert.equal(r.selected.code, "059");
});
await t("كود غير موجود في KB أو ثقة منخفضة أو بلا كود => لا اعتماد ولا اختراع", () => {
  assert.equal(analyzeAlarmLines(ocrLines(["10 AM 777-MAIN DRIVE FAULT TRIPPED"]), OCR_KB).status, "review");
  assert.equal(analyzeAlarmLines(ocrLines(["059-SHEET DELIVERY DID NOT GET SHEET"], 30), OCR_KB).status, "none");
  assert.equal(analyzeAlarmLines(ocrLines(["Main menu", "Speed 120 ppm"]), OCR_KB).status, "none");
  assert.equal(analyzeAlarmLines(ocrLines(["NE9"]), OCR_KB).status, "none");
  assert.equal(parseAlarmLine("BIZ-SOMETHING WENT WRONG HERE"), null);
});
await t("كود مقروء غلط + رسالة مطابقة => كود من الـ KB فقط", () => {
  assert.equal(analyzeAlarmLines(ocrLines(["O6O-SHEET DELIVERY DROPPED SHEET"]), OCR_KB).candidates[0].code, "060");
  assert.equal(analyzeAlarmLines(ocrLines(["41O-COMPLETELY UNKNOWN PROBLEM TEXT"]), OCR_KB).candidates[0].inKb, false);
});
const { clampCropRect, pickLineNearCenter, findCenterTextBand, normalizeForOcr, suggestKbMatches } = await import("../js/utils/machineErrorOcr.js");
console.log("machine-screen OCR: selected line region");
await t("clampCropRect يبقي المستطيل داخل الصورة وبحد أدنى ويتحمل القيم التالفة", () => {
  const r = clampCropRect({ x: 0.95, y: 0.99, w: 0.3, h: 0.1 });
  assert.ok(r.x + r.w <= 1.0000001 && r.y + r.h <= 1.0000001 && r.h >= 0.025);
  assert.ok(Number.isFinite(clampCropRect({ x: "a", y: NaN, w: undefined, h: null }).x));
});
await t("pickLineNearCenter يختار سطر مركز المستطيل ويتجاهل المقصوص والضجيج", () => {
  const lines = [
    { text: "060-SHEET DELIVERY DR", confidence: 80, bbox: { y0: 0, y1: 14 } },
    { text: "059-SHEET DELIVERY DID NOT GET SHEET", confidence: 88, bbox: { y0: 60, y1: 100 } },
    { text: "113-AIR TABLE NOT ENABLED", confidence: 80, bbox: { y0: 150, y1: 170 } }
  ];
  const picked = pickLineNearCenter(lines, 160);
  assert.equal(picked.length, 1);
  assert.match(picked[0].text, /^059/);
  assert.deepEqual(pickLineNearCenter([{ text: "zzz noise", confidence: 90, bbox: { y0: 70, y1: 90 } }], 160), []);
});
await t("سطر محدد واحد موجود في KB => confirmed حتى لو الكود في سجل فيه أعطال أخرى", () => {
  const picked = pickLineNearCenter([
    { text: "30 AM 059-SHEET DELIVERY DID NOT GET SHEET", confidence: 86, bbox: { y0: 60, y1: 100 } }], 160);
  const r = analyzeAlarmLines(picked, OCR_KB);
  assert.equal(r.status, "confirmed");
  assert.equal(r.selected.code, "059");
  assert.equal(r.selected.message, "SHEET DELIVERY DID NOT GET SHEET");
});
await t("الشرطة المفقودة وعمود الوقت: 059 SHEET يُقرأ، و30 AM لا يصير كود", () => {
  const r = parseAlarmLine("42 AM 059 SHEET DELIVERY DID NOT GET SHEET");
  assert.equal(r.code, "059");
  assert.equal(parseAlarmLine("10:30 AM 113-AIR TABLE NOT ENABLED").code, "113");
  assert.equal(parseAlarmLine("30 AM"), null);
  assert.equal(analyzeAlarmLines(ocrLines(["30 PPM SPEED CURRENT VALUE"]), OCR_KB).candidates.length, 0);
  assert.equal(analyzeAlarmLines(ocrLines(["059 SHEET DELIVERY DID NOT GET SHEET"]), OCR_KB).status, "confirmed");
});
await t("سطر محدد بثقة منخفضة يظهر مرشح مراجعة ولا يُعتمد أبداً", () => {
  const opts = { minLineConfidence: 20, allowLoose: true };
  assert.equal(analyzeAlarmLines(ocrLines(["059-SHEET DELIVERY DID NOT GET SHEET"], 40), OCR_KB).status, "none");
  const r = analyzeAlarmLines(ocrLines(["059-SHEET DELIVERY DID NOT GET SHEET"], 40), OCR_KB, opts);
  assert.equal(r.status, "review");
  assert.equal(r.selected, null);
  assert.equal(r.candidates[0].confidence, 40);
});
await t("findCenterTextBand يعزل سطر المركز ويتجاهل شرائح الصفوف المجاورة", () => {
  const ink = new Float32Array(100);
  for (let y = 0; y < 4; y++) ink[y] = 0.3;
  for (let y = 40; y < 62; y++) ink[y] = 0.3;
  for (let y = 94; y < 100; y++) ink[y] = 0.3;
  const b = findCenterTextBand(ink);
  assert.ok(b.top >= 38 && b.top <= 41 && b.bottom >= 60 && b.bottom <= 63);
  assert.equal(findCenterTextBand(new Float32Array(50)), null);
});
await t("normalizeForOcr: نص فاتح على خلفية متدرجة => نص غامق على خلفية بيضاء، والعكس", () => {
  const W = 200, H = 40, lum = new Uint8Array(W * H);
  const isText = (x, y) => y >= 14 && y < 26 && x >= 20 && x < 180 && ((x >> 1) % 3 !== 0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    lum[y * W + x] = Math.max(0, Math.min(255, 200 - Math.round(y * 1.5) + (isText(x, y) ? 55 : 0)));
  }
  const r = normalizeForOcr(lum, W, H, { rx: 30, ry: 12 });
  assert.equal(r.textIsBright, true);
  let text = 0, nText = 0, bg = 0, nBg = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (isText(x, y)) { text += r.gray[y * W + x]; nText++; } else if (y < 8 || y > 32) { bg += r.gray[y * W + x]; nBg++; }
  }
  assert.ok(text / nText < 110 && bg / nBg > 235);
  const inverted = new Uint8Array(lum.map(v => 255 - v));
  assert.equal(normalizeForOcr(inverted, W, H, { rx: 30, ry: 12 }).textIsBright, false);
});
await t("suggestKbMatches: نص OCR مشوّه (من صورة فعلية) => 059 أول اقتراح، بكود من الـ KB وللماكينة المختارة فقط", () => {
  const kb = [
    { errorCode: "059", errorMessage: "SHEET DELIVERY DID NOT GET SHEET", machine: "Palletizer" },
    { errorCode: "060", errorMessage: "SHEET DELIVERY DROPPED SHEET", machine: "Palletizer" },
    { errorCode: "113", errorMessage: "AIR TABLE NOT ENABLED", machine: "Palletizer" },
    { errorCode: "E05", errorMessage: "MOTOR OVERLOAD", machine: "Labeler" }
  ];
  const garbage = ["تي جاه يضق ري رن ge 3¥ er, am ب بجي 7", "M 79-8 DELIVERY UID", "GET SF ل اصع امه الهو"];
  const s = suggestKbMatches(garbage, kb, { machineType: "Palletizer" });
  assert.equal(s[0].code, "059");
  assert.ok(s[0].suggested && s[0].inKb);
  assert.ok(!s.some(x => x.code === "E05"));
  assert.equal(suggestKbMatches(["شاشة التحكم الرئيسية"], kb, {}).length, 0);
  assert.equal(suggestKbMatches(["QWERTY ZXCVB"], kb, {}).length, 0);
  assert.ok(!suggestKbMatches(garbage, kb, { machineType: "Palletizer", excludeCodes: ["059"] }).some(x => x.code === "059"));
});
await t("findCenterTextBand يرجّع الفجوة لأقرب سطر مجاور (لتحديد الهامش الآمن)", () => {
  const ink = new Float32Array(100);
  for (let y = 0; y < 4; y++) ink[y] = 0.3;
  for (let y = 40; y < 62; y++) ink[y] = 0.3;
  for (let y = 94; y < 100; y++) ink[y] = 0.3;
  const b = findCenterTextBand(ink);
  assert.ok(b.gapAbove > 30 && b.gapBelow > 25 && Number.isFinite(b.gapAbove));
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
