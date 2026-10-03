// ============================================================
// ticketsApi.js
// بلاغات الأعطال (Tickets/Issues) - حفظ / جلب / دورة حياة التذكرة
// الحالات: pending(جديد) -> assigned(تم الإسناد) -> in_progress(قيد التنفيذ)
//          -> resolved(بانتظار تأكيد المُبلغ) -> closed(مغلق) [نهائية]
//                                     resolved -> in_progress (رفض مع سبب)
// ============================================================

import { ensureAuthReady } from "../config.js";
import { uploadBase64Images } from "./imageUpload.js";
import { getCurrentRole, isAdminRole, hasFullDataAccess } from "../permissions.js";
// إصلاح (تنظيف/Refactor): قائمة "الحالات المغلقة" بقت مستوردة من ملف
// ثوابت مشترك (ticketStatusConstants.js) بدل تعريفها محلياً هنا (كانت
// نفس القيم مكررة يدوياً في أكتر من ملف - workflow.js / statistics.js)
import { CLOSED_STATUSES, isClosedStatus, isOverdueTicket } from "../ticketStatusConstants.js";
import { normalizeLine } from "../utils/lineUtils.js";

// إضافة (تحسين الأداء - نطاق افتراضي للوحة التذاكر): حد أقصى لعدد
// التذاكر اللي بتترجع لتبويب "الكل"/"أعطال اليوم"/"بلاغات متأخرة" عند
// الأدمن/المدير (اللي بيرجّعوا كل تذكرة اتسجلت على الإطلاق بدون فلتر
// حالة). مع نمو البيانات مع الوقت (آلاف التذاكر) ده كان بيبطّئ اللوحة
// ويزوّد قراءات Firestore بلا داعي. باقي التبويبات (قيد الانتظار/قيد
// التنفيذ/مغلق...) بتفضل من غير حد لأن حجمها الطبيعي محدود أصلاً
// (تذاكر مفتوحة حالياً، مش الأرشيف كله)
const TICKETS_BOARD_DEFAULT_LIMIT = 300;
import { queueOfflineTicket, getQueuedTickets, removeQueuedTicket, queueOfflineAction, getQueuedActions, removeQueuedAction } from "./offlineQueue.js";
// إصلاح (بند مرتفع الأولوية - إشعار عند بلاغ جديد): استيراد مباشر من
// usersApi.js (مش من services/api.js) عشان نتجنب Circular Import، بما
// إن api.js نفسه بيعمل Re-export من ticketsApi.js
import { fetchManagersAndAdminsApi } from "./usersApi.js";

import {
  db,
  collection,
  addDoc,
  setDoc,
  serverTimestamp,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  getCountFromServer
} from "../providers/backend/index.js";

// ============================================================
// ISSUES / TICKETS (بلاغات الأعطال)
// ============================================================

export async function saveIssueApi(payload, { skipOfflineQueue = false } = {}) {
  if (!skipOfflineQueue && typeof navigator !== "undefined" && !navigator.onLine) {
    try {
      const localId = await queueOfflineTicket(payload);
      return {
        status: "queued",
        localId,
        message: "لا يوجد اتصال بالإنترنت - تم حفظ البلاغ محلياً وسيتم رفعه تلقائياً عند عودة الاتصال"
      };
    } catch (error) {
      console.error("Error queuing offline ticket:", error);
      return { status: "error", message: "تعذر حفظ البلاغ محلياً" };
    }
  }

  try {
    // دعم صورة واحدة (الاسم القديم "image" - للتوافق مع أي بيانات
    // قديمة مُخزَّنة محلياً في طابور offlineQueue من قبل هذا التحديث)
    // أو أكثر من صورة دفعة واحدة عبر "images" (الاسم الجديد)
    const { image, images, ...restPayload } = payload;
    const issueId = payload.issueId || ("IS-" + Date.now());
    // إصلاح (منع تكرار السجلات - مزامنة Offline): لو addDoc نجح فعلاً على
    // السيرفر لكن الرد ضاع (انقطاع شبكة لحظة الرد) العنصر بيفضل في
    // الطابور ويتعاد رفعه = بلاغ مكرر بنفس issueId. في مسار المزامنة
    // فقط (skipOfflineQueue) بنتأكد الأول إن مفيش بلاغ بنفس issueId
    // ونفس المُبلّغ، ولو موجود نعتبر الرفع ناجح ونشيله من الطابور.
    if (skipOfflineQueue && payload.issueId) {
      try {
        const dupSnap = await getDocs(
          query(collection(db, "tickets"), where("issueId", "==", payload.issueId), limit(5))
        );
        let existingId = null;
        dupSnap.forEach(docSnap => {
          if (existingId) return;
          const d = docSnap.data();
          if (!payload.reportedByUid || d.reportedByUid === payload.reportedByUid) {
            existingId = docSnap.id;
          }
        });
        if (existingId) {
          return { status: "success", id: existingId, duplicate: true };
        }
      } catch (dupError) {
        console.warn("[saveIssueApi] duplicate check skipped:", dupError);
      }
    }

    const imageList = Array.isArray(images) ? images : (image ? [image] : []);
    const imageUrls = await uploadBase64Images(imageList, issueId);

    // Test 16: لو المستخدم أرفق صور وكلها فشل رفعها (شبكة/ImgBB) كان البلاغ
    // بيتحفظ بدون أي صورة والصور بتضيع للأبد (وفي المزامنة بعد Offline
    // كان البلاغ بيتشال من الطابور بعد "نجاح" ناقص). نفس سلوك
    // resolveTicketApi: نرجّع خطأ (يحتوي imgbb عشان المزامنة تبقيه في
    // الطابور) والمستخدم يفضل معاه الفورم ويحاول تاني
    if (imageList.length > 0 && imageUrls.length === 0) {
      return {
        status: "error",
        message: "تعذر رفع صور البلاغ (imgbb/network) - تحقق من الاتصال بالإنترنت وحاول مرة أخرى"
      };
    }

    // ============================================================
    // منع تكرار البلاغ عند Offline/Retry (بند H7): معرّف مستند التذكرة
    // بقى حتمي (deterministic) من المُبلّغ + issueId (الثابت طول عمر
    // النموذج - راجع workflow.js)، بدل addDoc بمعرّف عشوائي جديد كل مرة.
    // يعني: الإرسال المعلّق + إعادة المحاولة + مزامنة الطابور كلهم بيكتبوا
    // لنفس المستند، ومستحيل ينتج بلاغين لنفس النموذج.
    // ============================================================
    const reporterUid = restPayload.reportedByUid || "";
    const ticketDocId = reporterUid
      ? `t_${reporterUid}_${issueId}`.replace(/[\/\s]/g, "_")
      : null;

    const isSelfResolvedCreate = restPayload.status === "resolved";

    const ticketData = {
      ...restPayload,
      issueId,
      ...(imageUrls.length && { imageUrls }),
      status: payload?.status || "pending",
      createdAt: payload?.createdAt || new Date().toISOString(),
      // زمن السيرفر (مصدر الحقيقة لأوقات الحساب الحساسة مثل MTTR)
      createdAtServer: serverTimestamp(),
      ...(isSelfResolvedCreate && { resolvedAtServer: serverTimestamp() })
    };

    // ربط البلاغ المكرر بالأصلي (مزامنة Offline): لو فيه بلاغ مفتوح لنفس
    // الخط والماكينة اتسجّل أثناء ما كان الجهاز أوفلاين، بنسجّل الرابط
    // بدل ما نخسر البلاغ الجديد أو نكرره بصمت.
    if (skipOfflineQueue && restPayload.machine && restPayload.line && !isSelfResolvedCreate) {
      try {
        const activeRes = await fetchActiveTicketForMachineApi(restPayload.machine, restPayload.line);
        if (activeRes?.status === "success" && activeRes.ticket && activeRes.ticket.issueId !== issueId) {
          ticketData.duplicateOfTicketId = activeRes.ticket.id || "";
          ticketData.duplicateOfIssueId = activeRes.ticket.issueId || "";
        }
      } catch (_) { /* مساعد فقط - مايمنعش الحفظ */ }
    }

    let docRef;
    if (ticketDocId) {
      docRef = doc(db, "tickets", ticketDocId);
      try {
        // لو المستند موجود بالفعل (إعادة محاولة بعد نجاح ضاع ردّه) نعتبرها نجاح
        const existing = await getDoc(docRef);
        if (existing.exists() && existing.data().reportedByUid === reporterUid) {
          return { status: "success", id: ticketDocId, duplicate: true };
        }
      } catch (_) { /* القراءة مساعدة فقط (قد تفشل أوفلاين) */ }

      try {
        await setDoc(docRef, ticketData);
      } catch (writeError) {
        // الكتابة التانية لنفس المعرّف بتتحسب update وقاعدة الأمان بترفضها:
        // لو المستند فعلاً موجود لنفس المُبلّغ يبقى الرفع الأول نجح
        try {
          const again = await getDoc(docRef);
          if (again.exists() && again.data().reportedByUid === reporterUid) {
            return { status: "success", id: ticketDocId, duplicate: true };
          }
        } catch (_) { /* نكمل ونرمي الخطأ الأصلي */ }
        throw writeError;
      }
    } else {
      docRef = await addDoc(collection(db, "tickets"), ticketData);
    }

    // إصلاح (بند مرتفع الأولوية - إشعار عند بلاغ جديد): قبل هذا
    // التحديث ما كانش فيه أي إشعار بيتبعت عند إنشاء بلاغ جديد (pending)-
    // المدير/الأدمن كان لازم يفتح لوحة البلاغات يدوياً عشان يعرف إن
    // فيه عطل جديد، وده بيتعارض مع هدف "استجابة سريعة" في بيئة مصنع.
    // هنا بنبعت إشعار لكل مدير/أدمن نشط فور نجاح إنشاء التذكرة. أي
    // فشل في الإرسال (مثلاً مشكلة شبكة مؤقتة) ما ينفعش يفشّل عملية
    // تسجيل البلاغ نفسها، فبنكتفي بتسجيله في الـ Console فقط
    notifyManagersOfNewTicket(docRef.id, restPayload).catch(error => {
      console.error("Error notifying managers of new ticket:", error);
    });

    return { status: "success", id: docRef.id };
  } catch (error) {
    console.error("Error saving issue/ticket:", error);
    return { status: "error", message: error.message };
  }
}

// Test 16: حماية من التشغيل المتزامن - حدث "online" ممكن يتكرر (شبكة
// بتقطع وترجع بسرعة) أو يتزامن مع فحص بداية التشغيل، فكانت مزامنتين
// بيقروا نفس الطابور ويعملوا addDoc مرتين = بلاغات/إجراءات مكررة.
// دلوقتي أي استدعاء أثناء مزامنة شغّالة بيستنى نفس النتيجة بدل ما يبدأ واحدة تانية
let _syncOfflineTicketsApiInFlight = null;
export function syncOfflineTicketsApi() {
  if (!_syncOfflineTicketsApiInFlight) {
    _syncOfflineTicketsApiInFlight = _syncOfflineTicketsApiImpl().finally(() => { _syncOfflineTicketsApiInFlight = null; });
  }
  return _syncOfflineTicketsApiInFlight;
}

// إصلاح (فقدان بيانات - مزامنة Offline): كانت الحلقتين تحت بتحذفا أي
// عنصر من الطابور لو رسالة الخطأ مفيهاش (fetch/network/offline/imgbb) -
// يعني أي خطأ مؤقت من Firestore نفسه (unavailable / deadline-exceeded /
// resource-exhausted ...) كان بيتحسب "خطأ دائم" ويتحذف بلاغ/ملاحظات
// إصلاح/صور من الجهاز للأبد قبل ما يوصلوا للسيرفر. دلوقتي القاعدة
// معكوسة: العنصر بيتحذف فقط لو الخطأ دائم بشكل صريح (صلاحيات/غير
// موجود/تحقق مدخلات)، وأي خطأ غير معروف بيفضل في الطابور للمحاولة القادمة.
function isPermanentSyncError(message) {
  const msg = String(message || "").toLowerCase();
  const PERMANENT_MARKERS = [
    "permission", "insufficient", "not-found", "not found", "no document",
    "already-exists", "invalid-argument", "invalid",
    "غير موجود", "مطلوب", "مطلوبة", "مطلوبين", "لازم", "متاح", "غير صالح"
  ];
  return PERMANENT_MARKERS.some(marker => msg.includes(marker));
}

