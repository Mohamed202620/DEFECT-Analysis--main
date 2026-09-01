// ============================================================
// renderCore.js
// حالة الصفحة الحالية + render() + navigateTo() + مستمعات
// الإقلاع الأولي للتطبيق (hashchange / DOMContentLoaded)
// (تم استخراجه من router.js دون أي تغيير في السلوك)
// ============================================================

import { renderPage } from './pageRenderer.js';
import { Sidebar } from './components/Sidebar.js';
import { initMainChart, loadDashboardStats } from './workflow.js';
import { loadPendingUsers } from './views/RequestsView.js';
import { initKbView } from './knowledgeBase.js';
import { initStatsView } from './statistics.js';
import { initMaintenanceSearchView, renderMaintenanceSearchIfLoaded } from './maintenanceSearch.js';

export let currentPage = 'login';

// إصلاح: كانت اللغة دايماً 'ar' في كل تحميل صفحة حتى لو المستخدم
// بدّلها قبل كده - دلوقتي بنقرأ آخر لغة محفوظة (نفس أسلوب حفظ
// الثيم في theme.js) عشان اختيار المستخدم يفضل زي ما هو بعد أي
// تحديث/تسجيل دخول جديد
export let currentLang = localStorage.getItem('lang') || 'ar';

window.currentLang = currentLang;

// مزامنة اتجاه/لغة صفحة HTML مع اللغة المحفوظة من أول تحميل (كانت
// index.html ثابتة على lang="ar" dir="rtl" دايماً بغض النظر عن
// اللغة الفعلية المحفوظة)
document.documentElement.setAttribute('lang', currentLang);
document.documentElement.setAttribute('dir', currentLang === 'ar' ? 'rtl' : 'ltr');

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
// DESKTOP SIDEBAR
// (قائمة جانبية ثابتة تظهر بدل BottomNav من مقاس md: وما فوق -
// بتتحدّث مع كل render() عشان التبويب النشط واللغة يفضلوا
// متزامنين مع باقي الصفحة. بتتخفي بالكامل في صفحات الدخول/التسجيل)
// ========================================================

const sidebarContainer = document.getElementById("sidebarContainer");

if (sidebarContainer) {

  if (currentPage === "login" || currentPage === "register") {

    sidebarContainer.className = "hidden";
    sidebarContainer.innerHTML = "";

  } else {

    sidebarContainer.className = "hidden md:block";
    sidebarContainer.innerHTML = Sidebar(currentPage);

  }

}



// ========================================================
// APP HEADER AUTO REFRESH
// (تحديث الهيدر وبيانات المستخدم والشارة واللغة النشطة مع كل تنقل)
// ========================================================

if (typeof window.refreshHeader === "function") {
  window.refreshHeader();
}

// ========================================================
// NOTIFICATIONS BADGE AUTO REFRESH
// (شارة عدد الإشعارات غير المقروءة فوق زر 🔔 بالشريط السفلي -
// BottomNav.js موجود في كل الصفحات تقريباً، فبنحدّث الشارة بعد كل
// render() بنفس أسلوب باقي "AUTO LOAD" تحت. الدالة نفسها آمنة لو
// الزرار مش موجود في الصفحة الحالية أصلاً - راجع NotificationsModal.js)
// ========================================================

if (typeof window.refreshNotificationsBadge === "function") {

  window.refreshNotificationsBadge();

}


// ========================================================
// NOTIFICATION PERMISSION BANNER (إشعارات المتصفح - بديل عملي
// لـ Push الحقيقي بدون سيرفر، راجع pushNotifications.js)
// (بيظهر بس في صفحة الرئيسية عشان ميبقاش مزعج في كل صفحة، والدالة
// نفسها آمنة وبترجع فوراً لو الشروط (صلاحية لسه متسألتش/مش مقفول
// قبل كده...) مش متوفرة)
// ========================================================

if (currentPage === "home" && typeof window.renderNotificationPermissionBanner === "function") {

  window.renderNotificationPermissionBanner();

}


// ========================================================  
// HOME CHART AUTO LOAD  
// (initMainChart لم تكن تُستدعى أبداً سابقاً، لذلك كان الرسم
// البياني في الرئيسية لا يظهر أبداً)
// ========================================================  

if (currentPage === "home") {  

  setTimeout(() => {  

    // إصلاح (البيانات مش بتظهر في الرئيسية): initMainChart() كانت لو
    // رمت استثناء (مثلاً Chart.js من الـ CDN لسه متحملتش) كانت بتمنع
    // تنفيذ loadDashboardStats() اللي جاي بعدها في نفس الاستدعاء
    // المتزامن - يعني كل بيانات الرئيسية (فتح/مغلق/اليوم/متأخر/
    // الإجمالي...) كانت متتجابش أصلاً. عزل كل استدعاء في try خاص بيه
    // عشان فشل أحدهما مايمنعش التاني
    if (typeof initMainChart === "function") {  

      try {
        initMainChart();
      } catch (chartError) {
        console.warn("[HOME AUTO LOAD] تعذّر تهيئة الرسم البياني الرئيسي:", chartError);
      }

    }  

    if (typeof loadDashboardStats === "function") {  

      loadDashboardStats();  

    }  

  }, 100);  

}  


