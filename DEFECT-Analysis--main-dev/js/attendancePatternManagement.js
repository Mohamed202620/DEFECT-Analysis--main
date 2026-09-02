// ============================================================
// attendancePatternManagement.js
// شاشة إدارة Pattern الورديات (GREEN/BLUE/RED) + معاملات حساب
// الإضافي - صفحة "settings" (أدمن فقط، راجع pageRenderer.js)
// نفس أسلوب holidaysManagement.js بالظبط
// ============================================================

import { parsePatternFile } from "./services/excelPatternParser.js";
import {
  fetchAttendancePatternApi,
  saveAttendancePatternApi,
  invalidateAttendancePatternCache,
  fetchPayrollRulesApi,
  savePayrollRulesApi,
  invalidatePayrollRulesCache,
  DEFAULT_PAYROLL_RULES
} from "./services/attendanceSettingsApi.js";

let pendingParsedPattern = null; // نتيجة التحليل قبل التأكيد والحفظ الفعلي

/**
 * عرض حالة الـ Pattern الحالي المحفوظ (اسم الملف/تاريخ آخر تحديث/
 * عدد الأيام المقروءة لكل فريق)
 */
window.loadAttendancePatternStatus = async function () {
  const container = document.getElementById("patternStatusContainer");
  if (!container) return;

  container.innerHTML = `<div class="text-center text-gray-500 text-xs py-4">جاري تحميل حالة الـ Pattern...</div>`;

  const result = await fetchAttendancePatternApi({ forceRefresh: true });
  const data = result.data;

  const counts = {
    green: Object.keys(data.teams?.green || {}).length,
    blue: Object.keys(data.teams?.blue || {}).length,
    red: Object.keys(data.teams?.red || {}).length
  };
  const total = counts.green + counts.blue + counts.red;

  if (!total) {
    container.innerHTML = `
      <div class="text-center text-amber-400 text-xs py-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
        ⚠️ لا يوجد Pattern مرفوع حالياً - النظام بيستخدم حساب الدورة الافتراضي (6 عمل + 3 راحة) لحد ما يتم رفع ملف Excel.
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="bg-[#0F172A] border border-gray-800 rounded-xl p-3 space-y-1.5">
      <div class="text-xs text-gray-200 font-bold">📄 ${data.fileName || "ملف Pattern"}</div>
      <div class="text-[10px] text-gray-500">آخر تحديث: ${data.updatedAt ? new Date(data.updatedAt).toLocaleString("ar-EG") : "—"} ${data.updatedBy ? `بواسطة ${data.updatedBy}` : ""}</div>
      <div class="grid grid-cols-3 gap-2 pt-1.5 text-center">
        <div class="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-1.5"><div class="text-[9px] text-emerald-300">GREEN</div><div class="text-xs font-black text-emerald-300">${counts.green} يوم</div></div>
        <div class="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-1.5"><div class="text-[9px] text-cyan-300">BLUE</div><div class="text-xs font-black text-cyan-300">${counts.blue} يوم</div></div>
        <div class="bg-rose-500/10 border border-rose-500/20 rounded-lg p-1.5"><div class="text-[9px] text-rose-300">RED</div><div class="text-xs font-black text-rose-300">${counts.red} يوم</div></div>
      </div>
    </div>
  `;
};

/**
 * قراءة ملف Excel المُختار وعرض معاينة قبل التأكيد النهائي
 */
window.previewAttendancePatternFile = async function (inputEl) {
  const preview = document.getElementById("patternUploadPreview");
  const confirmBtn = document.getElementById("btnConfirmPatternUpload");
  const file = inputEl?.files?.[0];
  pendingParsedPattern = null;
  if (confirmBtn) confirmBtn.disabled = true;

  if (!file) {
    if (preview) preview.innerHTML = "";
    return;
  }

  if (preview) preview.innerHTML = `<div class="text-[11px] text-gray-400 py-2">جاري قراءة الملف...</div>`;

  try {
    const parsed = await parsePatternFile(file);
    pendingParsedPattern = { parsed, fileName: file.name };

    const counts = {
      green: Object.keys(parsed.teams.green).length,
      blue: Object.keys(parsed.teams.blue).length,
      red: Object.keys(parsed.teams.red).length
    };

    const warningsHtml = parsed.warnings.length
      ? `<div class="text-[10px] text-amber-400 mt-2">⚠️ ${parsed.warnings.length} تحذير أثناء القراءة (تم تجاهل الخلايا غير المفهومة)${parsed.warnings.length <= 5 ? ":<br>" + parsed.warnings.slice(0, 5).join("<br>") : ""}</div>`
      : "";

    if (preview) {
      preview.innerHTML = `
        <div class="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 mt-2">
          <div class="text-[11px] text-emerald-300 font-bold mb-1">✅ تم تحليل الملف بنجاح - راجع الأرقام ثم اضغط "تأكيد الحفظ"</div>
          <div class="text-[10px] text-gray-300">تم العثور على ${parsed.datesCount} خانة تاريخ إجمالاً.</div>
          <div class="grid grid-cols-3 gap-2 mt-2 text-center">
            <div class="bg-slate-900/60 rounded-lg p-1.5"><div class="text-[9px] text-gray-400">GREEN</div><div class="text-xs font-black text-emerald-300">${counts.green}</div></div>
            <div class="bg-slate-900/60 rounded-lg p-1.5"><div class="text-[9px] text-gray-400">BLUE</div><div class="text-xs font-black text-cyan-300">${counts.blue}</div></div>
            <div class="bg-slate-900/60 rounded-lg p-1.5"><div class="text-[9px] text-gray-400">RED</div><div class="text-xs font-black text-rose-300">${counts.red}</div></div>
          </div>
          ${warningsHtml}
        </div>
      `;
    }
    if (confirmBtn) confirmBtn.disabled = false;
  } catch (err) {
    console.error("[PatternUpload] parse error:", err);
    if (preview) {
      preview.innerHTML = `<div class="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 mt-2 text-[11px] text-rose-300">❌ ${err.message}</div>`;
    }
  }
};

/**
 * تأكيد الحفظ النهائي بعد المعاينة - بيستبدل أي Pattern سابق بالكامل
 */
window.confirmAttendancePatternUpload = async function () {
  if (!pendingParsedPattern) {
    alert("⚠️ يرجى اختيار ملف Excel وانتظار المعاينة أولاً.");
    return;
  }

  if (!confirm("هل تريد استبدال الـ Pattern الحالي بالكامل بهذا الملف؟ سيؤثر هذا على حساب ورديات كل المستخدمين فوراً.")) return;

  const result = await saveAttendancePatternApi(pendingParsedPattern.parsed.teams, pendingParsedPattern.fileName);

  if (result.status !== "success") {
    alert("❌ " + (result.message || "فشل حفظ الـ Pattern."));
    return;
  }

  invalidateAttendancePatternCache();
  pendingParsedPattern = null;

  const fileInput = document.getElementById("patternFileInput");
  if (fileInput) fileInput.value = "";
  const preview = document.getElementById("patternUploadPreview");
  if (preview) preview.innerHTML = "";
  const confirmBtn = document.getElementById("btnConfirmPatternUpload");
  if (confirmBtn) confirmBtn.disabled = true;

  alert("✅ تم حفظ الـ Pattern بنجاح.");
  window.loadAttendancePatternStatus();
  if (window.refreshAttendanceCard) window.refreshAttendanceCard();
};

// ============================================================
// إعدادات معاملات حساب الإضافي (Normal OT / OFF / Holiday /
// الساعات المستهدفة / خصم ساعات الإجازة الرسمية)
// ============================================================

window.loadPayrollRulesForm = async function () {
  const result = await fetchPayrollRulesApi({ forceRefresh: true });
  const rules = result.data;

  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  setVal("ruleMonthlyTargetHours", rules.monthlyTargetHours);
  setVal("ruleHolidayHoursDeduction", rules.holidayHoursDeduction);
  setVal("ruleNormalOtMultiplier", rules.normalOvertimeMultiplier);
  setVal("ruleOffWorkMultiplier", rules.offWorkMultiplier);
  setVal("ruleHolidayWorkMultiplier", rules.holidayWorkMultiplier);
};

window.savePayrollRulesForm = async function () {
  const getVal = id => Number(document.getElementById(id)?.value);

  const rules = {
    monthlyTargetHours: getVal("ruleMonthlyTargetHours") || DEFAULT_PAYROLL_RULES.monthlyTargetHours,
    holidayHoursDeduction: getVal("ruleHolidayHoursDeduction") || DEFAULT_PAYROLL_RULES.holidayHoursDeduction,
    normalOvertimeMultiplier: getVal("ruleNormalOtMultiplier") || DEFAULT_PAYROLL_RULES.normalOvertimeMultiplier,
    offWorkMultiplier: getVal("ruleOffWorkMultiplier") || DEFAULT_PAYROLL_RULES.offWorkMultiplier,
    holidayWorkMultiplier: getVal("ruleHolidayWorkMultiplier") || DEFAULT_PAYROLL_RULES.holidayWorkMultiplier
  };

  const result = await savePayrollRulesApi(rules);
  if (result.status !== "success") {
    alert("❌ " + (result.message || "فشل حفظ إعدادات الإضافي."));
    return;
  }
  invalidatePayrollRulesCache();
  alert("✅ تم حفظ إعدادات الإضافي بنجاح.");
  if (window.refreshAttendanceCard) window.refreshAttendanceCard();
};