// عدّاد محاولات الأخطاء "الدائمة" (بند M10): خطأ permission/invalid وقت
// المزامنة قد يكون مؤقتاً (دور المستخدم لسه بيتحمّل، جلسة بتتجدد...) فمنحذفش
// العنصر (وفيه ملاحظات وصور) من أول مرة - بنحاول لحد MAX_PERMANENT_ATTEMPTS
// مزامنات متفرقة، وبعدها بس بيتسجّل كفشل نهائي ويتشال.
const SYNC_ATTEMPTS_KEY = "offlineSyncAttempts";
const MAX_PERMANENT_ATTEMPTS = 5;

function bumpSyncAttempt(localId) {
  try {
    const map = JSON.parse(localStorage.getItem(SYNC_ATTEMPTS_KEY) || "{}");
    map[localId] = (map[localId] || 0) + 1;
    localStorage.setItem(SYNC_ATTEMPTS_KEY, JSON.stringify(map));
    return map[localId];
  } catch (_) {
    return MAX_PERMANENT_ATTEMPTS;
  }
}

function clearSyncAttempt(localId) {
  try {
    const map = JSON.parse(localStorage.getItem(SYNC_ATTEMPTS_KEY) || "{}");
    if (localId in map) {
      delete map[localId];
      localStorage.setItem(SYNC_ATTEMPTS_KEY, JSON.stringify(map));
    }
  } catch (_) { /* لا شيء */ }
}

// إجراء "بدء/إغلاق/إصلاح" اتنفّذ فعلاً قبل كده (مثلاً الإرسال الأول نجح وضاع
// الرد): ده نجاح مش فشل - كان بيتسجّل "فشل" ويتبلّغ المستخدم غلط
async function isOfflineActionAlreadyApplied(type, ticketId, authUid) {
  try {
    if (!ticketId) return false;
    const snap = await getDoc(doc(db, "tickets", ticketId));
    if (!snap.exists()) return false;
    const t = snap.data();
    const st = String(t.status || "").trim().toLowerCase();
    if (type === "start") return ["in_progress", "resolved", "closed"].includes(st);
    if (type === "close") return st === "closed";
    if (type === "resolve") return ["resolved", "closed"].includes(st) && t.resolvedByUid === authUid;
    return false;
  } catch (_) {
    return false;
  }
}

async function _syncOfflineTicketsApiImpl() {
  const queued = await getQueuedTickets();
  if (!queued.length) {
    return { status: "success", synced: 0, total: 0 };
  }

  // إصلاح (فقدان بيانات - مزامنة Offline): المزامنة بتتشغّل من حدث
  // "online" / فحص بداية التشغيل، ممكن قبل ما جلسة Firebase Auth تتسترجع.
  // وقتها addDoc بيفشل بـ permission-denied (قاعدة create بتطلب
  // reportedByUid == auth.uid) وده كان بيتصنّف "خطأ دائم" فيتحذف البلاغ من
  // الجهاز. بننتظر جاهزية الجلسة، ولو مفيش مستخدم مسجّل دخول بنسيب
  // الطابور زي ما هو للمحاولة القادمة.
  const authUser = await ensureAuthReady();
  if (!authUser) {
    return { status: "success", synced: 0, total: queued.length, skipped: true };
  }

  let synced = 0;
  for (const item of queued) {
    try {
      // بلاغ محفوظ من مستخدم تاني على نفس الجهاز - مينفعش يترفع باسم
      // المستخدم الحالي (القاعدة هترفضه)، فبنسيبه في الطابور لحد ما
      // صاحبه يدخل بدل ما يتحذف كخطأ دائم
      if (item.payload?.reportedByUid && item.payload.reportedByUid !== authUser.uid) {
        continue;
      }
      const result = await saveIssueApi(item.payload, { skipOfflineQueue: true });
      if (result.status === "success") {
        await removeQueuedTicket(item.localId);
        clearSyncAttempt(item.localId);
        synced++;
      } else {
        const msg = (result.message || "").toLowerCase();
        if (isPermanentSyncError(msg)) {
          const attempts = bumpSyncAttempt(item.localId);
          if (attempts >= MAX_PERMANENT_ATTEMPTS) {
            console.warn(`[Sync] Permanent error for offline ticket ${item.localId} after ${attempts} attempts, removing from queue:`, msg);
            await removeQueuedTicket(item.localId);
            clearSyncAttempt(item.localId);
          } else {
            console.warn(`[Sync] Possibly-permanent error for offline ticket ${item.localId} (attempt ${attempts}/${MAX_PERMANENT_ATTEMPTS}), keeping in queue:`, msg);
          }
        } else {
          console.warn(`[Sync] Transient/unknown error for offline ticket ${item.localId}, keeping in queue:`, msg);
        }
      }
    } catch (error) {
      console.error("Error syncing offline ticket:", item.localId, error);
    }
  }
  return { status: "success", synced, total: queued.length };
}

// إضافة (تحسين Workflow - دعم Offline لتحديث الحالة): مزامنة إجراءات
// دورة حياة التذكرة (بدء تنفيذ/تم الإصلاح/تأكيد الإغلاق) المخزّنة
// محلياً وقت انقطاع الإنترنت - بنفس نمط syncOfflineTicketsApi فوق
// بالظبط، بترتيب زمني (الأقدم أولاً) عشان دورة حياة كل تذكرة تتنفذ
// بنفس التسلسل اللي حصل بيه فعلياً.
// Test 16: حماية من التشغيل المتزامن - حدث "online" ممكن يتكرر (شبكة
// بتقطع وترجع بسرعة) أو يتزامن مع فحص بداية التشغيل، فكانت مزامنتين
// بيقروا نفس الطابور ويعملوا addDoc مرتين = بلاغات/إجراءات مكررة.
// دلوقتي أي استدعاء أثناء مزامنة شغّالة بيستنى نفس النتيجة بدل ما يبدأ واحدة تانية
let _syncOfflineTicketActionsApiInFlight = null;
export function syncOfflineTicketActionsApi() {
  if (!_syncOfflineTicketActionsApiInFlight) {
    _syncOfflineTicketActionsApiInFlight = _syncOfflineTicketActionsApiImpl().finally(() => { _syncOfflineTicketActionsApiInFlight = null; });
  }
  return _syncOfflineTicketActionsApiInFlight;
}

async function _syncOfflineTicketActionsApiImpl() {
  const queued = await getQueuedActions();
  if (!queued.length) {
    return { status: "success", synced: 0, total: 0 };
  }

  // نفس حماية _syncOfflineTicketsApiImpl: من غير جلسة Auth جاهزة أي
  // إجراء (إصلاح/إغلاق/مقترح...) كان بيفشل بـ permission-denied ويتحذف
  const authUser = await ensureAuthReady();
  if (!authUser) {
    return { status: "success", synced: 0, failed: 0, total: queued.length, skipped: true };
  }

  let synced = 0;
  let failed = 0;
  for (const item of queued) {
    try {
      const { type, ticketId, payload } = item.action || {};
      let result;

      if (type === "start") {
        result = await startTicketApi(ticketId, { skipOfflineQueue: true });
      } else if (type === "resolve") {
        result = await resolveTicketApi(
          ticketId,
          payload?.mechanicNotes,
          payload?.afterImages,
          {
            skipOfflineQueue: true,
            allowNoImages: !!payload?.allowNoImages,
            selfResolved: !!payload?.selfResolved
          }
        );
      } else if (type === "close") {
        result = await closeTicketApi(ticketId, { skipOfflineQueue: true });
      } else if (type === "reassign") {
        result = await reassignTicketApi(
          ticketId,
          { assignedTo: payload?.assignedTo, assignedToUid: payload?.assignedToUid },
          { skipOfflineQueue: true }
        );
      } else if (type === "new_suggestion") {
        const { saveSuggestionApi } = await import("./suggestionsApi.js");
        result = await saveSuggestionApi(payload, { skipOfflineQueue: true });
      } else if (type === "new_defect") {
        const { saveDefectApi } = await import("./defectsApi.js");
        result = await saveDefectApi(payload, { skipOfflineQueue: true });
      } else if (type === "new_machine_error") {
        const { saveMachineErrorApi } = await import("./machineErrorsApi.js");
        result = await saveMachineErrorApi(payload, { skipOfflineQueue: true });
      } else if (type === "log_machine_error") {
        const { logMachineErrorOccurrenceApi } = await import("./machineErrorsApi.js");
        result = await logMachineErrorOccurrenceApi(payload, { skipOfflineQueue: true });
      } else {
        console.error("Unknown queued action type:", type);
        await removeQueuedAction(item.localId);
        continue;
      }

      if (result.status !== "success" && await isOfflineActionAlreadyApplied(type, ticketId, authUser.uid)) {
        result = { status: "success" };
      }

      if (result.status === "success") {
        await removeQueuedAction(item.localId);
        clearSyncAttempt(item.localId);
        synced++;
      } else {
        const msg = (result.message || "").toLowerCase();
        if (isPermanentSyncError(msg) && bumpSyncAttempt(item.localId) < MAX_PERMANENT_ATTEMPTS) {
          console.warn(`[Sync] Possibly-permanent error for offline action ${item.localId}, keeping in queue for retry:`, msg);
        } else if (isPermanentSyncError(msg)) {
          clearSyncAttempt(item.localId);
          console.warn(`[Sync] Permanent error for offline action ${item.localId}, removing from queue:`, msg);
          // إصلاح (Workflow - إجراء أوفلاين فشل بصمت): قبل كده الإجراء كان بيتمسح
          // من الطابور مع console.warn بس (مثلاً permission-denied لأن التذكرة اتسحبت
          // من الفني أو حالتها اتغيرت) فتضيع ملاحظات الإصلاح من غير ما المستخدم يعرف.
          // دلوقتي بنحتفظ بنسخة توثيقية (بدون الصور) ونبلّغ المستخدم بعد المزامنة.
          recordFailedOfflineAction(item, msg);
          failed++;
          await removeQueuedAction(item.localId);
        } else {
          console.warn(`[Sync] Transient/unknown error for offline action ${item.localId}, keeping in queue:`, msg);
        }
      }
    } catch (error) {
      console.error("Error syncing offline ticket action:", item.localId, error);
    }
  }
  return { status: "success", synced, failed, total: queued.length };
}

// حفظ نسخة توثيقية (metadata + الملاحظات النصية بدون صور Base64 لتفادي تجاوز
// حصة localStorage) للإجراءات الأوفلاين اللي فشلت نهائياً وقت المزامنة
const FAILED_OFFLINE_ACTIONS_KEY = "failedOfflineActions";
function recordFailedOfflineAction(item, reason) {
  try {
    const { type, ticketId, payload } = item.action || {};
    const list = JSON.parse(localStorage.getItem(FAILED_OFFLINE_ACTIONS_KEY) || "[]");
    list.push({
      type,
      ticketId,
      reason: String(reason || "").slice(0, 300),
      notes: payload?.mechanicNotes || payload?.assignedTo || "",
      at: new Date().toISOString()
    });
    localStorage.setItem(FAILED_OFFLINE_ACTIONS_KEY, JSON.stringify(list.slice(-50)));
  } catch (_) { /* توثيق فقط - مايوقفش المزامنة */ }
}

// TICKETS
// ============================================================

// إصلاح M1: كانت الدالة بتجيب كل التذاكر دايماً بدون أي فلترة صلاحيات
// (مصدر بيانات كارتات لوحة المتابعة في الرئيسية عبر loadDashboardStats)
// هوية "بلاغاتي / المُسندة إليّ" بالـ UID (بند M1): اسمين متطابقين كانوا
// بيشوفوا بلاغات بعض. التذاكر القديمة بدون UID بتفضل بالاسم احتياطياً.
function ticketBelongsToMe(ticket, myUid, myName) {
  const reportedMine = ticket.reportedByUid
    ? ticket.reportedByUid === myUid
    : (!!myName && ticket.reportedBy === myName);
  const assignedMine = ticket.assignedToUid
    ? ticket.assignedToUid === myUid
    : (!!myName && ticket.assignedTo === myName);
  return reportedMine || assignedMine;
}

