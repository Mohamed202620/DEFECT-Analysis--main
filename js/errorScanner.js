// ============================================================
// errorScanner.js
// منطق ميزة "Machine Error Scanner" الجديدة
// - التقاط صورة لشاشة العطل
// - قراءة النص بالكاميرا (OCR) عبر Tesseract.js (تحميل كسول عند الحاجة فقط)
// - البحث عن الكود في قاعدة المعرفة الحالية (Firestore)
// - عرض/إضافة/اعتماد العطل ضمن نظام الصلاحيات الموجود
//
// يتبع نفس نمط workflow.js: حالة على مستوى الموديول + تفويض
// أحداث change على document (لأن innerHTML يُعاد رسمه بالكامل عند التنقل)
// ============================================================

import { compressImage } from './workflow.js';

import {
  findMachineErrorByCode,
  saveMachineErrorApi,
  verifyMachineErrorApi,
  logMachineErrorOccurrenceApi,
  fetchMachineErrorHistoryApi
} from './services/api.js';

// ============================================================
// حالة الموديول
// ============================================================

let scannedImage = null;      // الصورة بعد الضغط (Base64) لعرضها وحفظها
let lastFoundError = null;    // آخر نتيجة عطل تم العثور عليها (لإجراءات الاعتماد/التسجيل)

// ============================================================
// تحميل مكتبة Tesseract.js بشكل كسول (مرة واحدة فقط عند الحاجة)
// حتى لا يتم تحميلها على كل صفحات التطبيق دون داعٍ
// ============================================================

let tesseractLoadPromise = null;

function loadTesseract() {
  if (window.Tesseract) {
    return Promise.resolve(window.Tesseract);
  }

  if (tesseractLoadPromise) {
    return tesseractLoadPromise;
  }

  tesseractLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    script.onload = () => resolve(window.Tesseract);
    script.onerror = () => reject(new Error('تعذر تحميل مكتبة قراءة النص (OCR)'));
    document.head.appendChild(script);
  });

  return tesseractLoadPromise;
}

// ============================================================
// استخراج كود العطل الأكثر ترجيحاً من النص المستخرج
// أنماط شائعة: E-12، ERR204، F-05، ALM 21، Fault 108 ...الخ
// ============================================================

function extractErrorCode(rawText) {
  const text = String(rawText || '');

  const patterns = [
    /\b(ERR|ERROR|ALM|ALARM|FAULT|FLT)[-_\s]?\d{1,5}\b/i,
    /\b[A-Z]{1,4}[-_]\d{1,5}\b/,
    /\b[A-Z]{1,3}\d{2,5}\b/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0].toUpperCase().replace(/\s+/g, ' ').trim();
    }
  }

  return '';
}

// ============================================================
// قوائم الخطوط والماكينات - مطابقة لنفس القوائم المستخدمة في
// باقي التطبيق (IssueView / SuggestionView) للحفاظ على الاتساق
// ============================================================

export const LINE_OPTIONS = ['Line 1', 'Line 2'];

export const MACHINE_OPTIONS = [
  'Coil Handling',
  'Baler',
  'Cupper',
  'Bodymaker',
  'Trimmer',
  'Washer',
  'Decorator',
  'Spray',
  'IBO',
  'Necker',
  'Palletizer',
  'Depalletizer',
  'Front End Line Control',
  'Mid Line Control',
  'Back End Line Control'
];

function buildOptions(list, selected) {
  return `<option value="" disabled ${selected ? '' : 'selected'}>اختر...</option>` +
    list.map(v => `<option value="${v}" ${v === selected ? 'selected' : ''}>${v}</option>`).join('');
}

// ============================================================
// عناصر واجهة مشتركة (اختصارات)
// ============================================================

function el(id) {
  return document.getElementById(id);
}

function setStatus(message, isError = false) {
  const box = el('errScanStatus');
  if (!box) return;
  box.textContent = message;
  box.classList.toggle('text-red-400', isError);
  box.classList.toggle('text-blue-400', !isError);
}

// ============================================================
// معالجة اختيار/التقاط صورة شاشة العطل + تشغيل OCR
// ============================================================

