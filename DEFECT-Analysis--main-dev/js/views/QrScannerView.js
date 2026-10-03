// ============================================================
// QrScannerView.js - QR-IMPROVE
// مسح QR الماكينة -> بطاقة إجراءات سريعة + فتح ملف الماكينة مباشرة
//
// - الـQR بيحتوي على "قيمة الماكينة" (نفس القيمة المستخدمة في كل
//   قوائم الماكينات بالتطبيق - راجع machines.js: MACHINE_OPTIONS/
//   buildMachineDropdownHtml)، سواء كنص خام أو بصيغة JSON
//   {"m":"...","line":"1"} أو بادئة "MID:" أو رابط بباراميتر ?m=.
//
// - حماية الصلاحيات: الأدمن/صاحب الوصول الكامل يتخطى فلترة القسم،
//   وغيره لازم قسم الماكينة = قسم المستخدم.
// - كاميرا حقيقية عبر BarcodeDetector المدمج في المتصفح لو متاح،
//   وإلا تحميل مكتبة jsQR المحلية (js/vendor/jsQR.js) أوفلاين مع
//   Fallback لـ CDN عند الحاجة.
// - فلاش (Torch) وتبديل كاميرا وإطار تركيز بصري لبيئات الورش.
// - تنظيف كامل عند إخفاء التبويب (visibilitychange) أو مغادرة الصفحة.
// - بطاقة نتائج سريعة تفاعلية (ملف الماكينة / فحص AM / فحص 5S / بلاغ عطل).
// - طباعة شبكة ملصقات QR لجميع الماكينات للمدير والأدمن.
// ============================================================

import { buildMachineDropdownHtml } from '../machines.js';
import {
  resolveMachineFromValue,
  normalizeDepartment,
  normalizeLine,
  formatLineLabel,
  isMachineTypesLoaded,
  ensureMachineCatalogReady,
  findMachineEntryByValue,
  machineExistsInAnyDepartment,
  getMachineTypeEntries
} from '../machines.js';
import { hasFullDataAccess, isAdminRole, getCurrentRole, hasPermission } from '../permissions.js'; // QR-IMPROVE
import { loadScriptWithFallback } from '../utils/loadExternalScript.js';
import { escapeJsArg } from "../utils/escapeHtml.js";

let videoStream = null;
let scanRafId = null;
let jsQRLoadPromise = null;
let qrCodeLibPromise = null; // QR-IMPROVE
let currentFacingMode = 'environment'; // QR-IMPROVE: environment or user
let isTorchOn = false; // QR-IMPROVE
let lastScannedText = ''; // QR-IMPROVE: debounce
let lastScannedTime = 0; // QR-IMPROVE: debounce
let visibilityListenerAttached = false; // QR-IMPROVE

function t() {
  const isEn = (window.currentLang || 'ar') === 'en';
  return {
    title: isEn ? 'Machine QR Scanner' : 'مسح QR الماكينات',
    subtitle: isEn
      ? 'Scan the machine QR code to open its profile or perform quick actions'
      : 'امسح رمز QR الماكينة لفتح ملفها أو بدء الفحص السريع',
    startCamera: isEn ? 'Start Camera Scan' : 'بدء المسح بالكاميرا',
    stopCamera: isEn ? 'Stop Camera' : 'إيقاف الكاميرا',
    torchOn: isEn ? 'Torch On' : 'تشغيل الفلاش',
    torchOff: isEn ? 'Torch Off' : 'إيقاف الفلاش',
    flipCam: isEn ? 'Switch Camera' : 'تبديل الكاميرا',
    manualTitle: isEn ? 'Or select machine manually' : 'أو اختر الماكينة يدويًا',
    manualDesc: isEn ? 'Choose from registered machines in your department' : 'اختر من الماكينات المسجلة المتاحة لقسمك',
    openBtn: isEn ? 'Open Machine Profile' : 'فتح ملف الماكينة',
    scanning: isEn ? 'Scanning... point camera at machine QR sticker' : 'جاري المسح... وجّه الكاميرا نحو ملصق QR على الماكينة',
    cameraError: isEn ? 'Could not access camera. Use manual selection below.' : 'تعذر الوصول للكاميرا. استخدم الاختيار اليدوي أدناه.',
    permDenied: isEn ? 'Camera access was denied. Please allow camera in browser settings or use manual selection.' : 'تم رفض إذن الكاميرا. يرجى تفعيل إذن الكاميرا من إعدادات المتصفح أو الاختيار يدوياً.',
    notFoundCam: isEn ? 'No camera found on this device. Please select machine manually.' : 'لم يتم العثور على كاميرا في هذا الجهاز. يرجى اختيار الماكينة يدوياً.',
    camInUse: isEn ? 'Camera is busy or in use by another app.' : 'الكاميرا مشغولة أو قيد الاستخدام من تطبيق آخر.',
    httpsRequired: isEn ? 'Camera access requires a secure HTTPS connection.' : 'استخدام الكاميرا يتطلب اتصالاً آمناً (HTTPS).',
    invalidQr: isEn ? 'Unknown QR Code' : 'كود QR غير معروف',
    invalidQrDesc: isEn ? 'This QR code does not contain a recognized machine identifier.' : 'رمز QR هذا لا يحتوي على كود ماكينة مسجل بالنظام.',
    notFound: isEn ? 'Machine Not Found' : 'الماكينة غير موجودة',
    notFoundDesc: isEn ? 'No machine matches this code in the system catalog.' : 'لا توجد ماكينة مطابقة لهذا الكود في كتالوج النظام.',
    inactiveMachine: isEn ? 'Machine Disabled' : 'الماكينة معطّلة',
    inactiveMachineDesc: isEn ? 'This machine is disabled in the catalog, so quick actions are not available. Contact your manager if it should be active.' : 'هذه الماكينة معطّلة في الكتالوج فلا تتوفر لها إجراءات سريعة. تواصل مع المسؤول لو المفروض إنها مفعّلة.',
    noPermission: isEn ? 'No Department Permission' : 'لا توجد صلاحية لهذا القسم',
    noPermissionDesc: isEn ? 'This machine belongs to another department you do not have permission to access.' : 'هذه الماكينة تابعة لقسم لا تملك صلاحية الوصول إليه.',
    yourDept: isEn ? 'Your Department' : 'قسمك الحالي',
    success: isEn ? 'Machine Identified' : 'تم التعرف على الماكينة',
    scanAgain: isEn ? 'Scan / Select Another Machine' : 'مسح / اختيار ماكينة أخرى',
    scannedCode: isEn ? 'Scanned Code' : 'الكود المقروء',
    checking: isEn ? 'Checking machine catalog...' : 'جاري التحقق من كتالوج الماكينات...',
    copyCode: isEn ? 'Copy Code' : 'نسخ الكود',
    copied: isEn ? 'Copied!' : 'تم النسخ!',
    runAm: isEn ? 'Start Daily AM Check' : 'بدء فحص AM اليومي',
    run5s: isEn ? 'Start 5S Inspection' : 'بدء تقييم 5S',
    reportDefect: isEn ? 'Report Breakdown / Issue' : 'الإبلاغ عن عطل',
    printSheetBtn: isEn ? 'Print Machine QR Stickers (A4)' : 'طباعة ملصقات QR للماكينات (A4)',
    printModalTitle: isEn ? 'Machine QR Stickers (Print Preview)' : 'ملصقات QR للماكينات (جاهزة للطباعة)',
    printNow: isEn ? 'Print Sheet' : 'طباعة الآن',
    close: isEn ? 'Close' : 'إغلاق'
  };
}

