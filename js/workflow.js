import { fetchTicketsApi, fetchTicketCountsApi } from './services/api.js';
// إصلاح M1: جلب الدور والمستخدم الحالي عشان نمرّرهم لـ fetchTicketsApi
// في loadDashboardStats() بدل ما تجيب كل التذاكر دايماً بدون فلترة
import { getCurrentRole } from './permissions.js';
// إضافة: نفس دوال الحساب المستخدمة في صفحة الإحصائيات (statistics.js)
// اتعملها export من هناك بدون تغيير منطقها، عشان نعرض نفس الأرقام
// (MTTR / أكثر ماكينة / أفضل فني) في كارتات الرئيسية الجديدة من
// غير ما نكرر الكود ومن غير أي استعلام إضافي على قاعدة البيانات
import { computeMTTR, computeTopMachines, computeTechnicianPerformance } from './statistics.js';
// إضافة: مفاتيح الترجمة عشان الرسم البياني في الرئيسية (أيام
// الأسبوع + أسماء الأعمدة) ماتفضلش ثابتة بالعربي لما اللغة تتغيّر -
// نفس translations المستخدمة في كل الملفات التانية، بدون تكرار
import { translations } from './config.js';
// إصلاح (تنظيف/Refactor): isClosedStatus بقت مستوردة من ملف ثوابت
// مشترك (ticketStatusConstants.js) بدل تعريفها محلياً هنا مكررة مع
// نفس التعريف في statistics.js بالظبط
import { isClosedStatus, isOverdueTicket, parseTicketDate } from './ticketStatusConstants.js';
// مكوّن اختيار المرفقات المتعددة الموحّد (اختيار أكثر من صورة دفعة
// واحدة + إضافة صور لاحقًا بدون فقدان القديمة + حذف مستقل لكل صورة) -
// مُستخدم هنا لفورم "تسجيل عطل" (راجع initIssueAttachments تحت)
import { initAttachmentPicker, getAttachmentFiles, resetAttachmentFiles, compressImage } from './components/attachmentPicker.js';
export { compressImage };

// ==========================================
// منطق معالجة وحفظ بلاغات الأعطال (Issue Logic)
// ==========================================
// ملاحظة (تنظيف/Refactor): تمت إزالة نظام "دفعات العيوب" القديم
// (defectImages / resetDefectForm / compressImage / handleDefectFile /
// saveDefectData) من هنا - كان يعتمد على عناصر DOM (defectName,
// imgPreview0-2, imgCounter, submitBtn, lineSelect, stageSelect,
// defectLocation, defectDesc) غير موجودة في أي View حالي بالمشروع.
// النظام الحالي الفعلي لتسجيل الأعطال هو "issue" (راجع IssueView.js
// و window.confirmIssue تحت) وهو المُستخدم من MaintenanceView.js.

// تفعيل مكوّن اختيار الصور المتعددة (اختيار أكثر من صورة دفعة واحدة
// + إضافة صور لاحقًا + حذف مستقل لكل صورة) لفورم تسجيل عطل - يُستدعى
// من renderCore.js AUTO LOAD بعد إدراج HTML الفورم فعلياً في الصفحة
export function initIssueAttachments() {
  initAttachmentPicker("issueImages", {
    maxFileSizeMB: 10,
    emptyText: "لا توجد صور مرفقة"
  });
}
window.initIssueAttachments = initIssueAttachments;

