// ============================================================
// Cloudflare Worker - بديل مجاني لـ Firebase Cloud Functions (خطة Spark)
// ============================================================
// بيستبدل الدوال دي بنفس بروتوكول التطبيق (POST /<اسم_الدالة> بـ {data:{...}}
// ويرجع {result:{...}} أو {error:{message,status}}):
//   - uploadImageViaImgbb      رفع صورة لـ ImgBB (المفتاح سر هنا فقط)
//   - adminResetUserPassword   الأدمن يعيّن كلمة سر مؤقتة لمستخدم
//   - deleteUserAccount        حذف حساب Auth + مستند المستخدم (Admin فقط)
//   - updateUserRoleAccount    تغيير دور (مطلوب لتنزيل Admin نشط) بحماية "آخر Admin"
// migrateLegacyAccount (ترحيل الحسابات القديمة) غير مدعومة هنا عمداً.
//
// Secrets / Variables المطلوبة (Settings -> Variables and Secrets):
//   SERVICE_ACCOUNT_JSON  (Secret)  محتوى ملف مفتاح حساب الخدمة كاملاً
//   IMGBB_API_KEY         (Secret)  مفتاح ImgBB
//   FIREBASE_PROJECT_ID   (Text)    مثال: maintenance-defect-system
//   ALLOWED_ORIGINS       (Text, اختياري) نطاقات مفصولة بفواصل
// ============================================================

const DEFAULT_ORIGINS = [
  "https://maintenance-defect-system.web.app",
  "https://maintenance-defect-system.firebaseapp.com",
  "https://my-dev-2026.web.app",
  "https://my-dev-2026.firebaseapp.com",
  "http://localhost:3000"
];

const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

// ---------- base64url ----------
const b64urlToBytes = (s) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
const bytesToB64url = (bytes) => {
  let bin = ""; bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const strToB64url = (s) => bytesToB64url(new TextEncoder().encode(s));
const b64urlToJson = (s) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));

// ---------- التحقق من Firebase ID token ----------
let jwksCache = { keys: null, at: 0 };

async function getJwks() {
  if (jwksCache.keys && Date.now() - jwksCache.at < 3600_000) return jwksCache.keys;
  const res = await fetch(JWKS_URL, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!res.ok) throw new HttpError(503, "UNAVAILABLE", "تعذّر جلب مفاتيح التحقق.");
  const { keys } = await res.json();
  jwksCache = { keys, at: Date.now() };
  return keys;
}

export async function verifyIdToken(token, projectId) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new HttpError(401, "UNAUTHENTICATED", "يجب تسجيل الدخول أولاً.");
  let header, payload;
  try { header = b64urlToJson(parts[0]); payload = b64urlToJson(parts[1]); }
  catch { throw new HttpError(401, "UNAUTHENTICATED", "توكن غير صالح."); }

  if (header.alg !== "RS256" || !header.kid) throw new HttpError(401, "UNAUTHENTICATED", "توكن غير صالح.");

  const keys = await getJwks();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new HttpError(401, "UNAUTHENTICATED", "توكن غير صالح.");

  const key = await crypto.subtle.importKey(
    "jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]
  );
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5", key, b64urlToBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!ok) throw new HttpError(401, "UNAUTHENTICATED", "توكن غير صالح.");

  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`
      || !payload.sub || typeof payload.sub !== "string"
      || payload.exp <= now - 5 || payload.iat > now + 300) {
    throw new HttpError(401, "UNAUTHENTICATED", "انتهت الجلسة، سجّل الدخول مرة أخرى.");
  }
  return payload; // payload.sub = uid
}

// ---------- OAuth لحساب الخدمة ----------
let tokenCache = { value: null, exp: 0 };

async function getAccessToken(env) {
  if (tokenCache.value && Date.now() < tokenCache.exp - 60_000) return tokenCache.value;

  let sa;
  try { sa = JSON.parse(env.SERVICE_ACCOUNT_JSON); }
  catch { throw new HttpError(500, "INTERNAL", "إعداد السيرفر غير مكتمل (SERVICE_ACCOUNT_JSON)."); }

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  };
  const unsigned = `${strToB64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${strToB64url(JSON.stringify(claim))}`;

  const pem = String(sa.private_key).replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)));

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${bytesToB64url(sig)}`
    })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    console.error("oauth failed", res.status, json.error);
    throw new HttpError(500, "INTERNAL", "تعذّر الاتصال بخدمات Google من السيرفر.");
  }
  tokenCache = { value: json.access_token, exp: Date.now() + (json.expires_in || 3600) * 1000 };
  return json.access_token;
}