export const QrScannerView = () => {
  const isEn = (window.currentLang || 'ar') === 'en';
  const tr = t();
  const canManageMachines = isAdminRole(getCurrentRole()) || hasPermission("machines"); // QR-IMPROVE

  // تهيئة مستمع إخفاء التبويب لإيقاف الكاميرا فوراً وحفظ البطارية
  initVisibilityListener(); // QR-IMPROVE

  return `
  <div class="app-page p-3 sm:p-4 max-w-md sm:max-w-xl md:max-w-3xl mx-auto pb-24 text-white">
    <!-- شريط الرجوع والأدوات -->
    <div class="flex items-center justify-between mb-4">
      <button onclick="window.goBack('home')" class="bg-gray-800 hover:bg-gray-700 active:scale-95 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm min-h-[38px] cursor-pointer">
        <span class="text-amber-400 font-black">${isEn ? '←' : '→'}</span>
        <span>${isEn ? 'Back Home' : 'رجوع للرئيسية'}</span>
      </button>

      ${canManageMachines ? `
      <button
        type="button"
        onclick="window.openBatchQrPrintModal()"
        class="bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 active:scale-95 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer">
        <span>🖨️</span>
        <span class="hidden sm:inline">${isEn ? 'Print QR Sheet' : 'طباعة ملصقات QR'}</span>
        <span class="sm:hidden">${isEn ? 'Print' : 'طباعة'}</span>
      </button>
      ` : ''}
    </div>

    <!-- العنوان والوصف -->
    <div class="mb-4 border-b border-gray-800 pb-2.5">
      <h2 class="text-lg font-bold text-blue-400 flex items-center gap-2">${tr.title}</h2>
      <p class="text-[11px] text-gray-400 mt-1">${tr.subtitle}</p>
    </div>

    <!-- بطاقة الكاميرا الرئيسية والمسح -->
    <div class="bg-[#1E293B] p-4 rounded-2xl border border-gray-800 space-y-3 shadow-lg">
      
      <!-- نافذة الكاميرا التفاعلية مع إطار التركيز البصري والتحكم -->
      <div id="qrVideoBox" class="hidden relative rounded-2xl overflow-hidden bg-black aspect-square max-w-xs mx-auto border-2 border-blue-500/50 shadow-inner">
        <video id="qrVideo" class="w-full h-full object-cover" playsinline muted></video>

        <!-- أزرار التحكم الطافية داخل نافذة الكاميرا (فلاش + تبديل الكاميرا) -->
        <div class="absolute top-2.5 inset-x-2.5 flex items-center justify-between pointer-events-auto z-20">
          <button
            id="qrTorchBtn"
            type="button"
            onclick="window.toggleQrTorch()"
            class="hidden px-2.5 py-1.5 rounded-xl bg-black/70 backdrop-blur-md text-amber-300 border border-amber-500/30 active:scale-90 transition text-xs font-bold flex items-center gap-1 cursor-pointer">
            <span id="qrTorchIcon">🔦</span>
            <span id="qrTorchText" class="text-[10px]">${isEn ? 'Torch' : 'فلاش'}</span>
          </button>

          <button
            id="qrFlipBtn"
            type="button"
            onclick="window.flipQrCamera()"
            class="px-2.5 py-1.5 rounded-xl bg-black/70 backdrop-blur-md text-white border border-white/20 active:scale-90 transition text-xs font-bold flex items-center gap-1 ms-auto cursor-pointer"
            title="${tr.flipCam}">
            <span>🔄</span>
            <span class="text-[10px] hidden sm:inline">${isEn ? 'Flip' : 'تبديل'}</span>
          </button>
        </div>

        <!-- إطار التركيز البصري المحسّن لبيئات الورش والمصانع ذات الإضاءة الضعيفة -->
        <div class="absolute inset-0 pointer-events-none flex items-center justify-center p-8 z-10">
          <div class="relative w-full h-full border border-blue-400/30 rounded-2xl flex items-center justify-center overflow-hidden">
            <!-- زوايا التركيز البارزة -->
            <div class="absolute top-0 start-0 w-6 h-6 border-t-4 border-s-4 border-emerald-400 rounded-ts-lg"></div>
            <div class="absolute top-0 end-0 w-6 h-6 border-t-4 border-e-4 border-emerald-400 rounded-te-lg"></div>
            <div class="absolute bottom-0 start-0 w-6 h-6 border-b-4 border-s-4 border-emerald-400 rounded-bs-lg"></div>
            <div class="absolute bottom-0 end-0 w-6 h-6 border-b-4 border-e-4 border-emerald-400 rounded-be-lg"></div>
            <!-- شعاع ليزر مسح متحرك -->
            <div class="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#10b981] animate-pulse"></div>
          </div>
        </div>
      </div>

      <!-- صندوق حالة الكاميرا -->
      <div id="qrStatusBox" class="text-center text-xs text-gray-400 py-1 font-medium min-h-[20px]"></div>

      <!-- أزرار بدء وإيقاف الكاميرا -->
      <div class="flex gap-2">
        <button id="qrStartBtn" onclick="window.startQrScan()" class="w-full p-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] font-bold text-xs text-white transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer">
          <span>📷</span>
          <span>${tr.startCamera}</span>
        </button>
        <button id="qrStopBtn" onclick="window.stopQrScan()" class="w-full p-3 rounded-xl bg-gray-700 hover:bg-gray-600 active:scale-[0.98] font-bold text-xs text-white transition-all hidden shadow-md flex items-center justify-center gap-2 cursor-pointer">
          <span>⏹️</span>
          <span>${tr.stopCamera}</span>
        </button>
      </div>
    </div>

    <!-- صندوق نتيجة المسح السريعة (Quick Action Card) -->
    <div id="qrResultBox" class="mt-4"></div>

    <!-- قسم الاختيار اليدوي للماكينة -->
    <div id="qrManualSection" class="bg-[#1E293B] p-4 rounded-2xl border border-gray-800 space-y-3 mt-4 shadow-lg">
      <div>
        <h3 class="text-xs font-bold text-gray-200 flex items-center gap-1.5">
          <span>⚙️</span>
          <span>${tr.manualTitle}</span>
        </h3>
        <p class="text-[10px] text-gray-400 mt-0.5">${tr.manualDesc}</p>
      </div>

      ${buildMachineDropdownHtml('qrManualMachine', {
        placeholderLabel: isEn ? 'Select machine type...' : 'اختر نوع الماكينة...',
        unitPlaceholderLabel: isEn ? 'Select machine number...' : 'اختر رقم الماكينة...'
      })}

      <select id="qrManualLine" class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white outline-none focus:border-blue-500 transition text-sm appearance-none shadow-sm mt-2">
        <option value="" disabled selected>${isEn ? 'Select Line (Optional)...' : 'اختر الخط (اختياري)...'}</option>
        <option value="1">${isEn ? 'Line 1' : 'الخط 1'}</option>
        <option value="2">${isEn ? 'Line 2' : 'الخط 2'}</option>
      </select>

      <button onclick="window.openMachineFromManualSelect()" class="w-full p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 font-bold text-xs text-white transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer">
        <span>🔍</span>
        <span>${tr.openBtn}</span>
      </button>
    </div>
  </div>
  `;
};

