// ============================================================
// permissions.js
// نظام الصلاحيات الموحد
// ============================================================

import { translations, ALL_PERMISSIONS } from './config.js';

// إصلاح (ترجمة شاملة): تسميات أزرار دورة حياة البلاغ/المقترح كانت
// ثابتة بالعربي - دلوقتي بتقرأ من translations.ticketActions /
// translations.suggestionActions حسب window.currentLang وقت كل
// استدعاء (البلاغات/المقترحات بتتعاد رسمها باستمرار Real-time)
function ta() {
  const currentLang = window.currentLang || "ar";
  return (translations[currentLang] || translations.ar).ticketActions;
}

function sa() {
  const currentLang = window.currentLang || "ar";
  return (translations[currentLang] || translations.ar).suggestionActions;
}

let currentRole =
  (localStorage.getItem("role") || "")
    .trim()
    .toLowerCase();

let currentPermissions =
  (localStorage.getItem("permissions") || "")
    .split(",")
    .map(p => p.trim().toLowerCase())
    .filter(Boolean);

// دالة مساعدة لمعرفة هل الدور هو أدمن/مدير نظام
export function isAdminRole(role) {
  const r = String(role || "").trim().toLowerCase();
  return (
    r === "admin" ||
    r === "superadmin" ||
    r === "administrator" ||
    r === "مدير النظام" ||
    r === "مدير نظام" ||
    r === "مدير" ||
    r === "ادمن" ||
    r === "مسؤول"
  );
}

window.isAdminRole = isAdminRole;

// ============================================================
// قراءة/تحديث الحالة
// ============================================================

export function getCurrentRole() {
  let role = (localStorage.getItem("role") || currentRole || "").trim().toLowerCase();
  if (!role) {
    try {
      const cu = JSON.parse(localStorage.getItem("currentUser") || "{}");
      role = (cu.role || "").trim().toLowerCase();
    } catch {
      // ignore
    }
  }
  return role || "user";
}

export function getCurrentPermissions() {
  const role = getCurrentRole();
  if (isAdminRole(role)) {
    return ALL_PERMISSIONS;
  }
  const perms = (localStorage.getItem("permissions") || "")
    .split(",")
    .map(p => p.trim().toLowerCase())
    .filter(Boolean);
  return perms.length > 0 ? perms : currentPermissions;
}

export function setCurrentRole(role) {
  currentRole = String(role || "").trim().toLowerCase();
  localStorage.setItem("role", currentRole);
}

export function setCurrentPermissions(permissions) {
  if (Array.isArray(permissions)) {
    currentPermissions = permissions.map(p => String(p).trim().toLowerCase()).filter(Boolean);
    localStorage.setItem("permissions", currentPermissions.join(","));
  } else if (typeof permissions === "string") {
    currentPermissions = permissions.split(",").map(p => p.trim().toLowerCase()).filter(Boolean);
    localStorage.setItem("permissions", permissions);
  }
}

// ============================================================
// التحقق من الصلاحية
// ============================================================

export function hasPermission(permission) {
  const perm = String(permission || "")
    .trim()
    .toLowerCase();

  if (!perm) return false;

  // استخراج الدور الحالي ديناميكياً للتأكد من أحدث حالة
  const role = getCurrentRole();

  // Admin لديه جميع الصلاحيات دائماً وأبداً وبلا أي قيود
  if (isAdminRole(role)) {
    return true;
  }

  // قراءة الصلاحيات الحالية المحدثة
  const storedPerms = (localStorage.getItem("permissions") || "")
    .split(",")
    .map(p => p.trim().toLowerCase())
    .filter(Boolean);

  // all أو admin = جميع الصلاحيات
  if (
    storedPerms.includes("all") ||
    storedPerms.includes("admin") ||
    currentPermissions.includes("all") ||
    currentPermissions.includes("admin")
  ) {
    return true;
  }

  return storedPerms.includes(perm) || currentPermissions.includes(perm);
}

window.hasPermission = hasPermission;
window.can = hasPermission;

// ============================================================
// نطاق الوصول الكامل للبيانات (Full Data Access)
// تستخدمها أي شاشة محتاجة تفرّق بين "يشوف كل البيانات" و"يشوف
// بياناته المسموح له بيها بس" (زي صفحة البحث والفلترة المتقدمة)
// ============================================================
export function hasFullDataAccess(role = getCurrentRole()) {
  const r = String(role || getCurrentRole()).trim().toLowerCase();
  return (
    isAdminRole(r) ||
    r === "manager" ||
    r === "engineer"
  );
}

window.hasFullDataAccess = hasFullDataAccess;

