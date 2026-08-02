// 1. استيراد الإعدادات والترجمات والخدمات
import { GOOGLE_SCRIPT_URL, translations } from './config.js';
import { login } from './auth/login.js';

// 2. استيراد الواجهات من مجلد views الفرعي
import { HomeView } from './views/homeView.js';
import { PMView } from './views/pmView.js';
import { ReportView } from './views/reportView.js';
import { ReportsView } from './views/reportsView.js';
import { SuggestionView } from './views/suggestionView.js';
import { RegisterView } from './views/registerView.js';
import { IssueView } from './views/issueView.js';
import { MaintenanceView } from './views/MaintenanceView.js';
import { QualityView } from './views/QualityView.js';
import { SystemView } from './views/SystemView.js';

// 3. استيراد دوال العمليات المساعدة (Workflow)
import { saveDefectData, handleDefectFile } from './workflow.js';

// --- تعريف المتغيرات العامة للنظام (Global State) ---
export let currentPage = 'login';
export let currentLang = 'ar';
export let currentRole = '';
export let currentPermissions = [];
export let mainChart = null;
export let statsChart = null;

function hasPermission(permission){

    if(currentRole === "admin")
        return true;

    return currentPermissions.includes(permission);

}

// مزامنة حالة اللغة والداتا على window فوراً
window.currentLang = currentLang;
window.dashboardData = window.dashboardData || { open: 0, closed: 0, today: 0, total: 0 };

// --- دالة التوجيه والعرض الخارجية ---
export function renderPage(page, PageView, LogContent, currentLang) {

    if (page === "login") {
        return LoginView();
    }

    if (page === "register") {
        return RegisterView();
    }

    if (page === "home") {
        return HomeView();
    }

    if (page === "maintenance") {
        return MaintenanceView();
    }

    if (page === "quality") {
        return QualityView();
    }

    if (page === "system") {
        return SystemView();
    }

    if (page === "report") {
        return ReportView();
    }

    if (page === "pm") {
        return PMView();
    }

    if (page === "reports") {
        return ReportsView();
    }

    if (page === "suggestion" || page === "suggestions") {
        return SuggestionView();
    }

    if (page === "log") {
        return PageView("📋 سجل الصيانة", LogContent());
    }

    return "";
}

// --- الدوال الأساسية للتنقل واللغة ---