// ============================================================
// تحليل نص QR واستخراج "قيمة الماكينة" منه
// ============================================================
function decodeBase64QrPayload(text) {
  if (!text || /\s/.test(text)) return null;
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(text)) return null;

  try {
    let b64 = text.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes).trim();
    if (/^(\{|mid:|https?:\/\/)/i.test(decoded)) return decoded;
  } catch (_) {
    // ليس Base64 صالحاً - النص الأصلي يُستخدم كما هو
  }
  return null;
}

function parseQrPayload(rawText) {
  let text = String(rawText || '').trim();
  if (!text) return { value: '', line: '' };

  // 0) فك التشفير (Base64) - بشروط صارمة.
  // إصلاح (بند مؤكد - قراءة QR): الفك القديم كان بيجرّب atob() على أي
  // نص، و atob بيتجاهل المسافات وبيقبل أي نص حروفه/أرقامه فقط، فأي QR
  // لنص خام زي "Bodymaker 01" أو "Cupper" أو "Spray 03" (وده بالظبط
  // اللي بيولّده زر توليد QR في ملف الماكينة للماكينات بدون خط) كان
  // بيتفك لبيانات عشوائية وبيتستبدل بيها النص الأصلي فتظهر "الماكينة
  // غير موجودة" لمعظم الماكينات الصحيحة. دلوقتي الفك بيتقبل فقط لو:
  // النص بدون مسافات، وأحرفه Base64 فعلاً، والناتج UTF-8 سليم، وشكله
  // شكل حمولة QR معروفة (JSON / MID: / رابط) - غير كده النص الأصلي
  // بيفضل كما هو.
  const decodedBase64 = decodeBase64QrPayload(text);
  if (decodedBase64) {
    text = decodedBase64;
  }

  // 1) JSON {"m":"Bodymaker 01","line":"1"}
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
    } catch (_) {}
  }

  // 2) رابط بباراميتر (?m= أو ?machine=)
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
    } catch (_) {}
  }

  // 3) نص خام (مع دعم بادئة "MID:" ودعم فاصل الخط "|")
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

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================
// معالجة قيمة ماكينة تم التعرف عليها وعرض بطاقة النتيجة السريعة
// ============================================================
async function handleResolvedMachineValue(payload, manualSelectedLine = null) {
  const tr = t();
  const isEn = (window.currentLang || 'ar') === 'en';
  const resultBox = document.getElementById('qrResultBox');
  if (!resultBox) return false;

  const scannedValue = String(payload?.value || '').trim();
  let qrLine = normalizeLine(payload?.line);

  // كود فارغ
  if (!scannedValue) {
    renderQrErrorCard({
      title: tr.invalidQr,
      desc: tr.invalidQrDesc,
      rawCode: payload?.rawText || ''
    });
    return false;
  }

  // 1) التأكد من جاهزية كتالوج الماكينات
  if (!isMachineTypesLoaded()) {
    resultBox.innerHTML = `
      <div class="bg-[#1E293B] rounded-2xl p-4 border border-blue-500/30 text-center animate-pulse">
        <div class="text-sm font-bold text-blue-400">⏳ ${tr.checking}</div>
      </div>`;
    await ensureMachineCatalogReady();
  }

  // البحث عن الماكينة
  const machine = resolveMachineFromValue(scannedValue);

  // الماكينة غير موجودة في الكتالوج الحالي للمستخدم
  if (!machine.found) {
    // التحقق هل الماكينة موجودة في قسم آخر (لغير الأدمن)
    if (!hasFullDataAccess() && await machineExistsInAnyDepartment(scannedValue)) {
      const userDept = normalizeDepartment(localStorage.getItem('machineDepartment')) || (isEn ? 'Not Assigned' : 'غير محدد');
      renderQrErrorCard({
        tone: 'warn',
        title: tr.noPermission,
        desc: `${tr.noPermissionDesc} (${tr.yourDept}: ${userDept.toUpperCase()})`,
        rawCode: scannedValue
      });
      return false;
    }

    // غير موجودة في أي قسم
    renderQrErrorCard({
      tone: 'error',
      title: tr.notFound,
      desc: tr.notFoundDesc,
      rawCode: scannedValue
    });
    return false;
  }

  // 2) فحص الصلاحية وقسم العمل
  if (!hasFullDataAccess()) {
    const userDept = normalizeDepartment(localStorage.getItem('machineDepartment'));
    if (!userDept || !machine.department || machine.department !== userDept) {
      renderQrErrorCard({
        tone: 'warn',
        title: tr.noPermission,
        desc: `${tr.noPermissionDesc} (${tr.yourDept}: ${(userDept || '').toUpperCase()})`,
        rawCode: scannedValue
      });
      return false;
    }
  }

  // 2b) الماكينة المعطّلة: مخفية من كل فورمات الإنشاء الجديدة، فمسح
  // ملصق قديم ليها كان بيفتح بطاقة "تم التعرف" بأزرار (AM/5S/بلاغ عطل)
  // ونموذج البلاغ بيفضل بدون ماكينة (الاختيار المسبق بيفشل بصمت لأن
  // النوع المعطّل مش في القائمة). غير أصحاب الوصول الكامل بيتوقفوا هنا
  // برسالة واضحة.
  if (machine.active === false && !hasFullDataAccess()) {
    renderQrErrorCard({
      tone: 'warn',
      title: tr.inactiveMachine,
      desc: tr.inactiveMachineDesc,
      rawCode: scannedValue
    });
    return false;
  }

  // 3) النجاح: تحديد خط الإنتاج وحفظ الماكينة
  const line = manualSelectedLine || qrLine || machine.line || '';
  const lineLabel = formatLineLabel(line);

  // اهتزاز خفيف لتأكيد القراءة الناجحة (Haptic feedback)
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try { navigator.vibrate(80); } catch (_) {}
  }

  // حفظ في localStorage
  localStorage.setItem('activeMachine', machine.value);
  if (line) {
    localStorage.setItem('activeMachineLine', line);
  } else {
    localStorage.removeItem('activeMachineLine');
  }

  // تخزين آخر ماكينة تم مسحها (لاستخدامها في كارت الرئيسية)
  try {
    localStorage.setItem('lastScannedMachine', JSON.stringify({
      value: machine.value,
      line: line || '',
      department: machine.department || '',
      time: Date.now()
    }));
  } catch (_) {}

  // إيقاف الكاميرا فور النجاح
  window.stopQrScan();

  // عرض بطاقة الإجراءات السريعة (Quick Action Result Card - Phase ج)
  renderQuickActionResultCard(machine, line, lineLabel);
  return true;
}

