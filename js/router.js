// ============================================================
// app.js
// النظام الرئيسي للتطبيق + نظام الصلاحيات الموحد
// ============================================================

// 1. استيراد المكونات والخدمات
import { PageView } from './components/PageView.js';
import { translations } from './config.js';

import { login } from './auth/login.js';

import {
  fetchUsers,
  updatePermissionsApi,
  registerUserApi,
  updateUserStatusApi
} from './services/api.js';

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
import {
  RequestsView,
  loadPendingUsers
} from './views/RequestsView.js';

import {
  saveDefectData,
  handleDefectFile,
  initMainChart
} from './workflow.js';


// ============================================================
// GLOBAL STATE
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

window.dashboardData =
  window.dashboardData ||
  {
    open: 0,
    closed: 0,
    today: 0,
    total: 0
  };


// ============================================================
// الصلاحيات الموحدة في التطبيق
// ============================================================

export const APP_PERMISSIONS = {

  maintenance: "maintenance",
  issue: "issue",
  suggestions: "suggestions",
  pm: "pm",
  log: "log",
  schedule: "schedule",
  qr: "qr",
  reports: "reports",
  quality: "quality",
  ai: "ai",
  kb: "kb",
  statistics: "statistics",
  export: "export",

  users: "users",
  requests: "requests",
  machines: "machines",
  settings: "settings"

}; 


// ============================================================
// التحقق من الصلاحية
// ============================================================

export function hasPermission(permission) {

  const perm =
    String(permission || "")
      .trim()
      .toLowerCase();

  // لا توجد صلاحية
  if (!perm) {
    return false;
  }

  // Admin له كل الصلاحيات
  if (currentRole === "admin") {
    return true;
  }

  // all = كل الصلاحيات
  if (currentPermissions.includes("all")) {
    return true;
  }

  // الصلاحية المحددة
  return currentPermissions.includes(perm);
}


// إتاحة الفحص من أي View
window.hasPermission = hasPermission;
window.can = hasPermission;


// ============================================================
// رسالة عدم السماح
// ============================================================

function unauthorizedPage(permission) {

  return PageView(
    "⚠️ غير مصرح",
    `
      <div class="
        bg-[#1E293B]
        p-6
        rounded-xl
        border
        border-red-500/30
        text-center
        text-xs
        text-red-400
        font-bold
      ">

        <div class="text-3xl mb-3">
          🔒
        </div>

        <div class="mb-2">
          ليس لديك صلاحية للوصول إلى هذه الصفحة.
        </div>

        <div class="text-gray-500 font-normal">
          الصلاحية المطلوبة:
          <span class="text-blue-400">
            ${permission}
          </span>
        </div>

      </div>
    `
  );

}


// ============================================================
// محتوى سجل الصيانة
// ============================================================

const LogContent = () => `

  <div class="overflow-x-auto rounded-xl border border-gray-800">

    <table class="w-full text-xs text-right text-white">

      <tr class="
        bg-[#1E293B]
        opacity-70
        border-b
        border-gray-800
      ">

        <th class="p-2.5">
          الكود
        </th>

        <th class="p-2.5">
          المعدة
        </th>

        <th class="p-2.5">
          الحالة
        </th>

      </tr>


      <tr class="border-b border-gray-800/50">

        <td class="p-2.5 font-mono">
          #1024
        </td>

        <td class="p-2.5">
          ماكينة 2
        </td>

        <td class="
          p-2.5
          text-orange-400
          font-bold
        ">
          مفتوح 🟡
        </td>

      </tr>


      <tr class="border-b border-gray-800/50">

        <td class="p-2.5 font-mono">
          #1023
        </td>

        <td class="p-2.5">
          خط الدهان 1
        </td>

        <td class="
          p-2.5
          text-green-400
          font-bold
        ">
          تم الإصلاح 🟢
        </td>

      </tr>

    </table>

  </div>

`;


// ============================================================
// RENDER PAGE
// ============================================================

