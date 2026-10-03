// اختبارات الـ Worker بدون شبكة: fetch مُحاكى لـ Google/Firestore/ImgBB، وتوكن Firebase حقيقي التوقيع (RSA).
// التشغيل: node tests/worker-tests.mjs
import assert from "node:assert/strict";
import worker, { verifyIdToken } from "../cloudflare-worker/worker.mjs";

const PID = "demo-project";
const b64u = (buf) => Buffer.from(buf).toString("base64url");
const enc = (o) => b64u(JSON.stringify(o));

// مفتاح "جوجل" لتوقيع التوكنات + مفتاح حساب الخدمة
const algo = { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" };
const googleKeys = await crypto.subtle.generateKey(algo, true, ["sign", "verify"]);
const saKeys = await crypto.subtle.generateKey(algo, true, ["sign", "verify"]);
const jwk = { ...(await crypto.subtle.exportKey("jwk", googleKeys.publicKey)), kid: "k1", alg: "RS256", use: "sig" };
const saPem = "-----BEGIN PRIVATE KEY-----\n" + Buffer.from(await crypto.subtle.exportKey("pkcs8", saKeys.privateKey)).toString("base64").match(/.{1,64}/g).join("\n") + "\n-----END PRIVATE KEY-----\n";

async function makeToken(uid, over = {}, key = googleKeys.privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const h = enc({ alg: "RS256", kid: "k1", typ: "JWT" });
  const p = enc({ aud: PID, iss: `https://securetoken.google.com/${PID}`, sub: uid, iat: now - 10, exp: now + 3000, ...over });
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${h}.${p}`));
  return `${h}.${p}.${b64u(sig)}`;
}

// ---- قاعدة بيانات وهمية + سجل استدعاءات ----
const db = {};
const calls = [];
const setUser = (id, role, status, name = id) => { db[id] = { role, status, name, permissions: "" }; };
const fields = (u) => Object.fromEntries(Object.entries(u).map(([k, v]) => [k, { stringValue: v }]));

globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  const J = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  if (url.includes("service_accounts/v1/jwk")) return J({ keys: [jwk] });
  if (url === "https://oauth2.googleapis.com/token") {
    // نتحقق إن الـ assertion موقّع فعلاً بمفتاح حساب الخدمة
    const a = new URLSearchParams(opts.body).get("assertion").split(".");
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", saKeys.publicKey, Buffer.from(a[2], "base64url"), new TextEncoder().encode(`${a[0]}.${a[1]}`));
    assert.ok(ok, "assertion غير موقّع صح");
    calls.push({ t: "oauth" });
    return J({ access_token: "AT", expires_in: 3600 });
  }
  if (url.startsWith("https://api.imgbb.com/")) {
    const buf = Buffer.from(await new Response(opts.body).arrayBuffer());
    calls.push({ t: "imgbb", url, type: opts.headers["Content-Type"], size: buf.length });
    return J({ success: true, data: { display_url: "https://i.ibb.co/x/a.png", url: "https://i.ibb.co/x/b.png" } });
  }
  assert.equal(opts.headers?.Authorization, "Bearer AT", "طلب بدون Bearer لحساب الخدمة: " + url);
  if (url.includes("identitytoolkit.googleapis.com")) {
    const action = url.split("accounts:")[1];
    const body = JSON.parse(opts.body);
    calls.push({ t: "idt", action, body });
    return J({ localId: body.localId });
  }
  if (url.endsWith("documents:runQuery")) {
    const rows = Object.entries(db).filter(([, u]) => u.role === "admin" && u.status === "active")
      .map(([id]) => ({ document: { name: `projects/${PID}/databases/(default)/documents/users/${id}` } }));
    return J(rows.length ? rows : [{}]);
  }
  const m = url.match(/documents\/users\/([^?]+)/);
  if (m) {
    const id = decodeURIComponent(m[1]);
    const method = opts.method || "GET";
    if (method === "GET") return db[id] ? J({ fields: fields(db[id]) }) : J({}, 404);
    if (method === "DELETE") { delete db[id]; calls.push({ t: "fsDelete", id }); return J({}); }
    if (method === "PATCH") {
      const f = JSON.parse(opts.body).fields; calls.push({ t: "fsPatch", id, f, url });
      Object.entries(f).forEach(([k, v]) => { db[id][k] = v.stringValue; });
      return J({});
    }
  }
  throw new Error("fetch غير مُحاكى: " + url);
};

const env = { FIREBASE_PROJECT_ID: PID, IMGBB_API_KEY: "SECRETKEY", SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: "sa@x.iam", private_key: saPem }) };
const ORIGIN = "https://maintenance-defect-system.web.app";

async function call(fn, data, tokenOrUid, extra = {}) {
  const token = tokenOrUid && tokenOrUid.includes(".") ? tokenOrUid : (tokenOrUid ? await makeToken(tokenOrUid) : "");
  const req = new Request(`https://w.example/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN, ...(token && { Authorization: `Bearer ${token}` }) },
    body: JSON.stringify({ data })
  });
  const res = await worker.fetch(req, env);
  return { status: res.status, body: await res.json(), headers: res.headers };
}

