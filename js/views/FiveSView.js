// ============================================================
// FiveSView.js
// تقييم 5S للماكينة (Sort / Set in Order / Shine / Standardize /
// Sustain) - قسم مستقل داخل فحص الماكينة، مرتبط بنفس الماكينة
// المختارة (localStorage.activeMachine). تقييم بسيط (1-5) لكل عنصر
// + 5S Score إجمالي (متوسط التقييمات كنسبة مئوية).
// ============================================================

import { getDepartmentForMachineValue, normalizeDepartment } from '../machines.js';
import { hasFullDataAccess } from '../permissions.js';
import {
  buildAttachmentPickerHtml,
  initAttachmentPicker,
  getAttachmentFiles
} from '../components/attachmentPicker.js';

const FIVE_S_PILLARS = [
  { id: 'sort', ar: 'Sort - الفرز/التنظيم', en: 'Sort', desc: { ar: 'التخلص من الأدوات/المواد غير الضرورية حول الماكينة', en: 'Unnecessary items removed from the area' } },
  { id: 'setInOrder', ar: 'Set in Order - الترتيب', en: 'Set in Order', desc: { ar: 'الأدوات والمواد مرتبة في أماكنها المحددة', en: 'Tools and parts organized in designated places' } },
  { id: 'shine', ar: 'Shine - النظافة', en: 'Shine', desc: { ar: 'الماكينة والمنطقة المحيطة نظيفة', en: 'Machine and surrounding area are clean' } },
  { id: 'standardize', ar: 'Standardize - توحيد المعايير', en: 'Standardize', desc: { ar: 'معايير النظافة/الترتيب موثّقة وواضحة للجميع', en: 'Cleaning/order standards documented and visible' } },
  { id: 'sustain', ar: 'Sustain - الاستمرارية', en: 'Sustain', desc: { ar: 'الالتزام بالمعايير مستمر في الفحوصات السابقة', en: 'Standards are consistently maintained over time' } }
];

function t() {
  const isEn = (window.currentLang || 'ar') === 'en';
  return {
    title: isEn ? '🧹 5S Assessment' : '🧹 تقييم 5S',
    subtitle: isEn ? 'Rate each pillar from 1 (poor) to 5 (excellent)' : 'قيّم كل عنصر من 1 (ضعيف) إلى 5 (ممتاز)',
    noteLabel: isEn ? 'Note' : 'الملاحظة',
    noteRequiredLabel: isEn ? 'Note (required)' : 'ملاحظة (إجبارية)',
    notePlaceholder: isEn ? 'Add note...' : 'أضف ملاحظة...',
    createTicket: isEn ? 'Convert to Maintenance / Improvement Ticket' : 'تحويل إلى بلاغ صيانة / طلب تحسين',
    submit: isEn ? 'Save & Submit ✅' : 'حفظ وإرسال ✅',
    missingAnswers: isEn ? '⚠️ Please rate all 5 pillars' : '⚠️ يرجى تقييم جميع العناصر الخمسة',
    missingNotes: isEn ? '⚠️ Please add notes for low ratings (1 or 2)' : '⚠️ يرجى إضافة ملاحظات للتقييمات الضعيفة (1 أو 2)',
    noMachine: isEn ? 'No machine selected.' : 'لم يتم اختيار ماكينة.',
    noPermissionTitle: isEn ? '🔒 No Permission' : '🔒 لا توجد صلاحية',
    noPermissionDesc: isEn ? 'This machine belongs to a department you do not have access to.' : 'هذه الماكينة تابعة لقسم لا تملك صلاحية الوصول إليه.',
    saving: isEn ? 'Saving...' : 'جاري الحفظ...',
    success: isEn ? '5S assessment saved successfully ✅ Score: ' : 'تم حفظ تقييم 5S بنجاح ✅ النتيجة: ',
    ticketsCreated: isEn ? ' (tickets created for flagged items)' : ' (تم إنشاء بلاغات للملاحظات المطلوبة)',
    error: isEn ? 'Error: ' : 'خطأ: ',
    scoreLabel: isEn ? 'Score / Total' : 'النتيجة / الإجمالي',
    photoEmpty: isEn ? 'No photo attached' : 'لا توجد صورة مرفقة'
  };
}

