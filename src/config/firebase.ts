import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import {
  assertFirebaseAppMatchesEnvironment,
  resolveFirebaseRuntimeConfig
} from '../../js/firebaseEnv.js';

declare global {
  interface Window {
    APP_CONFIG?: {
      FIREBASE_API_KEY?: string;
      FIREBASE_AUTH_DOMAIN?: string;
      FIREBASE_PROJECT_ID?: string;
      FIREBASE_STORAGE_BUCKET?: string;
      FIREBASE_MESSAGING_SENDER_ID?: string;
      FIREBASE_APP_ID?: string;
      FIREBASE_FUNCTIONS_REGION?: string;
      BACKEND_WORKER_URL?: string;
      IMGBB_API_KEY?: string;
      APP_ENV?: string;
    };
  }
}

export const PRODUCTION_FIREBASE_CONFIG = Object.freeze({
  apiKey: "AIzaSyBocUzghhDY2eY9Dg8B-UwlV-ye844_DtA",
  authDomain: "maintenance-defect-system.firebaseapp.com",
  projectId: "maintenance-defect-system",
  storageBucket: "maintenance-defect-system.firebasestorage.app",
  messagingSenderId: "1065779979535",
  appId: "1:1065779979535:web:6d53e69c4cfde57b414a7a"
});

const appConfig = (typeof window !== 'undefined' ? window.APP_CONFIG : {}) || {};
const viteEnv = import.meta.env;

// الاختيار بين dev والإنتاج في js/firebaseEnv.js: في dev لا يوجد رجوع لإعدادات الإنتاج
// (قيمة ناقصة أو تخص الإنتاج => خطأ قبل initializeApp).
const runtimeConfig = resolveFirebaseRuntimeConfig({
  appConfig: {
    ...appConfig,
    FIREBASE_API_KEY: appConfig.FIREBASE_API_KEY || viteEnv.VITE_FIREBASE_API_KEY,
    FIREBASE_AUTH_DOMAIN: appConfig.FIREBASE_AUTH_DOMAIN || viteEnv.VITE_FIREBASE_AUTH_DOMAIN,
    FIREBASE_PROJECT_ID: appConfig.FIREBASE_PROJECT_ID || viteEnv.VITE_FIREBASE_PROJECT_ID,
    FIREBASE_STORAGE_BUCKET: appConfig.FIREBASE_STORAGE_BUCKET || viteEnv.VITE_FIREBASE_STORAGE_BUCKET,
    FIREBASE_MESSAGING_SENDER_ID:
      appConfig.FIREBASE_MESSAGING_SENDER_ID || viteEnv.VITE_FIREBASE_MESSAGING_SENDER_ID,
    FIREBASE_APP_ID: appConfig.FIREBASE_APP_ID || viteEnv.VITE_FIREBASE_APP_ID,
    APP_ENV: appConfig.APP_ENV || viteEnv.VITE_APP_ENV
  },
  hostname: typeof window !== 'undefined' ? window.location?.hostname : ''
});

export const firebaseConfig = runtimeConfig.firebaseConfig;

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
assertFirebaseAppMatchesEnvironment(runtimeConfig.environment, app.options);

export const db = (() => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  } catch (error) {
    return getFirestore(app);
  }
})();

export const auth = getAuth(app);

export function phoneToAuthEmail(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  return `user_${digits}@defect-system.local`;
}
