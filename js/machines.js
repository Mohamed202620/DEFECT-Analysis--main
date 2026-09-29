// ============================================================
// machines.js
// القائمة الموحّدة للماكينات المستخدمة في كل شاشات التطبيق (تسجيل
// بلاغ عطل / البحث والفلترة المتقدمة / مقترح كايزن / Machine Error Scanner)
// مع تطبيق فلترة صارمة وموثوقة حسب قسم المستخدم (Backend / Frontend).
// ============================================================

import {
  fetchMachineTypesApi,
  seedDefaultMachineTypesApi
} from "./services/machinesApi.js";

import { isAdminRole, getCurrentRole, hasFullDataAccess } from "./permissions.js";
import {
  normalizeDepartment,
  extractUserDepartment,
  extractMachineDepartment
} from "./utils/departmentUtils.js";

import {
  normalizeLine,
  formatLineLabel,
  extractMachineLine,
  normalizeDigits
} from "./utils/lineUtils.js";

export { normalizeDepartment, extractUserDepartment, extractMachineDepartment };
export { normalizeLine, formatLineLabel, extractMachineLine };

// توليد "01".."NN" (ترقيم بخانتين دايماً)
function padNumbers(count) {
  const list = [];
  for (let i = 1; i <= count; i++) list.push(String(i).padStart(2, "0"));
  return list;
}

// القائمة الافتراضية المصنفة بدقة للأقسام Frontend و Backend
export const DEFAULT_MACHINE_TYPES = [
  // Frontend
  { key: "Coil Handling", units: [], department: "frontend" },
  { key: "Baler", units: [], department: "frontend" },
  { key: "Cupper", units: [], department: "frontend" },
  { key: "Bodymaker", units: padNumbers(11), department: "frontend" },
  { key: "Trimmer", units: [], department: "frontend" },
  { key: "Washer", units: [], department: "frontend" },
  { key: "Front End Line Control", units: [], department: "frontend" },

  // Backend
  { key: "Decorator", units: padNumbers(2), department: "backend" },
  { key: "Spray", units: padNumbers(11), department: "backend" },
  { key: "IBO", units: [], department: "backend" },
  { key: "Necker", units: [], department: "backend" },
  { key: "Palletizer", units: [], department: "backend" },
  { key: "Depalletizer", units: [], department: "backend" },
  { key: "Mid Line Control", units: [], department: "backend" },
  { key: "Back End Line Control", units: [], department: "backend" },
  { key: "STRAP", units: ["A1", "A2", "B1", "B2"], department: "backend" }
];

// الكاش الحي للماكينات
let machineTypesCache = [];
let machineTypesLoaded = false;
let isFetchingMachines = false;

// إصلاح (سبب مباشر لـ"الماكينة غير موجودة"): loadMachineTypesFromFirestore
// كانت بترجع فوراً (return صامت) لو فيه تحميل شغّال بالفعل، فـ
// await عليها كان بيرجع قبل ما الكاش يتملي فعلياً - وأي بحث بعدها
// (زي البحث عن ماكينة الـQR) كان بيتم على القائمة الاحتياطية
// DEFAULT_MACHINE_TYPES مش على ماكينات Firestore الحقيقية. دلوقتي
// كل الاستدعاءات المتزامنة بتنتظر نفس عملية التحميل الجارية.
let machineTypesLoadPromise = null;

export function isMachineTypesLoaded() {
  return machineTypesLoaded;
}

/**
 * إعادة تعيين الكاش بالكامل (عند تسجيل الخروج أو تبديل الحساب)
 */
export function clearUserAndMachinesCache() {
  machineTypesCache = [];
  machineTypesLoaded = false;
  isFetchingMachines = false;
  machineTypesLoadPromise = null;
  refreshMachineOptionsExport();
}

/**
 * سياق المستخدم الحالي (role + machineDepartment) من Firestore أولاً ثم localStorage
 */
export function getCurrentUserMachineContext() {
  const role = getCurrentRole();
  const rawSavedDept = localStorage.getItem("machineDepartment") || "";
  const dept = normalizeDepartment(rawSavedDept);

  return {
    role,
    machineDepartment: dept,
    area: dept,
    department: dept
  };
}

window.getCurrentUserMachineContext = getCurrentUserMachineContext;

