// ============================================================
// pageRenderer.js
// جدول التوجيه بين الصفحات (renderPage) + صفحات "غير مصرح"
// و"قيد التطوير"
// (تم استخراجه من router.js دون أي تغيير في السلوك - نفس ترتيب
// الـ cases، ونفس فحوصات الصلاحيات لكل صفحة بالضبط)
// ============================================================

import { PageView } from './components/PageView.js';
import { hasPermission } from './permissions.js';
import { translations } from './config.js';

// إصلاح (ترجمة شاملة): نصوص "قيد التطوير"/"غير مصرح" وشاشات
// users/tickets/kaizenBoard المُضمَّنة هنا مباشرة كانت ثابتة بالعربي
// - دلوقتي بتقرأ من translations.pageRenderer حسب window.currentLang
function t() {
  const currentLang = window.currentLang || "ar";
  return (translations[currentLang] || translations.ar).pageRenderer;
}

import { LoginView } from './views/loginView.js';
import { RegisterView } from './views/registerView.js';
import { HomeView } from './views/homeView.js';
import { PMView } from './views/pmView.js';
import { ReportView } from './views/reportView.js';
import { ReportsView } from './views/reportsView.js';
import { SuggestionView } from './views/suggestionView.js';
import { IssueView } from './views/issueView.js';
import { MaintenanceView } from './views/MaintenanceView.js';
import { MaintenanceSearchView } from './views/MaintenanceSearchView.js';
import { SystemView } from './views/SystemView.js';
import { ErrorScannerView } from './views/ErrorScannerView.js';
import { KnowledgeBaseView } from './views/KnowledgeBaseView.js';
import { RequestsView, UsersManagementView } from './views/RequestsView.js';
import { MachinesView } from './views/MachinesView.js';
import { StatsView } from './views/StatsView.js';

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


case 'maintenanceSearch':  

  // صفحة "البحث والفلترة المتقدمة" - نفس صلاحية شاشة قسم الصيانة
  // نفسها (maintenance)، بما إنها صفحة فرعية منها (زر الدخول ليها
  // موجود جوه MaintenanceView.js)
  return hasPermission("maintenance")  
    ? MaintenanceSearchView()  
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


case 'tickets':  

  // لوحة متابعة دورة حياة التذكرة - نفس نمط صفحة 'users' تماماً
  // (PageView + حاوية بيتم ملؤها ببيانات Firestore عبر
  // window.loadTicketsBoard). البيانات دلوقتي Real-time بالكامل
  // عبر onSnapshot (راجع ticketsBoard.js + subscribeToTicketsBoardApi)
  // فمفيش زرار "تحديث" يدوي ولا حالة تحميل أولى تنتظر ضغطة -
  // renderCore.js بينادي window.loadTicketsBoard() تلقائياً عند
  // فتح الصفحة (نفس نمط AUTO LOAD بتاع users/kb/stats).
  return hasPermission("maintenance")  
    ? PageView(  
        t().ticketsTitle,  
        `  
          <div class="space-y-3">  

            <div class="flex gap-2">
              <div id="ticketsTabsContainer" class="flex-1 flex gap-2 overflow-x-auto"></div>
              <button
                onclick="window.toggleNotificationsPanel()"
                class="relative shrink-0 bg-[#1E293B] hover:bg-[#283548] border border-gray-800 rounded-lg px-4 font-bold text-white text-sm">
                🔔
                <span id="notifBadge" class="hidden absolute -top-1.5 -left-1.5 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">0</span>
              </button>
            </div>

            <div id="notifPanel" class="hidden bg-[#1E293B] border border-gray-800 rounded-xl p-2 max-h-64 overflow-y-auto"></div>

            <button
              id="monthlyReportBtn"
              onclick="window.generateMonthlyReport()"
              class="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] rounded-lg py-2.5 font-bold text-white text-xs transition-all">
              ${t().monthlyReportBtn}
            </button>

            <div id="ticketsBoardContainer" class="mt-4">  
              <div class="text-center text-gray-500 text-xs py-8">  
                ${t().loadingTickets}
              </div>  
            </div>  

          </div>  
        `  
      )  
    : unauthorizedPage("maintenance");  


