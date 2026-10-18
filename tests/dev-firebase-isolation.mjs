// اختبارات العزل بين بيئة dev (dev-test-37e8a) وبيئة الإنتاج (maintenance-defect-system).
// التشغيل: node tests/dev-firebase-isolation.mjs
// لا تتصل بأي شبكة ولا بأي مشروع Firebase حقيقي؛ كل القيم أدناه وهمية للاختبار فقط.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

// ---------- بيئة متصفح مصغّرة (قبل أي import لـ js/config.js) ----------
const _s = new Map();
globalThis.window = globalThis;
globalThis.localStorage = {
  getItem: (k) => (_s.has(k) ? _s.get(k) : null),
  setItem: (k, v) => _s.set(k, String(v)),
  removeItem: (k) => _s.delete(k),
  clear: () => _s.clear(),
  key: (i) => [..._s.keys()][i],
  get length() { return _s.size; }
};
globalThis.sessionStorage = globalThis.localStorage;
const appended = [];
globalThis.document = {
  getElementById: () => null,
  addEventListener() {},
  documentElement: { lang: "ar", dir: "rtl" },
  createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, setAttribute() {} }),
  querySelector: () => null,
  body: { appendChild: (el) => appended.push(el) }
};
try { Object.defineProperty(globalThis, "navigator", { value: { onLine: true, userAgent: "node" }, configurable: true }); } catch (_) {}
globalThis.addEventListener = () => {};

const { PRODUCTION_FIREBASE_CONFIG, PRODUCTION_BACKEND_WORKER_URL } = await import("../js/firebaseDefaults.js");
const env = await import("../js/firebaseEnv.js");
const { validateDevDeploymentConfig } = await import("../scripts/validate-dev-deploy.mjs");
const { validateProductionDeploymentConfig } = await import("../scripts/validate-production-deploy.mjs");
const { buildDevAppConfig, renderDevConfigFile } = await import("../scripts/generate-dev-config.mjs");
const { readDevHostingTarget, assertSiteBelongsToProject, assertDevWorkerHealth } =
  await import("../scripts/verify-dev-targets.mjs");
const { buildDevDeployArgs } = await import("../scripts/deployDev.mjs");

const DEV = "dev-test-37e8a";
const PROD = "maintenance-defect-system";
const DEV_WORKER = "https://maintenance-backend-dev.mom379339.workers.dev";
const read = (p) => readFile(new URL(`../${p}`, import.meta.url), "utf8");

let passed = 0;
let failed = 0;
const test = async (name, fn) => {
  try {
    await fn();
    passed++;
    console.log("  ✅", name);
  } catch (error) {
    failed++;
    console.log("  ❌", name, "\n     ", error.message);
  }
};

// قيم وهمية (ليست قيم Firebase حقيقية) لمشروع dev
const fakeDevAppConfig = (overrides = {}) => ({
  APP_ENV: "dev",
  FIREBASE_API_KEY: "AIzaSy-FAKE-DEV-KEY-FOR-TESTS-0000000",
  FIREBASE_APP_ID: "1:222222222222:web:fakefakefakefake",
  FIREBASE_AUTH_DOMAIN: `${DEV}.firebaseapp.com`,
  FIREBASE_MESSAGING_SENDER_ID: "222222222222",
  FIREBASE_PROJECT_ID: DEV,
  FIREBASE_STORAGE_BUCKET: `${DEV}.firebasestorage.app`,
  BACKEND_WORKER_URL: DEV_WORKER,
  ...overrides
});
const DEV_HOST = `${DEV}.web.app`;
const PROD_HOST = `${PROD}.web.app`;
const throwsConfigError = (fn, pattern) =>
  assert.throws(fn, (e) => {
    assert.equal(e.name, "FirebaseConfigError");
    if (pattern) assert.match(e.message, pattern);
    return true;
  });

