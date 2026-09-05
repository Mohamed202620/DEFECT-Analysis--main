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

import { isAdminRole, getCurrentRole } from "./permissions.js";

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
// ملحوظة (ربط الماكينات بالقسم): القيمة الافتراضية لكل عنصر هنا
// "backend" (نفس التعامل الافتراضي مع أي ماكينة قديمة بلا department -
// راجع normalizeDepartment في services/machinesApi.js) - الأدمن يقدر
// يعدّل قسم أي عنصر منها لاحقاً من شاشة "إدارة الماكينات" حسب التصنيف
// الفعلي المطلوب في المصنع
export const DEFAULT_MACHINE_TYPES = [
  { key: "Coil Handling", units: [], department: "backend" },
  { key: "Baler", units: [], department: "backend" },
  { key: "Cupper", units: [], department: "backend" },
  { key: "Bodymaker", units: padNumbers(11), department: "backend" },
  { key: "Trimmer", units: [], department: "backend" },
  { key: "Washer", units: [], department: "backend" },
  { key: "Decorator", units: padNumbers(2), department: "backend" },
  { key: "Spray", units: padNumbers(11), department: "backend" },
  { key: "IBO", units: [], department: "backend" },
  { key: "Necker", units: [], department: "backend" },
  { key: "Palletizer", units: [], department: "backend" },
  { key: "Depalletizer", units: [], department: "backend" },
  { key: "Front End Line Control", units: [], department: "backend" },
  { key: "Mid Line Control", units: [], department: "backend" },
  { key: "Back End Line Control", units: [], department: "backend" },
  { key: "STRAP", units: ["A1", "A2", "B1", "B2"], department: "backend" }
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
        department: m.department === "frontend" ? "frontend" : "backend",
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
 * @param {boolean} [opts.filterByUserDepartment=true] - إصلاح (بند
 *   حرج - Machine Access حسب Role/Work Area): بشكل افتراضي، القائمة
 *   المُرجَعة بتتفلتر حسب قسم المستخدم الحالي (machineDepartment)
 *   بنفس منطق getMachinesForUser المستخدم أصلاً في شاشة "إدارة
 *   الماكينات" - مستخدم Backend يشوف ماكينات Backend بس، Frontend
 *   كذلك، والأدمن يشوف الكل. هذه الدالة هي نقطة الاستدعاء المركزية
 *   لكل شاشات الاستخدام الفعلي (buildMachineDropdownHtml المستخدمة في
 *   تسجيل عطل/كايزن، وerrorScanner.js/MaintenanceSearchView.js
 *   مباشرة) - فتطبيق الفلترة هنا يغطيها كلها من مصدر واحد. تمرير
 *   false صراحة يرجّع القائمة الكاملة بدون فلترة (غير مُستخدم حالياً
 *   في أي شاشة، متاح فقط كمخرج طوارئ مستقبلي)
 */
export function getMachineTypeEntries({ includeInactive = true, filterByUserDepartment = true } = {}) {
  const base = includeInactive
    ? machineTypesCache
    : machineTypesCache.filter(m => m.active !== false);

  if (!filterByUserDepartment) {
    return base;
  }

  return getMachinesForUser(getCurrentUserMachineContext(), base);
}

// ============================================================
// ربط الماكينات بالقسم (Backend / Frontend)
// ============================================================

// نفس منطق normalizeDepartment في services/machinesApi.js - مكرر هنا
// عمداً (بدون استيراد متبادل بين الملفين) لأن machines.js ملف واجهة
// عام بيُستخدم برضه بمعزل عن services أحياناً؛ القيمتين لازم يفضلوا
// متطابقين تماماً (backend/frontend فقط، أي حاجة تانية = backend)
function normalizeDepartment(value) {
  return String(value || "").trim().toLowerCase() === "frontend" ? "frontend" : "backend";
}

/**
 * فلترة قائمة الماكينات حسب صلاحية المستخدم - دالة عامة قابلة لإعادة
 * الاستخدام في أي شاشة محتاجة تعرض/تدير ماكينات حسب قسم المستخدم
 * (تُستخدم حالياً في شاشة "إدارة الماكينات" - راجع MachinesView.js).
 *
 * - Admin: يشوف كل الماكينات بكل الأقسام بدون أي فلترة.
 * - غير Admin: يشوف بس ماكينات قسمه هو (user.machineDepartment).
 * - المستخدم بدون قسم محدد (machineDepartment فاضي/غير موجود):
 *   يُعامل كـ "backend" (نفس قاعدة التوافق مع البيانات القديمة).
 *
 * ملحوظة: تصنيف المستخدم هنا مخزّن في حقل منفصل اسمه
 * "machineDepartment" (backend/frontend) وليس نفس حقل "department"
 * العام الموجود بالفعل في مستند المستخدم (Production/Mechanical/
 * Electrical - قسم تنظيمي عام مستخدم في التسجيل والتقارير وكايزن).
 * استخدام نفس الحقل "department" لهذا التصنيف الجديد كان هيكسر كل
 * الأماكن اللي بتعرض/تعتمد على القيمة التنظيمية الحالية، فتم عمل
 * حقل مستقل بدل توسيع/تغيير معنى الحقل الموجود.
 *
 * @param {Object} user - كائن بسيط فيه على الأقل { role, machineDepartment }
 * @param {Array} allMachines - قائمة كل الماكينات (id/key/.../department)
 * @returns {Array}
 */
/**
 * سياق المستخدم الحالي (role + machineDepartment) من localStorage -
 * إصلاح (بند حرج - فلترة الماكينات حسب Role/Work Area): نفس البيانات
 * اللي كانت شاشة "إدارة الماكينات" فقط بتقرأها لنفسها
 * (getCurrentUserForMachines في MachinesView.js) - دلوقتي بقت دالة
 * مُصدَّرة مركزية من هنا عشان أي شاشة تانية محتاجة تفلتر الماكينات
 * (تسجيل عطل / كايزن / فاحص الأعطال / بحث الصيانة) تستخدم نفس
 * المصدر الموحّد بدل ما كل شاشة تقرأ localStorage بنفسها بطريقة مختلفة
 */
export function getCurrentUserMachineContext() {
  return {
    role: getCurrentRole(),
    machineDepartment: localStorage.getItem("machineDepartment") || ""
  };
}

window.getCurrentUserMachineContext = getCurrentUserMachineContext;

export function getMachinesForUser(user, allMachines) {
  const list = Array.isArray(allMachines) ? allMachines : [];

  const role = String(user?.role || "").trim().toLowerCase();

  if (isAdminRole(role)) {
    return list;
  }

  const userDept = normalizeDepartment(user?.machineDepartment);

  return list.filter(m => normalizeDepartment(m.department) === userDept);
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

/**
 * تحديد قسم (department) ماكينة معينة من قيمتها الكاملة المحفوظة
 * (مثلاً "Bodymaker 01") - بيدوّر على النوع في الكتالوج (machineTypesCache)
 * ويرجّع قسمه الفعلي (backend/frontend)، بدل الاعتماد على قسم
 * المستخدم المُبلِّغ نفسه (اللي ممكن يكون أدمن بيسجل بالنيابة عن
 * قسم تاني). تُستخدم في نقطة الكتابة (الإصلاح الأمني للبند الحرج
 * الخاص بحماية machineErrors/machineErrorLogs/pmRecords على مستوى
 * Firestore Rules) عشان نحفظ "department" صحيح مع كل مستند جديد،
 * فيبقى ممكن للـ Rules تتحقق منه سيرفرياً بدل الاعتماد الكامل على
 * فلترة الواجهة فقط (اللي قابلة للتجاوز من الـ DevTools).
 *
 * لو الماكينة مش موجودة في الكتالوج (قيمة قديمة/غير معروفة)، بترجع
 * "" بدل ما تفترض قسم افتراضي غلط - الاستدعاء المسؤول عن الكتابة هو
 * اللي يقرر إزاي يتعامل مع الحالة دي (عادة: يرجع لقسم المستخدم الحالي
 * كـ fallback أخير فقط)
 */
export function getDepartmentForMachineValue(fullValue) {
  if (!fullValue) return "";
  const { type } = parseMachineValue(fullValue);
  const entry = machineTypesCache.find(m => m.key === type);
  return entry ? normalizeDepartment(entry.department) : "";
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

  // إصلاح (بند حرج - Machine Access): لو المستخدم مالوش أي ماكينة
  // متاحة ضمن قسمه بعد الفلترة (مثلاً حساب اتعمله machineDepartment
  // غلط، أو لسه محددش)، بنعرض رسالة واضحة بدل Dropdown فاضي بيوهم
  // المستخدم إن مفيش ماكينات في المصنع أصلاً
  if (visibleTypes.length === 0) {
    const noMachinesLabel = (window.currentLang || "ar") === "en"
      ? "No machines available for your work area. Contact your administrator."
      : "لا توجد ماكينات متاحة ضمن قسمك الحالي - برجاء التواصل مع مسؤول النظام.";

    return `
      <select id="${baseId}Type" class="${typeSelectClass}" disabled>
        <option value="" selected>${noMachinesLabel}</option>
      </select>
      <select id="${baseId}Unit" class="${unitSelectClass} hidden"></select>
      <input type="hidden" id="${baseId}" value="">
    `;
  }

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

