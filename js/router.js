// ============================================================
// GLOBAL STATE & THEME INITIALIZATION
// ============================================================

export let currentPage = 'login';

export let currentLang = 'ar';

export let currentRole =
  (localStorage.getItem("role") || "")
    .toLowerCase();

export let currentPermissions =
  (localStorage.getItem("permissions") || "")
    .split(",")
    .map(p => p.trim().toLowerCase())
    .filter(Boolean);

window.currentLang = currentLang;

// تفعيل الدارك مود تلقائياً عند بدء التشغيل
const savedTheme = localStorage.getItem("theme") || "dark";
if (savedTheme === "dark") {
  document.documentElement.classList.add("dark");
} else {
  document.documentElement.classList.remove("dark");
}

window.toggleDarkMode = function() {
  const isDark = document.documentElement.classList.toggle("dark");
  localStorage.setItem("theme", isDark ? "dark" : "light");
};


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


window.hasPermission =
  hasPermission;

window.can =
  hasPermission;
