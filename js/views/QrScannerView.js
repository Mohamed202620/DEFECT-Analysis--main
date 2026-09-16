// ============================================================
// QrScannerView.js
// مسح QR الماكينة -> فتح ملف الماكينة (MachineProfileView) مباشرة.
//
// - الـQR بيحتوي على "قيمة الماكينة" (نفس القيمة المستخدمة في كل
//   قوائم الماكينات بالتطبيق - راجع machines.js: MACHINE_OPTIONS/
//   buildMachineDropdownHtml)، سواء كنص خام أو بصيغة JSON
//   {"m":"...","line":"1"} أو بادئة "MID:" أو رابط بباراميتر ?m=.
//
// - إصلاح جذري (كان Admin بيشوف "الماكينة غير موجودة" لماكينة
//   موجودة فعلاً): الشاشة دي كانت بتستخدم "قسم الماكينة" كدليل على
//   وجودها -> getDepartmentForMachineValue() بترجع "" في حالتين
//   مختلفتين تماماً: (1) الماكينة مش موجودة، (2) الماكينة موجودة
//   لكن حقل department بتاعها في Firestore ناقص أو بقيمة مش ضمن
//   backend/frontend. الحالة (2) كانت بتتعامل كـ"غير موجودة" حتى
//   للأدمن، رغم إن الماكينة نفسها ظاهرة في قوائم التطبيق و
//   MachineProfileView بيفتحها عادي. دلوقتي الوجود بيتحدد بالبحث
//   الفعلي في كتالوج الماكينات (resolveMachineFromValue) والصلاحية
//   بتتفحص بعد كده كخطوة منفصلة صريحة - والأدمن/صاحب الوصول الكامل
//   بيتخطى فلترة القسم بالكامل.
//
// - صلاحيات غير الأدمن زي ما هي بالظبط: لازم قسم الماكينة = قسم
//   المستخدم، وأي ماكينة بقسم غير محدد أو مختلف بترفض برسالة
//   "لا توجد صلاحية" (مع إن كتالوج الماكينات المحمّل لغير الأدمن
//   أصلاً مفلتر على قسمه من Firestore).
// - كاميرا حقيقية عبر BarcodeDetector المدمج في المتصفح لو متاح،
//   وإلا تحميل مكتبة jsQR الخفيفة (~29kB) بشكل كسول عند الحاجة فقط
//   (نفس أسلوب تحميل Tesseract.js في errorScanner.js) - بدون كاميرا،
//   فيه إدخال يدوي (Dropdown مفلتر بنفس صلاحيات المستخدم) كبديل دائماً.
// ============================================================

import { buildMachineDropdownHtml } from '../machines.js';
import {
  resolveMachineFromValue,
  normalizeDepartment,
  normalizeLine,
  formatLineLabel,
  isMachineTypesLoaded,
  ensureMachineCatalogReady,
  findMachineEntryByValue
} from '../machines.js';
import { hasFullDataAccess, isAdminRole, getCurrentRole } from '../permissions.js';
import { loadScriptWithFallback } from '../utils/loadExternalScript.js';
import { updateMachineTypeApi } from '../services/machinesApi.js';

let videoStream = null;
let scanRafId = null;
let jsQRLoadPromise = null;
let qrCodeLoadPromise = null;

function loadQrCodeLib() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  if (qrCodeLoadPromise) return qrCodeLoadPromise;

  qrCodeLoadPromise = loadScriptWithFallback(
    ['./js/vendor/qrcode-generator.js'],
    () => window.qrcode
  ).catch(err => {
    qrCodeLoadPromise = null;
    throw err;
  });

  return qrCodeLoadPromise;
}

function buildQrCode(text) {
  const utf8Text = unescape(encodeURIComponent(text));
  for (let typeNumber = 1; typeNumber <= 40; typeNumber += 1) {
    try {
      const qr = window.qrcode(typeNumber, 'M');
      qr.addData(utf8Text);
      qr.make();
      return qr;
    } catch (err) {
      continue;
    }
  }
  throw new Error('QR data too long to encode');
}

