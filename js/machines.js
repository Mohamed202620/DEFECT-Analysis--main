// ============================================================
// machines.js
// القائمة الموحّدة للماكينات المستخدمة في كل شاشات التطبيق (تسجيل
// بلاغ عطل / البحث والفلترة المتقدمة / مقترح كايزن / Machine Error
// Scanner) - مصدر واحد بدل تكرار القائمة يدوياً في كل ملف على حدة.
//
// بعض الماكينات ليها وحدات مرقّمة (أكتر من وحدة لنفس النوع على
// الخط)، فبيتم توليد الاسم الكامل لكل وحدة تلقائياً هنا (مثال:
// "Bodymaker 01")، وهو نفسه الاسم الكامل اللي بيتحفظ في قاعدة
// البيانات كقيمة حقل "machine" - بنفس آلية الحفظ الحالية بالظبط
// (لا تغيير على منطق الحفظ، فقط على القيم المعروضة في الـ Dropdown).
// ============================================================

// ماكينات ليها وحدات مرقّمة: name + عدد الوحدات (من 01 وحتى العدد)
const NUMBERED_MACHINES = [
  { name: "Bodymaker", count: 11 },
  { name: "Decorator", count: 2 },
  { name: "Spray", count: 11 }
];

// توليد "Name 01".."Name NN" لماكينة مرقّمة (ترقيم بخانتين دايماً)
function numberedMachineNames({ name, count }) {
  const names = [];
  for (let i = 1; i <= count; i++) {
    names.push(`${name} ${String(i).padStart(2, "0")}`);
  }
  return names;
}

// ماكينات STRAP - تسميات فرعية ثابتة (مش ترقيم متسلسل)
const STRAP_MACHINE_NAMES = ["STRAP A1", "STRAP A2", "STRAP B1", "STRAP B2"];

const bodymakerNames = numberedMachineNames(NUMBERED_MACHINES[0]);
const decoratorNames = numberedMachineNames(NUMBERED_MACHINES[1]);
const sprayNames = numberedMachineNames(NUMBERED_MACHINES[2]);

// القائمة الكاملة - بنفس ترتيب القائمة الأصلية، مع استبدال
// Bodymaker/Decorator/Spray بوحداتها المرقّمة، وإضافة STRAP في
// النهاية، وباقي الماكينات كما هي بدون أي تغيير
export const MACHINE_OPTIONS = [
  "Coil Handling",
  "Baler",
  "Cupper",
  ...bodymakerNames,
  "Trimmer",
  "Washer",
  ...decoratorNames,
  ...sprayNames,
  "IBO",
  "Necker",
  "Palletizer",
  "Depalletizer",
  "Front End Line Control",
  "Mid Line Control",
  "Back End Line Control",
  ...STRAP_MACHINE_NAMES
];

/**
 * توليد HTML لخيارات <option> لأي Dropdown ماكينة بالتطبيق.
 * القيمة المحفوظة (value) هي نفسها الاسم الكامل المعروض بالضبط،
 * فتُحفظ في قاعدة البيانات كما هي بدون أي تعديل إضافي على آلية
 * الحفظ الحالية (نفس الأسلوب المُستخدم فعلياً في كل الشاشات).
 *
 * @param {Object} [opts]
 * @param {string} [opts.selectedValue] - القيمة المختارة حالياً (لتحديد selected)
 * @param {boolean} [opts.includePlaceholder] - إضافة خيار "اختر الماكينة" في البداية
 * @param {string} [opts.placeholderLabel] - نص خيار الـ Placeholder
 * @param {boolean} [opts.includeAll] - إضافة خيار "كل الماكينات" (لفلاتر البحث)
 * @param {string} [opts.allLabel] - نص خيار "الكل"
 * @param {string} [opts.allValue] - قيمة خيار "الكل"
 * @returns {string} HTML لعناصر <option>
 */
export function buildMachineOptionsHtml({
  selectedValue = "",
  includePlaceholder = false,
  placeholderLabel = "اختر الماكينة",
  includeAll = false,
  allLabel = "كل الماكينات",
  allValue = "all"
} = {}) {

  const placeholderHtml = includePlaceholder
    ? `<option value="" disabled ${selectedValue ? "" : "selected"}>${placeholderLabel}</option>`
    : "";

  const allHtml = includeAll
    ? `<option value="${allValue}" ${selectedValue === allValue ? "selected" : ""}>${allLabel}</option>`
    : "";

  const optionsHtml = MACHINE_OPTIONS.map(name =>
    `<option value="${name}" ${name === selectedValue ? "selected" : ""}>${name}</option>`
  ).join("");

  return placeholderHtml + allHtml + optionsHtml;
}
