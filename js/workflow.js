// js/workflow.js
const WorkflowModule = {
  // التحقق من الصلاحيات للإجراء المحدد
  canPerformAction: (action, role) => {
    const permissions = {
      approve_ticket: ['maint_eng', 'admin'],
      assign_tech: ['maint_eng', 'admin'],
      convert_to_pm: ['maint_eng', 'admin'],
      start_fix: ['maint_tech', 'admin'],
      review_qc: ['qc', 'admin'],
      close_ticket: ['qc', 'maint_eng', 'admin']
    };
    return permissions[action]?.includes(role) || false;
  },

  // تغيير حالة البلاغ
  transitionStatus: async (ticketId, nextStatus, payload = {}) => {
    const role = localStorage.getItem('role');
    
    try {
      const response = await fetch(CONFIG.GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'updateTicketStatus',
          ticketId,
          status: nextStatus,
          updatedBy: localStorage.getItem('name'),
          role,
          ...payload
        })
      });
      return await response.json();
    } catch (e) {
      console.error('Workflow error', e);
      return { status: 'error' };
    }
  }
};