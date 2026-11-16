// ============================================================
// ManagerDesktopHome.js - MGR-DESKTOP
// لوحة قيادة تنفيذية (Executive Command Center) لمدير الصيانة
// بشبكة 12 عموداً متكاملة للشاشات الكبيرة (>= 1280px)
// ============================================================

import { fetchDashboardSnapshotApi, fetchPendingUsersApi, fetchPmOrdersApi, fetchTechniciansApi } from '../../services/api.js';
import { getCurrentRole } from '../../permissions.js';
import { translations } from '../../config.js';
import { CLOSED_STATUSES, isOverdueTicket, parseTicketDate, STATUS_LABELS } from '../../ticketStatusConstants.js';
import { computeMTTR, computeTopMachines, computeTechnicianPerformance } from '../../statistics.js';
import { exportToExcel } from '../../services/exportUtility.js';
import { escapeHtml } from "../../utils/escapeHtml.js";
import { displayRecordNumber } from "../../utils/recordNumber.js";
import { escapeJsArg } from "../../utils/escapeHtml.js"; // MGR-DESKTOP
import { buildManagerTrendSeries } from "../../utils/managerDashboard.js";

let paretoChartInstance = null;
let trendChartInstance = null;
let cachedDashboardData = null;

export function renderManagerDesktopHomeHtml() {
  const currentLang = window.currentLang || "ar";
  const isEn = currentLang === "en";

  return `
  <div class="mgr-command-center animate-fade-in">

    <!-- 1. شريط العنوان والإجراءات التنفيذية السريعة -->
    <div class="col-span-12 flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-500 flex items-center justify-center text-xl shadow-inner">
          ⚡
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-xl font-black text-gray-900 dark:text-white tracking-tight">
              ${isEn ? 'Executive Operations Command Center' : 'مركز إدارة العمليات التنفيذي'}
            </h1>
            <span id="mgrDataStatus" role="status" aria-live="polite" class="px-2 py-0.5 text-[11px] font-bold rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              ${isEn ? 'Loading dashboard...' : 'جاري تحميل لوحة المدير...'}
            </span>
          </div>
          <p class="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
            ${isEn ? 'Operations data, equipment availability, downtime analysis & decisions' : 'متابعة الجاهزية التشغيلية، ومؤشرات الأعطال، والقرارات المعلقة'}
          </p>
        </div>
      </div>

      <!-- أزرار الإجراءات التنفيذية -->
      <div class="flex items-center gap-2.5">
        <button
          type="button"
          onclick="window.refreshManagerDesktopDashboard()"
          title="${isEn ? 'Refresh Data' : 'تحديث البيانات'}"
          class="px-3 py-2 text-xs font-bold rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100 border border-gray-300 dark:border-gray-600 transition flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer">
          <span id="mgrRefreshSpinner">🔄</span>
          <span>${isEn ? 'Refresh' : 'تحديث'}</span>
        </button>

        <button
          type="button"
          onclick="window.navigateTo('pmOrders')"
          class="px-3.5 py-2 text-xs font-bold rounded-xl bg-blue-600/15 hover:bg-blue-600/25 text-blue-700 dark:text-blue-200 border border-blue-500/40 shadow-sm transition flex items-center gap-1.5 active:scale-95 cursor-pointer">
          <span>🗓️</span>
          <span>${isEn ? 'PM Work Orders' : 'أوامر PM وتوقف الخط'}</span>
        </button>

        <button
          type="button"
          onclick="window.exportManagerExecutiveSummary()"
          class="px-3.5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md hover:shadow-lg transition flex items-center gap-1.5 active:scale-95 cursor-pointer">
          <span>📑</span>
          <span>${isEn ? 'Export Executive Report' : 'تصدير التقرير التنفيذي'}</span>
        </button>
      </div>
    </div>

    <!-- 2. صف كروت مؤشرات الأداء الحيوية (KPIs Row - 6 كروت متطورة مع أسهم المقارنة) -->
    <div class="mgr-kpi-grid">
      
      <!-- كارت: بلاغات مفتوحة -->
      <button type="button" onclick="window.navigateTo('tickets')" class="mgr-card p-4 text-start w-full cursor-pointer hover:border-amber-500/50 group relative overflow-hidden">
        <div class="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 mb-1">
          <span class="font-bold">${isEn ? 'Open Tickets' : 'بلاغات قيد الإجراء'}</span>
          <span class="text-base group-hover:scale-110 transition-transform">⚠️</span>
        </div>
        <div class="flex items-baseline justify-between">
          <div id="mgrKpiOpen" class="text-2xl font-black text-amber-500">--</div>
          <span class="text-[11px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center gap-0.5">
            <span>●</span> ${isEn ? 'Active' : 'نشط'}
          </span>
        </div>
        <div class="text-[11px] text-slate-600 dark:text-slate-300 mt-2 flex items-center gap-1">
          <span class="text-amber-500 font-bold">↗</span>
          <span>${isEn ? 'Requires prompt assignment' : 'تحتاج إسناد ومتابعة فورية'}</span>
        </div>
      </button>

      <!-- كارت: متأخرة عن SLA -->
      <button type="button" onclick="window.openTicketsWithFilter('overdue')" class="mgr-card p-4 text-start w-full cursor-pointer hover:border-red-500/50 group relative overflow-hidden">
        <div class="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 mb-1">
          <span class="font-bold">${isEn ? 'Overdue (SLA)' : 'تجاوزت وقت الاستجابة SLA'}</span>
          <span class="text-base group-hover:scale-110 transition-transform">🚨</span>
        </div>
        <div class="flex items-baseline justify-between">
          <div id="mgrKpiOverdue" class="text-2xl font-black text-red-500">--</div>
          <span id="mgrKpiOverdueBadge" class="text-[11px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-700 dark:text-red-300">
            ${isEn ? 'Critical' : 'حرج'}
          </span>
        </div>
        <div class="text-[11px] text-slate-600 dark:text-slate-300 mt-2 flex items-center gap-1">
          <span class="text-red-500 font-bold">⚠️</span>
          <span>${isEn ? 'Breached SLA threshold' : 'تجاوزت الحد المسموح للإصلاح'}</span>
        </div>
      </button>

      <!-- كارت: متوسط زمن الإصلاح MTTR -->
      <div class="mgr-card p-4 hover:border-cyan-500/50 group relative overflow-hidden">
        <div class="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 mb-1">
          <span class="font-bold">${isEn ? 'MTTR (Mean Repair Time)' : 'متوسط زمن الإصلاح MTTR'}</span>
          <span class="text-base group-hover:scale-110 transition-transform">⏱️</span>
        </div>
        <div class="flex items-baseline justify-between">
          <div id="mgrKpiMttr" class="text-2xl font-black text-cyan-600 dark:text-cyan-400">--</div>
          <span id="mgrKpiMttrTrend" class="text-[11px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-700 dark:text-cyan-300">
            --
          </span>
        </div>
        <div class="text-[11px] text-slate-600 dark:text-slate-300 mt-2 flex items-center gap-1">
          <span>🎯</span>
          <span>${isEn ? 'Target: < 2.5 hrs' : 'الهدف المعياري: أقل من ساعتين ونصف'}</span>
        </div>
      </div>

      <!-- كارت: متوسط الزمن بين الأعطال MTBF -->
      <div class="mgr-card p-4 hover:border-indigo-500/50 group relative overflow-hidden">
        <div class="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 mb-1">
          <span class="font-bold">${isEn ? 'MTBF (Estimated)' : 'زمن بين الأعطال MTBF (تقديري)'}</span>
          <span class="text-base group-hover:scale-110 transition-transform">🛡️</span>
        </div>
        <div class="flex items-baseline justify-between">
          <div id="mgrKpiMtbf" class="text-2xl font-black text-indigo-600 dark:text-indigo-400">--</div>
          <span class="text-[11px] font-bold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300">
            ${isEn ? 'Estimate' : 'تقديري'}
          </span>
        </div>
        <div class="text-[11px] text-slate-600 dark:text-slate-300 mt-2 flex items-center gap-1">
          <span>📈</span>
          <span>${isEn ? 'Higher is better' : 'مؤشر موثوقية المعدات والخطوط'}</span>
        </div>
      </div>

      <!-- كارت: نسبة إنجاز الصيانة الوقائية PM -->
      <button type="button" onclick="window.navigateTo('pmOrders')" class="mgr-card p-4 text-start w-full cursor-pointer hover:border-emerald-500/50 group relative overflow-hidden">
        <div class="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 mb-1">
          <span class="font-bold">${isEn ? 'PM Compliance' : 'إنجاز الصيانة الوقائية PM'}</span>
          <span class="text-base group-hover:scale-110 transition-transform">📋</span>
        </div>
        <div class="flex items-baseline justify-between">
          <div id="mgrKpiPmRate" class="text-2xl font-black text-emerald-600 dark:text-emerald-400">--%</div>
          <span class="text-[11px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            ${isEn ? 'Compliance' : 'مطابقة'}
          </span>
        </div>
        <div class="text-[11px] text-slate-600 dark:text-slate-300 mt-2 flex items-center gap-1">
          <span>✅</span>
          <span id="mgrKpiPmCounts">${isEn ? 'PM orders this month' : 'أوامر PM هذا الشهر'}</span>
        </div>
      </button>

      <!-- كارت: إجمالي ساعات التوقف هذا الشهر -->
      <div class="mgr-card p-4 hover:border-purple-500/50 group relative overflow-hidden">
        <div class="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 mb-1">
          <span class="font-bold">${isEn ? 'Breakdown Hours (30d)' : 'ساعات الأعطال (آخر 30 يوم)'}</span>
          <span class="text-base group-hover:scale-110 transition-transform">🛑</span>
        </div>
        <div class="flex items-baseline justify-between">
          <div id="mgrKpiDowntime" class="text-2xl font-black text-purple-600 dark:text-purple-400">--</div>
          <span class="text-[11px] font-bold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-700 dark:text-purple-300">
            ${isEn ? 'Total Hrs' : 'ساعة إجمالية'}
          </span>
        </div>
        <div class="text-[11px] text-slate-600 dark:text-slate-300 mt-2 flex items-center gap-1">
          <span>📉</span>
          <span>${isEn ? 'Total breakdown ticket hours' : 'مجموع ساعات بلاغات الأعطال'}</span>
        </div>
      </div>

    </div>

    <!-- 3. العمود المركزي (8 أعمدة: الرسوم البيانية + جدول القرارات الفورية) -->
    <div class="mgr-main-col">
      
      <!-- شبكة الرسوم البيانية (Pareto + الاتجاه اليومي) -->
      <div class="mgr-charts-grid">
        
        <!-- رسم Pareto لأكثر الماكينات عطلاً -->
        <div class="mgr-card p-4">
          <div class="flex items-center justify-between mb-3">
            <div>
              <h3 class="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <span>📊</span>
                <span>${isEn ? 'Chronic Machine Defects (Pareto Analysis)' : 'أكثر الماكينات عطلاً (تحليل باريتو)'}</span>
              </h3>
              <p class="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                ${isEn ? 'Frequency distribution & 80/20 critical breakdown focus' : 'تكرار الأعطال للتركيز على الماكينات الأكثر تأثيراً'}
              </p>
            </div>
            <span class="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-slate-700 dark:text-slate-200 font-mono font-bold">
              Top 6
            </span>
          </div>

          <div class="relative h-[240px] w-full flex items-center justify-center">
            <canvas id="mgrParetoChart"></canvas>
            <div id="mgrParetoEmpty" class="hidden text-xs text-slate-600 dark:text-slate-300 text-center">
              ${isEn ? 'No enough breakdown data for Pareto analysis' : 'لا توجد بيانات أعطال كافية لتحليل باريتو'}
            </div>
          </div>
        </div>

        <!-- رسم اتجاه الأعطال الأسبوعي والشهري -->
        <div class="mgr-card p-4">
          <div class="flex items-center justify-between mb-3">
            <div>
              <h3 class="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <span>📈</span>
                <span>${isEn ? 'Breakdown Inflow & Resolution Trend' : 'اتجاه تدفق البلاغات والإغلاق'}</span>
              </h3>
              <p class="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                ${isEn ? 'Daily comparison of new reports vs resolved' : 'مقارنة يومية بين البلاغات الجديدة وما تم إصلاحه'}
              </p>
            </div>
            <div class="flex items-center gap-1">
              <span class="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span class="text-[11px] text-slate-600 dark:text-slate-300 font-medium me-2">${isEn ? 'New' : 'جديد'}</span>
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span class="text-[11px] text-slate-600 dark:text-slate-300 font-medium">${isEn ? 'Fixed' : 'تم إصلاحه'}</span>
            </div>
          </div>

          <div class="relative h-[240px] w-full flex items-center justify-center">
            <canvas id="mgrTrendChart"></canvas>
            <div id="mgrTrendEmpty" class="hidden text-xs text-slate-600 dark:text-slate-300 text-center">
              ${isEn ? 'No trend data available' : 'لا توجد بيانات اتجاه كافية'}
            </div>
          </div>
        </div>

      </div>

      <!-- جدول: يحتاج قراراً الآن (Decision Desk) -->
      <div class="mgr-card p-4">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center text-sm font-bold">
              ⚡
            </div>
            <div>
              <h3 class="text-sm font-bold text-gray-900 dark:text-white">
                ${isEn ? 'Immediate Decisions Desk' : 'يحتاج قراراً الآن (مركز الموافقات والإسناد)'}
              </h3>
              <p class="text-[11px] text-slate-600 dark:text-slate-300">
                ${isEn ? 'Pending unassigned tickets, SLA risks, and new user access requests' : 'بلاغات بانتظار التعيين، أعطال حرجة، وطلبات مستخدمين جديدة بانتظار الاعتماد'}
              </p>
            </div>
          </div>
          <span id="mgrDecisionsCount" class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
            0 ${isEn ? 'Actions' : 'إجراءات'}
          </span>
        </div>

        <div class="mgr-table-container border border-gray-200 dark:border-gray-800 rounded-lg">
          <table class="w-full text-start text-xs border-collapse">
            <thead>
              <tr class="bg-gray-50 dark:bg-gray-800/80 text-slate-700 dark:text-slate-200 border-b border-gray-200 dark:border-gray-800">
                <th class="py-2.5 px-3 font-semibold text-start">${isEn ? 'Type' : 'النوع'}</th>
                <th class="py-2.5 px-3 font-semibold text-start">${isEn ? 'Item / Target' : 'العنصر / الهدف'}</th>
                <th class="py-2.5 px-3 font-semibold text-start">${isEn ? 'Priority / Department' : 'الأولوية / القسم'}</th>
                <th class="py-2.5 px-3 font-semibold text-start">${isEn ? 'Time / Status' : 'الوقت / الحالة'}</th>
                <th class="py-2.5 px-3 font-semibold text-center">${isEn ? 'Action' : 'الإجراء السريع'}</th>
              </tr>
            </thead>
            <tbody id="mgrDecisionsTableBody" class="divide-y divide-gray-100 dark:divide-gray-800/60">
              <tr>
                <td colspan="5" class="py-6 text-center text-slate-600 dark:text-slate-300">
                  <div class="inline-block animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full mb-1"></div>
                  <div>${isEn ? 'Scanning pending decisions...' : 'جاري فحص العناصر التي تحتاج لقرار...'}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>

    <!-- 4. العمود الجانبي (4 أعمدة: أداء وحمل عمل الفنيين + صحة الورديات) -->
    <div class="mgr-side-col">
      
      <!-- كارت: أداء الفنيين وحمل العمل المباشر -->
      <div class="mgr-card p-4 flex flex-col">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="text-base">👷</span>
            <div>
              <h3 class="text-sm font-bold text-gray-900 dark:text-white">
                ${isEn ? 'Technician Workload & Performance' : 'أداء الفنيين وحمل العمل المباشر'}
              </h3>
              <p class="text-[11px] text-slate-600 dark:text-slate-300">
                ${isEn ? 'Active assigned tasks vs resolved' : 'توزيع التذاكر النشطة والإصلاحات المكتملة'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onclick="window.navigateTo('tickets')"
            class="text-xs text-blue-600 dark:text-blue-400 hover:underline font-bold">
            ${isEn ? 'View Board' : 'فتح اللوحة'}
          </button>
        </div>

        <div id="mgrTechWorkloadList" class="space-y-3 pt-1">
          <div class="py-6 text-center text-slate-600 dark:text-slate-300 text-xs">
            ${isEn ? 'Loading technician statistics...' : 'جاري تحميل إحصائيات الفنيين...'}
          </div>
        </div>
      </div>

      <!-- كارت: النبض التشغيلي وحالة الوردية -->
      <div class="mgr-card p-4">
        <div class="flex items-center justify-between mb-2.5">
          <h3 class="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
            <span>🏭</span>
            <span>${isEn ? 'Operations Pulse & Shifts' : 'النبض التشغيلي والورديات'}</span>
          </h3>
          <span id="mgrOperationsStatus" role="status" class="text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-gray-500/10 px-2 py-0.5 rounded">
            ${isEn ? 'Online' : 'جاهز'}
          </span>
        </div>

        <div class="space-y-2 text-xs">
          <div class="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
            <span class="text-slate-700 dark:text-slate-200 font-medium">${isEn ? 'Current Shift' : 'الوردية الحالية'}</span>
            <span id="mgrCurrentShiftName" class="font-bold text-blue-600 dark:text-blue-400 font-mono">--</span>
          </div>

          <div class="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
            <span class="text-slate-700 dark:text-slate-200 font-medium">${isEn ? 'Total Tracked Equipment' : 'إجمالي الماكينات المسجلة'}</span>
            <span id="mgrTotalMachinesCount" class="font-bold text-gray-900 dark:text-white font-mono">--</span>
          </div>

          <div class="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
            <span class="text-slate-700 dark:text-slate-200 font-medium">${isEn ? 'Pending Registrations' : 'طلبات تسجيل معلقة'}</span>
            <span id="mgrPendingUsersCount" class="font-bold text-amber-600 dark:text-amber-400 font-mono">0</span>
          </div>
        </div>

        <div class="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <button
            type="button"
            onclick="window.navigateTo('maintenanceSearch')"
            class="w-full py-2 px-3 rounded-lg text-xs font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 transition text-center cursor-pointer">
            🔍 ${isEn ? 'Advanced Search & Logs' : 'البحث والفلترة المتقدمة للأعطال'}
          </button>
        </div>
      </div>

    </div>

  </div>
  `;
}