// ============================================================
// أزرار دورة حياة التذكرة (Ticket Lifecycle Actions)
// ============================================================

export function getTicketActions(ticket) {

  const role = getCurrentRole();
  const isAdmin = isAdminRole(role);
  const myName = localStorage.getItem("name") || "";
  const myUid = localStorage.getItem("userId") || "";
  const status = String(ticket?.status || "").trim().toLowerCase();

  const actions = [];

  // التحقق من قرابة المستخدم بالبلاغ (فني مُسند إليه أم مُبلغ)
  const isAssignee =
    isAdmin ||
    ticket.assignedToUid === myUid ||
    (!!myName && ticket.assignedTo === myName);

  const isReporter =
    isAdmin ||
    ticket.reportedByUid === myUid ||
    (!!myName && ticket.reportedBy === myName);

  switch (status) {

    case "pending":
      // تصنيف وإسناد البلاغ للمدير أو الأدمن
      if (role === "manager" || isAdmin) {
        actions.push({ key: "assign", label: ta().assign });
      }
      break;

    case "assigned":
      // الفني المُسند إليه يظهر له زر بدء التنفيذ، وزر تم الإصلاح مباشرة للتسهيل
      if (isAssignee) {
        actions.push({ key: "start", label: ta().start });
        actions.push({ key: "resolve", label: ta().resolve });
      }
      break;

    case "in_progress":
    case "reopened":
      // الفني المُسند إليه فقط يقدر ينهي المعالجة ويحوله لـ resolved
      if (isAssignee) {
        actions.push({ key: "resolve", label: ta().resolve });
      }
      break;

    case "resolved":
      // المُبلّغ (أو الأدمن) يراجع العمل ويأكد الإغلاق أو يرفض مع السبب
      if (isReporter) {
        actions.push({ key: "confirm", label: ta().confirm });
        actions.push({ key: "reject", label: ta().reject });
      }
      break;

    // "closed" حالة نهائية - لا تحتوي على أزرار تغيير حالة
  }

  // زر التفاصيل متاح دائماً لمعاينة السجل والصور
  actions.push({ key: "details", label: ta().details });

  return actions;

}

window.getTicketActions = getTicketActions;

// ============================================================
// أزرار دورة حياة مقترح الكايزن (Kaizen Suggestion Lifecycle Actions)
// ============================================================

export function getSuggestionActions(suggestion) {

  const role = getCurrentRole();
  const myUid = localStorage.getItem("userId") || "";
  const myName = localStorage.getItem("name") || "";
  const status = String(suggestion?.status || "new").trim().toLowerCase();

  const isAdmin = isAdminRole(role);
  const isAssignedTechnician = !!myUid && suggestion?.assignedToUid === myUid;

  const isOwner =
    (!!suggestion?.submittedByUid && suggestion.submittedByUid === myUid) ||
    (!suggestion?.submittedByUid && !!myName && suggestion?.name === myName);

  const actions = [];

  switch (status) {

    case "new":
      // بدء المراجعة أو الرفض المباشر - أدمن فقط
      if (isAdmin) {
        actions.push({ key: "review", label: sa().review });
        actions.push({ key: "reject", label: sa().reject });
      }
      break;

    case "under_review":
      // موافقة وإسناد لفني، أو طلب تعديل، أو رفض - أدمن فقط
      if (isAdmin) {
        actions.push({ key: "approve_assign", label: sa().approveAssign });
        actions.push({ key: "request_revision", label: sa().requestRevision });
        actions.push({ key: "reject", label: sa().reject });
      }
      break;

    case "revision_requested":
      // إعادة المقترح لقيد المراجعة بعد التعديل - أدمن فقط (بدون
      // تعديل محتوى)، أو صاحب المقترح نفسه (بعد تعديل المحتوى فعلياً
      // وإعادة الإرسال - "resubmit")
      if (isAdmin) {
        actions.push({ key: "return_to_review", label: sa().returnToReview });
      }
      if (isOwner) {
        actions.push({ key: "resubmit", label: sa().resubmit });
      }
      break;

    case "in_progress":
      // تسجيل اكتمال التنفيذ - الفني المسؤول المُسند إليه، أو الأدمن
      if (isAdmin || isAssignedTechnician) {
        actions.push({ key: "implement", label: sa().implement });
      }
      break;

    // "rejected" / "implemented" حالتان نهائيتان - لا أزرار تغيير حالة
  }

  // زر التفاصيل متاح دائماً
  actions.push({ key: "details", label: sa().details });

  return actions;

}

window.getSuggestionActions = getSuggestionActions;
