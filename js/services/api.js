// ============================================================
// api.js
// نقطة الدخول المركزية لطبقة الـ API (Barrel / Re-export)
// ============================================================
//
// كان هذا الملف قبل التحديث بيحتوي كل دوال الاتصال بـ Firestore
// في ملف واحد (حوالي 1400 سطر)، وده كان بيصعّب القراءة والصيانة.
//
// تم تقسيمه لملفات أصغر حسب الموضوع، بنفس أسلوب تقسيم router.js:
//
//   imageUpload.js      → رفع الصور على ImgBB
//   usersApi.js          → المستخدمون (جلب/تسجيل/صلاحيات/حالة/حذف)
//   defectsApi.js        → بلاغات عيوب الإنتاج
//   ticketsApi.js         → بلاغات الأعطال (Tickets/Issues)
//   dashboardApi.js       → بيانات لوحة المتابعة
//   machineErrorsApi.js  → قاعدة معرفة أعطال الماكينات + قاعدة المعرفة
//   pmApi.js              → الصيانة الوقائية (PM)
//   suggestionsApi.js    → مقترحات الكايزن
//
// هذا الملف بيُعيد تصدير كل الدوال بنفس الأسماء بالظبط، فأي ملف
// تاني في المشروع بيستورد من "services/api.js" هيفضل شغال بدون
// أي تعديل مطلوب فيه.
// ============================================================

export { uploadBase64Image } from "./imageUpload.js";

export {
  fetchUsers,
  registerUserApi,
  updatePermissionsApi,
  updateUserStatusApi,
  deleteUserApi,
  fetchTechniciansApi
} from "./usersApi.js";

export { saveDefectApi } from "./defectsApi.js";

export {
  saveIssueApi,
  fetchTicketsApi,
  updateTicketStatusApi,
  fetchPendingTicketsApi,
  fetchTicketsForTechnicianApi,
  fetchResolvedTicketsApi,
  subscribeToTicketsBoardApi,
  assignTicketApi,
  startTicketApi,
  resolveTicketApi,
  closeTicketApi,
  reopenTicketApi,
  fetchTicketLogsApi,
  fetchTicketByIdApi,
  fetchTicketsForReportApi,
  fetchMyNotificationsApi,
  subscribeToMyNotificationsApi,
  markNotificationReadApi,
  markAllNotificationsAsRead,
  syncOfflineTicketsApi
} from "./ticketsApi.js";

export { fetchDashboardDataApi } from "./dashboardApi.js";

export {
  findMachineErrorByCode,
  saveMachineErrorApi,
  verifyMachineErrorApi,
  logMachineErrorOccurrenceApi,
  fetchMachineErrorHistoryApi,
  fetchAllMachineErrorsApi,
  fetchMachineErrorLogsSinceApi
} from "./machineErrorsApi.js";

export { savePmApi, fetchPmRecordsApi } from "./pmApi.js";

export {
  saveSuggestionApi,
  subscribeToSuggestionsBoardApi,
  fetchSuggestionsForReportApi,
  reviewSuggestionApi,
  rejectSuggestionApi,
  requestSuggestionRevisionApi,
  returnSuggestionToReviewApi,
  resubmitSuggestionApi,
  assignAndApproveSuggestionApi,
  implementSuggestionApi,
  fetchSuggestionLogsApi
} from "./suggestionsApi.js";
