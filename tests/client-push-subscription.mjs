import assert from "node:assert/strict";

const storage = new Map([
  ["userId", "former-user"],
  ["pushReg_former-user", "https://fcm.googleapis.com/fcm/send/subscription|1"]
]);
globalThis.window = globalThis;
globalThis.window.APP_CONFIG = {};
globalThis.window.location = { hostname: "test.invalid" };
globalThis.window.PushManager = function PushManager() {};
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
  clear: () => storage.clear(),
  key: index => [...storage.keys()][index],
  get length() { return storage.size; }
};
globalThis.sessionStorage = globalThis.localStorage;
globalThis.document = {
  cookie: "",
  getElementById: () => null,
  addEventListener() {},
  documentElement: { lang: "ar", dir: "rtl" },
  createElement: () => ({ style: {}, classList: { add() {}, remove() {} } }),
  querySelector: () => null,
  body: { appendChild() {} }
};
let unsubscribeCalls = 0;
const subscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/subscription",
  async unsubscribe() { unsubscribeCalls++; return true; }
};
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: {
    onLine: false,
    userAgent: "node",
    serviceWorker: {
      async getRegistration() {
        return { pushManager: { async getSubscription() { return subscription; } } };
      }
    }
  }
});
globalThis.Notification = { permission: "granted" };
globalThis.addEventListener = () => {};

const { unregisterPushSubscription } = await import("../js/pushSubscription.js");
await unregisterPushSubscription();

assert.equal(unsubscribeCalls, 1, "the browser subscription must be removed locally during offline logout");
assert.equal(storage.has("pushReg_former-user"), false, "the cached registration must be removed");
console.log("  ✅ offline logout unsubscribes the local PushSubscription");
