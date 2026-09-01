// ============================================================
// machines.js
// القائمة الموحّدة للماكينات المستخدمة في كل شاشات التطبيق (تسجيل
// بلاغ عطل / البحث والفلترة المتقدمة / مقترح كايزن / Machine Error
// Scanner) - مصدر واحد بدل تكرار القائمة يدوياً في كل ملف على حدة.
//
// إصلاح/تطوير (بند 1 - توحيد شامل): كانت القائمة ثابتة (Hardcoded)
// بالكامل، بدون أي شاشة إدارية للتعديل عليها. دلوقتي بقت مخزّنة في
// Firestore (مجموعة "machineTypes" - راجع services/machinesApi.js)
// وقابلة للتعديل بالكامل من صفحة "إدارة الماكينات" (views/MachinesView.js).
//
// عشان باقي شاشات التطبيق (issueView.js / suggestionView.js) تفضل
// شغالة بدون أي تعديل مطلوب فيها (هي أصلاً مبنية على استدعاء الدوال
// المُصدَّرة من هنا فقط، مش على قراءة القائمة مباشرة - ده بالظبط
// الهدف من "مصدر واحد" اللي مكتوب في التعليق الأصلي فوق)، تم الإبقاء
// على نفس توقيعات الدوال المُصدَّرة بالظبط (MACHINE_OPTIONS،
// getMachineUnits، parseMachineValue، buildMachineDropdownHtml)، لكن
// بياناتها بقت متحمّلة (Hydrated) من Firestore بدل قائمة ثابتة -
// فبمجرد ما loadMachineTypesFromFirestore() تتنفّذ عند إقلاع التطبيق
// (راجع renderCore.js)، كل الشاشات دي بتقرأ تلقائياً من قاعدة
// البيانات دون أي تغيير إضافي مطلوب فيها (ES Modules بتستخدم
// Live Bindings، فإعادة تعيين القيمة هنا بتنعكس فوراً في أي ملف
// عامل import لها).
//
// أي شاشة اتصالها بالقائمة كان مباشر ومكرر يدوياً بدل استخدام هذا
// الملف (errorScanner.js وMaintenanceSearchView.js) تم تعديلها كمان
// لتقرأ من نفس المصدر - راجع getMachineTypeEntries() تحت.
// ============================================================

import {
  fetchMachineTypesApi,
  seedDefaultMachineTypesApi
} from "./services/machinesApi.js";

// توليد "01".."NN" (ترقيم بخانتين دايماً)
function padNumbers(count) {
  const list = [];
  for (let i = 1; i <= count; i++) list.push(String(i).padStart(2, "0"));
  return list;
}

// القائمة الافتراضية الأصلية - بتُستخدم في حالتين بس:
//   1) زرع أولي لمجموعة "machineTypes" في Firestore أول مرة (لو
//      لسه فاضية) عشان كل البلاغات القديمة تفضل متوافقة بنفس
//      الأسماء بالظبط
//   2) شبكة أمان محلية (Fallback) لو تعذّر الاتصال بـ Firestore
//      تماماً (مفيش إنترنت مثلاً) عشان الفورمات تفضل شغالة بدل ما
//      تبقى فاضية بالكامل
export const DEFAULT_MACHINE_TYPES = [
  { key: "Coil Handling", units: [] },
  { key: "Baler", units: [] },
  { key: "Cupper", units: [] },
  { key: "Bodymaker", units: padNumbers(11) },
  { key: "Trimmer", units: [] },
  { key: "Washer", units: [] },
  { key: "Decorator", units: padNumbers(2) },
  { key: "Spray", units: padNumbers(11) },
  { key: "IBO", units: [] },
  { key: "Necker", units: [] },
  { key: "Palletizer", units: [] },
  { key: "Depalletizer", units: [] },
  { key: "Front End Line Control", units: [] },
  { key: "Mid Line Control", units: [] },
  { key: "Back End Line Control", units: [] },
  { key: "STRAP", units: ["A1", "A2", "B1", "B2"] }
];

// الكاش المحلي (Live) - بيبدأ بالقائمة الافتراضية عشان أي Dropdown
// بيترسم قبل ما Firestore يرد (خلال أول ثوانٍ من فتح التطبيق) يفضل
// شغال بشكل طبيعي بدل ما يبقى فاضي، وبعد اكتمال loadMachineTypesFromFirestore()
// بيتحدّث بالبيانات الحقيقية من قاعدة البيانات
let machineTypesCache = DEFAULT_MACHINE_TYPES.map(m => ({ ...m, active: true }));
let machineTypesLoaded = false;

