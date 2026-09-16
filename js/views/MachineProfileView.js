// ============================================================
// MachineProfileView.js
// ملف الماكينة (Machine Profile) - الوجهة اللي بيوصلها المستخدم بعد
// مسح QR الماكينة أو اختيارها يدوياً (راجع QrScannerView.js).
// بيعرض: بيانات الماكينة، آخر نتيجة Daily AM، نسبة الإنجاز، آخر
// Score لـ5S، وأزرار تنفيذ الفحصين - كل ده حسب صلاحية المستخدم.
// ============================================================

import {
  resolveMachineFromValue,
  normalizeDepartment,
  normalizeLine,
  formatLineLabel
} from '../machines.js';
import { hasFullDataAccess, isManagerRole, isAdminRole, hasPermission, getCurrentRole } from '../permissions.js';
import { loadScriptWithFallback } from '../utils/loadExternalScript.js';
import {
  fetchLatestChecklistApi,
  fetchChecklistHistoryApi,
  CHECKLIST_TYPE_AM,
  CHECKLIST_TYPE_5S
} from '../services/checklistApi.js';

let qrCodeLoadPromise = null;

function t() {
  const isEn = (window.currentLang || 'ar') === 'en';
  return {
    title: isEn ? '🏭 Machine Profile' : '🏭 ملف الماكينة',
    noMachine: isEn ? 'No machine selected. Scan a QR code first.' : 'لم يتم اختيار ماكينة. امسح QR أولاً.',
    scanQr: isEn ? '📱 Scan Machine QR' : '📱 مسح QR الماكينة',
    noPermissionTitle: isEn ? '🔒 No Permission' : '🔒 لا توجد صلاحية',
    noPermissionDesc: isEn ? 'This machine belongs to a department you do not have access to.' : 'هذه الماكينة تابعة لقسم لا تملك صلاحية الوصول إليه.',
    department: isEn ? 'Department' : 'القسم',
    line: isEn ? 'Line' : 'الخط',
    notFoundTitle: isEn ? '❌ Machine Not Found' : '❌ الماكينة غير موجودة',
    notFoundDesc: isEn ? 'This machine is no longer in the machines list.' : 'هذه الماكينة لم تعد موجودة ضمن قائمة الماكينات.',
    lastAm: isEn ? 'Last Daily AM Result' : 'آخر نتيجة فحص يومي (AM)',
    last5s: isEn ? 'Last 5S Score' : 'آخر تقييم 5S',
    noRecords: isEn ? 'No records yet' : 'لا توجد سجلات بعد',
    runAm: isEn ? '📋 Run Daily AM Checklist' : '📋 بدء الفحص اليومي (Daily AM)',
    run5s: isEn ? '🧹 Run 5S Assessment' : '🧹 بدء تقييم 5S',
    history: isEn ? 'Recent History' : 'السجل الأخير',
    by: isEn ? 'By' : 'بواسطة',
    completion: isEn ? 'Completion' : 'نسبة الإنجاز',
    ok: isEn ? '✅ OK' : '✅ سليم',
    issues: isEn ? '⚠️ Issues Found' : '⚠️ يوجد ملاحظات',
    scanAnother: isEn ? '🔄 Scan Another Machine' : '🔄 مسح ماكينة أخرى',
    printQr: isEn ? '🖨️ Generate / Print QR' : '🖨️ توليد / طباعة QR',
    generatingQr: isEn ? '⏳ Generating...' : '⏳ جاري التوليد...',
    qrGenError: isEn ? '❌ Could not generate the QR code. Check your internet connection and try again.' : '❌ تعذر توليد رمز QR. تأكد من اتصال الإنترنت وحاول مرة أخرى.',
    loading: isEn ? 'Loading...' : 'جاري التحميل...'
  };
}