// بقت تاخد { role, myUid, myName } وتطبّق نفس منطق الصلاحيات المستخدم
// في subscribeToTicketsBoardApi / fetchTicketsForReportApi بالظبط:
// admin/manager = كل التذاكر، وباقي الأدوار (فني/مشغل/مهندس) = بلاغاتي
// (reportedBy) + المُسندة إليّ (assignedTo) فقط. تم إبقاء الاستدعاء
// بدون آرجيومنتس شغال (role/myUid/myName هيبقوا undefined) عشان أي
// استخدام قديم للدالة ميتكسرش، لكنه هيرجع النتيجة الفارغة/المقيّدة
// المناسبة لغير الأدمن/المدير بدل كل التذاكر.
export async function fetchTicketsApi({ role, myUid, myName, maxCount } = {}) {
  try {
    await ensureAuthReady();
    const ticketsRef = collection(db, "tickets");
    const isFullAccess = hasFullDataAccess(role);
    
    const clauses = [orderBy("createdAt", "desc")];
    if (maxCount) clauses.push(limit(maxCount));

    if (isFullAccess || !myName) {
      const q = query(ticketsRef, ...clauses);
      const querySnapshot = await getDocs(q);
      const tickets = [];
      querySnapshot.forEach(docSnap => {
        tickets.push({ id: docSnap.id, ...docSnap.data() });
      });
      return { status: "success", data: tickets };
    } else {
      const uidQueries = myUid
        ? [
            getDocs(query(ticketsRef, where("reportedByUid", "==", myUid), ...clauses)),
            getDocs(query(ticketsRef, where("assignedToUid", "==", myUid), ...clauses))
          ]
        : [];
      const snaps = await Promise.all([
        getDocs(query(ticketsRef, where("reportedBy", "==", myName), ...clauses)),
        getDocs(query(ticketsRef, where("assignedTo", "==", myName), ...clauses)),
        ...uidQueries
      ]);

      const merged = new Map();
      snaps.forEach(snap => snap.forEach(docSnap => merged.set(docSnap.id, { id: docSnap.id, ...docSnap.data() })));
      let tickets = Array.from(merged.values()).filter(t => ticketBelongsToMe(t, myUid, myName));
      tickets.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
      if (maxCount && tickets.length > maxCount) {
        tickets = tickets.slice(0, maxCount);
      }
      return { status: "success", data: tickets };
    }
  } catch (error) {
    console.error("Error fetching tickets with orderBy:", error);
    const fallback = emptyResultOnMissingIndex(error, "fetchTicketsApi");
    if (fallback) return fallback;
    return { status: "error", message: error.message };
  }
}

// ============================================================
// لقطة لوحة المتابعة (بند H4): الأرقام الدقيقة بدل الاشتقاق من عينة
// أحدث 300/500 بلاغ.
//  - total / closed / today = عدّادات تجميعية من السيرفر (getCountFromServer)
//  - open / overdue = من مجموعة "البلاغات غير المغلقة" الكاملة (عددها صغير
//    دايماً مقارنة بالأرشيف) + المنتظرة للتأكيد، فمفيش بلاغ قديم متأخر بيتفوّت
//  - tickets = غير المغلقة + آخر 30 يوم (للـ MTTR وأعلى ماكينة وغيرها)
// للأدوار غير كاملة الصلاحية (فني/مشغل) البلاغات الشخصية قليلة، فبنرجع
// للجلب العادي بحد كبير (2000) بدل 300/500.
// ============================================================
const DASHBOARD_RECENT_DAYS = 30;
const DASHBOARD_MAX_DOCS = 5000;

export async function fetchDashboardSnapshotApi({ role, myUid, myName } = {}) {
  try {
    await ensureAuthReady();

    if (!hasFullDataAccess(role) && myName) {
      const res = await fetchTicketsApi({ role, myUid, myName, maxCount: 2000 });
      if (res.status !== "success") return res;
      const list = res.data;
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      return {
        status: "success",
        data: {
          tickets: list,
          total: list.length,
          closed: list.filter(t => isClosedStatus(t.status)).length,
          open: list.filter(t => !isClosedStatus(t.status)).length,
          today: list.filter(t => {
            const d = new Date(t.createdAt);
            return !isNaN(d) && d >= startOfToday;
          }).length,
          overdue: list.filter(t => isOverdueTicket(t)).length,
          exact: true
        }
      };
    }

    const ticketsRef = collection(db, "tickets");
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const recentFrom = new Date(Date.now() - DASHBOARD_RECENT_DAYS * 24 * 60 * 60 * 1000);

    const [totalSnap, closedSnap, todaySnap, notClosedSnap, recentSnap] = await Promise.all([
      getCountFromServer(ticketsRef),
      getCountFromServer(query(ticketsRef, where("status", "in", CLOSED_STATUSES))),
      getCountFromServer(query(ticketsRef, where("createdAt", ">=", startOfToday.toISOString()))),
      // غير مغلقة نهائياً: تشمل resolved (بانتظار التأكيد) لحساب التأخر
      getDocs(query(ticketsRef, where("status", "not-in", ["closed", "done", "مغلق"]), limit(DASHBOARD_MAX_DOCS))),
      getDocs(query(ticketsRef, where("createdAt", ">=", recentFrom.toISOString()), orderBy("createdAt", "desc"), limit(DASHBOARD_MAX_DOCS)))
    ]);

    const merged = new Map();
    notClosedSnap.forEach(d => merged.set(d.id, { id: d.id, ...d.data() }));
    recentSnap.forEach(d => { if (!merged.has(d.id)) merged.set(d.id, { id: d.id, ...d.data() }); });
    const tickets = Array.from(merged.values());
    tickets.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    const notClosed = Array.from(
      new Map(
        [...tickets].filter(t => !["closed", "done", "مغلق"].includes(String(t.status || "").trim().toLowerCase())).map(t => [t.id, t])
      ).values()
    );

    return {
      status: "success",
      data: {
        tickets,
        total: totalSnap.data().count,
        closed: closedSnap.data().count,
        today: todaySnap.data().count,
        open: notClosed.filter(t => !isClosedStatus(t.status)).length,
        overdue: notClosed.filter(t => isOverdueTicket(t)).length,
        exact: true
      }
    };
  } catch (error) {
    console.error("Error in fetchDashboardSnapshotApi:", error);
    const fallback = emptyResultOnMissingIndex(error, "fetchDashboardSnapshotApi");
    if (fallback) return fallback;
    return { status: "error", message: error.message };
  }
}

// ============================================================
// حساب أرقام كروت لوحة المتابعة الرئيسية (مفتوحة/تم إصلاحها/اليوم/الإجمالي)
// بدقة وسرعة من البيانات المحدثة
// ============================================================

export async function fetchTicketCountsApi({ role, myName } = {}) {
  try {
    const ticketsRef = collection(db, "tickets");
    const isFullAccess = hasFullDataAccess(role);
    let totalCount = 0;

    if (isFullAccess || !myName) {
      const snap = await getCountFromServer(ticketsRef);
      totalCount = snap.data().count;
    } else {
      // For limited access, count both reported and assigned
      // إصلاح: التذكرة اللي المُبلّغ فيها = المُسند إليه كانت بتتعد مرتين فالإجمالي
      // بيتنفخ. نطرح تقاطع الشرطين (inclusion-exclusion) عشان العدد = عدد
      // التذاكر المميزة، زي ما fetchTicketsApi بتعمل dedupe
      const [reportedSnap, assignedSnap, bothSnap] = await Promise.all([
        getCountFromServer(query(ticketsRef, where("reportedBy", "==", myName))),
        getCountFromServer(query(ticketsRef, where("assignedTo", "==", myName))),
        getCountFromServer(query(ticketsRef, where("reportedBy", "==", myName), where("assignedTo", "==", myName)))
      ]);
      totalCount = reportedSnap.data().count + assignedSnap.data().count - bothSnap.data().count;
    }

    return {
      status: "success",
      data: {
        total: totalCount
      }
    };
  } catch (error) {
    console.error("Error calculating ticket counts:", error);
    return { status: "error", message: error.message };
  }
}