let passed = 0, failed = 0;
const t = async (name, fn) => { calls.length = 0; try { await fn(); passed++; console.log("  ✅", name); } catch (e) { failed++; console.log("  ❌", name, "\n     ", e.message); } };

setUser("admin1", "admin", "active", "Boss");
setUser("admin2", "admin", "active", "Boss2");
setUser("tech1", "technician", "active", "Tech");
setUser("pend1", "pending", "pending");

console.log("Worker - المصادقة");
await t("health + CORS لنطاق مسموح فقط", async () => {
  const r = await worker.fetch(new Request("https://w.example/health", { headers: { Origin: ORIGIN } }), env);
  assert.equal(r.status, 200); assert.equal(r.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  const r2 = await worker.fetch(new Request("https://w.example/health", { headers: { Origin: "https://evil.example" } }), env);
  assert.equal(r2.headers.get("Access-Control-Allow-Origin"), null);
});
await t("بدون توكن = 401", async () => { assert.equal((await call("deleteUserAccount", { userId: "x" }, "")).status, 401); });
await t("توكن موقّع بمفتاح مزيّف = 401", async () => {
  const fake = await crypto.subtle.generateKey(algo, true, ["sign", "verify"]);
  assert.equal((await call("deleteUserAccount", { userId: "x" }, await makeToken("admin1", {}, fake.privateKey))).status, 401);
});
await t("توكن منتهي أو لمشروع آخر = 401", async () => {
  assert.equal((await call("deleteUserAccount", { userId: "x" }, await makeToken("admin1", { exp: Math.floor(Date.now() / 1000) - 100 }))).status, 401);
  assert.equal((await call("deleteUserAccount", { userId: "x" }, await makeToken("admin1", { aud: "other" }))).status, 401);
});
await t("دالة غير معروفة (مثل migrateLegacyAccount) = 404", async () => {
  const r = await call("migrateLegacyAccount", {}, "admin1"); assert.equal(r.status, 404);
});

console.log("Worker - عمليات الأدمن");
await t("غير الأدمن لا يستطيع إعادة تعيين كلمة سر", async () => {
  const r = await call("adminResetUserPassword", { userId: "tech1", newPassword: "newpass1" }, "tech1");
  assert.equal(r.status, 403); assert.ok(!calls.some(c => c.t === "idt"));
});
await t("الأدمن يعيّن كلمة سر + إلغاء الجلسات القديمة", async () => {
  const r = await call("adminResetUserPassword", { userId: "tech1", newPassword: "newpass1" }, "admin1");
  assert.equal(r.status, 200); assert.equal(r.body.result.status, "success");
  const c = calls.find(c => c.t === "idt"); assert.equal(c.action, "update");
  assert.equal(c.body.localId, "tech1"); assert.equal(c.body.password, "newpass1"); assert.ok(c.body.validSince);
});
await t("كلمة سر قصيرة تُرفض", async () => {
  assert.equal((await call("adminResetUserPassword", { userId: "tech1", newPassword: "123" }, "admin1")).status, 400);
});
await t("حذف مستخدم عادي: مستند + حساب الدخول", async () => {
  const r = await call("deleteUserAccount", { userId: "pend1" }, "admin1");
  assert.equal(r.status, 200); assert.ok(calls.some(c => c.t === "fsDelete" && c.id === "pend1"));
  assert.ok(calls.some(c => c.t === "idt" && c.action === "delete" && c.body.localId === "pend1"));
});
await t("منع تنزيل/حذف آخر Admin نشط", async () => {
  delete db.admin2;
  const r1 = await call("updateUserRoleAccount", { userId: "admin1", role: "technician" }, "admin1");
  assert.equal(r1.status, 412);
  const r2 = await call("deleteUserAccount", { userId: "admin1" }, "admin1");
  assert.equal(r2.status, 412); assert.ok(db.admin1, "اتحذف آخر أدمن!");
  setUser("admin2", "admin", "active", "Boss2");
});
await t("تنزيل Admin مع وجود آخر ينجح ويكتب الحقول المطلوبة فقط", async () => {
  const r = await call("updateUserRoleAccount", { userId: "admin2", role: "manager", permissions: "a,b" }, "admin1");
  assert.equal(r.status, 200);
  const p = calls.find(c => c.t === "fsPatch");
  assert.deepEqual(Object.keys(p.f).sort(), ["permissions", "role", "updatedAt", "updatedBy"]);
  assert.equal(db.admin2.role, "manager"); assert.ok(p.url.includes("currentDocument.exists=true"));
});
await t("دور غير معروف يُرفض", async () => {
  assert.equal((await call("updateUserRoleAccount", { userId: "tech1", role: "root" }, "admin1")).status, 400);
});

console.log("Worker - رفع الصور");
async function uploadReq(uid, bytes = 1000) {
  const fd = new FormData(); fd.append("image", new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }), "a.jpg"); fd.append("name", "t");
  const packed = new Response(fd); const buf = Buffer.from(await packed.arrayBuffer());
  const req = new Request("https://w.example/uploadImageViaImgbb", {
    method: "POST", body: buf,
    headers: { "Content-Type": packed.headers.get("content-type"), "Content-Length": String(buf.length), Origin: ORIGIN, Authorization: `Bearer ${await makeToken(uid)}` }
  });
  const res = await worker.fetch(req, env); return { status: res.status, body: await res.json() };
}
await t("مستخدم نشط يرفع صورة: الجسم يُمرَّر كما هو والمفتاح من السيرفر", async () => {
  const r = await uploadReq("tech1");
  assert.equal(r.status, 200); assert.equal(r.body.result.url, "https://i.ibb.co/x/a.png");
  const c = calls.find(c => c.t === "imgbb");
  assert.ok(c.url.includes("key=SECRETKEY")); assert.ok(c.type.startsWith("multipart/form-data")); assert.ok(c.size > 1000);
});
await t("مستخدم غير نشط لا يرفع", async () => {
  setUser("pend2", "pending", "pending"); assert.equal((await uploadReq("pend2")).status, 403);
});
await t("صورة أكبر من 8MB تُرفض قبل أي تمرير", async () => {
  const req = new Request("https://w.example/uploadImageViaImgbb", { method: "POST", body: "x",
    headers: { "Content-Type": "multipart/form-data; boundary=a", "Content-Length": String(9 * 1024 * 1024), Authorization: `Bearer ${await makeToken("tech1")}` } });
  const res = await worker.fetch(req, env); assert.equal(res.status, 413); assert.ok(!calls.some(c => c.t === "imgbb"));
});

console.log(`\nالنتيجة: ${passed} نجح / ${failed} فشل`);
process.exit(failed ? 1 : 0);
