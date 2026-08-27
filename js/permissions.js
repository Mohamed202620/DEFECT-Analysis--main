// ============================================================
// permissions.js
// نظام الصلاحيات الموحد
// ============================================================

import { translations } from './config.js';

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
    .toLowerCase();

let currentPermissions =
  (localStorage.getItem("permissions") || "")
    .split(",")
    .map(p => p.trim().toLowerCase())
    .filter(Boolean);

// ============================================================
// قراءة/تحديث الحالة
// ============================================================

export function getCurrentRole() {
  return currentRole;
}

export function getCurrentPermissions() {
  return currentPermissions;
}

export function setCurrentRole(role) {
  currentRole = role;
}

export function setCurrentPermissions(permissions) {
  currentPermissions = permissions;
}

// ============================================================
// التحقق من الصلاحية
// ============================================================

export function hasPermission(permission) {

  const perm =
    String(permission || "")
      .trim()
      .toLowerCase();

  if (!perm) return false;

  // Admin لديه جميع الصلاحيات
  if (currentRole === "admin") {
    return true;
  }

  // all = جميع الصلاحيات
  if (currentPermissions.includes("all")) {
    return true;
  }

  return currentPermissions.includes(perm);
}

window.hasPermission = hasPermission;
window.can = hasPermission;

// ============================================================
// نطاق الوصول الكامل للبيانات (Full Data Access)
// تستخدمها أي شاشة محتاجة تفرّق بين "يشوف كل البيانات" و"يشوف
// بياناته المسموح له بيها بس" (زي صفحة البحث والفلترة المتقدمة)
// بدل تكرار قائمة الأدوار في كل مكان. admin/manager نفس الدورين
// المعتمدين فعلاً في باقي الشاشات (tickets/suggestions)، + engineer
// هنا تحديداً لأن صفحة البحث والفلترة المتقدمة مطلوب يشوف بيها
// المهندس كل البيانات المسموح له بيها زي الأدمن تماماً - أي دور
// تاني (فني/مشرف/عامل...) يعتبر "وصول محدود" (بياناته هو بس)
// ============================================================
export function hasFullDataAccess(role = currentRole) {
  return role === "admin" || role === "manager" || role === "engineer";
}

window.hasFullDataAccess = hasFullDataAccess;

// ============================================================
// أزرار دورة حياة التذكرة (Ticket Lifecycle Actions)
// ============================================================

export function getTicketActions(ticket) {

  const role = currentRole;
  const myName = localStorage.getItem("name") || "";
  const myUid = localStorage.getItem("userId") || "";
  const status = String(ticket?.status || "").trim().toLowerCase();

  const actions = [];

  // التحقق من قرابة المستخدم بالبلاغ (فني مُسند إليه أم مُبلغ)
  const isAssignee =
    role === "admin" ||
    ticket.assignedToUid === myUid ||
    (!!myName && ticket.assignedTo === myName);

  const isReporter =
    role === "admin" ||
    ticket.reportedByUid === myUid ||
    (!!myName && ticket.reportedBy === myName);

  switch (status) {

    case "pending":
      // تصنيف وإسناد البلاغ للمدير أو الأدمن
      if (role === "manager" || role === "admin") {
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
// نفس فكرة getTicketActions بالضبط، لكن الدور الإداري المعتمد هنا
// هو "admin" فقط (لا PM ولا manager) - راجع kaizenBoard.js
// ============================================================

export function getSuggestionActions(suggestion) {

  const role = currentRole;
  const myUid = localStorage.getItem("userId") || "";
  const myName = localStorage.getItem("name") || "";
  const status = String(suggestion?.status || "new").trim().toLowerCase();

  const isAdmin = role === "admin";
  const isAssignedTechnician = !!myUid && suggestion?.assignedToUid === myUid;

  // ملكية المقترح - المرجع الأساسي هو submittedByUid (نفس منطق
  // isReporter/isAssignee في getTicketActions أعلاه). لكن على عكس
  // التذاكر، مقترحات الكايزن كانت بتتحقق من submittedByUid لوحده من
  // غير أي احتياطي - فأي مقترح قديم اتسجل قبل إضافة هذا الحقل (أو
  // اتسجل وهو فاضي لأي سبب) كان بيفقد صاحبه القدرة على "تعديل وإعادة
  // الإرسال" نهائياً، وبيفقد أي إشعار متعلق بيه (راجع
  // createSuggestionNotification في suggestionsApi.js اللي بيتجاهل
  // الإرسال أصلاً لو submittedByUid فاضي). الاحتياطي بالاسم هنا بيتفعّل
  // فقط لما الحقل يكون فاضي/مش موجود - لو موجود بيتم الاعتماد عليه
  // حصرياً زي ما كان (بدون أي تراجع في الدقة للمقترحات الحديثة)
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
