// اختبارات الـ Worker بدون شبكة: Firestore/Identity/ImgBB مُحاكاة في الذاكرة، وتوكنات Firebase حقيقية التوقيع (RSA).
// التشغيل: node tests/worker-tests.mjs
import assert from "node:assert/strict";
import worker, { normalizePhone, phoneVariants, normalizeCode } from "../cloudflare-worker/worker.mjs";

const PID = "demo-project";
const DOMAIN = "maintenance-defect-system.local";
const b64u = (buf) => Buffer.from(buf).toString("base64url");
const enc = (o) => b64u(JSON.stringify(o));

// ---------- مفاتيح ----------
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

// ---------- Firestore في الذاكرة ----------
const store = new Map();                 // "users/abc" -> fields (صيغة Firestore JSON)
const authEmails = new Map();            // uid -> email (حسابات الدخول)
const calls = [];
const S = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "number" ? { integerValue: String(v) } : typeof v === "boolean" ? { booleanValue: v } : { stringValue: String(v) }]));
const setUser = (id, role, status, extra = {}) => { store.set(`users/${id}`, S({ role, status, name: id, permissions: "", ...extra })); };
const setAuth = (id, phone) => authEmails.set(id, `${phone}@${DOMAIN}`);
const reset = () => { store.clear(); authEmails.clear(); calls.length = 0; };

const FS = `https://firestore.googleapis.com/v1/projects/${PID}/databases/(default)/documents`;
const J = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const pathOfName = (n) => n.split("/documents/")[1];
const matchFilter = (fields, f) => {
  if (!f) return true;
  if (f.compositeFilter) return f.compositeFilter.filters.every((x) => matchFilter(fields, x));
  const { field, op, value } = f.fieldFilter; const v = fields[field.fieldPath]?.stringValue;
  if (op === "EQUAL") return v === value.stringValue;
  if (op === "IN") return value.arrayValue.values.some((x) => x.stringValue === v);
  throw new Error("op غير مُحاكى " + op);
};

globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  if (url.includes("service_accounts/v1/jwk")) return J({ keys: [jwk] });
  if (url === "https://oauth2.googleapis.com/token") {
    const a = new URLSearchParams(opts.body).get("assertion").split(".");
    assert.ok(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", saKeys.publicKey, Buffer.from(a[2], "base64url"), new TextEncoder().encode(`${a[0]}.${a[1]}`)), "assertion غير موقّع صح");
    return J({ access_token: "AT", expires_in: 3600 });
  }
  if (url.startsWith("https://api.imgbb.com/")) {
    const buf = Buffer.from(await new Response(opts.body).arrayBuffer());
    calls.push({ t: "imgbb", url, type: opts.headers["Content-Type"], size: buf.length });
    return J({ success: true, data: { display_url: "https://i.ibb.co/x/a.png", url: "https://i.ibb.co/x/b.png" } });
  }
  assert.equal(opts.headers?.Authorization, "Bearer AT", "طلب بدون Bearer لحساب الخدمة: " + url);

  if (url.includes("identitytoolkit.googleapis.com")) {
    const action = url.split("accounts:")[1]; const body = JSON.parse(opts.body);
    calls.push({ t: "idt", action, body });
    if (action === "lookup") { const id = body.localId[0]; return authEmails.has(id) ? J({ users: [{ localId: id, email: authEmails.get(id) }] }) : J({}); }
    return J({ localId: body.localId });
  }
  if (url.endsWith("documents:runQuery")) {
    const q = JSON.parse(opts.body).structuredQuery; const col = q.from[0].collectionId;
    let rows = [...store.entries()].filter(([p, f]) => p.startsWith(col + "/") && matchFilter(f, q.where));
    if (q.limit) rows = rows.slice(0, q.limit);
    const names = q.select?.fields.map((x) => x.fieldPath) || null;
    const out = rows.map(([p, f]) => ({ document: { name: `projects/${PID}/databases/(default)/documents/${p}`, fields: !names || names.includes("__name__") ? (names ? {} : f) : Object.fromEntries(Object.entries(f).filter(([k]) => names.includes(k))) } }));
    return J(out.length ? out : [{ readTime: "x" }]);
  }
  if (url.endsWith("documents:commit")) {
    const { writes } = JSON.parse(opts.body); const results = [];
    for (const w of writes) {
      calls.push({ t: "commit", w });
      if (w.update) {
        const path = pathOfName(w.update.name); const exists = store.has(path);
        if (w.currentDocument?.exists === false && exists) return J({ error: { status: "ALREADY_EXISTS" } }, 409);
        if (w.currentDocument?.exists === true && !exists) return J({ error: { status: "NOT_FOUND" } }, 404);
        if (w.updateMask) {
          const cur = { ...(store.get(path) || {}) };
          for (const fp of w.updateMask.fieldPaths) { if (w.update.fields?.[fp]) cur[fp] = w.update.fields[fp]; else delete cur[fp]; }
          store.set(path, cur);
        } else store.set(path, w.update.fields || {});
        results.push({});
      } else if (w.delete) { store.delete(pathOfName(w.delete)); results.push({}); }
      else if (w.transform) {
        const path = pathOfName(w.transform.document); const cur = { ...(store.get(path) || {}) }; const tr = [];
        for (const t of w.transform.fieldTransforms) {
          const nv = Number(cur[t.fieldPath]?.integerValue || 0) + Number(t.increment.integerValue);
          cur[t.fieldPath] = { integerValue: String(nv) }; tr.push({ integerValue: String(nv) });
        }
        store.set(path, cur); results.push({ transformResults: tr });
      }
    }
    return J({ writeResults: results });
  }
  const m = url.match(/documents\/([^?]+)/);
  if (m) {
    const path = decodeURIComponent(m[1]); const method = opts.method || "GET";
    if (method === "GET") return store.has(path) ? J({ fields: store.get(path) }) : J({}, 404);
    if (method === "DELETE") { store.delete(path); calls.push({ t: "fsDelete", path }); return J({}); }
    if (method === "PATCH") {
      const f = JSON.parse(opts.body).fields; calls.push({ t: "fsPatch", path, f, url });
      store.set(path, { ...store.get(path), ...f }); return J({});
    }
  }
  throw new Error("fetch غير مُحاكى: " + url);
};

