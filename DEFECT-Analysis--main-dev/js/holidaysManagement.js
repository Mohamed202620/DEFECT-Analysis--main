// ============================================================
// holidaysManagement.js
// شاشة إدارة الإجازات الرسمية (صفحة "settings" - إعدادات النظام)
// - عرض/إضافة/حذف تواريخ الإجازات الرسمية المستخدمة في كارت
//   حضور الوردية (attendanceCard.js) لاحتساب أيام العمل المصادفة
//   لإجازة رسمية كإضافي بالكامل
// نفس أسلوب authHandlers.js: loadUsers()
// ============================================================

import {
  fetchOfficialHolidaysApi,
  addOfficialHolidayApi,
  deleteOfficialHolidayApi
} from "./services/api.js";

// ============================================================
// قائمة افتراضية للإجازات الرسمية في مصر لعام 2026 (مصدر: تجميع
// من جهات رسمية/تقويمية معروفة وقت كتابة هذا الكود). الإجازات
// المرتبطة بالتقويم الهجري (رمضان/الأضحى/المولد/رأس السنة الهجرية)
// تقريبية وتخضع لرؤية الهلال، فيُنصح بمراجعتها وتعديلها من هذه
// الشاشة نفسها عند الاقتراب من موعدها الفعلي.
// ============================================================

const DEFAULT_HOLIDAYS_2026 = [
  { date: "2026-01-07", label: "عيد الميلاد المجيد (القبطي)" },
  { date: "2026-01-25", label: "عيد الثورة (25 يناير)" },
  { date: "2026-03-19", label: "إجازة إضافية - نهاية رمضان" },
  { date: "2026-03-20", label: "عيد الفطر المبارك" },
  { date: "2026-03-21", label: "عيد الفطر المبارك (يوم 2)" },
  { date: "2026-03-22", label: "عيد الفطر المبارك (يوم 3)" },
  { date: "2026-03-23", label: "عيد الفطر المبارك (يوم 4)" },
  { date: "2026-04-12", label: "عيد القيامة المجيد (القبطي)" },
  { date: "2026-04-13", label: "شم النسيم" },
  { date: "2026-04-25", label: "عيد تحرير سيناء" },
  { date: "2026-05-07", label: "عيد العمال (إجازة رسمية)" },
  { date: "2026-05-26", label: "يوم عرفة" },
  { date: "2026-05-27", label: "عيد الأضحى المبارك" },
  { date: "2026-05-28", label: "عيد الأضحى المبارك (يوم 2)" },
  { date: "2026-05-29", label: "عيد الأضحى المبارك (يوم 3)" },
  { date: "2026-05-30", label: "عيد الأضحى المبارك (يوم 4)" },
  { date: "2026-05-31", label: "عيد الأضحى المبارك (يوم 5)" },
  { date: "2026-06-18", label: "رأس السنة الهجرية" },
  { date: "2026-07-02", label: "عيد ثورة 30 يونيو (إجازة رسمية)" },
  { date: "2026-07-23", label: "عيد ثورة 23 يوليو" },
  { date: "2026-08-27", label: "المولد النبوي الشريف" },
  { date: "2026-10-09", label: "عيد القوات المسلحة" }
];

import { invalidateHolidaysCache } from "./attendanceCard.js";

/**
 * تنسيق تاريخ ISO (YYYY-MM-DD) لعرضه بشكل مقروء بالعربي
 */
function formatHolidayDate(dateStr) {
  try {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString("ar-EG", {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    });
  } catch (e) {
    return dateStr;
  }
}

/**
 * تحميل وعرض قائمة الإجازات الرسمية
 */
