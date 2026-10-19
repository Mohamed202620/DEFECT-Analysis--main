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
    } else {
      const cfg = await callCloudFunction("getPushConfig", {});
      if (!cfg || !cfg.publicKey) return false;
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToU8(cfg.publicKey) });
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
