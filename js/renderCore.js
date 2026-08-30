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
import { initMaintenanceSearchView } from './maintenanceSearch.js';
import { refreshAttendanceCard } from './attendanceCard.js';
import './holidaysManagement.js';
import { auth } from './config.js';

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
  try {
    window.cleanupTicketsBoard();
  } catch (e) {
    console.warn("Cleanup tickets error:", e);
  }
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
  try {
    window.cleanupKaizenBoard();
  } catch (e) {
    console.warn("Cleanup kaizen error:", e);
  }
}

activePage = currentPage;

// رندر فوري مباشر لتجنب أي شاشة بيضاء أو تأخير على الموبايل
try {
  const renderedHtml = renderPage(currentPage);
  app.innerHTML = renderedHtml || "";
  app.style.opacity = "1";
} catch (renderError) {
  console.error("renderPage Error on (" + currentPage + "):", renderError);
  app.innerHTML = `
    <div class="min-h-screen flex items-center justify-center p-4 text-center bg-[#0F172A] text-white" dir="rtl">
      <div class="bg-red-950/80 border border-red-500/50 p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-3">
        <h3 class="text-base font-bold text-red-400">⚠️ تعذر عرض الصفحة (${currentPage})</h3>
        <p class="text-xs text-yellow-300 font-mono break-all text-left" style="direction:ltr">
          ${String(renderError?.message || renderError)}
        </p>
        <div class="flex gap-2 justify-center pt-2">
          <button onclick="window.navigateTo('home')" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white transition">الرئيسية</button>
          <button onclick="window.navigateTo('login')" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-xs font-bold text-white transition">تسجيل الدخول</button>
        </div>
      </div>
    </div>
  `;
  app.style.opacity = "1";
}

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
  try {
    window.refreshHeader();
  } catch (e) {
    console.warn("refreshHeader warning:", e);
  }
}

// ========================================================
// NOTIFICATIONS BADGE AUTO REFRESH
// (شارة عدد الإشعارات غير المقروءة فوق زر 🔔 بالشريط السفلي -
// BottomNav.js موجود في كل الصفحات تقريباً، فبنحدّث الشارة بعد كل
// render() بنفس أسلوب باقي "AUTO LOAD" تحت. الدالة نفسها آمنة لو
// الزرار مش موجود في الصفحة الحالية أصلاً - راجع NotificationsModal.js)
// ========================================================

if (typeof window.refreshNotificationsBadge === "function") {
  try {
    window.refreshNotificationsBadge();
  } catch (e) {
    console.warn("refreshNotificationsBadge warning:", e);
  }
}


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

    if (typeof refreshAttendanceCard === "function") {

      refreshAttendanceCard();

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


// ========================================================  
// SETTINGS AUTO LOAD (الإجازات الرسمية)
// ========================================================  

if (currentPage === "settings") {  

  setTimeout(() => {  

    if (typeof window.loadHolidays === "function") {  

      window.loadHolidays();  

    }  

  }, 100);  

}


// ========================================================  
// TICKET DETAILS AUTO LOAD
// ========================================================  

if (currentPage === "ticketDetails") {  

  setTimeout(() => {  

    if (typeof window.loadTicketDetails === "function") {  

      window.loadTicketDetails();  

    }  

  }, 100);  

}

}

// ============================================================
// NAVIGATION
// ============================================================

export async function navigateTo(page, addToHistory = true) {
  currentPage = page;
  if (addToHistory) {
    history.pushState({ page }, "", `#${page}`);
  }
  
  // رندر فوري للصفحة لضمان الاستجابة السريعة وعدم ظهور أي شاشة بيضاء
  render();

  // فحص حالة الجلسة بالخلفية بدون تعطيل إظهار الصفحة للمستخدم
  if (page !== "login" && page !== "register") {
    try {
      const hasLocalUser = localStorage.getItem("phone") || localStorage.getItem("userId");
      if (!hasLocalUser) {
        console.warn("No user credentials found in storage. Redirecting to login.");
        currentPage = "login";
        render();
        return;
      }

      if (auth && typeof auth.authStateReady === "function" && auth.currentUser === null) {
        const timeoutPromise = new Promise(resolve => setTimeout(resolve, 2000));
        await Promise.race([auth.authStateReady(), timeoutPromise]);
      }
    } catch (e) {
      console.warn("Auth check non-blocking warning:", e);
    }
  }
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
