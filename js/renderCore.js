// ============================================================
// renderCore.js
// حالة الصفحة الحالية + render() + navigateTo() + مستمعات
// الإقلاع الأولي للتطبيق (hashchange / DOMContentLoaded)
// (تم استخراجه من router.js دون أي تغيير في السلوك)
// ============================================================

import { renderPage } from './pageRenderer.js';
import { initMainChart, loadDashboardStats } from './workflow.js';
import { loadPendingUsers } from './views/RequestsView.js';
import { initKbView } from './knowledgeBase.js';
import { initStatsView } from './statistics.js';
import { initMaintenanceSearchView } from './maintenanceSearch.js';

export let currentPage = 'login';

export let currentLang = 'ar';

window.currentLang = currentLang;

// الصفحة المعروضة فعلياً قبل استدعاء render() الحالي - بتُستخدم
// بس عشان نعرف "بنغادر صفحة إيه" (زي 'tickets') فنقفل أي Real-time
// listener خاص بيها قبل ما نبدّل المحتوى (راجع TICKETS CLEANUP تحت)
let activePage = null;

// ============================================================
// RENDER
// ============================================================

export function render() {

const app =
document.getElementById("app");

if (!app) return;

// ========================================================
// TICKETS CLEANUP
// (لو كنا في صفحة 'tickets' وهنغادرها لصفحة تانية، اقفل الـ
// onSnapshot listener بتاع لوحة متابعة البلاغات أولاً)
// ========================================================

if (
  activePage === "tickets" &&
  currentPage !== "tickets" &&
  typeof window.cleanupTicketsBoard === "function"
) {

  window.cleanupTicketsBoard();

}

// ========================================================
// KAIZEN BOARD CLEANUP
// (لو كنا في صفحة 'kaizenBoard' وهنغادرها لصفحة تانية، اقفل الـ
// onSnapshot listener بتاعها - نفس فكرة تنظيف صفحة التذاكر لكن
// مستقلة تماماً، راجع kaizenBoard.js)
// ========================================================

if (
  activePage === "kaizenBoard" &&
  currentPage !== "kaizenBoard" &&
  typeof window.cleanupKaizenBoard === "function"
) {

  window.cleanupKaizenBoard();

}

activePage = currentPage;

app.style.opacity = "0.4";

setTimeout(() => {

app.innerHTML =  
  renderPage(currentPage);  

app.style.opacity = "1";  


// ========================================================  
// HOME CHART AUTO LOAD  
// (initMainChart لم تكن تُستدعى أبداً سابقاً، لذلك كان الرسم
// البياني في الرئيسية لا يظهر أبداً)
// ========================================================  

if (currentPage === "home") {  

  setTimeout(() => {  

    if (typeof initMainChart === "function") {  

      initMainChart();  

    }  

    if (typeof loadDashboardStats === "function") {  

      loadDashboardStats();  

    }  

  }, 100);  

}  


// ========================================================  
// KNOWLEDGE BASE (kb) AUTO LOAD  
// ========================================================  

if (currentPage === "kb") {  

  setTimeout(() => {  

    if (typeof initKbView === "function") {  

      initKbView();  

    }  

  }, 100);  

}  


// ========================================================  
// STATS AUTO LOAD  
// ========================================================  

if (currentPage === "stats") {  

  setTimeout(() => {  

    if (typeof initStatsView === "function") {  

      initStatsView();  

    }  

  }, 100);  

}  


// ========================================================  
// MAINTENANCE SEARCH AUTO LOAD
// (صفحة "البحث والفلترة المتقدمة" - تحميل بلاغات الأعطال وسجلات
// الصيانة الوقائية مرة واحدة عند فتح الصفحة، بنفس أسلوب STATS/KB)
// ========================================================  

if (currentPage === "maintenanceSearch") {  

  setTimeout(() => {  

    if (typeof initMaintenanceSearchView === "function") {  

      initMaintenanceSearchView();  

    }  

  }, 100);  

}  


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
// TICKETS AUTO LOAD
// (لوحة متابعة البلاغات - Real-time عبر onSnapshot، بتتفعّل
// تلقائياً من غير أي زرار "تحديث" يدوي - راجع ticketsBoard.js)
// ========================================================  

if (currentPage === "tickets") {  

  setTimeout(() => {  

    if (typeof window.loadTicketsBoard === "function") {  

      window.loadTicketsBoard();  

    }  

  }, 100);  

}  


// ========================================================  
// KAIZEN BOARD AUTO LOAD
// (لوحة متابعة الكايزن - Real-time عبر onSnapshot، بتتفعّل تلقائياً
// من غير أي زرار "تحديث" يدوي - راجع kaizenBoard.js)
// ========================================================  

if (currentPage === "kaizenBoard") {  

  setTimeout(() => {  

    if (typeof window.loadKaizenBoard === "function") {  

      window.loadKaizenBoard();  

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

window.render =
render;

// ============================================================
// INITIAL LOAD & ROUTING LISTENERS
// ============================================================

window.addEventListener(
"hashchange",
() => {
const hash = window.location.hash.replace("#", "");
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
  window.location.hash  
    .replace("#", "");  

// التحقق بالاعتماد على وجود رقم الهاتف أو الـ userId لضمان عدم الخروج الوهمي  
const isLoggedIn =  
  localStorage.getItem("phone") ||  
  localStorage.getItem("userId");  


if (!isLoggedIn) {  

  currentPage = (initialHash === "register") ? "register" : "login";  

} else {  

  currentPage =  
    initialHash  
    &&  
    initialHash !== "login"  
    &&  
    initialHash !== "register"  

      ? initialHash  

      : "home";  

}  

render();

// تفعيل جرس الإشعارات لو فيه جلسة دخول محفوظة بالفعل (Refresh)
if (isLoggedIn && typeof window.initNotificationBell === "function") {
  window.initNotificationBell();
}

}
);
