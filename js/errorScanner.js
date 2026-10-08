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

import { compressImage } from './components/attachmentPicker.js';

import {
  findMachineErrorByCode,
  saveMachineErrorApi,
  verifyMachineErrorApi,
  logMachineErrorOccurrenceApi,
  fetchMachineErrorHistoryApi,
  fetchAllMachineErrorsApi
} from './services/api.js';
import { translations } from './config.js';
import {
  analyzeAlarmLines,
  prepareOcrImages,
  prepareRegionImages,
  pickLineNearCenter,
  suggestKbMatches,
  clampCropRect,
  DEFAULT_CROP_RECT,
  MIN_CROP_W,
  MIN_CROP_H
} from './utils/machineErrorOcr.js';

// إصلاح (ترجمة شاملة): كل نصوص هذه الميزة (رسائل الحالة، تنبيهات،
// عناوين النتائج، النموذج الجديد) كانت ثابتة بالعربي - دلوقتي
// بتتقرأ من translations.errorScanner حسب window.currentLang
function t() {
  const currentLang = window.currentLang || "ar";
  return (translations[currentLang] || translations.ar).errorScanner;
}

// ============================================================
// حالة الموديول
// ============================================================

let scannedImage = null;      // الصورة بعد الضغط (Base64) لعرضها وحفظها
let lastFoundError = null;    // آخر نتيجة عطل تم العثور عليها (لإجراءات الاعتماد/التسجيل)
let isScanning = false;       // true أثناء تشغيل OCR (لمنع تشغيل مزدوج + التحكم بالـ Spinner)
let scannedFile = null;       // الصورة الأصلية (بدقتها الكاملة) للقراءة - المعاينة المضغوطة للعرض فقط
let cropRect = { ...DEFAULT_CROP_RECT }; // مستطيل السطر المحدد (نسب 0..1 من الصورة)
let ocrCandidates = [];       // مرشحو OCR (غير مؤكدين) المعروضين للاختيار اليدوي

// ============================================================
// تحميل مكتبة Tesseract.js بشكل كسول (مرة واحدة فقط عند الحاجة)
// حتى لا يتم تحميلها على كل صفحات التطبيق دون داعٍ
// ============================================================

let tesseractLoadPromise = null;
let ocrWorkerPromise = null;

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
    script.onerror = () => reject(new Error(t().tesseractLoadError));
    document.head.appendChild(script);
  }).catch(error => {
    tesseractLoadPromise = null;
    throw error;
  });

  return tesseractLoadPromise;
}

async function getOcrWorker() {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = loadTesseract()
      .then(Tesseract => Tesseract.createWorker('ara+eng'))
      .catch(error => {
        ocrWorkerPromise = null;
        throw error;
      });
  }
  return ocrWorkerPromise;
}

// Worker مخصص لقراءة سطر عطل محدد: إنجليزي فقط + قائمة أحرف مسموحة. السبب (مثبت من النص الخام
// لصورة فعلية): نموذج ara+eng كان بيهلوس حروف عربية فوق سطر إنجليزي صرف (رسائل أعطال الـ HMI
// دايماً لاتينية)، فبيبوّظ القراءة. وضع "قراءة الصورة كلها" لسه بيستخدم ara+eng زي ما هو
const LINE_OCR_WHITELIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-:./()&,' ";
let lineWorkerPromise = null;

async function getLineOcrWorker() {
  if (!lineWorkerPromise) {
    lineWorkerPromise = loadTesseract()
      .then(async Tesseract => {
        const worker = await Tesseract.createWorker('eng');
        await worker.setParameters({
          tessedit_char_whitelist: LINE_OCR_WHITELIST,
          preserve_interword_spaces: '1',
          user_defined_dpi: '300'
        });
        return worker;
      })
      .catch(error => {
        lineWorkerPromise = null;
        throw error;
      });
  }
  return lineWorkerPromise;
}

function readLines(result) {
  const lines = Array.isArray(result?.data?.lines) ? result.data.lines : [];
  if (lines.length) {
    return lines
      .map(line => ({ text: String(line.text || '').trim(), confidence: Number(line.confidence) || 0, bbox: line.bbox }))
      .filter(line => line.text);
  }
  // احتياطي: لو المكتبة ما رجّعتش lines نستخدم النص كما هو بثقة الصفحة
  const pageConfidence = Number(result?.data?.confidence) || 0;
  return String(result?.data?.text || '')
    .split(/\r?\n/)
    .map(text => ({ text: text.trim(), confidence: pageConfidence }))
    .filter(line => line.text);
}