// =====================================================================
console.log("اختيار مشروع Firebase الصحيح (js/firebaseEnv.js)");
await test("مضيف dev + إعدادات dev كاملة => مشروع dev وWorker dev فقط", () => {
  const r = env.resolveFirebaseRuntimeConfig({ appConfig: fakeDevAppConfig(), hostname: DEV_HOST });
  assert.equal(r.environment, "dev");
  assert.equal(r.firebaseConfig.projectId, DEV);
  assert.equal(r.firebaseConfig.authDomain, `${DEV}.firebaseapp.com`);
  assert.equal(r.backendWorkerUrl, DEV_WORKER);
  for (const v of Object.values(r.firebaseConfig)) assert.ok(!v.includes(PROD));
});
await test("Worker dev يُقبل مع / في النهاية، ويكون الافتراضي عند غيابه (وليس الإنتاج)", () => {
  const a = env.resolveFirebaseRuntimeConfig({
    appConfig: fakeDevAppConfig({ BACKEND_WORKER_URL: `${DEV_WORKER}/` }), hostname: DEV_HOST
  });
  assert.equal(a.backendWorkerUrl, DEV_WORKER);
  const b = env.resolveFirebaseRuntimeConfig({
    appConfig: fakeDevAppConfig({ BACKEND_WORKER_URL: "" }), hostname: DEV_HOST
  });
  assert.equal(b.backendWorkerUrl, DEV_WORKER);
});

console.log("عدم الرجوع إلى الإنتاج عند فشل إعدادات dev");
await test("مضيف dev بدون أي إعدادات (فشل حقن api/config.js) => خطأ وليس إنتاج", () => {
  throwsConfigError(() => env.resolveFirebaseRuntimeConfig({ appConfig: {}, hostname: DEV_HOST }), /ناقصة/);
  throwsConfigError(() => env.resolveFirebaseRuntimeConfig({ appConfig: undefined, hostname: DEV_HOST }));
  throwsConfigError(() => env.resolveFirebaseRuntimeConfig({ appConfig: { APP_ENV: "dev" }, hostname: "" }));
});
await test("كل حقل ناقص منفرداً يوقف dev (لا قيمة افتراضية من الإنتاج)", () => {
  for (const key of [
    "FIREBASE_API_KEY", "FIREBASE_APP_ID", "FIREBASE_AUTH_DOMAIN",
    "FIREBASE_MESSAGING_SENDER_ID", "FIREBASE_PROJECT_ID", "FIREBASE_STORAGE_BUCKET"
  ]) {
    throwsConfigError(
      () => env.resolveFirebaseRuntimeConfig({ appConfig: fakeDevAppConfig({ [key]: "" }), hostname: DEV_HOST }),
      /ناقصة/
    );
  }
});
await test("إعدادات dev تشير لمشروع الإنتاج أو تخلط قيمه => خطأ", () => {
  const bad = (overrides, pattern) =>
    throwsConfigError(
      () => env.resolveFirebaseRuntimeConfig({ appConfig: fakeDevAppConfig(overrides), hostname: DEV_HOST }),
      pattern
    );
  bad({ FIREBASE_PROJECT_ID: PROD }, /dev-test-37e8a/);
  bad({ FIREBASE_AUTH_DOMAIN: PRODUCTION_FIREBASE_CONFIG.authDomain }, /authDomain/);
  bad({ FIREBASE_STORAGE_BUCKET: PRODUCTION_FIREBASE_CONFIG.storageBucket }, /storageBucket/);
  bad({ FIREBASE_API_KEY: PRODUCTION_FIREBASE_CONFIG.apiKey }, /الإنتاج/);
  bad({ FIREBASE_APP_ID: PRODUCTION_FIREBASE_CONFIG.appId }, /الإنتاج/);
  bad({ FIREBASE_MESSAGING_SENDER_ID: PRODUCTION_FIREBASE_CONFIG.messagingSenderId }, /الإنتاج/);
  bad({ FIREBASE_APP_ID: "1:999999999999:web:other" }, /appId/);
});
await test("Worker الإنتاج أو أي Worker غير worker التطوير مرفوض في dev", () => {
  for (const url of [PRODUCTION_BACKEND_WORKER_URL, `${PRODUCTION_BACKEND_WORKER_URL}/`, "https://other.workers.dev"]) {
    throwsConfigError(
      () => env.resolveFirebaseRuntimeConfig({
        appConfig: fakeDevAppConfig({ BACKEND_WORKER_URL: url }), hostname: DEV_HOST
      }),
      /Worker/
    );
  }
});
await test("localhost بدون إعدادات يعامل كـ dev ويفشل (لا إنتاج ضمني)", () => {
  for (const hostname of ["localhost", "127.0.0.1", "app.replit.dev"]) {
    throwsConfigError(() => env.resolveFirebaseRuntimeConfig({ appConfig: {}, hostname }), /ناقصة/);
  }
});
await test("تعارض APP_ENV مع المضيف يوقف التشغيل", () => {
  throwsConfigError(
    () => env.resolveFirebaseRuntimeConfig({ appConfig: { APP_ENV: "production" }, hostname: DEV_HOST }), /تعارض/
  );
  throwsConfigError(
    () => env.resolveFirebaseRuntimeConfig({ appConfig: fakeDevAppConfig(), hostname: PROD_HOST }), /تعارض/
  );
  throwsConfigError(() => env.resolveFirebaseRuntimeConfig({ appConfig: { APP_ENV: "staging" }, hostname: "" }));
});
await test("فحص التطبيق المهيّأ: dev لا يقبل تطبيقاً على الإنتاج والعكس", () => {
  assert.doesNotThrow(() => env.assertFirebaseAppMatchesEnvironment("dev", { projectId: DEV }));
  throwsConfigError(() => env.assertFirebaseAppMatchesEnvironment("dev", { projectId: PROD }));
  throwsConfigError(() => env.assertFirebaseAppMatchesEnvironment("dev", {}));
  throwsConfigError(() => env.assertFirebaseAppMatchesEnvironment("production", { projectId: DEV }));
  assert.doesNotThrow(() => env.assertFirebaseAppMatchesEnvironment("production", { projectId: PROD }));
});

