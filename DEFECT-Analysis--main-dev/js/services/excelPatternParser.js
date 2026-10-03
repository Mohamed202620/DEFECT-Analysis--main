// ============================================================
// excelPatternParser.js
// قراءة ملف Pattern Excel (جدول الورديات GREEN/BLUE/RED) فعلياً
// عبر ExcelJS (محمّلة أصلاً في index.html - لا مكتبة جديدة) بدون
// أي Hardcode للتواريخ أو الأكواد.
// ============================================================
//
// شكل الملف المتوقع (شائع في هذا النوع من جداول الورديات):
// - عدة "أقسام" (Sections) رأسية متتالية، قسم لكل شهر أو نصف شهر،
//   كل قسم بيبدأ بصف "رأس تواريخ" (فيه تواريخ فعلية متتالية في
//   الأعمدة)، وتحته 3 صفوف (GREEN / BLUE / RED) فيها أكواد
//   M / N / OFF لكل تاريخ.
// - الأقسام ممكن تتكرر تحت بعض بعدد أي شهور، وده اللي يخلي
//   "الشهور متداخلة" - الباحث بيتعامل مع أي عدد أقسام تلقائياً.
//
// الخوارزمية بتدور على أي صف فيه 3 خلايا أو أكتر قيمتها تاريخ
// فعلي (Excel Date) وتعتبره "رأس تواريخ" لكل الصفوف اللي بعده لحد
// ما تلاقي رأس تواريخ جديد. أي صف بعد كده أول خلية فيه (أو أول
// خليتين) بيبقى فيها اسم فريق (GREEN/BLUE/RED بأي شكل كتابة) بيتقرأ
// كصف كودات لهذا الفريق تحت رأس التواريخ الحالي.
// ============================================================

const TEAM_ALIASES = {
  green: ["green", "جرين", "أخضر", "اخضر"],
  blue: ["blue", "بلو", "أزرق", "ازرق"],
  red: ["red", "ريد", "أحمر", "احمر"]
};

const CODE_ALIASES = {
  M: ["m", "صباحي", "صباح", "day", "d", "morning", "am"],
  N: ["n", "ليلي", "ليل", "night", "pm"],
  OFF: ["off", "اجازة", "إجازة", "off day", "o", "rest", "راحة"]
};

/**
 * تطبيع اسم الفريق - مطابقة تامة (Exact Match) بعد التنظيف فقط،
 * مش مجرد substring - عشان نتجنب تطابقات وهمية زي كلمة الشهر "Feb"
 * (بتحتوي على حرف b) أو "Aug"/"Mar" (بتحتوي على g/r) وهي مش أسماء
 * فرق أصلاً. أسماء الفرق الحقيقية في الملفات دايماً خلية مستقلة
 * زي "GREEN"/"Red"/"جرين" فمطابقة تامة كافية وأدق وأأمن.
 */
function normalizeTeamKey(rawText) {
  const clean = String(rawText || "").trim().toLowerCase();
  if (!clean) return null;
  for (const [key, aliases] of Object.entries(TEAM_ALIASES)) {
    if (aliases.some(a => clean === a)) return key;
  }
  return null;
}

function normalizeCode(rawText) {
  const clean = String(rawText || "").trim().toLowerCase();
  if (!clean) return null;
  for (const [code, aliases] of Object.entries(CODE_ALIASES)) {
    if (aliases.some(a => clean === a)) return code;
  }
  // مطابقة تقريبية (بادئة) لو الخلية فيها نص زيادة زي "M - صباحي"
  for (const [code, aliases] of Object.entries(CODE_ALIASES)) {
    if (aliases.some(a => clean.startsWith(a))) return code;
  }
  return null;
}

/**
 * تحويل قيمة خلية ExcelJS لتاريخ ISO (YYYY-MM-DD) لو كانت تاريخ
 * فعلي، وإلا null
 */