// ---------- Firestore REST ----------
const fsBase = (env) => `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
const authHeaders = async (env) => ({ Authorization: `Bearer ${await getAccessToken(env)}`, "Content-Type": "application/json" });
const strField = (f) => (f && typeof f.stringValue === "string" ? f.stringValue : "");

async function getUserDoc(env, uid) {
  const res = await fetch(`${fsBase(env)}/users/${encodeURIComponent(uid)}`, { headers: await authHeaders(env) });
  if (res.status === 404) return null;
  if (!res.ok) throw new HttpError(500, "INTERNAL", "تعذّرت قراءة بيانات المستخدم.");
  const f = (await res.json()).fields || {};
  return { role: strField(f.role), status: strField(f.status), name: strField(f.name), permissions: strField(f.permissions) };
}

async function countOtherActiveAdmins(env, excludeUid) {
  const res = await fetch(`${fsBase(env)}:runQuery`, {
    method: "POST",
    headers: await authHeaders(env),
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "users" }],
        where: { compositeFilter: { op: "AND", filters: [
          { fieldFilter: { field: { fieldPath: "role" }, op: "EQUAL", value: { stringValue: "admin" } } },
          { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "active" } } }
        ] } },
        select: { fields: [{ fieldPath: "__name__" }] },
        limit: 5
      }
    })
  });
  if (!res.ok) throw new HttpError(500, "INTERNAL", "تعذّر التحقق من عدد المسؤولين.");
  const rows = await res.json();
  return rows.filter((r) => r.document && !r.document.name.endsWith(`/users/${excludeUid}`)).length;
}

async function requireActiveAdmin(env, uid) {
  const me = await getUserDoc(env, uid);
  if (!me || me.role !== "admin" || me.status !== "active") {
    throw new HttpError(403, "PERMISSION_DENIED", "هذه العملية مقصورة على Admin فقط.");
  }
  return me;
}

async function identityToolkit(env, action, body) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/accounts:${action}`, {
    method: "POST", headers: await authHeaders(env), body: JSON.stringify(body)
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, message: json?.error?.message || "" };
}

// ---------- المعالجات ----------
const handlers = {
  async adminResetUserPassword(data, caller, env) {
    const { userId, newPassword } = data || {};
    if (!userId || typeof userId !== "string" || userId.length > 128) throw new HttpError(400, "INVALID_ARGUMENT", "معرف المستخدم غير صالح.");
    if (typeof newPassword !== "string" || newPassword.length < 6 || newPassword.length > 128) {
      throw new HttpError(400, "INVALID_ARGUMENT", "كلمة السر يجب أن تكون بين ٦ و١٢٨ حرفًا.");
    }
    await requireActiveAdmin(env, caller);
    if (!(await getUserDoc(env, userId))) throw new HttpError(404, "NOT_FOUND", "المستخدم غير موجود.");

    // validSince بيلغي كل جلسات المستخدم القديمة
    const r = await identityToolkit(env, "update", {
      localId: userId, password: newPassword, validSince: String(Math.floor(Date.now() / 1000))
    });
    if (!r.ok) {
      if (r.message.includes("USER_NOT_FOUND")) {
        throw new HttpError(412, "FAILED_PRECONDITION", "هذا الحساب غير مسجل في نظام الدخول.");
      }
      console.error("reset failed", r.message);
      throw new HttpError(500, "INTERNAL", "تعذّر تغيير كلمة السر، حاول مرة أخرى.");
    }
    return { status: "success" };
  },

  async deleteUserAccount(data, caller, env) {
    const { userId } = data || {};
    if (!userId || typeof userId !== "string" || userId.length > 128) throw new HttpError(400, "INVALID_ARGUMENT", "معرف المستخدم غير صالح.");
    await requireActiveAdmin(env, caller);

    const target = await getUserDoc(env, userId);
    if (target && target.role === "admin" && target.status === "active"
        && (await countOtherActiveAdmins(env, userId)) === 0) {
      throw new HttpError(412, "FAILED_PRECONDITION", "لا يمكن حذف هذا المستخدم لأنه آخر Admin نشط في النظام.");
    }

    if (target) {
      const del = await fetch(`${fsBase(env)}/users/${encodeURIComponent(userId)}`, { method: "DELETE", headers: await authHeaders(env) });
      if (!del.ok && del.status !== 404) throw new HttpError(500, "INTERNAL", "تعذّر حذف بيانات المستخدم.");
    }
    const r = await identityToolkit(env, "delete", { localId: userId });
    if (!r.ok && !r.message.includes("USER_NOT_FOUND")) {
      console.error("auth delete failed", r.message);
      throw new HttpError(500, "INTERNAL", "تم حذف بيانات المستخدم لكن تعذّر حذف حساب الدخول.");
    }
    return { status: "success" };
  },

  async updateUserRoleAccount(data, caller, env) {
    const { userId, role, permissions } = data || {};
    if (!userId || typeof userId !== "string" || userId.length > 128) throw new HttpError(400, "INVALID_ARGUMENT", "معرف المستخدم غير صالح.");
    if (!role || typeof role !== "string" || !["admin", "manager", "supervisor", "engineer", "technician", "operator"].includes(role)) {
      throw new HttpError(400, "INVALID_ARGUMENT", "الدور الجديد غير صالح.");
    }
    const me = await requireActiveAdmin(env, caller);
    const target = await getUserDoc(env, userId);
    if (!target) throw new HttpError(404, "NOT_FOUND", "المستخدم غير موجود.");

    if (target.role === "admin" && target.status === "active" && role !== "admin"
        && (await countOtherActiveAdmins(env, userId)) === 0) {
      throw new HttpError(412, "FAILED_PRECONDITION", "لا يمكن تغيير دور هذا المستخدم لأنه آخر Admin نشط في النظام.");
    }

    const perms = typeof permissions === "string" ? permissions.slice(0, 2000) : target.permissions;
    const mask = ["role", "permissions", "updatedAt", "updatedBy"].map((f) => `updateMask.fieldPaths=${f}`).join("&");
    const res = await fetch(`${fsBase(env)}/users/${encodeURIComponent(userId)}?${mask}&currentDocument.exists=true`, {
      method: "PATCH",
      headers: await authHeaders(env),
      body: JSON.stringify({ fields: {
        role: { stringValue: role },
        permissions: { stringValue: perms },
        updatedAt: { stringValue: new Date().toISOString() },
        updatedBy: { stringValue: me.name || "Admin" }
      } })
    });
    if (!res.ok) throw new HttpError(500, "INTERNAL", "تعذّر تحديث الدور.");
    return { status: "success" };
  }
};