// عرض بطاقة الإجراءات السريعة للماكينة الممسوحة
function renderQuickActionResultCard(machine, line, lineLabel) {
  const resultBox = document.getElementById('qrResultBox');
  if (!resultBox) return;

  // إخفاء قسم الاختيار اليدوي لتجنب تكرار كروت الماكينات على الشاشة
  const manualSection = document.getElementById('qrManualSection');
  if (manualSection) manualSection.classList.add('hidden');

  const isEn = (window.currentLang || 'ar') === 'en';
  const tr = t();

  // فحص الصلاحيات للأزرار الإضافية
  const canRunAm = hasPermission("dailyAM") || hasPermission("maintenance");
  const canRun5s = hasPermission("fiveS") || hasPermission("maintenance");
  const canReportIssue = hasPermission("issue") || hasPermission("maintenance");

  const deptBadge = machine.department
    ? `<span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
        machine.department === 'frontend'
          ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
          : 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
      }">🏢 ${machine.department.toUpperCase()}</span>`
    : '';

  const lineBadge = lineLabel
    ? `<span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">🏭 ${escapeHtml(lineLabel)}</span>`
    : '';

  resultBox.innerHTML = `
    <div class="bg-gradient-to-br from-[#1E293B] to-[#0F172A] rounded-2xl p-4 sm:p-5 border-2 border-emerald-500/40 shadow-xl space-y-3.5 animate-fade-in">
      
      <!-- هيدر النتيجة -->
      <div class="flex items-start justify-between border-b border-gray-800/80 pb-3">
        <div>
          <span class="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            ${tr.success}
          </span>
          <h3 class="text-lg sm:text-xl font-black text-white mt-1">
            ${escapeHtml(machine.value)}
          </h3>
          <div class="flex items-center gap-2 mt-1.5 flex-wrap">
            ${deptBadge}
            ${lineBadge}
          </div>
        </div>

        <button
          type="button"
          onclick="window.resetQrScan()"
          class="px-2.5 py-1.5 text-[11px] font-bold rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 transition active:scale-95 flex items-center gap-1 cursor-pointer"
          title="${tr.scanAgain}">
          <span>🔄</span>
          <span class="hidden sm:inline">${tr.scanAgain}</span>
        </button>
      </div>

      <!-- شبكة أزرار الإجراءات السريعة الموجهة -->
      <div class="space-y-2 pt-1">
        
        <!-- 1. فتح ملف الماكينة (الزر الأساسي) -->
        <button
          type="button"
          onclick="window.navigateTo('machineProfile')"
          class="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] font-bold text-xs text-white transition shadow-md flex items-center justify-between cursor-pointer group">
          <div class="flex items-center gap-2">
            <span class="text-base group-hover:scale-110 transition-transform">📄</span>
            <span>${tr.openBtn}</span>
          </div>
          <span class="text-blue-200 font-black">${isEn ? '→' : '←'}</span>
        </button>

        <!-- الأزرار الفرعية حسب الصلاحيات -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          
          <!-- 2. فحص AM اليومي -->
          ${canRunAm ? `
          <button
            type="button"
            onclick="window.qrStartDailyAM('${escapeHtml(machine.value)}', '${escapeHtml(line)}')"
            class="py-2.5 px-3 rounded-xl bg-[#0F172A] hover:bg-slate-800 border border-blue-500/30 text-blue-300 active:scale-95 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer">
            <span>📋</span>
            <span class="truncate">${tr.runAm}</span>
          </button>
          ` : ''}

          <!-- 3. فحص 5S -->
          ${canRun5s ? `
          <button
            type="button"
            onclick="window.qrStartFiveS('${escapeHtml(machine.value)}', '${escapeHtml(line)}')"
            class="py-2.5 px-3 rounded-xl bg-[#0F172A] hover:bg-slate-800 border border-emerald-500/30 text-emerald-300 active:scale-95 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer">
            <span>🧹</span>
            <span class="truncate">${tr.run5s}</span>
          </button>
          ` : ''}

          <!-- 4. الإبلاغ عن عطل (معبأة مسبقاً) -->
          ${canReportIssue ? `
          <button
            type="button"
            onclick="window.qrReportIssue('${escapeHtml(machine.value)}', '${escapeHtml(line)}')"
            class="py-2.5 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 active:scale-95 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer col-span-1 sm:col-span-2">
            <span>⚠️</span>
            <span>${tr.reportDefect}</span>
          </button>
          ` : ''}

        </div>
      </div>
    </div>
  `;
}