/**
 * فلترة الماكينات حسب صلاحيات وقسم المستخدم بدقة:
 * - Admin: يرى كل الماكينات.
 * - Backend user: يرى ماكينات Backend فقط.
 * - Frontend user: يرى ماكينات Frontend فقط.
 * - مستخدم بدون قسم أو غير معروف: يرى مصفوفة فارغة [] (لا يوجد fallback افتراضي).
 * - ماكينة بلا قسم: لا تظهر لأي فني.
 */
export function getMachinesForUser(user, allMachines) {
  const list = Array.isArray(allMachines) ? allMachines : [];
  if (!user || typeof user !== "object") return [];

  const role = String(user.role || "").trim().toLowerCase();
  if (isAdminRole(role) || hasFullDataAccess(role)) {
    return list;
  }

  const userDept = extractUserDepartment(user);
  if (!userDept) {
    return [];
  }

  return list.filter(m => extractMachineDepartment(m) === userDept);
}

/**
 * تحميل قائمة أنواع الماكينات من Firestore
 */
export async function loadMachineTypesFromFirestore(force = false) {
  if (machineTypesLoadPromise && !force) return machineTypesLoadPromise;

  machineTypesLoadPromise = doLoadMachineTypesFromFirestore().finally(() => {
    machineTypesLoadPromise = null;
  });

  return machineTypesLoadPromise;
}

async function doLoadMachineTypesFromFirestore() {
  isFetchingMachines = true;

  try {
    const userContext = getCurrentUserMachineContext();
    const isAdmin = isAdminRole(userContext.role) || hasFullDataAccess(userContext.role);
    const userDept = extractUserDepartment(userContext);

    // إذا لم يكن المستخدم أدمن، نطلب من Firestore مباشرة استعلام مفلتر لقسمه
    const filterDept = isAdmin ? null : (userDept || null);

    let result = await fetchMachineTypesApi(filterDept);

    if (result.status === "success" && result.data.length === 0 && isAdmin) {
      // أول تشغيل: زرع القائمة الافتراضية إذا كانت المجموعة فارغة
      await seedDefaultMachineTypesApi(DEFAULT_MACHINE_TYPES);
      result = await fetchMachineTypesApi(null);
    }

    if (result.status === "success") {
      machineTypesCache = result.data.map(m => ({
        key: m.key,
        units: m.units || [],
        active: m.active !== false,
        department: extractMachineDepartment(m),
        // خط الإنتاج المرتبط بالماكينة ("1" / "2" / "") - نفس الحقل
        // المستخدم في باقي التطبيق (راجع utils/lineUtils.js)
        line: extractMachineLine(m),
        id: m.id,
        order: typeof m.order === "number" ? m.order : 0
      }));
      machineTypesLoaded = true;
      refreshMachineOptionsExport();
      refreshActiveMachineDropdowns();
    }
  } catch (error) {
    console.error("Error loading machine types from Firestore:", error);
  } finally {
    isFetchingMachines = false;
  }
}

/**
 * إعادة تحميل الكاش من Firestore
 */
export async function refreshMachineTypesCache() {
  machineTypesLoaded = false;
  await loadMachineTypesFromFirestore(true);
}

/**
 * التأكد من تحميل بيانات المستخدم من Firestore ثم تحميل الماكينات المناسبة
 */
export async function ensureUserAndMachinesLoaded(force = false) {
  try {
    const { fetchCurrentUserProfileApi } = await import("./services/usersApi.js");
    await fetchCurrentUserProfileApi(force);
  } catch (err) {
    console.warn("Could not sync user profile from Firestore:", err);
  }

  await loadMachineTypesFromFirestore(force);
}

window.ensureUserAndMachinesLoaded = ensureUserAndMachinesLoaded;

/**
 * نقطة الوصول المركزية للماكينات المعروضة
 */
export function getMachineTypeEntries({ includeInactive = true, filterByUserDepartment = true } = {}) {
  // إذا لم يتم التحميل بعد، نستخدم قائمة الـ fallback الافتراضية مؤقتاً
  const sourceList = (machineTypesLoaded || machineTypesCache.length)
    ? machineTypesCache
    : DEFAULT_MACHINE_TYPES.map(m => ({ ...m, active: true }));

  const base = includeInactive
    ? sourceList
    : sourceList.filter(m => m.active !== false);

  if (!filterByUserDepartment) {
    return base;
  }

  return getMachinesForUser(getCurrentUserMachineContext(), base);
}

// نسخة مسطّحة (بدون تقسيم)
export let MACHINE_OPTIONS = buildFlatOptions();