// دالة تحميل وحساب البيانات وتحديث واجهة المدير
let _managerDesktopLoadInFlight = null;

export function initManagerDesktopHomeData() {
  if (!_managerDesktopLoadInFlight) {
    _managerDesktopLoadInFlight = _initManagerDesktopHomeData().finally(() => {
      _managerDesktopLoadInFlight = null;
    });
  }
  return _managerDesktopLoadInFlight;
}

async function _initManagerDesktopHomeData() {
  const currentLang = window.currentLang || "ar";
  const isEn = currentLang === "en";

  const spin = document.getElementById("mgrRefreshSpinner");
  if (spin) spin.classList.add("animate-spin");
  setManagerDataStatus("loading", isEn);

  try {
    const role = getCurrentRole();
    const myUid = localStorage.getItem("userId") || "";
    const myName = localStorage.getItem("name") || "";
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // جلب التذاكر وسجلات الـ PM والمستخدمين بالتوازي
    const [ticketsResult, pmResult, pendingUsersResult, techniciansResult] = await Promise.allSettled([
      fetchDashboardSnapshotApi({ role, myUid, myName }),
      fetchPmOrdersApi({ plannedMonth: monthKey }),
      fetchPendingUsersApi(),
      fetchTechniciansApi()
    ]);

    const ticketsRes = ticketsResult.status === "fulfilled" ? ticketsResult.value : null;
    const pmCountRes = pmResult.status === "fulfilled" ? pmResult.value : null;
    const pendingUsersRes = pendingUsersResult.status === "fulfilled" ? pendingUsersResult.value : null;
    const techniciansRes = techniciansResult.status === "fulfilled" ? techniciansResult.value : null;
    const snapshot = (ticketsRes && ticketsRes.status === 'success') ? ticketsRes.data : null;
    const ticketsAvailable = !!snapshot && Array.isArray(snapshot.tickets);
    const tickets = ticketsAvailable ? snapshot.tickets : [];
    const totalCount = snapshot ? snapshot.total : tickets.length;
    // كارت PM: أوامر PM المخططة هذا الشهر (نفس بيانات صفحة أوامر PM)
    let pmMonthTotal = null;
    let pmMonthDone = 0;
    if (pmCountRes?.status === 'success' && Array.isArray(pmCountRes.data)) {
      pmMonthTotal = 0;
      pmCountRes.data.forEach(order => {
        const raw = String(order.plannedDate || '').trim();
        if (!raw) return;
        const d = /^\d{4}-\d{2}/.test(raw) ? raw.slice(0, 7) : '';
        if (d !== monthKey) return;
        pmMonthTotal++;
        if (order.pmStatus === 'completed') pmMonthDone++;
      });
    } else {
      console.warn("[ManagerDesktop] PM orders are unavailable:", pmCountRes?.message || "Unknown error");
    }
    // طلبات الانضمام وقائمة الفنيين تُحمّلان باستعلامات منفصلة ومحددة النطاق.
    const pendingUsersAvailable = !!pendingUsersRes && pendingUsersRes.status === "success"
      && Array.isArray(pendingUsersRes.data);
    const pendingUsers = pendingUsersAvailable ? pendingUsersRes.data : [];
    const techniciansAvailable = !!techniciansRes && techniciansRes.status === "success"
      && Array.isArray(techniciansRes.data);
    const technicians = techniciansAvailable ? techniciansRes.data : [];

    if (ticketsAvailable) {
      cachedDashboardData = { tickets, totalCount, userId: myUid };
    } else if (cachedDashboardData?.userId === myUid) {
      cachedDashboardData = null;
    }
    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
    const dashboardIsCached = !!snapshot?.cached || (isOffline && ticketsAvailable);
    const dashboardIsPartial = !ticketsAvailable || !pendingUsersAvailable || !techniciansAvailable
      || pmCountRes?.status !== "success" || snapshot?.exact === false;
    const dataState = dashboardIsCached
      ? (dashboardIsPartial ? "cachedPartial" : "cached")
      : (dashboardIsPartial ? "partial" : "live");
    setManagerDataStatus(dataState, isEn);
    const operationsStatus = document.getElementById("mgrOperationsStatus");
    if (operationsStatus) {
      operationsStatus.textContent = isOffline
        ? (isEn ? "Offline" : "دون اتصال")
        : dashboardIsCached
          ? (isEn ? "Cached data" : "بيانات مخزنة")
          : (isEn ? "Online" : "متصل");
      operationsStatus.className = isOffline || dashboardIsCached
        ? "text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded"
        : "text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded";
    }
    // تحليلات الأعطال (MTTR/MTBF/باريتو/الاتجاه/التوقف) تستبعد أوامر الصيانة الوقائية PM
    const cmTickets = tickets.filter(t => String(t.maintenanceType || '').trim().toUpperCase() !== 'PM');

    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    if (ticketsAvailable) {
      // 1. حساب الـ KPIs
      let totalDowntimeHours = 0;
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      tickets.forEach(ticket => {
        const isClosed = CLOSED_STATUSES.includes(String(ticket.status || '').trim().toLowerCase());
        if (String(ticket.maintenanceType || '').trim().toUpperCase() === 'PM') return;

        const created = parseTicketDate(ticket.createdAtServer) || parseTicketDate(ticket);
        const end = isClosed
          ? (parseTicketDate(ticket.resolvedAtServer) || parseTicketDate(ticket.resolvedAt || ticket.updatedAt || ticket))
          : new Date();
        if (created && end && end > thirtyDaysAgo) {
          const startAt = created > thirtyDaysAgo ? created : thirtyDaysAgo;
          if (end > startAt) totalDowntimeHours += (end - startAt) / (1000 * 60 * 60);
        }
      });

      const openCount = Number.isFinite(snapshot.open) ? snapshot.open : null;
      const overdueCount = Number.isFinite(snapshot.overdue) ? snapshot.overdue : null;
      const mttrData = computeMTTR(cmTickets);
      const mttrHours = mttrData.avgHours !== null ? mttrData.avgHours : null;
      const monthlyFailures = cmTickets.filter(t => {
        const d = parseTicketDate(t);
        return d && d >= thirtyDaysAgo;
      }).length;
      const machinesList = Array.isArray(window.machinesList) ? window.machinesList : [];
      const machineHours = machinesList.length * 24 * 30;
      const mtbfHours = monthlyFailures > 0 && machineHours > 0
        ? Math.round(machineHours / monthlyFailures)
        : null;
      setTxt("mgrKpiOpen", openCount ?? '--');
      setTxt("mgrKpiOverdue", overdueCount ?? '--');
      setTxt("mgrKpiMttr", mttrHours !== null ? `${mttrHours.toFixed(1)} h` : '--');
      setTxt("mgrKpiMtbf", mtbfHours !== null ? `${mtbfHours} h` : '--');
      setTxt("mgrKpiMttrTrend", mttrData.sampleSize ? `${mttrData.sampleSize} ${isEn ? 'tickets' : 'بلاغ'}` : '--');
      setTxt("mgrKpiDowntime", `${totalDowntimeHours.toFixed(1)} h`);

      const overdueBadge = document.getElementById("mgrKpiOverdueBadge");
      if (overdueBadge) {
        overdueBadge.className = overdueCount === null
          ? "text-[11px] font-bold px-2 py-0.5 rounded bg-gray-500/15 text-slate-600 dark:text-slate-300"
          : overdueCount > 0
            ? "text-[11px] font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-700 dark:text-red-300 animate-pulse border border-red-500/40"
            : "text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
        overdueBadge.textContent = overdueCount === null
          ? (isEn ? 'Unavailable' : 'غير متاح')
          : overdueCount > 0
            ? (isEn ? 'Action Required' : 'يتطلب تدخلاً')
            : (isEn ? 'On Track' : 'ضمن الخطة');
      }

      renderParetoChart(cmTickets, isEn);
      renderTrendChart(cmTickets, isEn);
    } else {
      ["mgrKpiOpen", "mgrKpiOverdue", "mgrKpiMttr", "mgrKpiMtbf", "mgrKpiDowntime"].forEach(id => setTxt(id, "--"));
      setTxt("mgrKpiMttrTrend", "--");
      const overdueBadge = document.getElementById("mgrKpiOverdueBadge");
      if (overdueBadge) {
        overdueBadge.className = "text-[11px] font-bold px-2 py-0.5 rounded bg-gray-500/15 text-slate-600 dark:text-slate-300";
        overdueBadge.textContent = isEn ? "Unavailable" : "غير متاح";
      }
      showChartMessage("mgrParetoChart", "mgrParetoEmpty", isEn ? "Data unavailable" : "تعذر تحميل البيانات");
      showChartMessage("mgrTrendChart", "mgrTrendEmpty", isEn ? "Data unavailable" : "تعذر تحميل البيانات");
    }

    setTxt("mgrKpiPmRate", pmMonthTotal === null || !pmMonthTotal ? '--' : `${Math.round((pmMonthDone / pmMonthTotal) * 100)}%`);
    setTxt("mgrKpiPmCounts", pmMonthTotal === null ? '--' : `${pmMonthDone}/${pmMonthTotal} ${isEn ? 'PM orders this month' : 'أمر PM هذا الشهر'}`);

    renderDecisionsTable(tickets, pendingUsers, isEn, { ticketsAvailable, usersAvailable: pendingUsersAvailable });
    renderTechnicianWorkload(tickets, technicians, isEn, { ticketsAvailable, usersAvailable: techniciansAvailable });

    // 6. النبض التشغيلي
    setTxt("mgrPendingUsersCount", pendingUsersAvailable ? pendingUsers.length : '--');
    
    // عدد الماكينات المسجلة
    const machinesList = Array.isArray(window.machinesList) ? window.machinesList : [];
    // الوردية: من بيانات المستخدم المحفوظة بدل نص ثابت "Shift A (Green)"
    setTxt("mgrCurrentShiftName", localStorage.getItem('shift') || '--');
    setTxt("mgrTotalMachinesCount", machinesList.length > 0 ? machinesList.length : '--');

  } catch (err) {
    console.error("[ManagerDesktop] Error initializing dashboard data:", err);
    setManagerDataStatus("error", isEn);
    ["mgrKpiOpen", "mgrKpiOverdue", "mgrKpiMttr", "mgrKpiMtbf", "mgrKpiPmRate", "mgrKpiPmCounts", "mgrKpiDowntime", "mgrPendingUsersCount"].forEach(id => {
      const element = document.getElementById(id);
      if (element) element.textContent = "--";
    });
    showChartMessage("mgrParetoChart", "mgrParetoEmpty", isEn ? "Data unavailable" : "تعذر تحميل البيانات");
    showChartMessage("mgrTrendChart", "mgrTrendEmpty", isEn ? "Data unavailable" : "تعذر تحميل البيانات");
    renderDecisionsTable([], [], isEn, { ticketsAvailable: false, usersAvailable: false });
    renderTechnicianWorkload([], [], isEn, { ticketsAvailable: false, usersAvailable: false });
  } finally {
    if (spin) spin.classList.remove("animate-spin");
  }
}