console.log("إعدادات الإنتاج لم تتغير");
await test("مضيف الإنتاج بدون APP_ENV يستخدم نفس قيم الإنتاج الحالية حرفياً", () => {
  for (const hostname of [PROD_HOST, `${PROD}.firebaseapp.com`, "custom-domain.example", ""]) {
    const r = env.resolveFirebaseRuntimeConfig({ appConfig: {}, hostname });
    assert.equal(r.environment, "production");
    assert.deepEqual(r.firebaseConfig, { ...PRODUCTION_FIREBASE_CONFIG });
    assert.equal(r.backendWorkerUrl, PRODUCTION_BACKEND_WORKER_URL);
  }
});
await test("قيم الإنتاج الثابتة كما هي", () => {
  assert.equal(PRODUCTION_FIREBASE_CONFIG.projectId, PROD);
  assert.equal(PRODUCTION_FIREBASE_CONFIG.authDomain, `${PROD}.firebaseapp.com`);
  assert.equal(PRODUCTION_FIREBASE_CONFIG.storageBucket, `${PROD}.firebasestorage.app`);
  assert.equal(PRODUCTION_BACKEND_WORKER_URL, "https://odd-sun-fab8.mom379339.workers.dev");
});
await test("الإنتاج لا يقبل مشروع أو Worker التطوير", () => {
  throwsConfigError(() => env.resolveFirebaseRuntimeConfig({
    appConfig: { FIREBASE_PROJECT_ID: DEV }, hostname: PROD_HOST
  }));
  throwsConfigError(() => env.resolveFirebaseRuntimeConfig({
    appConfig: { BACKEND_WORKER_URL: DEV_WORKER }, hostname: PROD_HOST
  }));
});
await test("ملف api/config.js المحفوظ لم يتغير (فارغ، بلا قيم dev)", async () => {
  const cfg = await read("api/config.js");
  assert.match(cfg, /window\.APP_CONFIG = window\.APP_CONFIG \|\| \{\};/);
  assert.ok(!cfg.includes(DEV));
});

// =====================================================================
console.log("js/config.js: لا initializeApp عند فشل dev، والمشروع الصحيح عند النجاح");
const configSource = await read("js/config.js");
await test("config.js لا يحتوي fallback لإعدادات الإنتاج ويمر عبر firebaseEnv", () => {
  assert.match(configSource, /resolveFirebaseRuntimeConfig/);
  assert.match(configSource, /assertFirebaseAppMatchesEnvironment/);
  assert.ok(!/PRODUCTION_FIREBASE_CONFIG|PRODUCTION_BACKEND_WORKER_URL/.test(configSource));
  assert.ok(!/\|\|\s*PRODUCTION_/.test(configSource));
});

