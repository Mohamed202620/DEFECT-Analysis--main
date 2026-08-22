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