export function renderPage(page) {

  switch (page) {

    // --------------------------------------------------------
    // صفحات عامة
    // --------------------------------------------------------

    case 'login':
      return LoginView();


    case 'register':
      return RegisterView();


    case 'home':
      return HomeView();


    // --------------------------------------------------------
    // الصيانة
    // --------------------------------------------------------

    case 'maintenance':

      return hasPermission("maintenance")
        ? MaintenanceView()
        : unauthorizedPage("maintenance");


    case 'issue':

      return hasPermission("issue")
        ? IssueView()
        : unauthorizedPage("issue");


    case 'suggestion':
    case 'suggestions':

      return hasPermission("suggestion")
        ? SuggestionView()
        : unauthorizedPage("suggestion");


    case 'pm':

      return hasPermission("pm")
        ? PMView()
        : unauthorizedPage("pm");


    case 'log':

      return hasPermission("log")
        ? PageView(
            "📋 سجل الصيانة",
            LogContent()
          )
        : unauthorizedPage("log");


    case 'schedule':

      return hasPermission("schedule")
        ? PageView(
            "📅 جدولة الصيانة",
            `
              <div class="
                bg-[#1E293B]
                p-6
                rounded-xl
                border
                border-gray-800
                text-center
                text-xs
                text-gray-400
              ">
                📅 لا يوجد خطط صيانة متأخرة للأسبوع الحالي.
              </div>
            `
          )
        : unauthorizedPage("schedule");


    case 'qr':

      return hasPermission("qr")
        ? PageView(
            "📱 مسح QR الماكينات",
            `
              <div class="
                bg-[#1E293B]
                p-6
                rounded-xl
                border
                border-gray-800
                text-center
              ">

                <p class="
                  text-xs
                  text-gray-400
                  mb-3
                ">
                  وجه الكاميرا نحو رمز QR الماكينة
                </p>

                <input
                  type="file"
                  accept="image/*"
                  capture="camera"
                  class="w-full text-xs"
                >

              </div>
            `
          )
        : unauthorizedPage("qr");


    // --------------------------------------------------------
    // الجودة
    // --------------------------------------------------------

    case 'quality':

      return hasPermission("quality")
        ? QualityView()
        : unauthorizedPage("quality");


    // --------------------------------------------------------
    // التقارير
    // --------------------------------------------------------

    case 'report':

      return hasPermission("reports")
        ? ReportView()
        : unauthorizedPage("reports");


    case 'reports':

      return hasPermission("reports")
        ? ReportsView()
        : unauthorizedPage("reports");


    case 'stats':

      return hasPermission("stats")
        ? PageView(
            "📊 الإحصائيات وتحليل الأعطال",
            `
              <div class="
                bg-[#1E293B]
                p-4
                rounded-xl
                border
                border-gray-800
              ">

                <div style="height:220px;">

                  <canvas
                    id="statsChart">
                  </canvas>

                </div>

              </div>
            `
          )
        : unauthorizedPage("stats");


    // --------------------------------------------------------
    // الذكاء الاصطناعي
    // --------------------------------------------------------

    case 'ai':

      return hasPermission("ai")
        ? PageView(
            "🤖 فحص العيوب بـ AI",
            `
              <div class="
                bg-[#1E293B]
                p-6
                rounded-xl
                border
                border-gray-800
                text-center
              ">

                <p class="
                  text-xs
                  text-gray-400
                  mb-3
                ">
                  ارفع صورة المنتجات لفحصها تلقائياً
                </p>

                <input
                  type="file"
                  class="w-full text-xs mb-3"
                >

                <button
                  onclick="
                    alert(
                      'جاري الفحص... العيب المكتشف: خدش دهان (دقة 94%)'
                    )
                  "
                  class="
                    w-full
                    p-2.5
                    bg-blue-600
                    rounded-lg
                    font-bold
                    text-xs
                    text-white
                  "
                >
                  ابدأ الفحص 🚀
                </button>

              </div>
            `
          )
        : unauthorizedPage("ai");


    // --------------------------------------------------------
    // قاعدة المعرفة
    // --------------------------------------------------------

    case 'kb':

      return hasPermission("kb")
        ? PageView(
            "📚 قاعدة المعرفة للحلول",
            `
              <input
                placeholder="🔍 ابحث عن العيب أو طريقة الإصلاح..."
                class="
                  w-full
                  p-2.5
                  rounded-lg
                  bg-[#1E293B]
                  border
                  border-gray-700
                  text-xs
                  mb-3
                  text-white
                "
              >
            `
          )
        : unauthorizedPage("kb");


    // --------------------------------------------------------
    // إدارة المستخدمين
    // --------------------------------------------------------

    case 'users':

      return hasPermission("users")
        ? PageView(
            "👥 إدارة المستخدمين والصلاحيات",
            `
              <div class="space-y-3">

                <button
                  onclick="window.loadUsers()"
                  class="
                    w-full
                    bg-blue-600
                    rounded-lg
                    p-3
                    font-bold
                    text-white
                    text-xs
                  "
                >
                  عرض المستخدمين
                </button>

                <div id="usersContainer"></div>

              </div>
            `
          )
        : unauthorizedPage("users");


    // --------------------------------------------------------
    // طلبات الانضمام
    // --------------------------------------------------------

    case 'requests':

      return hasPermission("requests")
        ? RequestsView()
        : unauthorizedPage("requests");


    // --------------------------------------------------------
    // إدارة النظام
    // --------------------------------------------------------

    case 'system':

      return hasPermission("users") ||
             hasPermission("requests") ||
             hasPermission("machines") ||
             hasPermission("settings")
        ? SystemView()
        : unauthorizedPage("system");


    // --------------------------------------------------------
    // إدارة الماكينات
    // --------------------------------------------------------

    case 'machines':

      return hasPermission("machines")
        ? PageView(
            "🏭 إدارة الماكينات",
            `
              <div class="
                bg-[#1E293B]
                p-6
                rounded-xl
                border
                border-gray-800
                text-center
                text-xs
                text-gray-400
              ">
                🚧 إدارة الماكينات قيد التطوير
              </div>
            `
          )
        : unauthorizedPage("machines");


    // --------------------------------------------------------
    // إعدادات النظام
    // --------------------------------------------------------

    case 'settings':

      return hasPermission("settings")
        ? PageView(
            "⚙️ إعدادات النظام",
            `
              <div class="
                bg-[#1E293B]
                p-6
                rounded-xl
                border
                border-gray-800
                text-center
                text-xs
                text-gray-400
              ">
                ⚙️ إعدادات النظام قيد التطوير
              </div>
            `
          )
        : unauthorizedPage("settings");


    // --------------------------------------------------------
    // الصفحة الافتراضية
    // --------------------------------------------------------

    default:

      return LoginView();

  }

}


