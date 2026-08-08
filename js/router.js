// ============================================================
// app.js
// النظام الرئيسي للتطبيق + نظام الصلاحيات الموحد v2
// ============================================================

import { PageView } from './components/PageView.js';
import { translations } from './config.js';
import { login } from './auth/login.js';
import { fetchUsers, registerUserApi } from './services/api.js';
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

// ============================================================
// GLOBAL STATE & HELPERS
// ============================================================

export let currentPage = 'login';
export let currentLang = 'ar';
export let currentRole = '';
export let currentPermissions = [];

// دالة جديدة: نعيد تحميل البيانات من localStorage
function loadAuthFromStorage() {
    currentRole = (localStorage.getItem("role") || "").toLowerCase();
    currentPermissions = (localStorage.getItem("permissions") || "").split(",").map(p => p.trim().toLowerCase()).filter(Boolean);
}

window.currentLang = currentLang;

// الدارك مود
const savedTheme = localStorage.getItem("theme") || "dark";
document.documentElement.classList.toggle("dark", savedTheme === "dark");

window.toggleDarkMode = function() {
    const isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
};

// ============================================================
// التحقق من الصلاحية
// ============================================================

export function hasPermission(permission) {
    const perm = String(permission || "").trim().toLowerCase();
    if (!perm) return false;
    if (currentRole === "admin") return true; // الادمن يشوف الكل
    if (currentPermissions.includes("all")) return true;
    return currentPermissions.includes(perm);
}

window.hasPermission = hasPermission;

// ============================================================
// RENDER PAGES
// ============================================================

export function renderPage(page) {
    switch (page) {
        case 'login': return LoginView();
        case 'register': return RegisterView();
        case 'home': return HomeView();
        
        case 'maintenance': return hasPermission("maintenance") ? MaintenanceView() : unauthorizedPage("maintenance");
        case 'issue': return hasPermission("issue") ? IssueView() : unauthorizedPage("issue");
        case 'suggestion': case 'suggestions': return hasPermission("suggestions") ? SuggestionView() : unauthorizedPage("suggestions");
        case 'pm': return hasPermission("pm") ? PMView() : unauthorizedPage("pm");
        case 'quality': return hasPermission("quality") ? QualityView() : unauthorizedPage("quality");
        case 'report': case 'reports': return hasPermission("reports") ? ReportsView() : unauthorizedPage("reports");
        
        case 'users': return hasPermission("users") ? PageView("👥 إدارة المستخدمين", `<div class="space-y-3"><button onclick="window.loadUsers()" class="w-full bg-blue-600 hover:bg-blue-500 rounded-lg p-3 font-bold text-white text-xs">🔄 تحديث القائمة</button><div id="usersContainer" class="mt-4"><div class="text-center text-gray-500 text-xs">جاري تحميل البيانات...</div></div></div>`) : unauthorizedPage("users");
        
        case 'requests': return hasPermission("requests") ? RequestsView() : unauthorizedPage("requests");

        case 'system': return hasPermission("system") ? SystemView() : unauthorizedPage("system"); // <-- التعديل هنا

        default: return LoginView();
    }
}

// ============================================================
// UNAUTHORIZED
// ============================================================
function unauthorizedPage(permission) {
    return PageView("⚠️ غير مصرح", `<div class="bg-[#1E293B] p-6 rounded-xl border-red-500/30 text-center text-xs text-red-400 font-bold">ليس لديك صلاحية للوصول إلى: ${permission}</div>`);
}

// ============================================================
// RENDER
// ============================================================
export function render() {
    const app = document.getElementById("app");
    if (!app) return;
    app.style.opacity = "0.4";
    setTimeout(() => {
        app.innerHTML = renderPage(currentPage);
        app.style.opacity = "1";
        if (currentPage === "users" && typeof window.loadUsers === "function") setTimeout(() => window.loadUsers(), 100);
        if (currentPage === "requests" && typeof loadPendingUsers === "function") setTimeout(() => loadPendingUsers(), 100);
    }, 150);
}

// ============================================================
// NAVIGATION
// ============================================================
export function navigateTo(page, addToHistory = true) {
    currentPage = page;
    if (addToHistory) history.pushState({ page }, "", `#${page}`);
    render();
}
window.navigateTo = navigateTo;

// ============================================================
// LOGIN
// ============================================================
window.doLogin = async function () {
    try {
        const phoneInput = document.getElementById("loginPhone");
        const passwordInput = document.getElementById("loginPass");
        const phone = phoneInput?.value?.trim() || "";
        const password = passwordInput?.value?.trim() || "";
        if (!phone || !password) { alert("⚠️ يرجى إدخال رقم الموبايل وكلمة السر."); return; }
        
        const button = document.getElementById("loginBtn");
        if (button) { button.disabled = true; button.innerText = "جاري تسجيل الدخول..."; }

        const result = await login(phone, password);
        
        if (button) { button.disabled = false; button.innerText = "دخول"; }
        if (!result || result.status !== "success") { alert(result?.message || "فشل تسجيل الدخول."); return; }

        const user = result.user || {};
        localStorage.setItem("userId", user.id || user.uid || "");
        localStorage.setItem("name", user.name || "");
        localStorage.setItem("phone", user.phone || phone);
        localStorage.setItem("role", (user.role || "").trim().toLowerCase());
        localStorage.setItem("permissions", user.permissions || "");

        loadAuthFromStorage(); // <-- التعديل هنا: نعيد التحميل
        
        navigateTo("home");
    } catch (error) {
        console.error("LOGIN ERROR:", error);
        const button = document.getElementById("loginBtn");
        if (button) { button.disabled = false; button.innerText = "دخول"; }
        alert("حدث خطأ أثناء تسجيل الدخول.");
    }
};

// ============================================================
// LOGOUT
// ============================================================
window.logout = function () {
    localStorage.clear();
    loadAuthFromStorage(); // نمسح من المتغيرات كمان
    navigateTo("login");
};

// ============================================================
// INITIAL LOAD & ROUTING LISTENERS
// ============================================================
window.addEventListener("hashchange", () => {
    const hash = window.location.hash.replace("#", "");
    if (hash && hash !== currentPage) {
        currentPage = hash;
        render();
    }
});

window.addEventListener("DOMContentLoaded", () => {
    loadAuthFromStorage(); // <-- اهم تعديل: نحمل البيانات اول ما الصفحة تفتح
    
    const initialHash = window.location.hash.replace("#", "");
    const isLoggedIn = !!(localStorage.getItem("userId") && localStorage.getItem("phone") && currentRole); // شرط اقوى

    if (!isLoggedIn) {
        localStorage.clear(); // نمسح اي بيانات ناقصة
        currentPage = (initialHash === "register") ? "register" : "login";
    } else {
        currentPage = (!initialHash || initialHash === "login" || initialHash === "register") ? "home" : initialHash;
        if(currentPage === "home") history.replaceState({ page: "home" }, "", "#home");
    }
    render();
});