const firebaseSdk = await import("../js/firebase.js");
await test("مضيف dev بدون إعدادات: استيراد config.js يفشل ولا يُنشأ أي تطبيق Firebase", async () => {
  globalThis.APP_CONFIG = {};
  globalThis.location = { hostname: DEV_HOST };
  await assert.rejects(import("../js/config.js?case=dev-empty"), (e) => e.name === "FirebaseConfigError");
  assert.equal(firebaseSdk.getApps().length, 0, "تم إنشاء تطبيق Firebase رغم فشل إعدادات dev");
  assert.match(String(globalThis.__FIREBASE_CONFIG_ERROR__), /ناقصة/);
  assert.ok(appended.length >= 1, "لم تظهر رسالة إيقاف واضحة للمستخدم");
});
await test("مضيف dev + إعدادات إنتاج محقونة: يفشل ولا يُنشأ تطبيق", async () => {
  globalThis.APP_CONFIG = {
    APP_ENV: "dev",
    FIREBASE_API_KEY: PRODUCTION_FIREBASE_CONFIG.apiKey,
    FIREBASE_APP_ID: PRODUCTION_FIREBASE_CONFIG.appId,
    FIREBASE_AUTH_DOMAIN: PRODUCTION_FIREBASE_CONFIG.authDomain,
    FIREBASE_MESSAGING_SENDER_ID: PRODUCTION_FIREBASE_CONFIG.messagingSenderId,
    FIREBASE_PROJECT_ID: PRODUCTION_FIREBASE_CONFIG.projectId,
    FIREBASE_STORAGE_BUCKET: PRODUCTION_FIREBASE_CONFIG.storageBucket
  };
  await assert.rejects(import("../js/config.js?case=dev-with-prod"), (e) => e.name === "FirebaseConfigError");
  assert.equal(firebaseSdk.getApps().length, 0);
});
await test("مضيف dev + إعدادات dev كاملة: التطبيق (والتسجيل) على dev-test-37e8a وWorker dev", async () => {
  globalThis.APP_CONFIG = fakeDevAppConfig();
  globalThis.location = { hostname: DEV_HOST };
  const cfg = await import("../js/config.js?case=dev-ok");
  assert.equal(cfg.APP_ENVIRONMENT, "dev");
  assert.equal(cfg.app.options.projectId, DEV);
  assert.equal(cfg.FIREBASE_PROJECT_ID, DEV);
  assert.equal(cfg.BACKEND_WORKER_URL, DEV_WORKER);
  assert.deepEqual(firebaseSdk.getApps().map((a) => a.options.projectId), [DEV]);
  assert.equal(cfg.getRegistrationAuthContext().auth.app.options.projectId, DEV);
  assert.ok(firebaseSdk.getApps().every((a) => a.options.projectId === DEV));
});
await test("بعد تهيئة dev: مضيف الإنتاج لا يعيد استخدام تطبيق dev (فحص التطابق)", async () => {
  globalThis.APP_CONFIG = {};
  globalThis.location = { hostname: PROD_HOST };
  await assert.rejects(import("../js/config.js?case=prod-after-dev"), (e) => e.name === "FirebaseConfigError");
});