// ============================================================
// التنقل
// ============================================================

export function navigateTo(
page,
addToHistory = true
) {

// ============================================================
// توحيد أسماء الصفحات مع أسماء الصلاحيات
// ============================================================

const permissionMap = {
suggestion: "suggestions",
suggestions: "suggestions",

stats: "statistics",
statistics: "statistics",

report: "reports",
reports: "reports"

};

const requiredPermission =
permissionMap[page] || page;

// ============================================================
// الصفحات العامة
// ============================================================

const publicPages = [
"login",
"register",
"home"
];

// ============================================================
// حماية الصفحات
// ============================================================

if (!publicPages.includes(page)) {

if (!hasPermission(requiredPermission)) {

  alert(
    `⚠️ ليس لديك صلاحية الوصول إلى صفحة (${page})`
  );

  return;
}

}

// ============================================================
// تغيير الصفحة
// ============================================================

currentPage = page;

// ============================================================
// Browser History
// ============================================================

if (
addToHistory &&
window.location.hash !== "#${page}"
) {

history.pushState(
  { page },
  "",
  `#${page}`
);

}

// ============================================================
// تحديث Dashboard
// ============================================================

if (
page === "home" &&
typeof window.loadDashboard === "function"
) {

window.loadDashboard();

}

// ============================================================
// Render
// ============================================================

render();

// ============================================================
// العودة إلى أعلى الصفحة
// ============================================================

window.scrollTo({
top: 0,
behavior: "smooth"
});

}


// ============================================================
// Browser Back / Forward
// ============================================================