/**
 * تحميل قائمة أنواع الماكينات من Firestore وتحديث الكاش المحلي -
 * بتتنادى مرة واحدة عند إقلاع التطبيق (راجع renderCore.js). لو
 * المجموعة فاضية (أول تشغيل للتطبيق) بتزرع القائمة الافتراضية
 * تلقائياً أولاً.
 */
export async function loadMachineTypesFromFirestore() {

  try {

    let result = await fetchMachineTypesApi();

    if (result.status === "success" && result.data.length === 0) {
      // أول تشغيل: زرع القائمة الافتراضية تلقائياً
      await seedDefaultMachineTypesApi(DEFAULT_MACHINE_TYPES);
      result = await fetchMachineTypesApi();
    }

    if (result.status === "success" && result.data.length) {
      machineTypesCache = result.data.map(m => ({
        key: m.key,
        units: m.units || [],
        active: m.active !== false,
        id: m.id
      }));
      machineTypesLoaded = true;
      refreshMachineOptionsExport();
    }

  } catch (error) {

    console.error("Error loading machine types from Firestore:", error);
    // الكاش بيفضل على القائمة الافتراضية المحلية (Fallback) - راجع
    // تعريف machineTypesCache فوق

  }

}

/**
 * إعادة تحميل الكاش من Firestore - تُستخدم بعد أي إضافة/تعديل/حذف
 * من شاشة إدارة الماكينات عشان باقي التطبيق (لو اتفتح تاني بعد كده
 * في نفس الجلسة) يشوف أحدث نسخة فوراً بدون الحاجة لإعادة تحميل
 * الصفحة بالكامل
 */
export async function refreshMachineTypesCache() {
  machineTypesLoaded = false;
  await loadMachineTypesFromFirestore();
}

export function isMachineTypesLoaded() {
  return machineTypesLoaded;
}

/**
 * كل أنواع الماكينات كما هي في الكاش الحالي (id/key/units/active) -
 * تُستخدم في شاشة الإدارة (MachinesView.js) وفي errorScanner.js /
 * MaintenanceSearchView.js بدل ما كل واحد فيهم يكرر قائمة يدوية
 * خاصة بيه
 *
 * @param {Object} [opts]
 * @param {boolean} [opts.includeInactive=true] - لو false، بيرجّع
 *   الأنواع المفعّلة بس (تُستخدم لفورمات الإنشاء الجديدة)
 */
export function getMachineTypeEntries({ includeInactive = true } = {}) {
  return includeInactive
    ? machineTypesCache
    : machineTypesCache.filter(m => m.active !== false);
}

// نسخة مسطّحة (بدون تقسيم) لأي كود قديم/تاني محتاج مجرد مصفوفة أسماء
// كاملة - نفس القيم اللي بتتحفظ في قاعدة البيانات بالظبط. الأنواع
// المعطّلة فقط (Active) هي اللي بتظهر هنا لأن هذا التصدير بيُستخدم في
// فورمات "إنشاء" بلاغ/مقترح جديد (errorScanner.js) - مش في البحث
export let MACHINE_OPTIONS = buildFlatOptions();

function buildFlatOptions() {
  return machineTypesCache
    .filter(m => m.active !== false)
    .flatMap(m => (m.units && m.units.length ? m.units.map(u => `${m.key} ${u}`) : [m.key]));
}

// إعادة حساب MACHINE_OPTIONS بعد كل تحديث للكاش - بما إن هذا export
// let (وليس const)، إعادة تعيينه هنا بينعكس فوراً في أي ملف تاني
// عامل import { MACHINE_OPTIONS } من هذا الملف (ES Modules Live
// Bindings)، بدون أي حاجة لإعادة استيراد أو إعادة تحميل الصفحة
function refreshMachineOptionsExport() {
  MACHINE_OPTIONS = buildFlatOptions();
}

// إرجاع وحدات نوع ماكينة معينة، أو null لو النوع ده مالوش وحدات فرعية
// (يعني هو نفسه القيمة النهائية مباشرة) - بيدوّر في كل الأنواع (حتى
// المعطّلة) عشان قيمة محفوظة مسبقاً لنوع اتعطّل بعدين تفضل قابلة
// للتفسير الصحيح (مثلاً في فورم بحث بفلتر محفوظ)
export function getMachineUnits(typeKey) {
  const entry = machineTypesCache.find(m => m.key === typeKey);
  return entry && entry.units && entry.units.length ? entry.units : null;
}

