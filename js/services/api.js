// استيراد رابط السيرفر من ملف الإعدادات
import { GOOGLE_SCRIPT_URL } from '../config.js';

// إعداد وقت انتظار أقصى للطلب (مثلاً 15 ثانية) لتجنب تعليق واجهة المستخدم
const TIMEOUT_MS = 15000;

/**
 * دالة عامة ومعالجة أخطاء مركزية لإرسال طلبات POST
 * تم تحسينها لدعم الـ PWA عبر فحص الاتصال وإدارة وقت الانتظار (Timeout)
 * @param {Object} payload - البيانات المراد إرسالها
 * @returns {Promise<Object>} - الاستجابة بصيغة JSON متناسقة
 */
export async function apiRequest(payload) {
  // 1. الفحص الاستباقي لحالة الاتصال
  if (!navigator.onLine) {
    console.warn("[API] Offline mode detected.");
    return {
      status: "error",
      message: "أنت حالياً غير متصل بالإنترنت. يرجى التحقق من الشبكة والمحاولة لاحقاً."
    };
  }

  // 2. إعداد أداة التحكم لإلغاء الطلب في حال تأخر الخادم
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain" // لتفادي مشاكل Pre-flight CORS مع Google Apps Script
      },
      body: JSON.stringify(payload),
      signal: controller.signal // ربط الطلب بأداة الإلغاء
    });

    clearTimeout(timeoutId); // إلغاء المؤقت إذا نجحت الاستجابة قبل 15 ثانية
    const textResponse = await response.text();
    
    try {
      return JSON.parse(textResponse);
    } catch (parseError) {
      console.error("[API] Non-JSON Response:", textResponse);
      return {
        status: "error",
        message: "استجابة غير صالحة من الخادم."
      };
    }
  } catch (error) {
    clearTimeout(timeoutId); // التأكد من تنظيف المؤقت في حالة الخطأ
    
    // 3. معالجة خطأ انتهاء الوقت المخصص (Timeout)
    if (error.name === 'AbortError') {
      console.error("[API] Request Timeout");
      return {
        status: "error",
        message: "استغرق الخادم وقتاً طويلاً للاستجابة. يرجى التحقق من جودة الاتصال والمحاولة مرة أخرى."
      };
    }

    console.error("[API] Request Error:", error);
    return {
      status: "error",
      message: "تعذر الاتصال بالخادم، يرجى التحقق من اتصال الإنترنت."
    };
  }
}

/* ==========================================================================
   دوال التعامل مع المستخدمين والحسابات
   ========================================================================== */

/** جلب قائمة المستخدمين */
export async function fetchUsers() {
  return await apiRequest({ action: "getUsers" });
}

/** تسجيل مستخدم جديد */
export async function registerUserApi(userData) {
  return await apiRequest({
    action: "register",
    ...userData
  });
}

/** تحديث صلاحيات وأدوار المستخدمين */
export async function updatePermissionsApi(phone, role, permissions) {
  return await apiRequest({
    action: "updatePermissions",
    phone,
    role,
    permissions
  });
}

/* ==========================================================================
   دوال الأعطال والعيوب (Maintenance & Defects)
   ========================================================================== */

/** حفظ بلاغ عطل أو عيب جودة جديد */
export async function saveDefectApi(payload) {
  return await apiRequest({
    action: "saveDefect",
    ...payload
  });
}

/** جلب بيانات لوحة المتابعة الإحصائية */
export async function fetchDashboardDataApi() {
  return await apiRequest({ action: "getDashboardData" });
}

/** جلب قائمة التذاكر/البلاغات */
export async function fetchTicketsApi(filters = {}) {
  return await apiRequest({
    action: "getTickets",
    ...filters
  });
}

/** تحديث حالة تذكرة عطل */
export async function updateTicketStatusApi(ticketId, status, notes = "") {
  return await apiRequest({
    action: "updateTicketStatus",
    ticketId,
    status,
    notes
  });
}