case 'kaizenBoard':  

  // لوحة متابعة الكايزن (مراجعة واعتماد المقترحات) - نفس فكرة
  // صفحة 'tickets' (Realtime + آخر 60 + Pagination)، لكن منطقها
  // مستقل بالكامل في kaizenBoard.js (بدون أي تعديل على ticketsBoard.js)
  //
  // ملاحظة إصلاح: هذه الصفحة جزء من نظام الكايزن (نفس صلاحية صفحة
  // 'suggestions')، وليست جزءاً من قسم الصيانة - كانت تتحقق خطأً من
  // "maintenance" بدل "suggestions"، فكان أي مستخدم عنده صلاحية
  // "كايزن" فقط (بدون صلاحية "قسم الصيانة") يوصله "غير مصرح" بمجرد
  // محاولة فتح لوحة متابعة الكايزن (ومنها زر "تعديل وإعادة الإرسال"
  // اللي بيظهر لصاحب المقترح لما تكون حالته "يحتاج تعديل")، ونفس
  // الأمر لما يضغط على إشعار كايزن (راجع NotificationBell.js اللي
  // بيوجّه هنا مباشرة). التحقق أصبح الآن من "suggestions" فعلاً.
  return hasPermission("suggestions")  
    ? PageView(  
        t().kaizenBoardTitle,  
        `  
          <div class="space-y-3">  

            <div id="kaizenTabsContainer" class="flex gap-2 overflow-x-auto"></div>

            <button
              id="kaizenReportBtn"
              onclick="window.generateKaizenMonthlyReport()"
              class="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] rounded-lg py-2.5 font-bold text-white text-xs transition-all">
              ${t().monthlyReportBtn}
            </button>

            <div id="kaizenBoardContainer" class="mt-4">  
              <div class="text-center text-gray-500 text-xs py-8">  
                ${t().loadingSuggestions}
              </div>  
            </div>  

          </div>  
        `  
      )  
    : unauthorizedPage("suggestions");  


case 'errorScanner':  

  // ملاحظة: "errorScanner" صلاحية دقيقة جديدة (تطابق نمط باقي صلاحيات
  // قسم الصيانة كـ issue/pm/qr المستقلة عن "maintenance"). أُبقيت
  // الصلاحية العامة "maintenance" كبديل أيضاً حتى لا يفقد المستخدمون
  // الحاليون (الذين مُنحوا "maintenance" فقط قبل هذا التحديث) الوصول.
  return (hasPermission("maintenance") || hasPermission("errorScanner"))  
    ? ErrorScannerView()  
    : unauthorizedPage("errorScanner");  


case 'kb':  

  return hasPermission("kb")  
    ? KnowledgeBaseView()  
    : unauthorizedPage("kb");  


case 'stats':  

  return hasPermission("statistics")  
    ? StatsView()  
    : unauthorizedPage("statistics");  


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
// إصلاح (توحيد): كانت هذه الصفحة قائمة عرض فقط (بدون أي تعديل دور أو
// صلاحيات أو حذف) رغم وصفها بـ"إدارة الحسابات والصلاحيات"، بينما
// الإدارة الحقيقية كانت موجودة بس تحت صفحة "requests" المختلفة اسماً.
// تم توحيدهما الآن في نفس واجهة/منطق RequestsView.js (راجع
// UsersManagementView() هناك): هذه الصفحة تعرض كل المستخدمين بدون
// فلتر افتراضي، وصفحة "طلبات الانضمام" تفتح بنفس الشاشة لكن بفلتر
// "قيد الانتظار" مفعّل تلقائياً.

case 'users':  

  return hasPermission("users")  
    ? UsersManagementView()  
    : unauthorizedPage("users");  


// ========================================================  
// REQUESTS  
// ========================================================  

case 'requests':  

  return hasPermission("requests")  
    ? RequestsView()  
    : unauthorizedPage("requests");  


// ========================================================  
// MACHINES (إدارة أنواع الماكينات)
// ========================================================  
// إصلاح (بند 1): كانت هذه الصفحة غير موجودة أصلاً في الراوتر، فأي
// ضغطة على زرار "الماكينات" في صفحة النظام كانت بتوصل لشاشة "قيد
// التطوير" رغم إن وصف الزرار بيوعد بـ"إدارة المعدات". دلوقتي بقت
// صفحة كاملة (راجع views/MachinesView.js) لإضافة/تعديل/تعطيل/حذف
// أنواع الماكينات المستخدمة في كل فورمات التطبيق.

case 'machines':  

  return hasPermission("machines")  
    ? MachinesView()  
    : unauthorizedPage("machines");  


case 'system':  

  return SystemView();  


// ========================================================  
// SETTINGS (الإجازات الرسمية - المستخدمة في كارت حضور الوردية)
// ========================================================  

