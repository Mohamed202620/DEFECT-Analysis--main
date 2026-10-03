import { fetchTicketsApi, fetchTicketCountsApi, fetchDashboardSnapshotApi } from './services/api.js';
import { escalateOverdueTicketsApi } from './services/ticketsApi.js';
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

// ==========================================
// هوية البلاغ الثابتة (بند H7 - منع التكرار)
// issueId بيتولّد مرة واحدة لكل "نموذج بلاغ" ويتخزّن في sessionStorage
// (بيصمد قدام Refresh/Reload أثناء العملية)، ومابيتغيّرش مع الضغط المتكرر
// على "حفظ" أو إعادة المحاولة بعد انقطاع - فنفس البلاغ دايماً بنفس
// الهوية (ومعرّف مستند التذكرة بيتحسب منها - راجع saveIssueApi). بيتمسح
// فقط بعد نجاح/ترحيل البلاغ فعلاً.
// ==========================================
const ISSUE_DRAFT_ID_KEY = "issueDraftId";

function getIssueDraftId() {
  try {
    let id = sessionStorage.getItem(ISSUE_DRAFT_ID_KEY);
    if (!id) {
      id = "IS-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
      sessionStorage.setItem(ISSUE_DRAFT_ID_KEY, id);
    }
    return id;
  } catch (_) {
    return "IS-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
  }
}

function clearIssueDraftId() {
  try { sessionStorage.removeItem(ISSUE_DRAFT_ID_KEY); } catch (_) { /* لا شيء */ }
}