// ========================================================  
// ISSUE FORM (تسجيل عطل) AUTO LOAD
// (تفعيل مكوّن اختيار الصور المتعددة بعد إدراج HTML الفورم فعلياً
// في الصفحة - راجع workflow.js: initIssueAttachments)
// ========================================================  

if (currentPage === "issue") {  

  setTimeout(() => {  

    if (typeof window.initIssueAttachments === "function") {  

      window.initIssueAttachments();  

    }  

  }, 100);  

}  


// ========================================================  
// KAIZEN SUGGESTION FORM (مقترح كايزن) AUTO LOAD
// (تفعيل مكوّن اختيار الصور المتعددة بعد إدراج HTML الفورم فعلياً
// في الصفحة - راجع views/suggestionView.js: initSuggestionAttachments)
// ========================================================  

if (currentPage === "suggestions") {  

  setTimeout(() => {  

    if (typeof window.initSuggestionAttachments === "function") {  

      window.initSuggestionAttachments();  

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

    // إصلاح (تحسين الأداء): لو البيانات كانت اتحمّلت قبل كده في نفس
    // الجلسة (المستخدم فتح نفس الصفحة تاني بدون أي تغيير)، منعيدش
    // نداء initMaintenanceSearchView() تاني (وبالتالي منعيدش جلب
    // Firestore من الصفر) - بس بنعيد رسم نفس النتائج المحفوظة فعلاً،
    // لأن #mResultsBox بيتبني من جديد فاضي وقت التنقل بين الصفحات.
    // إعادة التحميل الفعلي (Force Refresh) لسه متاحة عبر زر "إعادة
    // المحاولة" (window.retryMaintenanceSearchLoad بيصفّر isLoaded
    // بنفسه قبل ما يستدعي initMaintenanceSearchView() من جديد)
    const alreadyRendered =
      typeof renderMaintenanceSearchIfLoaded === "function" &&
      renderMaintenanceSearchIfLoaded();

    if (!alreadyRendered && typeof initMaintenanceSearchView === "function") {  

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
// LANGUAGE TOGGLE
// إصلاح: زر تبديل اللغة (داخل homeView.js) كان بيستدعي دالة
// window.switchLanguage() غير موجودة في أي مكان بالمشروع، فكان
// بيقع دايماً على الاحتياطي: location.reload() (تحديث كامل
// للصفحة) - وده كان بيفقد حالة الـ SPA وبيقتصر عملياً على زرار
// موجود بس في الصفحة الرئيسية.
//
// الدالة window.toggleLanguage() هنا كانت بالفعل معرّفة وكاملة
// (تبدّل اللغة، تحفظها، تحدّث اتجاه الصفحة) لكن محدش كان بينادي
// عليها فعلياً. دلوقتي homeView.js بينادي عليها مباشرة، وهي بتعمل
// render() لإعادة رسم الصفحة النشطة بالكامل (شاملة BottomNav.js
// اللي موجود في كل صفحة تقريباً) فوراً من غير Full Page Reload -
// فأي صفحة فرعية أو الشريط السفلي بيتحدّثوا للغة الجديدة في نفس
// اللحظة، مع الحفاظ على حالة الـ SPA.
// ============================================================

window.toggleLanguage = function () {

  currentLang = currentLang === 'ar' ? 'en' : 'ar';
  window.currentLang = currentLang;
  localStorage.setItem('lang', currentLang);

  document.documentElement.setAttribute('lang', currentLang);
  document.documentElement.setAttribute('dir', currentLang === 'ar' ? 'rtl' : 'ltr');

  // render() بيعيد رسم الصفحة النشطة بالكامل (وجوّاها BottomNav.js
  // زي كل صفحة تانية) باللغة الجديدة فوراً، من غير أي Full Page
  // Reload - فأي صفحة فرعية أو الشريط السفلي بيتحدّثوا في نفس اللحظة

  render();

  // Dispatch Event عام لأي مكوّن مستقبلي يحتاج يعرف إن اللغة اتغيّرت
  // من غير ما يتربط مباشرة بـ render()/toggleLanguage() (مثال:
  // مكتبة خارجية أو Widget بيتحمّل بره دورة renderPage() العادية)
  window.dispatchEvent(
    new CustomEvent('app:languagechange', { detail: { lang: currentLang } })
  );

};

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

// ملاحظة: هذا الـ listener فعلياً "ميت" في التطبيق الحالي - لأن
// هذا الملف بيتحمّل عبر import() ديناميكي جوه index.html، وده بياخد
// وقت (تحميل + تنفيذ عشرات ملفات JS المترابطة) بيخلّي حدث
// "DOMContentLoaded" يكون اتطلق بالفعل قبل حتى ما يوصل التنفيذ هنا
// ويسجّل الـ listener، فمعظم الوقت الكود جوّاه ميتنفذش أبداً.
// التنقل الفعلي عند أول تحميل بيحصل من index.html نفسه (اللي بيعمل
// router.navigateTo() بعد ما الـ import يخلص) - وهو اللي اتصلح
// لتفعيل جرس الإشعارات كمان (راجع index.html)
window.addEventListener(
"DOMContentLoaded",
() => {

const initialHash =  
  window.location.hash  
    .replace("#", "");  

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
