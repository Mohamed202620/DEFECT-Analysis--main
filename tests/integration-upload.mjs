// اختبار تكامل: كود العميل الحقيقي (serverProxyStorageProvider + callWorkerUpload + callCloudFunction)
// ← Worker الحقيقي (worker.mjs) مع محاكاة Google/Firestore/ImgBB. التشغيل: node tests/integration-upload.mjs
import assert from "node:assert/strict";

// ---- stubs للمتصفح (نفس run-logic-tests) ----
const _s = new Map();
globalThis.window = globalThis;
globalThis.localStorage = { getItem: k => (_s.has(k) ? _s.get(k) : null), setItem: (k, v) => _s.set(k, String(v)), removeItem: k => _s.delete(k), clear: () => _s.clear(), key: i => [..._s.keys()][i], get length() { return _s.size; } };
globalThis.sessionStorage = globalThis.localStorage;
globalThis.document = { getElementById: () => null, addEventListener() {}, documentElement: { lang: "ar", dir: "rtl" }, createElement: () => ({ style: {}, classList: { add() {}, remove() {} } }), querySelector: () => null, body: { appendChild() {} } };
try { Object.defineProperty(globalThis, "navigator", { value: { onLine: true, userAgent: "node" }, configurable: true }); } catch (_) {}
globalThis.addEventListener = () => {};

const PID = "demo-project";
const { default: worker } = await import("../cloudflare-worker/worker.mjs");
const realFetch = globalThis.fetch;

// ---- مفاتيح + توكن ----
const algo = { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" };
const gk = await crypto.subtle.generateKey(algo, true, ["sign", "verify"]);
const sk = await crypto.subtle.generateKey(algo, true, ["sign", "verify"]);
const jwk = { ...(await crypto.subtle.exportKey("jwk", gk.publicKey)), kid: "k1", alg: "RS256" };
const pem = "-----BEGIN PRIVATE KEY-----\n" + Buffer.from(await crypto.subtle.exportKey("pkcs8", sk.privateKey)).toString("base64").match(/.{1,64}/g).join("\n") + "\n-----END PRIVATE KEY-----\n";
const b64u = (x) => Buffer.from(x).toString("base64url");
async function token(uid) {
  const now = Math.floor(Date.now() / 1000);
  const h = b64u(JSON.stringify({ alg: "RS256", kid: "k1" })), p = b64u(JSON.stringify({ aud: PID, iss: `https://securetoken.google.com/${PID}`, sub: uid, iat: now - 5, exp: now + 3000 }));
  return `${h}.${p}.${b64u(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", gk.privateKey, new TextEncoder().encode(`${h}.${p}`)))}`;
}

const env = { FIREBASE_PROJECT_ID: PID, IMGBB_API_KEY: "SECRETKEY", SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: "sa@x", private_key: pem }) };
const seen = { imgbb: null, preflight: null, workerUrls: [] };
const users = { tech1: { role: "technician", status: "active", name: "T" } };

// ---- fetch مُحاكى: Worker + خدمات Google ----
globalThis.fetch = async (input, init = {}) => {
  const url = String(input instanceof Request ? input.url : input);
  const J = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

  if (url.startsWith("https://odd-sun-fab8.mom379339.workers.dev")) {
    seen.workerUrls.push(url);
    // نحاكي المتصفح: بيحسب Content-Length لأجسام FormData
    let body = init.body, headers = new Headers(init.headers || {});
    if (body instanceof FormData) {
      const packed = new Response(body); body = Buffer.from(await packed.arrayBuffer());
      headers.set("Content-Type", packed.headers.get("content-type")); headers.set("Content-Length", String(body.length));
    }
    headers.set("Origin", "https://maintenance-defect-system.web.app");
    return worker.fetch(new Request(url, { ...init, headers, body }), env);
  }
  if (url.includes("service_accounts/v1/jwk")) return J({ keys: [jwk] });
  if (url === "https://oauth2.googleapis.com/token") return J({ access_token: "AT", expires_in: 3600 });
  if (url.startsWith("https://api.imgbb.com/")) {
    const buf = Buffer.from(await new Response(init.body).arrayBuffer());
    seen.imgbb = { url, type: init.headers["Content-Type"], text: buf.toString("latin1") };
    return J({ success: true, data: { display_url: "https://i.ibb.co/ok/p.jpg" } });
  }
  const m = url.match(/documents\/users\/([^?]+)/);
  if (m) { const u = users[decodeURIComponent(m[1])]; return u ? J({ fields: Object.fromEntries(Object.entries(u).map(([k, v]) => [k, { stringValue: v }])) }) : J({}, 404); }
  return realFetch(input, init);
};

