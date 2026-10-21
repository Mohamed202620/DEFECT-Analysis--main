// Web Push subscription management (free plan: sending is done by the Cloudflare Worker).
// Everything here is best-effort and must never break the app.
import { callCloudFunction } from "./providers/backend/index.js";
import { ensureAuthReady } from "./config.js";

const REG_KEY_PREFIX = "pushReg_";
const REG_TTL_MS = 24 * 3600 * 1000;

function b64uToU8(str) {
  const clean = String(str).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(clean.padEnd(Math.ceil(clean.length / 4) * 4, "="));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function sameKey(buf, u8) {
  const a = buf ? new Uint8Array(buf) : new Uint8Array(0);
  if (a.length !== u8.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== u8[i]) return false;
  return true;
}

export function isPushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && typeof Notification !== "undefined";
}

export async function ensurePushSubscription() {
  try {
    if (!isPushSupported() || Notification.permission !== "granted") return false;
    const uid = localStorage.getItem("userId");
    if (!uid || navigator.onLine === false) return false;
    const user = await ensureAuthReady();
    if (!user) return false;
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    const regKey = REG_KEY_PREFIX + uid;
    if (sub) {
      const [endpoint, ts] = String(localStorage.getItem(regKey) || "").split("|");
      if (endpoint === sub.endpoint && Date.now() - Number(ts || 0) < REG_TTL_MS) return true;
    }
    const cfg = await callCloudFunction("getPushConfig", {});
    if (!cfg || !cfg.publicKey) return false;
    const serverKey = b64uToU8(cfg.publicKey);
    // A subscription made with another VAPID key (rotated key, dev<->prod Worker) is rejected
    // by the push service with 403 forever: drop it and subscribe again with the current key.
    if (sub && !sameKey(sub.options && sub.options.applicationServerKey, serverKey)) {
      await sub.unsubscribe().catch(() => {});
      sub = null;
    }
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: serverKey });
    }
    await callCloudFunction("registerPushSubscription", { subscription: sub.toJSON() });
    localStorage.setItem(regKey, `${sub.endpoint}|${Date.now()}`);
    return true;
  } catch (error) {
    console.warn("Push subscription skipped:", error && error.message);
    return false;
  }
}

// Called on logout so a shared phone stops receiving the previous user's alerts.
export async function unregisterPushSubscription() {
  try {
    if (!isPushSupported()) return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && (await reg.pushManager.getSubscription());
    if (!sub) return;
    await Promise.race([
      callCloudFunction("unregisterPushSubscription", { endpoint: sub.endpoint }),
      new Promise((resolve) => setTimeout(resolve, 2000))
    ]);
    const uid = localStorage.getItem("userId");
    if (uid) localStorage.removeItem(REG_KEY_PREFIX + uid);
  } catch (error) {
    console.warn("Push unsubscribe skipped:", error && error.message);
  }
}
