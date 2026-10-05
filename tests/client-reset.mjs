// اختبار جانب العميل لاستعادة كلمة السر (هاتف + كود الموظف) وتسجيل الكود. التشغيل: node tests/client-reset.mjs
import assert from "node:assert/strict";
import fs from "node:fs";

const _s = new Map();
globalThis.window = globalThis;
globalThis.localStorage = { getItem: k => (_s.has(k) ? _s.get(k) : null), setItem: (k, v) => _s.set(k, String(v)), removeItem: k => _s.delete(k), clear: () => _s.clear(), key: i => [..._s.keys()][i], get length() { return _s.size; } };
globalThis.sessionStorage = globalThis.localStorage;
globalThis.document = { getElementById: () => null, addEventListener() {}, documentElement: { lang: "ar", dir: "rtl" }, createElement: () => ({ style: {}, classList: { add() {}, remove() {} } }), querySelector: () => null, body: { appendChild() {} } };
try { Object.defineProperty(globalThis, "navigator", { value: { onLine: true, userAgent: "node" }, configurable: true }); } catch (_) {}
globalThis.addEventListener = () => {};

const sent = [];
let mode = "ok";
globalThis.fetch = async (url, init = {}) => {
  sent.push({ url: String(url), init });
  if (mode === "network") throw new TypeError("network down");
  const J = (b, s) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
  if (mode === "ok") return J({ result: { status: "success" } }, 200);
  if (mode === "wrong") return J({ error: { message: "رقم الهاتف أو كود الموظف غير صحيح.", status: "PERMISSION_DENIED" } }, 403);
  if (mode === "limited") return J({ error: { message: "تم تجاوز عدد المحاولات لهذا الرقم، حاول بعد 24 ساعة تقريبًا.", status: "RESOURCE_EXHAUSTED" } }, 429);
};

const { resetPassword } = await import("../js/auth/login.js");

let passed = 0, failed = 0;
const t = async (name, fn) => { sent.length = 0; mode = "ok"; try { await fn(); passed++; console.log("  ✅", name); } catch (e) { failed++; console.log("  ❌", name, "\n     ", e.message); } };

console.log("استعادة كلمة السر - العميل");
await t("مدخلات غير صالحة لا تُرسل أي طلب", async () => {
  assert.equal((await resetPassword("abc", "EMP1", "NewPass123")).success, false);
  assert.equal((await resetPassword("01001234567", "  ", "NewPass123")).success, false);
  assert.equal((await resetPassword("01001234567", "EMP1", "short")).success, false);
  assert.equal(sent.length, 0);
});
await t("نجاح: طلب عام بدون Authorization إلى الـ Worker بالبيانات الصحيحة", async () => {
  const r = await resetPassword(" 01001234567 ", " EMP-7788 ", "NewPass123");
  assert.equal(r.success, true);
  assert.equal(sent.length, 1);
  assert.ok(sent[0].url.endsWith("/resetPasswordWithEmployeeCode") && sent[0].url.includes("workers.dev"));
  const h = new Headers(sent[0].init.headers); assert.equal(h.get("authorization"), null);
  const body = JSON.parse(sent[0].init.body).data;
  assert.deepEqual(body, { phone: "01001234567", code: "EMP-7788", newPassword: "NewPass123" });
});
await t("رد السيرفر العام (بيانات خاطئة) يظهر كما هو للمستخدم", async () => {
  mode = "wrong"; const r = await resetPassword("01001234567", "BAD", "NewPass123");
  assert.equal(r.success, false); assert.match(r.message, /غير صحيح/);
});
await t("رسالة الحظر (429) تظهر للمستخدم", async () => {
  mode = "limited"; const r = await resetPassword("01001234567", "BAD", "NewPass123");
  assert.equal(r.success, false); assert.match(r.message, /تجاوز عدد المحاولات/);
});
await t("انقطاع الشبكة يرجع فشلاً بدون استثناء", async () => {
  mode = "network"; const r = await resetPassword("01001234567", "EMP", "NewPass123");
  assert.equal(r.success, false); assert.ok(r.message);
});

console.log("ثوابت أمنية (فحص ساكن للكود)");
const users = fs.readFileSync(new URL("../js/services/usersApi.js", import.meta.url), "utf8");
const rules = fs.readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const reqView = fs.readFileSync(new URL("../js/views/RequestsView.js", import.meta.url), "utf8");
await t("كود الموظف لا يُكتب في مستند users، ويُسجَّل عبر السيرفر قبل إنشاء المستند", () => {
  const iDoc = users.indexOf('doc(regDb, "users"');
  const payload = users.slice(iDoc, users.indexOf("createdAt", iDoc));
  assert.ok(!/\bcode\s*:/.test(payload), "code لسه بيتكتب في مستند users");
  const iCode = users.indexOf('callCloudFunction("registerEmployeeCode"');
  assert.ok(iCode > 0 && iDoc > iCode, "تسجيل الكود لازم يسبق كتابة مستند المستخدم");
});
await t("لا يوجد في الواجهة أو الـ Worker أي مسار يعيّن فيه الأدمن كلمة سر", () => {
  assert.ok(!/resetUserPassword|adminResetUserPassword/.test(reqView));
  assert.ok(!/adminResetUserPassword/.test(fs.readFileSync(new URL("../cloudflare-worker/worker.mjs", import.meta.url), "utf8")));
  assert.ok(!/adminResetUserPassword/.test(fs.readFileSync(new URL("../functions/index.js", import.meta.url), "utf8")));
});
await t("القواعد: userSecrets/resetAttempts مغلقة، وusers.create يمنع code ويربط الهاتف بإيميل الدخول", () => {
  assert.match(rules, /match \/userSecrets\/\{uid\} \{\s*allow read, write: if false;/);
  assert.match(rules, /match \/resetAttempts\/\{key\} \{\s*allow read, write: if false;/);
  assert.ok(rules.includes('!("code" in request.resource.data)'));
  assert.ok(rules.includes('request.auth.token.email == request.resource.data.phone + "@maintenance-defect-system.local"'));
});

console.log(`\nالنتيجة: ${passed} نجح / ${failed} فشل`);
process.exit(failed ? 1 : 0);