export async function fetchPendingTicketsApi() {
  try {
    const q = query(
      collection(db, "tickets"),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    const tickets = [];
    querySnapshot.forEach(docSnap => {
      tickets.push({ id: docSnap.id, ...docSnap.data() });
    });
    return { status: "success", data: tickets };
  } catch (error) {
    const fallback = emptyResultOnMissingIndex(error, "fetchPendingTicketsApi");
    if (fallback) return fallback;
    console.error("Error fetching pending tickets:", error);
    return { status: "error", message: error.message };
  }
}

export async function fetchTicketsForTechnicianApi(technicianName) {
  try {
    const q = query(
      collection(db, "tickets"),
      where("assignedTo", "==", technicianName),
      where("status", "in", ["assigned", "in_progress"]),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    const tickets = [];
    querySnapshot.forEach(docSnap => {
      tickets.push({ id: docSnap.id, ...docSnap.data() });
    });
    return { status: "success", data: tickets };
  } catch (error) {
    const fallback = emptyResultOnMissingIndex(error, "fetchTicketsForTechnicianApi");
    if (fallback) return fallback;
    console.error("Error fetching technician tickets:", error);
    return { status: "error", message: error.message };
  }
}

export async function fetchResolvedTicketsApi() {
  try {
    const q = query(
      collection(db, "tickets"),
      where("status", "==", "resolved"),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    const tickets = [];
    querySnapshot.forEach(docSnap => {
      tickets.push({ id: docSnap.id, ...docSnap.data() });
    });
    return { status: "success", data: tickets };
  } catch (error) {
    const fallback = emptyResultOnMissingIndex(error, "fetchResolvedTicketsApi");
    if (fallback) return fallback;
    console.error("Error fetching resolved tickets:", error);
    return { status: "error", message: error.message };
  }
}

// ============================================================
// Real-time Listener للوحة متابعة التذاكر حسب الدور والتبويب (مع الترتيب المحلي لمنع مشاكل الـ Indexes)
// ============================================================

export function subscribeToTicketsBoardApi({ role, myUid, myName, status }, callback) {
  try {
    const ticketsRef = collection(db, "tickets");

    // إصلاح M6: فلتر زمني "أعطال اليوم" - بنفس منطق حساب كارت "أعطال
    // اليوم" في loadDashboardStats (workflow.js) بالظبط (مقارنة
    // toDateString() مع تاريخ اليوم)، بغض النظر عن حالة التذكرة
    const isCreatedToday = (ticket) => {
      if (!ticket.createdAt) return false;
      const created = new Date(ticket.createdAt);
      if (isNaN(created.getTime())) return false;
      return created.toDateString() === new Date().toDateString();
    };

    const handleSnapshotWithoutOrder = (q, context) => {
      return onSnapshot(
        q,
        (querySnapshot) => {
          let tickets = [];
          querySnapshot.forEach(docSnap => {
            tickets.push({ id: docSnap.id, ...docSnap.data() });
          });
          // إصلاح M6: فلترة محلية بتاريخ اليوم (فوق أي فلتر حالة) لما
          // يكون الفلتر المطلوب "today" - نفس أسلوب فلترة التاريخ
          // المحلية المستخدم بالفعل في fetchTicketsForReportApi بدل أي
          // استعلام Firestore إضافي على createdAt (تفادياً لأي Composite Index)
          if (status === "today") {
            tickets = tickets.filter(isCreatedToday);
          }
          // إضافة (تحسين Workflow - كارت "بلاغات متأخرة"): فلترة محلية
          // بنفس دالة isOverdueTicket المستخدمة في حساب كارت الرئيسية
          // (workflow.js) بالظبط، عشان الفلتر يطابق الرقم الظاهر تماماً
          if (status === "overdue") {
            tickets = tickets.filter(t => isOverdueTicket(t));
          }
          // ترتيب محلياً حسب التاريخ من الأحدث للأقدم
          tickets.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
          callback({ status: "success", data: tickets });
        },
        (error) => {
          const fallback = emptyResultOnMissingIndex(error, context);
          if (fallback) {
            callback(fallback);
            return;
          }
          console.error(`Error in ${context}:`, error);
          callback({ status: "error", message: error.message });
        }
      );
    };

    // اشتراك مدمج بالـ UID + الاسم (بند M1): بنسمع على استعلامين (UID للتذاكر
    // الجديدة، والاسم للتذاكر القديمة بدون UID) وندمج النتائج، وبعدها نفلتر
    // بـ predicate يطابق UID أولاً (فاسمين متطابقين مايتداخلوش).
    const subscribeByIdentity = (queries, predicate, context) => {
      const buckets = queries.map(() => null);
      const emit = () => {
        if (buckets.some(b => b === null)) return;
        const merged = new Map();
        buckets.flat().forEach(t => merged.set(t.id, t));
        let tickets = Array.from(merged.values()).filter(predicate);
        if (status === "today") tickets = tickets.filter(isCreatedToday);
        if (status === "overdue") tickets = tickets.filter(t => isOverdueTicket(t));
        tickets.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
        callback({ status: "success", data: tickets });
      };
      const unsubs = queries.map((q, idx) => onSnapshot(
        q,
        (snapshot) => {
          const list = [];
          snapshot.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() }));
          buckets[idx] = list;
          emit();
        },
        (error) => {
          const fallback = emptyResultOnMissingIndex(error, context);
          if (fallback && idx === 0) { callback(fallback); return; }
          if (!fallback) console.error(`Error in ${context}:`, error);
          buckets[idx] = [];
          emit();
        }
      ));
      return () => unsubs.forEach(u => u());
    };

    const reportedMine = (t) => t.reportedByUid ? t.reportedByUid === myUid : (!!myName && t.reportedBy === myName);
    const assignedMine = (t) => t.assignedToUid ? t.assignedToUid === myUid : (!!myName && t.assignedTo === myName);
    const ACTIVE_ASSIGNED = ["assigned", "in_progress", "reopened"];

    // 1. تبويب "بلاغاتي" (My Tickets)
    if (status === "my_tickets") {
      return subscribeByIdentity(
        [
          query(ticketsRef, where("reportedBy", "==", myName || "")),
          ...(myUid ? [query(ticketsRef, where("reportedByUid", "==", myUid))] : [])
        ],
        reportedMine,
        "subscribeToTicketsBoardApi(my_tickets)"
      );
    }

    // 2. تبويب "المُسندة إليّ" (Assigned To Me)
    if (status === "assigned_to_me") {
      return subscribeByIdentity(
        [
          query(ticketsRef, where("assignedTo", "==", myName || ""), where("status", "in", ACTIVE_ASSIGNED)),
          ...(myUid ? [query(ticketsRef, where("assignedToUid", "==", myUid), where("status", "in", ACTIVE_ASSIGNED))] : [])
        ],
        assignedMine,
        "subscribeToTicketsBoardApi(assigned_to_me)"
      );
    }

    // 3. تبويب "بانتظار تأكيدي" (Awaiting Confirm)
    if (status === "awaiting_confirm") {
      return subscribeByIdentity(
        [
          query(ticketsRef, where("reportedBy", "==", myName || ""), where("status", "==", "resolved")),
          ...(myUid ? [query(ticketsRef, where("reportedByUid", "==", myUid), where("status", "==", "resolved"))] : [])
        ],
        reportedMine,
        "subscribeToTicketsBoardApi(awaiting_confirm)"
      );
    }

    // 4. الفلاتر العامة (الأدمن والمدير)
    // إصلاح (تنظيف/Refactor): CLOSED_STATUSES بقت مستوردة من ملف الثوابت
    // المشترك بدل مصفوفة محلية مكررة (CLOSED_STATUSES_FOR_HOME_CARDS)
    // - عشان كارت "تم إصلاحها" في الرئيسية يفضل مطابق تماماً لنفس
    // منطق isClosedStatus في workflow.js حتى لو القائمة اتعدّلت مستقبلاً
    const STATUS_QUERY_ALIASES = {
      pending: ["pending", "open"],
      in_progress: ["in_progress", "reopened", "assigned"],
      fixed: CLOSED_STATUSES
    };

    const statusClauses = () => {
      // أرقام لوحة المتابعة (بند H4): "متأخرة" و"اليوم" كانوا بيرجعوا من
      // أحدث 300 بلاغ فقط (الأقدم = الأكثر تأخراً كان بيُستبعد). دلوقتي
      // بنقيّد الاستعلام نفسه على السيرفر: متأخرة = كل ما هو غير مغلق نهائياً
      // (بما فيه resolved بانتظار التأكيد، والتصفية النهائية isOverdueTicket)،
      // واليوم = createdAt من بداية اليوم المحلي. من غير limit.
      if (status === "overdue") {
        return [where("status", "not-in", ["closed", "done", "مغلق"])];
      }
      if (status === "today") {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        return [where("createdAt", ">=", startOfToday.toISOString())];
      }
      if (!status || status === "all") return [];
      if (status === "open") {
        // إصلاح M2: كارت "أعطال مفتوحة" بيحسب رقمه كـ "كل حالة مش
        // مغلقة" (isClosedStatus === false) مش قائمة حالات مفتوحة
        // محددة سلفاً - فبدل تخمين قائمة "مفتوحة" ممكن تفوّت حالة جديدة
        // غير متوقعة، بنستخدم عكس بالظبط نفس قائمة الحالات المغلقة
        // (CLOSED_STATUSES) عشان الفلتر يطابق الرقم تماماً
        return [where("status", "not-in", CLOSED_STATUSES)];
      }
      const values = STATUS_QUERY_ALIASES[status];
      return values ? [where("status", "in", values)] : [where("status", "==", status)];
    };

    if (isAdminRole(role) || role === "manager" || role === "supervisor" || role === "engineer" || !["my_tickets", "assigned_to_me", "awaiting_confirm"].includes(status)) {
      const clauses = statusClauses();
      const q = clauses.length === 0
        ? query(ticketsRef, orderBy("createdAt", "desc"), limit(TICKETS_BOARD_DEFAULT_LIMIT))
        : query(ticketsRef, ...clauses);
      return handleSnapshotWithoutOrder(q, "subscribeToTicketsBoardApi(general)");
    }

    // الفنيين والمشغلين في باقي التبويبات: بلاغاتي + المُسندة إليّ (UID + اسم)
    return subscribeByIdentity(
      [
        query(ticketsRef, where("reportedBy", "==", myName || ""), ...statusClauses()),
        query(ticketsRef, where("assignedTo", "==", myName || ""), ...statusClauses()),
        ...(myUid
          ? [
              query(ticketsRef, where("reportedByUid", "==", myUid), ...statusClauses()),
              query(ticketsRef, where("assignedToUid", "==", myUid), ...statusClauses())
            ]
          : [])
      ],
      (t) => reportedMine(t) || assignedMine(t),
      "subscribeToTicketsBoardApi(limited)"
    );

  } catch (error) {
    console.error("Error subscribing to tickets board:", error);
    callback({ status: "error", message: error.message });
    return () => {};
  }
}

// ============================================================
// جلب تذاكر آخر N يوم لتقرير قابل للتصدير
// ============================================================
// إصلاح (أمان): كانت الدالة بتستقبل role/myUid/myName كباراميترات
// لكن من غير ما تستخدمهم خالص - النتيجة إن أي مستخدم (حتى فني عادي)
// كان بيقدر يضغط زر "تقرير شهري PDF" ويسحب كل تذاكر الشركة (مش بس
// بلاغاته هو). دلوقتي بتطبّق بالظبط نفس منطق الصلاحيات المُستخدم في
// fetchTicketsForSearchApi: وصول كامل (admin/manager/engineer) يجيب
// كل التذاكر، وإلا استعلامين where على reportedBy وassignedTo.
//
// تحسين (أداء): فلترة sinceISO بقت where("createdAt", ">=", sinceISO)
// على مستوى الاستعلام نفسه بدل الجلب الكامل ثم الفلترة محلياً - بيقلل
// عدد المستندات المقروءة فعلياً من Firestore في كل تقرير شهري.
// ⚠️ ده محتاج Composite Index جديد في Firestore لحالة الوصول المحدود
// (reportedBy+createdAt وassignedTo+createdAt) - راجع firestore.indexes.json
// المُرفق. لحد ما الـ Index يتنشر، أي محاولة هترجع نتيجة فاضية بأمان
// (عبر emptyResultOnMissingIndex) بدل ما توقع الصفحة، وهتتسجل تحذير
// في console يوضح الحاجة للـ Index.
export async function fetchTicketsForReportApi({ role, myUid, myName, sinceISO }) {
  try {
    const ticketsRef = collection(db, "tickets");
    const isFullAccess = hasFullDataAccess(role);
    const dateClause = sinceISO ? [where("createdAt", ">=", sinceISO)] : [];
    let tickets = [];

    if (isFullAccess) {
      const snap = await getDocs(query(ticketsRef, ...dateClause));
      snap.forEach(docSnap => tickets.push({ id: docSnap.id, ...docSnap.data() }));
    } else {
      const [reportedSnap, assignedSnap] = await Promise.all([
        getDocs(query(ticketsRef, where("reportedBy", "==", myName || ""), ...dateClause)),
        getDocs(query(ticketsRef, where("assignedTo", "==", myName || ""), ...dateClause))
      ]);

      const merged = new Map();
      reportedSnap.forEach(docSnap => merged.set(docSnap.id, { id: docSnap.id, ...docSnap.data() }));
      assignedSnap.forEach(docSnap => merged.set(docSnap.id, { id: docSnap.id, ...docSnap.data() }));
      tickets = Array.from(merged.values());
    }

    tickets.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    return { status: "success", data: tickets };
  } catch (error) {
    const fallback = emptyResultOnMissingIndex(error, "fetchTicketsForReportApi");
    if (fallback) return fallback;
    console.error("Error fetching tickets for report:", error);
    return { status: "error", message: error.message };
  }
}

// ============================================================
// جلب بلاغات الأعطال لصفحة "البحث والفلترة المتقدمة" (maintenanceSearch)
// - نفس فكرة فلترة الصلاحيات على مستوى الاستعلام نفسه المُستخدمة في
//   fetchTicketsForReportApi فوق (بدل جلب كل شيء ثم فلترته محلياً)،
//   لكن isFullAccess بيتحدد من الصفحة نفسها (admin/manager/engineer -
//   راجع hasFullDataAccess في permissions.js) بدل تكرار شرط دور مختلف
//   هنا. بدون قيد تاريخ عند الجلب لأن فلتر التاريخ في الصفحة تفاعلي
//   على نفس النتائج المجلوبة مرة واحدة (بدون أي طلب إضافي لـ Firestore)
// ============================================================
export async function fetchTicketsForSearchApi({ isFullAccess, myUid, myName }) {
  try {
    const ticketsRef = collection(db, "tickets");

    if (isFullAccess) {
      const snap = await getDocs(query(ticketsRef));
      const tickets = [];
      snap.forEach(docSnap => tickets.push({ id: docSnap.id, ...docSnap.data() }));
      return { status: "success", data: tickets };
    }

    // وصول محدود (فني/مهندس عادي): بلاغاته هو بس (بلّغ بيها أو
    // مُسندة إليه) - استعلامين بالاسم (نفس أسلوب subscribeToTicketsBoardApi
    // وfetchTicketsForReportApi) بدل استعلام واحد على كل التذاكر
    const [reportedSnap, assignedSnap] = await Promise.all([
      getDocs(query(ticketsRef, where("reportedBy", "==", myName || ""))),
      getDocs(query(ticketsRef, where("assignedTo", "==", myName || "")))
    ]);

    const merged = new Map();
    reportedSnap.forEach(docSnap => merged.set(docSnap.id, { id: docSnap.id, ...docSnap.data() }));
    assignedSnap.forEach(docSnap => merged.set(docSnap.id, { id: docSnap.id, ...docSnap.data() }));

    return { status: "success", data: Array.from(merged.values()) };
  } catch (error) {
    console.error("Error fetching tickets for search:", error);
    return { status: "error", message: error.message };
  }
}