// تفكيك قيمة كاملة محفوظة مسبقاً (مثلاً "Bodymaker 01") لمعرفة النوع
// والوحدة المطابقين - يُستخدم لتحديد القيمة الصحيحة تلقائياً في
// الخطوتين عند فتح فورم فيه قيمة محفوظة مسبقاً (تعديل/فلتر محفوظ)
export function parseMachineValue(fullValue) {
  if (!fullValue) return { type: "", unit: "" };
  for (const m of machineTypesCache) {
    if (m.units && m.units.length) {
      const unit = m.units.find(u => `${m.key} ${u}` === fullValue);
      if (unit) return { type: m.key, unit };
    } else if (m.key === fullValue) {
      return { type: m.key, unit: "" };
    }
  }
  // قيمة غير معروفة (مثال: "all" أو قيم قديمة زي "machine2"/"line1") -
  // تُعامل كـ "نوع" منتهي بدون وحدات فرعية
  return { type: fullValue, unit: "" };
}

const DEFAULT_SELECT_CLASS =
  "w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white outline-none focus:border-blue-500 transition text-sm appearance-none shadow-sm";

/**
 * توليد HTML لـ Dropdown الماكينة على خطوتين (نوع + وحدة عند الحاجة)
 * + حقل مخفي (hidden input) بنفس الـ id القديم يحمل القيمة الكاملة
 * النهائية - فكل كود القراءة/الحفظ الحالي (document.getElementById(id).value)
 * فاضل شغال زي ما هو بالظبط بدون أي تعديل على آلية الحفظ.
 *
 * @param {string} baseId - نفس الـ id اللي كان مستخدم قبل كده لعنصر
 *   الـ <select> المفرد (هو اللي هيتحط على الـ hidden input النهائي)
 * @param {Object} [opts]
 * @param {string} [opts.selectedValue] - قيمة كاملة محفوظة مسبقاً لتحديدها تلقائياً
 * @param {boolean} [opts.includePlaceholder=true] - إضافة خيار Placeholder لقائمة النوع
 * @param {string} [opts.placeholderLabel] - نص Placeholder لقائمة النوع
 * @param {string} [opts.unitPlaceholderLabel] - نص Placeholder لقائمة الوحدة
 * @param {boolean} [opts.includeAll] - إضافة خيار "كل الماكينات" (لفلاتر البحث)
 * @param {string} [opts.allLabel] - نص خيار "الكل"
 * @param {string} [opts.allValue] - قيمة خيار "الكل"
 * @param {boolean} [opts.includeInactiveTypes=false] - إظهار الأنواع
 *   المعطّلة كمان في قائمة الاختيار (تُستخدم في فلاتر البحث عن
 *   بلاغات قديمة، مش في فورمات إنشاء بلاغ جديد)
 * @param {string} [opts.extraTypeOptionsHtml] - خيارات إضافية تُضاف آخر قائمة
 *   النوع كما هي (لأي قيم قديمة غير قياسية مستخدمة في صفحة معينة)
 * @param {string} [opts.typeSelectClass] - كلاس قائمة النوع
 * @param {string} [opts.unitSelectClass] - كلاس قائمة الوحدة
 * @param {string} [opts.hiddenOnChange] - كود JS يُنفَّذ (this = الحقل المخفي)
 *   كل ما القيمة النهائية تتغيّر - لربط أي منطق موجود بالفعل (فلترة
 *   فورية، حفظ في localStorage...) بنفس الطريقة القديمة تماماً
 * @returns {string} HTML لعنصرَي الاختيار + الحقل المخفي
 */
