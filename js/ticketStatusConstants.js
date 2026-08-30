// ============================================================
// ticketStatusConstants.js
// مصدر واحد موحّد لثوابت "حالة البلاغ" (Ticket Status) - كانت
// مُعرّفة يدوياً بشكل مكرر في أكتر من ملف (workflow.js / statistics.js
// / services/ticketsApi.js / maintenanceSearch.js / ticketsBoard.js)،
// بعضها متطابق حرفياً (CLOSED_STATUSES) وبعضها نفس القصد لكن بتفاصيل
// عرض مختلفة (STATUS_CLASSES). أي تعديل مستقبلي (إضافة حالة جديدة،
// تغيير تسمية أو لون...) بقى في مكان واحد بس، بدل تكراره يدوياً في كل
// ملف على حدة ومخاطرة نسيان أحدهم (تعارض/عدم تطابق مستقبلي).
// ============================================================

// نفس تصنيف "الحالات المغلقة" المستخدم في:
// - كارتات لوحة المتابعة بالرئيسية (isClosedStatus في workflow.js)
// - صفحة الإحصائيات (statistics.js)
// - فلتر "تم إصلاحها" في البحث والفلترة المتقدمة وكارت الرئيسية
//   المقابل له (STATUS_QUERY_ALIASES.fixed في services/ticketsApi.js)
export const CLOSED_STATUSES = ['closed', 'resolved', 'done', 'مغلق', 'تم الإصلاح'];

// نفس فحص "هل الحالة دي مغلقة؟" المستخدم في workflow.js بالظبط
export function isClosedStatus(status) {
  return CLOSED_STATUSES.includes(String(status || '').trim().toLowerCase());
}

// تسميات حالات البلاغ بالعربي - نفس النصوص المستخدمة في كروت نتائج
// البحث والفلترة المتقدمة (maintenanceSearch.js) وتصدير PDF الخاص بيها
export const STATUS_LABELS = {
  pending: "جديد",
  assigned: "تم الإسناد",
  in_progress: "قيد التنفيذ",
  resolved: "بانتظار تأكيد المُبلغ",
  closed: "مغلقة",
  reopened: "قيد التنفيذ"
};

// كلاسات Tailwind لعرض حالة البلاغ - نسخة "خفيفة" مستخدمة في كروت
// نتائج البحث والفلترة المتقدمة (maintenanceSearch.js)
export const STATUS_CLASSES = {
  pending: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  assigned: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  in_progress: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
  resolved: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  closed: "bg-gray-500/10 text-gray-400 border border-gray-500/20",
  reopened: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
};

// نسخة "بارزة" من نفس كلاسات الحالة - مستخدمة في شارة الحالة الأكبر
// بلوحة متابعة دورة حياة التذكرة (ticketsBoard.js). القيم مختلفة عمداً
// عن STATUS_CLASSES (سياق عرض مختلف: شارة بارزة في لوحة كاملة مقابل
// كارت نتيجة مضغوط) - اتنقلت هنا كمان عشان تبقى كل ثوابت حالة البلاغ
// في مكان واحد بدل الانتشار بين الملفات، من غير ما نغيّر أي شكل ظاهري حالي
export const STATUS_CLASSES_BOARD = {
  pending: "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-black",
  assigned: "bg-blue-500/20 text-blue-300 border border-blue-500/40 font-black",
  in_progress: "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-black",
  resolved: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-black",
  closed: "bg-slate-700/60 text-slate-300 border border-slate-600 font-bold",
  reopened: "bg-purple-500/20 text-purple-300 border border-purple-500/40 font-black"
};

// ============================================================
// إضافة (تحسين Workflow - كارت "بلاغات متأخرة" في الرئيسية):
// حد "التأخير" بالساعات - أي بلاغ مفتوح (مش مغلق) عدّى عليه أكتر من
// الحد المناسب لأولويته من غير حل يتحسب "متأخر". قيمة واحدة هنا
// تتحكم في: حساب كارت الرئيسية (workflow.js)، وفلتر فتح البلاغات
// المتأخرة نفسها (services/ticketsApi.js)، وشارة "⏰ متأخر" على كارت
// التذكرة (ticketsBoard.js) - عشان يفضلوا متطابقين دايماً
//
// SLA متدرّج حسب الأولوية: بلاغ "High" (حرج) بيتحسب متأخر بعد وقت
// أقصر بكتير من بلاغ "Low" - نفس المنطق المتّبع في أي نظام صيانة
// صناعي حقيقي (عطل خط إنتاج كامل غير عطل بسيط في زاوية بعيدة).
// البلاغات من غير أولوية محددة أصلاً بتاخد الحد الافتراضي المتوسط
// ============================================================
export const OVERDUE_HOURS_BY_PRIORITY = {
  High: 4,
  Medium: 12,
  Low: 48
};
export const OVERDUE_HOURS_DEFAULT = 24; // للبلاغات من غير أولوية محددة

// الاسم القديم (متوافق مع أي كود لسه بيستخدمه) - بيرجع الحد
// الافتراضي بس؛ الاستخدام الصحيح دلوقتي هو getOverdueThresholdHours()
export const OVERDUE_HOURS_THRESHOLD = OVERDUE_HOURS_DEFAULT;

// حد "التأخير" بالساعات المناسب لأولوية بلاغ معيّن
export function getOverdueThresholdHours(priority) {
  return OVERDUE_HOURS_BY_PRIORITY[priority] ?? OVERDUE_HOURS_DEFAULT;
}

// نفس فحص "هل البلاغ ده متأخر؟" - مفتوح (مش مغلق) + عدّى عليه أكتر
// من حد التأخير المناسب لأولويته (getOverdueThresholdHours) من وقت
// الإبلاغ (createdAt)
export function isOverdueTicket(ticket, now = new Date()) {
  if (!ticket || isClosedStatus(ticket.status)) return false;
  if (!ticket.createdAt) return false;
  const created = new Date(ticket.createdAt);
  if (isNaN(created.getTime())) return false;
  const hoursOpen = (now - created) / (1000 * 60 * 60);
  return hoursOpen > getOverdueThresholdHours(ticket.priority);
}