// يرجّع النص الخام + قراءات الأسطر لكل تمريرة OCR. القرار (مرشح/مؤكد) بيتاخد بعدين
// بعد المطابقة مع قاعدة المعرفة - مفيش كود بيتعبّى من هنا مباشرة
async function recognizeMachineScreen(file) {
  const [images, worker] = await Promise.all([
    prepareOcrImages(file),
    getOcrWorker()
  ]);
  const reads = [];

  await worker.setParameters({ tessedit_pageseg_mode: '6' });
  const messageRead = await worker.recognize(images.enhanced);
  reads.push(readLines(messageRead));

  await worker.setParameters({ tessedit_pageseg_mode: '11' });
  reads.push(readLines(await worker.recognize(images.enhanced)));

  await worker.setParameters({ tessedit_pageseg_mode: '6' });
  reads.push(readLines(await worker.recognize(images.thresholded)));

  return {
    rawText: messageRead?.data?.text || '',
    reads
  };
}

// قراءة السطر الذي حدده المستخدم: المقطع مكبّر ومعالج لوحده، بوضع سطر واحد (PSM 7)
// ثم 6 احتياطي لو المستطيل غطّى أكتر من سطر، ثم نسخة ثنائية. من كل قراءة بناخد السطر
// الأقرب لمركز المستطيل فقط (السطر المجاور المقصوص جزئياً بيتجاهل)
async function recognizeSelectedRegion(file, rect) {
  const [images, worker] = await Promise.all([
    prepareRegionImages(file, rect),
    getLineOcrWorker()
  ]);

  const run = async (image, psm) => {
    await worker.setParameters({ tessedit_pageseg_mode: psm });
    return worker.recognize(image);
  };

  // ثلاث قراءات: صورة مسوّاة (سطر واحد) / نسخة ثنائية (سطر واحد) / سطر خام (PSM 13)
  const results = [
    await run(images.enhanced, '7'),
    await run(images.thresholded, '7'),
    await run(images.enhanced, '13')
  ];

  const allLines = results.map(readLines);
  return {
    rawText: results.map(r => String(r?.data?.text || '').trim()).filter(Boolean).join('\n---\n'),
    reads: allLines.map(lines => pickLineNearCenter(lines, images.height)),
    // كل النصوص المقروءة (حتى غير المفهومة كأكواد) لمطابقتها تقريبياً مع قاموس الـ KB
    texts: allLines.flat().map(line => line.text)
  };
}

// تحليل كل تمريرة لوحدها (عشان تكرار نفس السطر في تمريرات مختلفة مايتحسبش "تكرار
// إنذار") واختيار أفضل تمريرة: مؤكدة > الأعلى درجة > الأكثر مرشحين
function analyzeReads(reads, kbEntries, machineType, { region = false } = {}) {
  const rank = { confirmed: 2, review: 1, none: 0 };
  return reads
    // سطر حدده المستخدم بنفسه: نخفّض حد استبعاد الثقة (يظهر كمرشح مراجعة بثقته الحقيقية بدل ما
    // يختفي) ونقبل صيغة بدون شرطة. الاعتماد التلقائي لسه بيحتاج ثقة كافية + مطابقة KB
    .map(lines => analyzeAlarmLines(lines, kbEntries, region
      ? { machineType, minLineConfidence: 20, allowLoose: true }
      : { machineType }))
    .sort((a, b) =>
      (rank[b.status] - rank[a.status]) ||
      ((b.candidates[0]?.score || 0) - (a.candidates[0]?.score || 0)) ||
      (b.candidates.length - a.candidates.length)
    )[0] || { status: 'none', selected: null, candidates: [] };
}

// ============================================================
// قوائم الخطوط والماكينات - مطابقة لنفس القوائم المستخدمة في
// باقي التطبيق (IssueView / SuggestionView) للحفاظ على الاتساق
// ============================================================
//
// إصلاح (بند 1 - توحيد شامل): كانت هذه القائمة نسخة مكررة يدوياً من
// machines.js (وكانت فعلياً ناقصة نوع "STRAP" منها - دليل عملي على
// خطر تكرار نفس البيانات في أكتر من مكان). دلوقتي بقت مُشتقّة مباشرة
// من نفس المصدر الموحّد (machines.js -> Firestore)، فأي تعديل يعمله
// الأدمن من صفحة "إدارة الماكينات" بينعكس هنا تلقائياً كمان.
//
// getErrorScannerMachineOptions() دالة (مش قيمة ثابتة) عشان تفضل
// دايماً بتاخد أحدث نسخة من الكاش وقت الاستدعاء الفعلي (راجع
// ErrorScannerView.js) حتى لو الكاش اتحدّث بعد أول تحميل للصفحة

import { getMachineTypeEntries } from './machines.js';
import { escapeHtml, escapeJsArg } from "./utils/escapeHtml.js";

