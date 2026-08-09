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