export const MachineProfileView = () => {
  const isEn = (window.currentLang || 'ar') === 'en';
  const tr = t();
  const machine = localStorage.getItem('activeMachine') || '';

  if (!machine) {
    return `
    <div class="app-page p-3 sm:p-4 max-w-md sm:max-w-xl mx-auto pb-16">
      <button onclick="window.goBack('home')" class="mb-5 bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition">
        ${isEn ? '← Back' : '← رجوع'}
      </button>
      <div class="bg-[#1E293B] rounded-xl p-6 border border-gray-800 text-center space-y-4">
        <div class="text-sm text-gray-300">${tr.noMachine}</div>
        <button onclick="window.navigateTo('qr')" class="w-full p-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white transition">
          ${tr.scanQr}
        </button>
      </div>
    </div>`;
  }

  // نفس مسار البحث المستخدم في مسح الـQR بالظبط (machines.js:
  // resolveMachineFromValue) - الوجود والقسم وخط الإنتاج من مصدر
  // واحد، مفيش منطق منفصل لكل شاشة
  const resolved = resolveMachineFromValue(machine);
  const department = resolved.department;

  // خط الإنتاج: القيمة اللي اتحفظت وقت فتح الماكينة (من الـQR) لها
  // الأولوية، وإلا الخط المسجّل على الماكينة نفسها
  const line = normalizeLine(localStorage.getItem('activeMachineLine')) || resolved.line || '';
  const lineLabel = formatLineLabel(line);

  // إصلاح: نفس معالجة normalizeDepartment المستخدمة في كل مكان تاني
  // بالتطبيق (QrScannerView.js/machines.js) بدل trim()/toLowerCase()
  // الخام - عشان تبقى المقارنة مع "department" (اللي راجعة أصلاً من
  // normalizeDepartment) متسقة دايماً.
  const userDept = normalizeDepartment(localStorage.getItem('machineDepartment'));
  // Admin/وصول كامل: بيتخطى فلترة القسم بالكامل (نفس قاعدة
  // QrScannerView.js). غير كده: شرط تطابق القسم زي ما هو بالظبط.
  const allowed = hasFullDataAccess() || (department && department === userDept);

  if (!allowed) {
    return `
    <div class="app-page p-3 sm:p-4 max-w-md sm:max-w-xl mx-auto pb-16">
      <button onclick="window.goBack('home')" class="mb-5 bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition">
        ${isEn ? '← Back' : '← رجوع'}
      </button>
      <div class="bg-[#1E293B] rounded-xl p-6 border border-amber-500/30 text-center space-y-2">
        <div class="text-sm font-bold text-amber-400">${tr.noPermissionTitle}</div>
        <div class="text-[11px] text-gray-400">${tr.noPermissionDesc}</div>
      </div>
    </div>`;
  }

  const canRun = hasPermission('maintenance') || hasPermission('qr');
  const canSeeHistory = hasFullDataAccess() || isManagerRole(getCurrentRole());
  const canPrintQr = isAdminRole(getCurrentRole());

  return `
  <div class="app-page p-3 sm:p-4 max-w-md sm:max-w-xl mx-auto pb-16">
    <button onclick="window.goBack('home')" class="mb-5 bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition">
      ${isEn ? '← Back' : '← رجوع'}
    </button>

    <div class="bg-[#1E293B] rounded-2xl p-4 border border-gray-800 space-y-1 mb-4">
      <div class="text-xs text-gray-400">${tr.title}</div>
      <div class="text-xl font-black text-white">${machine}</div>
      <div class="flex flex-wrap items-center gap-1.5 mt-1">
        <span class="inline-block text-[10px] font-bold px-2 py-1 rounded-full ${department === 'frontend' ? 'bg-purple-500/10 text-purple-300 border border-purple-500/30' : 'bg-sky-500/10 text-sky-300 border border-sky-500/30'}">
          ${tr.department}: ${department ? department.toUpperCase() : '-'}
        </span>
        <span class="inline-block text-[10px] font-bold px-2 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
          🏭 ${tr.line}: ${lineLabel || '-'}
        </span>
      </div>
    </div>

    <div id="machineAmSummary" class="bg-[#1E293B] rounded-2xl p-4 border border-gray-800 space-y-2 mb-3">
      <div class="text-xs font-bold text-gray-300">${tr.lastAm}</div>
      <div class="text-[11px] text-gray-500">${tr.loading}</div>
    </div>

    <div id="machine5sSummary" class="bg-[#1E293B] rounded-2xl p-4 border border-gray-800 space-y-2 mb-4">
      <div class="text-xs font-bold text-gray-300">${tr.last5s}</div>
      <div class="text-[11px] text-gray-500">${tr.loading}</div>
    </div>

    ${canRun ? `
    <div class="grid grid-cols-1 gap-2 mb-4">
      <button onclick="window.navigateTo('dailyAM')" class="w-full p-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] font-bold text-xs text-white transition-all">
        ${tr.runAm}
      </button>
      <button onclick="window.navigateTo('fiveS')" class="w-full p-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] font-bold text-xs text-white transition-all">
        ${tr.run5s}
      </button>
    </div>` : ''}

    ${canSeeHistory ? `
    <div class="bg-[#1E293B] rounded-2xl p-4 border border-gray-800 space-y-2 mb-4">
      <div class="text-xs font-bold text-gray-300">${tr.history}</div>
      <div id="machineHistoryBox" class="space-y-1.5 text-[11px] text-gray-400">${tr.loading}</div>
    </div>` : ''}

    ${canPrintQr ? `
    <div class="bg-[#1E293B] rounded-2xl p-4 border border-gray-800 space-y-2 mb-4">
      <button id="machineQrGenBtn" onclick="window.generateMachineQr()" class="w-full p-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 font-bold text-xs text-white transition active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed">
        ${tr.printQr}
      </button>
      <div id="machineQrPrintBox" class="hidden text-center pt-2">
        <canvas id="machineQrCanvas" class="mx-auto"></canvas>
        <div class="text-xs font-bold text-white mt-2">${resolved.found ? resolved.value : machine}</div>
        ${lineLabel ? `<div class="text-[10px] font-bold text-gray-300 mt-0.5">🏭 ${lineLabel}</div>` : ''}
        <button onclick="window.print()" class="mt-3 w-full p-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-bold text-[11px] text-white transition">
          🖨️ ${isEn ? 'Print' : 'طباعة'}
        </button>
      </div>
    </div>` : ''}

    <button onclick="window.navigateTo('qr')" class="w-full p-2.5 rounded-lg bg-gray-800 border border-gray-700 hover:border-gray-600 font-bold text-[11px] text-gray-300 transition">
      ${tr.scanAnother}
    </button>
  </div>
  `;
};

