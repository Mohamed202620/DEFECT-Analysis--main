// 1. استيراد المكونات والخدمات والواجهات
import { PageView } from './components/PageView.js';
import { translations } from './config.js';
import { login } from './auth/login.js';
import { fetchUsers, updatePermissionsApi, registerUserApi } from './services/api.js';

// استيراد الواجهات من مجلد views
import { LoginView } from './views/loginView.js';
import { RegisterView } from './views/registerView.js';
import { HomeView } from './views/homeView.js';
import { PMView } from './views/pmView.js';
import { ReportView } from './views/reportView.js';
import { ReportsView } from './views/reportsView.js';
import { SuggestionView } from './views/suggestionView.js';
import { IssueView } from './views/issueView.js';
import { MaintenanceView } from './views/MaintenanceView.js';
import { QualityView } from './views/QualityView.js';
import { SystemView } from './views/SystemView.js';

// استيراد دوال سير العمل (Workflow)
import { saveDefectData, handleDefectFile, initMainChart } from './workflow.js';

// --- المتغيرات العامة للنظام (Global State) ---
export let currentPage = 'login';
export let currentLang = 'ar';
export let currentRole = '';
export let currentPermissions = [];

// مزامنة حالة اللغة والداتا على window
window.currentLang = currentLang;
window.dashboardData = window.dashboardData || { open: 0, closed: 0, today: 0, total: 0 };

// --- واجهات مكملة ومساعدة ---
const LogContent = () => `
  <div class="overflow-x-auto rounded-xl border border-gray-800">
    <table class="w-full text-xs text-right text-white">
      <tr class="bg-[#1E293B] opacity-70 border-b border-gray-800">
        <th class="p-2.5">الكود</th>
        <th class="p-2.5">المعدة</th>
        <th class="p-2.5">الحالة</th>
      </tr>
      <tr class="border-b border-gray-800/50">
        <td class="p-2.5 font-mono">#1024</td>
        <td class="p-2.5">ماكينة 2</td>
        <td class="p-2.5 text-orange-400 font-bold">مفتوح 🟡</td>
      </tr>
      <tr class="border-b border-gray-800/50">
        <td class="p-2.5 font-mono">#1023</td>
        <td class="p-2.5">خط الدهان 1</td>
        <td class="p-2.5 text-green-400 font-bold">تم الإصلاح 🟢</td>
      </tr>
    </table>
  </div>
`;

// فحص الصلاحيات (محدث ليدعم admin وكلمة all)
export function hasPermission(permission) {
  if (currentRole === "admin") return true;
  if (currentPermissions.includes("all")) return true;
  return currentPermissions.includes(permission.toLowerCase());
}

// --- دالة العرض الموحدة (Render Page) ---
export function renderPage(page) {
  switch (page) {
    case 'login': return LoginView();
    case 'register': return RegisterView();
    case 'home': return HomeView();
    case 'maintenance': return MaintenanceView();
    case 'quality': return QualityView();
    case 'system': 
      return currentRole === 'admin' 
        ? SystemView() 
        : PageView("⚠️ غير مصرح", '<div class="bg-[#1E293B] p-6 rounded-xl border border-red-500/30 text-center text-xs text-red-400 font-bold">عذراً، هذه الصفحة مخصصة للمسؤولين فقط (Admin).</div>');
    case 'report': return ReportView();
    case 'pm': return PMView();
    case 'reports': return ReportsView();
    case 'suggestion':
    case 'suggestions': return SuggestionView();
    case 'issue': return IssueView();
    case 'log': return PageView("📋 سجل الصيانة", LogContent());
    case 'schedule': 
      return PageView('📅 جدولة الصيانة', '<div class="bg-[#1E293B] p-6 rounded-xl border border-gray-800 text-center text-xs text-gray-400">📅 لا يوجد خطط صيانة متأخرة للأسبوع الحالي.</div>');
    case 'qr': 
      return PageView('📱 مسح QR الماكينات', '<div class="bg-[#1E293B] p-6 rounded-xl border border-gray-800 text-center"><p class="text-xs text-gray-400 mb-3">وجه الكاميرا نحو رمز QR الماكينة</p><input type="file" accept="image/*" capture="camera" class="w-full text-xs"></div>');
    case 'ai': 
      return PageView('🤖 فحص العيوب بـ AI', `<div class="bg-[#1E293B] p-6 rounded-xl border border-gray-800 text-center"><p class="text-xs text-gray-400 mb-3">ارفع صورة المنتجات لفحصها تلقائياً</p><input type="file" class="w-full text-xs mb-3"><button onclick="alert('جاري الفحص... العيب المكتشف: خدش دهان (دقة 94%)')" class="w-full p-2.5 bg-blue-600 rounded-lg font-bold text-xs text-white">ابدأ الفحص 🚀</button></div>`);
    case 'stats': 
      return PageView('📊 الإحصائيات وتحليل الأعطال', '<div class="bg-[#1E293B] p-4 rounded-xl border border-gray-800"><div style="height: 220px;"><canvas id="statsChart"></canvas></div></div>');
    case 'kb': 
      return PageView('📚 قاعدة المعرفة للحلول', '<input placeholder="🔍 ابحث عن العيب أو طريقة الإصلاح..." class="w-full p-2.5 rounded-lg bg-[#1E293B] border border-gray-700 text-xs mb-3 text-white">');
    case 'users': 
      return (currentRole === 'admin' || hasPermission('users'))
        ? PageView("👥 إدارة المستخدمين والصلاحيات", `<div class="space-y-3"><button onclick="window.loadUsers()" class="w-full bg-blue-600 rounded-lg p-3 font-bold text-white text-xs">عرض المستخدمين</button><div id="usersContainer"></div></div>`)
        : PageView("⚠️ غير مصرح", '<div class="bg-[#1E293B] p-6 rounded-xl border border-red-500/30 text-center text-xs text-red-400 font-bold">ليس لديك صلاحية لإدارة المستخدمين.</div>');
    default: return LoginView();
  }
}

