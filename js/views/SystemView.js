import { BottomNav } from "../components/BottomNav.js";
import { translations } from "../config.js";
import { isAdminRole } from "../permissions.js";
import { renderDailyTipCard } from "../dailyTips.js";
import { countPendingUsersApi } from "../services/usersApi.js";

export const SystemView = () => {

// ============================================================
// نظام الصلاحيات الموحد الآمن
// ============================================================

const can = (permission) => {
  const role = (localStorage.getItem("role") || "").trim().toLowerCase();
  if (isAdminRole(role)) return true;

  if (typeof window.hasPermission === "function") {
    return window.hasPermission(permission);
  }

  const permissions =
    (localStorage.getItem("permissions") || "")
      .split(",")
      .map(p => p.trim().toLowerCase())
      .filter(Boolean);

  return permissions.includes("all") || permissions.includes("admin") || permissions.includes(String(permission || "").toLowerCase());
};

// ============================================================
// بيانات المستخدم الحالي
// ============================================================

const currentRole =
(localStorage.getItem("role") || "user")
.trim()
.toUpperCase();

const currentLang = window.currentLang || "ar";
const t = (translations[currentLang] || translations.ar).system;

// ============================================================
// الواجهة
// ============================================================

return `

<div class="app-page p-3 sm:p-4 max-w-md sm:max-w-xl md:max-w-4xl lg:max-w-5xl mx-auto pb-24 space-y-5 text-white">  
  <!-- ========================================================
       الهيدر الرئيسي
       ======================================================== -->  
  <div class="flex items-center justify-between border-b border-gray-800 pb-3">
    <div>
      <h2 class="
        text-base
        font-bold
        text-blue-400
        flex
        items-center
        gap-2
      ">
        <span>👨‍💼</span>
        ${t.title}
      </h2>

      <p class="
        text-[11px]
        text-gray-400
        mt-0.5
      ">
        ${t.subtitle}
      </p>
    </div>

    <span class="
      bg-blue-500/10
      text-blue-400
      border
      border-blue-500/20
      text-[10px]
      px-2.5
      py-1
      rounded-full
      font-bold
    ">
      ${currentRole}
    </span>
  </div>  

  <!-- ========================================================
       كارت «معلومة على الماشي» (يتغير يومياً الساعة 12 ظهراً)
       ======================================================== -->
  ${renderDailyTipCard()}

  <!-- ========================================================
       شبكة خيارات النظام
       ======================================================== -->  
  <div class="grid grid-cols-2 md:grid-cols-4 gap-3.5">
    
    <!-- ======================================================
         المستخدمون
         ====================================================== -->
    ${can("users") ? `
    <button
      type="button"
      onclick="window.navigateTo('users')"
      class="relative text-start border border-blue-500/40 hover:border-blue-400/70 bg-gradient-to-br from-blue-950/50 via-[#1E293B] to-[#0F172A] p-4 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 active:scale-95 shadow-md hover:shadow-blue-900/30 group overflow-hidden"
    >
      <span class="absolute top-2 rtl:left-2.5 ltr:right-2.5 text-amber-400 text-base font-black group-hover:scale-125 transition-transform rtl:rotate-180">›</span>
      <div class="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center text-2xl mb-2 shadow-inner group-hover:scale-110 transition-transform">
        👥
      </div>

      <span class="font-bold text-xs text-gray-100">
        ${t.usersTitle || (currentLang === 'en' ? 'User Directory' : 'إدارة المستخدمين')}
      </span>

      <span class="text-[10px] text-gray-400 mt-1 line-clamp-1">
        ${t.usersDesc || ''}
      </span>
    </button>
    ` : ""}


    <!-- ======================================================
         طلبات الانضمام
         ====================================================== -->
    ${can("requests") ? `
    <button
      type="button"
      onclick="window.navigateTo('requests')"
      class="relative text-start border border-amber-500/40 hover:border-amber-400/70 bg-gradient-to-br from-amber-950/50 via-[#1E293B] to-[#0F172A] p-4 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 active:scale-95 shadow-md hover:shadow-amber-900/30 group overflow-hidden"
    >
      <span class="absolute top-2 rtl:left-2.5 ltr:right-2.5 text-amber-400 text-base font-black group-hover:scale-125 transition-transform rtl:rotate-180">›</span>

      <!-- بند C1 في تقرير المراجعة: شارة عدد طلبات الانضمام
           المعلّقة - مخفية افتراضياً، وبتظهر فقط لما يكون العدد
           أكبر من صفر (راجع loadSystemHubBadges تحت) -->
      <span
        id="pendingRequestsBadge"
        class="hidden absolute top-2 rtl:right-2.5 ltr:left-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none shadow"
      >0</span>

      <div class="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center text-2xl mb-2 shadow-inner group-hover:scale-110 transition-transform">
        ⏳
      </div>

      <span class="font-bold text-xs text-gray-100">
        ${t.requestsTitle || (currentLang === 'en' ? 'Join Requests' : 'طلبات الانضمام')}
      </span>

      <span class="text-[10px] text-gray-400 mt-1 line-clamp-1">
        ${t.requestsDesc || ''}
      </span>
    </button>
    ` : ""}


    <!-- ======================================================
         الماكينات
         ====================================================== -->
    ${can("machines") ? `
    <button
      type="button"
      onclick="window.navigateTo('machines')"
      class="relative text-start border border-emerald-500/40 hover:border-emerald-400/70 bg-gradient-to-br from-emerald-950/50 via-[#1E293B] to-[#0F172A] p-4 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 active:scale-95 shadow-md hover:shadow-emerald-900/30 group overflow-hidden"
    >
      <span class="absolute top-2 rtl:left-2.5 ltr:right-2.5 text-amber-400 text-base font-black group-hover:scale-125 transition-transform rtl:rotate-180">›</span>
      <div class="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-2xl mb-2 shadow-inner group-hover:scale-110 transition-transform">
        🏭
      </div>

      <span class="font-bold text-xs text-gray-100">
        ${t.machinesTitle || (currentLang === 'en' ? 'Machines Register' : 'سجل الماكينات')}
      </span>

      <span class="text-[10px] text-gray-400 mt-1 line-clamp-1">
        ${t.machinesDesc || ''}
      </span>
    </button>
    ` : ""}


    <!-- ======================================================
         الإعدادات
         ====================================================== -->
    ${can("settings") ? `
    <button
      type="button"
      onclick="window.navigateTo('settings')"
      class="relative text-start border border-purple-500/40 hover:border-purple-400/70 bg-gradient-to-br from-purple-950/50 via-[#1E293B] to-[#0F172A] p-4 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 active:scale-95 shadow-md hover:shadow-purple-900/30 group overflow-hidden"
    >
      <span class="absolute top-2 rtl:left-2.5 ltr:right-2.5 text-amber-400 text-base font-black group-hover:scale-125 transition-transform rtl:rotate-180">›</span>
      <div class="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 flex items-center justify-center text-2xl mb-2 shadow-inner group-hover:scale-110 transition-transform">
        ⚙️
      </div>

      <span class="font-bold text-xs text-gray-100">
        ${t.settingsTitle || (currentLang === 'en' ? 'System Settings' : 'إعدادات النظام')}
      </span>

      <span class="text-[10px] text-gray-400 mt-1 line-clamp-1">
        ${t.settingsDesc || ''}
      </span>
    </button>
    ` : ""}

  </div>  

  <!-- ========================================================
       رسالة في حالة عدم وجود صلاحيات
       ======================================================== -->
  ${
  !can("users") &&
  !can("requests") &&
  !can("machines") &&
  !can("settings")
  ? `
  <div class="
    bg-[#1E293B]
    border
    border-red-500/30
    rounded-xl
    p-5
    text-center
    text-xs
    text-red-400
    font-bold
  ">
    <div class="text-3xl mb-2">
      🔒
    </div>
    ${t.noAccess}
  </div>
  `
  : ""
  }

</div>

${BottomNav("system")}

`;
};

export default SystemView;


// ============================================================
// شارة عدد طلبات الانضمام المعلّقة (بند C1 في تقرير المراجعة)
// ============================================================
// استعلام خفيف (countPendingUsersApi) منفصل تماماً عن التحميل
// الكامل لصفحة "طلبات الانضمام" (اللي بيجيب كل المستخدمين) -
// الهدف هنا بس معرفة الرقم بسرعة لعرضه كشارة على بطاقة الصفحة
// الرئيسية "النظام"، بدون أي تحميل زائد.

export async function loadSystemHubBadges() {

  const badge = document.getElementById("pendingRequestsBadge");
  if (!badge) return;

  try {

    const count = await countPendingUsersApi();

    if (count > 0) {
      badge.textContent = count > 99 ? "99+" : String(count);
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }

  } catch (error) {

    console.error("Error loading system hub badges:", error);

  }

}

window.loadSystemHubBadges = loadSystemHubBadges;