// مهلة الإرسال: navigator.onLine بيفضل true مع Wi-Fi بلا إنترنت فعلي فكانت
// وعود Firestore تفضل معلّقة والزر عالق على "جاري الإرسال" (بند H7)
const ISSUE_SAVE_TIMEOUT_MS = 25000;

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ status: "timeout" }), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

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
  const issueId = getIssueDraftId();

  if (!line || !machine || !category || !description) {
    alert("⚠️ يرجى استكمال البيانات الأساسية: (الخط، الماكينة، نوع العطل، والوصف)");
    return;
  }

  // إصلاح (Workflow - منع التكرار): التحذير في شاشة البلاغ (checkActiveTicketForMachine)
  // استشاري فقط، ومفيش أي فحص وقت الحفظ - فأي مستخدم/شيفت يقدر يسجّل نفس العطل
  // مرة ثانية (والطابور الأوفلاين بيتخطى الفحص أصلاً). دلوقتي بنعيد الفحص قبل
  // الإرسال ونطلب تأكيداً صريحاً لو فيه بلاغ مفتوح لنفس الخط والماكينة. لو الفحص
  // فشل (مثلاً أوفلاين) بنكمل عادي عشان ما نعطّلش تسجيل العطل.
  try {
    if (typeof navigator === "undefined" || navigator.onLine) {
      const { fetchActiveTicketForMachineApi } = await import('./services/api.js');
      const dup = await fetchActiveTicketForMachineApi(machine, line);
      if (dup?.status === 'success' && dup.ticket) {
        const dt = dup.ticket;
        const proceed = confirm(
          "⚠️ يوجد بلاغ مفتوح بالفعل لهذه الماكينة" +
          (dt.issueId ? ` (${dt.issueId})` : "") +
          (dt.status ? ` - الحالة: ${dt.status}` : "") +
          "\n\nالأفضل إضافة تحديث الوردية على البلاغ الحالي بدل فتح بلاغ جديد." +
          "\nهل تريد تسجيل بلاغ جديد رغم ذلك؟"
        );
        if (!proceed) return;
      }
    }
  } catch (_) { /* فحص التكرار مساعد فقط - مايمنعش الحفظ */ }

  const btn = document.querySelector('button[onclick="window.confirmIssue()"]');
  const originalText = btn ? btn.innerHTML : "💾 حفظ وإرسال البلاغ";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = "⏳ جاري الإرسال...";
  }

  const isSelfResolved = document.getElementById('isSelfResolved')?.checked || false;
  const selfResolvedNotes = document.getElementById('selfResolvedNotes')?.value?.trim() || "";

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

    status: isSelfResolved ? "resolved" : "pending",
    ...(isSelfResolved && {
      isSelfResolved: true,
      mechanicNotes: "تم الإصلاح فورياً بواسطة المُبلغ (صيانة ذاتية): " + (selfResolvedNotes || "تم الفحص والتصليح الميداني مباشرة"),
      resolvedAt: new Date().toISOString(),
      resolvedBy: localStorage.getItem("name") || "المُبلغ",
      resolvedByUid: localStorage.getItem("userId") || ""
    }),
    createdAt: new Date().toISOString()
  };

  try {
    const { saveIssueApi } = await import('./services/api.js');
    let res = await withTimeout(saveIssueApi(payload), ISSUE_SAVE_TIMEOUT_MS);

    if (res && res.status === 'timeout') {
      // الشبكة معلّقة (Wi-Fi بلا إنترنت فعلي): نحفظ البلاغ في الطابور
      // المحلي بنفس issueId - لو الإرسال المعلّق نجح لاحقاً فالمزامنة
      // هتلاقي نفس المستند (معرّف حتمي) ومش هتكرر البلاغ
      try {
        const { queueOfflineTicket } = await import('./services/offlineQueue.js');
        const localId = await queueOfflineTicket(payload);
        res = { status: 'queued', localId };
      } catch (queueError) {
        res = { status: 'error', message: "انتهت مهلة الإرسال وتعذّر الحفظ المحلي، حاول مرة أخرى (لن يتكرر البلاغ)." };
      }
    }

    if (res && (res.status === 'success' || res.status === 'queued')) {
      clearIssueDraftId();
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
        window.goBack('home');
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

// Test 17: عند فتح الرئيسية بيتنادى loadDashboardStats مرتين تقريباً في
// نفس اللحظة (من onAuthStateChanged في renderCore + من render() بعد
// 100ms) = 500 تذكرة + 3 عدّادات تتحمّل مرتين. الاستدعاء اللي بيجي
// أثناء تحميل شغّال بيستنى نفس النتيجة بدل ما يبدأ تحميل تاني
let _dashboardStatsInFlight = null;

export function loadDashboardStats() {
  if (!_dashboardStatsInFlight) {
    _dashboardStatsInFlight = _loadDashboardStatsImpl().finally(() => {
      _dashboardStatsInFlight = null;
    });
  }
  return _dashboardStatsInFlight;
}

async function _loadDashboardStatsImpl() {

  // إصلاح M1: جلب دور المستخدم وبياناته الحالية، وتمريرها لـ
  // fetchTicketsApi عشان كارتات لوحة المتابعة في الرئيسية تتفلتر
  // حسب الصلاحيات (Admin/Manager = الكل، وباقي الأدوار = بلاغاتي +
  // المُسندة إليّ فقط) بدل ما تجيب كل التذاكر لأي مستخدم
  const role = getCurrentRole();
  const myUid = localStorage.getItem("userId") || "";
  const myName = localStorage.getItem("name") || "";

  // أرقام دقيقة (بند H4): عدّادات من السيرفر + مجموعة البلاغات غير المغلقة
  // الكاملة، بدل عينة أحدث 500 بلاغ اللي كانت بتخفي أقدم المتأخرات
  const snapRes = await fetchDashboardSnapshotApi({ role, myUid, myName });

  if (!snapRes || snapRes.status !== 'success') {
    console.warn("[loadDashboardStats] Failed to fetch tickets:", snapRes?.message || "Unknown error");
    return;
  }

  const tickets = Array.isArray(snapRes.data.tickets) ? snapRes.data.tickets : [];
  const trueTotal = snapRes.data.total;
  const open = snapRes.data.open;
  const closed = snapRes.data.closed;
  const today = snapRes.data.today;
  const overdue = snapRes.data.overdue;

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
    total: trueTotal
  };

  window.dashboardData = stats;

  // تصعيد البلاغات المتأخرة للمديرين (H6) - مرة واحدة لكل بلاغ/مدير
  if (overdue > 0 && (role === 'admin' || role === 'manager' || role === 'supervisor')) {
    const overdueList = tickets.filter(t => isOverdueTicket(t));
    escalateOverdueTicketsApi(overdueList).catch(() => {});
  }

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