// توجيه لفحص AM
window.qrStartDailyAM = function(machineVal, lineVal) {
  localStorage.setItem('activeMachine', machineVal);
  if (lineVal) localStorage.setItem('activeMachineLine', lineVal);
  window.navigateTo('dailyAM');
};

// توجيه لفحص 5S
window.qrStartFiveS = function(machineVal, lineVal) {
  localStorage.setItem('activeMachine', machineVal);
  if (lineVal) localStorage.setItem('activeMachineLine', lineVal);
  window.navigateTo('fiveS');
};

// توجيه لتسجيل عطل مع تعبئة الماكينة والخط
window.qrReportIssue = function(machineVal, lineVal) {
  localStorage.setItem('activeMachine', machineVal);
  if (lineVal) localStorage.setItem('activeMachineLine', lineVal);
  localStorage.setItem('preselectedIssueMachine', machineVal);
  if (lineVal) localStorage.setItem('preselectedIssueLine', lineVal);
  window.navigateTo('issue');
};

// عرض بطاقة خطأ مفصلة مع الكود المقروء وزر للاختيار اليدوي
function renderQrErrorCard({ tone = 'error', title, desc, rawCode = '' }) {
  const resultBox = document.getElementById('qrResultBox');
  if (!resultBox) return;

  const tr = t();
  const isEn = (window.currentLang || 'ar') === 'en';

  const border = tone === 'error'
    ? 'border-red-500/40 bg-red-950/20'
    : 'border-amber-500/40 bg-amber-950/20';

  const titleColor = tone === 'error' ? 'text-red-400' : 'text-amber-400';

  const truncatedCode = rawCode.length > 55 ? rawCode.slice(0, 52) + '...' : rawCode;

  resultBox.innerHTML = `
    <div class="rounded-2xl p-4 border ${border} text-center space-y-3 shadow-lg animate-fade-in">
      <div class="text-sm font-black ${titleColor}">${escapeHtml(title)}</div>
      <div class="text-xs text-gray-300 leading-relaxed max-w-md mx-auto">${desc}</div>

      ${rawCode ? `
      <div class="flex items-center justify-center gap-2 p-2 rounded-xl bg-[#0F172A] border border-gray-800 text-[11px] font-mono text-gray-400 max-w-sm mx-auto">
        <span class="truncate" title="${escapeHtml(rawCode)}">${escapeHtml(truncatedCode)}</span>
        <button
          type="button"
          onclick="navigator.clipboard.writeText('${escapeHtml(rawCode).replace(/'/g, "\\'")}'); this.textContent='${tr.copied}'; setTimeout(() => this.textContent='${tr.copyCode}', 2000)"
          class="shrink-0 px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-blue-400 text-[10px] font-sans font-bold transition cursor-pointer">
          ${tr.copyCode}
        </button>
      </div>
      ` : ''}

      <div class="flex items-center justify-center gap-2 pt-1">
        <button
          type="button"
          onclick="document.getElementById('qrManualSection')?.scrollIntoView({ behavior: 'smooth' })"
          class="px-3.5 py-2 text-xs font-bold rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 transition active:scale-95 cursor-pointer">
          👇 ${isEn ? 'Select Machine Manually' : 'الانتقال للاختيار اليدوي'}
        </button>
        <button
          type="button"
          onclick="window.startQrScan()"
          class="px-3.5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition active:scale-95 cursor-pointer">
          🔄 ${tr.scanAgain}
        </button>
      </div>
    </div>`;
}

