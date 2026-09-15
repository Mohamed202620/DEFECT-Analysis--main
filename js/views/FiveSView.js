// ============================================================
// FiveSView.js
// تقييم 5S للماكينة (Sort / Set in Order / Shine / Standardize /
// Sustain) - قسم مستقل داخل فحص الماكينة، مرتبط بنفس الماكينة
// المختارة (localStorage.activeMachine). تقييم بسيط (1-5) لكل عنصر
// + 5S Score إجمالي (متوسط التقييمات كنسبة مئوية).
// ============================================================

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
    noteLabel: isEn ? 'Note (optional)' : 'ملاحظة (اختياري)',
    submit: isEn ? 'Save & Submit ✅' : 'حفظ وإرسال ✅',
    missingAnswers: isEn ? '⚠️ Please rate all 5 pillars' : '⚠️ يرجى تقييم جميع العناصر الخمسة',
    noMachine: isEn ? 'No machine selected.' : 'لم يتم اختيار ماكينة.',
    saving: isEn ? 'Saving...' : 'جاري الحفظ...',
    success: isEn ? '5S assessment saved successfully ✅ Score: ' : 'تم حفظ تقييم 5S بنجاح ✅ النتيجة: ',
    error: isEn ? 'Error: ' : 'خطأ: '
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

  return `
  <div class="app-page p-3 sm:p-4 max-w-md sm:max-w-xl md:max-w-3xl mx-auto pb-16">
    <button onclick="window.goBack('machineProfile')" class="mb-5 bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition">
      ${isEn ? '← Back' : '← رجوع'}
    </button>

    <div class="mb-5">
      <h2 class="text-lg font-bold text-emerald-400">${tr.title}</h2>
      <p class="text-[11px] text-gray-400 mt-1">${machine} • ${tr.subtitle}</p>
    </div>

    <form id="fiveSForm" onsubmit="window.handleFiveSSubmit(event)" class="space-y-3">
      ${FIVE_S_PILLARS.map(p => `
        <div class="bg-[#1E293B] p-4 rounded-xl border border-gray-800 space-y-2">
          <div class="text-xs font-bold text-gray-200">${isEn ? p.en : p.ar}</div>
          <div class="text-[10px] text-gray-500">${isEn ? p.desc.en : p.desc.ar}</div>

          <div class="grid grid-cols-5 gap-1.5">
            ${[1, 2, 3, 4, 5].map(n => `
              <button type="button" onclick="window.selectFiveSRating('${p.id}', ${n})" id="fsBtn_${p.id}_${n}"
                class="fs-rating-btn py-2 rounded-lg text-xs font-bold border border-gray-700 bg-[#0F172A] text-gray-300 transition">
                ${n}
              </button>
            `).join('')}
          </div>
          <input type="hidden" id="fsRating_${p.id}" value="">

          <textarea id="fsNote_${p.id}" placeholder="${tr.noteLabel}" class="w-full p-2 rounded-lg bg-[#0F172A] border border-gray-700 text-xs text-white h-12 resize-none"></textarea>
        </div>
      `).join('')}

      <button type="submit" class="w-full p-3 mt-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] rounded-xl font-bold text-xs text-white transition-all">
        ${tr.submit}
      </button>
    </form>
  </div>
  `;
};

window.selectFiveSRating = function (pillarId, value) {
  const hidden = document.getElementById(`fsRating_${pillarId}`);
  if (hidden) hidden.value = value;

  [1, 2, 3, 4, 5].forEach(n => {
    const btn = document.getElementById(`fsBtn_${pillarId}_${n}`);
    if (!btn) return;
    const active = n === value;
    btn.classList.toggle('bg-emerald-600', active);
    btn.classList.toggle('text-white', active);
    btn.classList.toggle('border-transparent', active);
    btn.classList.toggle('bg-[#0F172A]', !active);
    btn.classList.toggle('text-gray-300', !active);
  });
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
    items.push({
      pillar: pillar.id,
      label: isEn ? pillar.en : pillar.ar,
      rating,
      note: document.getElementById(`fsNote_${pillar.id}`)?.value?.trim() || ''
    });
  }

  const totalRating = items.reduce((sum, i) => sum + i.rating, 0);
  const score = Math.round((totalRating / (items.length * 5)) * 100);

  const payload = {
    machine,
    items,
    score,
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
    const { saveFiveSApi } = await import('../services/checklistApi.js');
    const result = await saveFiveSApi(payload);

    if (result.status === 'success') {
      alert(tr.success + score + '%');
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