export const LINE_OPTIONS = ['Line 1', 'Line 2'];

export function getErrorScannerMachineOptions() {
  return getMachineTypeEntries({ includeInactive: false }).map(m => m.key);
}

function buildOptions(list, selected) {
  return `<option value="" disabled ${selected ? '' : 'selected'}>${t().selectPlaceholder}</option>` +
    list.map(v => `<option value="${v}" ${v === selected ? 'selected' : ''}>${v}</option>`).join('');
}

// ============================================================
// عناصر واجهة مشتركة (اختصارات)
// ============================================================

function el(id) {
  return document.getElementById(id);
}

// إصلاح (isScanning + Spinner): showSpinner اختياري - بيضيف نفس شكل
// الـ Spinner المستخدم بالفعل في splash screen بالتطبيق (index.html)
// دون أي تعديل على أي Styling/Layout حالي في باقي الصفحة
function setStatus(message, isError = false, showSpinner = false) {
  const box = el('errScanStatus');
  if (!box) return;

  if (showSpinner) {
    box.innerHTML = `
      <span class="inline-flex items-center justify-center gap-2">
        <span class="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></span>
        <span>${escapeHtml(message)}</span>
      </span>`;
  } else {
    box.textContent = message;
  }

  box.classList.toggle('text-red-400', isError);
  box.classList.toggle('text-blue-400', !isError);
}


// ============================================================
// عرض مرشحي OCR (منفصلين عن الحقول النهائية) + الاختيار اليدوي
// ============================================================

function renderOcrCandidates() {
  const box = el('errScanCandidates');
  if (!box) return;
  if (!ocrCandidates.length) {
    box.innerHTML = '';
    return;
  }
  const tr = t();
  box.innerHTML = `
    <div class="text-[11px] font-bold text-amber-400">${escapeHtml(tr.ocrCandidatesTitle)}</div>
    ${ocrCandidates.map((c, i) => `
      <button type="button" onclick="window.pickOcrCandidate(${i})"
        class="w-full text-start p-2.5 rounded-xl bg-[#0F172A] border ${c.inKb ? 'border-emerald-500/40' : 'border-amber-500/30'} hover:border-indigo-400 transition active:scale-95">
        <div class="flex items-center justify-between gap-2">
          <span class="font-black text-blue-400 text-sm">${escapeHtml(c.code)}</span>
          <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${c.inKb ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}">
            ${escapeHtml(c.suggested ? tr.ocrSuggested : (c.inKb ? tr.ocrInKb : tr.ocrNotInKb))} · ${c.confidence}%
          </span>
        </div>
        ${c.message ? `<div class="text-[11px] text-gray-300 mt-1">${escapeHtml(c.message)}</div>` : ''}
      </button>`).join('')}`;
}

window.pickOcrCandidate = async function (index) {
  const picked = ocrCandidates[index];
  if (!picked) return;
  const codeInput = el('errScanCode');
  const messageInput = el('errScanMessage');
  if (codeInput) codeInput.value = picked.code;
  if (messageInput) messageInput.value = picked.message || picked.kbMessage || '';
  setStatus(t().ocrPicked.replace('{code}', picked.code));
  // اختيار صريح من المستخدم = مسموح البحث مباشرة
  await window.searchMachineError(picked.code);
};

// ============================================================
// دوال مساعدة لبحث العطل اليدوي وتصفية نوع الماكينة
// ============================================================

function normalizeSearchTerm(term) {
  return String(term || '').trim().toLowerCase();
}

// Test 17: كل عملية بحث (بالكود أو النص) كانت بتحمّل مجموعة machineErrors
// كاملة من Firestore من جديد - ومرات بتتكرر في نفس البحث. كاش قصير (60
// ثانية) بيشارك نفس الطلب الجاري ويتفرّغ فوراً عند أي حفظ/اعتماد/تسجيل
// ظهور من هذا الجهاز، فالنتائج بتفضل مطابقة للسلوك الحالي
const ALL_ERRORS_CACHE_TTL_MS = 60000;
let _allErrorsCache = null; // { at, promise }

function invalidateAllMachineErrorsCache() {
  _allErrorsCache = null;
}

async function fetchAllMachineErrors() {
  const now = Date.now();
  if (_allErrorsCache && now - _allErrorsCache.at < ALL_ERRORS_CACHE_TTL_MS) {
    return _allErrorsCache.promise;
  }

  const promise = fetchAllMachineErrorsApi().then(result => {
    if (!result || result.status !== 'success') {
      // ماتتخزنش نتيجة فاشلة - المحاولة الجاية تجلب من جديد
      if (_allErrorsCache && _allErrorsCache.promise === promise) _allErrorsCache = null;
    }
    return Array.isArray(result?.data) ? result.data : [];
  }).catch(error => {
    if (_allErrorsCache && _allErrorsCache.promise === promise) _allErrorsCache = null;
    throw error;
  });

  _allErrorsCache = { at: now, promise };
  return promise;
}

