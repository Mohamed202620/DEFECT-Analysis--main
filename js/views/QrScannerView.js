// ============================================================
// QrScannerView.js
// مسح QR الماكينة -> فتح ملف الماكينة (MachineProfileView) مباشرة.
//
// - الـQR بيحتوي على "قيمة الماكينة" فقط (نفس القيمة المستخدمة في
//   كل قوائم الماكينات بالتطبيق - راجع machines.js: MACHINE_OPTIONS/
//   buildMachineDropdownHtml)، سواء كنص خام أو بصيغة JSON {"m":"..."}
//   أو بادئة "MID:".
// - يحترم صلاحيات القسم تلقائياً: عند مستخدم غير أدمن/مدير/مهندس،
//   قائمة أنواع الماكينات المحمّلة أصلاً مفلترة على قسمه فقط من
//   Firestore (راجع machines.js: loadMachineTypesFromFirestore) -
//   فمينفعش يوصل لبيانات قسم تاني حتى لو مسح QR بتاعه.
// - كاميرا حقيقية عبر BarcodeDetector المدمج في المتصفح لو متاح،
//   وإلا تحميل مكتبة jsQR الخفيفة (~29kB) بشكل كسول عند الحاجة فقط
//   (نفس أسلوب تحميل Tesseract.js في errorScanner.js) - بدون كاميرا،
//   فيه إدخال يدوي (Dropdown مفلتر بنفس صلاحيات المستخدم) كبديل دائماً.
// ============================================================

import { buildMachineDropdownHtml } from '../machines.js';
import { getDepartmentForMachineValue, normalizeDepartment } from '../machines.js';
import { hasFullDataAccess } from '../permissions.js';
import { loadScriptWithFallback } from '../utils/loadExternalScript.js';

let videoStream = null;
let scanRafId = null;
let jsQRLoadPromise = null;

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
    scanAgain: isEn ? 'Scan Again' : 'مسح مرة أخرى'
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
  </div>
  `;
};

// ============================================================
// تحليل نص QR واستخراج "قيمة الماكينة" منه
// ============================================================
function extractMachineValueFromQrText(rawText) {
  let text = String(rawText || '').trim();
  if (!text) return '';

  if (text.toUpperCase().startsWith('MID:')) {
    text = text.slice(4).trim();
  } else {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && parsed.m) {
        text = String(parsed.m).trim();
      } else if (parsed && typeof parsed === 'object' && parsed.machine) {
        text = String(parsed.machine).trim();
      }
    } catch {
      // ليس JSON - نستخدم النص كما هو (القيمة الخام)
    }
  }

  return text;
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
function handleResolvedMachineValue(machineValue) {
  const tr = t();
  const resultBox = document.getElementById('qrResultBox');
  if (!resultBox) return false;

  if (!machineValue) {
    resultBox.innerHTML = `
      <div class="bg-[#1E293B] rounded-xl p-4 border border-red-500/30 text-center">
        <div class="text-sm font-bold text-red-400">${tr.invalidQr}</div>
        <div class="text-[11px] text-gray-400 mt-1">${tr.invalidQrDesc}</div>
      </div>`;
    return false;
  }

  const department = getDepartmentForMachineValue(machineValue);

  if (!department) {
    // إما مش موجودة أصلاً، أو موجودة في قسم تاني مش محمّل أصلاً
    // لهذا المستخدم (راجع تعليق أعلى الملف) - رسالة موحّدة آمنة
    resultBox.innerHTML = `
      <div class="bg-[#1E293B] rounded-xl p-4 border border-red-500/30 text-center">
        <div class="text-sm font-bold text-red-400">${tr.notFound}</div>
        <div class="text-[11px] text-gray-400 mt-1">${tr.notFoundDesc}</div>
      </div>`;
    return false;
  }

  // إصلاح: توحيد قراءة قسم المستخدم عبر normalizeDepartment (نفس
  // المصدر المستخدم في كل مكان آخر بالتطبيق - راجع departmentUtils.js)
  // بدل الاعتماد على trim()/toLowerCase() الخام فقط، عشان أي قيمة
  // قديمة أو غير موحّدة مخزّنة في localStorage متتحسبش خطأً "قسم
  // مختلف" وتمنع المستخدم من الوصول لماكينة قسمه الفعلي.
  const userDept = normalizeDepartment(localStorage.getItem('machineDepartment'));
  if (!hasFullDataAccess() && department !== userDept) {
    resultBox.innerHTML = `
      <div class="bg-[#1E293B] rounded-xl p-4 border border-amber-500/30 text-center">
        <div class="text-sm font-bold text-amber-400">${tr.noPermission}</div>
        <div class="text-[11px] text-gray-400 mt-1">${tr.noPermissionDesc}</div>
      </div>`;
    return false;
  }

  resultBox.innerHTML = `
    <div class="bg-[#1E293B] rounded-xl p-4 border border-emerald-500/30 text-center">
      <div class="text-sm font-bold text-emerald-400">${tr.success}</div>
    </div>`;

  localStorage.setItem('activeMachine', machineValue);
  window.stopQrScan();
  setTimeout(() => window.navigateTo('machineProfile'), 400);
  return true;
}

window.openMachineFromManualSelect = function () {
  const value = document.getElementById('qrManualMachine')?.value || '';
  handleResolvedMachineValue(value.trim());
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
            if (handleResolvedMachineValue(extractMachineValueFromQrText(codes[0].rawValue))) {
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
            if (handleResolvedMachineValue(extractMachineValueFromQrText(code.data))) {
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