function drawQrToCanvas(qr, canvas, targetSize = 220, marginModules = 2) {
  const moduleCount = qr.getModuleCount();
  const totalModules = moduleCount + marginModules * 2;
  const cellSize = Math.max(2, Math.floor(targetSize / totalModules));
  const size = totalModules * cellSize;

  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000000';

  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (qr.isDark(row, col)) {
        ctx.fillRect(
          (col + marginModules) * cellSize,
          (row + marginModules) * cellSize,
          cellSize,
          cellSize
        );
      }
    }
  }
}

window.generateMachineQr = async function() {
  const machineValue = document.getElementById('qrGenMachine')?.value;
  const lineValue = document.getElementById('qrGenLine')?.value;
  
  if (!machineValue) {
    alert((window.currentLang || 'ar') === 'en' ? 'Please select a machine first' : 'يرجى اختيار الماكينة أولاً');
    return;
  }
  if (!lineValue) {
    alert((window.currentLang || 'ar') === 'en' ? 'Please select a line' : 'يرجى اختيار خط الإنتاج');
    return;
  }

  const resultBox = document.getElementById('qrGenResult');
  const canvasBox = document.getElementById('qrGenCanvasBox');
  const payloadText = document.getElementById('qrGenPayloadText');
  const btn = document.querySelector('button[onclick="window.generateMachineQr()"]');
  const originalBtnText = btn.innerHTML;

  try {
    btn.disabled = true;
    btn.innerHTML = (window.currentLang || 'ar') === 'en' ? 'Generating...' : 'جاري التوليد...';

    const machineFound = findMachineEntryByValue(machineValue);
    if (machineFound && machineFound.entry && machineFound.entry.id) {
      const entry = machineFound.entry;
      await updateMachineTypeApi(entry.id, entry.key, entry.units, undefined, lineValue);
    }

    await loadQrCodeLib();
    
    const payload = JSON.stringify({ m: machineValue, line: lineValue });
    const qr = buildQrCode(payload);
    
    const canvas = document.createElement('canvas');
    canvas.className = 'w-48 h-48 sm:w-56 sm:h-56 rounded-md shadow-sm';
    drawQrToCanvas(qr, canvas);
    
    canvasBox.innerHTML = '';
    canvasBox.appendChild(canvas);
    payloadText.textContent = payload;
    
    resultBox.classList.remove('hidden');

  } catch (error) {
    console.error('Error generating QR:', error);
    alert((window.currentLang || 'ar') === 'en' ? 'Failed to generate QR code' : 'فشل توليد رمز QR');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalBtnText;
  }
};

function t() {
  const isEn = (window.currentLang || 'ar') === 'en';
  return {
    title: isEn ? '📱 Machine QR' : '📱 مسح QR الماكينة',
    subtitle: isEn
      ? 'Scan the machine QR code to open its profile directly'
      : 'امسح QR الماكينة لفتح ملفها مباشرة',
    startCamera: isEn ? '📷 Start Camera Scan' : '📷 بدء المسح بالكاميرا',
    stopCamera: isEn ? '⏹️ Stop Camera' : '⏹️ إيقاف الكاميرا',
    manualTitle: isEn ? 'Or choose the machine manually' : 'أو اختر الماكينة يدويًا',
    openBtn: isEn ? 'Open Machine Profile' : 'فتح ملف الماكينة',
    scanning: isEn ? 'Scanning... point the camera at the QR code' : 'جاري المسح... وجّه الكاميرا نحو رمز QR',
    cameraError: isEn ? 'Could not access the camera. Use manual selection instead.' : 'تعذر الوصول للكاميرا. استخدم الاختيار اليدوي بدلاً من ذلك.',
    invalidQr: isEn ? '❌ Invalid QR Code' : '❌ رمز QR غير صالح',
    invalidQrDesc: isEn ? 'This QR code does not contain a recognizable machine code.' : 'رمز QR هذا لا يحتوي على كود ماكينة معروف.',
    notFound: isEn ? '❌ Machine Not Found' : '❌ الماكينة غير موجودة',
    notFoundDesc: isEn ? 'No machine matches this code, or you do not have permission to access it.' : 'لا توجد ماكينة مطابقة لهذا الكود، أو ليس لديك صلاحية الوصول إليها.',
    noPermission: isEn ? '🔒 No Permission' : '🔒 لا توجد صلاحية',
    noPermissionDesc: isEn ? 'This machine belongs to a department you do not have access to.' : 'هذه الماكينة تابعة لقسم لا تملك صلاحية الوصول إليه.',
    success: isEn ? '✅ Machine found - opening profile...' : '✅ تم التعرف على الماكينة - جاري فتح الملف...',
    scanAgain: isEn ? 'Scan Again' : 'مسح مرة أخرى',
    scannedCode: isEn ? 'Scanned code' : 'الكود الممسوح',
    checking: isEn ? 'Checking machine...' : 'جاري التحقق من الماكينة...'
  };
}