function matchesMachineError(error, searchTerm) {
  const normalized = normalizeSearchTerm(searchTerm);
  return (
    String(error.errorCode || '').toLowerCase().includes(normalized) ||
    String(error.errorMessage || '').toLowerCase().includes(normalized) ||
    String(error.machine || '').toLowerCase().includes(normalized) ||
    String(error.line || '').toLowerCase().includes(normalized) ||
    String(error.cause || '').toLowerCase().includes(normalized) ||
    String(error.solution || '').toLowerCase().includes(normalized)
  );
}

function chooseErrorByMachineType(candidates, selectedMachineType) {
  if (!selectedMachineType || candidates.length <= 1) {
    return candidates[0] || null;
  }
  return candidates.find(error => error.machine === selectedMachineType) || null;
}

async function searchMachineErrorsByText(searchTerm) {
  const allErrors = await fetchAllMachineErrors();
  return allErrors.filter(error => matchesMachineError(error, searchTerm));
}

async function fetchMachineErrorsByCode(code) {
  const normalizedCode = normalizeSearchTerm(code);
  const allErrors = await fetchAllMachineErrors();
  return allErrors.filter(error => normalizeSearchTerm(error.errorCode) === normalizedCode);
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
  // نفس الصورة لو اتختارت تاني لازم تطلق الحدث من جديد
  e.target.value = '';

  if (!file.type.startsWith('image/')) {
    alert(t().notImage);
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    alert(t().fileTooLarge);
    return;
  }

  await loadScreenFile(file);
});

// اختيار الصورة: عرض المعاينة + مستطيل التحديد فقط. القراءة نفسها بتتم بزر صريح
// (سطر محدد / الصورة كلها) عشان المستخدم هو اللي يقرر أي عطل في السجل
async function loadScreenFile(file) {
  if (isScanning) return;
  isScanning = true;
  try {
    setStatus(t().preparingImage);
    scannedImage = await compressImage(file, 900, 0.75);
    scannedFile = file;

    const preview = el('errScanPreview');
    if (preview) preview.src = scannedImage;
    const wrap = el('errScanCropWrap');
    if (wrap) wrap.classList.remove('hidden');

    // نتائج الصورة السابقة ماتفضلش معروضة على صورة جديدة
    ocrCandidates = [];
    renderOcrCandidates();
    const rawBox = el('errScanRaw');
    if (rawBox) rawBox.value = '';
    const codeInput = el('errScanCode');
    if (codeInput) codeInput.value = '';
    const messageInput = el('errScanMessage');
    if (messageInput) messageInput.value = '';
    const resultsBox = el('errorScanResults');
    if (resultsBox) resultsBox.innerHTML = '';

    cropRect = { ...DEFAULT_CROP_RECT };
    setupCropSelector();
    applyCropRect();
    setStatus(t().cropReady);
  } catch (err) {
    console.error('Image prepare error:', err);
    setStatus(t().ocrError, true);
  } finally {
    isScanning = false;
  }
}

function setScanButtonsDisabled(disabled) {
  ['errScanReadRegionBtn', 'errScanReadFullBtn'].forEach(id => {
    const btn = el(id);
    if (btn) btn.disabled = disabled;
  });
}

// عرض نتيجة التحليل: الخام / المرشحون / المؤكد منفصلين، ولا تعبئة إلا لنتيجة مؤكدة
async function presentOcrResult(analysis, rawText, { region = false, suggestions = [] } = {}) {
  // 1) النص الخام: للعرض والمراجعة فقط، مش بيدخل أي حقل نهائي
  const rawBox = el('errScanRaw');
  if (rawBox) rawBox.value = String(rawText || '').trim();
  // لو النتيجة مش مؤكدة نفتح النص الخام تلقائياً: المستخدم يشوف الـ OCR قرا إيه بالظبط
  const rawDetails = el('errScanRawDetails');
  if (rawDetails) rawDetails.open = analysis.status !== 'confirmed';

  // 2) المرشحون (مفصولين عن الحقول النهائية)
  ocrCandidates = [...analysis.candidates, ...suggestions].slice(0, 6);
  renderOcrCandidates();

  const codeInput = el('errScanCode');
  const messageInput = el('errScanMessage');

  if (analysis.status === 'confirmed' && analysis.selected) {
    // 3) نتيجة مؤكدة فقط: كود موجود في الـ KB + ثقة كافية + مفيش مرشح أقوى/أعلى
    const picked = analysis.selected;
    if (codeInput) codeInput.value = picked.code;
    if (messageInput) messageInput.value = picked.message || picked.kbMessage || '';
    setStatus(t().ocrConfirmed.replace('{code}', picked.code));
    await window.searchMachineError(picked.code);
    return;
  }

  // غير موثوق: الحقول تتفضّى (مانسيبش قيمة سابقة/مخمّنة) والمستخدم يختار أو يكتب
  if (codeInput) codeInput.value = '';
  if (messageInput) messageInput.value = '';
  if (analysis.candidates.length) {
    setStatus(t().ocrNeedsReview);
  } else if (ocrCandidates.length) {
    // القراءة نفسها مش واضحة، لكن فيه أعطال قريبة من قاعدة المعرفة نعرضها للاختيار
    setStatus(t().ocrLowQualityKb);
  } else {
    setStatus(region ? t().ocrRegionNone : t().codeNotFound, true);
  }
}