window.openMachineFromManualSelect = function () {
  const value = document.getElementById('qrManualMachine')?.value || '';
  const lineSelect = document.getElementById('qrManualLine');
  const isEn = (window.currentLang || 'ar') === 'en';
  
  if (!value) {
    alert(isEn ? 'Please select a machine first.' : 'يرجى اختيار الماكينة أولاً.');
    return;
  }

  handleResolvedMachineValue({ value: value.trim(), line: '' }, lineSelect?.value || null);
};

// إعادة ضبط الشاشة للبدء من جديد
window.resetQrScan = function () {
  window.stopQrScan();
  const resultBox = document.getElementById('qrResultBox');
  if (resultBox) resultBox.innerHTML = '';
  const manualSection = document.getElementById('qrManualSection');
  if (manualSection) manualSection.classList.remove('hidden');
};

// ============================================================
// تحميل مكتبة jsQR محلياً مع Fallback للـ CDN (Phase ب)
// ============================================================
function loadJsQR() {
  if (window.jsQR) return Promise.resolve(window.jsQR);
  if (jsQRLoadPromise) return jsQRLoadPromise;

  jsQRLoadPromise = loadScriptWithFallback(
    [
      'js/vendor/jsQR.js', // QR-IMPROVE: النسخة المحلية أولاً
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
  box.className = isError
    ? "text-center text-xs text-red-400 py-1 font-bold min-h-[20px]"
    : "text-center text-xs text-gray-400 py-1 font-medium min-h-[20px]";
}

// ============================================================
// تشغيل الكاميرا وإدارة الموارد (Phase ب)
// ============================================================
window.startQrScan = async function () {
  const tr = t();
  const isEn = (window.currentLang || 'ar') === 'en';

  const videoBox = document.getElementById('qrVideoBox');
  const video = document.getElementById('qrVideo');
  const startBtn = document.getElementById('qrStartBtn');
  const stopBtn = document.getElementById('qrStopBtn');
  const resultBox = document.getElementById('qrResultBox');

  if (resultBox) resultBox.innerHTML = '';
  document.getElementById('qrManualSection')?.classList.remove('hidden');

  // فحص أمان البيئة (HTTPS)
  if (
    typeof location !== 'undefined' &&
    location.protocol !== 'https:' &&
    location.hostname !== 'localhost' &&
    location.hostname !== '127.0.0.1'
  ) {
    setQrStatus(tr.httpsRequired, true);
    renderQrErrorCard({
      title: tr.httpsRequired,
      desc: isEn ? 'Modern browsers require HTTPS to allow camera access.' : 'تتطلب متصفحات الويب الحديثة اتصالاً آمناً ببروتوكول HTTPS لتشغيل الكاميرا.'
    });
    return;
  }

  // منع فتح Stream متكرر
  if (videoStream) {
    window.stopQrScan();
  }

  // طلب الكاميرا مع تصنيف الأخطاء بدقة
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: currentFacingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });
  } catch (err) {
    console.error("Camera access error:", err);
    let errMsg = tr.cameraError;
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      errMsg = tr.permDenied;
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      errMsg = tr.notFoundCam;
    } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      errMsg = tr.camInUse;
    }
    setQrStatus(errMsg, true);
    renderQrErrorCard({
      title: isEn ? 'Camera Unavailable' : 'تعذر تشغيل الكاميرا',
      desc: errMsg
    });
    return;
  }

  try {
    if (!video) throw new Error("video element missing");
    video.srcObject = videoStream;
    await video.play();
  } catch (playError) {
    console.warn("QR video play failed:", playError);
    window.stopQrScan();
    setQrStatus(tr.cameraError, true);
    return;
  }

  videoBox?.classList.remove('hidden');
  startBtn?.classList.add('hidden');
  stopBtn?.classList.remove('hidden');
  setQrStatus(tr.scanning);

  // فحص توفر الفلاش في الكاميرا
  setupTorchButton();

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const useNative = 'BarcodeDetector' in window;
  let detector = null;
  if (useNative) {
    try {
      detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    } catch (_) {}
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

  try {
    await ensureMachineCatalogReady();
  } catch (e) {
    console.warn("Error ensuring machines are loaded:", e);
  }

  // حلقة المسح مع مانع التكرار (Debounce)
  const tick = async () => {
    if (!videoStream) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      try {
        let scannedRaw = null;

        if (detector) {
          const codes = await detector.detect(video);
          if (codes && codes.length) {
            scannedRaw = codes[0].rawValue;
          }
        } else if (window.jsQR) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = window.jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            scannedRaw = code.data;
          }
        }

        if (scannedRaw) {
          const now = Date.now();
          // منع تكرار نفس الكود خلال ثانيتين
          if (scannedRaw === lastScannedText && (now - lastScannedTime) < 2000) {
            scanRafId = requestAnimationFrame(tick);
            return;
          }
          lastScannedText = scannedRaw;
          lastScannedTime = now;

          const payload = parseQrPayload(scannedRaw);
          payload.rawText = scannedRaw;

          if (await handleResolvedMachineValue(payload, null)) {
            return; // توقف عند النجاح
          }
        }
      } catch (_) {}
    }

    scanRafId = requestAnimationFrame(tick);
  };

  scanRafId = requestAnimationFrame(tick);
};

