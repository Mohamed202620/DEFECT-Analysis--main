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
//
// القائمة الطويلة (40 خيار) بقت مُقسّمة بعناوين فرعية (<optgroup>)
// للماكينات اللي ليها وحدات مرقّمة (Bodymaker/Decorator/Spray/STRAP)
// عشان تسهيل التصفح على الموبايل - بدون أي تغيير في القيمة المحفوظة.
// ============================================================

// ماكينات ليها وحدات مرقّمة: name + عدد الوحدات (من 01 وحتى العدد)
// - كل واحدة هتتحول لعنوان فرعي (Optgroup) في الـ Dropdown
const NUMBERED_MACHINE_GROUPS = [
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

// ماكينات STRAP - تسميات فرعية ثابتة (مش ترقيم متسلسل) - وبرضه
// بتتحول لعنوان فرعي (Optgroup) واحد باسم "STRAP"
const STRAP_GROUP_LABEL = "STRAP";
const STRAP_MACHINE_NAMES = ["STRAP A1", "STRAP A2", "STRAP B1", "STRAP B2"];

// ------------------------------------------------------------
// بنية القائمة الكاملة كمتتالية من "عناصر" - كل عنصر إما:
//   { type: "option", name }                      ماكينة مفردة عادية
//   { type: "group", label, options: [names...] } مجموعة تحت عنوان فرعي
// بنفس ترتيب القائمة الأصلية بالظبط، مع استبدال Bodymaker/Decorator/
// Spray بمجموعاتها المرقّمة، وإضافة مجموعة STRAP في النهاية، وباقي
// الماكينات كما هي بدون أي تغيير
// ------------------------------------------------------------
const MACHINE_ENTRIES = [
  { type: "option", name: "Coil Handling" },
  { type: "option", name: "Baler" },
  { type: "option", name: "Cupper" },
  { type: "group", label: NUMBERED_MACHINE_GROUPS[0].name, options: numberedMachineNames(NUMBERED_MACHINE_GROUPS[0]) },
  { type: "option", name: "Trimmer" },
  { type: "option", name: "Washer" },
  { type: "group", label: NUMBERED_MACHINE_GROUPS[1].name, options: numberedMachineNames(NUMBERED_MACHINE_GROUPS[1]) },
  { type: "group", label: NUMBERED_MACHINE_GROUPS[2].name, options: numberedMachineNames(NUMBERED_MACHINE_GROUPS[2]) },
  { type: "option", name: "IBO" },
  { type: "option", name: "Necker" },
  { type: "option", name: "Palletizer" },
  { type: "option", name: "Depalletizer" },
  { type: "option", name: "Front End Line Control" },
  { type: "option", name: "Mid Line Control" },
  { type: "option", name: "Back End Line Control" },
  { type: "group", label: STRAP_GROUP_LABEL, options: STRAP_MACHINE_NAMES }
];

// نسخة مسطّحة (بدون تقسيم) لأي كود قديم/تاني محتاج مجرد مصفوفة أسماء
// (نفس الاستخدام القديم بالظبط - القيم المحفوظة في قاعدة البيانات
// متطابقة 100% مع القائمة المُقسّمة، الفرق بس في شكل العرض)
export const MACHINE_OPTIONS = MACHINE_ENTRIES.flatMap(entry =>
  entry.type === "group" ? entry.options : [entry.name]
);

/**
 * توليد HTML لخيارات <option>/<optgroup> لأي Dropdown ماكينة بالتطبيق.
 * القيمة المحفوظة (value) هي نفسها الاسم الكامل المعروض بالضبط
 * (مثال: "Bodymaker 01")، فتُحفظ في قاعدة البيانات كما هي بدون أي
 * تعديل إضافي على آلية الحفظ الحالية - التقسيم بعناوين فرعية
 * (Optgroup) شكلي فقط لتسهيل التصفح على الموبايل.
 *
 * @param {Object} [opts]
 * @param {string} [opts.selectedValue] - القيمة المختارة حالياً (لتحديد selected)
 * @param {boolean} [opts.includePlaceholder] - إضافة خيار "اختر الماكينة" في البداية
 * @param {string} [opts.placeholderLabel] - نص خيار الـ Placeholder
 * @param {boolean} [opts.includeAll] - إضافة خيار "كل الماكينات" (لفلاتر البحث)
 * @param {string} [opts.allLabel] - نص خيار "الكل"
 * @param {string} [opts.allValue] - قيمة خيار "الكل"
 * @returns {string} HTML لعناصر <option> و<optgroup>
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

  const optionHtml = name =>
    `<option value="${name}" ${name === selectedValue ? "selected" : ""}>${name}</option>`;

  const entriesHtml = MACHINE_ENTRIES.map(entry => {
    if (entry.type === "group") {
      return `<optgroup label="${entry.label}">${entry.options.map(optionHtml).join("")}</optgroup>`;
    }
    return optionHtml(entry.name);
  }).join("");

  return placeholderHtml + allHtml + entriesHtml;
}
