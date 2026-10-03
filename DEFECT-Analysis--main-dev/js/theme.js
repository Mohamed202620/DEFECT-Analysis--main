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

  // إعادة رسم appHeader فوراً بعد تبديل الثيم - عشان أيقونة
  // الشمس/القمر جوّاه (☀️/🌙) تتحدّث في نفس اللحظة بدل ما تفضل واقفة
  // على الحالة القديمة لحد أول render() تاني (الهيدر نفسه بقى
  // صناعي داكن ثابت دايماً، لكن الأيقونة بتعكس حالة باقي التطبيق)
  if (typeof window.refreshHeader === "function") {
    window.refreshHeader();
  }
};