// إيقاف الكاميرا وتنظيف كافة الموارد لمنع استهلاك البطارية
window.stopQrScan = function () {
  if (scanRafId) {
    cancelAnimationFrame(scanRafId);
    scanRafId = null;
  }
  if (videoStream) {
    videoStream.getTracks().forEach(track => {
      try { track.stop(); } catch (_) {}
    });
    videoStream = null;
  }

  const video = document.getElementById('qrVideo');
  if (video) {
    video.srcObject = null;
  }

  isTorchOn = false;
  const torchBtn = document.getElementById('qrTorchBtn');
  if (torchBtn) torchBtn.classList.add('hidden');

  document.getElementById('qrVideoBox')?.classList.add('hidden');
  document.getElementById('qrStartBtn')?.classList.remove('hidden');
  document.getElementById('qrStopBtn')?.classList.add('hidden');
  setQrStatus('');
};

// التحكم في الفلاش (Torch)
function setupTorchButton() {
  const torchBtn = document.getElementById('qrTorchBtn');
  if (!torchBtn || !videoStream) return;

  const track = videoStream.getVideoTracks()[0];
  const capabilities = (track && typeof track.getCapabilities === 'function') ? track.getCapabilities() : {};

  if (capabilities && capabilities.torch) {
    torchBtn.classList.remove('hidden');
    isTorchOn = false;
    updateTorchBtnUI();
  } else {
    torchBtn.classList.add('hidden');
  }
}

function updateTorchBtnUI() {
  const icon = document.getElementById('qrTorchIcon');
  const txt = document.getElementById('qrTorchText');
  const tr = t();
  if (icon) icon.textContent = isTorchOn ? '⚡' : '🔦';
  if (txt) txt.textContent = isTorchOn ? (window.currentLang === 'en' ? 'Torch On' : 'الفلاش يعمل') : (window.currentLang === 'en' ? 'Torch' : 'فلاش');
}

window.toggleQrTorch = async function () {
  if (!videoStream) return;
  const track = videoStream.getVideoTracks()[0];
  if (!track) return;

  try {
    isTorchOn = !isTorchOn;
    await track.applyConstraints({ advanced: [{ torch: isTorchOn }] });
    updateTorchBtnUI();
  } catch (err) {
    console.warn("Could not toggle torch:", err);
    isTorchOn = false;
    updateTorchBtnUI();
  }
};

// تبديل الكاميرا (الأمامية / الخلفية)
window.flipQrCamera = async function () {
  currentFacingMode = (currentFacingMode === 'environment') ? 'user' : 'environment';
  window.stopQrScan();
  await window.startQrScan();
};

// مستمع لتنظيف الكاميرا تلقائياً عند إخفاء التبويب
function initVisibilityListener() {
  if (visibilityListenerAttached || typeof document === 'undefined') return;
  visibilityListenerAttached = true;

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && videoStream) {
      window.stopQrScan();
    }
  });
}

// ============================================================
// توليد وطباعة شبكة ملصقات QR للماكينات A4 (Phase هـ)
// للمدير والأدمن فقط
// ============================================================
function loadQrGeneratorLib() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  if (qrCodeLibPromise) return qrCodeLibPromise;

  qrCodeLibPromise = loadScriptWithFallback(
    ['./js/vendor/qrcode-generator.js'],
    () => window.qrcode
  ).catch(err => {
    qrCodeLibPromise = null;
    throw err;
  });

  return qrCodeLibPromise;
}

