// ============================================================
// departmentUtils.js
// دوال معالجة وتطبيع قسم العمل (Backend / Frontend)
// مصدر موحّد ودقيق لمنع أي أخطاء أو افتراضات غير دقيقة للأقسام
// ============================================================

/**
 * تطبيع قيمة القسم إلى backend أو frontend فقط.
 * في حال كانت القيمة غير محددة أو غير صالحة (مثل Production أو null)،
 * تُرجع الدالة سلسلة فارغة "" بدلاً من فرض افتراض خاطئ كـ backend.
 *
 * @param {*} value
 * @returns {"backend" | "frontend" | ""}
 */
export function normalizeDepartment(value) {
  if (value == null) return "";
  const str = String(value).trim().toLowerCase();
  
  if (
    str === "backend" ||
    str === "back-end" ||
    str === "back_end" ||
    str === "back end" ||
    str === "باك اند" ||
    str === "باك إند" ||
    str === "خلفي"
  ) {
    return "backend";
  }

  if (
    str === "frontend" ||
    str === "front-end" ||
    str === "front_end" ||
    str === "front end" ||
    str === "فرونت اند" ||
    str === "فرونت إند" ||
    str === "أمامي"
  ) {
    return "frontend";
  }

  return "";
}

/**
 * استخراج القسم المخصص للمستخدم من بياناته بمرونة وأمان.
 * يبحث في جميع الحقول المحتملة في Firestore:
 * machineDepartment, area, workArea, machine_department, userDepartment, department
 *
 * @param {Object} user
 * @returns {"backend" | "frontend" | ""}
 */
export function extractUserDepartment(user) {
  if (!user || typeof user !== "object") return "";

  const candidateFields = [
    user.machineDepartment,
    user.area,
    user.workArea,
    user.machine_department,
    user.userDepartment,
    user.department
  ];

  for (const candidate of candidateFields) {
    const normalized = normalizeDepartment(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

/**
 * استخراج القسم المخصص للماكينة من بياناتها في Firestore أو الكاش.
 *
 * @param {Object|string} machine
 * @returns {"backend" | "frontend" | ""}
 */
export function extractMachineDepartment(machine) {
  if (!machine) return "";
  if (typeof machine === "string") return normalizeDepartment(machine);

  const candidateFields = [
    machine.department,
    machine.machineDepartment,
    machine.area,
    machine.workArea,
    machine.dept
  ];

  for (const candidate of candidateFields) {
    const normalized = normalizeDepartment(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return "";
}
