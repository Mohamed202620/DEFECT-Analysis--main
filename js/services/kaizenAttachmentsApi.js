import { auth, BACKEND_WORKER_URL } from "../config.js";

const WORKER_URL = BACKEND_WORKER_URL.replace(/\/+$/, "");

async function requestJson(action, data) {
  if (!auth.currentUser) throw new Error("يجب تسجيل الدخول أولاً.");
  const token = await auth.currentUser.getIdToken();
  const response = await fetch(`${WORKER_URL}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.error) {
    throw new Error(payload?.error?.message || "تعذّر تنفيذ عملية المرفق.");
  }
  return payload.result;
}

export async function listKaizenAttachments(suggestionId) {
  const result = await requestJson("listKaizenAttachments", { suggestionId });
  return Array.isArray(result?.attachments) ? result.attachments : [];
}

export async function uploadKaizenAttachment(suggestionId, file) {
  if (!auth.currentUser) throw new Error("يجب تسجيل الدخول أولاً.");
  const token = await auth.currentUser.getIdToken();
  const form = new FormData();
  form.append("suggestionId", suggestionId);
  form.append("file", file, file.name);
  const response = await fetch(`${WORKER_URL}/uploadKaizenAttachment`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.error) {
    throw new Error(payload?.error?.message || "فشل رفع الملف.");
  }
  return payload.result;
}

export async function downloadKaizenAttachment(suggestionId, attachmentId) {
  if (!auth.currentUser) throw new Error("يجب تسجيل الدخول أولاً.");
  const token = await auth.currentUser.getIdToken();
  const response = await fetch(`${WORKER_URL}/downloadKaizenAttachment`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: { suggestionId, attachmentId } })
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error?.message || "تعذّر تنزيل الملف.");
  }
  return response.blob();
}

export async function deleteKaizenAttachment(suggestionId, attachmentId) {
  return requestJson("deleteKaizenAttachment", { suggestionId, attachmentId });
}