export async function updateTicketStatusApi(ticketId, status, notes = "") {
  try {
    const ticketRef = doc(db, "tickets", ticketId);
    await updateDoc(ticketRef, {
      status,
      notes,
      updatedAt: new Date().toISOString(),
      updatedBy: localStorage.getItem("name") || ""
    });
    return { status: "success" };
  } catch (error) {
    console.error("Error updating ticket:", error);
    return { status: "error", message: error.message };
  }
}

// ============================================================
// Helpers & Lifecycle
// ============================================================

function stampUpdate(extra = {}) {
  return {
    ...extra,
    updatedAt: new Date().toISOString(),
    updatedBy: localStorage.getItem("name") || ""
  };
}

function isMissingIndexError(error) {
  return error?.code === "failed-precondition";
}

function emptyResultOnMissingIndex(error, context) {
  if (isMissingIndexError(error)) {
    console.warn(
      `[${context}] محتاج Index في Firestore - ` +
      `تم إخفاء الخطأ مؤقتاً. التفاصيل: ${error.message}`
    );
    return { status: "success", data: [] };
  }
  return null; 
}

async function addTicketLog(ticketId, { action, fromStatus, toStatus, note = "" }) {
  try {
    await addDoc(collection(db, "tickets", ticketId, "logs"), {
      action,
      fromStatus,
      toStatus,
      note,
      by: localStorage.getItem("name") || "",
      byUid: localStorage.getItem("userId") || "",
      byRole: getCurrentRole() || "",
      at: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error adding ticket log:", error);
  }
}

export async function fetchTicketLogsApi(ticketId) {
  try {
    const q = query(collection(db, "tickets", ticketId, "logs"), orderBy("at", "asc"));
    const querySnapshot = await getDocs(q);
    const logs = [];
    querySnapshot.forEach(docSnap => {
      logs.push({ id: docSnap.id, ...docSnap.data() });
    });
    return { status: "success", data: logs };
  } catch (error) {
    console.error("Error fetching ticket logs:", error);
    return { status: "error", message: error.message };
  }
}

export async function fetchTicketByIdApi(ticketId) {
  try {
    const docSnap = await getDoc(doc(db, "tickets", ticketId));
    if (!docSnap.exists()) {
      return { status: "error", message: "التذكرة غير موجودة" };
    }
    return { status: "success", data: { id: docSnap.id, ...docSnap.data() } };
  } catch (error) {
    console.error("Error fetching ticket:", error);
    return { status: "error", message: error.message };
  }
}

/**
 * فحص وجود بلاغ مفتوح/نشط للماكينة والخط المحددين لتجنب ازدواجية البلاغات بين الورديات
 */
// الحالات التي تُعتبر "بلاغ مفتوح" لأغراض كشف التكرار (تشمل resolved لأنها
// بانتظار تأكيد المُبلّغ ولم تُغلق بعد)
const OPEN_TICKET_STATUSES = ["pending", "assigned", "in_progress", "reopened", "resolved"];

export async function fetchActiveTicketForMachineApi(machine, line = "") {
  try {
    await ensureAuthReady();
    if (!machine) return { status: "success", ticket: null };

    const cleanMachine = String(machine || "").trim();
    const cleanLine = normalizeLine(line);

    const ticketsRef = collection(db, "tickets");
    // إصلاح (Workflow - منع التكرار): الاستعلام القديم كان يجلب أول 25 مستنداً
    // للماكينة بدون ترتيب ولا فلتر حالة، فالبلاغ المفتوح قد لا يظهر لو للماكينة
    // سجل تاريخي كبير. بنفلتر بالحالات المفتوحة مباشرة (وresolved = بانتظار
    // تأكيد المُبلّغ لسه مفتوح فعلياً)، ولو الفلتر فشل نرجع لاستعلام الماكينة كامل.
    let snap;
    try {
      snap = await getDocs(query(
        ticketsRef,
        where("machine", "==", cleanMachine),
        where("status", "in", OPEN_TICKET_STATUSES)
      ));
    } catch (_) {
      snap = await getDocs(query(ticketsRef, where("machine", "==", cleanMachine)));
    }
    const activeTickets = [];

    snap.forEach(docSnap => {
      const data = docSnap.data();
      const st = String(data.status || "").trim().toLowerCase();
      if (OPEN_TICKET_STATUSES.includes(st)) {
        if (!cleanLine || !data.line || normalizeLine(data.line) === cleanLine) {
          activeTickets.push({ id: docSnap.id, ...data });
        }
      }
    });

    if (!activeTickets.length) {
      return { status: "success", ticket: null };
    }

    activeTickets.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return { status: "success", ticket: activeTickets[0], totalActive: activeTickets.length };
  } catch (error) {
    console.error("Error fetching active ticket for machine:", error);
    return { status: "error", message: error.message, ticket: null };
  }
}

/**
 * إضافة تحديث/ملاحظات تسليم الوردية لتذكرة قائمة دون إنشاء تذكرة مكررة
 */
export async function appendShiftNoteToTicketApi(ticketId, { note, shift = "", reporterName = "", reporterUid = "", images = [] } = {}) {
  try {
    await ensureAuthReady();
    if (!ticketId) return { status: "error", message: "معرف التذكرة مطلوب" };

    const ticketRef = doc(db, "tickets", ticketId);

    // رفع الصور مرة واحدة قبل أي محاولة (مايتكررش مع إعادة المحاولة)
    let imageUrls = [];
    if (Array.isArray(images) && images.length) {
      imageUrls = await uploadBase64Images(images, `${ticketId}_shift_${Date.now()}`);
    }

    // هوية الملاحظة ثابتة طول المحاولات (منع تكرارها لو المحاولة الأولى نجحت
    // فعلاً وضاع ردّها) - عشوائي لتفادي تصادم ملاحظتين في نفس الميلي ثانية
    const newUpdate = {
      id: "SH-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      note: String(note || "").trim().slice(0, 2000),
      shift: shift || localStorage.getItem("shift") || "",
      reporterName: reporterName || localStorage.getItem("name") || "فني",
      reporterUid: reporterUid || localStorage.getItem("userId") || "",
      createdAt: new Date().toISOString(),
      ...(imageUrls.length && { images: imageUrls })
    };

    // كتابتين متزامنتين من ورديتين: القاعدة بتشترط (الحجم الجديد = القديم + 1)
    // فالتانية كانت بترفض برسالة عامة وتضيع الملاحظة. دلوقتي: نقرأ الحالة
    // الحديثة من السيرفر ونعيد المحاولة (حتى 4 مرات) قبل ما نُبلّغ بالفشل.
    let currentTicket = null;
    let saved = false;
    let lastError = null;

    for (let attempt = 0; attempt < 4 && !saved; attempt++) {
      const snap = attempt === 0 ? await getDoc(ticketRef) : await getDocFromServerSafe(ticketRef);
      if (!snap.exists()) {
        return { status: "error", message: "التذكرة غير موجودة" };
      }
      currentTicket = snap.data();

      if (String(currentTicket.status || "").trim().toLowerCase() === "closed") {
        return { status: "error", message: "التذكرة مغلقة - لا يمكن إضافة ملاحظات وردية عليها" };
      }

      const existingUpdates = Array.isArray(currentTicket.shiftUpdates) ? currentTicket.shiftUpdates : [];

      // لو الملاحظة اتحفظت فعلاً في محاولة سابقة (رد ضايع) نعتبرها نجاح
      if (existingUpdates.some(u => u && u.id === newUpdate.id)) { saved = true; break; }

      try {
        await updateDoc(ticketRef, {
          shiftUpdates: [...existingUpdates, newUpdate],
          lastShiftUpdate: newUpdate,
          updatedAt: new Date().toISOString()
        });
        saved = true;
      } catch (writeError) {
        lastError = writeError;
        await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
      }
    }

    if (!saved) {
      throw lastError || new Error("تعذّر حفظ ملاحظة الوردية بعد عدة محاولات");
    }

    await addTicketLog(ticketId, {
      action: "shift_update",
      fromStatus: currentTicket.status,
      toStatus: currentTicket.status,
      note: `[تحديث وردية ${newUpdate.shift || ''}]: ${newUpdate.note}`
    });

    // إشعار الفني المُسند والمديرين بتسليم الوردية (M9 - كانت مفيش أي إشعار)
    notifyShiftUpdate(ticketId, currentTicket, newUpdate).catch(() => {});

    return { status: "success", update: newUpdate };
  } catch (error) {
    console.error("Error appending shift note to ticket:", error);
    return { status: "error", message: error.message };
  }
}

// قراءة من السيرفر مباشرة قدر الإمكان (بدون كاش قديم) لإعادة محاولة الكتابة
// المتزامنة - لو مش متاحة (أوفلاين) بنرجع للقراءة العادية
async function getDocFromServerSafe(ref) {
  try {
    return await getDoc(ref);
  } catch (_) {
    return getDoc(ref);
  }
}

async function notifyShiftUpdate(ticketId, ticket, update) {
  const myUid = localStorage.getItem("userId") || "";
  const targets = new Set();
  if (ticket.assignedToUid && ticket.assignedToUid !== myUid) targets.add(ticket.assignedToUid);
  const managersRes = await fetchManagersAndAdminsApi();
  if (managersRes.status === "success") {
    managersRes.data.forEach(m => { if (m.id && m.id !== myUid) targets.add(m.id); });
  }
  const text = `📝 تحديث وردية (${update.shift || "-"}) من ${update.reporterName} على بلاغ ${ticket.machine || ""}: ${update.note}`;
  for (const uid of targets) {
    createNotification(uid, { type: "shift_update", message: text, ticketId });
  }
}

async function createNotification(forUid, { type, message, ticketId }) {
  if (!forUid) return;
  try {
    await addDoc(collection(db, "notifications"), {
      forUid,
      type,
      // الحد 500 حرف مطابق لقاعدة Firestore (notifications.create)
      message: String(message || "").slice(0, 500),
      ...(ticketId && { ticketId }),
      read: false,
      createdByUid: localStorage.getItem("userId") || "",
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error creating notification:", error);
  }
}

// إصلاح (بند مرتفع الأولوية - إشعار عند بلاغ جديد): يبعت إشعار "بلاغ
// جديد" لكل مدير/أدمن نشط في المصنع - راجع الاستدعاء في saveIssueApi
// فوق. بيتجاهل بأمان (من غير ما يرمي Exception) لو قايمة المدراء
// فاضية أو فشل الجلب، عشان أي مشكلة هنا ما تأثرش على نجاح تسجيل
// البلاغ نفسه اللي أصلاً خلص قبل ما الدالة دي تتنادى
async function notifyManagersOfNewTicket(ticketId, ticketData) {
  const machineLabel = ticketData?.machine || "";
  const reporterName = ticketData?.reportedBy || "";

  const message = machineLabel
    ? `بلاغ عطل جديد على "${machineLabel}"${reporterName ? ` من ${reporterName}` : ""}`
    : `تم تسجيل بلاغ عطل جديد${reporterName ? ` من ${reporterName}` : ""}`;

  const result = await fetchManagersAndAdminsApi();
  if (result.status !== "success" || !result.data.length) {
    return;
  }

  // إصلاح: المُبلّغ نفسه (لو مدير/أدمن) كان بيستلم إشعار "بلاغ جديد" على
  // بلاغه هو - نفس استثناء notifyAdminsOfNewSuggestion
  const reporterUid = ticketData?.reportedByUid || "";
  const recipients = result.data.filter(manager => manager.id && manager.id !== reporterUid);
  if (!recipients.length) return;

  await Promise.all(
    recipients.map(manager =>
      createNotification(manager.id, {
        type: "new_ticket",
        message,
        ticketId
      })
    )
  );
}

// ملاحظة: بدون orderBy مع where عشان نتجنب الحاجة لـ Composite Index
// في Firestore - الترتيب بيتم محلياً بنفس أسلوب subscribeToTicketsBoardApi
export async function fetchMyNotificationsApi(uid) {
  try {
    const q = query(collection(db, "notifications"), where("forUid", "==", uid));
    const querySnapshot = await getDocs(q);
    const notifications = [];
    querySnapshot.forEach(docSnap => {
      notifications.push({ id: docSnap.id, ...docSnap.data() });
    });
    notifications.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return { status: "success", data: notifications.slice(0, 30) };
  } catch (error) {
    const fallback = emptyResultOnMissingIndex(error, "fetchMyNotificationsApi");
    if (fallback) return fallback;
    console.error("Error fetching notifications:", error);
    return { status: "error", message: error.message };
  }
}

// إصلاح (بند مؤكد بالاختبار العملي - Test 11): fetchMyNotificationsApi
// بترجع أحدث 30 إشعار بس (مقصود - عشان قائمة "الإشعارات" في الواجهة
// متبقاش بلا حدود). لكن رقم الجرس (refreshNotificationsBadge) كان
// بيحسب "غير المقروء" من نفس الـ30 دول بالظبط - يعني لأدمن/مدير نشط
// بيوصله إشعار على كل تذكرة/مقترح جديد، أي إشعار غير مقروء أقدم من
// أحدث 30 إشعار (سهل الحصول عليه خلال أسبوع أو اتنين نشاط عادي) كان
// بيختفي تماماً: مش معدود في رقم الجرس، ومش ظاهر في القائمة - يعني
// فقدان فعلي لتنبيه مهم بدون ما المستخدم يعرف إنه موجود أصلاً. هذه
// الدالة الصغيرة بتحسب العدد الحقيقي الكامل لغير المقروء (بدون أي
// حد أقصى) - بنفس الاستعلام الأساسي (forUid فقط، زي ما هو مستخدم
// بالفعل)، وتُستخدم في مكان واحد بس (رقم الجرس)، من غير أي تغيير في
// قائمة الإشعارات المعروضة نفسها أو سلوكها الحالي.
export async function countUnreadNotificationsApi(uid) {
  try {
    // Test 16/17: كانت بتقرأ كل إشعارات المستخدم (بلا limit، ومفيش حذف
    // للإشعارات القديمة) عشان تعدّ غير المقروء - وبتتنادى مع كل render()
    // (شارة 🔔). العدّ بالـ Aggregation بيقرا فهرس فقط (قراءة واحدة لكل
    // 1000 إدخال) بدل تحميل كل المستندات، بنفس النتيجة بالظبط
    const q = query(
      collection(db, "notifications"),
      where("forUid", "==", uid),
      where("read", "==", false)
    );
    const countSnap = await getCountFromServer(q);
    return { status: "success", count: countSnap.data().count };
  } catch (error) {
    const fallback = emptyResultOnMissingIndex(error, "countUnreadNotificationsApi");
    if (fallback) return { status: "success", count: 0 };
    console.error("Error counting unread notifications:", error);
    return { status: "error", message: error.message };
  }
}

// اشتراك لحظي (Realtime) في إشعارات المستخدم - يُستخدم لتحديث
// الجرس والقائمة المنبثقة تلقائياً بدون إعادة تحميل
export function subscribeToMyNotificationsApi(uid, callback) {
  try {
    const q = query(collection(db, "notifications"), where("forUid", "==", uid));
    return onSnapshot(
      q,
      (querySnapshot) => {
        const notifications = [];
        querySnapshot.forEach(docSnap => {
          notifications.push({ id: docSnap.id, ...docSnap.data() });
        });
        notifications.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
        callback({ status: "success", data: notifications.slice(0, 30) });
      },
      (error) => {
        const fallback = emptyResultOnMissingIndex(error, "subscribeToMyNotificationsApi");
        if (fallback) {
          callback(fallback);
          return;
        }
        console.error("Error subscribing to notifications:", error);
        callback({ status: "error", message: error.message });
      }
    );
  } catch (error) {
    console.error("Error subscribing to notifications:", error);
    callback({ status: "error", message: error.message });
    return () => {};
  }
}

export async function markNotificationReadApi(notificationId) {
  try {
    await updateDoc(doc(db, "notifications", notificationId), { read: true });
    return { status: "success" };
  } catch (error) {
    console.error("Error marking notification read:", error);
    return { status: "error", message: error.message };
  }
}

// تحديد كل إشعارات المستخدم الحالي كمقروءة دفعة واحدة (Batch Write)
// where("forUid","==") + where("read","==") فلترتين equality بس -> بدون Index
export async function markAllNotificationsAsRead(uid) {
  try {
    const q = query(
      collection(db, "notifications"),
      where("forUid", "==", uid),
      where("read", "==", false)
    );
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return { status: "success", updated: 0 };
    }

    // إصلاح: Firestore بيرفض أي batch فيه أكتر من 500 عملية، والإشعارات
    // مفيهاش حذف في القواعد فبتتراكم - فكانت "تعليم الكل كمقروء" بتفشل كلها.
    // دلوقتي بتتقسم على دفعات 400
    const docs = querySnapshot.docs;
    const CHUNK = 400;
    for (let i = 0; i < docs.length; i += CHUNK) {
      const batch = writeBatch(db);
      docs.slice(i, i + CHUNK).forEach(docSnap => {
        batch.update(docSnap.ref, { read: true });
      });
      await batch.commit();
    }

    return { status: "success", updated: docs.length };
  } catch (error) {
    const fallback = emptyResultOnMissingIndex(error, "markAllNotificationsAsRead");
    if (fallback) return { status: "success", updated: 0 };
    console.error("Error marking all notifications as read:", error);
    return { status: "error", message: error.message };
  }
}

export async function assignTicketApi(ticketId, { type, assignedTo, assignedToUid }) {
  if (!type || !assignedTo) {
    return { status: "error", message: "type و assignedTo مطلوبين" };
  }
  try {
    await updateDoc(
      doc(db, "tickets", ticketId),
      stampUpdate({
        status: "assigned",
        type,
        assignedTo,
        ...(assignedToUid && { assignedToUid })
      })
    );
    addTicketLog(ticketId, {
      action: "assign",
      fromStatus: "pending",
      toStatus: "assigned",
      note: `تم الإسناد إلى ${assignedTo}`
    });
    if (assignedToUid) {
      createNotification(assignedToUid, {
        type: "assigned",
        message: `تم إسناد بلاغ صيانة جديد إليك`,
        ticketId
      });
    }
    return { status: "success" };
  } catch (error) {
    console.error("Error assigning ticket:", error);
    return { status: "error", message: error.message };
  }
}

// إضافة (تحسين Workflow - إعادة إسناد): للمدير/الأدمن بس - بتسمح
// بنقل تذكرة "تم الإسناد"/"قيد التنفيذ" لفني تاني (لو الفني الأصلي
// بقى غير متاح مثلاً) بدل ما التذكرة تفضل عالقة من غير أي تحرك. بترجع
// حالة التذكرة لـ "assigned" دايماً (حتى لو كانت in_progress) عشان
// الفني الجديد يبدأ التنفيذ بنفسه من الأول ويبقى في السجل واضح مين
// المسؤول فعلياً عن كل مرحلة
export async function reassignTicketApi(ticketId, { assignedTo, assignedToUid }, { skipOfflineQueue = false } = {}) {
  if (!assignedTo) {
    return { status: "error", message: "assignedTo مطلوب" };
  }

  // إضافة (تحسين Workflow - دعم Offline لتحديث الحالة): لو مفيش نت،
  // منقدرش نتحقق من حالة التذكرة الحالية على السيرفر (getDoc) قبل ما
  // نسمح بإعادة الإسناد - فبنخزّن الإجراء محلياً "بشكل متفائل" (Optimistic)
  // ونأجّل التحقق الفعلي (هل التذكرة لسه assigned/in_progress؟) لحظة
  // المزامنة عند عودة الاتصال، بنفس أسلوب باقي إجراءات دورة حياة
  // التذكرة (start/resolve/close)
  if (!skipOfflineQueue && typeof navigator !== "undefined" && !navigator.onLine) {
    try {
      const localId = await queueOfflineAction({
        type: "reassign",
        ticketId,
        payload: { assignedTo, assignedToUid: assignedToUid || null }
      });
      return {
        status: "queued",
        localId,
        message: "لا يوجد اتصال بالإنترنت - سيتم تنفيذ (إعادة الإسناد) تلقائياً عند عودة الاتصال"
      };
    } catch (error) {
      console.error("Error queuing offline reassign action:", error);
      return { status: "error", message: "تعذر حفظ الإجراء محلياً" };
    }
  }

  try {
    const ticketRef = doc(db, "tickets", ticketId);
    const ticketSnap = await getDoc(ticketRef);
    if (!ticketSnap.exists()) {
      return { status: "error", message: "التذكرة غير موجودة" };
    }

    const currentData = ticketSnap.data();
    const fromStatus = String(currentData.status || "").trim().toLowerCase();
    const previousAssignee = currentData.assignedTo || "غير محدد";
    const previousAssigneeUid = currentData.assignedToUid || null;

    // إعادة الإسناد مسموحة بس للتذاكر المفتوحة فعلياً (تم الإسناد/قيد
    // التنفيذ/معاد فتحها) - مش على تذاكر بانتظار تأكيد المُبلغ أو مغلقة
    // بالفعل، عشان منغيّرش مسؤول تذكرة خلصت مرحلتها
    if (!["assigned", "in_progress", "reopened"].includes(fromStatus)) {
      return {
        status: "error",
        message: "إعادة الإسناد متاحة فقط للتذاكر (تم الإسناد / قيد التنفيذ)"
      };
    }

    await updateDoc(
      ticketRef,
      stampUpdate({
        status: "assigned",
        assignedTo,
        assignedToUid: assignedToUid || null
      })
    );

    addTicketLog(ticketId, {
      action: "reassign",
      fromStatus,
      toStatus: "assigned",
      note: `إعادة إسناد من "${previousAssignee}" إلى "${assignedTo}"`
    });

    if (assignedToUid) {
      createNotification(assignedToUid, {
        type: "assigned",
        message: `تم إسناد بلاغ صيانة إليك (إعادة إسناد)`,
        ticketId
      });
    }
    // إصلاح: الفني السابق لازم يتعرف إن البلاغ اتسحب منه (كان بيفضل شايفه
    // في قائمته لحد ما يفتح اللوحة، وممكن يكمل شغل على تذكرة مش بتاعته)
    if (previousAssigneeUid && previousAssigneeUid !== assignedToUid) {
      createNotification(previousAssigneeUid, {
        type: "declined",
        message: `تم سحب البلاغ منك وإعادة إسناده إلى ${assignedTo}`,
        ticketId
      });
    }

    return { status: "success" };
  } catch (error) {
    console.error("Error reassigning ticket:", error);
    return { status: "error", message: error.message };
  }
}

export async function startTicketApi(ticketId, { skipOfflineQueue = false } = {}) {
  // إضافة (تحسين Workflow - دعم Offline لتحديث الحالة): "بدء التنفيذ"
  // مايحتاجش أي بيانات إضافية من المستخدم، فلو مفيش نت بنخزّن الإجراء
  // محلياً فوراً ونرجّعه كـ "queued" بدل ما يفشل الطلب بلا أي بديل
  if (!skipOfflineQueue && typeof navigator !== "undefined" && !navigator.onLine) {
    try {
      const localId = await queueOfflineAction({ type: "start", ticketId });
      return {
        status: "queued",
        localId,
        message: "لا يوجد اتصال بالإنترنت - سيتم تنفيذ (بدء التنفيذ) تلقائياً عند عودة الاتصال"
      };
    } catch (error) {
      console.error("Error queuing offline start action:", error);
      return { status: "error", message: "تعذر حفظ الإجراء محلياً" };
    }
  }

  try {
    await updateDoc(doc(db, "tickets", ticketId), stampUpdate({ status: "in_progress" }));
    addTicketLog(ticketId, {
      action: "start",
      fromStatus: "assigned",
      toStatus: "in_progress"
    });
    return { status: "success" };
  } catch (error) {
    console.error("Error starting ticket:", error);
    return { status: "error", message: error.message };
  }
}

// إصلاح: الإصلاح الذاتي من المُبلّغ (self_resolve في ticketsBoard.js)
// بيعرض حقل الصور "اختياري" في النافذة، لكن الدالة كانت بتفرض صورة
// واحدة على الأقل دايماً - فأي إصلاح ذاتي بدون صور كان بيفشل برسالة
// "لازم صورة واحدة". الخيار allowNoImages بيخلّي الصور اختيارية للإصلاح
// الذاتي فقط، وباقي الحالات (فني) لسه بتفرض صورة إجبارية زي ما هي.
export async function resolveTicketApi(
  ticketId,
  mechanicNotes,
  afterImages = [],
  { skipOfflineQueue = false, allowNoImages = false, selfResolved = false } = {}
) {
  if (!mechanicNotes || !mechanicNotes.trim()) {
    return { status: "error", message: "ملاحظات الفني مطلوبة" };
  }
  const images = (afterImages || []).filter(Boolean).slice(0, 3);
  if (!images.length && !allowNoImages) {
    return { status: "error", message: "لازم صورة واحدة على الأقل بعد الإصلاح (بحد أقصى 3)" };
  }

  // إضافة (تحسين Workflow - دعم Offline لتحديث الحالة): نفس التحقق من
  // صحة البيانات فوق بيتنفذ الأول (عشان مدخلات ناقصة متتخزنش في
  // الطابور أصلاً)، وبعدين لو مفيش نت بنخزّن النص والصور (Base64) محلياً
  // ونرفعها فعلياً على ImgBB/Firestore لما الاتصال يرجع (نفس أسلوب
  // queueOfflineTicket تماماً)
  if (!skipOfflineQueue && typeof navigator !== "undefined" && !navigator.onLine) {
    try {
      const localId = await queueOfflineAction({
        type: "resolve",
        ticketId,
        payload: { mechanicNotes: mechanicNotes.trim(), afterImages: images, allowNoImages, selfResolved }
      });
      return {
        status: "queued",
        localId,
        message: "لا يوجد اتصال بالإنترنت - سيتم رفع بيانات الإصلاح تلقائياً عند عودة الاتصال"
      };
    } catch (error) {
      console.error("Error queuing offline resolve action:", error);
      return { status: "error", message: "تعذر حفظ الإجراء محلياً" };
    }
  }

  try {
    // إصلاح (بند مؤكد بالاختبار العملي - Test 8، نفس جذر مشكلة
    // Test 7 في saveIssueApi/uploadBase64Images لكن في نقطة استدعاء
    // مختلفة تماماً هنا): كان الكود بيستخدم Promise.all خام مباشرة
    // على uploadBase64Image لكل صورة، فبمجرد فشل رفع صورة واحدة (من
    // ضمن حتى 3 صور) - شبكة متقطعة أو تعطل ImgBB مؤقت - يرفض الكل،
    // فتُفقد ملاحظات الفني (mechanicNotes) والتذكرة بالكامل تفضل
    // عالقة "قيد التنفيذ" رغم إن الإصلاح تم فعلياً. استخدام
    // uploadBase64Images المشتركة (المُصلَحة بالفعل - كل صورة
    // بمحاولتها الخاصة) بيحل نفس المشكلة هنا بدون تكرار المنطق. مع
    // الحفاظ على قاعدة "صورة واحدة على الأقل مطلوبة" (تحقق فوق) عبر
    // فحص نتيجة الرفع الفعلي كمان: لو كل الصور المرفوعة فشلت (نادر
    // جداً - يعني الصورة الوحيدة أو كل الصور فشلت معاً)، بترجع خطأ
    // واضح بدل ما تحفظ التذكرة بمصفوفة صور فاضية تخالف نفس القاعدة.
    // إصلاح: قراءة التذكرة قبل أي رفع - (1) منع "إحياء" تذكرة اتقفلت أو
    // اتحلت بالفعل (مثلاً إجراء resolve متخزّن Offline بعد ما التذكرة
    // اتقفلت/اتحلت من حد تاني) برسالة واضحة بدل رفض صامت من القواعد،
    // (2) تسجيل الحالة السابقة الفعلية في الـ Log
    const ticketRef = doc(db, "tickets", ticketId);
    const beforeSnap = await getDoc(ticketRef);
    if (!beforeSnap.exists()) {
      return { status: "error", message: "التذكرة غير موجودة" };
    }
    const before = beforeSnap.data();
    const fromStatus = String(before.status || "").trim().toLowerCase();
    if (!["pending", "assigned", "in_progress", "reopened"].includes(fromStatus)) {
      return { status: "error", message: "لا يمكن تسجيل الإصلاح - حالة التذكرة الحالية غير صالحة لذلك" };
    }

    const afterImageUrls = images.length
      ? await uploadBase64Images(images, `${ticketId}_after`)
      : [];
    if (images.length && !afterImageUrls.length) {
      return {
        status: "error",
        message: "تعذر رفع صور ما بعد الإصلاح - تحقق من الاتصال بالإنترنت وحاول مرة أخرى"
      };
    }

    // إصلاح (Workflow - المُبلّغ = من أصلح العطل / سجل الحالة السابقة / MTTR):
    // بنقرأ التذكرة قبل التحديث عشان:
    //  1) نسجّل الحالة السابقة الفعلية في الـ log بدل "in_progress" الثابتة.
    //  2) نعرف لو اللي بيصلح هو نفسه المُبلّغ (isSelfResolved) فنرسل المراجعة
    //     للمدراء بدل إشعار المُبلّغ بتأكيد إصلاحه هو.
    //  3) نكتب resolvedAt/resolvedByUid فيبقى MTTR مبني على وقت الإصلاح الفعلي
    //     مش على updatedAt (اللي بيتغير عند التأكيد وملاحظات الشيفت).
    const resolverUid = localStorage.getItem("userId") || "";
    // أمان (H5): isSelfResolved بيتحسب من UID الحقيقي فقط - مش من قيمة
    // بيبعتها الواجهة (selfResolved في الوسيط محتفظ بيه للتوافق مع عناصر
    // قديمة في الطابور لكن بيتجاهَل). القاعدة في firestore.rules بتفرض
    // نفس الحساب على السيرفر.
    const isSelfResolved = !!before.reportedByUid && before.reportedByUid === resolverUid;
    const nowISO = new Date().toISOString();

    await updateDoc(
      ticketRef,
      stampUpdate({
        status: "resolved",
        mechanicNotes: mechanicNotes.trim(),
        afterImages: afterImageUrls,
        resolvedAt: nowISO,
        resolvedAtServer: serverTimestamp(),
        resolvedBy: localStorage.getItem("name") || "",
        resolvedByUid: resolverUid,
        isSelfResolved
      })
    );
    addTicketLog(ticketId, {
      action: "resolve",
      fromStatus,
      toStatus: "resolved",
      note: (isSelfResolved ? "[إصلاح ذاتي من المُبلّغ] " : "") + mechanicNotes.trim()
    });

    if (isSelfResolved) {
      // المُبلّغ هو من أصلح: التأكيد يحتاج طرف آخر (مدير/مشرف/أدمن)
      const managers = await fetchManagersAndAdminsApi();
      if (managers.status === "success") {
        managers.data
          .filter(m => m.id !== resolverUid)
          .forEach(m => createNotification(m.id, {
            type: "resolved",
            message: `إصلاح ذاتي من المُبلّغ${before.machine ? ` على "${before.machine}"` : ""} - يحتاج مراجعة وتأكيد الإغلاق`,
            ticketId
          }));
      }
      // الفني المُسند (لو موجود وغير المُبلّغ) يتعرف إن البلاغ اتصلح من غيره
      if (before.assignedToUid && before.assignedToUid !== resolverUid) {
        createNotification(before.assignedToUid, {
          type: "resolved",
          message: `تم إصلاح البلاغ ذاتياً من المُبلّغ${before.machine ? ` على "${before.machine}"` : ""}`,
          ticketId
        });
      }
    } else if (before.reportedByUid) {
      createNotification(before.reportedByUid, {
        type: "resolved",
        message: `تم إصلاح بلاغك - برجاء التأكد والتأكيد`,
        ticketId
      });
    }
    return { status: "success" };
  } catch (error) {
    console.error("Error resolving ticket:", error);
    return { status: "error", message: error.message };
  }
}

export async function closeTicketApi(ticketId, { skipOfflineQueue = false } = {}) {
  // إضافة (تحسين Workflow - دعم Offline لتحديث الحالة): "تأكيد
  // الإغلاق" برضه مايحتاجش بيانات إضافية - نفس أسلوب startTicketApi
  if (!skipOfflineQueue && typeof navigator !== "undefined" && !navigator.onLine) {
    try {
      const localId = await queueOfflineAction({ type: "close", ticketId });
      return {
        status: "queued",
        localId,
        message: "لا يوجد اتصال بالإنترنت - سيتم تنفيذ (تأكيد الإغلاق) تلقائياً عند عودة الاتصال"
      };
    } catch (error) {
      console.error("Error queuing offline close action:", error);
      return { status: "error", message: "تعذر حفظ الإجراء محلياً" };
    }
  }

  try {
    const ticketSnap = await getDoc(doc(db, "tickets", ticketId));
    const assignedToUid = ticketSnap.exists() ? ticketSnap.data().assignedToUid : null;

    await updateDoc(doc(db, "tickets", ticketId), stampUpdate({ status: "closed" }));
    addTicketLog(ticketId, {
      action: "close",
      fromStatus: "resolved",
      toStatus: "closed"
    });

    if (assignedToUid) {
      createNotification(assignedToUid, {
        type: "closed",
        message: `تم تأكيد إغلاق البلاغ - شكراً لك`,
        ticketId
      });
    }
    return { status: "success" };
  } catch (error) {
    console.error("Error closing ticket:", error);
    return { status: "error", message: error.message };
  }
}

// ============================================================
// إضافة (تحسين Workflow - إجراءات جماعية Bulk Actions): تأكيد إغلاق
// أكتر من تذكرة "بانتظار تأكيد" مرة واحدة، بدل الضغط على كل تذكرة
// لوحدها. تحديث الحالة الفعلي لكل التذاكر بيتم في Batch واحد
// (writeBatch) - طلب واحد لـ Firestore بدل N طلب منفصل، وبعدين تسجيل
// الـ Log والإشعار لكل تذكرة بيحصل بالتوازي (منفصل عن الـ Batch لأن
// addDoc بيحتاج معرف تلقائي جديد، والهدف من الـ Batch هو التحديث
// الأساسي الذري بس). أي تذكرة مش بحالة "resolved" بيتم تجاهلها بأمان
// (مفيش إغلاق جماعي لتذاكر لسه قيد التنفيذ مثلاً)
// ============================================================
export async function bulkCloseTicketsApi(ticketIds) {
  if (!Array.isArray(ticketIds) || !ticketIds.length) {
    return { status: "error", message: "لم يتم تحديد أي تذكرة" };
  }

  try {
    // 1. قراءة كل التذاكر أولاً - للتحقق من إن الحالة "resolved" فعلاً
    // (المسموح إغلاقه جماعياً)، ولمعرفة assignedToUid لإرسال إشعار لاحقاً
    const snapshots = await Promise.all(
      ticketIds.map(id => getDoc(doc(db, "tickets", id)))
    );

    const validIds = [];
    const assigneeByTicket = {};

    snapshots.forEach((snap, i) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (String(data.status || "").trim().toLowerCase() !== "resolved") return;
      const id = ticketIds[i];
      validIds.push(id);
      assigneeByTicket[id] = data.assignedToUid || null;
    });

    if (!validIds.length) {
      return { status: "error", message: "لا توجد تذاكر صالحة للإغلاق الجماعي (بانتظار تأكيد فقط)" };
    }

    // 2. تحديث الحالة لكل التذاكر الصالحة في Batch واحد (ذرّي - إما
    // كلها تنجح أو كلها تفشل مع بعض)
    const batch = writeBatch(db);
    validIds.forEach(id => {
      batch.update(doc(db, "tickets", id), stampUpdate({ status: "closed" }));
    });
    await batch.commit();

    // 3. تسجيل Log + إشعار لكل تذكرة بالتوازي (بعد نجاح التحديث الأساسي)
    await Promise.all(validIds.map(async id => {
      addTicketLog(id, { action: "close", fromStatus: "resolved", toStatus: "closed" });
      const assignedToUid = assigneeByTicket[id];
      if (assignedToUid) {
        createNotification(assignedToUid, {
          type: "closed",
          message: `تم تأكيد إغلاق البلاغ - شكراً لك`,
          ticketId: id
        });
      }
    }));

    return {
      status: "success",
      closedCount: validIds.length,
      skippedCount: ticketIds.length - validIds.length
    };
  } catch (error) {
    console.error("Error bulk closing tickets:", error);
    return { status: "error", message: error.message };
  }
}

export async function rejectTicketApi(ticketId, reason) {
  if (!reason || !reason.trim()) {
    return { status: "error", message: "سبب الرفض مطلوب" };
  }
  try {
    const ticketSnap = await getDoc(doc(db, "tickets", ticketId));
    const assignedToUid = ticketSnap.exists() ? ticketSnap.data().assignedToUid : null;

    await updateDoc(doc(db, "tickets", ticketId), stampUpdate({ status: "in_progress" }));
    addTicketLog(ticketId, {
      action: "reject",
      fromStatus: "resolved",
      toStatus: "in_progress",
      note: reason.trim()
    });

    if (assignedToUid) {
      createNotification(assignedToUid, {
        type: "rejected",
        message: `تم رفض إصلاح البلاغ لأن المشكلة لم تحل بالكامل - برجاء المراجعة`,
        ticketId
      });
    }
    return { status: "success" };
  } catch (error) {
    console.error("Error rejecting ticket:", error);
    return { status: "error", message: error.message };
  }
}

export async function reopenTicketApi(ticketId, reason) {
  if (!reason || !reason.trim()) {
    return { status: "error", message: "سبب إعادة الفتح مطلوب" };
  }
  try {
    const ticketRef = doc(db, "tickets", ticketId);

    // إصلاح (Workflow - رفض المُبلّغ): بنقرأ التذكرة الأول عشان نبعت إشعار
    // للفني المُسند (أو للمدراء لو مفيش مُسند) ونحفظ سبب الرفض في
    // operatorFeedback - الحقل اللي كارت اللوحة وتفاصيل التذكرة بيعرضوه فعلاً
    // للفني (كان السبب بيتسجل في الـ log بس ومحدش بيتنبه له)
    const beforeSnap = await getDoc(ticketRef);
    const before = beforeSnap.exists() ? beforeSnap.data() : {};
    const cleanReason = reason.trim();

    // إصلاح (تصحيح Workflow - رفض المُبلّغ): البلاغ المرفوض بيرجع
    // مباشرة لنفس الفني المُسند إليه بحالة "reopened" (بدل "pending")
    // عشان يكمل الشغل من غير ما يحتاج مدير/أدمن يعيد إسناده من الأول.
    // "reopened" ده أصلاً معرّفة بالكامل في الترجمات والفلاتر
    // (ticketStatusConstants.js, ticketsApi.js, permissions.js) لكن
    // محدش كان بيحطها فعلياً - كانت بترجع pending دايماً
    await updateDoc(
      ticketRef,
      stampUpdate({ status: "reopened", operatorFeedback: cleanReason })
    );

    addTicketLog(ticketId, {
      action: "reopen",
      // إصلاح: كانت مسجلة "closed" وهو غلط - الرفض بيحصل من حالة
      // "resolved" فعلياً (مفيش زرار رفض إلا على تذكرة resolved)
      fromStatus: "resolved",
      toStatus: "reopened",
      note: cleanReason
    });

    const reopenMsg = `تم رفض إصلاح البلاغ${before.machine ? ` على "${before.machine}"` : ""} وإعادة فتحه: ${cleanReason}`;
    if (before.assignedToUid) {
      createNotification(before.assignedToUid, { type: "rejected", message: reopenMsg, ticketId });
    } else {
      // مفيش فني مُسند (مثلاً إصلاح ذاتي من المُبلّغ) -> المدراء يعيدوا الإسناد
      const managers = await fetchManagersAndAdminsApi();
      if (managers.status === "success") {
        const myUid = localStorage.getItem("userId") || "";
        managers.data
          .filter(m => m.id !== myUid)
          .forEach(m => createNotification(m.id, { type: "rejected", message: reopenMsg + " - يحتاج إعادة إسناد", ticketId }));
      }
    }

    return { status: "success" };
  } catch (error) {
    console.error("Error reopening ticket:", error);
    return { status: "error", message: error.message };
  }
}

// ============================================================
// عدم توفر الفني (بند H6)
// ============================================================

/**
 * تحرير كل البلاغات المفتوحة المُسندة لمستخدم لم يعد متاحاً (رُفض/عُطّل/
 * اتحذف): بترجع لقائمة "جديد" (pending) بدون مُسند، مع سبب واضح وسجل،
 * وبتنبّه المديرين لإعادة الإسناد - بدل ما تفضل عالقة عند حساب غير نشط.
 * بتتنفّذ من جهاز أدمن/مدير (قواعد STEP 2b بتسمح بهم فقط).
 * @returns {Promise<{status: string, released?: number}>}
 */
export async function releaseTicketsOfUserApi(userId, userName = "") {
  try {
    if (!userId) return { status: "success", released: 0 };

    const snap = await getDocs(query(collection(db, "tickets"), where("assignedToUid", "==", userId)));
    const openStatuses = ["assigned", "in_progress", "reopened"];
    const targets = [];
    snap.forEach(docSnap => {
      const status = String(docSnap.data().status || "").trim().toLowerCase();
      if (openStatuses.includes(status)) targets.push({ id: docSnap.id, fromStatus: status });
    });

    if (!targets.length) return { status: "success", released: 0 };

    const adminName = localStorage.getItem("name") || "Admin";
    const reason = `الفني (${userName || "غير معروف"}) لم يعد متاحاً - أُعيد البلاغ لقائمة الانتظار لإعادة الإسناد`;

    for (let i = 0; i < targets.length; i += 400) {
      const batch = writeBatch(db);
      targets.slice(i, i + 400).forEach(t => {
        batch.update(
          doc(db, "tickets", t.id),
          stampUpdate({
            status: "pending",
            assignedTo: null,
            assignedToUid: null,
            declineReason: reason,
            declinedBy: adminName,
            declinedAt: new Date().toISOString()
          })
        );
      });
      await batch.commit();
    }

    targets.forEach(t => {
      addTicketLog(t.id, { action: "release", fromStatus: t.fromStatus, toStatus: "pending", note: reason });
    });

    try {
      const managersRes = await fetchManagersAndAdminsApi();
      if (managersRes.status === "success") {
        for (const mgr of managersRes.data) {
          if (mgr.id) {
            createNotification(mgr.id, {
              type: "released",
              message: `تم تحرير ${targets.length} بلاغ من ${userName || "فني"} (لم يعد متاحاً) وأُعيدت لقائمة الانتظار - يلزم إعادة إسنادها`,
              ticketId: targets[0].id
            });
          }
        }
      }
    } catch (_) { /* التنبيه مساعد فقط */ }

    return { status: "success", released: targets.length };
  } catch (error) {
    console.error("Error releasing tickets of unavailable user:", error);
    return { status: "error", message: error.message };
  }
}

/**
 * تصعيد البلاغات المتأخرة (تجاوزت SLA): إشعار لكل مدير/أدمن، مرة واحدة
 * لكل (بلاغ + مدير) عن طريق معرّف إشعار حتمي - الإنشاء الثاني بيترفض
 * (القاعدة تمنع update) فمفيش تكرار عند كل فتح للوحة. بتتنادي من لوحة
 * المدير/الأدمن بعد حساب المتأخرات.
 */
export async function escalateOverdueTicketsApi(overdueTickets = []) {
  try {
    const role = getCurrentRole();
    if (!(isAdminRole(role) || role === "manager" || role === "supervisor")) return { status: "success", escalated: 0 };

    const list = overdueTickets.slice(0, 15);
    if (!list.length) return { status: "success", escalated: 0 };

    const managersRes = await fetchManagersAndAdminsApi();
    if (managersRes.status !== "success") return { status: "success", escalated: 0 };

    const myUid = localStorage.getItem("userId") || "";
    let count = 0;

    for (const t of list) {
      for (const mgr of managersRes.data) {
        if (!mgr.id) continue;
        const notifId = `esc_${t.id}_${mgr.id}`.replace(/[\/\s]/g, "_");
        try {
          await setDoc(doc(db, "notifications", notifId), {
            forUid: mgr.id,
            type: "escalated",
            message: `⏰ بلاغ متأخر عن الحد المسموح (${t.machine || "ماكينة"}) - يحتاج متابعة أو إعادة إسناد`.slice(0, 500),
            ticketId: t.id,
            read: false,
            createdByUid: myUid,
            createdAt: new Date().toISOString()
          });
          count++;
        } catch (_) { /* موجود بالفعل (مُصعَّد قبل كده) أو غير مسموح */ }
      }
    }
    return { status: "success", escalated: count };
  } catch (error) {
    console.warn("escalateOverdueTicketsApi failed:", error);
    return { status: "error", message: error.message };
  }
}


/**
 * اعتذار الفني المسند إليه وإعادة التذكرة لقائمة الانتظار (pending)
 */
export async function declineTicketApi(ticketId, reason) {
  try {
    const cleanReason = String(reason || "").trim() || "اعتذر الفني عن الاستلام وسحب العطل لإعادة الإسناد";
    const myName = localStorage.getItem("name") || "فني";

    // إصلاح: الـ Log كان بيسجّل fromStatus = "assigned" ثابتة حتى لو الاعتذار
    // من "in_progress" أو "reopened"، فبنقرا الحالة الفعلية الأول
    const declineRef = doc(db, "tickets", ticketId);
    const declineSnap = await getDoc(declineRef);
    if (!declineSnap.exists()) {
      return { status: "error", message: "التذكرة غير موجودة" };
    }
    const declineFromStatus = String(declineSnap.data().status || "").trim().toLowerCase();
    if (!["assigned", "in_progress", "reopened"].includes(declineFromStatus)) {
      return { status: "error", message: "الاعتذار متاح فقط للتذاكر المُسندة أو قيد التنفيذ" };
    }

    await updateDoc(
      doc(db, "tickets", ticketId),
      stampUpdate({
        status: "pending",
        assignedTo: null,
        assignedToUid: null,
        declineReason: cleanReason,
        declinedBy: myName,
        declinedAt: new Date().toISOString()
      })
    );

    addTicketLog(ticketId, {
      action: "decline",
      fromStatus: declineFromStatus,
      toStatus: "pending",
      note: cleanReason
    });

    notifyManagersOfTicketDecline(ticketId, cleanReason).catch(err => {
      console.error("Error notifying managers of ticket decline:", err);
    });

    return { status: "success" };
  } catch (error) {
    console.error("Error declining ticket:", error);
    return { status: "error", message: error.message };
  }
}

async function notifyManagersOfTicketDecline(ticketId, reason) {
  try {
    const managersRes = await fetchManagersAndAdminsApi();
    if (managersRes.status === "success" && Array.isArray(managersRes.data)) {
      const myName = localStorage.getItem("name") || "الفني";
      for (const mgr of managersRes.data) {
        if (mgr.id) {
          createNotification(mgr.id, {
            type: "declined",
            message: `اعتذر الفني (${myName}) عن التذكرة وأعادها لقائمة الانتظار: ${reason}`,
            ticketId
          });
        }
      }
    }
  } catch (err) {
    console.warn("Could not notify managers of decline:", err);
  }
}