document.addEventListener('change', async (e) => {
  if (!e.target || (e.target.id !== 'errScanCamera' && e.target.id !== 'errScanGallery')) {
    return;
  }

  const file = e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    alert('⚠️ الملف المختار ليس صورة.');
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    alert('❌ حجم الصورة كبير جداً (الحد الأقصى 10MB)');
    return;
  }

  try {
    setStatus('⏳ جاري تجهيز الصورة...');

    scannedImage = await compressImage(file, 900, 0.75);

    const preview = el('errScanPreview');
    if (preview) {
      preview.src = scannedImage;
      preview.classList.remove('hidden');
    }

    setStatus('🔍 جاري قراءة النص من الصورة (OCR)...');

    const Tesseract = await loadTesseract();
    const result = await Tesseract.recognize(scannedImage, 'eng');
    const rawText = result?.data?.text || '';

    const codeInput = el('errScanCode');
    const messageInput = el('errScanMessage');

    const suggestedCode = extractErrorCode(rawText);

    if (codeInput) codeInput.value = suggestedCode;
    if (messageInput) messageInput.value = rawText.trim();

    setStatus(
      suggestedCode
        ? `✅ تم استخراج كود مقترح: ${suggestedCode} (يمكنك تعديله قبل البحث)`
        : '⚠️ لم يتم التعرف تلقائياً على كود واضح، يرجى إدخاله يدوياً بعد مراجعة النص المستخرج.'
    );

  } catch (err) {
    console.error('OCR Error:', err);
    setStatus('❌ حدث خطأ أثناء قراءة النص من الصورة: ' + err.message, true);
  }
});

// ============================================================
// البحث عن العطل في قاعدة المعرفة
// ============================================================

window.searchMachineError = async function () {

  const codeInput = el('errScanCode');
  const code = codeInput?.value?.trim() || '';

  if (!code) {
    alert('⚠️ يرجى إدخال أو استخراج كود العطل أولاً.');
    return;
  }

  const resultsBox = el('errorScanResults');
  if (resultsBox) {
    resultsBox.innerHTML = `<div class="text-center text-gray-400 text-xs py-6">🔍 جاري البحث في قاعدة المعرفة...</div>`;
  }

  const result = await findMachineErrorByCode(code);

  if (result.status !== 'success') {
    if (resultsBox) {
      resultsBox.innerHTML = `<div class="text-center text-red-400 text-xs py-6">❌ ${result.message || 'حدث خطأ أثناء البحث'}</div>`;
    }
    return;
  }

  if (result.found) {
    lastFoundError = result.data;
    renderFoundError(result.data);
    loadErrorHistory(result.data.errorCode);
  } else {
    lastFoundError = null;
    renderNotFound(code);
  }

};

// ============================================================
// عرض نتيجة: عطل موجود
// ============================================================

function renderFoundError(data) {
  const resultsBox = el('errorScanResults');
  if (!resultsBox) return;

  const isPending = data.status === 'pending_review';
  const canVerify =
    isPending &&
    typeof window.hasPermission === 'function' &&
    window.hasPermission('machines');

  resultsBox.innerHTML = `
    <div class="bg-[#1E293B] rounded-2xl p-4 border border-emerald-500/30 shadow-lg space-y-3">

      <div class="flex items-center justify-between">
        <h3 class="text-base font-bold text-emerald-400">✅ تم العثور على العطل</h3>
        <span class="text-[10px] px-2 py-1 rounded-full font-bold ${isPending ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'}">
          ${isPending ? 'قيد المراجعة' : 'معتمد'}
        </span>
      </div>

      <div class="text-sm">
        <div class="text-gray-400 text-[11px]">كود العطل</div>
        <div class="font-bold text-blue-400">${data.errorCode || '-'}</div>
      </div>

      ${data.machine || data.line ? `
      <div class="text-sm">
        <div class="text-gray-400 text-[11px]">الماكينة / الخط</div>
        <div class="text-gray-100">${data.machine || '-'} ${data.line ? '· ' + data.line : ''}</div>
      </div>` : ''}

      <div class="text-sm">
        <div class="text-gray-400 text-[11px]">السبب المحتمل</div>
        <div class="text-gray-100">${data.cause || 'غير محدد'}</div>
      </div>

      <div class="text-sm">
        <div class="text-gray-400 text-[11px]">الحل</div>
        <div class="text-gray-100">${data.solution || 'غير محدد'}</div>
      </div>

      <div class="text-sm">
        <div class="text-gray-400 text-[11px]">خطوات الإصلاح</div>
        <div class="text-gray-100 whitespace-pre-line">${data.steps || 'غير محدد'}</div>
      </div>

      <div class="grid grid-cols-1 gap-2 pt-2">
        <button onclick="window.logErrorOccurrence()" class="w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-xs text-white transition active:scale-95">
          📌 تسجيل ظهور هذا العطل الآن
        </button>
        ${canVerify ? `
        <button onclick="window.verifyMachineError('${data.id}')" class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-xs text-white transition active:scale-95">
          ✅ اعتماد هذا العطل
        </button>` : ''}
        <button onclick="window.resetErrorScanner()" class="w-full py-2.5 bg-gray-700 hover:bg-gray-600 rounded-xl font-bold text-xs text-white transition active:scale-95">
          🔄 فحص عطل آخر
        </button>
      </div>

      <div id="errorHistoryBox" class="pt-2"></div>

    </div>
  `;
}