const env = { FIREBASE_PROJECT_ID: PID, IMGBB_API_KEY: "SECRETKEY", SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: "sa@x.iam", private_key: saPem }) };
const ORIGIN = "https://maintenance-defect-system.web.app";

async function call(fn, data, tokenOrUid, headers = {}) {
  const token = tokenOrUid && tokenOrUid.includes(".") ? tokenOrUid : (tokenOrUid ? await makeToken(tokenOrUid) : "");
  const req = new Request(`https://w.example/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN, ...(token && { Authorization: `Bearer ${token}` }), ...headers },
    body: JSON.stringify({ data })
  });
  const res = await worker.fetch(req, env);
  return { status: res.status, body: await res.json() };
}

let passed = 0, failed = 0;
const t = async (name, fn) => { calls.length = 0; try { await fn(); passed++; console.log("  ✅", name); } catch (e) { failed++; console.log("  ❌", name, "\n     ", e.message); } };
const baseSetup = () => { reset(); setUser("admin1", "admin", "active"); setUser("admin2", "admin", "active"); setUser("tech1", "technician", "active"); setUser("pend1", "pending", "pending"); };
const secretOf = (uid) => store.get(`userSecrets/${uid}`);

console.log("المصادقة");
baseSetup();
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
await t("دوال غير موجودة = 404 (منها مسار إعادة التعيين بواسطة الأدمن الذي أُلغي للخصوصية)", async () => {
  assert.equal((await call("migrateLegacyAccount", {}, "admin1")).status, 404);
  assert.equal((await call("adminResetUserPassword", { userId: "tech1", newPassword: "newpass123" }, "admin1")).status, 404);
  assert.ok(!calls.some((c) => c.t === "idt"));
});

console.log("عمليات الأدمن");
await t("حذف مستخدم عادي: مستند + حساب الدخول", async () => {
  const r = await call("deleteUserAccount", { userId: "pend1" }, "admin1");
  assert.equal(r.status, 200); assert.ok(!store.has("users/pend1"));
  assert.ok(calls.some((c) => c.t === "idt" && c.action === "delete" && c.body.localId === "pend1"));
});
await t("غير الأدمن لا يحذف", async () => { assert.equal((await call("deleteUserAccount", { userId: "pend1" }, "tech1")).status, 403); });
await t("منع تنزيل/حذف آخر Admin نشط", async () => {
  store.delete("users/admin2");
  assert.equal((await call("updateUserRoleAccount", { userId: "admin1", role: "technician" }, "admin1")).status, 412);
  assert.equal((await call("deleteUserAccount", { userId: "admin1" }, "admin1")).status, 412);
  assert.ok(store.has("users/admin1")); setUser("admin2", "admin", "active");
});
await t("تنزيل Admin مع وجود آخر ينجح ويكتب الحقول المطلوبة فقط", async () => {
  const r = await call("updateUserRoleAccount", { userId: "admin2", role: "manager", permissions: "a,b" }, "admin1");
  assert.equal(r.status, 200);
  const p = calls.find((c) => c.t === "fsPatch");
  assert.deepEqual(Object.keys(p.f).sort(), ["permissions", "role", "updatedAt", "updatedBy"]);
  assert.equal(store.get("users/admin2").role.stringValue, "manager"); assert.ok(p.url.includes("currentDocument.exists=true"));
});
await t("دور غير معروف يُرفض", async () => { assert.equal((await call("updateUserRoleAccount", { userId: "tech1", role: "root" }, "admin1")).status, 400); });

console.log("رفع الصور");
async function uploadReq(uid, bytes = 1000) {
  const fd = new FormData(); fd.append("image", new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }), "a.jpg"); fd.append("name", "t");
  const packed = new Response(fd); const buf = Buffer.from(await packed.arrayBuffer());
  const req = new Request("https://w.example/uploadImageViaImgbb", { method: "POST", body: buf,
    headers: { "Content-Type": packed.headers.get("content-type"), "Content-Length": String(buf.length), Origin: ORIGIN, Authorization: `Bearer ${await makeToken(uid)}` } });
  const res = await worker.fetch(req, env); return { status: res.status, body: await res.json() };
}
await t("مستخدم نشط يرفع صورة: الجسم يُمرَّر والمفتاح من السيرفر", async () => {
  const r = await uploadReq("tech1"); assert.equal(r.status, 200); assert.equal(r.body.result.url, "https://i.ibb.co/x/a.png");
  const c = calls.find((c) => c.t === "imgbb"); assert.ok(c.url.includes("key=SECRETKEY")); assert.ok(c.type.startsWith("multipart/form-data")); assert.ok(c.size > 1000);
});
await t("مستخدم غير نشط لا يرفع", async () => { setUser("pend2", "pending", "pending"); assert.equal((await uploadReq("pend2")).status, 403); });
await t("صورة أكبر من 8MB تُرفض قبل أي تمرير", async () => {
  const req = new Request("https://w.example/uploadImageViaImgbb", { method: "POST", body: "x",
    headers: { "Content-Type": "multipart/form-data; boundary=a", "Content-Length": String(9 * 1024 * 1024), Authorization: `Bearer ${await makeToken("tech1")}` } });
  const res = await worker.fetch(req, env); assert.equal(res.status, 413); assert.ok(!calls.some((c) => c.t === "imgbb"));
});
await t("رفع بدون Content-Length يعمل (تجميع بحد أقصى)", async () => {
  const fd = new FormData(); fd.append("image", new Blob([new Uint8Array(2000)], { type: "image/jpeg" }), "a.jpg");
  const packed = new Response(fd); const buf = Buffer.from(await packed.arrayBuffer());
  const req = new Request("https://w.example/uploadImageViaImgbb", { method: "POST", body: buf, headers: { "Content-Type": packed.headers.get("content-type"), Authorization: `Bearer ${await makeToken("tech1")}` } });
  req.headers.delete("content-length");
  const res = await worker.fetch(req, env); assert.equal(res.status, 200); assert.ok(calls.find((c) => c.t === "imgbb").size > 2000);
});
await t("جسم أكبر من 8MB بدون Content-Length يُرفض أثناء القراءة", async () => {
  const req = new Request("https://w.example/uploadImageViaImgbb", { method: "POST", body: new Uint8Array(9 * 1024 * 1024), headers: { "Content-Type": "multipart/form-data; boundary=a", Authorization: `Bearer ${await makeToken("tech1")}` } });
  req.headers.delete("content-length");
  const res = await worker.fetch(req, env); assert.equal(res.status, 413); assert.ok(!calls.some((c) => c.t === "imgbb"));
});

console.log("كود الموظف: التسجيل والترحيل");
await t("تطبيع الكود والهاتف", () => {
  assert.equal(normalizeCode(" ab-١٢٣ 4 "), "AB1234");
  assert.equal(normalizePhone("٠١٠٠١٢٣٤٥٦٧").canonical, "01001234567");
  assert.ok(phoneVariants("01001234567").includes("201001234567"));
});
await t("registerEmployeeCode يخزّن هاشاً (لا نص صريح) مرة واحدة فقط", async () => {
  baseSetup();
  const r = await call("registerEmployeeCode", { code: "EMP-7788" }, "tech1");
  assert.equal(r.status, 200);
  const sec = secretOf("tech1"); assert.ok(sec.codeHash.stringValue.length === 64 && sec.salt.stringValue.length === 32);
  assert.ok(!JSON.stringify(sec).includes("7788"), "الكود ظاهر نصاً");
  assert.equal((await call("registerEmployeeCode", { code: "OTHER99" }, "tech1")).status, 409);   // مفيش استبدال
  assert.equal((await call("registerEmployeeCode", { code: "12" }, "admin1")).status, 400);        // قصير
  assert.equal((await call("registerEmployeeCode", { code: "EMP-7788" }, "")).status, 401);        // بدون توكن
});
await t("migrateEmployeeCodes: للأدمن فقط، ينقل الأكواد القديمة ويحذفها من users، ومتكرر بأمان", async () => {
  baseSetup();
  setUser("e1", "technician", "active", { code: "A100" }); setUser("e2", "engineer", "active", { code: "٢٠٠" }); setUser("e3", "operator", "active");
  assert.equal((await call("migrateEmployeeCodes", {}, "tech1")).status, 403);
  const r = await call("migrateEmployeeCodes", {}, "admin1");
  assert.equal(r.status, 200); assert.equal(r.body.result.secretsCreated, 2); assert.equal(r.body.result.codeFieldsRemoved, 2);
  assert.ok(!store.get("users/e1").code && !store.get("users/e2").code, "الكود لسه ظاهر في users");
  assert.ok(secretOf("e1") && secretOf("e2") && !secretOf("e3"));
  assert.ok(!JSON.stringify(secretOf("e1")).includes("A100"));
  const again = await call("migrateEmployeeCodes", {}, "admin1"); assert.equal(again.body.result.codeFieldsRemoved, 0);
});

console.log("إعادة تعيين كلمة السر بواسطة المستخدم (هاتف + كود الموظف)");
const PHONE = "01001234567";
async function setupVictim(code = "EMP-7788") {
  baseSetup(); setUser("vic", "technician", "active", { phone: PHONE }); setAuth("vic", PHONE);
  assert.equal((await call("registerEmployeeCode", { code }, "vic")).status, 200); calls.length = 0;
}
const reset1 = (phone, code, pw = "NewPass123", ip = "1.1.1.1") => call("resetPasswordWithEmployeeCode", { phone, code, newPassword: pw }, "", { "CF-Connecting-IP": ip });

await t("نجاح بدون تسجيل دخول: يتغير الباسورد، وتُلغى الجلسات، ويُصفَّر العدّاد", async () => {
  await setupVictim();
  const r = await reset1(PHONE, "EMP-7788");
  assert.equal(r.status, 200); assert.equal(r.body.result.status, "success");
  const u = calls.find((c) => c.t === "idt" && c.action === "update");
  assert.equal(u.body.localId, "vic"); assert.equal(u.body.password, "NewPass123"); assert.ok(u.body.validSince);
  assert.ok([...store.keys()].every((k) => !k.startsWith("resetAttempts/p_")), "عدّاد الرقم لم يُصفَّر");
});
await t("يقبل صيغ مختلفة للرقم والكود (أرقام عربية، +20، حروف صغيرة، مسافات)", async () => {
  await setupVictim();
  assert.equal((await reset1("+20 100 123 4567", " emp-7788 ")).status, 200);
  await setupVictim("٥٥٥٥");
  assert.equal((await reset1("٠١٠٠١٢٣٤٥٦٧", "5555")).status, 200);
});
await t("كود خاطئ: رسالة عامة ولا يتغير الباسورد", async () => {
  await setupVictim();
  const r = await reset1(PHONE, "WRONG1"); assert.equal(r.status, 403); assert.match(r.body.error.message, /غير صحيح/);
  assert.ok(!calls.some((c) => c.t === "idt" && c.action === "update"));
});
await t("رقم غير مسجل: نفس رسالة الخطأ (لا يكشف وجود الحساب)", async () => {
  await setupVictim();
  const a = await reset1("01099999999", "EMP-7788"); const b = await reset1(PHONE, "WRONG1");
  assert.equal(a.status, b.status); assert.equal(a.body.error.message, b.body.error.message);
});
await t("كلمة سر قصيرة تُرفض قبل استهلاك أي محاولة", async () => {
  await setupVictim();
  assert.equal((await reset1(PHONE, "EMP-7788", "short")).status, 400);
  assert.ok([...store.keys()].every((k) => !k.startsWith("resetAttempts/")), "اتستهلكت محاولة على مدخل غير صالح");
});
await t("بعد 5 محاولات فاشلة يُغلق الرقم حتى مع الكود الصحيح، والمرفوض لا يمدّد الحظر", async () => {
  await setupVictim();
  for (let i = 0; i < 5; i++) assert.equal((await reset1(PHONE, "BAD" + i, "NewPass123", "2.2.2." + i)).status, 403);
  const blocked = await reset1(PHONE, "EMP-7788", "NewPass123", "3.3.3.3");
  assert.equal(blocked.status, 429); assert.match(blocked.body.error.message, /تجاوز عدد المحاولات/);
  for (let i = 0; i < 10; i++) await reset1(PHONE, "EMP-7788", "NewPass123", "4.4.4." + i);
  const key = [...store.keys()].find((k) => k.startsWith("resetAttempts/p_"));
  assert.equal(store.get(key).n.integerValue, "5", "المحاولات المرفوضة زوّدت العدّاد");
  assert.ok(!calls.some((c) => c.t === "idt" && c.action === "update"));
});
await t("هجوم متوازي (30 طلب معاً): 5 فقط يصلوا للتحقق", async () => {
  await setupVictim();
  const rs = await Promise.all(Array.from({ length: 30 }, (_, i) => reset1(PHONE, "G" + i, "NewPass123", "5.5." + i + ".1")));
  assert.equal(rs.filter((r) => r.status === 403).length, 5); assert.equal(rs.filter((r) => r.status === 429).length, 25);
});
await t("حد لكل IP: الطلب 41 من نفس الجهاز يُرفض حتى لأرقام مختلفة", async () => {
  await setupVictim();
  for (let i = 0; i < 40; i++) await reset1("0100000" + String(1000 + i), "X", "NewPass123", "9.9.9.9");
  const r = await reset1("01011112222", "X", "NewPass123", "9.9.9.9");
  assert.equal(r.status, 429); assert.match(r.body.error.message, /نفس الجهاز/);
});
await t("مستند users برقم الضحية لحساب آخر لا يستولي على الحساب (ربط الهوية بإيميل الدخول)", async () => {
  await setupVictim();
  setUser("evil", "technician", "active", { phone: PHONE }); setAuth("evil", "01055550000");
  assert.equal((await call("registerEmployeeCode", { code: "EVIL-1" }, "evil")).status, 200); calls.length = 0;
  const r = await reset1(PHONE, "EVIL-1"); assert.equal(r.status, 403);
  assert.ok(!calls.some((c) => c.t === "idt" && c.action === "update"), "اتغيّر باسورد!");
});
await t("حساب مرفوض (rejected) أو بدون كود مسجل لا يمكنه الاستعادة", async () => {
  await setupVictim(); store.set("users/vic", { ...store.get("users/vic"), status: { stringValue: "rejected" } });
  assert.equal((await reset1(PHONE, "EMP-7788")).status, 403);
  baseSetup(); setUser("nocode", "technician", "active", { phone: "01022223333" }); setAuth("nocode", "01022223333");
  assert.equal((await reset1("01022223333", "ANYTHING")).status, 403);
});
await t("لا يوجد أي رد يكشف الكود أو الهاش", async () => {
  await setupVictim(); const r = await reset1(PHONE, "WRONG");
  assert.ok(!JSON.stringify(r.body).match(/codeHash|salt|7788/));
});

console.log(`\nالنتيجة: ${passed} نجح / ${failed} فشل`);
process.exit(failed ? 1 : 0);
