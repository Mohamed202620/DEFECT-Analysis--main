// ============================================================
// DailyAMView.js
// فحص الماكينة اليومي (Daily AM Checklist) - مرتبط بالماكينة
// المختارة (localStorage.activeMachine - راجع QrScannerView.js/
// MachineProfileView.js). كل بند: OK / Not OK / N/A - وفي حالة
// "Not OK": ملاحظة إجبارية + صورة اختيارية + خيار إنشاء بلاغ مباشر
// (نفس مسار saveIssueApi المستخدم في تسجيل عطل عادي - workflow.js)
// ============================================================

import {
  buildAttachmentPickerHtml,
  initAttachmentPicker,
  getAttachmentFiles
} from '../components/attachmentPicker.js';
import { getDepartmentForMachineValue, normalizeDepartment } from '../machines.js';
import { hasFullDataAccess } from '../permissions.js';

// بنود الفحص اليومي الثابتة (نفس فكرة PMFormFields الثابتة في
// pmView.js - لا يوجد حالياً نظام Templates ديناميكي في المشروع)
const AM_ITEMS = [
  { id: 'cleanliness', ar: 'نظافة الماكينة وخلوها من تسريبات الزيت/الماء', en: 'Machine clean, no oil/water leaks' },
  { id: 'guards', ar: 'أغطية وحواجز الأمان في مكانها وسليمة', en: 'Safety guards in place and intact' },
  { id: 'emergencyStop', ar: 'زر الإيقاف الطارئ يعمل بكفاءة', en: 'Emergency stop button functional' },
  { id: 'noise', ar: 'لا يوجد صوت أو اهتزاز غير طبيعي', en: 'No abnormal noise or vibration' },
  { id: 'pressure', ar: 'ضغط الهواء/الهيدروليك ضمن المعدل الطبيعي', en: 'Air/hydraulic pressure normal' },
  { id: 'panel', ar: 'اللوحة الكهربائية مغلقة وآمنة', en: 'Electrical panel closed and secure' }
];

function t() {
  const isEn = (window.currentLang || 'ar') === 'en';
  return {
    title: isEn ? '📋 Daily AM Checklist' : '📋 فحص الماكينة اليومي (AM)',
    subtitle: isEn ? 'Evaluate each item below' : 'قيّم كل بند من البنود التالية',
    ok: isEn ? 'OK' : 'سليم',
    notOk: isEn ? 'Not OK' : 'غير سليم',
    na: isEn ? 'N/A' : 'لا ينطبق',
    noteLabel: isEn ? 'Note (required)' : 'ملاحظة (إجبارية)',
    notePlaceholder: isEn ? 'Describe the issue...' : 'اوصف المشكلة...',
    createTicket: isEn ? 'Create a ticket for this item' : 'إنشاء بلاغ لهذا البند',
    submit: isEn ? 'Save & Submit ✅' : 'حفظ وإرسال ✅',
    missingAnswers: isEn ? '⚠️ Please evaluate all items' : '⚠️ يرجى تقييم جميع البنود',
    missingNotes: isEn ? '⚠️ Please add a note for every "Not OK" item' : '⚠️ يرجى إضافة ملاحظة لكل بند "غير سليم"',
    noMachine: isEn ? 'No machine selected.' : 'لم يتم اختيار ماكينة.',
    noPermissionTitle: isEn ? '🔒 No Permission' : '🔒 لا توجد صلاحية',
    noPermissionDesc: isEn ? 'This machine belongs to a department you do not have access to.' : 'هذه الماكينة تابعة لقسم لا تملك صلاحية الوصول إليه.',
    saving: isEn ? 'Saving...' : 'جاري الحفظ...',
    success: isEn ? 'Daily AM checklist saved successfully ✅' : 'تم حفظ فحص اليومي بنجاح ✅',
    ticketsCreated: isEn ? ' (tickets created for flagged items)' : ' (تم إنشاء بلاغات للبنود المطلوبة)',
    error: isEn ? 'Error: ' : 'خطأ: '
  };
}