// =====================================================================
console.log("توليد إعدادات dev (api/config.js) للنشر");
const fakeDevDeployEnv = (overrides = {}) => ({
  FIREBASE_DEV_PROJECT_ID: DEV,
  FIREBASE_DEV_API_KEY: "AIzaSy-FAKE-DEV-KEY-FOR-TESTS-0000000",
  FIREBASE_DEV_APP_ID: "1:222222222222:web:fakefakefakefake",
  FIREBASE_DEV_MESSAGING_SENDER_ID: "222222222222",
  ...overrides
});
await test("يولّد إعدادات صالحة لـ dev ويقبلها فحص وقت التشغيل", () => {
  const appConfig = buildDevAppConfig(fakeDevDeployEnv());
  assert.equal(appConfig.APP_ENV, "dev");
  assert.equal(appConfig.FIREBASE_PROJECT_ID, DEV);
  assert.equal(appConfig.FIREBASE_AUTH_DOMAIN, `${DEV}.firebaseapp.com`);
  assert.equal(appConfig.BACKEND_WORKER_URL, DEV_WORKER);

  const sandbox = { window: {} };
  vm.runInNewContext(renderDevConfigFile(appConfig), sandbox);
  assert.equal(Object.isFrozen(sandbox.window.APP_CONFIG), true);
  const r = env.resolveFirebaseRuntimeConfig({ appConfig: sandbox.window.APP_CONFIG, hostname: DEV_HOST });
  assert.equal(r.firebaseConfig.projectId, DEV);
});
await test("يرفض نقص المتغيرات أو مشروعاً غير dev أو قيم الإنتاج", () => {
  for (const key of ["FIREBASE_DEV_API_KEY", "FIREBASE_DEV_APP_ID", "FIREBASE_DEV_MESSAGING_SENDER_ID"]) {
    assert.throws(() => buildDevAppConfig(fakeDevDeployEnv({ [key]: "" })), /Missing dev Firebase web config/);
  }
  assert.throws(() => buildDevAppConfig(fakeDevDeployEnv({ FIREBASE_DEV_PROJECT_ID: "" })), /must be dev-test-37e8a/);
  assert.throws(() => buildDevAppConfig(fakeDevDeployEnv({ FIREBASE_DEV_PROJECT_ID: PROD })), /must be dev-test-37e8a/);
  assert.throws(() => buildDevAppConfig(fakeDevDeployEnv({ FIREBASE_DEV_API_KEY: PRODUCTION_FIREBASE_CONFIG.apiKey })));
  assert.throws(() => buildDevAppConfig(fakeDevDeployEnv({ FIREBASE_DEV_BACKEND_WORKER_URL: PRODUCTION_BACKEND_WORKER_URL })));
  assert.throws(() => buildDevAppConfig(fakeDevDeployEnv({ FIREBASE_DEV_STORAGE_BUCKET: PRODUCTION_FIREBASE_CONFIG.storageBucket })));
});

// =====================================================================
console.log("بيانات اعتماد dev: FIREBASE_DEV_PROJECT_ID + FIREBASE_DEV_SERVICE_ACCOUNT");
const credential = (project_id = DEV, private_key = "never-print-this", extra = {}) =>
  JSON.stringify({
    type: "service_account",
    project_id,
    client_email: `deployer@${project_id}.iam.gserviceaccount.com`,
    private_key,
    ...extra
  });
const validateDev = (sa, projectId = DEV) =>
  validateDevDeploymentConfig({ FIREBASE_DEV_PROJECT_ID: projectId, FIREBASE_DEV_SERVICE_ACCOUNT: sa });

await test("حساب خدمة dev مطابق للمشروع يُقبل بكل الصيغ (JSON/اقتباس/base64/\\n)", () => {
  assert.equal(validateDev(credential()).projectId, DEV);
  assert.doesNotThrow(() => validateDev(` \n ${credential()} \n `));
  assert.doesNotThrow(() => validateDev(`'${credential()}'`));
  assert.doesNotThrow(() => validateDev(`"${credential()}"`));
  const b64 = validateDev(Buffer.from(credential()).toString("base64"));
  assert.equal(JSON.parse(b64.serviceAccountJson).project_id, DEV);
  const esc = validateDev(credential(DEV, "line one\\nline two"));
  assert.equal(JSON.parse(esc.serviceAccountJson).private_key, "line one\nline two");
});
await test("معرّف المشروع: فارغ/إنتاج/أي مشروع آخر => مرفوض", () => {
  assert.throws(() => validateDev(credential(), ""), /FIREBASE_DEV_PROJECT_ID is empty/);
  assert.throws(() => validateDev(credential(), PROD), /must not be the production project/);
  assert.throws(() => validateDev(credential(), "another-project"), /must be dev-test-37e8a/);
  assert.throws(() => validateDevDeploymentConfig({ FIREBASE_DEV_SERVICE_ACCOUNT: credential() }), /FIREBASE_DEV_PROJECT_ID is empty/);
});
await test("حساب خدمة الإنتاج أو مشروع آخر أو بريد من نطاق آخر => مرفوض", () => {
  assert.throws(() => validateDev(credential(PROD)), /production project and is blocked/);
  assert.throws(() => validateDev(credential("another-firebase-project")), /must belong to the dev project/);
  assert.throws(
    () => validateDev(credential(DEV, "k", { client_email: `x@${PROD}.iam.gserviceaccount.com` })),
    /must belong to the dev project/
  );
  assert.throws(() => validateDev(credential(DEV, "k", { type: "authorized_user" })), /must belong to the dev project/);
});
await test("سر فارغ/غير صالح/ناقص: رفض بدون تسريب القيمة", () => {
  assert.throws(() => validateDev(""), /FIREBASE_DEV_SERVICE_ACCOUNT is empty/);
  assert.throws(() => validateDev(" \n "), /FIREBASE_DEV_SERVICE_ACCOUNT is empty/);
  const invalidSecret = "not-json-secret";
  assert.throws(() => validateDev(invalidSecret), (e) => {
    assert.match(e.message, /not valid JSON or base64-encoded JSON/);
    assert.doesNotMatch(e.message, new RegExp(invalidSecret));
    return true;
  });
  for (const field of ["type", "project_id", "client_email", "private_key"]) {
    const incomplete = JSON.parse(credential());
    delete incomplete[field];
    assert.throws(() => validateDev(JSON.stringify(incomplete)), new RegExp(`missing required field\\(s\\): ${field}`));
  }
  assert.throws(() => validateDev(credential(DEV, "SECRET-PRIVATE-KEY-VALUE", { type: "x" })), (e) => {
    assert.doesNotMatch(e.message, /SECRET-PRIVATE-KEY-VALUE/);
    return true;
  });
});
await test("فحص حساب الإنتاج لم يتغير: يقبل الإنتاج ويرفض حساب dev", () => {
  assert.doesNotThrow(() => validateProductionDeploymentConfig({ FIREBASE_SERVICE_ACCOUNT: credential(PROD) }));
  assert.throws(
    () => validateProductionDeploymentConfig({ FIREBASE_SERVICE_ACCOUNT: credential(DEV) }),
    /must belong to the production project/
  );
});