function buildFlatOptions() {
  const visible = getMachineTypeEntries({ includeInactive: false });
  return visible.flatMap(m => (m.units && m.units.length ? m.units.map(u => `${m.key} ${u}`) : [m.key]));
}

function refreshMachineOptionsExport() {
  MACHINE_OPTIONS = buildFlatOptions();
}

export function getMachineUnits(typeKey) {
  const source = machineTypesCache.length ? machineTypesCache : DEFAULT_MACHINE_TYPES;
  const entry = source.find(m => m.key === typeKey);
  return entry && entry.units && entry.units.length ? entry.units : null;
}

// ============================================================
// البحث عن الماكينة (Machine Lookup) - مصدر الحقيقة الموحّد
//
// ده المسار اللي بيستخدمه كل التطبيق (فورمات البلاغات/الكايزن/
// الفحص اليومي/5S) وكمان مسح الـQR - نفس الدالة بالظبط، مفيش
// منطق بحث منفصل للـQR.
//
// المطابقة متسامحة مع الفروق الشكلية اللي متغيّرش هوية الماكينة
// (حالة الأحرف، المسافات المتكررة، الشرطة بدل المسافة، صفر
// البادئة في رقم الوحدة "1" مقابل "01"، الأرقام العربية) - لأن
// الـQR ممكن يكون متطبوع من مصدر قديم أو مكتوب يدوياً بصيغة
// مختلفة شوية عن المخزّن في Firestore. أي اختلاف غير كده =
// ماكينة غير موجودة فعلاً.
// ============================================================