// ============================================================
// عرض سجل الأعطال السابق (Error History) لهذا الكود
// ============================================================

async function loadErrorHistory(code) {
  const box = el('errorHistoryBox');
  if (!box) return;

  box.innerHTML = `<div class="text-center text-gray-500 text-[11px] py-2">جاري تحميل السجل...</div>`;

  const result = await fetchMachineErrorHistoryApi(code);

  if (result.status !== 'success' || !result.data || !result.data.length) {
    box.innerHTML = `<div class="text-center text-gray-500 text-[11px] py-2">لا يوجد سجل ظهور سابق لهذا العطل بعد.</div>`;
    return;
  }

  box.innerHTML = `
    <div class="text-[11px] font-bold text-gray-400 mb-1">📋 سجل الأعطال السابق</div>
    <div class="space-y-1.5">
      ${result.data.map(log => `
        <div class="bg-[#0F172A] border border-gray-800 rounded-lg p-2 text-[11px] text-gray-300 flex items-center justify-between">
          <span>${log.machine || '-'} ${log.line ? '· ' + log.line : ''}</span>
          <span class="text-gray-500">${log.scannedAt ? new Date(log.scannedAt).toLocaleDateString('ar-EG') : ''}</span>
        </div>
      `).join('')}
    </div>
  `;
}

// ============================================================
// عرض نتيجة: عطل غير موجود -> نموذج إضافة عطل جديد
// ============================================================

function renderNotFound(code) {
  const resultsBox = el('errorScanResults');
  if (!resultsBox) return;

  resultsBox.innerHTML = `
    <div class="bg-[#1E293B] rounded-2xl p-4 border border-red-500/30 shadow-lg space-y-3">
      <h3 class="text-sm font-bold text-red-400">❌ لم يتم العثور على هذا العطل في قاعدة المعرفة</h3>
      <p class="text-[11px] text-gray-400">يمكنك إضافته الآن، وسيتم حفظه كـ "قيد المراجعة" حتى تتم مراجعته.</p>

      <div>
        <label class="block mb-1 text-[11px] font-bold text-gray-300">الخط</label>
        <select id="errNewLine" class="w-full p-2.5 rounded-lg bg-[#0F172A] border border-gray-700 text-white text-xs appearance-none">
          ${buildOptions(LINE_OPTIONS)}
        </select>
      </div>

      <div>
        <label class="block mb-1 text-[11px] font-bold text-gray-300">الماكينة</label>
        <select id="errNewMachine" class="w-full p-2.5 rounded-lg bg-[#0F172A] border border-gray-700 text-white text-xs appearance-none">
          ${buildOptions(MACHINE_OPTIONS)}
        </select>
      </div>

      <div>
        <label class="block mb-1 text-[11px] font-bold text-gray-300">السبب المحتمل</label>
        <textarea id="errNewCause" rows="2" class="w-full p-2.5 rounded-lg bg-[#0F172A] border border-gray-700 text-white text-xs resize-none"></textarea>
      </div>

      <div>
        <label class="block mb-1 text-[11px] font-bold text-gray-300">الحل</label>
        <textarea id="errNewSolution" rows="2" class="w-full p-2.5 rounded-lg bg-[#0F172A] border border-gray-700 text-white text-xs resize-none"></textarea>
      </div>

      <div>
        <label class="block mb-1 text-[11px] font-bold text-gray-300">خطوات الإصلاح</label>
        <textarea id="errNewSteps" rows="3" class="w-full p-2.5 rounded-lg bg-[#0F172A] border border-gray-700 text-white text-xs resize-none"></textarea>
      </div>

      <button onclick="window.saveNewMachineError('${code.replace(/'/g, "\\'")}')" class="w-full py-2.5 bg-red-600 hover:bg-red-500 rounded-xl font-bold text-xs text-white transition active:scale-95">
        ➕ إضافة عطل جديد (قيد المراجعة)
      </button>
    </div>
  `;
}