// ============================================================
// تحميل بيانات آخر فحص AM/5S + السجل الأخير (لو الصلاحية تسمح)
// ============================================================
window.loadMachineProfileData = async function () {
  const machine = localStorage.getItem('activeMachine') || '';
  if (!machine) return;

  const isEn = (window.currentLang || 'ar') === 'en';
  const tr = t();

  const amBox = document.getElementById('machineAmSummary');
  const fiveSBox = document.getElementById('machine5sSummary');
  const historyBox = document.getElementById('machineHistoryBox');

  const [amResult, fiveSResult] = await Promise.all([
    fetchLatestChecklistApi(machine, CHECKLIST_TYPE_AM),
    fetchLatestChecklistApi(machine, CHECKLIST_TYPE_5S)
  ]);

  if (amBox) {
    const rec = amResult.status === 'success' ? amResult.data : null;
    amBox.innerHTML = rec ? `
      <div class="text-xs font-bold text-gray-300">${tr.lastAm}</div>
      <div class="flex items-center justify-between">
        <span class="text-sm font-bold ${rec.overallResult === 'ok' ? 'text-emerald-400' : 'text-amber-400'}">
          ${rec.overallResult === 'ok' ? tr.ok : tr.issues}
        </span>
        <span class="text-[10px] text-gray-500">${new Date(rec.createdAt).toLocaleString(isEn ? 'en-US' : 'ar-EG')}</span>
      </div>
      <div class="text-[11px] text-gray-400">${tr.completion}: ${rec.completionRate ?? 0}%</div>
      <div class="text-[11px] text-gray-500">${tr.by} ${rec.createdBy?.name || '-'}</div>
    ` : `<div class="text-xs font-bold text-gray-300">${tr.lastAm}</div><div class="text-[11px] text-gray-500">${tr.noRecords}</div>`;
  }

  if (fiveSBox) {
    const rec = fiveSResult.status === 'success' ? fiveSResult.data : null;
    fiveSBox.innerHTML = rec ? `
      <div class="text-xs font-bold text-gray-300">${tr.last5s}</div>
      <div class="flex items-center justify-between">
        <span class="text-lg font-black text-emerald-400">${rec.score ?? 0}%</span>
        <span class="text-[10px] text-gray-500">${new Date(rec.createdAt).toLocaleString(isEn ? 'en-US' : 'ar-EG')}</span>
      </div>
      <div class="text-[11px] text-gray-500">${tr.by} ${rec.createdBy?.name || '-'}</div>
    ` : `<div class="text-xs font-bold text-gray-300">${tr.last5s}</div><div class="text-[11px] text-gray-500">${tr.noRecords}</div>`;
  }

  if (historyBox) {
    const [amHistory, fiveSHistory] = await Promise.all([
      fetchChecklistHistoryApi(machine, CHECKLIST_TYPE_AM, 5),
      fetchChecklistHistoryApi(machine, CHECKLIST_TYPE_5S, 5)
    ]);

    const combined = [
      ...(amHistory.status === 'success' ? amHistory.data.map(r => ({ ...r, kind: 'AM' })) : []),
      ...(fiveSHistory.status === 'success' ? fiveSHistory.data.map(r => ({ ...r, kind: '5S' })) : [])
    ].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 8);

    historyBox.innerHTML = combined.length
      ? combined.map(r => `
        <div class="bg-[#0F172A] border border-gray-800 rounded-lg p-2 flex items-center justify-between">
          <span class="font-bold ${r.kind === 'AM' ? 'text-blue-300' : 'text-emerald-300'}">${r.kind}</span>
          <span>${r.createdBy?.name || '-'}</span>
          <span class="text-gray-500">${new Date(r.createdAt).toLocaleDateString(isEn ? 'en-US' : 'ar-EG')}</span>
        </div>
      `).join('')
      : `<div class="text-center py-2">${tr.noRecords}</div>`;
  }
};

