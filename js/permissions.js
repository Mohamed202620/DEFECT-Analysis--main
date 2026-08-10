// ============================================================
// permissions.js
// نظام الصلاحيات الموحد
// (تم استخراجه من router.js دون أي تغيير في السلوك - نفس
// المتغيرات ونفس منطق hasPermission تماماً)
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
// قراءة/تحديث الحالة (من أجل authHandlers.js عند تسجيل
// الدخول/الخروج، بما أن currentRole/currentPermissions أصبحا
// الآن داخل هذا الموديول فقط)
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
//
// دالة واحدة مركزية بتقرر "مين يقدر يعمل إيه" حسب حالة التذكرة
// ودور المستخدم الحالي - تُستخدم في ticketsBoard.js لعرض الأزرار
// الصحيحة فقط لكل تذكرة.
// ============================================================

export function getTicketActions(ticket) {

  const role = currentRole;
  const myUid = localStorage.getItem("userId") || "";
  const status = String(ticket?.status || "").trim().toLowerCase();

  const actions = [];

  switch (status) {

    case "pending":
      if (role === "manager" || role === "admin") {
        actions.push({ key: "assign", label: "🛠️ تصنيف وإسناد" });
      }
      break;

    case "assigned":
      if (
        (role === "technician" || role === "engineer" || role === "admin") &&
        (role === "admin" || ticket.assignedToUid === myUid)
      ) {
        actions.push({ key: "start", label: "▶️ بدء التنفيذ" });
      }
      break;

    case "in_progress":
      if (
        (role === "technician" || role === "engineer" || role === "admin") &&
        (role === "admin" || ticket.assignedToUid === myUid)
      ) {
        actions.push({ key: "complete", label: "✅ تم الإصلاح" });
      }
      break;

    case "awaiting_confirmation":
      if (
        (role === "operator" || role === "admin") &&
        (role === "admin" || ticket.reportedByUid === myUid)
      ) {
        actions.push({ key: "confirm", label: "✔️ تم الإصلاح بالفعل" });
        actions.push({ key: "reject", label: "❌ لم يتم الإصلاح" });
      }
      break;

    // "closed" حالة نهائية - بدون أزرار
  }

  return actions;

}

window.getTicketActions = getTicketActions;