window.loadHolidays = async function () {

  const container = document.getElementById("holidaysContainer");
  if (!container) return;

  container.innerHTML = `
    <div class="text-center text-gray-500 text-xs py-6">جاري تحميل الإجازات الرسمية...</div>
  `;

  const result = await fetchOfficialHolidaysApi();

  if (result.status !== "success") {
    container.innerHTML = `
      <div class="text-center text-red-400 text-xs py-6">
        تعذر تحميل الإجازات الرسمية: ${result.message || ""}
      </div>
    `;
    return;
  }

  if (!result.data.length) {
    container.innerHTML = `
      <div class="text-center text-gray-500 text-xs py-6">
        لا توجد إجازات رسمية مضافة بعد.
      </div>
    `;
    return;
  }

  container.innerHTML = result.data.map(h => `
    <div class="flex items-center justify-between bg-[#1E293B] border border-gray-800 rounded-xl p-3">
      <div>
        <div class="text-xs font-bold text-gray-100">${h.label || "إجازة رسمية"}</div>
        <div class="text-[10px] text-gray-500 mt-0.5">${formatHolidayDate(h.date)}</div>
      </div>
      <button
        onclick="window.deleteHoliday('${h.id}', '${(h.label || "").replace(/'/g, "\\'")}')"
        class="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 active:scale-95 transition-all">
        🗑️ حذف
      </button>
    </div>
  `).join("");

};

/**
 * إضافة إجازة رسمية جديدة من نموذج الإدخال
 */
window.addHoliday = async function () {

  const dateInput = document.getElementById("newHolidayDate");
  const labelInput = document.getElementById("newHolidayLabel");

  const dateStr = dateInput?.value || "";
  const label = labelInput?.value || "";

  if (!dateStr) {
    alert("⚠️ يرجى اختيار تاريخ الإجازة الرسمية أولاً.");
    return;
  }

  const result = await addOfficialHolidayApi(dateStr, label);

  if (result.status !== "success") {
    alert("❌ " + (result.message || "حدث خطأ أثناء إضافة الإجازة."));
    return;
  }

  if (dateInput) dateInput.value = "";
  if (labelInput) labelInput.value = "";

  // إبطال الكاش المحلي لقائمة الإجازات المستخدمة في كارت الحضور،
  // عشان أي تعديل هنا ينعكس فوراً في حساب الشهر الحالي
  invalidateHolidaysCache();

  window.loadHolidays();

};

/**
 * حذف إجازة رسمية
 */
window.deleteHoliday = async function (holidayId, label) {

  const confirmed = confirm(`⚠️ هل أنت متأكد من حذف الإجازة الرسمية:\n\n${label}`);
  if (!confirmed) return;

  const result = await deleteOfficialHolidayApi(holidayId);

  if (result.status !== "success") {
    alert("❌ " + (result.message || "فشل حذف الإجازة."));
    return;
  }

  invalidateHolidaysCache();

  window.loadHolidays();

};

/**
 * زرع القائمة الافتراضية لإجازات مصر الرسمية 2026 دفعة واحدة -
 * بيتخطى أي تاريخ موجود بالفعل في القائمة عشان يمنع التكرار لو
 * اتضغط الزرار أكتر من مرة
 */
window.seedDefaultHolidays2026 = async function () {

  const confirmed = confirm(
    "هل تريد إضافة القائمة الافتراضية لإجازات مصر الرسمية 2026؟\n\n" +
    "ملحوظة: التواريخ المرتبطة بالتقويم الهجري (رمضان/الأضحى/المولد/رأس السنة الهجرية) تقريبية وتحتاج مراجعة لاحقاً حسب رؤية الهلال الفعلية."
  );
  if (!confirmed) return;

  const existingResult = await fetchOfficialHolidaysApi();
  const existingDates = existingResult.status === "success"
    ? new Set(existingResult.data.map(h => h.date))
    : new Set();

  const toAdd = DEFAULT_HOLIDAYS_2026.filter(h => !existingDates.has(h.date));

  if (!toAdd.length) {
    alert("كل إجازات القائمة الافتراضية مضافة بالفعل.");
    return;
  }

  for (const holiday of toAdd) {
    await addOfficialHolidayApi(holiday.date, holiday.label);
  }

  invalidateHolidaysCache();

  alert(`✅ تم إضافة ${toAdd.length} إجازة رسمية.`);

  window.loadHolidays();

};
