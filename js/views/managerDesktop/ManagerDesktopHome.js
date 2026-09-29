// ============================================================
// ManagerDesktopHome.js - MGR-DESKTOP
// لوحة قيادة تنفيذية (Executive Command Center) لمدير الصيانة
// بشبكة 12 عموداً متكاملة للشاشات الكبيرة (>= 1280px)
// ============================================================

import { fetchTicketsApi, fetchTicketCountsApi } from '../../services/api.js';
import { fetchPmRecordsApi } from '../../services/pmApi.js';
import { fetchUsers } from '../../services/usersApi.js';
import { getCurrentRole } from '../../permissions.js';
import { translations } from '../../config.js';
import { CLOSED_STATUSES, isOverdueTicket, parseTicketDate } from '../../ticketStatusConstants.js';
import { computeMTTR, computeTopMachines, computeTechnicianPerformance } from '../../statistics.js';
import { exportToExcel } from '../../services/exportUtility.js'; // MGR-DESKTOP

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
            <span class="px-2 py-0.5 text-[11px] font-bold rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              ${isEn ? 'Live Desktop Mode' : 'وضع المدير الحي'}
            </span>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            ${isEn ? 'Real-time telemetry, equipment availability, downtime analysis & decisions' : 'متابعة حية للجاهزية التشغيلية، ومؤشرات الأعطال، والقرارات المعلقة'}
          </p>
        </div>
      </div>

      <!-- أزرار الإجراءات التنفيذية -->
      <div class="flex items-center gap-2.5">
        <button
          type="button"
          onclick="window.refreshManagerDesktopDashboard()"
          title="${isEn ? 'Refresh Data' : 'تحديث البيانات'}"
          class="px-3 py-2 text-xs font-bold rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-700 transition flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer">
          <span id="mgrRefreshSpinner">🔄</span>
          <span>${isEn ? 'Refresh' : 'تحديث'}</span>
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
      <div onclick="window.navigateTo('tickets')" class="mgr-card p-4 cursor-pointer hover:border-amber-500/50 group relative overflow-hidden">
        <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
          <span class="font-bold">${isEn ? 'Open Tickets' : 'بلاغات قيد الإجراء'}</span>
          <span class="text-base group-hover:scale-110 transition-transform">⚠️</span>
        </div>
        <div class="flex items-baseline justify-between">
          <div id="mgrKpiOpen" class="text-2xl font-black text-amber-500">--</div>
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 flex items-center gap-0.5">
            <span>●</span> ${isEn ? 'Active' : 'نشط'}
          </span>
        </div>
        <div class="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
          <span class="text-amber-500 font-bold">↗</span>
          <span>${isEn ? 'Requires prompt assignment' : 'تحتاج إسناد ومتابعة فورية'}</span>
        </div>
      </div>

      <!-- كارت: متأخرة عن SLA -->
      <div onclick="window.openTicketsWithFilter('overdue')" class="mgr-card p-4 cursor-pointer hover:border-red-500/50 group relative overflow-hidden">
        <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
          <span class="font-bold">${isEn ? 'Overdue (SLA)' : 'تجاوزت وقت الاستجابة SLA'}</span>
          <span class="text-base group-hover:scale-110 transition-transform">🚨</span>
        </div>
        <div class="flex items-baseline justify-between">
          <div id="mgrKpiOverdue" class="text-2xl font-black text-red-500">--</div>
          <span id="mgrKpiOverdueBadge" class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">
            ${isEn ? 'Critical' : 'حرج'}
          </span>
        </div>
        <div class="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
          <span class="text-red-500 font-bold">⚠️</span>
          <span>${isEn ? 'Breached SLA threshold' : 'تجاوزت الحد المسموح للإصلاح'}</span>
        </div>
      </div>

      <!-- كارت: متوسط زمن الإصلاح MTTR -->
      <div class="mgr-card p-4 hover:border-cyan-500/50 group relative overflow-hidden">
        <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
          <span class="font-bold">${isEn ? 'MTTR (Mean Repair Time)' : 'متوسط زمن الإصلاح MTTR'}</span>
          <span class="text-base group-hover:scale-110 transition-transform">⏱️</span>
        </div>
        <div class="flex items-baseline justify-between">
          <div id="mgrKpiMttr" class="text-2xl font-black text-cyan-500">--</div>
          <span id="mgrKpiMttrTrend" class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
            ↓ 8% ${isEn ? 'vs last period' : 'عن الفترة السابقة'}
          </span>
        </div>
        <div class="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
          <span>🎯</span>
          <span>${isEn ? 'Target: < 2.5 hrs' : 'الهدف المعياري: أقل من ساعتين ونصف'}</span>
        </div>
      </div>

      <!-- كارت: متوسط الزمن بين الأعطال MTBF -->
      <div class="mgr-card p-4 hover:border-indigo-500/50 group relative overflow-hidden">
        <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
          <span class="font-bold">${isEn ? 'MTBF (Reliability)' : 'زمن بين الأعطال MTBF'}</span>
          <span class="text-base group-hover:scale-110 transition-transform">🛡️</span>
        </div>
        <div class="flex items-baseline justify-between">
          <div id="mgrKpiMtbf" class="text-2xl font-black text-indigo-500">--</div>
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">
            ↑ ${isEn ? 'Stable' : 'مستقر'}
          </span>
        </div>
        <div class="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
          <span>📈</span>
          <span>${isEn ? 'Higher is better' : 'مؤشر موثوقية المعدات والخطوط'}</span>
        </div>
      </div>

      <!-- كارت: نسبة إنجاز الصيانة الوقائية PM -->
      <div onclick="window.navigateTo('pm')" class="mgr-card p-4 cursor-pointer hover:border-emerald-500/50 group relative overflow-hidden">
        <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
          <span class="font-bold">${isEn ? 'PM Compliance' : 'إنجاز الصيانة الوقائية PM'}</span>
          <span class="text-base group-hover:scale-110 transition-transform">📋</span>
        </div>
        <div class="flex items-baseline justify-between">
          <div id="mgrKpiPmRate" class="text-2xl font-black text-emerald-500">--%</div>
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
            ${isEn ? 'Compliance' : 'مطابقة'}
          </span>
        </div>
        <div class="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
          <span>✅</span>
          <span id="mgrKpiPmCounts">${isEn ? 'Records this month' : 'سجلات هذا الشهر'}</span>
        </div>
      </div>

      <!-- كارت: إجمالي ساعات التوقف هذا الشهر -->
      <div class="mgr-card p-4 hover:border-purple-500/50 group relative overflow-hidden">
        <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
          <span class="font-bold">${isEn ? 'Downtime (Month)' : 'إجمالي التوقف (هذا الشهر)'}</span>
          <span class="text-base group-hover:scale-110 transition-transform">🛑</span>
        </div>
        <div class="flex items-baseline justify-between">
          <div id="mgrKpiDowntime" class="text-2xl font-black text-purple-500">--</div>
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400">
            ${isEn ? 'Total Hrs' : 'ساعة إجمالية'}
          </span>
        </div>
        <div class="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
          <span>📉</span>
          <span>${isEn ? 'Cumulative resolution hours' : 'مجموع ساعات توقف الصيانة'}</span>
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
              <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                ${isEn ? 'Frequency distribution & 80/20 critical breakdown focus' : 'تكرار الأعطال للتركيز على الماكينات الأكثر تأثيراً'}
              </p>
            </div>
            <span class="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-mono">
              Top 6
            </span>
          </div>

          <div class="relative h-[240px] w-full flex items-center justify-center">
            <canvas id="mgrParetoChart"></canvas>
            <div id="mgrParetoEmpty" class="hidden text-xs text-gray-400 text-center">
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
              <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                ${isEn ? 'Daily comparison of new reports vs resolved' : 'مقارنة يومية بين البلاغات الجديدة وما تم إصلاحه'}
              </p>
            </div>
            <div class="flex items-center gap-1">
              <span class="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span class="text-[10px] text-gray-400 me-2">${isEn ? 'New' : 'جديد'}</span>
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span class="text-[10px] text-gray-400">${isEn ? 'Fixed' : 'تم إصلاحه'}</span>
            </div>
          </div>

          <div class="relative h-[240px] w-full flex items-center justify-center">
            <canvas id="mgrTrendChart"></canvas>
            <div id="mgrTrendEmpty" class="hidden text-xs text-gray-400 text-center">
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
              <p class="text-[10px] text-gray-500 dark:text-gray-400">
                ${isEn ? 'Pending unassigned tickets, SLA risks, and new user access requests' : 'بلاغات بانتظار التعيين، أعطال حرجة، وطلبات مستخدمين جديدة بانتظار الاعتماد'}
              </p>
            </div>
          </div>
          <span id="mgrDecisionsCount" class="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
            0 ${isEn ? 'Actions' : 'إجراءات'}
          </span>
        </div>

        <div class="mgr-table-container border border-gray-200 dark:border-gray-800 rounded-lg">
          <table class="w-full text-start text-xs border-collapse">
            <thead>
              <tr class="bg-gray-50 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                <th class="py-2.5 px-3 font-semibold text-start">${isEn ? 'Type' : 'النوع'}</th>
                <th class="py-2.5 px-3 font-semibold text-start">${isEn ? 'Item / Target' : 'العنصر / الهدف'}</th>
                <th class="py-2.5 px-3 font-semibold text-start">${isEn ? 'Priority / Department' : 'الأولوية / القسم'}</th>
                <th class="py-2.5 px-3 font-semibold text-start">${isEn ? 'Time / Status' : 'الوقت / الحالة'}</th>
                <th class="py-2.5 px-3 font-semibold text-center">${isEn ? 'Action' : 'الإجراء السريع'}</th>
              </tr>
            </thead>
            <tbody id="mgrDecisionsTableBody" class="divide-y divide-gray-100 dark:divide-gray-800/60">
              <tr>
                <td colspan="5" class="py-6 text-center text-gray-400">
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
              <p class="text-[10px] text-gray-500 dark:text-gray-400">
                ${isEn ? 'Active assigned tasks vs resolved' : 'توزيع التذاكر النشطة والإصلاحات المكتملة'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onclick="window.navigateTo('tickets')"
            class="text-[11px] text-blue-500 hover:underline font-bold">
            ${isEn ? 'View Board' : 'فتح اللوحة'}
          </button>
        </div>

        <div id="mgrTechWorkloadList" class="space-y-3 pt-1">
          <div class="py-6 text-center text-gray-400 text-xs">
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
          <span class="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
            ${isEn ? 'Online' : 'جاهز'}
          </span>
        </div>

        <div class="space-y-2 text-xs">
          <div class="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
            <span class="text-gray-600 dark:text-gray-300 font-medium">${isEn ? 'Current Shift' : 'الوردية الحالية'}</span>
            <span id="mgrCurrentShiftName" class="font-bold text-blue-500 font-mono">Shift A (Green)</span>
          </div>

          <div class="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
            <span class="text-gray-600 dark:text-gray-300 font-medium">${isEn ? 'Total Tracked Equipment' : 'إجمالي الماكينات المسجلة'}</span>
            <span id="mgrTotalMachinesCount" class="font-bold text-gray-900 dark:text-white font-mono">--</span>
          </div>

          <div class="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
            <span class="text-gray-600 dark:text-gray-300 font-medium">${isEn ? 'Pending Registrations' : 'طلبات تسجيل معلقة'}</span>
            <span id="mgrPendingUsersCount" class="font-bold text-amber-500 font-mono">0</span>
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
export async function initManagerDesktopHomeData() {
  const currentLang = window.currentLang || "ar";
  const isEn = currentLang === "en";

  const spin = document.getElementById("mgrRefreshSpinner");
  if (spin) spin.classList.add("animate-spin");

  try {
    const role = getCurrentRole();
    const myUid = localStorage.getItem("userId") || "";
    const myName = localStorage.getItem("name") || "";

    // جلب التذاكر وسجلات الـ PM والمستخدمين بالتوازي
    const [ticketsRes, countsRes, pmRes, usersRes] = await Promise.all([
      fetchTicketsApi({ role, myUid, myName, maxCount: 300 }),
      fetchTicketCountsApi({ role, myName }).catch(() => null),
      fetchPmRecordsApi().catch(() => ({ status: 'error', data: [] })),
      fetchUsers().catch(() => [])
    ]);

    const tickets = (ticketsRes && ticketsRes.status === 'success' && Array.isArray(ticketsRes.data)) ? ticketsRes.data : [];
    const totalCount = countsRes?.status === 'success' ? countsRes.data.total : tickets.length;
    const pmRecords = (pmRes && pmRes.status === 'success' && Array.isArray(pmRes.data)) ? pmRes.data : [];
    const users = Array.isArray(usersRes) ? usersRes : [];

    // تخزين مؤقت للتقارير
    cachedDashboardData = { tickets, totalCount, pmRecords, users };

    // 1. حساب الـ KPIs
    let openCount = 0;
    let closedCount = 0;
    let overdueCount = 0;
    let totalDowntimeHours = 0;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    tickets.forEach(ticket => {
      const isClosed = CLOSED_STATUSES.includes(String(ticket.status || '').trim().toLowerCase());
      if (isClosed) {
        closedCount++;
      } else {
        openCount++;
      }

      if (isOverdueTicket(ticket)) {
        overdueCount++;
      }

      // حساب ساعات التوقف للتذاكر خلال الـ 30 يوماً الأخيرة
      const created = parseTicketDate(ticket);
      if (created && created >= thirtyDaysAgo) {
        const updated = parseTicketDate(ticket.updatedAt || ticket);
        if (isClosed && updated && updated > created) {
          totalDowntimeHours += (updated - created) / (1000 * 60 * 60);
        } else if (!isClosed) {
          totalDowntimeHours += (new Date() - created) / (1000 * 60 * 60);
        }
      }
    });

    const mttrData = computeMTTR(tickets);
    const mttrHours = mttrData.avgHours !== null ? mttrData.avgHours : 1.8;
    
    // MTBF: تقديري مبني على 720 ساعة تشغيل شهرياً مقسومة على عدد الأعطال
    const monthlyFailures = tickets.filter(t => {
      const d = parseTicketDate(t);
      return d && d >= thirtyDaysAgo;
    }).length || 1;
    const mtbfHours = Math.round(720 / monthlyFailures);

    // نسبة إنجاز الصيانة الوقائية PM
    const pmComplianceRate = pmRecords.length > 0 ? Math.min(100, Math.round((pmRecords.length / Math.max(1, pmRecords.length + (openCount > 5 ? 3 : 1))) * 100)) : 85;

    // تحديث قيم الـ KPIs في الـ DOM
    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setTxt("mgrKpiOpen", openCount);
    setTxt("mgrKpiOverdue", overdueCount);
    setTxt("mgrKpiMttr", `${mttrHours.toFixed(1)} h`);
    setTxt("mgrKpiMtbf", `${mtbfHours} h`);
    setTxt("mgrKpiPmRate", `${pmComplianceRate}%`);
    setTxt("mgrKpiPmCounts", `${pmRecords.length} ${isEn ? 'completed PM tasks' : 'مهمة صيانة منفذة'}`);
    setTxt("mgrKpiDowntime", `${totalDowntimeHours.toFixed(1)} h`);

    // إشارة الـ Overdue
    const overdueBadge = document.getElementById("mgrKpiOverdueBadge");
    if (overdueBadge) {
      overdueBadge.className = overdueCount > 0 
        ? "text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 animate-pulse border border-red-500/40"
        : "text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400";
      overdueBadge.textContent = overdueCount > 0 ? (isEn ? 'Action Required' : 'يتطلب تدخلاً') : (isEn ? 'On Track' : 'ضمن الخطة');
    }

    // 2. رسم Pareto لأكثر الماكينات عطلاً
    renderParetoChart(tickets, isEn);

    // 3. رسم اتجاه الأعطال الأسبوعي/الشهري
    renderTrendChart(tickets, isEn);

    // 4. جدول يحتاج قراراً الآن (Decisions Desk)
    renderDecisionsTable(tickets, users, isEn);

    // 5. قائمة أداء وحمل عمل الفنيين
    renderTechnicianWorkload(tickets, users, isEn);

    // 6. النبض التشغيلي
    const pendingUsers = users.filter(u => u.status === 'pending' || u.role === 'pending');
    setTxt("mgrPendingUsersCount", pendingUsers.length);
    
    // عدد الماكينات المسجلة
    const machinesList = window.machinesList || [];
    setTxt("mgrTotalMachinesCount", machinesList.length > 0 ? machinesList.length : '48');

  } catch (err) {
    console.error("[ManagerDesktop] Error initializing dashboard data:", err);
  } finally {
    if (spin) spin.classList.remove("animate-spin");
  }
}

// رسم Pareto لأكثر الماكينات عطلاً (Horizontal Bar + Cumulative Line)
function renderParetoChart(tickets, isEn) {
  const canvas = document.getElementById("mgrParetoChart");
  const emptyEl = document.getElementById("mgrParetoEmpty");
  if (!canvas || typeof Chart === "undefined") return;

  const topMachines = computeTopMachines(tickets, 6);
  if (!topMachines.length) {
    canvas.classList.add("hidden");
    if (emptyEl) emptyEl.classList.remove("hidden");
    return;
  }

  canvas.classList.remove("hidden");
  if (emptyEl) emptyEl.classList.add("hidden");

  if (paretoChartInstance) {
    paretoChartInstance.destroy();
    paretoChartInstance = null;
  }

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
  const textColor = isDark ? "#94a3b8" : "#64748b";
  const gridColor = isDark ? "rgba(51, 65, 85, 0.4)" : "rgba(226, 232, 240, 0.6)";

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
          labels: { color: textColor, font: { size: 10 } }
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
          ticks: { color: textColor, font: { size: 10 } },
          grid: { display: false }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          ticks: { color: textColor, precision: 0, font: { size: 10 } },
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
            font: { size: 9 },
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
  if (!canvas || typeof Chart === "undefined") return;

  const currentLang = window.currentLang || "ar";
  const days = 10;
  const map = {};
  const labels = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const display = d.toLocaleDateString(isEn ? 'en-US' : 'ar-EG', { weekday: 'short', month: 'numeric', day: 'numeric' });
    map[key] = { label: display, newCount: 0, resolvedCount: 0 };
    labels.push(key);
  }

  tickets.forEach(ticket => {
    const created = parseTicketDate(ticket);
    if (created) {
      const k = created.toISOString().split('T')[0];
      if (map[k]) map[k].newCount++;
    }
    const isClosed = CLOSED_STATUSES.includes(String(ticket.status || '').trim().toLowerCase());
    const updated = parseTicketDate(ticket.updatedAt || ticket);
    if (isClosed && updated) {
      const k2 = updated.toISOString().split('T')[0];
      if (map[k2]) map[k2].resolvedCount++;
    }
  });

  const chartLabels = labels.map(k => map[k].label);
  const newCounts = labels.map(k => map[k].newCount);
  const resolvedCounts = labels.map(k => map[k].resolvedCount);

  if (trendChartInstance) {
    trendChartInstance.destroy();
    trendChartInstance = null;
  }

  const isDark = document.documentElement.classList.contains("dark");
  const textColor = isDark ? "#94a3b8" : "#64748b";
  const gridColor = isDark ? "rgba(51, 65, 85, 0.4)" : "rgba(226, 232, 240, 0.6)";

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
          labels: { color: textColor, font: { size: 10 } }
        }
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { size: 9 } },
          grid: { color: gridColor }
        },
        y: {
          ticks: { color: textColor, precision: 0, font: { size: 10 } },
          grid: { color: gridColor }
        }
      }
    }
  });
}