// =====================================================================
console.log("أهداف النشر: Hosting target + Worker + .firebaserc");
const firebaserc = JSON.parse(await read(".firebaserc"));
await test(".firebaserc: target dev داخل مشروع dev فقط، والإنتاج كما هو بدون target dev", () => {
  assert.equal(firebaserc.projects.default, PROD);
  assert.equal(firebaserc.projects.dev, DEV);
  assert.deepEqual(firebaserc.targets[DEV].hosting, { dev: [DEV] });
  assert.deepEqual(firebaserc.targets[PROD].hosting, { main: [PROD] });
  assert.ok(!JSON.stringify(firebaserc.targets[PROD]).includes("my-dev-2026"));
  assert.deepEqual(readDevHostingTarget(firebaserc), { projectId: DEV, siteId: DEV });
});
await test("readDevHostingTarget يرفض ربط dev بمشروع/موقع الإنتاج", () => {
  const clone = () => JSON.parse(JSON.stringify(firebaserc));
  const a = clone(); a.projects.dev = PROD;
  assert.throws(() => readDevHostingTarget(a), /projects\.dev/);
  const b = clone(); b.targets[DEV].hosting.dev = [PROD];
  assert.throws(() => readDevHostingTarget(b), /production-project site/);
  const c = clone(); c.targets[PROD].hosting.dev = ["my-dev-2026"];
  assert.throws(() => readDevHostingTarget(c), /production project must not define/);
  const d = clone(); d.targets[DEV].hosting.dev = [];
  assert.throws(() => readDevHostingTarget(d), /exactly one site/);
  const e = clone(); e.targets[DEV].hosting.dev = ["a", "b"];
  assert.throws(() => readDevHostingTarget(e), /exactly one site/);
});
await test("assertSiteBelongsToProject: الموقع يجب أن يكون ضمن قائمة مواقع مشروع dev", () => {
  const listed = (name) => ({ status: "success", result: { sites: [{ name, defaultUrl: "x" }] } });
  assert.doesNotThrow(() => assertSiteBelongsToProject(listed(`projects/${DEV}/sites/${DEV}`), DEV));
  assert.doesNotThrow(() => assertSiteBelongsToProject(listed(`projects/123456789/sites/${DEV}`), DEV));
  assert.throws(() => assertSiteBelongsToProject(listed(`projects/${DEV}/sites/other-site`), DEV), /not found/);
  assert.throws(() => assertSiteBelongsToProject(listed(`projects/${PROD}/sites/${DEV}`), DEV), /not found/);
  assert.throws(() => assertSiteBelongsToProject({ result: { sites: [] } }, DEV), /not found/);
  assert.throws(() => assertSiteBelongsToProject({ status: "error" }, DEV), /Unexpected output/);
});
await test("assertDevWorkerHealth: development + مشروع dev + نفس موقع Hosting فقط", () => {
  const ok = { ok: true, environment: "development", projectId: DEV, hostingSite: DEV };
  assert.doesNotThrow(() => assertDevWorkerHealth(ok, DEV));
  assert.throws(() => assertDevWorkerHealth({ ...ok, environment: "production" }, DEV), /environment/);
  assert.throws(() => assertDevWorkerHealth({ ...ok, projectId: PROD }, DEV), /bound to/);
  assert.throws(() => assertDevWorkerHealth({ ...ok, hostingSite: "my-dev-2026" }, DEV), /differs/);
  assert.throws(() => assertDevWorkerHealth({ ...ok, ok: false }, DEV), /not ok/);
  assert.throws(() => assertDevWorkerHealth(null, DEV), /not ok/);
});
await test("buildDevDeployArgs: --project صريح لمشروع dev فقط ولا يقبل الإنتاج", () => {
  assert.deepEqual(buildDevDeployArgs(), ["deploy", "--only", "hosting:dev", "--project", DEV]);
  assert.throws(() => buildDevDeployArgs(PROD), /Refusing/);
  assert.throws(() => buildDevDeployArgs("another-project"), /Refusing/);
});
await test("deployDev.mjs لا يستخدم إعدادات الإنتاج لتحديد المشروع الهدف", async () => {
  const src = await read("scripts/deployDev.mjs");
  assert.ok(!/PRODUCTION_FIREBASE_CONFIG\.projectId\s*\]/.test(src), "المشروع الهدف لا يجوز أن يكون الإنتاج");
  assert.match(src, /hosting:dev/);
  assert.ok(!/hosting:main/.test(src));
});

