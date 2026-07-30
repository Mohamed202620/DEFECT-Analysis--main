// 1. استيراد الإعدادات والترجمات
import { GOOGLE_SCRIPT_URL, translations } from './config.js';

// 2. استيراد الواجهات من مجلد views الفرعي
import { HomeView } from './views/homeView.js';
import { PMView } from './views/pmView.js';
import { ReportView } from './views/reportView.js';
import { ReportsView } from './views/reportsView.js';
import { SuggestionView } from './views/suggestionView.js';
import { RegisterView } from './views/registerView.js';

// 3. استيراد دوال العمليات المساعدة (Workflow)
import { saveDefectData, handleDefectFile } from './workflow.js';

// --- تعريف المتغيرات العامة للنظام (Global State) ---
export let currentPage = 'login';
export let currentLang = 'ar';
export let currentRole = '';
export let mainChart = null;
export let statsChart = null;

// مزامنة حالة اللغة والداتا على window فوراً
window.currentLang = currentLang;
window.dashboardData = window.dashboardData || { open: 0, closed: 0, today: 0, total: 0 };

// --- الدوال الأساسية للتنقل واللغة ---

export function navigateTo(page) {
  if (page === "users" && currentRole !== "admin") {
    alert("ليس لديك صلاحية الوصول لهذه الصفحة");
    return;
  }
  currentPage = page;
  
  if (page === "home" && typeof window.loadDashboard === 'function') {
    window.loadDashboard();
  }
  
  render();
  window.scrollTo(0, 0);
}

export function toggleLanguage() {
  currentLang = currentLang === 'ar' ? 'en' : 'ar';
  window.currentLang = currentLang; // تحديث الحالة العامة
  
  const htmlTag = document.getElementById('html-tag');
  if (htmlTag) {
    htmlTag.dir = translations[currentLang].dir;
    htmlTag.lang = currentLang;
  }
  render();
}

export function toggleDarkMode() {
  document.body.classList.toggle('light-mode');
}

export function logout() {
  localStorage.removeItem("phone");
  localStorage.removeItem("name");
  localStorage.removeItem("job");
  localStorage.removeItem("role");
  localStorage.removeItem("user");
  currentRole = '';
  currentPage = "login";
  render();
}

export function contactSupport() {
  const name = localStorage.getItem("name") || "";
  const job = localStorage.getItem("job") || "";
  const message = `السلام عليكم،\nأرغب في التواصل بخصوص نظام الصيانة وتحليل العيوب.\n\nالاسم: ${name}\nالوظيفة: ${job}`;
  window.open(`https://wa.me/201067988554?text=${encodeURIComponent(message)}`, "_blank");
}