async function runOcrScan(mode) {
  if (!scannedFile) {
    setStatus(t().ocrNoImage, true);
    return;
  }
  // منع تشغيل مسح جديد أثناء مسح قائم بالفعل
  if (isScanning) return;
  isScanning = true;
  setScanButtonsDisabled(true);

  try {
    // "Spinner أثناء القراءة": "جاري قراءة الشاشة..." + Spinner
    setStatus(t().readingOcr, false, true);

    const region = mode === 'region';
    const { rawText, reads, texts = [] } = region
      ? await recognizeSelectedRegion(scannedFile, cropRect)
      : await recognizeMachineScreen(scannedFile);

    // قاعدة المعرفة للتحقق (نفس الكاش القصير المستخدم في البحث) - لو فشلت نكمل بدونها
    // وفي الحالة دي مفيش نتيجة بتتأكد (كل شيء Needs Review)
    let kbEntries = [];
    try {
      kbEntries = await fetchAllMachineErrors();
    } catch (kbError) {
      console.warn('OCR: KB unavailable for validation', kbError);
    }

    const machineType = String(window.selectedMachineType || '').trim();
    const analysis = analyzeReads(reads, kbEntries, machineType, { region });

    // قراءة غير مؤكدة في وضع السطر المحدد: نقارن النص المقروء (حتى لو مشوّه) برسائل الـ KB للماكينة
    // المختارة ونقترح أقرب أعطال. الكود دايماً من الـ KB، والاقتراح مابيتعتمدش تلقائياً
    const suggestions = region && analysis.status !== 'confirmed'
      ? suggestKbMatches(texts, kbEntries, { machineType, excludeCodes: analysis.candidates.map(c => c.code) })
      : [];

    await presentOcrResult(analysis, rawText, { region, suggestions });
  } catch (err) {
    console.error('OCR Error:', err);
    setStatus(t().ocrError, true);
  } finally {
    isScanning = false;
    setScanButtonsDisabled(false);
  }
}

window.scanSelectedRegion = () => runOcrScan('region');
window.scanFullImage = () => runOcrScan('full');

// ============================================================
// مستطيل تحديد السطر (لمس/ماوس) - إحداثياته نسب من الصورة المعروضة
// ============================================================

function applyCropRect() {
  const box = el('errScanCropBox');
  if (!box) return;
  box.style.left = `${cropRect.x * 100}%`;
  box.style.top = `${cropRect.y * 100}%`;
  box.style.width = `${cropRect.w * 100}%`;
  box.style.height = `${cropRect.h * 100}%`;
}

function setupCropSelector() {
  const stage = el('errScanCropStage');
  const box = el('errScanCropBox');
  if (!stage || !box || box.dataset.bound === '1') return;
  box.dataset.bound = '1';

  let drag = null;

  box.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const bounds = stage.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    drag = {
      handle: (ev.target && ev.target.dataset && ev.target.dataset.h) || 'move',
      startX: ev.clientX,
      startY: ev.clientY,
      start: { ...cropRect },
      bounds
    };
    try { box.setPointerCapture(ev.pointerId); } catch (_) { /* لا شيء */ }
  });

  box.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    const dx = (ev.clientX - drag.startX) / drag.bounds.width;
    const dy = (ev.clientY - drag.startY) / drag.bounds.height;
    const s = drag.start;
    let { x, y, w, h } = s;

    if (drag.handle === 'move') {
      x = s.x + dx;
      y = s.y + dy;
    } else {
      // الحافة المقابلة للمقبض المسحوب تفضل ثابتة، والحجم لا ينزل عن الحد الأدنى
      if (drag.handle.includes('w')) { w = Math.max(MIN_CROP_W, s.w - dx); x = s.x + s.w - w; }
      if (drag.handle.includes('e')) { w = Math.max(MIN_CROP_W, s.w + dx); }
      if (drag.handle.includes('n')) { h = Math.max(MIN_CROP_H, s.h - dy); y = s.y + s.h - h; }
      if (drag.handle.includes('s')) { h = Math.max(MIN_CROP_H, s.h + dy); }
    }

    cropRect = clampCropRect({ x, y, w, h });
    applyCropRect();
  });

  const endDrag = () => { drag = null; };
  box.addEventListener('pointerup', endDrag);
  box.addEventListener('pointercancel', endDrag);

  // ضغطة على السطر المطلوب = ينقل المستطيل عليه (click مش pointerdown عشان
  // السكرول بالإصبع مايحركش المستطيل بالغلط)
  stage.addEventListener('click', (ev) => {
    if (box.contains(ev.target)) return;
    const bounds = stage.getBoundingClientRect();
    if (!bounds.height) return;
    const centerY = (ev.clientY - bounds.top) / bounds.height;
    cropRect = clampCropRect({ ...cropRect, y: centerY - cropRect.h / 2 });
    applyCropRect();
  });
}