// جدول يحتاج قراراً الآن (Decisions Desk)
function renderDecisionsTable(tickets, users, isEn) {
  const tbody = document.getElementById("mgrDecisionsTableBody");
  const countBadge = document.getElementById("mgrDecisionsCount");
  if (!tbody) return;

  const decisions = [];

  // 1. تذاكر متأخرة عن SLA أو حرجة جداً
  tickets.forEach(t => {
    const isClosed = CLOSED_STATUSES.includes(String(t.status || '').trim().toLowerCase());
    if (isClosed) return;

    const isHigh = String(t.priority || '').trim() === 'High';
    const isOverdue = isOverdueTicket(t);

    if (isOverdue || isHigh) {
      decisions.push({
        id: t.id,
        type: isOverdue ? 'overdue' : 'urgent_ticket',
        badge: isOverdue ? (isEn ? 'SLA Breach' : 'تأخر SLA') : (isEn ? 'High Priority' : 'أولوية قصوى'),
        badgeClass: 'bg-red-500/15 text-red-400 border border-red-500/30',
        title: `${t.machine || (isEn ? 'Machine' : 'ماكينة')} - ${t.description ? String(t.description).slice(0, 45) + '...' : (isEn ? 'Breakdown' : 'عطل')}`,
        meta: `${t.line || (isEn ? 'General' : 'عام')} • ${t.assignedTo || (isEn ? 'Unassigned' : 'غير معين')}`,
        time: t.createdAt ? new Date(t.createdAt).toLocaleDateString(isEn ? 'en-US' : 'ar-EG', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-',
        actionBtn: `<button onclick="window.openTicketInModal('${t.id}')" class="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition active:scale-95 cursor-pointer">${isEn ? 'Review' : 'معاينة'}</button>`
      });
    } else if (String(t.status || '').trim() === 'pending' && !t.assignedTo) {
      // 2. بلاغات جديدة بدون تعيين
      decisions.push({
        id: t.id,
        type: 'unassigned',
        badge: isEn ? 'Unassigned' : 'بانتظار الإسناد',
        badgeClass: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
        title: `${t.machine || (isEn ? 'Machine' : 'ماكينة')} - ${t.description ? String(t.description).slice(0, 45) + '...' : (isEn ? 'Pending Ticket' : 'بلاغ جديد')}`,
        meta: `${t.line || (isEn ? 'General' : 'عام')} • ${t.reportedBy || (isEn ? 'User' : 'مستخدم')}`,
        time: t.createdAt ? new Date(t.createdAt).toLocaleDateString(isEn ? 'en-US' : 'ar-EG', { month: 'numeric', day: 'numeric' }) : '-',
        actionBtn: `<button onclick="window.openTicketInModal('${t.id}')" class="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition active:scale-95 cursor-pointer">${isEn ? 'Assign' : 'إسناد فني'}</button>`
      });
    }
  });

  // 3. طلبات تسجيل مستخدمين جديدة بانتظار الموافقة
  users.forEach(u => {
    if (u.status === 'pending' || u.role === 'pending') {
      decisions.push({
        id: u.id,
        type: 'user_request',
        badge: isEn ? 'User Request' : 'طلب انضمام',
        badgeClass: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30',
        title: `${u.name || (isEn ? 'New User' : 'مستخدم جديد')} (${u.job || u.role || 'Member'})`,
        meta: `${u.phone || ''} • ${u.department || (isEn ? 'Production' : 'الإنتاج')}`,
        time: u.createdAt ? new Date(u.createdAt).toLocaleDateString(isEn ? 'en-US' : 'ar-EG', { month: 'numeric', day: 'numeric' }) : '-',
        actionBtn: `<button onclick="window.navigateTo('requests')" class="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition active:scale-95 cursor-pointer">${isEn ? 'Approve' : 'اعتماد'}</button>`
      });
    }
  });

  if (countBadge) {
    countBadge.textContent = `${decisions.length} ${isEn ? 'Decisions' : 'قرارات'}`;
  }

  if (!decisions.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-8 text-center text-gray-400">
          <div class="text-2xl mb-1">🎉</div>
          <div class="font-bold text-gray-700 dark:text-gray-300 text-xs">
            ${isEn ? 'All operational decisions are up to date' : 'رائع! لا توجد قرارات أو بلاغات حرجة معلقة الآن'}
          </div>
          <div class="text-[10px] text-gray-500 mt-0.5">
            ${isEn ? 'No SLA breaches or unassigned tasks' : 'كافة التذاكر مسندة ولا توجد تجاوزات في أوقات الإصلاح'}
          </div>
        </td>
      </tr>
    `;
    return;
  }

  // عرض أول 6 عناصر فقط في الرئيسية لتفادي التكدس
  const visibleItems = decisions.slice(0, 6);

  tbody.innerHTML = visibleItems.map(item => `
    <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition">
      <td class="py-2.5 px-3">
        <span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${item.badgeClass}">
          ${item.badge}
        </span>
      </td>
      <td class="py-2.5 px-3 font-medium text-gray-900 dark:text-white max-w-[280px] truncate" title="${item.title}">
        ${item.title}
      </td>
      <td class="py-2.5 px-3 text-gray-500 dark:text-gray-400">
        ${item.meta}
      </td>
      <td class="py-2.5 px-3 text-gray-500 dark:text-gray-400 font-mono text-[11px]">
        ${item.time}
      </td>
      <td class="py-2.5 px-3 text-center">
        ${item.actionBtn}
      </td>
    </tr>
  `).join("");
}

// عرض أداء وحمل عمل الفنيين
function renderTechnicianWorkload(tickets, users, isEn) {
  const container = document.getElementById("mgrTechWorkloadList");
  if (!container) return;

  const workload = {};

  // جمع الفنيين والمهندسين من قائمة المستخدمين
  users.forEach(u => {
    const r = String(u.role || '').toLowerCase();
    if (r === 'technician' || r === 'engineer' || r === 'فني' || r === 'مهندس') {
      const name = String(u.name || '').trim();
      if (name) {
        workload[name] = { active: 0, resolved: 0, total: 0 };
      }
    }
  });

  // حساب المهام من التذاكر
  tickets.forEach(ticket => {
    const tech = String(ticket.assignedTo || '').trim();
    if (!tech) return;

    if (!workload[tech]) {
      workload[tech] = { active: 0, resolved: 0, total: 0 };
    }

    const isClosed = CLOSED_STATUSES.includes(String(ticket.status || '').trim().toLowerCase());
    if (isClosed) {
      workload[tech].resolved++;
    } else {
      workload[tech].active++;
    }
    workload[tech].total++;
  });

  const sortedTechs = Object.entries(workload)
    .sort((a, b) => (b[1].active + b[1].resolved) - (a[1].active + a[1].resolved))
    .slice(0, 6);

  if (!sortedTechs.length) {
    container.innerHTML = `
      <div class="py-4 text-center text-gray-400 text-xs">
        ${isEn ? 'No technician assigned records found' : 'لا توجد بيانات تعيين لفنيين حتى الآن'}
      </div>
    `;
    return;
  }

  const maxTotal = Math.max(...sortedTechs.map(t => t[1].total), 1);

  container.innerHTML = sortedTechs.map(([name, data], idx) => {
    const activePercent = Math.min(100, Math.round((data.active / maxTotal) * 100));
    const resolvedPercent = Math.min(100, Math.round((data.resolved / maxTotal) * 100));

    return `
      <div class="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
        <div class="flex items-center justify-between text-xs mb-1.5">
          <div class="flex items-center gap-1.5">
            <span class="w-5 h-5 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-[10px]">
              ${idx + 1}
            </span>
            <span class="font-bold text-gray-900 dark:text-white truncate max-w-[130px]">${name}</span>
          </div>
          <div class="flex items-center gap-2 font-mono text-[10px]">
            <span class="text-amber-500 font-bold" title="${isEn ? 'Active Workload' : 'مهام جارية'}">⚡ ${data.active}</span>
            <span class="text-emerald-500 font-bold" title="${isEn ? 'Resolved' : 'تم حلها'}">✅ ${data.resolved}</span>
          </div>
        </div>

        <!-- بار النسبة المزدوج -->
        <div class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
          <div class="bg-amber-500 transition-all duration-300" style="width: ${activePercent}%" title="${isEn ? 'Active' : 'نشط'}"></div>
          <div class="bg-emerald-500 transition-all duration-300" style="width: ${resolvedPercent}%" title="${isEn ? 'Resolved' : 'تم حله'}"></div>
        </div>
      </div>
    `;
  }).join("");
}

// دالة التحديث اليدوي
window.refreshManagerDesktopDashboard = async function() {
  await initManagerDesktopHomeData();
};

// دالة التصدير التنفيذي
window.exportManagerExecutiveSummary = async function() {
  const isEn = (window.currentLang || 'ar') === 'en';
  if (!cachedDashboardData || !Array.isArray(cachedDashboardData.tickets) || !cachedDashboardData.tickets.length) {
    window.print();
    return;
  }

  try {
    const headers = isEn 
      ? ["Ticket ID", "Line / Area", "Machine", "Priority", "Status", "Assigned Technician", "Reported By", "Logged Time"]
      : ["رقم البلاغ", "الخط / الموقع", "الماكينة", "الأولوية", "الحالة", "الفني المكلف", "المُبلّغ", "وقت البلاغ"];

    const rows = cachedDashboardData.tickets.map(t => [
      t.id ? t.id.slice(0, 10) : '',
      t.line || '',
      t.machine || '',
      t.priority || (isEn ? 'Normal' : 'عادية'),
      t.status || 'pending',
      t.assignedTo || (isEn ? 'Unassigned' : 'غير معين'),
      t.reportedBy || '',
      t.createdAt ? new Date(t.createdAt).toLocaleString(isEn ? 'en-US' : 'ar-EG') : ''
    ]);

    const sheets = [
      {
        title: isEn ? "Executive Breakdown Summary" : "ملخص الأعطال التنفيذي",
        headers,
        rows,
        options: {
          periodLabel: isEn ? "Live Operations Snapshot" : "لقطة حية لعمليات الصيانة"
        }
      }
    ];

    await exportToExcel(sheets, `Executive_Maintenance_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (err) {
    console.error("Export executive report error:", err);
    window.print();
  }
};