case 'settings':  

  return hasPermission("settings")  

    ? PageView(  
        t().settingsTitle,  
        `  
          <div class="space-y-4">  

            <!-- ============================================ -->
            <!-- إدارة Pattern الورديات (حاسبة الحضور والمرتبات) -->
            <!-- ============================================ -->
            <div class="bg-[#1E293B] border border-gray-800 rounded-2xl p-4 space-y-3">
              <h3 class="text-sm font-bold text-[#D4AF37]">🧮 Pattern الورديات (GREEN / BLUE / RED)</h3>
              <p class="text-[11px] text-gray-400">
                ارفع ملف Excel الرسمي لجدول الورديات (M = صباحي، N = ليلي، OFF = إجازة). سيتم استخدامه تلقائياً في "حاسبة الحضور والمرتبات" بالصفحة الرئيسية لكل المستخدمين حسب فريقهم. رفع ملف جديد يستبدل الملف الحالي بالكامل.
              </p>

              <div id="patternStatusContainer">
                <div class="text-center text-gray-500 text-xs py-4">جاري تحميل حالة الـ Pattern...</div>
              </div>

              <input
                id="patternFileInput"
                type="file"
                accept=".xlsx,.xls"
                onchange="window.previewAttendancePatternFile(this)"
                class="w-full text-[11px] text-gray-300 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:text-[11px] file:font-bold bg-[#0F172A] border border-gray-700 rounded-lg p-1.5"
              >

              <div id="patternUploadPreview"></div>

              <button
                id="btnConfirmPatternUpload"
                onclick="window.confirmAttendancePatternUpload()"
                disabled
                class="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-xs text-white transition active:scale-95">
                ✅ تأكيد الحفظ واستبدال الـ Pattern الحالي
              </button>
            </div>

            <!-- ============================================ -->
            <!-- معاملات حساب الإضافي (قابلة للتعديل) -->
            <!-- ============================================ -->
            <div class="bg-[#1E293B] border border-gray-800 rounded-2xl p-4 space-y-3">
              <h3 class="text-sm font-bold text-amber-400">⚙️ معاملات حساب الحضور والإضافي</h3>
              <p class="text-[11px] text-gray-400">
                هذه القيم تتحكم في حساب "حاسبة الحضور والمرتبات" لكل المستخدمين. غيّرها بحذر.
              </p>

              <div class="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <label class="block text-gray-400 mb-1">الساعات المستهدفة شهرياً</label>
                  <input id="ruleMonthlyTargetHours" type="number" min="1" step="1" class="w-full p-2 rounded-lg bg-[#0F172A] border border-gray-700 text-white text-xs">
                </div>
                <div>
                  <label class="block text-gray-400 mb-1">خصم إجازة رسمية (ساعة/يوم)</label>
                  <input id="ruleHolidayHoursDeduction" type="number" min="0" step="1" class="w-full p-2 rounded-lg bg-[#0F172A] border border-gray-700 text-white text-xs">
                </div>
                <div>
                  <label class="block text-gray-400 mb-1">معامل الإضافي العادي (×)</label>
                  <input id="ruleNormalOtMultiplier" type="number" min="1" step="0.1" class="w-full p-2 rounded-lg bg-[#0F172A] border border-gray-700 text-white text-xs">
                </div>
                <div>
                  <label class="block text-gray-400 mb-1">معامل العمل في OFF (×)</label>
                  <input id="ruleOffWorkMultiplier" type="number" min="1" step="0.1" class="w-full p-2 rounded-lg bg-[#0F172A] border border-gray-700 text-white text-xs">
                </div>
                <div class="col-span-2">
                  <label class="block text-gray-400 mb-1">معامل العمل بإجازة رسمية (×)</label>
                  <input id="ruleHolidayWorkMultiplier" type="number" min="1" step="0.1" class="w-full p-2 rounded-lg bg-[#0F172A] border border-gray-700 text-white text-xs">
                </div>
              </div>

              <button
                onclick="window.savePayrollRulesForm()"
                class="w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 font-bold text-xs text-white transition active:scale-95">
                💾 حفظ إعدادات الإضافي
              </button>
            </div>

            <!-- مزامنة الإجازات الرسمية المصرية من Google Calendar -->
            <div class="bg-[#1E293B] border border-gray-800 rounded-2xl p-4 space-y-3">
              <h3 class="text-sm font-bold text-blue-400">🎉 الإجازات الرسمية</h3>
              <p class="text-[11px] text-gray-400">
                تُستخدم هذه القائمة في كارت الحضور والمرتبات بالصفحة الرئيسية لحساب الساعات المطلوبة للدورة (192 - عدد الإجازات الرسمية داخل الدورة × 8 ساعات). المصدر: تقويم إجازات مصر الرسمية من Google Calendar - يتم مزامنته تلقائيًا أول كل شهر الساعة 2 صباحًا، وتقدر كمان تحدّثه يدويًا في أي وقت.
              </p>

              <div id="googleSyncStatus" class="text-[10px] text-gray-400 bg-[#0F172A] border border-gray-800 rounded-lg px-2.5 py-2">
                جاري التحقق من آخر مزامنة...
              </div>

              <button
                id="btnSyncGoogleHolidays"
                onclick="window.syncGoogleHolidaysNow()"
                class="w-full py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 font-bold text-xs text-white transition active:scale-95">
                🔄 تحديث من جوجل
              </button>

              <div>
                <label class="block text-[11px] text-gray-400 mb-1.5">إضافة إجازة رسمية (من قائمة جوجل فقط)</label>
                <select
                  id="newHolidayDate"
                  class="w-full p-2.5 rounded-lg bg-[#0F172A] border border-gray-700 text-white text-xs">
                  <option value="">-- جاري تحميل قائمة جوجل... --</option>
                </select>
              </div>

              <button
                onclick="window.addHoliday()"
                class="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white transition active:scale-95">
                ➕ إضافة إجازة رسمية مُختارة
              </button>

              <button
                onclick="window.seedDefaultHolidays2026()"
                class="w-full py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 font-bold text-[11px] text-amber-300 transition active:scale-95">
                📋 إضافة القائمة الافتراضية لإجازات 2026 دفعة واحدة
              </button>

              <div>
                <div class="text-[11px] text-gray-400 mb-1.5 font-bold">📅 كل الإجازات المتاحة من Google Calendar</div>
                <div id="googleHolidaysListContainer" class="space-y-1.5 max-h-48 overflow-y-auto">
                  <div class="text-center text-gray-500 text-[10px] py-3">جاري التحميل...</div>
                </div>
              </div>
            </div>

            <div class="bg-[#1E293B] border border-gray-800 rounded-2xl p-4 space-y-3">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-bold text-emerald-400">✅ الإجازات الرسمية المُفعّلة حاليًا</h3>
                <button
                  onclick="window.loadHolidays()"
                  class="text-[10px] px-2.5 py-1.5 rounded-lg bg-white/5 border border-gray-700 hover:bg-white/10 font-bold text-gray-300 transition">
                  🔄 تحديث
                </button>
              </div>
              <p class="text-[11px] text-gray-400">
                هذه هي الإجازات المُفعّلة فعليًا وتؤثر على حساب الساعات المطلوبة لأي مستخدم.
              </p>
              <div id="holidaysContainer" class="mt-2 space-y-2">
                <div class="text-center text-gray-500 text-xs py-6">
                  جاري تحميل الإجازات الرسمية...
                </div>
              </div>
            </div>

          </div>  
        `,
        undefined,
        // إصلاح (بند 5): صفحة الإعدادات ما بتوصلهاش إلا من صفحة
        // النظام، فزرار الرجوع بيرجّع لصفحة النظام بدل الرئيسية
        "system"
      )  

    : unauthorizedPage("settings");  


