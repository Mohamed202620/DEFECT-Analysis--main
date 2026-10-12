// ============================================================
// renderCore.js
// حالة الصفحة الحالية + render() + navigateTo() + مستمعات
// الإقلاع الأولي للتطبيق (hashchange / DOMContentLoaded)
// (تم استخراجه من router.js دون أي تغيير في السلوك)
// ============================================================

import { renderPage } from './pageRenderer.js';
import { Sidebar } from './components/Sidebar.js';
import { loadDashboardStats } from './workflow.js';
import { loadPendingUsers } from './views/RequestsView.js';
import { initKbView } from './knowledgeBase.js';
import { initStatsView } from './statistics.js';
import { initMaintenanceSearchView, renderMaintenanceSearchIfLoaded } from './maintenanceSearch.js';
import { auth, onAuthStateChanged } from './providers/backend/index.js';
import { ensureUserAndMachinesLoaded, refreshMachineTypesIfStale } from './machines.js';
import { applyManagerDesktopMode, isManagerDesktopEligible } from './managerDesktopCore.js'; // MGR-DESKTOP

// إعادة تحميل بيانات لوحة المتابعة وتزامن الماكينات تلقائياً بمجرد تأكيد الجلسة من Firebase Auth
// إصلاح (سباق عند دخول مرفوض/محذوف): login.js بيعمل signInWithEmailAndPassword
// بنجاح أولاً، ثم لو الحساب pending/rejected/غير موجود في Firestore بيعمل
// signOut فوراً. onAuthStateChanged هنا كان بيتنفذ فور نجاح signIn (قبل ما
// login.js يقرر يعمل signOut)، فكان بيبدأ تحميل بيانات الماكينات لمستخدم
// هيتم رفضه بعد لحظات - يفشل بـ "Missing or insufficient permissions" في
// الكونسول بلا أي فائدة. localStorage.userId مابيتخزنش إلا بعد نجاح تسجيل
// الدخول فعلياً على مستوى التطبيق (authHandlers.js)، فالتحقق منه هنا يمنع
// هذا التحميل غير الضروري بدون التأثير على أي Refresh عادي لمستخدم مسجّل
// دخوله فعلاً (userId بيكون موجود بالفعل وقتها).
if (auth) {
  onAuthStateChanged(auth, (user) => {
    if (user && localStorage.getItem("userId")) {
      ensureUserAndMachinesLoaded().catch(e => console.warn("Sync machines error:", e));
      if (currentPage === 'home' && typeof loadDashboardStats === 'function') {
        loadDashboardStats();
      }
    } else if (!user && localStorage.getItem("userId")) {
      // Test 16 (Session expired): لو جلسة Firebase انتهت/اتلغت (حساب اتحذف
      // أو اتوقف أو التوكن فشل تجديده) والتطبيق لسه فاتح صفحة محمية، كانت
      // كل الشاشات بتفضل تفشل بـ "Missing or insufficient permissions"
      // بدون رجوع لشاشة الدخول. التأخير 1 ثانية عشان تسجيل الخروج العادي
      // (signOut ثم localStorage.clear) والإقلاع مايتحسبوش انتهاء جلسة
      setTimeout(() => {
        if (auth.currentUser || !localStorage.getItem("userId")) return;
        if (currentPage === 'login' || currentPage === 'register') return;
        console.warn("Auth session ended - redirecting to login");
        if (typeof window.logout === 'function') window.logout();
      }, 1000);
    }
  });
}

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

// Test 16: إيقاف الكاميرا لو غادرنا صفحة QR أثناء المسح - قبل كده
// الكاميرا كانت بتفضل شغّالة (ومؤشرها ظاهر) وحلقة المسح مستمرة في
// الخلفية بعد التنقل لأي صفحة تانية
if (
  activePage === "qr" &&
  currentPage !== "qr" &&
  typeof window.stopQrScan === "function"
) {

  try { window.stopQrScan(); } catch (_) { /* الصفحة اتشالت - مفيش مشكلة */ }

}

