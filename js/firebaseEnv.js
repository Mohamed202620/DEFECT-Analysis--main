// ============================================================
// firebaseEnv.js - اختيار بيئة Firebase (dev / production) بدون أي fallback خطِر
// ============================================================
// وحدة نقية (بدون DOM وبدون Firebase SDK) تُستخدم من:
//   - js/config.js           (وقت تشغيل المتصفح)
//   - src/config/firebase.ts (واجهة React/Vite المحلية)
//   - scripts/*.mjs          (التحقق قبل النشر وتوليد api/config.js)
//   - tests/dev-firebase-isolation.mjs
//
// القاعدة: بيئة dev لا تقع أبداً على إعدادات الإنتاج. لو إعدادات dev ناقصة أو
// تشير لمشروع/Worker الإنتاج => نرمي FirebaseConfigError ويتوقف التطبيق قبل
// أي initializeApp. سلوك الإنتاج (المضيف الإنتاجي بدون APP_ENV) لم يتغير.
// ============================================================

import {
  DEFAULT_FIREBASE_FUNCTIONS_REGION,
  PRODUCTION_BACKEND_WORKER_URL,
  PRODUCTION_FIREBASE_CONFIG
} from "./firebaseDefaults.js";

export const DEV_FIREBASE_PROJECT_ID = "dev-test-37e8a";
export const DEV_BACKEND_WORKER_URL =
  "https://maintenance-backend-dev.mom379339.workers.dev";

export const APP_ENV_DEV = "dev";
export const APP_ENV_PRODUCTION = "production";

// مضيفات Hosting المعروفة. أي مضيف dev => بيئة dev إجبارياً حتى لو فشل حقن الإعدادات.
export const DEV_HOSTING_HOSTNAMES = Object.freeze([
  `${DEV_FIREBASE_PROJECT_ID}.web.app`,
  `${DEV_FIREBASE_PROJECT_ID}.firebaseapp.com`
]);
export const PRODUCTION_HOSTING_HOSTNAMES = Object.freeze([
  `${PRODUCTION_FIREBASE_CONFIG.projectId}.web.app`,
  `${PRODUCTION_FIREBASE_CONFIG.projectId}.firebaseapp.com`
]);

export class FirebaseConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "FirebaseConfigError";
    this.code = "FIREBASE_CONFIG_INVALID";
  }
}

const clean = (value) => (typeof value === "string" ? value.trim() : "");
const stripTrailingSlashes = (value) => clean(value).replace(/\/+$/, "");

function isLocalHostname(host) {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]" ||
    host.endsWith(".localhost") ||
    host.endsWith(".replit.dev") ||
    host.endsWith(".repl.co")
  );
}

function normalizeDeclaredEnvironment(value) {
  const v = clean(value).toLowerCase();
  if (!v) return "";
  if (v === "dev" || v === "development") return APP_ENV_DEV;
  if (v === "prod" || v === "production") return APP_ENV_PRODUCTION;
  throw new FirebaseConfigError(`APP_ENV غير معروف: "${v}" (المسموح: dev أو production).`);
}

/**
 * تحدد البيئة من APP_ENV المحقونة ومن اسم المضيف. أي إشارة dev تكفي لاعتبارها dev،
 * وأي تعارض بين الإشارتين يوقف التشغيل بدل التخمين.
 */
export function detectFirebaseEnvironment({ appConfig = {}, hostname = "" } = {}) {
  const declared = normalizeDeclaredEnvironment(appConfig?.APP_ENV);
  const host = clean(hostname).toLowerCase();
  const onDevHosting = DEV_HOSTING_HOSTNAMES.includes(host);
  const onProductionHosting = PRODUCTION_HOSTING_HOSTNAMES.includes(host);
  const onLocalHost = isLocalHostname(host);

  if (declared === APP_ENV_PRODUCTION && onDevHosting) {
    throw new FirebaseConfigError("تعارض: APP_ENV=production على مضيف Hosting الخاص بـ dev.");
  }
  if (declared === APP_ENV_DEV && onProductionHosting) {
    throw new FirebaseConfigError("تعارض: APP_ENV=dev على مضيف Hosting الخاص بالإنتاج.");
  }
  if (declared) return declared;
  if (onDevHosting || onLocalHost) return APP_ENV_DEV;
  return APP_ENV_PRODUCTION;
}

