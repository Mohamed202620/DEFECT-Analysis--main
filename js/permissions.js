// ============================================================
// permissions.js
// نظام الصلاحيات الموحد
// ============================================================

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
        actions.push({ key: "assign", label: "🛠️ تصنيف وإسناد" });
      }
      break;

    case "assigned":
      // الفني المُسند إليه يظهر له زر بدء التنفيذ، وزر تم الإصلاح مباشرة للتسهيل
      if (isAssignee) {
        actions.push({ key: "start", label: "▶️ بدء التنفيذ" });
        actions.push({ key: "resolve", label: "✅ تم الإصلاح" });
      }
      break;

    case "in_progress":
    case "reopened":
      // الفني المُسند إليه فقط يقدر ينهي المعالجة ويحوله لـ resolved
      if (isAssignee) {
        actions.push({ key: "resolve", label: "✅ تم الإصلاح" });
      }
      break;

    case "resolved":
      // المُبلّغ (أو الأدمن) يراجع العمل ويأكد الإغلاق أو يرفض مع السبب
      if (isReporter) {
        actions.push({ key: "confirm", label: "✔️ تأكيد الإغلاق" });
        actions.push({ key: "reject", label: "❌ رفض ورجوع للفني" });
      }
      break;

    // "closed" حالة نهائية - لا تحتوي على أزرار تغيير حالة
  }

  // زر التفاصيل متاح دائماً لمعاينة السجل والصور
  actions.push({ key: "details", label: "🔍 تفاصيل" });

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
  const status = String(suggestion?.status || "new").trim().toLowerCase();

  const isAdmin = role === "admin";
  const isAssignedTechnician = !!myUid && suggestion?.assignedToUid === myUid;

  const actions = [];

  switch (status) {

    case "new":
      // بدء المراجعة أو الرفض المباشر - أدمن فقط
      if (isAdmin) {
        actions.push({ key: "review", label: "🔍 بدء المراجعة" });
        actions.push({ key: "reject", label: "❌ رفض" });
      }
      break;

    case "under_review":
      // موافقة وإسناد لفني، أو طلب تعديل، أو رفض - أدمن فقط
      if (isAdmin) {
        actions.push({ key: "approve_assign", label: "✅ موافقة وإسناد" });
        actions.push({ key: "request_revision", label: "✏️ طلب تعديل" });
        actions.push({ key: "reject", label: "❌ رفض" });
      }
      break;

    case "revision_requested":
      // إعادة المقترح لقيد المراجعة بعد التعديل - أدمن فقط
      if (isAdmin) {
        actions.push({ key: "return_to_review", label: "↩️ إعادة للمراجعة" });
      }
      break;

    case "in_progress":
      // تسجيل اكتمال التنفيذ - الفني المسؤول المُسند إليه، أو الأدمن
      if (isAdmin || isAssignedTechnician) {
        actions.push({ key: "implement", label: "🏁 تم التنفيذ" });
      }
      break;

    // "rejected" / "implemented" حالتان نهائيتان - لا أزرار تغيير حالة
  }

  // زر التفاصيل متاح دائماً
  actions.push({ key: "details", label: "🔍 تفاصيل" });

  return actions;

}

window.getSuggestionActions = getSuggestionActions;