// رفع الصور: الجسم (multipart) بيتمرّر لـ ImgBB كما هو بدون تحليل (CPU قليل جداً)
async function handleUpload(request, caller, env) {
  const me = await getUserDoc(env, caller);
  if (!me || me.status !== "active") throw new HttpError(403, "PERMISSION_DENIED", "الحساب غير مفعّل.");

  const len = Number(request.headers.get("content-length") || 0);
  const type = request.headers.get("content-type") || "";
  if (!len || len > MAX_UPLOAD_BYTES) throw new HttpError(413, "INVALID_ARGUMENT", "الصورة كبيرة جدًا.");
  if (!type.toLowerCase().startsWith("multipart/form-data")) throw new HttpError(400, "INVALID_ARGUMENT", "صيغة الطلب غير صحيحة.");
  if (!env.IMGBB_API_KEY) throw new HttpError(500, "INTERNAL", "إعداد السيرفر غير مكتمل (IMGBB_API_KEY).");

  const res = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(env.IMGBB_API_KEY)}`, {
    method: "POST", headers: { "Content-Type": type }, body: request.body, duplex: "half"
  });
  const json = await res.json().catch(() => null);
  if (!json || !json.success) throw new HttpError(502, "UNAVAILABLE", "فشل رفع الصورة.");
  return { status: "success", url: json.data.display_url || json.data.url };
}

// ---------- CORS + التوجيه ----------
function corsHeaders(request, env) {
  const allowed = (env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()) : DEFAULT_ORIGINS);
  const origin = request.headers.get("Origin") || "";
  const h = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
  if (allowed.includes(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

const json = (body, status, cors) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    const path = new URL(request.url).pathname.replace(/^\/+|\/+$/g, "");

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method === "GET" && (path === "" || path === "health")) return json({ ok: true }, 200, cors);
    if (request.method !== "POST") return json({ error: { message: "Method not allowed", status: "INVALID_ARGUMENT" } }, 405, cors);

    try {
      if (!env.FIREBASE_PROJECT_ID) throw new HttpError(500, "INTERNAL", "إعداد السيرفر غير مكتمل (FIREBASE_PROJECT_ID).");

      const bearer = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      const claims = await verifyIdToken(bearer, env.FIREBASE_PROJECT_ID);
      const caller = claims.sub;

      if (path === "uploadImageViaImgbb") {
        return json({ result: await handleUpload(request, caller, env) }, 200, cors);
      }

      const handler = handlers[path];
      if (!handler) throw new HttpError(404, "NOT_FOUND", "هذه الخدمة غير متاحة على السيرفر الحالي.");

      const body = await request.json().catch(() => ({}));
      return json({ result: await handler(body.data, caller, env) }, 200, cors);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: { message: e.message, status: e.code } }, e.status, cors);
      console.error("unhandled", e && e.message);
      return json({ error: { message: "خطأ غير متوقع في السيرفر.", status: "INTERNAL" } }, 500, cors);
    }
  }
};