function resolveDevConfig(appConfig) {
  const firebaseConfig = {
    apiKey: clean(appConfig.FIREBASE_API_KEY),
    authDomain: clean(appConfig.FIREBASE_AUTH_DOMAIN),
    projectId: clean(appConfig.FIREBASE_PROJECT_ID),
    storageBucket: clean(appConfig.FIREBASE_STORAGE_BUCKET),
    messagingSenderId: clean(appConfig.FIREBASE_MESSAGING_SENDER_ID),
    appId: clean(appConfig.FIREBASE_APP_ID)
  };

  const missing = Object.entries(firebaseConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length) {
    throw new FirebaseConfigError(
      `إعدادات Firebase الخاصة بـ dev ناقصة (${missing.join(", ")}). لا يوجد رجوع لإعدادات الإنتاج.`
    );
  }

  if (firebaseConfig.projectId !== DEV_FIREBASE_PROJECT_ID) {
    throw new FirebaseConfigError(
      `projectId في بيئة dev يجب أن يكون ${DEV_FIREBASE_PROJECT_ID}.`
    );
  }
  if (
    firebaseConfig.authDomain !== `${DEV_FIREBASE_PROJECT_ID}.firebaseapp.com` &&
    firebaseConfig.authDomain !== `${DEV_FIREBASE_PROJECT_ID}.web.app`
  ) {
    throw new FirebaseConfigError("authDomain في بيئة dev لا يخص مشروع dev.");
  }
  const bucketPattern = new RegExp(
    `^${DEV_FIREBASE_PROJECT_ID.replace(/[-]/g, "\\-")}\\.(appspot\\.com|firebasestorage\\.app)$`
  );
  if (!bucketPattern.test(firebaseConfig.storageBucket)) {
    throw new FirebaseConfigError("storageBucket في بيئة dev لا يخص مشروع dev.");
  }
  if (
    firebaseConfig.apiKey === PRODUCTION_FIREBASE_CONFIG.apiKey ||
    firebaseConfig.appId === PRODUCTION_FIREBASE_CONFIG.appId ||
    firebaseConfig.messagingSenderId === PRODUCTION_FIREBASE_CONFIG.messagingSenderId
  ) {
    throw new FirebaseConfigError("إعدادات dev تحتوي قيماً تخص تطبيق الإنتاج (apiKey/appId/senderId).");
  }
  if (!firebaseConfig.appId.startsWith(`1:${firebaseConfig.messagingSenderId}:`)) {
    throw new FirebaseConfigError("appId لا يطابق messagingSenderId (إعدادات dev غير متسقة).");
  }

  const requestedWorker = stripTrailingSlashes(appConfig.BACKEND_WORKER_URL);
  const backendWorkerUrl = requestedWorker || DEV_BACKEND_WORKER_URL;
  if (backendWorkerUrl !== DEV_BACKEND_WORKER_URL) {
    throw new FirebaseConfigError("BACKEND_WORKER_URL في بيئة dev يجب أن يكون Worker التطوير فقط.");
  }

  for (const value of [...Object.values(firebaseConfig), backendWorkerUrl]) {
    if (value.includes(PRODUCTION_FIREBASE_CONFIG.projectId)) {
      throw new FirebaseConfigError("إعدادات dev تحتوي إشارة لمشروع الإنتاج.");
    }
  }
  if (backendWorkerUrl === stripTrailingSlashes(PRODUCTION_BACKEND_WORKER_URL)) {
    throw new FirebaseConfigError("Worker الإنتاج غير مسموح في بيئة dev.");
  }

  return {
    environment: APP_ENV_DEV,
    firebaseConfig,
    backendWorkerUrl,
    functionsRegion: clean(appConfig.FIREBASE_FUNCTIONS_REGION) || DEFAULT_FIREBASE_FUNCTIONS_REGION
  };
}

function resolveProductionConfig(appConfig) {
  // نفس سلوك الإنتاج السابق حرفياً (قيمة محقونة أو القيمة الافتراضية للإنتاج).
  const firebaseConfig = {
    apiKey: appConfig.FIREBASE_API_KEY || PRODUCTION_FIREBASE_CONFIG.apiKey,
    authDomain: appConfig.FIREBASE_AUTH_DOMAIN || PRODUCTION_FIREBASE_CONFIG.authDomain,
    projectId: appConfig.FIREBASE_PROJECT_ID || PRODUCTION_FIREBASE_CONFIG.projectId,
    storageBucket: appConfig.FIREBASE_STORAGE_BUCKET || PRODUCTION_FIREBASE_CONFIG.storageBucket,
    messagingSenderId:
      appConfig.FIREBASE_MESSAGING_SENDER_ID || PRODUCTION_FIREBASE_CONFIG.messagingSenderId,
    appId: appConfig.FIREBASE_APP_ID || PRODUCTION_FIREBASE_CONFIG.appId
  };
  const backendWorkerUrl = appConfig.BACKEND_WORKER_URL || PRODUCTION_BACKEND_WORKER_URL;

  // حماية عكسية: كود/مضيف الإنتاج لا يجوز أن يكتب في مشروع dev.
  if (
    firebaseConfig.projectId === DEV_FIREBASE_PROJECT_ID ||
    stripTrailingSlashes(backendWorkerUrl) === DEV_BACKEND_WORKER_URL
  ) {
    throw new FirebaseConfigError("بيئة الإنتاج لا يجوز أن تشير إلى مشروع أو Worker التطوير.");
  }

  return {
    environment: APP_ENV_PRODUCTION,
    firebaseConfig,
    backendWorkerUrl,
    functionsRegion: appConfig.FIREBASE_FUNCTIONS_REGION || DEFAULT_FIREBASE_FUNCTIONS_REGION
  };
}

/**
 * المدخل الوحيد لإعدادات Firebase/Worker. يرمي FirebaseConfigError عند أي فشل في dev.
 */
export function resolveFirebaseRuntimeConfig({ appConfig = {}, hostname = "" } = {}) {
  const config = appConfig && typeof appConfig === "object" ? appConfig : {};
  const environment = detectFirebaseEnvironment({ appConfig: config, hostname });
  return environment === APP_ENV_DEV ? resolveDevConfig(config) : resolveProductionConfig(config);
}

/**
 * فحص بعد initializeApp (أو getApp): التطبيق المهيّأ فعلاً يطابق البيئة.
 * يمنع استخدام تطبيق Firebase مُهيّأ مسبقاً من مكان آخر بإعدادات مختلفة.
 */
export function assertFirebaseAppMatchesEnvironment(environment, options) {
  const projectId = clean(options?.projectId);
  if (environment === APP_ENV_DEV && projectId !== DEV_FIREBASE_PROJECT_ID) {
    throw new FirebaseConfigError(
      `تطبيق Firebase المهيّأ (${projectId || "?"}) لا يطابق مشروع dev ${DEV_FIREBASE_PROJECT_ID}.`
    );
  }
  if (environment === APP_ENV_PRODUCTION && projectId === DEV_FIREBASE_PROJECT_ID) {
    throw new FirebaseConfigError("تطبيق الإنتاج مُهيّأ على مشروع dev.");
  }
  return options;
}