window.addEventListener(
  "popstate",
  (event) => {

    if (
      event.state &&
      event.state.page
    ) {

      navigateTo(
        event.state.page,
        false
      );

    } else {

      const hashPage =
        window.location.hash.replace(
          "#",
          ""
        );

      if (hashPage) {

        navigateTo(
          hashPage,
          false
        );

      } else {

        const authenticated =
          !!localStorage.getItem("user");

        navigateTo(
          authenticated
            ? "home"
            : "login",
          false
        );

      }

    }

  }
);


// ============================================================
// اللغة
// ============================================================

export function toggleLanguage() {

  currentLang =
    currentLang === "ar"
      ? "en"
      : "ar";

  window.currentLang =
    currentLang;


  const htmlTag =
    document.getElementById("html-tag");


  if (htmlTag) {

    htmlTag.dir =
      translations[currentLang].dir;

    htmlTag.lang =
      currentLang;

  }


  render();

}


// ============================================================
// Dark Mode
// ============================================================

export function toggleDarkMode() {

  const isDark =
    document.body.classList.toggle("dark");

  document.documentElement
    .classList.toggle(
      "dark",
      isDark
    );


  localStorage.setItem(
    "theme",
    isDark
      ? "dark"
      : "light"
  );


  document.body.style.setProperty(
    "--app-main-bg",
    isDark
      ? "#0f172a"
      : "#f3f4f6"
  );

}


// ============================================================
// تسجيل الخروج
// ============================================================

export function logout() {

  localStorage.removeItem("user");
  localStorage.removeItem("isLoggedIn");
  localStorage.removeItem("role");
  localStorage.removeItem("permissions");
  localStorage.removeItem("phone");
  localStorage.removeItem("name");
  localStorage.removeItem("job");
  localStorage.removeItem("shift");
  localStorage.removeItem("department");


  currentRole = "";
  currentPermissions = [];


  navigateTo("login");

}


// ============================================================
// الدعم
// ============================================================

export function contactSupport() {

  const name =
    localStorage.getItem("name") || "";

  const job =
    localStorage.getItem("job") || "";


  const message =
`السلام عليكم،
أرغب في التواصل بخصوص نظام الصيانة وتحليل العيوب.

الاسم: ${name}
الوظيفة: ${job}`;


  window.open(
    `https://wa.me/201067988554?text=${encodeURIComponent(message)}`,
    "_blank"
  );

}


// ============================================================
// تسجيل الدخول
// ============================================================

export async function doLogin() {

  const phone =
    document
      .getElementById("loginPhone")
      ?.value
      .trim();


  const pass =
    document
      .getElementById("loginPass")
      ?.value
      .trim();


  const btn =
    document.getElementById(
      "loginBtn"
    );


  if (!phone || !pass) {

    alert(
      "أدخل رقم الموبايل وكلمة السر"
    );

    return;

  }


  if (btn) {

    btn.disabled = true;

    btn.innerHTML =
      "⏳ جاري تسجيل الدخول...";

  }


  try {

    const result =
      await login(
        phone,
        pass
      );


    if (
      result.status === "success"
    ) {

      const userObj =
        result.user ||
        result.data ||
        {};


      const roleVal =
        (
          userObj.role ||
          ""
        )
        .toLowerCase();


      const permVal =
        userObj.permissions ||
        "";


      localStorage.setItem(
        "phone",
        phone
      );

      localStorage.setItem(
        "name",
        userObj.name || ""
      );

      localStorage.setItem(
        "job",
        userObj.job || ""
      );

      localStorage.setItem(
        "shift",
        userObj.shift || ""
      );

      localStorage.setItem(
        "department",
        userObj.department || ""
      );

      localStorage.setItem(
        "role",
        roleVal
      );

      localStorage.setItem(
        "permissions",
        permVal
      );

      localStorage.setItem(
        "user",
        JSON.stringify(userObj)
      );

      localStorage.setItem(
        "isLoggedIn",
        "true"
      );


      currentRole =
        roleVal;


      currentPermissions =
        permVal
          .split(",")
          .map(p =>
            p.trim()
              .toLowerCase()
          )
          .filter(Boolean);


      navigateTo("home");


    } else {

      if (btn) {

        btn.disabled = false;

        btn.innerHTML =
          "دخول";

      }


      alert(
        result.message ||
        "بيانات الدخول غير صحيحة"
      );

    }


  } catch (error) {

    console.error(
      "Login Error:",
      error
    );


    if (btn) {

      btn.disabled = false;

      btn.innerHTML =
        "دخول";

    }


    alert(
      "خطأ في الاتصال بالسيرفر"
    );

  }

}


