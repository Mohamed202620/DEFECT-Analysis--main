// ============================================================
// renderCore.js
// حالة الصفحة الحالية + render() + navigateTo() + مستمعات
// الإقلاع الأولي للتطبيق (hashchange / DOMContentLoaded)
// (تم استخراجه من router.js دون أي تغيير في السلوك)
// ============================================================

import { renderPage } from './pageRenderer.js';
import { initMainChart, loadDashboardStats } from './workflow.js';
import { loadPendingUsers } from './views/RequestsView.js';

export let currentPage = 'login';

export let currentLang = 'ar';

window.currentLang = currentLang;

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

}
);