// ============================================================
// البحث عن العطل في قاعدة المعرفة
// ============================================================

// إصلاح (بحث تلقائي بعد OCR): overrideCode/overrideManual اختياريين -
// لو اتبعتوا (من مسار OCR) بنستخدمهم مباشرة كما هم، بدل قراءة قيمة
// الحقول من الـ DOM. الاستدعاء العادي من الزر (بدون parameters) يفضل
// شغال بالظبط زي ما كان.
window.searchMachineError = async function (overrideCode, overrideManual) {

  const codeInput = el('errScanCode');
  const code = (overrideCode !== undefined && overrideCode !== null && overrideCode !== '')
    ? String(overrideCode).trim()
    : (codeInput?.value?.trim() || '');
  const manualInput = el('errScanManual');
  const manualSearch = (overrideManual !== undefined && overrideManual !== null && overrideManual !== '')
    ? String(overrideManual).trim()
    : (manualInput?.value?.trim() || '');
  const selectedMachineType = String(window.selectedMachineType || '').trim();

  if (!code && !manualSearch) {
    alert(t().enterCodeFirst);
    return;
  }

  const resultsBox = el('errorScanResults');
  if (resultsBox) {
    resultsBox.innerHTML = `<div class="text-center text-gray-400 text-xs py-6">${t().searchingKb}</div>`;
  }

  // أولاً: البحث برقم العطل إن وجد
  if (code) {
    const result = await findMachineErrorByCode(code);

    if (result.status !== 'success') {
      if (resultsBox) {
        resultsBox.innerHTML = `<div class="text-center text-red-400 text-xs py-6">❌ ${escapeHtml(result.message || t().genericSearchError)}</div>`;
      }
      return;
    }

    if (result.found) {
      let foundError = result.data;

      if (selectedMachineType) {
        const sameCodeErrors = await fetchMachineErrorsByCode(code);
        const matchedByMachine = chooseErrorByMachineType(sameCodeErrors, selectedMachineType);

        if (sameCodeErrors.length > 1 && !matchedByMachine) {
          lastFoundError = null;
          renderNotFound(code);
          return;
        }

        if (matchedByMachine) {
          foundError = matchedByMachine;
        }
      }

      lastFoundError = foundError;
      renderFoundError(foundError);
      loadErrorHistory(foundError.errorCode);
      return;
    }
  }

  // ثانياً: البحث اليدوي إن كان هناك نص
  if (manualSearch) {
    const candidates = await searchMachineErrorsByText(manualSearch);

    if (candidates.length) {
      const matchedByMachine = chooseErrorByMachineType(candidates, selectedMachineType);

      if (candidates.length > 1 && selectedMachineType && !matchedByMachine) {
        lastFoundError = null;
        renderNotFound(manualSearch);
        return;
      }

      const foundError = matchedByMachine || candidates[0];
      lastFoundError = foundError;
      renderFoundError(foundError);
      loadErrorHistory(foundError.errorCode);
      return;
    }
  }

  lastFoundError = null;
  renderNotFound(code || manualSearch || '');

};

// ============================================================
// عرض نتيجة: عطل موجود
// ============================================================