export const DailyAMView = () => {
  const isEn = (window.currentLang || 'ar') === 'en';
  const tr = t();
  const machine = localStorage.getItem('activeMachine') || '';

  if (!machine) {
    return `
    <div class="app-page p-3 sm:p-4 max-w-md sm:max-w-xl mx-auto pb-16">
      <button onclick="window.goBack('machineProfile')" class="mb-5 bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition">
        ${isEn ? '← Back' : '← رجوع'}
      </button>
      <div class="bg-[#1E293B] rounded-xl p-6 border border-gray-800 text-center text-sm text-gray-300">
        ${tr.noMachine}
      </div>
    </div>`;
  }

  // إصلاح (فجوة صلاحيات): كانت هذه الصفحة بتعتمد فقط على صلاحية
  // "maintenance"/"qr" العامة (راجع pageRenderer.js) بدون أي تحقق
  // من تطابق قسم الماكينة (Backend/Frontend) مع قسم المستخدم - رغم
  // إن MachineProfileView.js (الصفحة اللي المفروض المستخدم يوصل
  // منها لهنا دايماً) بتعمل هذا التحقق بالظبط. أي وصول مباشر لهذا
  // المسار (#dailyAM) بقيمة "activeMachine" قديمة/من قسم تاني في
  // localStorage كان بيسمح للمستخدم يملأ الفورم بالكامل ويحاول
  // الحفظ، ليكتشف بعد الإرسال بس إن Firestore Security Rules رفضت
  // الكتابة (لأن قسم الماكينة الفعلي مش قسمه - راجع firestore.rules:
  // machineChecklists) - تجربة استخدام سيئة ومربكة. دلوقتي بيتحقق
  // من نفس الشرط بالظبط هنا (نفس مصدر الحقيقة: getDepartmentForMachineValue
  // + normalizeDepartment + hasFullDataAccess) قبل عرض الفورم أصلاً.
  const department = getDepartmentForMachineValue(machine);
  const userDept = normalizeDepartment(localStorage.getItem('machineDepartment'));
  const allowed = hasFullDataAccess() || (department && department === userDept);

  if (!allowed) {
    return `
    <div class="app-page p-3 sm:p-4 max-w-md sm:max-w-xl mx-auto pb-16">
      <button onclick="window.goBack('machineProfile')" class="mb-5 bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition">
        ${isEn ? '← Back' : '← رجوع'}
      </button>
      <div class="bg-[#1E293B] rounded-xl p-6 border border-amber-500/30 text-center space-y-2">
        <div class="text-sm font-bold text-amber-400">${tr.noPermissionTitle}</div>
        <div class="text-[11px] text-gray-400">${tr.noPermissionDesc}</div>
      </div>
    </div>`;
  }

  return `
  <div class="app-page p-3 sm:p-4 max-w-md sm:max-w-xl md:max-w-3xl mx-auto pb-16">
    <button onclick="window.goBack('machineProfile')" class="mb-5 bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition">
      ${isEn ? '← Back' : '← رجوع'}
    </button>

    <div class="mb-5">
      <h2 class="text-lg font-bold text-blue-400">${tr.title}</h2>
      <p class="text-[11px] text-gray-400 mt-1">${machine} • ${tr.subtitle}</p>
    </div>

    <form id="dailyAmForm" onsubmit="window.handleDailyAmSubmit(event)" class="space-y-3">
      ${AM_ITEMS.map(item => `
        <div class="bg-[#1E293B] p-4 rounded-xl border border-gray-800 space-y-2" data-am-item="${item.id}">
          <div class="text-xs font-bold text-gray-200">${isEn ? item.en : item.ar}</div>

          <div class="grid grid-cols-3 gap-1.5">
            <button type="button" onclick="window.selectAmResult('${item.id}','ok')" id="amBtn_${item.id}_ok"
              class="am-result-btn py-2 rounded-lg text-[11px] font-bold border border-gray-700 bg-[#0F172A] text-gray-300 transition">
              ${tr.ok}
            </button>
            <button type="button" onclick="window.selectAmResult('${item.id}','not_ok')" id="amBtn_${item.id}_not_ok"
              class="am-result-btn py-2 rounded-lg text-[11px] font-bold border border-gray-700 bg-[#0F172A] text-gray-300 transition">
              ${tr.notOk}
            </button>
            <button type="button" onclick="window.selectAmResult('${item.id}','na')" id="amBtn_${item.id}_na"
              class="am-result-btn py-2 rounded-lg text-[11px] font-bold border border-gray-700 bg-[#0F172A] text-gray-300 transition">
              ${tr.na}
            </button>
          </div>

          <input type="hidden" id="amResult_${item.id}" value="">

          <div id="amNotOkBox_${item.id}" class="hidden space-y-2 pt-2 border-t border-gray-800">
            <label class="block text-[10px] font-bold text-red-300">${tr.noteLabel}</label>
            <textarea id="amNote_${item.id}" placeholder="${tr.notePlaceholder}" class="w-full p-2 rounded-lg bg-[#0F172A] border border-gray-700 text-xs text-white h-14 resize-none"></textarea>

            ${buildAttachmentPickerHtml(`amPhoto_${item.id}`, { emptyText: isEn ? 'No photo attached' : 'لا توجد صورة مرفقة' })}

            <label class="flex items-center gap-2 text-[11px] text-gray-300 cursor-pointer">
              <input type="checkbox" id="amCreateTicket_${item.id}" class="w-4 h-4 rounded bg-gray-800 border-gray-600">
              ${tr.createTicket}
            </label>
          </div>
        </div>
      `).join('')}

      <button type="submit" class="w-full p-3 mt-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] rounded-xl font-bold text-xs text-white transition-all">
        ${tr.submit}
      </button>
    </form>
  </div>
  `;
};