default:  

  // إذا كان المستخدم مسجلاً دخوله بالفعل، فإن أي صفحة غير معروفة
  // (مثل صفحات لم تُبنَ بعد: qr, ai, stats...) يجب ألا تُعيده
  // لشاشة تسجيل الدخول (يبدو كخروج مفاجئ)، بل تُظهر له رسالة واضحة
  const isLoggedIn =  
    localStorage.getItem("phone") ||  
    localStorage.getItem("userId");  

  return isLoggedIn  
    ? comingSoonPage(page)  
    : LoginView();

}

}

// ============================================================
// قيد التطوير (صفحات لم تُبنَ بعد)
// ============================================================

function comingSoonPage(page) {

return PageView(

t().comingSoonTitle,  

`  
  <div  
    class="  
      bg-[#1E293B]  
      p-6  
      rounded-xl  
      border  
      border-blue-500/30  
      text-center  
      text-xs  
      text-blue-300  
      font-bold  
    "  
  >  

    ${page ? `(${page}) ` : ""}${t().comingSoonMsg}  

  </div>  
`

);

}

// ============================================================
// UNAUTHORIZED
// ============================================================

function unauthorizedPage(permission) {

return PageView(

t().unauthorizedTitle,  

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

    ${t().unauthorizedMsg}  
    ${permission}  

  </div>  
`

);

}