function renderFoundError(data) {
  const resultsBox = el('errorScanResults');
  if (!resultsBox) return;

  const tr = t();
  const isPending = data.status === 'pending_review';
  const canVerify =
    isPending &&
    typeof window.hasPermission === 'function' &&
    window.hasPermission('machines');

  resultsBox.innerHTML = `
    <div class="bg-[#1E293B] rounded-2xl p-4 border border-emerald-500/30 shadow-lg space-y-3">

      <div class="flex items-center justify-between">
        <h3 class="text-base font-bold text-emerald-400">${tr.foundTitle}</h3>
        <span class="text-[10px] px-2 py-1 rounded-full font-bold ${isPending ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'}">
          ${isPending ? tr.pendingReviewStatus : tr.verifiedStatus}
        </span>
      </div>

      <div class="text-sm">
        <div class="text-gray-400 text-[11px]">${tr.errorCodeLabel}</div>
        <div class="font-bold text-blue-400">${data.errorCode || '-'}</div>
      </div>

      ${data.machine || data.line ? `
      <div class="text-sm">
        <div class="text-gray-400 text-[11px]">${tr.machineLineLabel}</div>
        <div class="text-gray-100">${escapeHtml(data.machine || '-')} ${data.line ? escapeHtml('· ' + data.line) : ''}</div>
      </div>` : ''}

      <div class="text-sm">
        <div class="text-gray-400 text-[11px]">${tr.causeLabel}</div>
        <div class="text-gray-100">${data.cause || tr.notSpecified}</div>
      </div>

      <div class="text-sm">
        <div class="text-gray-400 text-[11px]">${tr.solutionLabel}</div>
        <div class="text-gray-100">${data.solution || tr.notSpecified}</div>
      </div>

      <div class="text-sm">
        <div class="text-gray-400 text-[11px]">${tr.stepsLabel}</div>
        <div class="text-gray-100 whitespace-pre-line">${data.steps || tr.notSpecified}</div>
      </div>

      <div class="grid grid-cols-1 gap-2 pt-2">
        <button onclick="window.logErrorOccurrence()" class="w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-xs text-white transition active:scale-95">
          ${tr.logOccurrenceBtn}
        </button>
        ${canVerify ? `
        <button onclick="window.verifyMachineError('${escapeJsArg(data.id)}')" class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-xs text-white transition active:scale-95">
          ${tr.verifyBtn}
        </button>` : ''}
        <button onclick="window.resetErrorScanner()" class="w-full py-2.5 bg-gray-700 hover:bg-gray-600 rounded-xl font-bold text-xs text-white transition active:scale-95">
          ${tr.scanAnotherBtn}
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

  const tr = t();
  const currentLang = window.currentLang || "ar";

  box.innerHTML = `<div class="text-center text-gray-500 text-[11px] py-2">${tr.loadingHistory}</div>`;

  const result = await fetchMachineErrorHistoryApi(code);

  if (result.status !== 'success' || !result.data || !result.data.length) {
    box.innerHTML = `<div class="text-center text-gray-500 text-[11px] py-2">${tr.noHistory}</div>`;
    return;
  }

  box.innerHTML = `
    <div class="text-[11px] font-bold text-gray-400 mb-1">${tr.historyTitle}</div>
    <div class="space-y-1.5">
      ${result.data.map(log => `
        <div class="bg-[#0F172A] border border-gray-800 rounded-lg p-2 text-[11px] text-gray-300 flex items-center justify-between">
          <span>${escapeHtml(log.machine || '-')} ${log.line ? escapeHtml('· ' + log.line) : ''}</span>
          <span class="text-gray-500">${log.scannedAt ? new Date(log.scannedAt).toLocaleDateString(currentLang === 'ar' ? 'ar-EG' : 'en-US') : ''}</span>
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

  const tr = t();

  resultsBox.innerHTML = `
    <div class="bg-[#1E293B] rounded-2xl p-4 border border-red-500/30 shadow-lg space-y-3">
      <h3 class="text-sm font-bold text-red-400">${tr.notFoundTitle}</h3>
      <p class="text-[11px] text-gray-400">${tr.notFoundDesc}</p>

      <div>
        <label class="block mb-1 text-[11px] font-bold text-gray-300">${tr.lineLabel}</label>
        <select id="errNewLine" class="w-full p-2.5 rounded-lg bg-[#0F172A] border border-gray-700 text-white text-xs appearance-none">
          ${buildOptions(LINE_OPTIONS)}
        </select>
      </div>

      <div>
        <label class="block mb-1 text-[11px] font-bold text-gray-300">${tr.machineLabelOnly}</label>
        <select id="errNewMachine" class="w-full p-2.5 rounded-lg bg-[#0F172A] border border-gray-700 text-white text-xs appearance-none">
          ${buildOptions(getErrorScannerMachineOptions())}
        </select>
      </div>

      <div>
        <label class="block mb-1 text-[11px] font-bold text-gray-300">${tr.causeLabel}</label>
        <textarea id="errNewCause" rows="2" class="w-full p-2.5 rounded-lg bg-[#0F172A] border border-gray-700 text-white text-xs resize-none"></textarea>
      </div>

      <div>
        <label class="block mb-1 text-[11px] font-bold text-gray-300">${tr.solutionLabel}</label>
        <textarea id="errNewSolution" rows="2" class="w-full p-2.5 rounded-lg bg-[#0F172A] border border-gray-700 text-white text-xs resize-none"></textarea>
      </div>

      <div>
        <label class="block mb-1 text-[11px] font-bold text-gray-300">${tr.stepsLabel}</label>
        <textarea id="errNewSteps" rows="3" class="w-full p-2.5 rounded-lg bg-[#0F172A] border border-gray-700 text-white text-xs resize-none"></textarea>
      </div>

      <button onclick="window.saveNewMachineError('${escapeJsArg(code)}')" class="w-full py-2.5 bg-red-600 hover:bg-red-500 rounded-xl font-bold text-xs text-white transition active:scale-95">
        ${tr.addNewBtn}
      </button>
    </div>
  `;
}

// ============================================================
// حفظ عطل جديد
// ============================================================

const _saveNewMachineError = async function (code) {

  const machine = el('errNewMachine')?.value?.trim() || '';
  const line = el('errNewLine')?.value?.trim() || '';
  const cause = el('errNewCause')?.value?.trim() || '';
  const solution = el('errNewSolution')?.value?.trim() || '';
  const steps = el('errNewSteps')?.value?.trim() || '';
  const errorMessage = el('errScanMessage')?.value?.trim() || '';

  if (!cause && !solution) {
    alert(t().causeOrSolutionRequired);
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
  invalidateAllMachineErrorsCache(); // Test 17: البحث التالي (تحت) لازم يشوف الكتابة دي فوراً

  if (result.status !== 'success') {
    alert('❌ ' + (result.message || t().genericSaveError));
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

const _logErrorOccurrence = async function () {

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
  invalidateAllMachineErrorsCache(); // Test 17: البحث التالي (تحت) لازم يشوف الكتابة دي فوراً

  if (result.status === 'success') {
    alert(t().occurrenceLogged);
    loadErrorHistory(lastFoundError.errorCode);
  } else {
    alert('❌ ' + (result.message || t().occurrenceLogFailed));
  }

};

// ============================================================
// اعتماد عطل قيد المراجعة
// ============================================================

const _verifyMachineError = async function (errorId) {

  const result = await verifyMachineErrorApi(errorId);
  invalidateAllMachineErrorsCache(); // Test 17: البحث التالي (تحت) لازم يشوف الكتابة دي فوراً

  alert(result.message || (result.status === 'success' ? t().verifiedSuccess : t().genericError));

  if (result.status === 'success') {
    window.searchMachineError();
  }

};

// ============================================================
// إعادة ضبط الماسح للبحث عن عطل آخر
// ============================================================

window.resetErrorScanner = function () {

  scannedImage = null;
  scannedFile = null;
  lastFoundError = null;
  ocrCandidates = [];
  renderOcrCandidates();

  const preview = el('errScanPreview');
  if (preview) preview.src = '';
  const cropWrap = el('errScanCropWrap');
  if (cropWrap) cropWrap.classList.add('hidden');
  const rawBox = el('errScanRaw');
  if (rawBox) rawBox.value = '';

  const codeInput = el('errScanCode');
  if (codeInput) codeInput.value = '';

  const messageInput = el('errScanMessage');
  if (messageInput) messageInput.value = '';

  const resultsBox = el('errorScanResults');
  if (resultsBox) resultsBox.innerHTML = '';

  setStatus(t().readyStatus);
};

// ============================================================
// Test 16: حماية من الضغط المتكرر السريع على (حفظ عطل جديد / تسجيل
// ظهور / اعتماد) - كانت الأزرار دي بلا أي قفل، فالضغط مرتين أثناء
// الرفع/الحفظ كان بيسجّل ظهور مكرر أو يحفظ نفس العطل مرتين. أي ضغطة
// أثناء عملية شغّالة بتتجاهل، والقفل بيتفك دايماً (حتى لو حصل خطأ)
// ============================================================
let _errorScannerBusy = false;

async function _runErrorScannerOnce(fn) {
  if (_errorScannerBusy) return;
  _errorScannerBusy = true;
  try {
    return await fn();
  } catch (error) {
    invalidateAllMachineErrorsCache();
    console.error("Error scanner action failed:", error);
    alert("❌ " + (error && error.message ? error.message : t().genericError));
  } finally {
    invalidateAllMachineErrorsCache();
    _errorScannerBusy = false;
  }
}

window.saveNewMachineError = (code) => _runErrorScannerOnce(() => _saveNewMachineError(code));
window.logErrorOccurrence = () => _runErrorScannerOnce(() => _logErrorOccurrence());
window.verifyMachineError = (errorId) => _runErrorScannerOnce(() => _verifyMachineError(errorId));