function setManagerDataStatus(state, isEn) {
  const status = document.getElementById("mgrDataStatus");
  if (!status) return;
  const labels = {
    loading: isEn ? "Loading dashboard..." : "جاري تحميل لوحة المدير...",
    live: isEn ? "Live data" : "بيانات مباشرة",
    cached: isEn ? "Offline / cached data" : "دون اتصال / بيانات مخزنة",
    cachedPartial: isEn ? "Cached data; some sections unavailable" : "بيانات مخزنة؛ بعض الأقسام غير متاحة",
    partial: isEn ? "Some data unavailable" : "بعض البيانات غير متاحة",
    error: isEn ? "Dashboard data unavailable" : "بيانات اللوحة غير متاحة"
  };
  status.textContent = labels[state] || labels.error;
  status.className = state === "live"
    ? "px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
    : state === "cached" || state === "cachedPartial" || state === "partial" || state === "error"
      ? "px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
      : "px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-gray-500/15 text-slate-600 dark:text-slate-300 border border-gray-500/30";
}

function showChartMessage(canvasId, emptyId, message) {
  const canvas = document.getElementById(canvasId);
  const emptyEl = document.getElementById(emptyId);
  if (canvas) canvas.classList.add("hidden");
  if (emptyEl) {
    emptyEl.textContent = message;
    emptyEl.classList.remove("hidden");
  }
  if (canvasId === "mgrParetoChart" && paretoChartInstance) {
    paretoChartInstance.destroy();
    paretoChartInstance = null;
  }
  if (canvasId === "mgrTrendChart" && trendChartInstance) {
    trendChartInstance.destroy();
    trendChartInstance = null;
  }
}