// ============================================================
// توليد QR للماكينة (أدمن فقط) + طباعة
//
// إصلاح جذري: كان توليد الـQR بالكامل معتمد على تحميل مكتبة "qrcode"
// من CDN خارجي (cdn.jsdelivr.net) في كل مرة - وهو اعتماد شبكي غير
// ضروري بيفشل بالكامل لو دومين الـCDN تحديداً محجوب/مش واصل من شبكة
// المستخدم (واي فاي مصنع، فلتر خصوصية على الجهاز...)، حتى لو باقي
// الإنترنت (فايربيز مثلاً) شغّال تمامًا - فيظهر للمستخدم رسالة "تأكد
// من اتصال الإنترنت" بينما الإنترنت شغّال فعليًا، والمشكلة الحقيقية
// إن الدومين الخارجي بس هو المحجوب.
//
// الحل: مكتبة توليد QR (js/vendor/qrcode-generator.js - نسخة Kazuhiko
// Arase الأصلية المرخّصة MIT) بقت جزء من ملفات التطبيق نفسه، بتتحمّل
// من نفس دومين التطبيق (Firebase Hosting) زي أي ملف .js تاني بالضبط
// - مفيش أي اعتماد على أي CDN خارجي إطلاقاً، وبتتخزّن كمان في كاش
// الـService Worker (sw.js) فتشتغل حتى أوفلاين بعد أول تحميل للتطبيق.
// ============================================================
function loadQrCodeLib() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  if (qrCodeLoadPromise) return qrCodeLoadPromise;

  qrCodeLoadPromise = loadScriptWithFallback(
    ['./js/vendor/qrcode-generator.js'],
    () => window.qrcode
  ).catch(err => {
    // تصفير الـPromise المخزّن عشان أي ضغطة تالية على الزرار تعمل
    // محاولة تحميل جديدة بدل ما ترجع نفس الفشل القديم للأبد
    qrCodeLoadPromise = null;
    throw err;
  });

  return qrCodeLoadPromise;
}