// ============================================================
// التسجيل
// ============================================================

export async function registerUser() {

  const data = {

    name:
      document
        .getElementById("regName")
        ?.value
        .trim(),

    phone:
      document
        .getElementById("regPhone")
        ?.value
        .trim(),

    shift:
      document
        .getElementById("regShift")
        ?.value
        .trim(),

    password:
      document
        .getElementById("regPass")
        ?.value,

    confirmPassword:
      document
        .getElementById("regPass2")
        ?.value,

    job:
      document
        .getElementById("regJob")
        ?.value
        .trim(),

    department:
      document
        .getElementById("regDepartment")
        ?.value
        .trim(),

    code:
      document
        .getElementById("regCode")
        ?.value
        .trim()

  };


  if (
    !data.name ||
    !data.phone ||
    !data.shift ||
    !data.password ||
    !data.confirmPassword ||
    !data.job ||
    !data.department ||
    !data.code
  ) {

    alert(
      "يرجى إدخال جميع البيانات بما في ذلك الشيفت"
    );

    return;

  }


  if (
    data.password !==
    data.confirmPassword
  ) {

    alert(
      "كلمتا السر غير متطابقتين"
    );

    return;

  }


  try {

    const result =
      await registerUserApi(
        data
      );


    alert(
      result.message ||
      "تمت العملية بنجاح"
    );


    if (
      result.status === "success"
    ) {

      navigateTo("login");

    }


  } catch (error) {

    console.error(
      "Register Error:",
      error
    );

    alert(
      "تعذر الاتصال بالخادم"
    );

  }

}


// ============================================================
// تنظيف الرسوم قبل تغيير الصفحة
// ============================================================

function cleanupBeforeRender() {

  if (
    window.mainChart &&
    typeof window.mainChart.destroy === "function"
  ) {

    window.mainChart.destroy();

    window.mainChart = null;

  }


  if (
    window.statsChart &&
    typeof window.statsChart.destroy === "function"
  ) {

    window.statsChart.destroy();

    window.statsChart = null;

  }

}


// ============================================================
// Render
// ============================================================

export function render() {

  const app =
    document.getElementById(
      "app"
    );


  if (!app) return;


  cleanupBeforeRender();


  app.style.transition =
    "opacity 0.15s ease-out";

  app.style.opacity =
    "0.4";


  setTimeout(() => {

    app.innerHTML =
      renderPage(
        currentPage
      );


    if (
      currentPage === "requests"
    ) {

      setTimeout(() => {

        if (
          typeof loadPendingUsers ===
          "function"
        ) {

          loadPendingUsers();

        }

      }, 100);

    }


    app.style.opacity =
      "1";


    requestAnimationFrame(() => {

      if (
        currentPage === "home" &&
        typeof window.initMainChart ===
        "function"
      ) {

        window.initMainChart();

      }

      else if (
        currentPage === "stats" &&
        typeof window.initStatsChart ===
        "function"
      ) {

        window.initStatsChart();

      }

    });

  }, 150);

}


// ============================================================
// ربط Window
// ============================================================

window.navigateTo =
  navigateTo;

window.toggleLanguage =
  toggleLanguage;

window.toggleDarkMode =
  toggleDarkMode;

window.doLogin =
  doLogin;

window.registerUser =
  registerUser;

window.logout =
  logout;

window.contactSupport =
  contactSupport;

window.saveDefectData =
  saveDefectData;

window.handleDefectFile =
  handleDefectFile;

window.render =
  render;


// ============================================================
// إدارة المستخدمين - توافق قديم
// ============================================================