function cellToIsoDate(cell) {
  if (!cell) return null;
  const v = cell.value;
  if (!v) return null;

  // ExcelJS بيرجع كائن Date حقيقي لو الخلية متنسقة كتاريخ
  if (v instanceof Date && !isNaN(v.getTime())) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    // تجاهل تواريخ غير منطقية (سنة قبل 2000 أو بعد 2100) - غالباً
    // خطأ تنسيق مش تاريخ فعلي
    if (y >= 2000 && y <= 2100) return `${y}-${m}-${d}`;
    return null;
  }

  // أحياناً بترجع كنص "2026-01-05" أو "05/01/2026"
  if (typeof v === "string") {
    const isoMatch = v.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      const y = Number(isoMatch[1]), m = Number(isoMatch[2]), d = Number(isoMatch[3]);
      if (y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      }
    }
  }

  return null;
}

function cellToText(cell) {
  if (!cell) return "";
  const v = cell.value;
  if (v == null) return "";
  if (typeof v === "object" && v.richText) {
    return v.richText.map(rt => rt.text).join("");
  }
  if (typeof v === "object" && v.text) return String(v.text);
  return String(v);
}

/**
 * الدالة الرئيسية: بتاخد Workbook مُحمَّل بالفعل عبر
 * new window.ExcelJS.Workbook() -> load(arrayBuffer) وترجع
 * { teams: { green: {date: code}, blue: {...}, red: {...} },
 *   datesCount, warnings: [] }
 */
export function parsePatternWorkbook(workbook) {
  const teams = { green: {}, blue: {}, red: {} };
  const warnings = [];
  let datesCount = 0;

  workbook.eachSheet(worksheet => {
    // خريطة: رقم العمود -> تاريخ ISO (رأس التواريخ الحالي الفعّال)
    let currentDateHeader = null;

    worksheet.eachRow({ includeEmpty: false }, row => {
      // 1) هل هذا الصف "رأس تواريخ" جديد؟ (3 خلايا أو أكتر تواريخ فعلية)
      const rowDateMap = {};
      let dateHits = 0;
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const iso = cellToIsoDate(cell);
        if (iso) {
          rowDateMap[colNumber] = iso;
          dateHits++;
        }
      });

      if (dateHits >= 3) {
        currentDateHeader = rowDateMap;
        datesCount += dateHits;
        return; // هذا الصف نفسه رأس، مش صف بيانات فريق
      }

      if (!currentDateHeader) return; // لسه ملقيناش أي رأس تواريخ

      // 2) هل أول خلية (أو من أول 3 خلايا) في الصف ده اسم فريق؟
      let teamKey = null;
      const firstCells = [];
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        if (colNumber <= 3) firstCells.push(cellToText(cell));
      });
      for (const txt of firstCells) {
        teamKey = normalizeTeamKey(txt);
        if (teamKey) break;
      }
      if (!teamKey) return; // صف مش خاص بفريق معروف (تجاهل بأمان)

      // 3) اقرأ الأكواد لكل عمود موجود في رأس التواريخ الحالي
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const dateStr = currentDateHeader[colNumber];
        if (!dateStr) return;
        const rawText = cellToText(cell);
        const code = normalizeCode(rawText);
        if (code) {
          teams[teamKey][dateStr] = code;
        } else if (rawText.trim()) {
          warnings.push(`تعذر التعرف على الكود "${rawText}" (${teamKey}, ${dateStr})`);
        }
      });
    });
  });

  return { teams, datesCount, warnings };
}

/**
 * قراءة ملف Excel من input[type=file] وإرجاع النتيجة المُحلَّلة
 * @param {File} file
 */
export async function parsePatternFile(file) {
  if (typeof window === "undefined" || typeof window.ExcelJS === "undefined") {
    throw new Error("مكتبة ExcelJS غير محمّلة حالياً، تأكد من الاتصال بالإنترنت وأعد المحاولة.");
  }
  const buffer = await file.arrayBuffer();
  const workbook = new window.ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const result = parsePatternWorkbook(workbook);

  if (result.datesCount === 0) {
    throw new Error("لم يتم العثور على أي تواريخ فعلية داخل الملف. تأكد أن صفوف رأس التواريخ منسّقة كتاريخ Excel حقيقي.");
  }
  const totalCodes =
    Object.keys(result.teams.green).length +
    Object.keys(result.teams.blue).length +
    Object.keys(result.teams.red).length;
  if (totalCodes === 0) {
    throw new Error("تم العثور على تواريخ لكن لم يتم التعرف على أي صفوف فرق (GREEN/BLUE/RED) بأكواد M/N/OFF صالحة.");
  }

  return result;
}