// --- دالة العرض الرئيسية (Render) الشاملة لجميع الأزرار ---
export function render() {
  const app = document.getElementById('app');
  if (!app) return;

  if (currentPage === 'login') {
    app.innerHTML = LoginView();
  } else if (currentPage === 'register') {
    app.innerHTML = RegisterView();
  } else if (currentPage === 'home') {
    app.innerHTML = typeof HomeView === 'function' ? HomeView() : '';
    if (typeof window.initMainChart === 'function') window.initMainChart();
  } else if (currentPage === 'report') {
    app.innerHTML = typeof ReportView === 'function' ? ReportView() : '';
  } else if (currentPage === 'pm') {
    app.innerHTML = typeof PMView === 'function' ? PMView() : '';
  } else if (currentPage === 'defect') {
    app.innerHTML = typeof DefectView === 'function' ? DefectView() : '';
  } else if (currentPage === 'reports') {
    app.innerHTML = typeof ReportsView === 'function' ? ReportsView() : '';
  } else if (currentPage === 'suggestion') {
    app.innerHTML = typeof SuggestionView === 'function' ? SuggestionView() : '';
  } else if (currentPage === 'log') {
    app.innerHTML = PageView('📋 سجل الصيانة والبلاغات', LogContent());
  } else if (currentPage === 'schedule') {
    app.innerHTML = PageView('📅 جدولة الصيانة', '<div class="bg-[#1E293B] p-6 rounded-xl border border-gray-800 text-center text-xs text-gray-400">📅 لا يوجد خطط صيانة متأخرة للأسبوع الحالي.</div>');
  } else if (currentPage === 'qr') {
    app.innerHTML = PageView('📱 مسح QR الماكينات', '<div class="bg-[#1E293B] p-6 rounded-xl border border-gray-800 text-center"><p class="text-xs text-gray-400 mb-3">وجه الكاميرا نحو رمز QR الماكينة</p><input type="file" accept="image/*" capture="camera" class="w-full text-xs"></div>');
  } else if (currentPage === 'ai') {
    app.innerHTML = PageView('🤖 فحص العيوب بـ AI', '<div class="bg-[#1E293B] p-6 rounded-xl border border-gray-800 text-center"><p class="text-xs text-gray-400 mb-3">ارفع صورة المنتجات لفحصها تلقائياً</p><input type="file" class="w-full text-xs mb-3"><button onclick="alert(\'جاري الفحص... العيب المكتشف: خدش دهان (دقة 94%)\')" class="w-full p-2.5 bg-blue-600 rounded-lg font-bold text-xs text-white">ابدأ الفحص 🚀</button></div>');
  } else if (currentPage === 'stats') {
    app.innerHTML = PageView('📊 الإحصائيات وتحليل الأعطال', '<div class="bg-[#1E293B] p-4 rounded-xl border border-gray-800"><div style="height: 220px;"><canvas id="statsChart"></canvas></div></div>');
    if (typeof window.initStatsChart === 'function') window.initStatsChart();
  } else if (currentPage === 'kb') {
    app.innerHTML = PageView('📚 قاعدة المعرفة للحلول', '<input placeholder="🔍 ابحث عن العيب أو طريقة الإصلاح..." class="w-full p-2.5 rounded-lg bg-[#1E293B] border border-gray-700 text-xs mb-3 text-white">');
  } else if (currentPage === 'users') {
    app.innerHTML = PageView("👥 إدارة المستخدمين والصلاحيات", `<div class="p-4 text-center text-gray-400">قسم إدارة المستخدمين</div>`);
  }
}

// --- واجهات مكملة ومساعدة داخلية ---
const PageView = (title, content) => `
  <div class="p-4 max-w-md mx-auto">
    <button onclick="window.navigateTo('home')" class="mb-4 bg-gray-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold">⬅️ ${currentLang === 'ar' ? 'رجوع للرئيسية' : 'Back Home'}</button>
    <h2 class="text-base font-bold mb-4 text-blue-400">${title}</h2>
    ${content}
  </div>
`;

const LogContent = () => `
  <div class="overflow-x-auto rounded-xl border border-gray-800">
    <table class="w-full text-xs text-right text-white">
      <tr class="bg-[#1E293B] opacity-70 border-b border-gray-800"><th class="p-2.5">الكود</th><th class="p-2.5">المعدة</th><th class="p-2.5">الحالة</th></tr>
      <tr class="border-b border-gray-800/50"><td class="p-2.5 font-mono">#1024</td><td class="p-2.5">ماكينة 2</td><td class="p-2.5 text-orange-400 font-bold">مفتوح 🟡</td></tr>
      <tr class="border-b border-gray-800/50"><td class="p-2.5 font-mono">#1023</td><td class="p-2.5">خط الدهان 1</td><td class="p-2.5 text-green-400 font-bold">تم الإصلاح 🟢</td></tr>
    </table>
  </div>
`;

