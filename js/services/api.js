// استيراد رابط السيرفر من ملف الإعدادات
import { GOOGLE_SCRIPT_URL } from '../config.js';

/**
 * دالة عامة ومعالجة أخطاء مركزية لإرسال طلبات POST
 * @param {Object} payload - البيانات المراد إرسالها
 * @returns {Promise<Object>} - الاستجابة بصيغة JSON متناسقة
 */
export async function apiRequest(payload) {
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain" // لتفادي مشاكل Pre-flight CORS مع Google Apps Script
      },
      body: JSON.stringify(payload)
    });

    const textResponse = await response.text();
    
    try {
      return JSON.parse(textResponse);
    } catch (parseError) {
      console.error("API Non-JSON Response:", textResponse);
      return {
        status: "error",
        message: "استجابة غير صالحة من الخادم."
      };
    }
  } catch (error) {
    console.error("API Request Error:", error);
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