// =====================================================================
console.log("GitHub Actions");
const devWorkflow = await read(".github/workflows/firebase-hosting-dev.yml");
const mainWorkflow = await read(".github/workflows/firebase-hosting-main.yml");
await test("Workflow dev: بيانات dev فقط، تحقق قبل النشر، target dev على مشروع dev", () => {
  assert.match(devWorkflow, /branches:\s*\n\s+- dev\b/);
  assert.match(devWorkflow, /FIREBASE_DEV_PROJECT_ID:\s*\$\{\{\s*secrets\.FIREBASE_DEV_PROJECT_ID \|\| vars\.FIREBASE_DEV_PROJECT_ID\s*\}\}/);
  assert.match(devWorkflow, /FIREBASE_DEV_SERVICE_ACCOUNT:\s*\$\{\{\s*secrets\.FIREBASE_DEV_SERVICE_ACCOUNT\s*\}\}/);
  assert.match(devWorkflow, /firebaseServiceAccount:\s*\$\{\{\s*env\.FIREBASE_DEV_SERVICE_ACCOUNT_NORMALIZED\s*\}\}/);
  assert.match(devWorkflow, /projectId:\s*\$\{\{\s*env\.FIREBASE_DEV_PROJECT_ID_VALIDATED\s*\}\}/);
  assert.match(devWorkflow, /target:\s*dev\b/);
  assert.doesNotMatch(devWorkflow, /target:\s*main\b/);
  assert.doesNotMatch(devWorkflow, /maintenance-defect-system/);
  assert.doesNotMatch(devWorkflow, /my-dev-2026/);
  assert.doesNotMatch(devWorkflow, /secrets\.FIREBASE_SERVICE_ACCOUNT\b/);
  assert.doesNotMatch(devWorkflow, /validate-production-deploy/);
  assert.match(devWorkflow, /permissions:\s*\n\s+contents: read/);
  assert.doesNotMatch(devWorkflow, /^\s{4}environment:/m);
});
await test("Workflow dev: ترتيب الخطوات (تحقق الاعتماد -> Worker -> config -> build -> الموقع -> نشر)", () => {
  const order = [
    "node scripts/validate-dev-deploy.mjs",
    "node scripts/verify-dev-targets.mjs worker",
    "node scripts/generate-dev-config.mjs",
    "npm run build",
    "node scripts/verify-dev-targets.mjs site",
    "FirebaseExtended/action-hosting-deploy"
  ].map((needle) => {
    const i = devWorkflow.indexOf(needle);
    assert.ok(i > 0, `missing step: ${needle}`);
    return i;
  });
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.ok(devWorkflow.indexOf("npm test") < order[0]);
});
await test("Workflow الإنتاج لم يتغير: مشروع الإنتاج وtarget main وسر الإنتاج فقط", () => {
  const projectInputs = [...mainWorkflow.matchAll(/^\s*projectId:\s*(.+)$/gm)].map(([, v]) => v.trim());
  assert.deepEqual(projectInputs, [PROD]);
  assert.match(mainWorkflow, /branches:\s*\n\s+- main\b/);
  assert.match(mainWorkflow, /target:\s*main\b/);
  assert.match(mainWorkflow, /Validate production deploy credential project/);
  assert.match(mainWorkflow, /node scripts\/validate-production-deploy\.mjs/);
  assert.match(mainWorkflow, /FIREBASE_SERVICE_ACCOUNT:\s*\$\{\{\s*secrets\.FIREBASE_SERVICE_ACCOUNT\s*\}\}/);
  assert.match(mainWorkflow, /firebaseServiceAccount:\s*\$\{\{\s*env\.FIREBASE_SERVICE_ACCOUNT_NORMALIZED\s*\}\}/);
  assert.match(mainWorkflow, /permissions:\s*\n\s+contents: read/);
  assert.doesNotMatch(mainWorkflow, /FIREBASE_DEV_|dev-test-37e8a|target:\s*dev\b/);
  assert.doesNotMatch(mainWorkflow, /^\s{4}environment:/m);
});
await test("firebase.json: الهدفان dev وmain موجودان، وكلاهما يخدم الجذر مع rewrite لـ index.html", async () => {
  const fb = JSON.parse(await read("firebase.json"));
  const targets = fb.hosting.map((h) => h.target);
  assert.deepEqual(targets.sort(), ["dev", "main"]);
  for (const h of fb.hosting) {
    assert.equal(h.public, ".");
    assert.deepEqual(h.rewrites, [{ source: "**", destination: "/index.html" }]);
    assert.ok(!h.ignore.includes("api/**") && !h.ignore.includes("api/config.js"), "api/config.js يجب أن يُنشر");
  }
  assert.ok(!JSON.stringify(fb).includes(DEV), "firebase.json لا يربط معرّف مشروع داخل الملف");
});
await test("package.json: نشر القواعد على dev بمشروع صريح، وأوامر الإنتاج بلا تغيير", async () => {
  const pkg = JSON.parse(await read("package.json"));
  assert.equal(pkg.scripts["deploy:dev"], "node scripts/deployDev.mjs");
  assert.equal(
    pkg.scripts["deploy:dev:rules"],
    `firebase deploy --only firestore:rules,firestore:indexes --project ${DEV}`
  );
  assert.equal(pkg.scripts.deploy, "firebase deploy --only hosting");
  assert.equal(pkg.scripts["deploy:rules"], "firebase deploy --only firestore:rules");
  assert.equal(pkg.scripts["test:rules"].includes("demo-defect-rules"), true);
});