const LoginView = () => `
  <div id="loginScreen" class="min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-sm bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6 shadow-2xl space-y-4">
      <div class="flex justify-center mb-2">
        <img src="1000230635.png" alt="Logo" class="w-20 h-20 object-contain rounded-2xl shadow-lg"/>
      </div>
      <h2 class="text-xl font-bold text-center text-blue-400">تسجيل دخول النظام</h2>
      <div>
        <label class="block text-xs font-bold mb-1 opacity-70">رقم الموبايل</label>
        <input id="loginPhone" type="tel" placeholder="رقم الموبايل" class="w-full p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] text-white text-sm focus:outline-none focus:border-blue-500"/>
      </div>
      <div>
        <label class="block text-xs font-bold mb-1 opacity-70">كلمة السر</label>
        <input id="loginPass" type="password" placeholder="كلمة السر" class="w-full p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] text-white text-sm focus:outline-none focus:border-blue-500"/>
      </div>
      <button id="loginBtn" onclick="window.doLogin()" class="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl font-bold text-sm text-white transition shadow-lg">دخول</button>

      <button
          onclick="window.navigateTo('register')"
          class="w-full py-3 mt-3 bg-green-600 hover:bg-green-700 active:scale-95 rounded-xl font-bold text-sm text-white transition shadow-lg">
          ➕ إنشاء حساب جديد
      </button>
    </div>
  </div>
`;

export async function doLogin() {
  const phone = document.getElementById("loginPhone")?.value.trim();
  const pass = document.getElementById("loginPass")?.value.trim();
  const btn = document.getElementById("loginBtn");

  if (!phone || !pass) {
    alert("أدخل رقم الموبايل وكلمة السر");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = "⏳ جاري تسجيل الدخول...";
  }

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "login", phone: phone, password: pass })
    });

    const result = await response.json();

    if (result.status === "success") {
      localStorage.setItem("phone", phone);
      localStorage.setItem("name", result.name);
      localStorage.setItem("job", result.job);
      localStorage.setItem("role", result.role);
      localStorage.setItem("user", JSON.stringify(result));

      currentRole = result.role;
      navigateTo("home");
    } else {
      if (btn) { btn.disabled = false; btn.innerHTML = "دخول"; }
      alert(result.message || "بيانات الدخول غير صحيحة");
    }
  } catch (e) {
    if (btn) { btn.disabled = false; btn.innerHTML = "دخول"; }
    alert("خطأ في الاتصال بالسيرفر");
  }
}

export async function registerUser() {

  const data = {
    action: "register",
    name: document.getElementById("regName").value.trim(),
    phone: document.getElementById("regPhone").value.trim(),
    password: document.getElementById("regPass").value,
    confirmPassword: document.getElementById("regPass2").value,
    job: document.getElementById("regJob").value.trim(),
    department: document.getElementById("regDepartment").value.trim(),
    code: document.getElementById("regCode").value.trim()
  };

  if (
    !data.name ||
    !data.phone ||
    !data.password ||
    !data.confirmPassword ||
    !data.job ||
    !data.department ||
    !data.code
  ) {
    alert("يرجى إدخال جميع البيانات");
    return;
  }

  if (data.password !== data.confirmPassword) {
    alert("كلمتا السر غير متطابقتين");
    return;
  }

  try {

    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain"
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    alert(result.message);

    if (result.status === "success") {
      window.navigateTo("login");
    }

  } catch (e) {

    alert("تعذر الاتصال بالخادم");

  }

}

// --- 4. ربط جميع الدوال بـ Window لضمان استجابة الأحداث ---
window.navigateTo = navigateTo;
window.toggleLanguage = toggleLanguage;
window.toggleDarkMode = toggleDarkMode;
window.doLogin = doLogin;
window.registerUser = registerUser;
window.logout = logout;
window.contactSupport = contactSupport;
window.saveDefectData = saveDefectData;
window.handleDefectFile = handleDefectFile;
window.render = render;

// --- 5. التشغيل عند جاهزية الصفحة ---
window.addEventListener('DOMContentLoaded', () => {
  const phone = localStorage.getItem("phone");
  const savedUser = localStorage.getItem('user');

  if (savedUser) {
    try {
      const user = JSON.parse(savedUser);
      if (user && user.role) currentRole = user.role;
    } catch(e) {}
  }

  if (phone || savedUser) {
    currentPage = 'home';
  } else {
    currentPage = 'login';
  }

  render();

  setTimeout(() => {
    const splash = document.getElementById('splash');
    if (splash) {
      splash.style.opacity = '0';
      setTimeout(() => { splash.style.display = 'none'; }, 700);
    }
  }, 800);
});