window.loadUsers =
async function () {

  const result =
    await fetchUsers();


  if (
    result.status !==
    "success"
  ) {

    alert(
      result.message ||
      "فشل تحميل المستخدمين"
    );

    return;

  }


  const usersList =
    result.data ||
    result.users ||
    [];


  let html = "";


  usersList.forEach(user => {

    html += `

      <div class="
        bg-[#1E293B]
        rounded-xl
        p-3
        mb-3
        text-white
        text-xs
        shadow-sm
      ">

        <div>
          <b>
            ${user.name || "مستخدم بدون اسم"}
          </b>
        </div>

        <div class="text-gray-400">
          ${user.phone || ""}
        </div>

        <div class="text-blue-400">
          الدور:
          ${user.role || "user"}
        </div>

      </div>

    `;

  });


  const container =
    document.getElementById(
      "usersContainer"
    );


  if (container) {

    container.innerHTML =
      html;

  }

};


// ============================================================
// قبول مستخدم
// ============================================================

window.approveUser =
async function(userId) {

  const result =
    await updateUserStatusApi(
      userId,
      "active"
    );


  alert(
    result.message ||
    "تم تنفيذ العملية"
  );


  if (
    result.status === "success"
  ) {

    if (
      typeof window.loadPendingUsers ===
      "function"
    ) {

      window.loadPendingUsers();

    }

  }

};


// ============================================================
// رفض مستخدم
// ============================================================

window.rejectUser =
async function(userId) {

  const result =
    await updateUserStatusApi(
      userId,
      "rejected"
    );


  alert(
    result.message ||
    "تم تنفيذ العملية"
  );


  if (
    result.status === "success"
  ) {

    if (
      typeof window.loadPendingUsers ===
      "function"
    ) {

      window.loadPendingUsers();

    }

  }

};


// ============================================================
// Event Delegation للصور
// ============================================================

document.addEventListener(
  "change",
  function(e) {

    if (
      e.target.id !== "cameraImage" &&
      e.target.id !== "galleryImage"
    ) {

      return;

    }


    const file =
      e.target.files?.[0];


    if (!file) return;


    const nameEl =
      document.getElementById(
        "imageName"
      );


    if (nameEl) {

      nameEl.innerHTML =
        file.name;

    }


    const reader =
      new FileReader();


    reader.onload =
      function() {

        const img =
          document.getElementById(
            "previewImage"
          );


        if (img) {

          img.src =
            reader.result;

          img.classList.remove(
            "hidden"
          );

        }

      };


    reader.readAsDataURL(
      file
    );

  }
);


// ============================================================
// DOMContentLoaded
// ============================================================

window.addEventListener(
  "DOMContentLoaded",
  () => {

    const savedUser =
      localStorage.getItem(
        "user"
      );


    const initialHash =
      window.location.hash
        .replace(
          "#",
          ""
        );


    if (savedUser) {

      try {

        const user =
          JSON.parse(
            savedUser
          );


        if (
          user &&
          user.role
        ) {

          currentRole =
            (
              user.role ||
              ""
            ).toLowerCase();

        }


        if (
          user &&
          user.permissions !== undefined
        ) {

          currentPermissions =
            (
              user.permissions ||
              ""
            )
            .split(",")
            .map(p =>
              p.trim()
                .toLowerCase()
            )
            .filter(Boolean);

        }


        currentPage =
          (
            initialHash &&
            initialHash !== "login" &&
            initialHash !== "register"
          )
            ? initialHash
            : "home";


      } catch (error) {

        console.error(
          "User restore error:",
          error
        );

        currentPage =
          "login";

      }


    } else {

      currentPage =
        "login";

    }


    history.replaceState(
      {
        page:
          currentPage
      },
      "",
      `#${currentPage}`
    );


    const savedTheme =
      localStorage.getItem(
        "theme"
      );


    if (
      savedTheme === "dark"
    ) {

      document.body.classList.add(
        "dark"
      );

      document.documentElement.classList.add(
        "dark"
      );

      document.body.style.setProperty(
        "--app-main-bg",
        "#0f172a"
      );

    }


    render();


    setTimeout(() => {

      const splash =
        document.getElementById(
          "splash"
        );


      if (splash) {

        splash.style.opacity =
          "0";


        setTimeout(() => {

          splash.style.display =
            "none";

        }, 700);

      }

    }, 800);

  }
);