export const QrScannerView = () => {
  const isEn = (window.currentLang || 'ar') === 'en';
  const tr = t();

  return `
  <div class="app-page p-3 sm:p-4 max-w-md sm:max-w-xl md:max-w-3xl mx-auto pb-24 text-white">
    <button onclick="window.goBack('home')" class="mb-5 bg-gray-800 hover:bg-gray-700 active:scale-95 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm min-h-[38px] cursor-pointer">
      <span class="text-amber-400 font-black">${isEn ? '←' : '→'}</span>
      <span>${isEn ? 'Back Home' : 'رجوع للرئيسية'}</span>
    </button>

    <div class="mb-5 border-b border-gray-800 pb-2">
      <h2 class="text-lg font-bold text-blue-400 flex items-center gap-2">${tr.title}</h2>
      <p class="text-[11px] text-gray-400 mt-1">${tr.subtitle}</p>
    </div>

    <div class="bg-[#1E293B] p-4 rounded-xl border border-gray-800 space-y-3">
      <div id="qrVideoBox" class="hidden relative rounded-xl overflow-hidden bg-black aspect-square max-w-xs mx-auto border-2 border-blue-500/40">
        <video id="qrVideo" class="w-full h-full object-cover" playsinline muted></video>
        <div class="absolute inset-0 border-[3px] border-blue-400/60 m-8 rounded-xl pointer-events-none"></div>
      </div>

      <div id="qrStatusBox" class="text-center text-xs text-gray-400 py-2"></div>

      <button id="qrStartBtn" onclick="window.startQrScan()" class="w-full p-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] font-bold text-xs text-white transition-all">
        ${tr.startCamera}
      </button>
      <button id="qrStopBtn" onclick="window.stopQrScan()" class="w-full p-3 rounded-xl bg-gray-700 hover:bg-gray-600 active:scale-[0.98] font-bold text-xs text-white transition-all hidden">
        ${tr.stopCamera}
      </button>
    </div>

    <div id="qrResultBox" class="mt-4"></div>

    <div class="bg-[#1E293B] p-4 rounded-xl border border-gray-800 space-y-3 mt-4">
      <h3 class="text-xs font-bold text-gray-300">${tr.manualTitle}</h3>
      ${buildMachineDropdownHtml('qrManualMachine', {
        placeholderLabel: isEn ? 'Select machine...' : 'اختر الماكينة...',
        unitPlaceholderLabel: isEn ? 'Select number...' : 'اختر الرقم...'
      })}
      <button onclick="window.openMachineFromManualSelect()" class="w-full p-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 font-bold text-xs text-white transition">
        ${tr.openBtn}
      </button>
    </div>

    ${isAdminRole(getCurrentRole()) ? `
    <div id="qrGenerateSection" class="bg-[#1E293B] p-4 rounded-xl border border-gray-800 space-y-3 mt-4">
      <h3 class="text-xs font-bold text-gray-300">${isEn ? 'Generate QR Code' : 'توليد QR للماكينة'}</h3>
      ${buildMachineDropdownHtml('qrGenMachine', {
        placeholderLabel: isEn ? 'Select machine...' : 'اختر الماكينة...',
        unitPlaceholderLabel: isEn ? 'Select number...' : 'اختر الرقم...'
      })}
      
      <select id="qrGenLine" class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white outline-none focus:border-blue-500 transition text-sm appearance-none shadow-sm mt-2">
        <option value="" disabled selected>${isEn ? 'Select Line...' : 'اختر الخط...'}</option>
        <option value="1">Line 1</option>
        <option value="2">Line 2</option>
      </select>

      <button onclick="window.generateMachineQr()" class="w-full p-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-95 font-bold text-xs text-white transition mt-2">
        ${isEn ? 'Generate QR' : 'توليد QR'}
      </button>

      <div id="qrGenResult" class="hidden mt-3 text-center flex flex-col items-center justify-center p-4 bg-white rounded-xl">
        <div id="qrGenCanvasBox" class="mb-2"></div>
        <div class="text-[10px] text-gray-600 font-mono" id="qrGenPayloadText"></div>
      </div>
    </div>
    ` : ''}
  </div>
  `;
};