// رسم Pareto لأكثر الماكينات عطلاً (Horizontal Bar + Cumulative Line)
function renderParetoChart(tickets, isEn) {
  const canvas = document.getElementById("mgrParetoChart");
  const emptyEl = document.getElementById("mgrParetoEmpty");
  if (paretoChartInstance) {
    paretoChartInstance.destroy();
    paretoChartInstance = null;
  }
  if (!canvas || typeof Chart === "undefined") {
    showChartMessage("mgrParetoChart", "mgrParetoEmpty", isEn ? "Chart unavailable" : "الرسم البياني غير متاح");
    return;
  }

  const topMachines = computeTopMachines(tickets, 6);
  if (!topMachines.length) {
    showChartMessage("mgrParetoChart", "mgrParetoEmpty", isEn ? "No breakdown data" : "لا توجد بيانات أعطال");
    return;
  }

  canvas.classList.remove("hidden");
  if (emptyEl) emptyEl.classList.add("hidden");

  const labels = topMachines.map(m => m[0]);
  const counts = topMachines.map(m => m[1]);
  const total = counts.reduce((a, b) => a + b, 0);

  // حساب النسبة التراكمية
  let running = 0;
  const cumulativePercentages = counts.map(c => {
    running += c;
    return total > 0 ? Math.round((running / total) * 100) : 0;
  });

  const isDark = document.documentElement.classList.contains("dark");
  const textColor = isDark ? "#e2e8f0" : "#334155";
  const gridColor = isDark ? "rgba(71, 85, 105, 0.45)" : "rgba(203, 213, 225, 0.7)";

  paretoChartInstance = new Chart(canvas, {
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: isEn ? 'Breakdowns Count' : 'عدد الأعطال',
          data: counts,
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderRadius: 6,
          yAxisID: 'y'
        },
        {
          type: 'line',
          label: isEn ? 'Cumulative %' : 'النسبة التراكمية %',
          data: cumulativePercentages,
          borderColor: '#ef4444',
          backgroundColor: '#ef4444',
          tension: 0.25,
          borderWidth: 2,
          pointRadius: 3,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: textColor, font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              if (ctx.dataset.type === 'line') {
                return `${ctx.dataset.label}: ${ctx.raw}%`;
              }
              return `${ctx.dataset.label}: ${ctx.raw}`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { size: 11 } },
          grid: { display: false }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          ticks: { color: textColor, precision: 0, font: { size: 11 } },
          grid: { color: gridColor }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          min: 0,
          max: 100,
          ticks: {
            color: '#ef4444',
            font: { size: 11 },
            callback: v => `${v}%`
          },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
}

// رسم اتجاه الأعطال الأسبوعي والشهري
function renderTrendChart(tickets, isEn) {
  const canvas = document.getElementById("mgrTrendChart");
  const emptyEl = document.getElementById("mgrTrendEmpty");
  if (!canvas || typeof Chart === "undefined") {
    showChartMessage("mgrTrendChart", "mgrTrendEmpty", isEn ? "Chart unavailable" : "الرسم البياني غير متاح");
    return;
  }
  const { labels: chartLabels, newCounts, resolvedCounts } = buildManagerTrendSeries(tickets, { isEnglish: isEn });

  if (trendChartInstance) {
    trendChartInstance.destroy();
    trendChartInstance = null;
  }
  if (!newCounts.some(Boolean) && !resolvedCounts.some(Boolean)) {
    showChartMessage("mgrTrendChart", "mgrTrendEmpty", isEn ? "No trend data available" : "لا توجد بيانات اتجاه");
    return;
  }
  canvas.classList.remove("hidden");
  if (emptyEl) emptyEl.classList.add("hidden");

  const isDark = document.documentElement.classList.contains("dark");
  const textColor = isDark ? "#e2e8f0" : "#334155";
  const gridColor = isDark ? "rgba(71, 85, 105, 0.45)" : "rgba(203, 213, 225, 0.7)";

  trendChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels: chartLabels,
      datasets: [
        {
          label: isEn ? 'New Breakdowns' : 'بلاغات جديدة',
          data: newCounts,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 3
        },
        {
          label: isEn ? 'Resolved' : 'تم إصلاحه',
          data: resolvedCounts,
          borderColor: '#10b981',
          backgroundColor: 'transparent',
          borderDash: [4, 4],
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: textColor, font: { size: 11 } }
        }
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { size: 11 } },
          grid: { color: gridColor }
        },
        y: {
          ticks: { color: textColor, precision: 0, font: { size: 11 } },
          grid: { color: gridColor }
        }
      }
    }
  });
}

