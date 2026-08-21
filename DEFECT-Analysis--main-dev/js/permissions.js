// ============================================================
// permissions.js
// نظام الصلاحيات الموحد
// (تم استخراجه من router.js دون أي تغيير في السلوك - نفس
// المتغيرات ونفس منطق hasPermission تماماً)
// ============================================================

let currentRole =
  (localStorage.getItem("role") || "")
    .toLowerCase();

let currentPermissions =
  (localStorage.getItem("permissions") || "")
    .split(",")
    .map(p => p.trim().toLowerCase())
    .filter(Boolean);

// ============================================================
// قراءة/تحديث الحالة (من أجل authHandlers.js عند تسجيل
// الدخول/الخروج، بما أن currentRole/currentPermissions أصبحا
// الآن داخل هذا الموديول فقط)
// ============================================================

export function getCurrentRole() {
  return currentRole;
}

export function getCurrentPermissions() {
  return currentPermissions;
}

export function setCurrentRole(role) {
  currentRole = role;
}

export function setCurrentPermissions(permissions) {
  currentPermissions = permissions;
}

// ============================================================
// التحقق من الصلاحية
// ============================================================

export function hasPermission(permission) {

  const perm =
    String(permission || "")
      .trim()
      .toLowerCase();

  if (!perm) return false;

  // Admin لديه جميع الصلاحيات
  if (currentRole === "admin") {
    return true;
  }

  // all = جميع الصلاحيات
  if (currentPermissions.includes("all")) {
    return true;
  }

  return currentPermissions.includes(perm);
}

window.hasPermission = hasPermission;
window.can = hasPermission;

// ============================================================
// أزرار دورة حياة التذكرة (Ticket Lifecycle Actions)
// ============================================================
//
// دالة واحدة مركزية بتقرر "مين يقدر يعمل إيه" حسب حالة التذكرة
// ودور المستخدم الحالي - تُستخدم في ticketsBoard.js لعرض الأزرار
// الصحيحة فقط لكل تذكرة.
// ============================================================

export function getTicketActions(ticket) {

  const role = currentRole;
  const myName = localStorage.getItem("name") || "";
  const myUid = localStorage.getItem("userId") || "";
  const status = String(ticket?.status || "").trim().toLowerCase();

  const actions = [];

  // العلاقة الفعلية بالبلاغ (مش اسم الدور المخزّن) - عشان لو
  // المستخدم هو المُبلّغ والفني المُسند إليه لنفس البلاغ مع بعض،
  // تتجمع صلاحيات الدورين بدون تعارض (كل حالة بتاعة تذكرة أصلاً
  // بتفتح مجموعة أزرار واحدة بس - مفيش تعارض ممكن يحصل)
  const isAssignee =
    role === "admin" ||
    ticket.assignedToUid === myUid ||
    (!!myName && ticket.assignedTo === myName);

  const isReporter =
    role === "admin" ||
    ticket.reportedByUid === myUid ||
    (!!myName && ticket.reportedBy === myName);

  switch (status) {

    case "pending":
      // تصنيف وإسناد البلاغ - صلاحية إدارية بحتة (مدير/أدمن)، مش
      // جزء من ثنائية مُبلّغ/فني
      if (role === "manager" || role === "admin") {
        actions.push({ key: "assign", label: "🛠️ تصنيف وإسناد" });
      }
      break;

    case "assigned":
      // الفني المُسند إليه فقط يقدر يبدأ التنفيذ
      if (isAssignee) {
        actions.push({ key: "start", label: "▶️ بدء التنفيذ" });
      }
      break;

    case "in_progress":
      // الفني المُسند إليه فقط يقدر ينهي المعالجة (لا يقدر يغلق
      // البلاغ نيابة عن المُبلّغ - ده بيحوّل الحالة لـ "resolved"
      // بانتظار مراجعة المُبلّغ بس)
      if (isAssignee) {
        actions.push({ key: "resolve", label: "✅ تم الإصلاح" });
      }
      break;

    case "resolved":
      // المُبلّغ فقط (بعد ما الفني ينهي المعالجة) يقدر يراجع
      // ويأكّد الإغلاق أو يرفض مع سبب - المُبلّغ محدش غيره يقدر
      // يغلق البلاغ قبل ما الفني يخلص
      if (isReporter) {
        actions.push({ key: "confirm", label: "✔️ تأكيد الإغلاق" });
        actions.push({ key: "reject", label: "❌ رفض ورجوع للفني" });
      }
      break;

    // "closed" حالة نهائية - بدون أزرار تغيير حالة
  }

  // زر "تفاصيل" متاح دايماً لأي حد يقدر يشوف التذكرة أصلاً (تايملاين + صور)
  actions.push({ key: "details", label: "🔍 تفاصيل" });

  return actions;

}

window.getTicketActions = getTicketActions;