// ============================================================
// تحليل نص QR واستخراج "قيمة الماكينة" منه
// ============================================================
// بيرجّع { value, line } - الـline اختياري تماماً (بيتاخد من الـQR
// لو موجود، وإلا بيتاخد من بيانات الماكينة نفسها بعد البحث).
// كل الصيغ المدعومة متوافقة للخلف مع أي QR متطبوع قبل كده:
//   "Bodymaker 01"
//   "MID:<docId>"  |  "MID:Bodymaker 01"
//   {"m":"Bodymaker 01","line":"1"}   (ونفس الشيء بـ machine/u/unit)
//   "https://.../?m=Bodymaker%2001&line=1"
//   "Bodymaker 01|1"
function parseQrPayload(rawText) {
  const text = String(rawText || '').trim();
  if (!text) return { value: '', line: '' };

  // 1) JSON
  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') {
        const type = String(parsed.m ?? parsed.machine ?? parsed.machineValue ?? parsed.v ?? parsed.id ?? '').trim();
        const unit = String(parsed.u ?? parsed.unit ?? '').trim();
        return {
          value: unit ? `${type} ${unit}`.trim() : type,
          line: normalizeLine(parsed.line ?? parsed.l ?? parsed.productionLine ?? '')
        };
      }
    } catch {
      // مش JSON صالح - بنكمل للصيغ التانية
    }
  }

  // 2) رابط فيه باراميتر للماكينة
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      const value = url.searchParams.get('m') || url.searchParams.get('machine') || '';
      if (value) {
        return {
          value: String(value).trim(),
          line: normalizeLine(url.searchParams.get('line') || url.searchParams.get('l') || '')
        };
      }
    } catch {
      // رابط غير صالح - بنكمل
    }
  }

  // 3) نص خام (مع دعم "MID:" ودعم فاصل الخط "|")
  let body = text;
  if (body.toUpperCase().startsWith('MID:')) {
    body = body.slice(4).trim();
  }

  const parts = body.split('|');
  if (parts.length > 1) {
    return { value: parts[0].trim(), line: normalizeLine(parts.slice(1).join('|')) };
  }

  return { value: body, line: '' };
}

