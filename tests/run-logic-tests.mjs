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