export function buildMachineDropdownHtml(baseId, {
  selectedValue = "",
  includePlaceholder = true,
  placeholderLabel = "اختر نوع الماكينة",
  unitPlaceholderLabel = "اختر الرقم",
  includeAll = false,
  allLabel = "كل الماكينات",
  allValue = "all",
  includeInactiveTypes = false,
  extraTypeOptionsHtml = "",
  typeSelectClass = DEFAULT_SELECT_CLASS,
  unitSelectClass = DEFAULT_SELECT_CLASS + " mt-2",
  hiddenOnChange = ""
} = {}) {

  const { type: selectedType, unit: selectedUnit } = parseMachineValue(selectedValue);
  const unitsForSelectedType = selectedType ? getMachineUnits(selectedType) : null;
  const showUnitInitially = !!(unitsForSelectedType && unitsForSelectedType.length);

  const placeholderHtml = includePlaceholder
    ? `<option value="" disabled ${selectedType ? "" : "selected"}>${placeholderLabel}</option>`
    : "";

  const allHtml = includeAll
    ? `<option value="${allValue}" ${selectedType === allValue ? "selected" : ""}>${allLabel}</option>`
    : "";

  const visibleTypes = getMachineTypeEntries({ includeInactive: includeInactiveTypes });

  const typesHtml = visibleTypes.map(m =>
    `<option value="${m.key}" ${m.key === selectedType ? "selected" : ""}>${m.key}${m.active === false ? " (معطّل)" : ""}</option>`
  ).join("");

  const unitOptionsHtml = showUnitInitially
    ? `<option value="" disabled ${selectedUnit ? "" : "selected"}>${unitPlaceholderLabel}</option>` +
      unitsForSelectedType.map(u =>
        `<option value="${u}" ${u === selectedUnit ? "selected" : ""}>${u}</option>`
      ).join("")
    : "";

  // القيمة النهائية المبدئية للحقل المخفي: لو النوع المختار عنده
  // وحدات وماحددناش وحدة بعد، تفضل فاضية (الفورم يستنى اختيار الوحدة)
  const hiddenValue = showUnitInitially
    ? (selectedUnit ? selectedValue : "")
    : selectedValue;

  const onchangeAttr = hiddenOnChange ? ` onchange="${hiddenOnChange}"` : "";

  const typeRequiredAttr = includePlaceholder ? " required" : "";

  return `
    <select id="${baseId}Type" class="${typeSelectClass}"${typeRequiredAttr} onchange="window.__onMachineTypeChange('${baseId}')">
      ${placeholderHtml}${allHtml}${typesHtml}${extraTypeOptionsHtml}
    </select>
    <select id="${baseId}Unit" class="${unitSelectClass} ${showUnitInitially ? "" : "hidden"}" onchange="window.__onMachineUnitChange('${baseId}')">
      ${unitOptionsHtml}
    </select>
    <input type="hidden" id="${baseId}" value="${hiddenValue}"${onchangeAttr}>
  `;
}

// ------------------------------------------------------------
// المعالجات العامة (Global Handlers) - نفس أسلوب باقي التطبيق في
// ربط الأحداث عبر onchange="window.xxx(...)" مباشرة داخل الـ HTML،
// لأن الشاشات هنا Template Strings بسيطة (مفيش DOM لحظة كتابة الكود)
// ------------------------------------------------------------

// لما المستخدم يغيّر "نوع الماكينة": لو النوع ده ليه وحدات فرعية،
// نجهّز قائمة الوحدة ونظهرها ونستنى اختيار المستخدم؛ لو مالوش وحدات،
// القيمة النهائية بقت معروفة فوراً = نفس النوع
window.__onMachineTypeChange = function (baseId) {
  const typeSel = document.getElementById(baseId + "Type");
  const unitSel = document.getElementById(baseId + "Unit");
  const hidden = document.getElementById(baseId);
  if (!typeSel || !unitSel || !hidden) return;

  const type = typeSel.value;
  const units = getMachineUnits(type);

  if (units && units.length) {
    unitSel.innerHTML =
      `<option value="" disabled selected>اختر الرقم</option>` +
      units.map(u => `<option value="${u}">${u}</option>`).join("");
    unitSel.classList.remove("hidden");
    setMachineHiddenValue(hidden, "");
  } else {
    unitSel.innerHTML = "";
    unitSel.classList.add("hidden");
    setMachineHiddenValue(hidden, type || "");
  }
};

// لما المستخدم يحدد "الوحدة": نركّب القيمة الكاملة (نوع + وحدة)
window.__onMachineUnitChange = function (baseId) {
  const typeSel = document.getElementById(baseId + "Type");
  const unitSel = document.getElementById(baseId + "Unit");
  const hidden = document.getElementById(baseId);
  if (!typeSel || !unitSel || !hidden) return;

  setMachineHiddenValue(hidden, unitSel.value ? `${typeSel.value} ${unitSel.value}` : "");
};

// تحديث قيمة الحقل المخفي + إطلاق حدث "change" حقيقي عليه، عشان أي
// onchange مكتوب على نفس الحقل (زي حفظ في localStorage أو تطبيق فلتر
// فوري) يفضل شغال بنفس الطريقة القديمة تماماً حتى مع القيمة الجديدة
// اللي بتتحط برمجياً (مش من المستخدم مباشرة)
function setMachineHiddenValue(hiddenInput, value) {
  hiddenInput.value = value;
  hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
}