function renderQrMessage({ tone, title, desc, extra = '' }) {
  const resultBox = document.getElementById('qrResultBox');
  if (!resultBox) return;

  const border = tone === 'error'
    ? 'border-red-500/30'
    : tone === 'warn' ? 'border-amber-500/30' : 'border-emerald-500/30';

  const titleColor = tone === 'error'
    ? 'text-red-400'
    : tone === 'warn' ? 'text-amber-400' : 'text-emerald-400';

  resultBox.innerHTML = `
    <div class="bg-[#1E293B] rounded-xl p-4 border ${border} text-center">
      <div class="text-sm font-bold ${titleColor}">${title}</div>
      ${desc ? `<div class="text-[11px] text-gray-400 mt-1">${desc}</div>` : ''}
      ${extra}
    </div>`;
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================
// معالجة قيمة ماكينة تم التعرف عليها (من QR أو الاختيار اليدوي)
// إصلاح (تماشي مع فلو الصلاحيات): كانت بترجع undefined دايماً بدون
// تفرقة بين "نجاح" و"فشل" - الاستدعاء من الكاميرا (tick) كان بيتعامل
// مع أي استدعاء لهذه الدالة على إنه "تم التعرف على كود" فيوقف حلقة
// المسح تماماً حتى لو الكود غير صالح/غير موجود/بلا صلاحية، فيفضل
// الفيديو ظاهر وزر "إيقاف الكاميرا" شغّال بصريًا لكن بدون أي مسح
// فعلي شغّال تحته. دلوقتي بترجع true فقط في حالة النجاح الفعلي
// (فتح ملف الماكينة) عشان الكاميرا تكمل المسح تلقائيًا في أي حالة
// تانية (راجع tick() تحت).
async function handleResolvedMachineValue(payload) {
  const tr = t();
  const resultBox = document.getElementById('qrResultBox');
  if (!resultBox) return false;

  const scannedValue = String(payload?.value || '').trim();
  const qrLine = normalizeLine(payload?.line);

  if (!scannedValue) {
    renderQrMessage({ tone: 'error', title: tr.invalidQr, desc: tr.invalidQrDesc });
    return false;
  }

  // 1) البحث الفعلي عن الماكينة في كتالوج التطبيق - لازم يكون
  //    محمّل من Firestore قبل الحكم بـ"غير موجودة"، وإلا البحث
  //    بيتم على القائمة الافتراضية الاحتياطية بس (سبب إضافي كان
  //    بيدي "الماكينة غير موجودة" لماكينات مضافة يدوياً)
  if (!isMachineTypesLoaded()) {
    renderQrMessage({ tone: 'ok', title: tr.checking, desc: '' });
    await ensureMachineCatalogReady();
  }

  const machine = resolveMachineFromValue(scannedValue);

  if (!machine.found) {
    renderQrMessage({
      tone: 'error',
      title: tr.notFound,
      desc: tr.notFoundDesc,
      extra: `<div class="text-[10px] text-gray-500 mt-2 font-mono break-all">${tr.scannedCode}: ${escapeHtml(scannedValue)}</div>`
    });
    return false;
  }

  // 2) الصلاحية - خطوة منفصلة تماماً عن الوجود.
  //    Admin / صاحب وصول كامل: يتخطى أي فلترة قسم للماكينات.
  //    غير كده: لازم قسم الماكينة = قسم المستخدم (زي ما كان بالظبط،
  //    بدون أي تخفيف).
  if (!hasFullDataAccess()) {
    const userDept = normalizeDepartment(localStorage.getItem('machineDepartment'));
    if (!userDept || !machine.department || machine.department !== userDept) {
      renderQrMessage({ tone: 'warn', title: tr.noPermission, desc: tr.noPermissionDesc });
      return false;
    }
  }

  // 3) خط الإنتاج: الخط المسجّل على الماكينة نفسها هو مصدر الحقيقة،
  //    والخط الجاي في الـQR بيُستخدم فقط لو الماكينة لسه متسجّلش
  //    ليها خط (توافق مع أكواد QR متطبوعة قبل إضافة الحقل)
  const line = machine.line || qrLine || '';
  const lineLabel = formatLineLabel(line);

  renderQrMessage({
    tone: 'ok',
    title: tr.success,
    desc: '',
    extra: `<div class="text-[11px] text-gray-300 mt-1 font-bold">${escapeHtml(machine.value)}${lineLabel ? ` · 🏭 ${lineLabel}` : ''}</div>`
  });

  // بنخزّن القيمة المعيارية للماكينة (زي ما القوائم المنسدلة
  // بتنتجها بالظبط) مش النص الخام الممسوح - عشان كل الشاشات
  // اللاحقة (ملف الماكينة/Daily AM/5S) تلاقي نفس السجلات
  localStorage.setItem('activeMachine', machine.value);

  if (line) {
    localStorage.setItem('activeMachineLine', line);
  } else {
    localStorage.removeItem('activeMachineLine');
  }

  window.stopQrScan();
  setTimeout(() => window.navigateTo('machineProfile'), 400);
  return true;
}

window.openMachineFromManualSelect = function () {
  const value = document.getElementById('qrManualMachine')?.value || '';
  // نفس المسار بالظبط المستخدم بعد مسح الـQR - مفيش منطق منفصل
  handleResolvedMachineValue({ value: value.trim(), line: '' });
};

// ============================================================
// الكاميرا + قراءة QR
// ============================================================
// ============================================================
// إصلاح (نفس بند MachineProfileView.js - راجع utils/loadExternalScript.js
// لتفاصيل كاملة): تصفير jsQRLoadPromise عند الفشل عشان محاولة
// المسح التالية (لو المستخدم رجّع الإنترنت وضغط "بدء المسح" تاني)
// تعمل تحميل شبكة جديدة فعلياً بدل ما ترجع نفس الفشل القديم للأبد،
// + تجربة مصدر CDN بديل (unpkg) قبل الاستسلام.
// ============================================================
function loadJsQR() {
  if (window.jsQR) return Promise.resolve(window.jsQR);
  if (jsQRLoadPromise) return jsQRLoadPromise;

  jsQRLoadPromise = loadScriptWithFallback(
    [
      'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',
      'https://unpkg.com/jsqr@1.4.0/dist/jsQR.js'
    ],
    () => window.jsQR
  ).catch(err => {
    jsQRLoadPromise = null;
    throw err;
  });

  return jsQRLoadPromise;
}

function setQrStatus(message, isError = false) {
  const box = document.getElementById('qrStatusBox');
  if (!box) return;
  box.textContent = message;
  box.classList.toggle('text-red-400', isError);
  box.classList.toggle('text-gray-400', !isError);
}

window.startQrScan = async function () {
  const tr = t();
  const videoBox = document.getElementById('qrVideoBox');
  const video = document.getElementById('qrVideo');
  const startBtn = document.getElementById('qrStartBtn');
  const stopBtn = document.getElementById('qrStopBtn');

  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
  } catch (err) {
    setQrStatus(tr.cameraError, true);
    return;
  }

  video.srcObject = videoStream;
  await video.play();

  videoBox?.classList.remove('hidden');
  startBtn?.classList.add('hidden');
  stopBtn?.classList.remove('hidden');
  setQrStatus(tr.scanning);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const useNative = 'BarcodeDetector' in window;
  let detector = null;
  if (useNative) {
    try {
      detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    } catch {
      // fallback لـ jsQR تحت لو الإنشاء فشل لأي سبب
    }
  }

  if (!detector) {
    try {
      await loadJsQR();
    } catch {
      setQrStatus(tr.cameraError, true);
      window.stopQrScan();
      return;
    }
  }

  // كتالوج الماكينات لازم يكون جاهز قبل أول عملية بحث - لو فشل
  // التحميل هنا، handleResolvedMachineValue بتحاول تاني قبل ما
  // تحكم بـ"غير موجودة" (راجع فوق)
  try {
    await ensureMachineCatalogReady();
  } catch (e) {
    console.warn("Error ensuring machines are loaded:", e);
  }

  const tick = async () => {
    if (!videoStream) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      try {
        if (detector) {
          const codes = await detector.detect(video);
          if (codes && codes.length) {
            // إصلاح: نكمل حلقة المسح تلقائيًا لو الكود غير صالح/غير
            // موجود/بلا صلاحية (بترجع false) بدل ما تتجمد الكاميرا
            // بصريًا وهي فعليًا متوقفة عن المسح - راجع تعليق
            // handleResolvedMachineValue فوق.
            if (await handleResolvedMachineValue(parseQrPayload(codes[0].rawValue))) {
              return;
            }
          }
        } else if (window.jsQR) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = window.jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            if (await handleResolvedMachineValue(parseQrPayload(code.data))) {
              return;
            }
          }
        }
      } catch {
        // إطار غير صالح - نتجاهله ونكمل المحاولة على الإطار التالي
      }
    }

    scanRafId = requestAnimationFrame(tick);
  };

  scanRafId = requestAnimationFrame(tick);
};

window.stopQrScan = function () {
  if (scanRafId) {
    cancelAnimationFrame(scanRafId);
    scanRafId = null;
  }
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
  }

  document.getElementById('qrVideoBox')?.classList.add('hidden');
  document.getElementById('qrStartBtn')?.classList.remove('hidden');
  document.getElementById('qrStopBtn')?.classList.add('hidden');
  setQrStatus('');
};
