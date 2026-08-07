// ============================================================
// app.js
// النظام الرئيسي للتطبيق + نظام الصلاحيات الموحد
// ============================================================

import { PageView } from './components/PageView.js';
import { translations } from './config.js';
import { login } from './auth/login.js';
import { fetchUsers, registerUserApi, updateUserStatusApi } from './services/api.js';
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
import { RequestsView, loadPendingUsers } from './views/RequestsView.js';
import { saveDefectData, handleDefectFile, initMainChart } from './workflow.js';

// ============================================================
// GLOBAL STATE
// ============================================================
export let currentPage = 'login';
export let currentLang = 'ar';
export let currentRole = (localStorage.getItem("role") || "").toLowerCase();
export let currentPermissions = (localStorage.getItem("permissions") || "").split(",").map(p => p.trim().toLowerCase()).filter(Boolean);

window.currentLang = currentLang;

// ============================================================
// التحقق من الصلاحية
// ============================================================
export function hasPermission(permission) {
  const perm = String(permission || "").trim().toLowerCase();
  if (!perm) return false;
  if (currentRole === "admin") return true;
  if (currentPermissions.includes("all")) return true;
  return currentPermissions.includes(perm);
}

window.hasPermission = hasPermission;
window.can = hasPermission;

// ============================================================
// رندر الصفحات
// ============================================================
export function renderPage(page) {
  switch (page) {
    case 'login': return LoginView();
    case 'register': return RegisterView();
    case 'home': return HomeView();
    case 'maintenance': return hasPermission("maintenance") ? MaintenanceView() : unauthorizedPage("maintenance");
    case 'issue': return hasPermission("issue") ? IssueView() : unauthorizedPage("issue");
    case 'suggestion': case 'suggestions': return hasPermission("suggestion") ? SuggestionView() : unauthorizedPage("suggestion");
    case 'pm': return hasPermission("pm") ? PMView() : unauthorizedPage("pm");
    case 'quality': return hasPermission("quality") ? QualityView() : unauthorizedPage("quality");
    case 'report': return hasPermission("reports") ? ReportView() : unauthorizedPage("reports");
    case 'reports': return hasPermission("reports") ? ReportsView() : unauthorizedPage("reports");
    
    case 'users':
      return hasPermission("users") ? PageView("👥 إدارة المستخدمين", `
        <div class="space-y-3">
            <button onclick="window.loadUsers()" class="w-full bg-blue-600 rounded-lg p-3 font-bold text-white text-xs">تحديث القائمة</button>
            <div id="usersContainer" class="mt-4">
                <div class="text-center text-gray-500 text-xs">جاري تحميل البيانات...</div>
            </div>
        </div>
      `) : unauthorizedPage("users");

    case 'requests': return hasPermission("requests") ? RequestsView() : unauthorizedPage("requests");
    case 'system': return SystemView();
    default: return LoginView();
  }
}

function unauthorizedPage(permission) {
  return PageView("⚠️ غير مصرح", `<div class="bg-[#1E293B] p-6 rounded-xl border border-red-500/30 text-center text-xs text-red-400 font-bold">ليس لديك صلاحية للوصول إلى: ${permission}</div>`);
}

// ============================================================
// RENDER & NAVIGATION
// ============================================================
export function render() {
  const app = document.getElementById("app");
  if (!app) return;

  app.style.opacity = "0.4";
  
  setTimeout(() => {
    app.innerHTML = renderPage(currentPage);
    app.style.opacity = "1";

    // التشغيل التلقائي عند فتح صفحة المستخدمين
    if (currentPage === "users") {
      setTimeout(() => {
        if (typeof window.loadUsers === "function") {
          window.loadUsers();
        }
      }, 100);
    }
    
    // التشغيل التلقائي لطلبات الانضمام
    if (currentPage === "requests" && typeof loadPendingUsers === "function") {
      loadPendingUsers();
    }
  }, 150);
}

export function navigateTo(page, addToHistory = true) {
  currentPage = page;
  if (addToHistory) history.pushState({ page }, "", `#${page}`);
  render();
}

// ============================================================
// LOGIC: LOAD USERS (DIAGNOSTIC VERSION)
// ============================================================
window.loadUsers = async function () {
  console.log("DEBUG: Load Users Started...");
  const container = document.getElementById("usersContainer");
  
  const result = await fetchUsers();
  console.log("DEBUG: API Result:", result);

  if (result.status !== "success") {
    if (container) container.innerHTML = `<div class="text-red-400 text-center">خطأ: ${result.message}</div>`;
    return;
  }

  const usersList = result.data || [];
  console.log("DEBUG: Users Count:", usersList.length);

  if (usersList.length === 0) {
    if (container) container.innerHTML = `<div class="text-center text-gray-500">لا يوجد مستخدمون مسجلون حالياً</div>`;
    return;
  }

  let html = "";
  usersList.forEach(user => {
    html += `
      <div class="bg-[#1E293B] rounded-xl p-3 mb-3 text-white text-xs border border-gray-700">
        <div><b>${user.name || "مستخدم بدون اسم"}</b></div>
        <div class="text-gray-400">${user.phone || ""}</div>
        <div class="text-blue-400">الدور: ${user.role || "user"}</div>
      </div>
    `;
  });

  if (container) container.innerHTML = html;
};

// ربط الوظائف بـ Window
window.navigateTo = navigateTo;
window.render = render;
window.logout = function() {
    localStorage.clear();
    navigateTo("login");
};

// التشغيل الأولي
window.addEventListener("DOMContentLoaded", () => {
    const initialHash = window.location.hash.replace("#", "");
    currentPage = initialHash && initialHash !== "login" ? initialHash : "home";
    render();
});