// ============================================================
// حفظ عطل جديد
// ============================================================

window.saveNewMachineError = async function (code) {

  const machine = el('errNewMachine')?.value?.trim() || '';
  const line = el('errNewLine')?.value?.trim() || '';
  const cause = el('errNewCause')?.value?.trim() || '';
  const solution = el('errNewSolution')?.value?.trim() || '';
  const steps = el('errNewSteps')?.value?.trim() || '';
  const errorMessage = el('errScanMessage')?.value?.trim() || '';

  if (!cause && !solution) {
    alert('⚠️ يرجى إدخال السبب المحتمل أو الحل على الأقل.');
    return;
  }

  const payload = {
    errorCode: code,
    errorMessage,
    machine,
    line,
    cause,
    solution,
    steps,
    image: scannedImage,
    createdBy: {
      name: localStorage.getItem('name') || '',
      phone: localStorage.getItem('phone') || '',
      job: localStorage.getItem('job') || ''
    }
  };

  const result = await saveMachineErrorApi(payload);

  if (result.status !== 'success') {
    alert('❌ ' + (result.message || 'حدث خطأ أثناء الحفظ'));
    if (result.duplicate && result.data) {
      lastFoundError = result.data;
      renderFoundError(result.data);
      loadErrorHistory(result.data.errorCode);
    }
    return;
  }

  alert('✅ ' + result.message);
  window.searchMachineError();
};

// ============================================================
// تسجيل ظهور جديد لعطل معروف حالياً
// ============================================================

window.logErrorOccurrence = async function () {

  if (!lastFoundError) return;

  const payload = {
    errorCode: lastFoundError.errorCode,
    machine: lastFoundError.machine || '',
    line: lastFoundError.line || '',
    image: scannedImage,
    scannedBy: {
      name: localStorage.getItem('name') || '',
      job: localStorage.getItem('job') || ''
    }
  };

  const result = await logMachineErrorOccurrenceApi(payload);

  if (result.status === 'success') {
    alert('✅ تم تسجيل ظهور العطل في السجل');
    loadErrorHistory(lastFoundError.errorCode);
  } else {
    alert('❌ ' + (result.message || 'تعذر تسجيل الظهور'));
  }

};

// ============================================================
// اعتماد عطل قيد المراجعة
// ============================================================

window.verifyMachineError = async function (errorId) {

  const result = await verifyMachineErrorApi(errorId);

  alert(result.message || (result.status === 'success' ? 'تم الاعتماد' : 'حدث خطأ'));

  if (result.status === 'success') {
    window.searchMachineError();
  }

};

// ============================================================
// إعادة ضبط الماسح للبحث عن عطل آخر
// ============================================================

window.resetErrorScanner = function () {

  scannedImage = null;
  lastFoundError = null;

  const preview = el('errScanPreview');
  if (preview) {
    preview.src = '';
    preview.classList.add('hidden');
  }

  const codeInput = el('errScanCode');
  if (codeInput) codeInput.value = '';

  const messageInput = el('errScanMessage');
  if (messageInput) messageInput.value = '';

  const resultsBox = el('errorScanResults');
  if (resultsBox) resultsBox.innerHTML = '';

  setStatus('جاهز لالتقاط صورة جديدة لشاشة العطل.');
};