// --- التنقل والتحكم المطور مع حارس الصلاحيات الشامل (Route Guard) ---
export function navigateTo(page, addToHistory = true) {
  // خريطة حماية الصفحات الحساسة
  const protectedPages = {
    system: 'admin',      // مخصصة للأدمن فقط
    users: 'users',       // تتطلب صلاحية users أو admin
    reports: 'reports',
    pm: 'pm',
    stats: 'stats',
    quality: 'quality',
    maintenance: 'maintenance'
  };

  if (protectedPages[page]) {
    const required = protectedPages[page];
    if (required === 'admin' && currentRole !== 'admin') {
      alert("⚠️ عذراً، هذه الصفحة مخصصة لمدير النظام (Admin) فقط.");
      return;
    } else if (required !== 'admin' && !hasPermission(required)) {
      alert(`⚠️ ليس لديك صلاحية الوصول إلى صفحة (${page})`);
      return;
    }
  }

  currentPage = page;

  if (addToHistory && window.location.hash !== `#${page}`) {
    history.pushState({ page }, '', `#${page}`);
  }

  if (page === "home" && typeof window.loadDashboard === "function") {
    window.loadDashboard();
  }

  render();
  window.scrollTo(0, 0);
}

// الاستماع لحدث الرجوع من نظام الموبايل
window.addEventListener('popstate', (event) => {
  if (event.state && event.state.page) {
    navigateTo(event.state.page, false);
  } else {
    const hashPage = window.location.hash.replace('#', '');
    if (hashPage) {
      navigateTo(hashPage, false);
    } else {
      const isAuthenticated = !!localStorage.getItem('user');
      navigateTo(isAuthenticated ? 'home' : 'login', false);
    }
  }
});

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
  document.body.style.setProperty('--app-main-bg', isDark ? '#0f172a' : '#f3f4f6');
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
  navigateTo("login");
}

export function contactSupport() {
  const name = localStorage.getItem("name") || "";
  const job = localStorage.getItem("job") || "";
  const message = `السلام عليكم،\nأرغب في التواصل بخصوص نظام الصيانة وتحليل العيوب.\n\nالاسم: ${name}\nالوظيفة: ${job}`;
  window.open(`https://wa.me/201067988554?text=${encodeURIComponent(message)}`, "_blank");
}

// --- عمليات مصادقة الحسابات ---
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
    if (btn) { btn.disabled = false; btn.innerHTML = "دخول"; }
    alert("خطأ في الاتصال بالسيرفر");
  }
}

export async function registerUser() {
  const data = {
    name: document.getElementById("regName")?.value.trim(),
    phone: document.getElementById("regPhone")?.value.trim(),
    password: document.getElementById("regPass")?.value,
    confirmPassword: document.getElementById("regPass2")?.value,
    job: document.getElementById("regJob")?.value.trim(),
    department: document.getElementById("regDepartment")?.value.trim(),
    code: document.getElementById("regCode")?.value.trim()
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
      navigateTo("login");
    }
  } catch (e) {
    alert("تعذر الاتصال بالخادم");
  }
}

// --- دالة العرض الرئيسية (Render) ---
export function render() {
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = renderPage(currentPage);

  requestAnimationFrame(() => {
    if (currentPage === 'home' && typeof window.initMainChart === 'function') {
      window.initMainChart();
    } else if (currentPage === 'stats' && typeof window.initStatsChart === 'function') {
      window.initStatsChart();
    }
  });
}

// --- ربط الدوال بـ Window للأحداث المباشرة ---
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
window.can = hasPermission;

window.loadUsers = async function () {
  const data = await fetchUsers();
  if (data.status !== "success") return;

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
};

window.editPermissions = async function(phone, currentRoleVal) {
  const role = prompt("أدخل الدور الجديد:\nadmin\nengineer\ntech", currentRoleVal);
  if (!role) return;

  const permissions = prompt("أدخل الصلاحيات\nمثال:\nall\nأو\nreports,pm,users", "all");
  if (permissions === null) return;

  const data = await updatePermissionsApi(phone, role.toLowerCase(), permissions);
  alert(data.message);

  if (data.status === "success") {
    window.loadUsers();
  }
};

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

// --- التشغيل عند جاهزية الصفحة ---
window.addEventListener('DOMContentLoaded', () => {
  const savedUser = localStorage.getItem('user');
  const initialHash = window.location.hash.replace('#', '');

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
      currentPage = initialHash || 'home';
    } catch(e) {
      currentPage = 'login';
    }
  } else {
    currentPage = 'login';
  }

  history.replaceState({ page: currentPage }, '', `#${currentPage}`);

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