// ---- نحمّل كود العميل الحقيقي ونحقن مستخدماً مسجلاً ----
const { auth } = await import("../js/config.js");
// ننتظر انتهاء تهيئة Firebase Auth (وإلا بترجّع currentUser لـ null بعد حقن المستخدم الوهمي)
await Promise.race([auth.authStateReady().catch(() => {}), new Promise(r => setTimeout(r, 1500))]);
auth.currentUser = { uid: "tech1", getIdToken: async () => token("tech1"), _stopProactiveRefresh() {}, _startProactiveRefresh() {} };
const { serverProxyStorageProvider } = await import("../js/providers/storage/serverProxyStorageProvider.js");
const { callCloudFunction } = await import("../js/providers/backend/index.js");

let passed = 0, failed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log("  ✅", name); } catch (e) { failed++; console.log("  ❌", name, "\n     ", e.message); } };

// JPEG وهمي صغير كـ data URL
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("FAKEJPEGDATA-".repeat(200))]);
const dataUrl = "data:image/jpeg;base64," + jpeg.toString("base64");

console.log("تكامل العميل ↔ Worker");
await t("رفع صورة data URL: يرجع رابط ImgBB، والمفتاح السري لا يظهر في طلب العميل", async () => {
  const url = await serverProxyStorageProvider.uploadImage(dataUrl, "ticket_123_img");
  assert.equal(url, "https://i.ibb.co/ok/p.jpg");
  assert.ok(seen.imgbb.url.includes("key=SECRETKEY"));
  assert.ok(seen.workerUrls.every(u => !u.includes("SECRETKEY")));
});
await t("بايتات الصورة وصلت لـ ImgBB سليمة (ثنائية وليست base64 نصية)", async () => {
  assert.ok(seen.imgbb.type.startsWith("multipart/form-data"));
  assert.ok(seen.imgbb.text.includes("FAKEJPEGDATA-FAKEJPEGDATA"), "الصورة لم تصل كما هي");
  assert.ok(!seen.imgbb.text.includes("data:image"), "الـ data URL اتبعت نصاً");
  assert.ok(seen.imgbb.text.includes('name="image"') && seen.imgbb.text.includes('name="name"'));
});
await t("المدخلات غير الصالحة تُرجع null بدون طلب شبكة", async () => {
  const before = seen.workerUrls.length;
  assert.equal(await serverProxyStorageProvider.uploadImage("not-an-image", "x"), null);
  assert.equal(await serverProxyStorageProvider.uploadImage("data:text/html;base64,PHNjcmlwdD4=", "x"), null);
  assert.equal(seen.workerUrls.length, before);
});
await t("callCloudFunction يتجه للـ Worker بنفس البروتوكول (دالة غير مدعومة = رسالة عربية واضحة)", async () => {
  await assert.rejects(() => callCloudFunction("migrateLegacyAccount", {}), (e) => /غير متاحة/.test(e.message));
  assert.ok(seen.workerUrls.at(-1).endsWith("/migrateLegacyAccount"));
});
await t("مستخدم غير مفعّل لا يستطيع الرفع عبر العميل", async () => {
  users.tech1.status = "pending";
  await assert.rejects(() => serverProxyStorageProvider.uploadImage(dataUrl, "x"));
  users.tech1.status = "active";
});

console.log("CORS");
await t("Preflight من نطاق التطبيق يُقبل ويسمح بـ Authorization", async () => {
  const r = await worker.fetch(new Request("https://odd-sun-fab8.mom379339.workers.dev/uploadImageViaImgbb", { method: "OPTIONS", headers: { Origin: "https://maintenance-defect-system.web.app", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization" } }), env);
  assert.equal(r.status, 204);
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), "https://maintenance-defect-system.web.app");
  assert.match(r.headers.get("Access-Control-Allow-Headers"), /Authorization/);
});
await t("Preflight من نطاق غريب لا يحصل على إذن", async () => {
  const r = await worker.fetch(new Request("https://odd-sun-fab8.mom379339.workers.dev/uploadImageViaImgbb", { method: "OPTIONS", headers: { Origin: "https://evil.example" } }), env);
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), null);
});

console.log(`\nالنتيجة: ${passed} نجح / ${failed} فشل`);
process.exit(failed ? 1 : 0);