// بناء كائن QR بأصغر "typeNumber" كافي لاستيعاب النص (المكتبة القديمة
// دي بتحتاج تحديد typeNumber يدوياً بدل الاكتشاف التلقائي) - بنجرّب
// من أصغر حجم ونكبّر لحد ما نلاقي حجم يستوعب النص من غير "تجاوز سعة"
function buildQrCode(text) {
  // تحويل النص إلى UTF-8 لدعم اللغة العربية في المكتبة (بدونها تظهر رموز غير مفهومة)
  const utf8Text = unescape(encodeURIComponent(text));
  for (let typeNumber = 1; typeNumber <= 40; typeNumber += 1) {
    try {
      const qr = window.qrcode(typeNumber, 'M');
      qr.addData(utf8Text);
      qr.make();
      return qr;
    } catch (err) {
      // "code length overflow" - النص أكبر من سعة الحجم ده، نجرّب اللي بعده
      continue;
    }
  }
  throw new Error('QR data too long to encode');
}

// رسم الـQR الناتج على <canvas> يدوياً (المكتبة القديمة دي معندهاش
// toCanvas() جاهزة - بس بتوفر isDark(row,col) لكل خانة، فبنرسمها
// بأنفسنا بمربعات بسيطة، بدون أي منطق تكويد إضافي)
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

// حمولة الـQR (QR Payload) - متوافقة تماماً مع الـscanner ومع أي
// QR متطبوع قبل كده:
//  - بدون خط إنتاج: نص خام بقيمة الماكينة المعيارية (نفس السلوك
//    القديم بالحرف، عشان الأكواد المطبوعة القديمة تفضل شغّالة).
//  - مع خط إنتاج: JSON {"m":"<machine>","line":"1"} - وهي صيغة
//    الـscanner بيقراها أصلاً (راجع QrScannerView.js: parseQrPayload).
function buildMachineQrPayload(machineValue, line) {
  const normalizedLine = normalizeLine(line);
  if (!normalizedLine) return machineValue;
  return JSON.stringify({ m: machineValue, line: normalizedLine });
}

window.generateMachineQr = async function () {
  const rawMachine = localStorage.getItem('activeMachine') || '';
  if (!rawMachine) return;

  // القيمة المعيارية للماكينة + خطها - نفس مصدر الحقيقة المستخدم
  // في العرض وفي المسح
  const resolvedMachine = resolveMachineFromValue(rawMachine);
  const machine = resolvedMachine.found ? resolvedMachine.value : rawMachine;
  const machineLine = normalizeLine(localStorage.getItem('activeMachineLine')) || resolvedMachine.line || '';

  const tr = t();
  const btn = document.getElementById('machineQrGenBtn');
  const originalLabel = btn ? btn.textContent : '';

  // إصلاح (زر توليد QR كان بيفشل بصمت): كان أي خطأ في تحميل مكتبة
  // qrcode من الـCDN (زي انقطاع الإنترنت) بينتهي بـ console.error()
  // فقط بدون أي تغيير مرئي على الشاشة - فيبان للمستخدم إن الزر "مش
  // شغال" بدون أي تفسير. دلوقتي بيتعطل الزر ويتغير نصه أثناء
  // التحميل، وبيظهر رسالة خطأ واضحة لو فشل التوليد بدل الصمت التام.
  if (btn) {
    btn.disabled = true;
    btn.textContent = tr.generatingQr;
  }

  try {
    await loadQrCodeLib();
    const canvas = document.getElementById('machineQrCanvas');
    const box = document.getElementById('machineQrPrintBox');
    if (!canvas || !window.qrcode) {
      throw new Error('QRCode library or canvas element unavailable');
    }

    const qr = buildQrCode(buildMachineQrPayload(machine, machineLine));
    drawQrToCanvas(qr, canvas, 220, 2);
    box?.classList.remove('hidden');
  } catch (err) {
    console.error('Error generating machine QR:', err);
    alert(tr.qrGenError);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  }
};