// =====================================================================
console.log("الخوادم المحلية وواجهة React: لا fallback للإنتاج");
await test("server.js وvite.config.ts: بلا قيم إنتاج افتراضية وبـ APP_ENV=dev افتراضياً", async () => {
  for (const file of ["server.js", "vite.config.ts"]) {
    const src = await read(file);
    assert.match(src, /APP_ENV:\s*process\.env\.APP_ENV \|\| 'dev'/);
    assert.ok(!src.includes(PROD), `${file} يحتوي إشارة للإنتاج`);
    assert.ok(!src.includes("odd-sun-fab8"), `${file} يحتوي Worker الإنتاج`);
    assert.ok(!src.includes(PRODUCTION_FIREBASE_CONFIG.apiKey), `${file} يحتوي مفتاح الإنتاج`);
  }
});
await test("src/config/firebase.ts يمر عبر firebaseEnv ولا يستخدم PRODUCTION_FIREBASE_CONFIG كـ fallback", async () => {
  const src = await read("src/config/firebase.ts");
  assert.match(src, /resolveFirebaseRuntimeConfig/);
  assert.match(src, /assertFirebaseAppMatchesEnvironment/);
  assert.ok(!/\|\|\s*PRODUCTION_FIREBASE_CONFIG/.test(src));
});

console.log(`\nنتيجة اختبارات العزل: ${passed} نجح / ${failed} فشل`);
process.exit(failed ? 1 : 0);