export const FiveSView = () => {
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

  // Set timeout to initialize attachment pickers after render
  setTimeout(() => {
    FIVE_S_PILLARS.forEach(p => {
      initAttachmentPicker(`fsPhoto_${p.id}`, { maxFileSizeMB: 10 });
    });
    window.updateFiveSScore();
  }, 50);

  return `
  <div class="app-page p-3 sm:p-4 max-w-md sm:max-w-xl md:max-w-3xl mx-auto pb-24">
    <button onclick="window.goBack('machineProfile')" class="mb-5 bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition">
      ${isEn ? '← Back' : '← رجوع'}
    </button>

    <div class="mb-5">
      <h2 class="text-lg font-bold text-emerald-400">${tr.title}</h2>
      <p class="text-[11px] text-gray-400 mt-1">${machine} • ${tr.subtitle}</p>
    </div>

    <form id="fiveSForm" onsubmit="window.handleFiveSSubmit(event)" class="space-y-4">
      ${FIVE_S_PILLARS.map(p => `
        <div class="bg-[#1E293B] p-4 rounded-xl border border-gray-800 space-y-3 shadow-sm">
          <div class="flex justify-between items-start">
            <div>
              <div class="text-sm font-bold text-gray-200">${isEn ? p.en : p.ar}</div>
              <div class="text-[11px] text-gray-500">${isEn ? p.desc.en : p.desc.ar}</div>
            </div>
          </div>

          <div class="grid grid-cols-5 gap-1.5 pt-1">
            ${[1, 2, 3, 4, 5].map(n => `
              <button type="button" onclick="window.selectFiveSRating('${p.id}', ${n})" id="fsBtn_${p.id}_${n}"
                class="fs-rating-btn py-2.5 rounded-lg text-xs font-bold border border-gray-700 bg-[#0F172A] text-gray-300 transition hover:bg-gray-800">
                ${n}
              </button>
            `).join('')}
          </div>
          <input type="hidden" id="fsRating_${p.id}" value="">

          <div id="fsExtras_${p.id}" class="space-y-3 hidden pt-2 border-t border-gray-800">
             <div class="flex items-start gap-2">
               <div class="flex-1 space-y-1">
                  <label id="fsNoteLabel_${p.id}" class="block text-[10px] font-bold text-gray-400">${tr.noteLabel}</label>
                  <textarea id="fsNote_${p.id}" placeholder="${tr.notePlaceholder}" class="w-full p-2.5 rounded-xl bg-[#0F172A] border border-gray-700 text-xs text-white h-12 resize-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"></textarea>
               </div>
             </div>
             
             <div class="bg-[#0F172A] rounded-xl border border-gray-800 p-2">
                ${buildAttachmentPickerHtml(`fsPhoto_${p.id}`, { emptyText: tr.photoEmpty })}
             </div>

             <div id="fsTicketBox_${p.id}" class="hidden">
                <label class="flex items-center gap-2 text-[11px] text-gray-300 cursor-pointer bg-red-950/20 p-2.5 rounded-xl border border-red-900/30 hover:bg-red-950/40 transition-colors">
                  <input type="checkbox" id="fsCreateTicket_${p.id}" class="w-4 h-4 rounded bg-gray-800 border-gray-600 text-red-500 focus:ring-red-500">
                  <span class="font-medium text-red-300">${tr.createTicket}</span>
                </label>
             </div>
          </div>
        </div>
      `).join('')}
      
      <!-- Floating Bottom Bar -->
      <div class="fixed bottom-0 left-0 right-0 p-4 bg-[#0F172A] border-t border-gray-800 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-40">
         <div class="max-w-md sm:max-w-xl md:max-w-3xl mx-auto flex items-center justify-between">
            <div class="flex flex-col">
               <span class="text-[10px] text-gray-400 font-medium uppercase tracking-wider">${tr.scoreLabel}</span>
               <div class="flex items-baseline gap-2">
                 <span id="fsFloatingScoreText" class="text-2xl font-black text-emerald-400">0/25</span>
                 <span id="fsFloatingPercentText" class="text-sm font-bold text-gray-300">0%</span>
               </div>
            </div>
            <button type="submit" id="fsFloatingSubmit" form="fiveSForm" class="bg-emerald-600 hover:bg-emerald-500 active:scale-95 px-6 py-3 rounded-xl font-bold text-sm text-white transition-all shadow-lg shadow-emerald-900/20">
               ${tr.submit}
            </button>
         </div>
      </div>
    </form>
  </div>
  `;
};

window.updateFiveSScore = function() {
  let total = 0;
  let answered = 0;
  FIVE_S_PILLARS.forEach(p => {
    const val = Number(document.getElementById(`fsRating_${p.id}`)?.value || 0);
    if (val > 0) {
      total += val;
      answered++;
    }
  });

  const maxPossible = FIVE_S_PILLARS.length * 5;
  const percent = maxPossible > 0 ? Math.round((total / maxPossible) * 100) : 0;
  
  const scoreText = document.getElementById('fsFloatingScoreText');
  const percentText = document.getElementById('fsFloatingPercentText');
  
  if (scoreText) scoreText.textContent = `${total}/${maxPossible}`;
  if (percentText) percentText.textContent = `${percent}%`;

  // Update colors based on score
  if (scoreText) {
    scoreText.className = 'text-2xl font-black transition-colors ' + 
      (percent < 50 ? 'text-red-400' : percent < 80 ? 'text-amber-400' : 'text-emerald-400');
  }
};