// جدول يحتاج قراراً الآن (Decisions Desk)
function renderDecisionsTable(tickets, users, isEn, { ticketsAvailable = true, usersAvailable = true } = {}) {
  const tbody = document.getElementById("mgrDecisionsTableBody");
  const countBadge = document.getElementById("mgrDecisionsCount");
  if (!tbody) return;

  const decisions = [];

  // 1. تذاكر متأخرة عن SLA أو حرجة جداً
  (ticketsAvailable ? tickets : []).forEach(t => {
    const isClosed = CLOSED_STATUSES.includes(String(t.status || '').trim().toLowerCase());
    if (isClosed) return;

    const isHigh = String(t.priority || '').trim().toLowerCase() === 'high';
    const isOverdue = isOverdueTicket(t);

    if (isOverdue || isHigh) {
      decisions.push({
        id: t.id,
        type: isOverdue ? 'overdue' : 'urgent_ticket',
        rank: isOverdue ? 0 : 1,
        ts: (parseTicketDate(t.createdAtServer) || parseTicketDate(t))?.getTime() || 0,
        badge: isOverdue ? (isEn ? 'SLA Breach' : 'تأخر SLA') : (isEn ? 'High Priority' : 'أولوية قصوى'),
        badgeClass: 'bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30',
        title: `${t.machine || (isEn ? 'Machine' : 'ماكينة')} - ${t.description ? (String(t.description).slice(0, 45) + (String(t.description).length > 45 ? '...' : '')) : (isEn ? 'Breakdown' : 'عطل')}`,
        meta: `${t.line || (isEn ? 'General' : 'عام')} • ${t.assignedTo || (isEn ? 'Unassigned' : 'غير معين')}`,
        time: (parseTicketDate(t.createdAtServer) || parseTicketDate(t))?.toLocaleDateString(isEn ? 'en-US' : 'ar-EG', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) || '-',
        actionBtn: `<button onclick="window.openTicketDetailsModal('${escapeJsArg(t.id)}')" class="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition active:scale-95 cursor-pointer">${isEn ? 'Review' : 'معاينة'}</button>`
      });
    } else if (String(t.status || '').trim().toLowerCase() === 'pending' && !t.assignedTo) {
      // 2. بلاغات جديدة بدون تعيين
      decisions.push({
        id: t.id,
        type: 'unassigned',
        rank: 3,
        ts: (parseTicketDate(t.createdAtServer) || parseTicketDate(t))?.getTime() || 0,
        badge: isEn ? 'Unassigned' : 'بانتظار الإسناد',
        badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30',
        title: `${t.machine || (isEn ? 'Machine' : 'ماكينة')} - ${t.description ? (String(t.description).slice(0, 45) + (String(t.description).length > 45 ? '...' : '')) : (isEn ? 'Pending Ticket' : 'بلاغ جديد')}`,
        meta: `${t.line || (isEn ? 'General' : 'عام')} • ${t.reportedBy || (isEn ? 'User' : 'مستخدم')}`,
        time: (parseTicketDate(t.createdAtServer) || parseTicketDate(t))?.toLocaleDateString(isEn ? 'en-US' : 'ar-EG', { month: 'numeric', day: 'numeric' }) || '-',
        actionBtn: `<button onclick="window.openTicketDetailsModal('${escapeJsArg(t.id)}')" class="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition active:scale-95 cursor-pointer">${isEn ? 'Assign' : 'إسناد فني'}</button>`
      });
    }
  });

  // 3. طلبات تسجيل مستخدمين جديدة بانتظار الموافقة
  (usersAvailable ? users : []).forEach(u => {
    if (u.status === 'pending' || u.role === 'pending') {
      decisions.push({
        id: u.id,
        type: 'user_request',
        rank: 2,
        ts: parseTicketDate(u.createdAt)?.getTime() || 0,
        badge: isEn ? 'User Request' : 'طلب انضمام',
        badgeClass: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30',
        title: `${u.name || (isEn ? 'New User' : 'مستخدم جديد')} (${u.job || u.role || 'Member'})`,
        meta: `${u.phone || ''} • ${u.department || (isEn ? 'Production' : 'الإنتاج')}`,
        time: parseTicketDate(u.createdAt)?.toLocaleDateString(isEn ? 'en-US' : 'ar-EG', { month: 'numeric', day: 'numeric' }) || '-',
        actionBtn: `<span class="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">${isEn ? 'Administrator approval required' : 'يتطلب اعتماد مدير النظام'}</span>`
      });
    }
  });

  // ترتيب: تأخر SLA ثم أولوية قصوى ثم طلبات الانضمام ثم غير المسند - الأقدم أولاً داخل كل فئة
  decisions.sort((a, b) => (a.rank - b.rank) || ((a.ts || Number.MAX_SAFE_INTEGER) - (b.ts || Number.MAX_SAFE_INTEGER)));

  if (countBadge) {
    countBadge.textContent = ticketsAvailable && usersAvailable
      ? `${decisions.length} ${isEn ? 'Decisions' : 'قرارات'}`
      : `— ${isEn ? 'Decisions' : 'قرارات'}`;
  }

  const availabilityMessages = [];
  if (!ticketsAvailable) availabilityMessages.push(isEn ? "Ticket data could not be loaded." : "تعذر تحميل بيانات البلاغات.");
  if (!usersAvailable) availabilityMessages.push(isEn ? "User requests could not be loaded." : "تعذر تحميل طلبات المستخدمين.");

  if (!decisions.length && !availabilityMessages.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-8 text-center text-slate-600 dark:text-slate-300">
          <div class="text-2xl mb-1">🎉</div>
          <div class="font-bold text-slate-800 dark:text-slate-200 text-xs">
            ${isEn ? 'All operational decisions are up to date' : 'رائع! لا توجد قرارات أو بلاغات حرجة معلقة الآن'}
          </div>
          <div class="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
            ${isEn ? 'No SLA breaches or unassigned tasks' : 'كافة التذاكر مسندة ولا توجد تجاوزات في أوقات الإصلاح'}
          </div>
        </td>
      </tr>
    `;
    return;
  }

  // عرض أول 6 عناصر فقط في الرئيسية لتفادي التكدس
  const visibleItems = decisions.slice(0, 6);

  const hiddenItems = decisions.slice(visibleItems.length);
  const hiddenTicketCount = hiddenItems.filter(item => item.type !== "user_request").length;
  const hiddenUserCount = hiddenItems.filter(item => item.type === "user_request").length;
  const footerActions = [
    hiddenTicketCount ? `<button type="button" onclick="window.openTicketsWithFilter('all')" class="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-bold cursor-pointer">${isEn ? `View remaining tickets (${hiddenTicketCount})` : `عرض باقي البلاغات (${hiddenTicketCount})`}</button>` : "",
    hiddenUserCount ? `<span class="text-[11px] text-indigo-700 dark:text-indigo-300 font-bold">${isEn ? `${hiddenUserCount} more requests require administrator review` : `${hiddenUserCount} طلب إضافي يتطلب مراجعة مدير النظام`}</span>` : ""
  ].filter(Boolean);

  tbody.innerHTML = visibleItems.map(item => `
    <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition">
      <td class="py-2.5 px-3">
        <span class="inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ${item.badgeClass}">
          ${item.badge}
        </span>
      </td>
      <td class="py-2.5 px-3 font-medium text-gray-900 dark:text-white max-w-[280px] truncate" title="${escapeHtml(item.title)}">
        ${escapeHtml(item.title)}
      </td>
      <td class="py-2.5 px-3 text-slate-600 dark:text-slate-300">
        ${escapeHtml(item.meta)}
      </td>
      <td class="py-2.5 px-3 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
        ${item.time}
      </td>
      <td class="py-2.5 px-3 text-center">
        ${item.actionBtn}
      </td>
    </tr>
  `).join("") + availabilityMessages.map(message => `
    <tr><td colspan="5" class="py-3 px-3 text-center text-amber-500">${escapeHtml(message)}</td></tr>
  `).join("") + (footerActions.length
    ? `<tr><td colspan="5" class="py-2.5 px-3 text-center"><div class="flex flex-wrap justify-center gap-4">${footerActions.join("")}</div></td></tr>`
    : "");
}

// عرض أداء وحمل عمل الفنيين
function renderTechnicianWorkload(tickets, users, isEn, { ticketsAvailable = true, usersAvailable = true } = {}) {
  const container = document.getElementById("mgrTechWorkloadList");
  if (!container) return;

  if (!ticketsAvailable) {
    container.innerHTML = `<div class="py-4 text-center text-amber-500 text-xs">${isEn ? "Ticket data could not be loaded." : "تعذر تحميل بيانات البلاغات."}</div>`;
    return;
  }

  const workload = new Map();
  const employeeKeyByName = new Map();

  if (usersAvailable) users.forEach(u => {
    const r = String(u.role || '').toLowerCase();
    if (r === 'technician' || r === 'engineer' || r === 'maintainer' || r === 'فني' || r === 'مهندس') {
      const name = String(u.name || '').trim();
      if (name) {
        const key = u.id || name;
        workload.set(key, { name, active: 0, resolved: 0, total: 0 });
        employeeKeyByName.set(name, key);
      }
    }
  });

  // حساب المهام من التذاكر
  tickets.forEach(ticket => {
    const tech = String(ticket.assignedTo || '').trim();
    if (!tech) return;

    const key = ticket.assignedToUid || employeeKeyByName.get(tech) || tech;
    if (!workload.has(key)) {
      workload.set(key, { name: tech, active: 0, resolved: 0, total: 0 });
    }

    const isClosed = CLOSED_STATUSES.includes(String(ticket.status || '').trim().toLowerCase());
    if (isClosed) {
      workload.get(key).resolved++;
    } else {
      workload.get(key).active++;
    }
    workload.get(key).total++;
  });

  const sortedTechs = Array.from(workload.values())
    .sort((a, b) => (b.active + b.resolved) - (a.active + a.resolved))
    .slice(0, 6);

  if (!sortedTechs.length) {
    container.innerHTML = `
      <div class="py-4 text-center text-slate-600 dark:text-slate-300 text-xs">
        ${usersAvailable
          ? (isEn ? 'No technician assigned records found' : 'لا توجد بيانات تعيين لفنيين حتى الآن')
          : (isEn ? 'Technician roster could not be loaded.' : 'تعذر تحميل قائمة الفنيين.')}
      </div>
    `;
    return;
  }

  const maxTotal = Math.max(...sortedTechs.map(t => t.total), 1);

  container.innerHTML = sortedTechs.map((data, idx) => {
    const activePercent = Math.min(100, Math.round((data.active / maxTotal) * 100));
    const resolvedPercent = Math.min(100, Math.round((data.resolved / maxTotal) * 100));

    return `
      <div class="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
        <div class="flex items-center justify-between text-xs mb-1.5">
          <div class="flex items-center gap-1.5">
            <span class="w-5 h-5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-[11px]">
              ${idx + 1}
            </span>
            <span class="font-bold text-gray-900 dark:text-white truncate max-w-[130px]">${escapeHtml(data.name)}</span>
          </div>
          <div class="flex items-center gap-2 font-mono text-[11px]">
            <span class="text-amber-600 dark:text-amber-400 font-bold" title="${isEn ? 'Active Workload' : 'مهام جارية'}">⚡ ${data.active}</span>
            <span class="text-emerald-600 dark:text-emerald-400 font-bold" title="${isEn ? 'Resolved' : 'تم حلها'}">✅ ${data.resolved}</span>
          </div>
        </div>

        <!-- بار النسبة المزدوج -->
        <div class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
          <div class="bg-amber-500 transition-all duration-300" style="width: ${activePercent}%" title="${isEn ? 'Active' : 'نشط'}"></div>
          <div class="bg-emerald-500 transition-all duration-300" style="width: ${resolvedPercent}%" title="${isEn ? 'Resolved' : 'تم حله'}"></div>
        </div>
      </div>
    `;
  }).join("") + (!usersAvailable
    ? `<div class="text-center text-amber-600 dark:text-amber-400 text-[11px]">${isEn ? "Technician roster may be incomplete." : "قد تكون قائمة الفنيين غير مكتملة."}</div>`
    : "");
}

// دالة التحديث اليدوي
window.refreshManagerDesktopDashboard = async function() {
  await initManagerDesktopHomeData();
};

function localDateStr() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// دالة التصدير التنفيذي
window.exportManagerExecutiveSummary = async function() {
  const isEn = (window.currentLang || 'ar') === 'en';
  const currentUserId = localStorage.getItem("userId") || "";
  if (!currentUserId || !cachedDashboardData || cachedDashboardData.userId !== currentUserId
    || !Array.isArray(cachedDashboardData.tickets) || !cachedDashboardData.tickets.length) {
    window.print();
    return;
  }

  try {
    const headers = isEn 
      ? ["Ticket ID", "Line / Area", "Machine", "Priority", "Status", "Assigned Technician", "Reported By", "Logged Time"]
      : ["رقم البلاغ", "الخط / الموقع", "الماكينة", "الأولوية", "الحالة", "الفني المكلف", "المُبلّغ", "وقت البلاغ"];

    // نفس تسميات الشاشات ونفس مصدر التاريخ (parseTicketDate) - والمعرّف كامل
    // بدل slice(0,10) اللي كان بيقطع رقم البلاغ ويخليه مش قابل للمطابقة
    const EN_STATUS_LABELS = {
      pending: 'New', assigned: 'Assigned', in_progress: 'In Progress',
      resolved: 'Awaiting Reporter Confirmation', closed: 'Closed', reopened: 'In Progress'
    };
    const rows = cachedDashboardData.tickets.map(t => {
      const st = String(t.status || 'pending').toLowerCase().trim();
      const created = parseTicketDate(t);
      return [
        displayRecordNumber(t, ''),
        t.line || '',
        t.machine || '',
        t.priority || (isEn ? 'Normal' : 'عادية'),
        (isEn ? (EN_STATUS_LABELS[st] || st) : (STATUS_LABELS[st] || st)),
        t.assignedTo || (isEn ? 'Unassigned' : 'غير معين'),
        t.reportedBy || '',
        created ? created.toLocaleString(isEn ? 'en-US' : 'ar-EG') : '-'
      ];
    });

    const title = isEn ? "Executive Breakdown Summary" : "ملخص الأعطال التنفيذي";
    // إصلاح: التوقيع الصحيح exportToExcel(title, headers, rows, filename, options)
    // - الاستدعاء القديم (sheets, filename) كان بيرمي TypeError فيسقط على window.print()
    const ok = await exportToExcel(title, headers, rows,
      `Executive_Maintenance_Report_${localDateStr()}.xlsx`,
      {
        sheetName: isEn ? 'Tickets' : 'البلاغات',
        periodLabel: isEn ? "Live Operations Snapshot" : "لقطة حية لعمليات الصيانة"
      });
    if (ok === false) return;
  } catch (err) {
    console.error("Export executive report error:", err);
    window.print();
  }
};
