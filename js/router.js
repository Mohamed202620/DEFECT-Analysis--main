// ============================================================
// app.js
// النظام الرئيسي للتطبيق + نظام الصلاحيات الموحد
// Firebase Firestore
// ============================================================

import { PageView } from './components/PageView.js';
import { translations } from './config.js';

import { login } from './auth/login.js';

import {
  fetchUsers,
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


// ============================================================
// RENDER PAGES
// ============================================================

export function renderPage(page) {

  switch (page) {

    case 'login':

      return LoginView();


    case 'register':

      return RegisterView();


    case 'home':

      return HomeView();


    case 'maintenance':

      return hasPermission("maintenance")
        ? MaintenanceView()
        : unauthorizedPage("maintenance");


    case 'issue':

      return hasPermission("issue")
        ? IssueView()
        : unauthorizedPage("issue");


    // ========================================================
    // كايزن
    // ========================================================

    case 'suggestion':
    case 'suggestions':

      return hasPermission("suggestions")
        ? SuggestionView()
        : unauthorizedPage("suggestions");


    case 'pm':

      return hasPermission("pm")
        ? PMView()
        : unauthorizedPage("pm");


    case 'quality':

      return hasPermission("quality")
        ? QualityView()
        : unauthorizedPage("quality");


    case 'report':

      return hasPermission("reports")
        ? ReportView()
        : unauthorizedPage("reports");


    case 'reports':

      return hasPermission("reports")
        ? ReportsView()
        : unauthorizedPage("reports");


    // ========================================================
    // USERS
    // ========================================================

    case 'users':

      return hasPermission("users")

        ? PageView(
            "👥 إدارة المستخدمين",
            `
              <div class="space-y-3">

                <button
                  onclick="window.loadUsers()"
                  class="
                    w-full
                    bg-blue-600
                    hover:bg-blue-500
                    rounded-lg
                    p-3
                    font-bold
                    text-white
                    text-xs
                  "
                >
                  🔄 تحديث القائمة
                </button>

                <div
                  id="usersContainer"
                  class="mt-4"
                >

                  <div
                    class="
                      text-center
                      text-gray-500
                      text-xs
                    "
                  >
                    جاري تحميل البيانات...
                  </div>

                </div>

              </div>
            `
          )

        : unauthorizedPage("users");


    // ========================================================
    // REQUESTS
    // ========================================================

    case 'requests':

      return hasPermission("requests")
        ? RequestsView()
        : unauthorizedPage("requests");


    case 'system':

      return SystemView();


    default:

      return LoginView();

  }

}


// ============================================================
// UNAUTHORIZED
// ============================================================

function unauthorizedPage(permission) {

  return PageView(

    "⚠️ غير مصرح",

    `
      <div
        class="
          bg-[#1E293B]
          p-6
          rounded-xl
          border
          border-red-500/30
          text-center
          text-xs
          text-red-400
          font-bold
        "
      >

        ليس لديك صلاحية للوصول إلى:
        ${permission}

      </div>
    `

  );

}


// ============================================================
// RENDER
// ============================================================

export function render() {

  const app =
    document.getElementById("app");

  if (!app) return;


  app.style.opacity = "0.4";


  setTimeout(() => {

    app.innerHTML =
      renderPage(currentPage);

    app.style.opacity = "1";


    // ========================================================
    // USERS AUTO LOAD
    // ========================================================

    if (currentPage === "users") {

      setTimeout(() => {

        if (
          typeof window.loadUsers ===
          "function"
        ) {

          window.loadUsers();

        }

      }, 100);

    }


    // ========================================================
    // REQUESTS AUTO LOAD
    // ========================================================

    if (
      currentPage === "requests" &&
      typeof loadPendingUsers ===
      "function"
    ) {

      setTimeout(() => {

        loadPendingUsers();

      }, 100);

    }

  }, 150);

}


// ============================================================
// NAVIGATION
// ============================================================

export function navigateTo(
  page,
  addToHistory = true
) {

  currentPage =
    page;


  if (addToHistory) {

    history.pushState(
      { page },
      "",
      `#${page}`
    );

  }


  render();

}


window.navigateTo =
  navigateTo;


// ============================================================
// LOGIN
// ============================================================

window.doLogin = async function () {

  try {

    const phoneInput =
      document.getElementById("loginPhone");

    const passwordInput =
      document.getElementById("loginPass");


    const phone =
      phoneInput?.value?.trim() || "";

    const password =
      passwordInput?.value?.trim() || "";


    // ========================================================
    // التحقق من البيانات
    // ========================================================

    if (!phone || !password) {

      alert(
        "⚠️ يرجى إدخال رقم الموبايل وكلمة السر."
      );

      return;

    }


    // ========================================================
    // زر الدخول
    // ========================================================

    const button =
      document.getElementById("loginBtn");


    if (button) {

      button.disabled = true;

      button.innerText =
        "جاري تسجيل الدخول...";

    }


    // ========================================================
    // Firebase Login
    // ========================================================

    const result =
      await login(
        phone,
        password
      );


    console.log(
      "LOGIN RESULT:",
      result
    );


    // ========================================================
    // إعادة الزر
    // ========================================================

    if (button) {

      button.disabled = false;

      button.innerText =
        "دخول";

    }


    // ========================================================
    // فشل تسجيل الدخول
    // ========================================================

    if (
      !result ||
      result.status !== "success"
    ) {

      alert(
        result?.message ||
        "فشل تسجيل الدخول."
      );

      return;

    }


    // ========================================================
    // بيانات المستخدم
    // ========================================================

    const user =
      result.user || {};


    // ========================================================
    // حفظ بيانات المستخدم
    // ========================================================

    localStorage.setItem(
      "userId",
      user.id || user.uid || ""
    );

    localStorage.setItem(
      "name",
      user.name || ""
    );

    localStorage.setItem(
      "phone",
      user.phone || phone
    );

    localStorage.setItem(
      "job",
      user.job || ""
    );

    localStorage.setItem(
      "shift",
      user.shift || ""
    );

    localStorage.setItem(
      "department",
      user.department || ""
    );

    localStorage.setItem(
      "role",
      (user.role || "")
        .trim()
        .toLowerCase()
    );

    localStorage.setItem(
      "permissions",
      user.permissions || ""
    );


    // ========================================================
    // تحديث حالة التطبيق
    // ========================================================

    currentRole =
      (user.role || "")
        .trim()
        .toLowerCase();


    currentPermissions =
      (user.permissions || "")
        .split(",")
        .map(
          p =>
            p.trim().toLowerCase()
        )
        .filter(Boolean);


    // ========================================================
    // الانتقال للرئيسية
    // ========================================================

    currentPage =
      "home";


    history.pushState(
      { page: "home" },
      "",
      "#home"
    );


    render();


  } catch (error) {

    console.error(
      "LOGIN ERROR:",
      error
    );


    const button =
      document.getElementById("loginBtn");


    if (button) {

      button.disabled = false;

      button.innerText =
        "دخول";

    }


    alert(
      "حدث خطأ أثناء تسجيل الدخول."
    );

  }

};


// ============================================================
// REGISTER USER
// ============================================================

window.registerUser =
async function () {

  try {

    const name =
      document
        .getElementById("regName")
        ?.value
        ?.trim() || "";


    const phone =
      document
        .getElementById("regPhone")
        ?.value
        ?.trim() || "";


    const password =
      document
        .getElementById("regPass")
        ?.value
        ?.trim() || "";


    const confirmPassword =
      document
        .getElementById("regPass2")
        ?.value
        ?.trim() || "";


    const shift =
      document
        .getElementById("regShift")
        ?.value
        ?.trim() || "";


    const job =
      document
        .getElementById("regJob")
        ?.value
        ?.trim() || "";


    const department =
      document
        .getElementById("regDepartment")
        ?.value
        ?.trim() || "";


    const code =
      document
        .getElementById("regCode")
        ?.value
        ?.trim() || "";


    if (
      !name ||
      !phone ||
      !password ||
      !confirmPassword ||
      !shift ||
      !job ||
      !department ||
      !code
    ) {

      alert(
        "⚠️ يرجى إدخال جميع البيانات المطلوبة."
      );

      return;

    }


    if (
      password !==
      confirmPassword
    ) {

      alert(
        "⚠️ كلمتا السر غير متطابقتين."
      );

      return;

    }


    const userData = {

      name,

      phone,

      password,

      shift,

      job,

      department,

      code

    };


    const submitButton =
      document.querySelector(
        'form button[type="submit"]'
      );


    if (submitButton) {

      submitButton.disabled =
        true;

      submitButton.innerText =
        "جاري إنشاء الحساب...";

    }


    const result =
      await registerUserApi(
        userData
      );


    if (submitButton) {

      submitButton.disabled =
        false;

      submitButton.innerText =
        "إنشاء الحساب";

    }


    if (
      result.status !==
      "success"
    ) {

      alert(
        result.message ||
        "حدث خطأ أثناء التسجيل."
      );

      return;

    }


    alert(
      result.message ||
      "تم إرسال طلب التسجيل بنجاح."
    );


    navigateTo("login");


  } catch (error) {

    console.error(
      "REGISTER ERROR:",
      error
    );


    alert(
      "حدث خطأ أثناء إنشاء الحساب."
    );

  }

};


// ============================================================
// LOAD USERS
// ============================================================

window.loadUsers =
async function () {

  console.log(
    "DEBUG: Load Users Started..."
  );


  const container =
    document.getElementById(
      "usersContainer"
    );


  if (!container) {

    console.warn(
      "usersContainer غير موجود"
    );

    return;

  }


  container.innerHTML = `

    <div
      class="
        text-center
        py-8
        text-gray-400
      "
    >

      جاري تحميل المستخدمين...

    </div>

  `;


  try {

    const result =
      await fetchUsers();


    console.log(
      "DEBUG: API Result:",
      result
    );


    if (
      result.status !==
      "success"
    ) {

      container.innerHTML = `

        <div
          class="
            text-red-400
            text-center
            py-6
          "
        >

          خطأ:
          ${result.message || "فشل تحميل المستخدمين"}

        </div>

      `;

      return;

    }


    const usersList =
      Array.isArray(result.data)
        ? result.data
        : [];


    console.log(
      "DEBUG: Users Count:",
      usersList.length
    );


    if (!usersList.length) {

      container.innerHTML = `

        <div
          class="
            text-center
            text-gray-500
            py-6
          "
        >

          لا يوجد مستخدمون مسجلون حالياً

        </div>

      `;

      return;

    }


    let html = "";


    usersList.forEach(
      user => {

        html += `

          <div
            class="
              bg-[#1E293B]
              rounded-xl
              p-3
              mb-3
              text-white
              text-xs
              border
              border-gray-700
            "
          >

            <div>
              <b>
                ${user.name || "مستخدم بدون اسم"}
              </b>
            </div>

            <div class="text-gray-400">
              📱 ${user.phone || ""}
            </div>

            <div class="text-blue-400">
              الدور:
              ${user.role || "pending"}
            </div>

            <div class="text-gray-400">
              الحالة:
              ${user.status || "-"}
            </div>

            <div class="text-gray-400">
              الشيفت:
              ${user.shift || "-"}
            </div>

            <div class="text-gray-400">
              القسم:
              ${user.department || "-"}
            </div>

          </div>

        `;

      }
    );


    container.innerHTML =
      html;


  } catch (error) {

    console.error(
      "LOAD USERS ERROR:",
      error
    );


    container.innerHTML = `

      <div
        class="
          text-red-400
          text-center
          py-6
        "
      >

        حدث خطأ أثناء تحميل المستخدمين

      </div>

    `;

  }

};


// ============================================================
// LOGOUT
// ============================================================

window.logout =
function () {

  localStorage.clear();

  currentRole = "";

  currentPermissions = [];

  navigateTo(
    "login"
  );

};


// ============================================================
// GLOBAL RENDER
// ============================================================

window.render =
  render;


// ============================================================
// INITIAL LOAD & ROUTING LISTENERS
// ============================================================

window.addEventListener(
  "hashchange",
  () => {
    const hash = window.location.hash.replace("#", "").trim();
    if (hash && hash !== currentPage) {
      currentPage = hash;
      render();
    }
  }
);

window.addEventListener(
  "DOMContentLoaded",
  () => {

    const initialHash =
      window.location.hash.replace("#", "").trim();

    const isLoggedIn =
      !!(
        localStorage.getItem("phone") ||
        localStorage.getItem("userId")
      );

    // ============================================
    // المستخدم غير مسجل دخول
    // ============================================

    if (!isLoggedIn) {

      if (initialHash === "register") {

        currentPage = "register";

      } else {

        currentPage = "login";

      }

    }

    // ============================================
    // المستخدم مسجل دخول
    // ============================================

    else {

      // لا تسمح بالرجوع إلى login أو register
      // عند تحديث الصفحة

      if (
        !initialHash ||
        initialHash === "login" ||
        initialHash === "register"
      ) {

        currentPage = "home";

        history.replaceState(
          { page: "home" },
          "",
          "#home"
        );

      } else {

        currentPage = initialHash;

      }

    }

    render();

  }
);