// دالة حفظ وإرسال البلاغ المربوطة بزر الحفظ
window.confirmIssue = async function() {
  const line = document.getElementById('issueLine')?.value;
  const machine = document.getElementById('issueMachine')?.value;
  const priority = document.getElementById('issuePriority')?.value;
  const type = document.querySelector('input[name="issueType"]:checked')?.value || "Breakdown";
  const category = document.getElementById('issueCategory')?.value;
  const description = document.getElementById('issueDescription')?.value?.trim();
  const location = document.getElementById('issueLocation')?.value?.trim();
  const suggestion = document.getElementById('issueSuggestion')?.value?.trim();
  // ✅ توليد معرف فريد للبلاغ بنفس أسلوب defectId
  // (العنصر generatedIssueId# غير موجود فعلياً في IssueView، لذا كان
  // issueId يصل دائماً كـ undefined قبل هذا التعديل)
  const issueId = "IS-" + Date.now();

  if (!line || !machine || !category || !description) {
    alert("⚠️ يرجى استكمال البيانات الأساسية: (الخط، الماكينة، نوع العطل، والوصف)");
    return;
  }

  const btn = document.querySelector('button[onclick="window.confirmIssue()"]');
  const originalText = btn ? btn.innerHTML : "💾 حفظ وإرسال البلاغ";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = "⏳ جاري الإرسال...";
  }

  const payload = {
    // ✅ 4. تم إزالة action: "saveIssue"
    issueId,
    line,
    machine,
    priority,
    type,
    category,
    description,
    location,
    suggestion,
    // الصور المرفقة (صفر أو أكثر) - مُجمَّعة من مكوّن الاختيار
    // المتعدد (attachmentPicker.js)، بدل صورة واحدة فقط كالسابق
    images: getAttachmentFiles("issueImages"),

    // اسم/معرّف المُبلّغ بشكل مسطّح (يُستخدم في دورة حياة التذكرة:
    // قواعد الأمان وواجهة "Review & Closure" - راجع ticketsBoard.js)
    reportedBy: localStorage.getItem("name") || "",
    reportedByUid: localStorage.getItem("userId") || "",

    reporter: {
      name: localStorage.getItem("name") || "",
      job: localStorage.getItem("job") || "",
      department: localStorage.getItem("department") || "",
      shift: localStorage.getItem("shift") || ""
    },

    // دورة حياة التذكرة تبدأ دائماً بـ pending (كانت "open" سابقاً -
    // تم تصحيحها لتطابق حالات: pending -> assigned -> resolved ->
    // closed | reopened)
    status: "pending",
    createdAt: new Date().toISOString()
  };

  try {
    const { saveIssueApi } = await import('./services/api.js');
    const res = await saveIssueApi(payload);
    if (res && (res.status === 'success' || res.status === 'queued')) {
      alert(
        res.status === 'queued'
          ? "📴 لا يوجد اتصال حالياً - تم حفظ البلاغ محلياً وسيتم إرساله تلقائياً عند عودة الإنترنت"
          : "✅ تم حفظ وإرسال البلاغ بنجاح"
      );
      
      // ✅ 3. إعادة ضبط حقول البلاغ بعد الحفظ قبل العودة للرئيسية
      resetAttachmentFiles("issueImages");
      if (document.getElementById("issueDescription")) document.getElementById("issueDescription").value = "";
      if (document.getElementById("issueSuggestion")) document.getElementById("issueSuggestion").value = "";
      if (document.getElementById("issueLocation")) document.getElementById("issueLocation").value = "";

      if (typeof window.navigateTo === 'function') {
        window.navigateTo('home');
      }
    } else {
      alert("❌ حدث خطأ أثناء الإرسال: " + (res?.message || "خطأ غير معروف"));
    }
  } catch (err) {
    alert("❌ خطأ بالاتصال: " + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
};

// ==========================================
// بيانات لوحة المتابعة الحقيقية (Dashboard Stats)
// كانت أرقام لوحة المتابعة (open/closed/today/total) ثابتة
// دائماً على صفر لأن window.dashboardData لم يكن يُملأ من أي
// مكان رغم وجود fetchTicketsApi جاهزة. تم ربطها الآن دون أي
// تغيير في بنية قاعدة البيانات - فقط قراءة من "tickets" الحالية
// ==========================================

export async function loadDashboardStats() {

  // إصلاح M1: جلب دور المستخدم وبياناته الحالية، وتمريرها لـ
  // fetchTicketsApi عشان كارتات لوحة المتابعة في الرئيسية تتفلتر
  // حسب الصلاحيات (Admin/Manager = الكل، وباقي الأدوار = بلاغاتي +
  // المُسندة إليّ فقط) بدل ما تجيب كل التذاكر لأي مستخدم
  const role = getCurrentRole();
  const myUid = localStorage.getItem("userId") || "";
  const myName = localStorage.getItem("name") || "";

  const sampleResult = await fetchTicketsApi({ role, myUid, myName, maxCount: 500 });

  if (!sampleResult || sampleResult.status !== 'success') {
    console.warn("[loadDashboardStats] Failed to fetch tickets:", sampleResult?.message || "Unknown error");
    return;
  }

  const tickets = Array.isArray(sampleResult.data) ? sampleResult.data : [];

  const todayStr = new Date().toDateString();

  let open = 0;
  let closed = 0;
  let today = 0;
  let overdue = 0;

  tickets.forEach(ticket => {
    if (isClosedStatus(ticket.status)) {
      closed++;
    } else {
      open++;
    }

    const created = parseTicketDate(ticket);
    if (created && created.toDateString() === todayStr) {
      today++;
    }

    if (isOverdueTicket(ticket)) {
      overdue++;
    }
  });

  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);

  const thisMonthTickets = tickets.filter(t => {
    const d = parseTicketDate(t);
    return d && d >= thirtyDaysAgo;
  });

  const mttrData = computeMTTR(thisMonthTickets);
  const topMachines = computeTopMachines(thisMonthTickets, 1);
  const topTechs = computeTechnicianPerformance(thisMonthTickets, 1);

  const mttrValue = mttrData.avgHours !== null ? `${mttrData.avgHours.toFixed(1)} h` : '-';
  const topMachineValue = topMachines.length > 0 ? topMachines[0][0] : '-';
  const topTechValue = topTechs.length > 0 ? topTechs[0][0] : '-';

  const stats = {
    open,
    closed,
    today,
    overdue,
    total: tickets.length
  };

  window.dashboardData = stats;

  const setText = (id, value) => {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  };

  setText('statOpenCount', stats.open);
  setText('statClosedCount', stats.closed);
  setText('statTodayCount', stats.today);
  setText('statTotalCount', stats.total);
  setText('statOverdueCount', stats.overdue);

  setText('statMttrValue', mttrValue);
  setText('statTopMachineName', topMachineValue);
  setText('statTopTechName', topTechValue);

  // ============================================================
  // إضافة: تنبيه "بلاغ حرج"
  // ============================================================

  // تنبيه حي: فيه بلاغ مفتوح بأولوية "High"؟ (نستخدم tickets المفلترة هنا لأنها تخص المستخدم)
  const hasCritical = tickets.some(t => {
    const isOpen = !isClosedStatus(t.status);
    return isOpen && String(t.priority || '').trim() === 'High';
  });

  const criticalBadge = document.getElementById('criticalBadge');
  if (criticalBadge) {
    criticalBadge.classList.toggle('hidden', !hasCritical);
    criticalBadge.classList.toggle('flex', hasCritical);
  }
}

window.loadDashboardStats = loadDashboardStats;
