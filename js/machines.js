// ============================================================
// machines.js
// القائمة الموحّدة للماكينات المستخدمة في كل شاشات التطبيق (تسجيل
// بلاغ عطل / البحث والفلترة المتقدمة / مقترح كايزن / Machine Error
// Scanner) - مصدر واحد بدل تكرار القائمة يدوياً في كل ملف على حدة.
//
// القائمة الطويلة (40 قيمة) بقت Dropdown على خطوتين حقيقيتين بدل
// قائمة واحدة طويلة أو مجرد تقسيم بصري (Optgroup):
//   1) قائمة قصيرة لاختيار "نوع الماكينة" (Bodymaker / Decorator / ...)
//   2) لو النوع ده ليه وحدات مرقّمة (أو تسميات فرعية زي STRAP)، تظهر
//      قائمة تانية صغيرة لاختيار الوحدة بالتحديد (01، 02، ...، A1، ...)
// وفي الآخر بيتحط الاسم الكامل ("Bodymaker 01") في حقل مخفي (hidden
// input) بنفس الـ id الأصلي اللي كان مستخدم قبل كده لعنصر الـ <select>
// المفرد - فكل كود القراءة/الحفظ الحالي (بيقرأ .value من نفس الـ id)
// فاضل شغال زي ما هو بالظبط بدون أي تعديل.
// ============================================================

// كل عنصر في القائمة عبارة عن "نوع ماكينة" - لو معاه "units" يبقى
// عنده وحدات فرعية لازم تتحدد (وقتها القيمة النهائية = "النوع + الوحدة")
// ولو مفيهوش "units" يبقى هو نفسه القيمة النهائية بدون أي اختيار إضافي
const MACHINE_TYPES = [
  { key: "Coil Handling" },
  { key: "Baler" },
  { key: "Cupper" },
  { key: "Bodymaker", units: padNumbers(11) },
  { key: "Trimmer" },
  { key: "Washer" },
  { key: "Decorator", units: padNumbers(2) },
  { key: "Spray", units: padNumbers(11) },
  { key: "IBO" },
  { key: "Necker" },
  { key: "Palletizer" },
  { key: "Depalletizer" },
  { key: "Front End Line Control" },
  { key: "Mid Line Control" },
  { key: "Back End Line Control" },
  { key: "STRAP", units: ["A1", "A2", "B1", "B2"] }
];

// توليد "01".."NN" (ترقيم بخانتين دايماً)
function padNumbers(count) {
  const list = [];
  for (let i = 1; i <= count; i++) list.push(String(i).padStart(2, "0"));
  return list;
}

// نسخة مسطّحة (بدون تقسيم) لأي كود قديم/تاني محتاج مجرد مصفوفة أسماء
// كاملة - نفس القيم اللي بتتحفظ في قاعدة البيانات بالظبط
export const MACHINE_OPTIONS = MACHINE_TYPES.flatMap(m =>
  m.units ? m.units.map(u => `${m.key} ${u}`) : [m.key]
);

// إرجاع وحدات نوع ماكينة معينة، أو null لو النوع ده مالوش وحدات فرعية
// (يعني هو نفسه القيمة النهائية مباشرة)
export function getMachineUnits(typeKey) {
  const entry = MACHINE_TYPES.find(m => m.key === typeKey);
  return entry && entry.units ? entry.units : null;
}

// تفكيك قيمة كاملة محفوظة مسبقاً (مثلاً "Bodymaker 01") لمعرفة النوع
// والوحدة المطابقين - يُستخدم لتحديد القيمة الصحيحة تلقائياً في
// الخطوتين عند فتح فورم فيه قيمة محفوظة مسبقاً (تعديل/فلتر محفوظ)
export function parseMachineValue(fullValue) {
  if (!fullValue) return { type: "", unit: "" };
  for (const m of MACHINE_TYPES) {
    if (m.units) {
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

  const typesHtml = MACHINE_TYPES.map(m =>
    `<option value="${m.key}" ${m.key === selectedType ? "selected" : ""}>${m.key}</option>`
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