window.selectFiveSRating = function (pillarId, value) {
  const hidden = document.getElementById(`fsRating_${pillarId}`);
  if (hidden) hidden.value = value;
  const tr = t();

  [1, 2, 3, 4, 5].forEach(n => {
    const btn = document.getElementById(`fsBtn_${pillarId}_${n}`);
    if (!btn) return;
    const active = n === value;
    
    // Determine color based on value
    let activeColor = 'bg-emerald-600';
    if (n <= 2) activeColor = 'bg-red-600';
    else if (n === 3) activeColor = 'bg-orange-500';

    btn.classList.toggle(activeColor, active);
    btn.classList.toggle('text-white', active);
    btn.classList.toggle('border-transparent', active);
    btn.classList.toggle('bg-[#0F172A]', !active);
    btn.classList.toggle('text-gray-300', !active);
    
    // Remove other colors if present
    if (!active) {
       btn.classList.remove('bg-red-600', 'bg-orange-500', 'bg-emerald-600');
    }
  });

  // Handle Extras (Note, Photo, Ticket)
  const extrasBox = document.getElementById(`fsExtras_${pillarId}`);
  const noteLabel = document.getElementById(`fsNoteLabel_${pillarId}`);
  const ticketBox = document.getElementById(`fsTicketBox_${pillarId}`);
  
  if (extrasBox) {
    extrasBox.classList.remove('hidden');
    
    // If rating is 1 or 2 -> Note is required, Ticket option available
    if (value <= 2) {
      if (noteLabel) {
        noteLabel.textContent = tr.noteRequiredLabel;
        noteLabel.classList.replace('text-gray-400', 'text-red-400');
      }
      if (ticketBox) ticketBox.classList.remove('hidden');
    } else {
      // 3, 4, 5 -> Note optional, Ticket option hidden
      if (noteLabel) {
        noteLabel.textContent = tr.noteLabel;
        noteLabel.classList.replace('text-red-400', 'text-gray-400');
      }
      if (ticketBox) ticketBox.classList.add('hidden');
      
      // Auto uncheck ticket request if rating improves
      const ticketCheck = document.getElementById(`fsCreateTicket_${pillarId}`);
      if (ticketCheck) ticketCheck.checked = false;
    }
  }

  window.updateFiveSScore();
};

window.handleFiveSSubmit = async function (event) {
  event.preventDefault();
  const isEn = (window.currentLang || 'ar') === 'en';
  const tr = t();
  const machine = localStorage.getItem('activeMachine') || '';

  const items = [];
  for (const pillar of FIVE_S_PILLARS) {
    const rating = Number(document.getElementById(`fsRating_${pillar.id}`)?.value || 0);
    if (!rating) {
      alert(tr.missingAnswers);
      return;
    }
    
    const note = document.getElementById(`fsNote_${pillar.id}`)?.value?.trim() || '';
    if (rating <= 2 && !note) {
      alert(tr.missingNotes);
      return;
    }

    const photos = getAttachmentFiles(`fsPhoto_${pillar.id}`);
    const photo = photos && photos.length ? photos[0] : null;
    const ticketRequested = !!document.getElementById(`fsCreateTicket_${pillar.id}`)?.checked;

    items.push({
      pillar: pillar.id,
      label: isEn ? pillar.en : pillar.ar,
      rating,
      note,
      photo,
      ticketRequested
    });
  }

  const totalRating = items.reduce((sum, i) => sum + i.rating, 0);
  const score = Math.round((totalRating / (items.length * 5)) * 100);

  const payload = {
    machine,
    items: items.map(i => ({ pillar: i.pillar, label: i.label, rating: i.rating, note: i.note, photo: i.photo })), // save without ticketRequested for checklists collection
    score,
    createdBy: {
      name: localStorage.getItem('name') || '',
      uid: localStorage.getItem('userId') || '',
      job: localStorage.getItem('job') || '',
      department: localStorage.getItem('department') || '',
      shift: localStorage.getItem('shift') || ''
    }
  };

  const submitBtn = document.getElementById('fsFloatingSubmit');
  const originalText = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = tr.saving;
  }

  try {
    const { saveFiveSApi } = await import('../services/checklistApi.js');
    const result = await saveFiveSApi(payload);

    if (result.status === 'success') {
      
      // Create tickets for items that requested one
      const ticketItems = items.filter(i => i.rating <= 2 && i.ticketRequested);
      let ticketsCreated = false;

      if (ticketItems.length) {
        const { saveIssueApi } = await import('../services/api.js');
        for (const item of ticketItems) {
          await saveIssueApi({
            issueId: 'IS-' + Date.now() + '-' + item.pillar,
            line: '',
            machine,
            priority: 'Medium',
            type: 'Breakdown',
            category: '5S / تحسين',
            description: `[5S - ${item.label}] (Rating: ${item.rating}/5) - ${item.note}`,
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
            source: 'fiveS'
          });
        }
        ticketsCreated = true;
      }

      alert(tr.success + score + '%' + (ticketsCreated ? tr.ticketsCreated : ''));
      window.goBack('machineProfile');
    } else {
      alert(tr.error + (result.message || ''));
    }
  } catch (err) {
    alert(tr.error + err.message);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }
};

