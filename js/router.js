// 1. استيراد الإعدادات والترجمات والواجهات (Views)
import { PageView } from './components/PageView.js';
import { LoginView } from './views/loginView.js';
import { translations } from './config.js';
import { login } from './auth/login.js';
import { fetchUsers, updatePermissionsApi, registerUserApi } from './services/api.js';

// استيراد الواجهات من مجلد views الفرعي
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
    if (page === "login") return LoginView();
    if (page === "register") return RegisterView();
    if (page === "home") return HomeView();
    if (page === "maintenance") return MaintenanceView();
    if (page === "quality") return QualityView();
    if (page === "system") return SystemView();
    if (page === "report") return ReportView();
    if (page === "pm") return PMView();
    if (page === "reports") return ReportsView();
    if (page === "suggestion" || page === "suggestions") return SuggestionView();
    if (page === "log") return PageView("📋 سجل الصيانة", LogContent());
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
  window.currentLang = currentLang;
  
  const htmlTag = document.getElementById('html-tag');
  if (htmlTag) {
    htmlTag.dir = translations[currentLang].dir;
    htmlTag.lang = currentLang;
  }
  render();
}

export function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark');
  document.documentElement.classList.toggle('dark', isDark);
  localStorage.setItem('theme', isDark ? 'dark' : 'light');

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
        <button onclick="window.loadUsers()" class="w-full bg-blue-600 rounded-lg p-3 font-bold">عرض المستخدمين</button>
        <div id="usersContainer"></div>
        </div>
        `
    );
  }
}

// --- واجهات مكملة ومساعدة داخلية ---
const LogContent = () => `
  <div class="overflow-x-auto rounded-xl border border-gray-800">
    <table class="w-full text-xs text-right text-white">
      <tr class="bg-[#1E293B] opacity-70 border-b border-gray-800"><th class="p-2.5">الكود</th><th class="p-2.5">المعدة</th><th class="p-2.5">الحالة</th></tr>
      <tr class="border-b border-gray-800/50"><td class="p-2.5 font-mono">#1024</td><td class="p-2.5">ماكينة 2</td><td class="p-2.5 text-orange-400 font-bold">مفتوح 🟡</td></tr>
      <tr class="border-b border-gray-800/50"><td class="p-2.5 font-mono">#1023</td><td class="p-2.5">خط الدهان 1</td><td class="p-2.5 text-green-400 font-bold">تم الإصلاح 🟢</td></tr>
    </table>
  </div>
`; // تم تعديل علامة التنصيص المفردة هنا إلى (Backtick)


// --- دوال العمليات المربطوة بالـ API الخارجي ---
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
    name: document.getElementById("regName").value.trim(),
    phone: document.getElementById("regPhone").value.trim(),
    password: document.getElementById("regPass").value,
    confirmPassword: document.getElementById("regPass2").value,
    job: document.getElementById("regJob").value.trim(),
    department: document.getElementById("regDepartment").value.trim(),
    code: document.getElementById("regCode").value.trim()
  };

  if (!data.name || !data.phone || !data.password || !data.confirmPassword || !data.job || !data.department || !data.code) {
    alert("يرجى إدخال جميع البيانات");
    return;
  }

  if (data.password !== data.confirmPassword) {
    alert("كلمتا السر غير متطابقتين");
    return;
  }

  try {
    const result = await registerUserApi(data);
    alert(result.message);
    if (result.status === "success") {
      window.navigateTo("login");
    }
  } catch (e) {
    alert("تعذر الاتصال بالخادم");
  }
}

// --- 4. ربط الدوال بـ Window لضمان استجابة الأحداث ---
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
    if(currentRole === "admin") return true;
    return currentPermissions.includes(permission);
}

window.loadUsers = async function () {
    const data = await fetchUsers();
    if(data.status !== "success") return;

    let html = "";
    data.users.forEach(u => {
        html += `
        <div class="bg-[#1E293B] rounded-xl p-3 mb-3 text-white text-xs">
            <div><b>${u.name}</b></div>
            <div>${u.phone}</div>
            <div>${u.role}</div>
            <button class="mt-3 w-full bg-green-600 p-2 rounded text-white font-bold" onclick="window.editPermissions('${u.phone}','${u.role}')">
            تعديل الصلاحيات
            </button>
        </div>
        `;
    });

    const container = document.getElementById("usersContainer");
    if (container) container.innerHTML = html;
}

window.editPermissions = async function(phone, currentRoleVal){
    const role = prompt("أدخل الدور الجديد:\nadmin\nengineer\ntech", currentRoleVal);
    if(!role) return;

    const permissions = prompt("أدخل الصلاحيات\nمثال:\nall\nأو\nreports,pm,users", "all");
    if(permissions === null) return;

    const data = await updatePermissionsApi(phone, role.toLowerCase(), permissions);
    alert(data.message);

    if(data.status === "success"){
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

        const nameEl = document.getElementById("imageName");
        if (nameEl) nameEl.innerHTML = file.name;

        const reader = new FileReader();
        reader.onload = function () {
            const img = document.getElementById("previewImage");
            if (img) {
                img.src = reader.result;
                img.classList.remove("hidden");
            }
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

  // تفعيل الثيم المحفوظ مسبقاً فور الفتح
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark');
    document.documentElement.classList.add('dark');
    document.body.style.setProperty('--app-main-bg', '#0f172a');
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
// تم إزالة alert("router loaded"); من هنا لعدم إزعاج المستخدم