activePage = currentPage;
applyManagerDesktopMode(); // MGR-DESKTOP

app.style.opacity = "0.4";

setTimeout(() => {

// Test 16: لو renderPage() رمت خطأ (بيانات ناقصة/View فيه bug) كانت
// الصفحة بتفضل معتمة (opacity 0.4) بمحتوى قديم بلا أي رسالة. دلوقتي
// بنعرض رسالة واضحة مع زر إعادة المحاولة بدل شاشة عالقة
try {
  app.innerHTML =
    renderPage(currentPage);
} catch (renderError) {
  console.error("Page render error (" + currentPage + "):", renderError);
  const isEnErr = currentLang === "en";
  app.innerHTML =
    '<div class="min-h-[60vh] flex items-center justify-center p-4 text-center">' +
    '<div class="bg-red-950/60 border border-red-500/50 text-red-200 p-6 rounded-2xl max-w-sm w-full space-y-3">' +
    '<h3 class="text-base font-bold text-red-400">' + (isEnErr ? "⚠️ Could not load this page" : "⚠️ تعذر تحميل هذه الصفحة") + '</h3>' +
    '<button onclick="location.reload()" class="w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white">' +
    (isEnErr ? "Retry" : "إعادة المحاولة") + '</button></div></div>';
}

app.style.opacity = "1";  

try {
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
} catch (_) {
  window.scrollTo(0, 0);
}  

// ========================================================
// DESKTOP SIDEBAR
// (قائمة جانبية ثابتة تظهر بدل BottomNav من مقاس md: وما فوق -
// بتتحدّث مع كل render() عشان التبويب النشط واللغة يفضلوا
// متزامنين مع باقي الصفحة. بتتخفي بالكامل في صفحات الدخول/التسجيل)
// ========================================================

const sidebarContainer = document.getElementById("sidebarContainer");

if (sidebarContainer) {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 1024;

  if (currentPage === "login" || currentPage === "register" || isMobile) {
    sidebarContainer.className = "hidden";
    sidebarContainer.innerHTML = "";
  } else {
    sidebarContainer.className = "hidden lg:block";
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
// HOME AUTO LOAD  
// ========================================================  

if (currentPage === "home") {  

  setTimeout(() => {  

    if (typeof isManagerDesktopEligible === "function" && isManagerDesktopEligible()) { // MGR-DESKTOP
      import('./views/managerDesktop/ManagerDesktopHome.js').then(m => m.initManagerDesktopHomeData()).catch(console.warn); // MGR-DESKTOP
    } else if (typeof loadDashboardStats === "function") {  

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

    // QR-IMPROVE: تعبئة الماكينة والخط تلقائياً عند التوجيه من مسح QR
    try {
      const preselectedMachine = localStorage.getItem('preselectedIssueMachine');
      const preselectedLine = localStorage.getItem('preselectedIssueLine');
      if (preselectedMachine) {
        localStorage.removeItem('preselectedIssueMachine');
        if (preselectedLine) localStorage.removeItem('preselectedIssueLine');
        import('./machines.js').then(m => {
          const parsed = m.parseMachineValue(preselectedMachine);
          const typeSel = document.getElementById('issueMachineType');
          const unitSel = document.getElementById('issueMachineUnit');
          const hidden = document.getElementById('issueMachine');
          if (typeSel && parsed.type) {
            typeSel.value = parsed.type;
            if (typeof window.__onMachineTypeChange === 'function') window.__onMachineTypeChange('issueMachine');
            if (unitSel && parsed.unit) {
              unitSel.value = parsed.unit;
              if (typeof window.__onMachineUnitChange === 'function') window.__onMachineUnitChange('issueMachine');
            } else if (hidden) {
              hidden.value = preselectedMachine;
            }
          }
        }).catch(() => {});
        if (preselectedLine && typeof window.selectIssueLine === 'function') {
          window.selectIssueLine(preselectedLine.includes('2') ? 'Line 2' : 'Line 1');
        }
      }
    } catch (_) {}

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
// MACHINE PROFILE (QR) AUTO LOAD
// (تحميل آخر نتيجة Daily AM/5S + السجل الأخير للماكينة المختارة -
// راجع MachineProfileView.js: window.loadMachineProfileData)
// ========================================================

if (currentPage === "machineProfile") {

  setTimeout(() => {

    if (typeof window.loadMachineProfileData === "function") {

      window.loadMachineProfileData();

    }

  }, 100);

}


// ========================================================
// DAILY AM FORM AUTO LOAD
// (تفعيل مكوّنات اختيار الصور لكل بند "Not OK" - راجع
// DailyAMView.js: initDailyAmView)
// ========================================================

if (currentPage === "dailyAM") {

  setTimeout(() => {

    if (typeof window.initDailyAmView === "function") {

      window.initDailyAmView();

    }

  }, 100);

}


// ========================================================
// CHECKLIST BUILDER AUTO LOAD (ITEMS-EDITOR)
// ========================================================
if (currentPage === "checklistBuilder") {

  setTimeout(() => {

    if (typeof window.initChecklistBuilderView === "function") {

      window.initChecklistBuilderView();

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
// SYSTEM HUB BADGES AUTO LOAD
// (شارة عدد طلبات الانضمام المعلّقة على بطاقة "طلبات الانضمام" -
// بند C1 في تقرير المراجعة - راجع loadSystemHubBadges في
// SystemView.js)
// ========================================================

if (currentPage === "system") {

  setTimeout(() => {

    if (typeof window.loadSystemHubBadges === "function") {
      window.loadSystemHubBadges();
    }

  }, 100);

}


// ========================================================
// SETTINGS AUTO LOAD
// (الإجازات الرسمية + Pattern الورديات + معاملات الإضافي - راجع
// holidaysManagement.js / attendancePatternManagement.js)
// ========================================================

if (currentPage === "settings") {

  setTimeout(() => {

    if (typeof window.loadHolidays === "function") {
      window.loadHolidays();
    }
    if (typeof window.loadAttendancePatternStatus === "function") {
      window.loadAttendancePatternStatus();
    }
    if (typeof window.loadPayrollRulesForm === "function") {
      window.loadPayrollRulesForm();
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
// MACHINES AUTO LOAD  
// ========================================================  

if (currentPage === "machines") {  
  setTimeout(() => {  
    if (typeof window.loadMachinesAdmin === "function") {  
      window.loadMachinesAdmin();  
    }  
  }, 100);  
}

  setTimeout(() => {
    applyManagerDesktopMode(); // MGR-DESKTOP
  }, 160);
}, 150);

}

// ============================================================
// NAVIGATION
// ============================================================

let internalNavCount = 0;

export function navigateTo(
page,
addToHistory = true
) {

currentPage =
page;

if (addToHistory) {
  internalNavCount++;
  history.pushState({ page }, "", `#${page}`);
} else {
  history.replaceState({ page }, "", `#${page}`);
}

render();

}

window.navigateTo =
navigateTo;

export function goBack(fallbackPage = 'home') {
  if (internalNavCount > 0) {
    internalNavCount--;
    history.back();
  } else {
    navigateTo(fallbackPage, false);
  }
}
window.goBack = goBack;

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

// إصلاح (منع الوصول لصفحات التطبيق بدون Authentication): أول تحميل
// للتطبيق محمي فعلاً (index.html بيتحقق من ensureAuthReady() قبل أي
// navigateTo)، لكن بعد كده تغيير الـ hash يدوياً من شريط العنوان أو
// زر Back/Forward في المتصفح كان بيغيّر currentPage ويعمل render()
// مباشرة من غير أي فحص جلسة تاني - يعني لو المستخدم سجّل خروجه (أو
// مسحش الجلسة أصلاً) وبدّل الـ hash لـ #home مثلاً، كانت الصفحة
// المحمية بترتسم كاملة. نفس فحص isLoggedIn المستخدم أصلاً في
// DOMContentLoaded تحت وفي pageRenderer.js (case 'home' وdefault).
function isSessionActive() {
  return !!(localStorage.getItem("phone") || localStorage.getItem("userId"));
}

window.addEventListener(
"hashchange",
() => {
const hash = window.location.hash.replace("#", "");
if (hash && hash !== currentPage) {
currentPage =
  (!isSessionActive() && hash !== "login" && hash !== "register")
    ? "login"
    : hash;
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

window.addEventListener("popstate", (e) => {
  if (internalNavCount > 0) internalNavCount--;
  const guard = (page) =>
    (!isSessionActive() && page !== "login" && page !== "register") ? "login" : page;
  if (e.state && e.state.page) {
    if (e.state.page !== currentPage) {
      currentPage = guard(e.state.page);
      render();
    }
  } else {
    const hash = window.location.hash.replace("#", "");
    if (hash && hash !== currentPage) {
      currentPage = guard(hash);
      render();
    }
  }
});

let _lastIsMobile = typeof window !== "undefined" ? (window.innerWidth < 1024 || window.matchMedia("(orientation: portrait)").matches) : false;
let _lastMgrDesktop = typeof window !== "undefined" && typeof isManagerDesktopEligible === "function" ? isManagerDesktopEligible() : false; // MGR-DESKTOP
window.addEventListener("resize", () => {
  const currentIsMobile = window.innerWidth < 1024 || window.matchMedia("(orientation: portrait)").matches;
  const currentMgrDesktop = typeof isManagerDesktopEligible === "function" ? isManagerDesktopEligible() : false; // MGR-DESKTOP
  applyManagerDesktopMode(); // MGR-DESKTOP
  if (_lastIsMobile !== currentIsMobile || _lastMgrDesktop !== currentMgrDesktop) { // MGR-DESKTOP
    _lastIsMobile = currentIsMobile;
    _lastMgrDesktop = currentMgrDesktop; // MGR-DESKTOP
    render();
  }
});

// ============================================================
// تحديث تلقائي للبيانات عند عودة الاتصال / الرجوع للتطبيق / تغيّر الصلاحيات
//
// المشكلة (مؤكدة بتتبع الكود): الاشتراكات اللحظية (التذاكر/الكايزن/الإشعارات) بتعيد
// الاتصال لوحدها، لكن باقي الشاشات (الرئيسية، الإحصائيات، البحث المتقدم، كاش الماكينات،
// الملف الشخصي/الصلاحيات) بتجيب بياناتها مرة واحدة عند فتح الصفحة. فلو الجلب فشل أثناء
// انقطاع الإنترنت (الرئيسية بتخرج بصمت)، أو التطبيق فضل في الخلفية ساعات (PWA)، كانت
// الأرقام بتفضل قديمة/فاضية لحد ما المستخدم يعمل Refresh. عودة الاتصال بس كانت بتزامن
// طابور الأوفلاين ولا تعيد جلب أي بيانات. الدوال هنا للقراءة فقط (مفيش كتابة ولا تغيير
// منطق)، وبتتخطى لو المستخدم بيكتب في حقل عشان مانضيّعش مدخلاته.
// ============================================================

function isUserTypingNow() {
  const node = document.activeElement;
  return !!node && (
    node.tagName === "INPUT" ||
    node.tagName === "TEXTAREA" ||
    node.tagName === "SELECT" ||
    node.isContentEditable
  );
}

let _profileChangedDuringRefresh = false;

// الدور/الصلاحيات/القسم اتغيّروا على السيرفر (راجع fetchCurrentUserProfileApi): نعيد
// رسم الصفحة الحالية مرة واحدة عشان الواجهة تطابق الصلاحيات الفعلية بدل ما تفضل بصلاحيات
// الجلسة القديمة. لو المستخدم بيكتب، التغيير بيتطبّق عند أول تنقل (القيم اتحدّثت فعلاً).
window.addEventListener("app:profilechanged", () => {
  _profileChangedDuringRefresh = true;
  if (!isSessionActive() || currentPage === "login" || currentPage === "register") return;
  if (isUserTypingNow()) return;
  render();
});

let _refreshingPageData = false;

async function refreshActivePageData(reason) {
  if (_refreshingPageData) return;
  if (!auth || !auth.currentUser || !isSessionActive()) return;
  if (currentPage === "login" || currentPage === "register") return;

  _refreshingPageData = true;
  _profileChangedDuringRefresh = false;

  try {
    // 1) الملف الشخصي (مصدر الدور/الصلاحيات) - لو اتغيّر بيتعمل render() من الحدث فوق
    try {
      const usersApi = await import("./services/usersApi.js");
      await usersApi.fetchCurrentUserProfileApi(true);
    } catch (_) { /* أوفلاين/خطأ مؤقت: المحاولة الجاية */ }

    // 2) كاش الماكينات (في الخلفية) - عند عودة الاتصال نجدده فوراً لأن آخر جلب ممكن يكون فشل
    refreshMachineTypesIfStale(reason === "online" ? 0 : 10 * 60 * 1000).catch(() => {});

    // render() اتنفّذ بسبب تغيّر الصلاحيات وهو بيشغّل محمّل الصفحة بنفسه
    if (_profileChangedDuringRefresh) return;

    // 3) بيانات الصفحة الحالية (قراءة فقط، من غير إعادة بناء الصفحة)
    if (isUserTypingNow()) {
      window.refreshNotificationsBadge && window.refreshNotificationsBadge();
      return;
    }

    switch (currentPage) {
      case "home":
        if (typeof isManagerDesktopEligible === "function" && isManagerDesktopEligible()) {
          import("./views/managerDesktop/ManagerDesktopHome.js")
            .then(m => m.initManagerDesktopHomeData())
            .catch(console.warn);
        } else if (typeof loadDashboardStats === "function") {
          loadDashboardStats();
        }
        break;
      case "stats":
        if (typeof initStatsView === "function") initStatsView();
        break;
      case "maintenanceSearch":
        if (typeof window.revalidateMaintenanceSearch === "function") window.revalidateMaintenanceSearch();
        break;
      case "system":
        if (typeof window.loadSystemHubBadges === "function") window.loadSystemHubBadges();
        break;
      case "kb":
        // الأثقل (كل أخطاء الماكينات): بس عند عودة الاتصال، مش مع كل رجوع للتطبيق
        if (reason === "online" && typeof initKbView === "function") initKbView();
        break;
      default:
        break;
    }

    window.refreshNotificationsBadge && window.refreshNotificationsBadge();
  } finally {
    _refreshingPageData = false;
  }
}

window.refreshActivePageData = refreshActivePageData;

// عودة الاتصال: ثانية تسمح للـ SDK يعيد فتح قنواته قبل أول طلب
window.addEventListener("online", () => {
  setTimeout(() => { refreshActivePageData("online"); }, 1000);
});

// الرجوع للتطبيق بعد غياب (PWA في الخلفية / تبويب مخفي) - بحد أدنى 60 ثانية غياب
// و30 ثانية بين كل تحديثين عشان مايبقاش فيه طلبات زيادة مع التبديل السريع بين التطبيقات
let _hiddenAt = 0;
let _lastResumeRefreshAt = 0;
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    _hiddenAt = Date.now();
    return;
  }
  const hiddenFor = _hiddenAt ? Date.now() - _hiddenAt : 0;
  _hiddenAt = 0;
  if (hiddenFor < 60000) return;
  if (Date.now() - _lastResumeRefreshAt < 30000) return;
  _lastResumeRefreshAt = Date.now();
  refreshActivePageData("resume");
});