function buildQrCodeObject(text) {
  const utf8Text = unescape(encodeURIComponent(text));
  for (let typeNumber = 1; typeNumber <= 40; typeNumber += 1) {
    try {
      const qr = window.qrcode(typeNumber, 'M');
      qr.addData(utf8Text);
      qr.make();
      return qr;
    } catch (_) {
      continue;
    }
  }
  throw new Error('QR data too long to encode');
}

function drawQrToDataUrl(text, targetSize = 160) {
  const qr = buildQrCodeObject(text);
  const moduleCount = qr.getModuleCount();
  const marginModules = 2;
  const totalModules = moduleCount + marginModules * 2;
  const cellSize = Math.max(2, Math.floor(targetSize / totalModules));
  const size = totalModules * cellSize;

  const canvas = document.createElement('canvas');
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
  return canvas.toDataURL('image/png');
}

window.openBatchQrPrintModal = async function () {
  const isEn = (window.currentLang || 'ar') === 'en';
  const tr = t();

  // التأكد من الصلاحية
  if (!isAdminRole(getCurrentRole()) && !hasPermission("machines")) {
    alert(tr.noPermissionDesc);
    return;
  }

  await ensureMachineCatalogReady();
  const entries = getMachineTypeEntries({ includeInactive: false });

  // تجهيز قائمة كل الماكينات مع أرقامها
  const flatMachines = [];
  entries.forEach(entry => {
    const units = Array.isArray(entry.units) && entry.units.length ? entry.units : [''];
    units.forEach(u => {
      const val = u ? `${entry.key} ${u}`.trim() : entry.key;
      flatMachines.push({
        value: val,
        key: entry.key,
        unit: u,
        department: entry.department || '',
        line: entry.line || ''
      });
    });
  });

  if (!flatMachines.length) {
    alert(isEn ? 'No machines available in catalog' : 'لا توجد ماكينات مسجلة في الكتالوج');
    return;
  }

  // تحميل مكتبة التوليد
  try {
    await loadQrGeneratorLib();
  } catch (err) {
    alert(isEn ? 'Could not load QR generator library' : 'تعذر تحميل مكتبة توليد الرموز');
    return;
  }

  // إنشاء Modal العرض والطباعة
  const modalId = 'batchQrPrintModal';
  document.getElementById(modalId)?.remove();

  const modal = document.createElement('div');
  modal.id = modalId;
  modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm z-[99999] flex flex-col p-3 sm:p-6 overflow-y-auto';

  // توليد بطاقات الملصقات
  const cardsHtml = flatMachines.map(m => {
    const qrPayload = `MID:${m.value}`;
    const dataUrl = drawQrToDataUrl(qrPayload, 150);
    const lineStr = m.line ? `Line ${m.line}` : '';

    return `
      <div class="qr-print-card bg-white text-slate-900 border-2 border-dashed border-slate-300 rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-sm break-inside-avoid">
        <img src="${escapeHtml(dataUrl)}" alt="${escapeHtml(m.value)}" class="w-28 h-28 object-contain mb-1.5" />
        <div class="font-black text-xs text-slate-950 leading-tight truncate w-full">${escapeHtml(m.value)}</div>
        <div class="flex items-center gap-1.5 text-[9.5px] font-bold text-slate-600 mt-0.5">
          ${lineStr ? `<span>${lineStr}</span>` : ''}
          ${m.department ? `<span class="uppercase">(${escapeHtml(m.department)})</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  modal.innerHTML = `
    <div class="max-w-4xl w-full mx-auto bg-[#1E293B] border border-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden my-auto max-h-[92vh]">
      <!-- Header -->
      <div class="p-4 bg-[#0F172A] border-b border-gray-800 flex items-center justify-between shrink-0">
        <div>
          <h3 class="text-base font-bold text-white flex items-center gap-2">
            <span>🖨️</span>
            <span>${tr.printModalTitle}</span>
          </h3>
          <p class="text-xs text-gray-400 mt-0.5">
            ${isEn ? `Generated ${flatMachines.length} printable machine stickers (MID standard format)` : `تم توليد (${flatMachines.length}) ملصق ماكينة بالصيغة المعيارية MID`}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            onclick="window.printBatchQrSheet()"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white transition active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-md">
            <span>🖨️</span>
            <span>${tr.printNow}</span>
          </button>
          <button
            type="button"
            onclick="document.getElementById('${escapeJsArg(modalId)}')?.remove()"
            class="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition cursor-pointer">
            ✕
          </button>
        </div>
      </div>

      <!-- Printable Sheet Grid -->
      <div class="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-100" id="batchQrPrintArea">
        <div class="text-center pb-4 border-b border-slate-300 mb-4 print:block">
          <h2 class="text-base font-black text-slate-900 tracking-tight">MSCANCO • Machine QR Sticker Sheet</h2>
          <p class="text-[10px] text-slate-600 font-mono mt-0.5">${new Date().toLocaleDateString(isEn ? 'en-US' : 'ar-EG')} • Total ${flatMachines.length} Machine Identifiers</p>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 print:grid-cols-3 print:gap-4">
          ${cardsHtml}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
};

window.printBatchQrSheet = function () {
  window.print();
};