export function navigateTo(page) {

  if (page === "users" && !hasPermission("users")) {
    alert("ليس لديك صلاحية إدارة المستخدمين");
    return;
  }

  if (page === "reports" && !hasPermission("reports")) {
    alert("ليس لديك صلاحية عرض التقارير");
    return;
  }

  if (page === "pm" && !hasPermission("pm")) {
    alert("ليس لديك صلاحية تسجيل الصيانة");
    return;
  }

  if (page === "stats" && !hasPermission("stats")) {
    alert("ليس لديك صلاحية عرض الإحصائيات");
    return;
  }

  currentPage = page;

  if (page === "home" && typeof window.loadDashboard === "function") {
    window.loadDashboard();
  }

  render();
  window.scrollTo(0,0);

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
  // تبديل الكلاس dark في الـ body والـ html
  const isDark = document.body.classList.toggle('dark');
  document.documentElement.classList.toggle('dark', isDark);
  
  // حفظ الحالة
  localStorage.setItem('theme', isDark ? 'dark' : 'light');

  // تحديث سمات الألوان المباشرة للعناصر النشطة حالياً بدون إعادة تحميل الصفحة بالكامل
  if (isDark) {
    document.body.style.setProperty('--app-main-bg', '#0f172a');
  } else {
    document.body.style.setProperty('--app-main-bg', '#f3f4f6');
  }
}
export function logout() {
  localStorage.removeItem("phone");
  localStorage.removeItem("name");
  localStorage.removeItem("job");
  localStorage.removeItem("role");
  localStorage.removeItem("permissions");
  localStorage.removeItem("user");
  currentRole = '';
  currentPermissions = [];
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

  // استدعاء renderPage لصفحات النظام المحددة
  const pageHtml = renderPage(currentPage, PageView, LogContent, currentLang);

  if (pageHtml) {
    app.innerHTML = pageHtml;
    if (currentPage === 'home' && typeof window.initMainChart === 'function') {
      window.initMainChart();
    }
  } else if (currentPage === 'suggestions' || currentPage === 'suggestion') {
    app.innerHTML = SuggestionView();
  } else if (currentPage === 'issue') {
    app.innerHTML = IssueView();
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
    app.innerHTML = PageView(
        "👥 إدارة المستخدمين والصلاحيات",
        `
        <div class="space-y-3">
        <button
        onclick="window.loadUsers()"
        class="w-full bg-blue-600 rounded-lg p-3 font-bold">
        عرض المستخدمين
        </button>
        <div id="usersContainer"></div>
        </div>
        `
    );
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
    const result = await login(phone, pass);
    
    if (result.status === "success") {
      localStorage.setItem("phone", phone);
      localStorage.setItem("name", result.name);
      localStorage.setItem("job", result.job);
      localStorage.setItem("role", (result.role || "").toLowerCase());
      localStorage.setItem("permissions", result.permissions || "");
      localStorage.setItem("user", JSON.stringify(result));

      currentRole = (result.role || "").toLowerCase();
      currentPermissions = (result.permissions || "")
          .split(",")
          .map(p => p.trim().toLowerCase())
          .filter(p => p !== "");

      navigateTo("home");
    } else {
      if (btn) { btn.disabled = false; btn.innerHTML = "دخول"; }
      alert(result.message || "بيانات الدخول غير صحيحة");
    }
  } catch (e) {
    if (btn) { btn.disabled = false; btn.innerHTML = "خطأ في الاتصال بالسيرفر"; }
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

window.can = function(permission){

    if(currentRole === "admin")
        return true;

    return currentPermissions.includes(permission);

}

window.loadUsers = async function () {

    const res = await fetch(GOOGLE_SCRIPT_URL,{
        method:"POST",
        headers:{
            "Content-Type":"text/plain"
        },
        body:JSON.stringify({
            action:"getUsers"
        })
    });

    const data = await res.json();

    if(data.status!="success") return;

    let html="";

    data.users.forEach(u=>{

        html+=`
        <div class="bg-[#1E293B] rounded-xl p-3 mb-3">

            <div><b>${u.name}</b></div>

            <div>${u.phone}</div>

            <div>${u.role}</div>

            <button
            class="mt-3 w-full bg-green-600 p-2 rounded"
            onclick="window.editPermissions('${u.phone}','${u.role}')">

            تعديل الصلاحيات

            </button>

        </div>
        `;

    });

    document.getElementById("usersContainer").innerHTML=html;

}

window.editPermissions = async function(phone,currentRole){

    const role = prompt(
        "أدخل الدور الجديد:\nadmin\nengineer\ntech",
        currentRole
    );

    if(!role) return;

    const permissions = prompt(
        "أدخل الصلاحيات\nمثال:\nall\nأو\nreports,pm,users",
        "all"
    );

    if(permissions===null) return;

    const res = await fetch(GOOGLE_SCRIPT_URL,{
        method:"POST",
        headers:{
            "Content-Type":"text/plain"
        },
        body:JSON.stringify({
            action:"updatePermissions",
            phone:phone,
            role:role.toLowerCase(),
            permissions:permissions
        })
    });

    const data = await res.json();

    alert(data.message);

    if(data.status=="success"){
        window.loadUsers();
    }

}

window.saveIssue = function () {
    alert("الخطوة القادمة: ربط البلاغ بـ Google Sheets");
}

document.addEventListener("change", function (e) {

    if (e.target.id === "cameraImage" || e.target.id === "galleryImage") {

        const file = e.target.files[0];

        if (!file) return;

        document.getElementById("imageName").innerHTML = file.name;

        const reader = new FileReader();

        reader.onload = function () {

            const img = document.getElementById("previewImage");

            img.src = reader.result;

            img.classList.remove("hidden");

        };

        reader.readAsDataURL(file);

    }

});

// --- 5. التشغيل عند جاهزية الصفحة ---
window.addEventListener('DOMContentLoaded', () => {
  const phone = localStorage.getItem("phone");
  const savedUser = localStorage.getItem('user');

  if (savedUser) {
    try {
      const user = JSON.parse(savedUser);
      if (user && user.role) currentRole = (user.role || "").toLowerCase();
      if (user && user.permissions) {
        currentPermissions = (user.permissions || "")
            .split(",")
            .map(p => p.trim().toLowerCase())
            .filter(p => p !== "");
      }
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
