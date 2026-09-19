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
import { db, doc, getDoc } from '../providers/backend/index.js';

// بنود الفحص اليومي الافتراضية
const DEFAULT_AM_ITEMS = [
  { id: 'cleanliness', role: 'operator', ar: 'نظافة الماكينة وخلوها من تسريبات الزيت/الماء', en: 'Machine clean, no oil/water leaks' },
  { id: 'guards', role: 'operator', ar: 'أغطية وحواجز الأمان في مكانها وسليمة', en: 'Safety guards in place and intact' },
  { id: 'emergencyStop', role: 'operator', ar: 'زر الإيقاف الطارئ يعمل بكفاءة', en: 'Emergency stop button functional' },
  { id: 'noise', role: 'operator', ar: 'عدم وجود أصوات غير طبيعية', en: 'No abnormal noise or vibration' },
  { id: 'pressure', role: 'maintainer', type: 'numeric', unit: 'Bar', ar: 'ضغط الهواء/الهيدروليك ضمن المعدل الطبيعي', en: 'Air/hydraulic pressure normal' },
  { id: 'temperature', role: 'maintainer', type: 'numeric', unit: '°C', ar: 'حرارة الماكينة ضمن المعدل الطبيعي', en: 'Machine temperature normal' },
  { id: 'panel', role: 'maintainer', ar: 'اللوحة الكهربائية مغلقة وآمنة', en: 'Electrical panel closed and secure' }
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
    createTicket: isEn ? 'Create Maintenance Ticket' : 'إنشاء بلاغ صيانة',
    submit: isEn ? 'Save & Submit ✅' : 'إرسال الفحص ✅',
    missingAnswers: isEn ? '⚠️ Please evaluate all items' : '⚠️ يرجى تقييم جميع البنود',
    missingNotes: isEn ? '⚠️ Please add a note for every "Not OK" item' : '⚠️ يرجى إضافة ملاحظة لكل بند "غير سليم"',
    noMachine: isEn ? 'No machine selected.' : 'لم يتم اختيار ماكينة.',
    noPermissionTitle: isEn ? '🔒 No Permission' : '🔒 لا توجد صلاحية',
    noPermissionDesc: isEn ? 'This machine belongs to a department you do not have access to.' : 'هذه الماكينة تابعة لقسم لا تملك صلاحية الوصول إليه.',
    saving: isEn ? 'Saving...' : 'جاري الحفظ...',
    success: isEn ? 'Daily AM checklist saved successfully ✅' : 'تم حفظ فحص اليومي بنجاح ✅',
    ticketsCreated: isEn ? ' (tickets created for flagged items)' : ' (تم إنشاء بلاغات للبنود المطلوبة)',
    error: isEn ? 'Error: ' : 'خطأ: ',
    progressLabel: isEn ? 'Completed' : 'بنود مكتملة',
    readingLabel: isEn ? 'Reading' : 'القراءة'
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
  <div class="app-page p-3 sm:p-4 max-w-md sm:max-w-xl md:max-w-3xl mx-auto pb-24">
    <button onclick="window.goBack('machineProfile')" class="mb-5 bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition">
      ${isEn ? '← Back' : '← رجوع'}
    </button>

    <div class="mb-5">
      <h2 class="text-lg font-bold text-blue-400">${tr.title}</h2>
      <p class="text-[11px] text-gray-400 mt-1">${machine} • ${tr.subtitle}</p>
    </div>

    <form id="dailyAmForm" onsubmit="window.handleDailyAmSubmit(event)" class="space-y-4">
      <div id="dailyAmItemsContainer" class="space-y-4">
        <div class="text-center text-sm text-gray-500 py-6">${isEn ? 'Loading checklist...' : 'جاري تحميل الفحص...'}</div>
      </div>

      <!-- Floating Bottom Bar -->
      <div class="fixed bottom-0 left-0 right-0 p-4 bg-[#0F172A] border-t border-gray-800 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-40 hidden" id="dailyAmBottomBar">
         <div class="max-w-md sm:max-w-xl md:max-w-3xl mx-auto flex items-center justify-between">
            <div class="flex flex-col">
               <span class="text-[10px] text-gray-400 font-medium tracking-wider">${tr.progressLabel}</span>
               <div class="flex items-baseline gap-1">
                 <span id="amFloatingProgressText" class="text-xl font-black text-blue-400">0/0</span>
               </div>
            </div>
            <button type="submit" id="dailyAmSubmitBtn" class="bg-blue-600 hover:bg-blue-500 active:scale-95 px-6 py-3 rounded-xl font-bold text-sm text-white transition-all shadow-lg shadow-blue-900/20">
               ${tr.submit}
            </button>
         </div>
      </div>
    </form>
  </div>
  `;
};

window.initDailyAmView = async function() {
  const machine = localStorage.getItem('activeMachine') || '';
  if (!machine) return;
  const isEn = (window.currentLang || 'ar') === 'en';
  const tr = t();

  // Role-Based dynamic form
  const isMaintainer = hasFullDataAccess() || /maintenance|صيانة|مهندس/i.test(localStorage.getItem('job') || '') || /maintenance/i.test(localStorage.getItem('role') || '');

  let items = [...DEFAULT_AM_ITEMS];
  try {
    const docSnap = await getDoc(doc(db, 'machineAmTemplates', machine));
    if (docSnap.exists() && docSnap.data().items && docSnap.data().items.length > 0) {
      items = docSnap.data().items;
    }
  } catch (err) {
    console.error("Failed to load custom AM template, using default:", err);
  }

  // Filter based on role
  if (!isMaintainer) {
    items = items.filter(i => !i.role || i.role === 'operator');
  }

  window._activeAmItems = items;
  window.updateAmProgress();

  const container = document.getElementById('dailyAmItemsContainer');
  if (container) {
    container.innerHTML = items.map(item => `
      <div class="bg-[#1E293B] p-4 rounded-xl border border-gray-800 space-y-3 shadow-sm" data-am-item="${item.id}">
        <div class="text-sm font-bold text-gray-200">${isEn ? item.en : item.ar}</div>

        ${item.type === 'numeric' ? `
          <div class="flex items-center gap-3 bg-[#0F172A] p-2 rounded-lg border border-gray-700 w-full sm:w-1/2">
             <input type="number" id="amReading_${item.id}" placeholder="${tr.readingLabel}" class="w-full bg-transparent text-sm text-white focus:outline-none" step="any" oninput="window.updateAmProgress()">
             <span class="text-xs text-gray-400 font-bold px-2">${item.unit || ''}</span>
          </div>
        ` : ''}

        <div class="grid grid-cols-3 gap-2 pt-1">
          <button type="button" onclick="window.selectAmResult('${item.id}','ok')" id="amBtn_${item.id}_ok"
            class="am-result-btn py-2.5 rounded-lg text-xs font-bold border border-gray-700 bg-[#0F172A] text-gray-300 transition hover:bg-gray-800">
            ${tr.ok}
          </button>
          <button type="button" onclick="window.selectAmResult('${item.id}','not_ok')" id="amBtn_${item.id}_not_ok"
            class="am-result-btn py-2.5 rounded-lg text-xs font-bold border border-gray-700 bg-[#0F172A] text-gray-300 transition hover:bg-gray-800">
            ${tr.notOk}
          </button>
          <button type="button" onclick="window.selectAmResult('${item.id}','na')" id="amBtn_${item.id}_na"
            class="am-result-btn py-2.5 rounded-lg text-xs font-bold border border-gray-700 bg-[#0F172A] text-gray-300 transition hover:bg-gray-800">
            ${tr.na}
          </button>
        </div>

        <input type="hidden" id="amResult_${item.id}" value="">

        <div id="amNotOkBox_${item.id}" class="hidden space-y-3 pt-3 border-t border-gray-800">
          <div class="space-y-1">
             <label class="block text-[10px] font-bold text-red-400">${tr.noteLabel}</label>
             <textarea id="amNote_${item.id}" placeholder="${tr.notePlaceholder}" class="w-full p-2.5 rounded-xl bg-[#0F172A] border border-gray-700 text-xs text-white h-14 resize-none focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"></textarea>
          </div>

          <div class="bg-[#0F172A] rounded-xl border border-gray-800 p-2">
             ${buildAttachmentPickerHtml(`amPhoto_${item.id}`, { emptyText: isEn ? 'No photo attached' : 'لا توجد صورة مرفقة' })}
          </div>

          <!-- يظهر فوراً زر فرعي "إنشاء بلاغ صيانة" -->
          <label class="flex items-center gap-2 text-[11px] text-gray-300 cursor-pointer bg-red-950/20 p-2.5 rounded-xl border border-red-900/30 hover:bg-red-950/40 transition-colors">
            <input type="checkbox" id="amCreateTicket_${item.id}" class="w-4 h-4 rounded bg-gray-800 border-gray-600 text-red-500 focus:ring-red-500" checked>
            <span class="font-medium text-red-300">${tr.createTicket}</span>
          </label>
        </div>
      </div>
    `).join('');

    // Initialize attachments for all loaded items
    items.forEach(item => {
      initAttachmentPicker(`amPhoto_${item.id}`, { maxFileSizeMB: 10 });
    });

    const bottomBar = document.getElementById('dailyAmBottomBar');
    if (bottomBar) bottomBar.classList.remove('hidden');
    
    window.updateAmProgress();
  }
};

window.updateAmProgress = function() {
  const activeItems = window._activeAmItems || [];
  let answered = 0;
  
  activeItems.forEach(item => {
    const val = document.getElementById(`amResult_${item.id}`)?.value;
    if (val) answered++;
  });

  const progressText = document.getElementById('amFloatingProgressText');
  if (progressText) {
    progressText.textContent = `${answered}/${activeItems.length}`;
    if (answered === activeItems.length && activeItems.length > 0) {
       progressText.className = 'text-xl font-black text-emerald-400 transition-colors';
    } else {
       progressText.className = 'text-xl font-black text-blue-400 transition-colors';
    }
  }
};

window.selectAmResult = function (itemId, value) {
  const hidden = document.getElementById(`amResult_${itemId}`);
  if (hidden) hidden.value = value;

  ['ok', 'not_ok', 'na'].forEach(v => {
    const btn = document.getElementById(`amBtn_${itemId}_${v}`);
    if (!btn) return;
    const active = v === value;
    
    // سليم -> أخضر
    // غير سليم -> أحمر
    // لا ينطبق -> رمادي
    btn.classList.toggle('bg-emerald-600', active && v === 'ok');
    btn.classList.toggle('bg-red-600', active && v === 'not_ok');
    btn.classList.toggle('bg-gray-600', active && v === 'na');
    
    btn.classList.toggle('text-white', active);
    btn.classList.toggle('border-transparent', active);
    btn.classList.toggle('text-gray-300', !active);
    btn.classList.toggle('bg-[#0F172A]', !active);
  });

  const notOkBox = document.getElementById(`amNotOkBox_${itemId}`);
  if (notOkBox) notOkBox.classList.toggle('hidden', value !== 'not_ok');
  
  window.updateAmProgress();
};

window.handleDailyAmSubmit = async function (event) {
  event.preventDefault();
  const isEn = (window.currentLang || 'ar') === 'en';
  const tr = t();
  const machine = localStorage.getItem('activeMachine') || '';
  const activeItems = window._activeAmItems || DEFAULT_AM_ITEMS;

  const items = [];
  for (const item of activeItems) {
    const result = document.getElementById(`amResult_${item.id}`)?.value || '';
    if (!result) {
      alert(tr.missingAnswers);
      return;
    }

    const entry = { id: item.id, label: isEn ? item.en : item.ar, result };
    
    if (item.type === 'numeric') {
       entry.reading = document.getElementById(`amReading_${item.id}`)?.value || '';
    }

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

  const submitBtn = document.getElementById('dailyAmSubmitBtn');
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

    // إنشاء بلاغات للبنود المطلوبة (Not OK + طلب إنشاء بلاغ)
    const ticketItems = items.filter(i => i.result === 'not_ok' && i.ticketRequested);
    let ticketsCreated = false;

    if (ticketItems.length) {
      const { saveIssueApi } = await import('../services/api.js');
      for (const item of ticketItems) {
        let ticketDesc = `[Daily AM] ${item.label}: ${item.note}`;
        if (item.reading) {
           ticketDesc = `[Daily AM] ${item.label} (Reading: ${item.reading}) - ${item.note}`;
        }
        await saveIssueApi({
          issueId: 'IS-' + Date.now() + '-' + item.id,
          line: '',
          machine,
          priority: 'High',
          type: 'Breakdown',
          category: 'فحص يومي',
          description: ticketDesc,
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

