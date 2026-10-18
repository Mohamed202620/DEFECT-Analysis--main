import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

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

export const firebaseConfig = {
  apiKey: appConfig.FIREBASE_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY || PRODUCTION_FIREBASE_CONFIG.apiKey,
  authDomain: appConfig.FIREBASE_AUTH_DOMAIN || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || PRODUCTION_FIREBASE_CONFIG.authDomain,
  projectId: appConfig.FIREBASE_PROJECT_ID || import.meta.env.VITE_FIREBASE_PROJECT_ID || PRODUCTION_FIREBASE_CONFIG.projectId,
  storageBucket: appConfig.FIREBASE_STORAGE_BUCKET || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || PRODUCTION_FIREBASE_CONFIG.storageBucket,
  messagingSenderId: appConfig.FIREBASE_MESSAGING_SENDER_ID || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || PRODUCTION_FIREBASE_CONFIG.messagingSenderId,
  appId: appConfig.FIREBASE_APP_ID || import.meta.env.VITE_FIREBASE_APP_ID || PRODUCTION_FIREBASE_CONFIG.appId
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

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
