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
  fetchTicketCountsApi,
  updateTicketStatusApi,
  fetchPendingTicketsApi,
  fetchTicketsForTechnicianApi,
  fetchResolvedTicketsApi,
  subscribeToTicketsBoardApi,
  assignTicketApi,
  reassignTicketApi,
  startTicketApi,
  resolveTicketApi,
  closeTicketApi,
  bulkCloseTicketsApi,
  reopenTicketApi,
  fetchTicketLogsApi,
  fetchTicketByIdApi,
  fetchTicketsForReportApi,
  fetchTicketsForSearchApi,
  fetchMyNotificationsApi,
  subscribeToMyNotificationsApi,
  markNotificationReadApi,
  markAllNotificationsAsRead,
  syncOfflineTicketsApi,
  syncOfflineTicketActionsApi
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

export { savePmApi, fetchPmRecordsApi, fetchPmRecordsForSearchApi } from "./pmApi.js";

export {
  saveSuggestionApi,
  subscribeToSuggestionsBoardApi,
  fetchSuggestionsForReportApi,
  fetchSuggestionsForSearchApi,
  reviewSuggestionApi,
  rejectSuggestionApi,
  requestSuggestionRevisionApi,
  returnSuggestionToReviewApi,
  resubmitSuggestionApi,
  assignAndApproveSuggestionApi,
  implementSuggestionApi,
  fetchSuggestionLogsApi
} from "./suggestionsApi.js";

export {
  fetchOfficialHolidaysApi,
  addOfficialHolidayApi,
  deleteOfficialHolidayApi
} from "./holidaysApi.js";

// مقترحات الكايزن الموثّقة (Kaizen Completion Sheet) - مجموعة
// "kaizens" مستقلة تماماً عن "suggestions" (راجع kaizensApi.js)
export {
  KAIZEN_MGMT_STATUSES,
  fetchKaizensApi,
  fetchKaizenByIdApi,
  addKaizenApi,
  updateKaizenStatusApi
} from "./kaizensApi.js";

export {
  fetchMachineTypesApi,
  addMachineTypeApi,
  updateMachineTypeApi,
  setMachineTypeActiveApi,
  deleteMachineTypeApi,
  seedDefaultMachineTypesApi
} from "./machinesApi.js";