function canonicalToken(value) {
  return normalizeDigits(value)
    .replace(/[_\-–—]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function canonicalUnitToken(value) {
  const token = canonicalToken(value);
  // "01" و "1" نفس الوحدة
  return /^[0-9]+$/.test(token) ? String(parseInt(token, 10)) : token;
}

/**
 * كل الماكينات المعروفة (بدون أي فلترة صلاحيات) - الكاش المحمّل
 * من Firestore، وإلا القائمة الافتراضية كاحتياطي.
 */
function getAllKnownMachineTypes() {
  return machineTypesCache.length ? machineTypesCache : DEFAULT_MACHINE_TYPES;
}

/**
 * إيجاد مستند/عنصر الماكينة المطابق لقيمة نصية.
 * @param {string} fullValue
 * @returns {{ entry: Object, unit: string } | null}
 */
export function findMachineEntryByValue(fullValue) {
  const raw = String(fullValue == null ? "" : fullValue).trim();
  if (!raw) return null;

  const source = getAllKnownMachineTypes();
  const target = canonicalToken(raw);
  if (!target) return null;

  // 1) مطابقة بمعرّف مستند Firestore (QR بصيغة "MID:<docId>")
  const byId = source.find(m => m.id && String(m.id).trim() === raw);
  if (byId) return { entry: byId, unit: "" };

  // 2) مطابقة كاملة "النوع + الوحدة" أو "النوع" لوحده
  for (const m of source) {
    const keyToken = canonicalToken(m.key);
    if (!keyToken) continue;

    const units = Array.isArray(m.units) ? m.units : [];
    for (const u of units) {
      if (canonicalToken(`${m.key} ${u}`) === target) {
        return { entry: m, unit: u };
      }
    }

    if (keyToken === target) return { entry: m, unit: "" };
  }

  // 3) نفس النوع مع اختلاف شكلي في رقم الوحدة فقط ("Bodymaker 1"
  //    مقابل "Bodymaker 01") - بنقبلها فقط لو الوحدة موجودة فعلاً
  //    ضمن وحدات النوع المسجّلة، مش أي رقم عشوائي.
  for (const m of source) {
    const units = Array.isArray(m.units) ? m.units : [];
    if (!units.length) continue;

    const keyToken = canonicalToken(m.key);
    if (!keyToken || !target.startsWith(keyToken + " ")) continue;

    const rest = target.slice(keyToken.length + 1).trim();
    const matchedUnit = units.find(u => canonicalUnitToken(u) === canonicalUnitToken(rest));
    if (matchedUnit) return { entry: m, unit: matchedUnit };
  }

  return null;
}

/**
 * حل قيمة ماكينة بالكامل: وجودها فعلياً + قسمها + خط إنتاجها +
 * صيغتها المعيارية المستخدمة في كل التطبيق.
 *
 * ملاحظة مهمة: "found" هنا بتعبّر عن وجود الماكينة فقط - مش عن
 * صلاحية المستخدم. الصلاحية بتتفحص بشكل منفصل وصريح في الشاشات
 * (راجع QrScannerView.js / MachineProfileView.js).
 *
 * @param {string} fullValue
 * @returns {{ found: boolean, value: string, key: string, unit: string,
 *             department: string, line: string, id: string, active: boolean }}
 */
export function resolveMachineFromValue(fullValue) {
  const raw = String(fullValue == null ? "" : fullValue).trim();
  const found = findMachineEntryByValue(raw);

  if (!found) {
    return {
      found: false,
      value: raw,
      key: "",
      unit: "",
      department: "",
      line: "",
      id: "",
      active: true
    };
  }

  const { entry, unit } = found;

  return {
    found: true,
    // الصيغة المعيارية زي ما القوائم المنسدلة بتنتجها بالظبط، عشان
    // أي حفظ/بحث لاحق (checklists/tickets) يطابق السجلات الموجودة
    value: unit ? `${entry.key} ${unit}` : entry.key,
    key: entry.key,
    unit,
    department: extractMachineDepartment(entry),
    line: extractMachineLine(entry),
    id: entry.id || "",
    active: entry.active !== false
  };
}

window.resolveMachineFromValue = resolveMachineFromValue;

// إصلاح (بند مؤكد بالاختبار العملي - Test 5، مسح QR): كتالوج
// الماكينات المحمّل محلياً لغير الأدمن/غير أصحاب الوصول الكامل
// (machineTypesCache) مفلتر من الأساس على قسم المستخدم فقط (راجع
// doLoadMachineTypesFromFirestore فوق: filterDept = userDept)، وهذا
// صحيح ومطلوب لباقي شاشات التطبيق (القوائم المنسدلة). لكن هذا يعني
// إن resolveMachineFromValue/findMachineEntryByValue - اللي بتبحث في
// نفس هذا الكاش المفلتر - مستحيل تلاقي ماكينة من قسم تاني أصلاً،
// فكانت شاشة مسح QR (QrScannerView.js) بتعرض "❌ الماكينة غير موجودة"
// لأي QR صحيح لماكينة قسم تاني، بدل الرسالة الصحيحة المقصودة أصلاً
// في تعليقات نفس الملف: "🔒 لا توجد صلاحية". القرار الأمني نفسه سليم
// 100% في الحالتين (منع الوصول فعلياً) - المشكلة في دقة الرسالة بس.
// هذه الدالة بديلة، بتُستخدم فقط في هذا المسار الضيّق (مسح/إدخال QR)
// لما resolveMachineFromValue ما تلاقيش الماكينة في الكاش المفلتر:
// بتعمل قراءة إضافية غير مفلترة (مسموحة لأي مستخدم مفعّل - راجع
// firestore.rules: machineTypes.read) للتأكد هل القيمة موجودة في أي
// قسم تاني فعلاً، بدون أي تعديل على machineTypesCache المشترك أو أي
// شاشة تانية في التطبيق (Dropdown القوائم يفضل مفلتر زي ما هو تماماً).
export async function machineExistsInAnyDepartment(fullValue) {
  const raw = String(fullValue == null ? "" : fullValue).trim();
  const target = canonicalToken(raw);
  if (!target) return false;

  try {
    const result = await fetchMachineTypesApi(null);
    if (result.status !== "success") return false;

    if (result.data.some(m => m.id && String(m.id).trim() === raw)) return true;

    for (const m of result.data) {
      const keyToken = canonicalToken(m.key);
      if (!keyToken) continue;

      const units = Array.isArray(m.units) ? m.units : [];
      for (const u of units) {
        if (canonicalToken(`${m.key} ${u}`) === target) return true;
      }
      if (keyToken === target) return true;

      if (units.length && target.startsWith(keyToken + " ")) {
        const rest = target.slice(keyToken.length + 1).trim();
        if (units.some(u => canonicalUnitToken(u) === canonicalUnitToken(rest))) return true;
      }
    }
  } catch (err) {
    console.warn("machineExistsInAnyDepartment: lookup failed", err);
  }

  return false;
}

export function parseMachineValue(fullValue) {
  if (!fullValue) return { type: "", unit: "" };
  const found = findMachineEntryByValue(fullValue);
  if (found) return { type: found.entry.key, unit: found.unit };
  return { type: fullValue, unit: "" };
}

export function getDepartmentForMachineValue(fullValue) {
  if (!fullValue) return "";
  return resolveMachineFromValue(fullValue).department;
}

/**
 * خط الإنتاج المرتبط بالماكينة ("1" / "2" / "")
 */
export function getLineForMachineValue(fullValue) {
  if (!fullValue) return "";
  return resolveMachineFromValue(fullValue).line;
}

/**
 * التأكد إن قائمة الماكينات الحقيقية اتحمّلت من Firestore قبل أي
 * عملية بحث حاسمة (زي مسح QR) - بدل الاعتماد على القائمة
 * الاحتياطية الافتراضية اللي مش بتحتوي الماكينات المضافة يدوياً.
 */
export async function ensureMachineCatalogReady(force = false) {
  if (!force && machineTypesLoaded && machineTypesCache.length) return true;

  try {
    await ensureUserAndMachinesLoaded(force);
  } catch (err) {
    console.warn("Could not ensure machine catalog is ready:", err);
  }

  return machineTypesLoaded;
}

const DEFAULT_SELECT_CLASS =
  "w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white outline-none focus:border-blue-500 transition text-sm appearance-none shadow-sm";

/**
 * توليد HTML لـ Dropdown الماكينات مع التحقق الكامل من الصلاحية والقسم
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
  const currentLang = window.currentLang || "ar";
  const isEn = currentLang === "en";

  const userContext = getCurrentUserMachineContext();
  const role = userContext.role;
  const isAdmin = isAdminRole(role) || hasFullDataAccess(role);
  const userDept = extractUserDepartment(userContext);

  const savedUid = localStorage.getItem("userId");

  // 1. عدم وجود جلسة مستخدم مسجل
  if (!savedUid && !role) {
    const msg = isEn
      ? "User data unavailable. Please log in again."
      : "بيانات المستخدم غير متوفرة. يرجى تسجيل الدخول مجددًا.";
    return `
      <select id="${baseId}Type" class="${typeSelectClass}" disabled>
        <option value="" selected>${msg}</option>
      </select>
      <select id="${baseId}Unit" class="${unitSelectClass} hidden"></select>
      <input type="hidden" id="${baseId}" value="">
    `;
  }

  // 2. مستخدم غير مسؤول ولم يُحدد له قسم عمل (Backend / Frontend)
  if (!isAdmin && !userDept) {
    const msg = isEn
      ? "Your work area (Backend / Frontend) is not assigned. Please contact administrator."
      : "لم يتم تحديد قسم العمل (Backend / Frontend) لحسابك. برجاء التواصل مع مسؤول النظام.";
    return `
      <select id="${baseId}Type" class="${typeSelectClass}" disabled>
        <option value="" selected>${msg}</option>
      </select>
      <select id="${baseId}Unit" class="${unitSelectClass} hidden"></select>
      <input type="hidden" id="${baseId}" value="">
    `;
  }

  // 3. جلب الماكينات المفلترة
  const visibleTypes = getMachineTypeEntries({ includeInactive: includeInactiveTypes });

  // 4. لا توجد ماكينات متاحة للقسم
  if (visibleTypes.length === 0) {
    const deptUpper = userDept ? userDept.toUpperCase() : "";
    const msg = isEn
      ? (deptUpper ? `No machines available for ${deptUpper} department.` : "No machines available for your work area.")
      : (deptUpper ? `لا توجد ماكينات متاحة لقسم (${deptUpper}) حاليًا.` : "لا توجد ماكينات متاحة ضمن قسمك الحالي.");
    return `
      <select id="${baseId}Type" class="${typeSelectClass}" disabled>
        <option value="" selected>${msg}</option>
      </select>
      <select id="${baseId}Unit" class="${unitSelectClass} hidden"></select>
      <input type="hidden" id="${baseId}" value="">
    `;
  }

  // 5. بناء قائمة الاختيار المفلترة
  const { type: selectedType, unit: selectedUnit } = parseMachineValue(selectedValue);
  const unitsForSelectedType = selectedType ? getMachineUnits(selectedType) : null;
  const showUnitInitially = !!(unitsForSelectedType && unitsForSelectedType.length);

  const placeholderHtml = includePlaceholder
    ? `<option value="" disabled ${selectedType ? "" : "selected"}>${placeholderLabel}</option>`
    : "";

  const allHtml = includeAll
    ? `<option value="${allValue}" ${selectedType === allValue ? "selected" : ""}>${allLabel}</option>`
    : "";

  const typesHtml = visibleTypes.map(m =>
    `<option value="${m.key}" ${m.key === selectedType ? "selected" : ""}>${m.key}${m.active === false ? (isEn ? " (Inactive)" : " (معطّل)") : ""}</option>`
  ).join("");

  const unitOptionsHtml = showUnitInitially
    ? `<option value="" disabled ${selectedUnit ? "" : "selected"}>${unitPlaceholderLabel}</option>` +
      unitsForSelectedType.map(u =>
        `<option value="${u}" ${u === selectedUnit ? "selected" : ""}>${u}</option>`
      ).join("")
    : "";

  const hiddenValue = showUnitInitially
    ? (selectedUnit ? selectedValue : "")
    : selectedValue;

  const onchangeAttr = hiddenOnChange ? ` onchange="${hiddenOnChange}"` : "";
  const typeRequiredAttr = includePlaceholder ? " required" : "";

  return `
    <select id="${baseId}Type" class="${typeSelectClass}"${typeRequiredAttr} onchange="window.__onMachineTypeChange('${baseId}')" data-machine-dept="${userDept || 'all'}">
      ${placeholderHtml}${allHtml}${typesHtml}${extraTypeOptionsHtml}
    </select>
    <select id="${baseId}Unit" class="${unitSelectClass} ${showUnitInitially ? "" : "hidden"}" onchange="window.__onMachineUnitChange('${baseId}')">
      ${unitOptionsHtml}
    </select>
    <input type="hidden" id="${baseId}" value="${hiddenValue}"${onchangeAttr}>
  `;
}

/**
 * تحديث القوائم المعروضة في DOM فور اكتمال الجلب
 */
function refreshActiveMachineDropdowns() {
  // إصلاح: قائمة الاختيار اليدوي للماكينة في شاشة مسح QR
  // (QrScannerView.js -> baseId="qrManualMachine") كانت غير مُدرجة
  // هنا، فكانت الأقسام الأخرى (issueMachine/suggestionMachine/
  // pmMachine/machineTypeSelect) بتتحدّث تلقائياً وتتفعّل بمجرد
  // اكتمال تحميل قائمة الماكينات الفعلية من Firestore، بينما القائمة
  // اليدوية في QR كانت تفضل عالقة على حالتها الأولى (المعطّلة أو
  // القائمة الاحتياطية الافتراضية DEFAULT_MACHINE_TYPES) لو المستخدم
  // فتح صفحة QR قبل اكتمال التحميل - نفس المسار المفروض يتصرف بنفس
  // سياق باقي فورمات التطبيق بالظبط.
  const dropdownBases = ["issueMachine", "suggestionMachine", "pmMachine", "machineTypeSelect", "qrManualMachine", "qrGenMachine"];
  for (const base of dropdownBases) {
    const typeSelect = document.getElementById(base + "Type") || (base === "machineTypeSelect" ? document.getElementById("machineTypeSelect") : null);
    if (!typeSelect) continue;

    const visibleTypes = getMachineTypeEntries({ includeInactive: false });
    const userContext = getCurrentUserMachineContext();
    const isAdmin = isAdminRole(userContext.role) || hasFullDataAccess(userContext.role);
    const userDept = extractUserDepartment(userContext);

    if (!isAdmin && !userDept) continue;

    if (visibleTypes.length > 0 && typeSelect.disabled) {
      typeSelect.disabled = false;
      const currentLang = window.currentLang || "ar";
      const isEn = currentLang === "en";
      typeSelect.innerHTML =
        `<option value="" disabled selected>${isEn ? 'Select machine type...' : 'اختر نوع الماكينة...'}</option>` +
        visibleTypes.map(m => `<option value="${m.key}">${m.key}</option>`).join("");
    }
  }
}

window.__onMachineTypeChange = function (baseId) {
  const typeSel = document.getElementById(baseId + "Type");
  const unitSel = document.getElementById(baseId + "Unit");
  const hidden = document.getElementById(baseId);
  if (!typeSel || !hidden) return;

  const type = typeSel.value;
  const units = getMachineUnits(type);

  if (unitSel) {
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
  } else {
    setMachineHiddenValue(hidden, type || "");
  }
};

window.__onMachineUnitChange = function (baseId) {
  const typeSel = document.getElementById(baseId + "Type");
  const unitSel = document.getElementById(baseId + "Unit");
  const hidden = document.getElementById(baseId);
  if (!typeSel || !unitSel || !hidden) return;

  setMachineHiddenValue(hidden, unitSel.value ? `${typeSel.value} ${unitSel.value}` : "");
};

function setMachineHiddenValue(hiddenInput, value) {
  hiddenInput.value = value;
  hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
}