// ============================================================
// تفعيل مكوّنات اختيار الصور لكل بند بعد إدراج الفورم في الصفحة
// (يُستدعى من renderCore.js AUTO LOAD)
// ============================================================
export function initDailyAmAttachments() {
  AM_ITEMS.forEach(item => {
    initAttachmentPicker(`amPhoto_${item.id}`, { maxFileSizeMB: 10 });
  });
}
window.initDailyAmAttachments = initDailyAmAttachments;

window.selectAmResult = function (itemId, value) {
  const hidden = document.getElementById(`amResult_${itemId}`);
  if (hidden) hidden.value = value;

  ['ok', 'not_ok', 'na'].forEach(v => {
    const btn = document.getElementById(`amBtn_${itemId}_${v}`);
    if (!btn) return;
    const active = v === value;
    btn.classList.toggle('bg-blue-600', active && v === 'ok');
    btn.classList.toggle('bg-red-600', active && v === 'not_ok');
    btn.classList.toggle('bg-gray-600', active && v === 'na');
    btn.classList.toggle('text-white', active);
    btn.classList.toggle('border-transparent', active);
    btn.classList.toggle('text-gray-300', !active);
    btn.classList.toggle('bg-[#0F172A]', !active);
  });

  const notOkBox = document.getElementById(`amNotOkBox_${itemId}`);
  if (notOkBox) notOkBox.classList.toggle('hidden', value !== 'not_ok');
};

window.handleDailyAmSubmit = async function (event) {
  event.preventDefault();
  const isEn = (window.currentLang || 'ar') === 'en';
  const tr = t();
  const machine = localStorage.getItem('activeMachine') || '';

  const items = [];
  for (const item of AM_ITEMS) {
    const result = document.getElementById(`amResult_${item.id}`)?.value || '';
    if (!result) {
      alert(tr.missingAnswers);
      return;
    }

    const entry = { id: item.id, label: isEn ? item.en : item.ar, result };

    if (result === 'not_ok') {
      const note = document.getElementById(`amNote_${item.id}`)?.value?.trim() || '';
      if (!note) {
        alert(tr.missingNotes);
        return;
      }
      entry.note = note;
      const photos = getAttachmentFiles(`amPhoto_${item.id}`);
      entry.photo = photos && photos.length ? photos[0] : null;
      entry.ticketRequested = !!document.getElementById(`amCreateTicket_${item.id}`)?.checked;
    }

    items.push(entry);
  }

  const okCount = items.filter(i => i.result === 'ok').length;
  const notOkCount = items.filter(i => i.result === 'not_ok').length;
  const answeredCount = items.filter(i => i.result !== 'na').length;
  const completionRate = answeredCount
    ? Math.round((okCount / answeredCount) * 100)
    : 100;

  const payload = {
    machine,
    items,
    completionRate,
    overallResult: notOkCount > 0 ? 'issues_found' : 'ok',
    createdBy: {
      name: localStorage.getItem('name') || '',
      uid: localStorage.getItem('userId') || '',
      job: localStorage.getItem('job') || '',
      department: localStorage.getItem('department') || '',
      shift: localStorage.getItem('shift') || ''
    }
  };

  const submitBtn = event.target?.querySelector('button[type="submit"]');
  const originalText = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = tr.saving;
  }

  try {
    const { saveDailyAmApi } = await import('../services/checklistApi.js');
    const result = await saveDailyAmApi(payload);

    if (result.status !== 'success') {
      alert(tr.error + (result.message || ''));
      return;
    }

    // إنشاء بلاغات للبنود المطلوبة (Not OK + طلب إنشاء بلاغ) - نفس
    // مسار saveIssueApi المستخدم في تسجيل عطل عادي (workflow.js)
    const ticketItems = items.filter(i => i.result === 'not_ok' && i.ticketRequested);
    let ticketsCreated = false;

    if (ticketItems.length) {
      const { saveIssueApi } = await import('../services/api.js');
      for (const item of ticketItems) {
        await saveIssueApi({
          issueId: 'IS-' + Date.now() + '-' + item.id,
          line: '',
          machine,
          priority: 'Medium',
          type: 'Breakdown',
          category: 'أخرى',
          description: `[Daily AM] ${item.label}: ${item.note}`,
          location: '',
          suggestion: '',
          images: item.photo ? [item.photo] : [],
          reportedBy: payload.createdBy.name,
          reportedByUid: payload.createdBy.uid,
          reporter: {
            name: payload.createdBy.name,
            job: payload.createdBy.job,
            department: payload.createdBy.department,
            shift: payload.createdBy.shift
          },
          status: 'pending',
          createdAt: new Date().toISOString(),
          source: 'dailyAM'
        });
      }
      ticketsCreated = true;
    }

    alert(tr.success + (ticketsCreated ? tr.ticketsCreated : ''));
    window.goBack('machineProfile');
  } catch (err) {
    alert(tr.error + err.message);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }
};
