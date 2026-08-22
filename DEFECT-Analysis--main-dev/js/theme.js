// ============================================================
// theme.js
// تفعيل الوضع الليلي/النهاري (Dark/Light Mode)
// (تم استخراجه من router.js دون أي تغيير في السلوك)
// ============================================================

const savedTheme = localStorage.getItem("theme") || "dark";

if (savedTheme === "dark") {
  document.documentElement.classList.add("dark");
} else {
  document.documentElement.classList.remove("dark");
}

window.toggleDarkMode = function () {
  const isDark = document.documentElement.classList.toggle("dark");
  localStorage.setItem("theme", isDark ? "dark" : "light");
};
