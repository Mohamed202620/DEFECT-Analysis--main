// ============================================================
// amTemplateManager.js
// إدارة وتغذية قوالب فحص الماكينات (Daily AM Checklist)
// عبر ملف Excel موحد وشامل، مع دعم التعديل الفردي والجماعي
// وحفظ القوالب في مجموعة 'machineAmTemplates' في Firestore.
// ============================================================

import { db, doc, getDoc, setDoc } from './providers/backend/index.js';
import { loadScriptWithFallback } from './utils/loadExternalScript.js';
import { isAdminRole, getCurrentRole } from './permissions.js';

let exceljsLoadPromise = null;
function ensureExcelJs() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  if (!exceljsLoadPromise) {
    exceljsLoadPromise = loadScriptWithFallback(
      [
        'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js',
        'https://cdn.jsdelivr.net/npm/exceljs@4.3.0/dist/exceljs.min.js',
        'https://unpkg.com/exceljs@4.3.0/dist/exceljs.min.js'
      ],
      () => window.ExcelJS
    ).catch(err => {
      exceljsLoadPromise = null;
      throw err;
    });
  }
  return exceljsLoadPromise;
}

function cellValToText(cell) {
  if (!cell) return '';
  const v = cell.value;
  if (v == null) return '';
  if (typeof v === 'object' && v.richText) {
    return v.richText.map(rt => rt.text).join('').trim();
  }
  if (typeof v === 'object' && v.text) return String(v.text).trim();
  return String(v).trim();
}

/**
 * تنزيل شيت إكسيل إرشادي منظم (Standard Excel Master Template)
 * يحتوي على أمثلة واضحة لطريقة تعبئة بنود الـ AM لأي ماكينة
 */
window.downloadAmMasterTemplate = async function() {
  try {
    const isEn = (window.currentLang || 'ar') === 'en';
    await ensureExcelJs();
    const workbook = new window.ExcelJS.Workbook();
    workbook.creator = 'Maintenance & Defect System';
    workbook.lastModifiedBy = 'Admin';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('AM_Checklist_Template', {
      views: [{ rightToLeft: !isEn }]
    });

    // إعداد الأعمدة وتنسيقها
    sheet.columns = [
      { header: isEn ? 'Machine Name *' : 'اسم الماكينة *', key: 'machine', width: 24 },
      { header: isEn ? 'Inspection Point (AR) *' : 'بند الفحص (عربي) *', key: 'ar', width: 38 },
      { header: isEn ? 'Inspection Point (EN)' : 'بند الفحص (إنجليزي)', key: 'en', width: 34 },
      { header: isEn ? 'Type (ok_not_ok / numeric)' : 'النوع (ok_not_ok أو numeric)', key: 'type', width: 26 },
      { header: isEn ? 'Unit (e.g. Bar, °C)' : 'الوحدة (مثال: Bar أو °C)', key: 'unit', width: 18 },
      { header: isEn ? 'Role (operator / maintainer)' : 'المسؤول (operator أو maintainer)', key: 'role', width: 26 }
    ];

    // تلوين وتنسيق رأس الجدول
    const headerRow = sheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell(cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' }
      };
      cell.font = {
        name: 'Segoe UI',
        size: 11,
        bold: true,
        color: { argb: 'FFFFFFFF' }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF334155' } },
        bottom: { style: 'medium', color: { argb: 'FF3B82F6' } },
        left: { style: 'thin', color: { argb: 'FF334155' } },
        right: { style: 'thin', color: { argb: 'FF334155' } }
      };
    });

    // أمثلة توضيحية واقعية
    const sampleRows = [
      {
        machine: 'Bodymaker 01',
        ar: 'نظافة الماكينة وخلوها من تسريبات الزيت والماء',
        en: 'Machine clean, no oil or water leaks',
        type: 'ok_not_ok',
        unit: '',
        role: 'operator'
      },
      {
        machine: 'Bodymaker 01',
        ar: 'أغطية وحواجز الأمان في مكانها وسليمة',
        en: 'Safety guards in place and intact',
        type: 'ok_not_ok',
        unit: '',
        role: 'operator'
      },
      {
        machine: 'Bodymaker 01',
        ar: 'زر الإيقاف الطارئ يعمل بكفاءة',
        en: 'Emergency stop functional',
        type: 'ok_not_ok',
        unit: '',
        role: 'operator'
      },
      {
        machine: 'Bodymaker 01',
        ar: 'ضغط الهواء المضغوط الرئيسي',
        en: 'Main pneumatic air pressure',
        type: 'numeric',
        unit: 'Bar',
        role: 'maintainer'
      },
      {
        machine: 'Bodymaker 01',
        ar: 'درجة حرارة المحرك الرئيسي',
        en: 'Main motor temperature',
        type: 'numeric',
        unit: '°C',
        role: 'maintainer'
      },
      {
        machine: 'Printer 01',
        ar: 'فحص خراطيم ومضخات الحبر من أي تسريب',
        en: 'Check ink pumps & hoses for leaks',
        type: 'ok_not_ok',
        unit: '',
        role: 'operator'
      },
      {
        machine: 'Printer 01',
        ar: 'نظافة حساسات الرؤية والتسجيل',
        en: 'Clean registration sensors',
        type: 'ok_not_ok',
        unit: '',
        role: 'operator'
      }
    ];

    sampleRows.forEach(row => {
      const addedRow = sheet.addRow(row);
      addedRow.height = 22;
      addedRow.eachCell(cell => {
        cell.font = { name: 'Segoe UI', size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AM_Checklist_Master_Template_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Error generating AM template:', err);
    alert('❌ حدث خطأ أثناء تجهيز النموذج: ' + err.message);
  }
};

/**
 * فتح نافذة استيراد الإكسيل المجمع للـ AM
 */
window.openAmBulkImportModal = function() {
  const isEn = (window.currentLang || 'ar') === 'en';
  document.getElementById('amBulkImportModal')?.remove();

  const modalHtml = `
    <div id="amBulkImportModal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-[999] flex items-center justify-center p-3 sm:p-4">
      <div class="bg-[#1E293B] border border-gray-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div class="p-4 border-b border-gray-800 flex items-center justify-between bg-[#0F172A]">
          <div class="flex items-center gap-2.5">
            <span class="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-sm">📊</span>
            <div>
              <h3 class="font-black text-white text-sm">
                ${isEn ? 'Bulk AM Checklists Importer' : 'تغذية قوالب فحص الماكينات (AM) من الإكسيل'}
              </h3>
              <p class="text-[10px] text-gray-400">
                ${isEn ? 'Import or update multiple machine checklists instantly via Excel' : 'استيراد وتحديث بنود الفحص لكل ماكينات المصنع دفعة واحدة'}
              </p>
            </div>
          </div>
          <button onclick="document.getElementById('amBulkImportModal').remove()" class="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition">
            ✕
          </button>
        </div>

        <div class="p-4 overflow-y-auto flex-1 space-y-4">
          <!-- كارت تحميل النموذج المرجعي -->
          <div class="bg-[#0F172A] border border-blue-500/20 rounded-xl p-3 flex items-center justify-between gap-3">
            <div>
              <div class="text-xs font-bold text-blue-300">
                ${isEn ? '1. Download standard template' : '1. نزّل النموذج الإرشادي المنظم'}
              </div>
              <div class="text-[10px] text-gray-400">
                ${isEn ? 'Fill in inspection items for all machines in one sheet' : 'قالب إكسيل جاهز يحتوي على الأعمدة المطلوبة وأمثلة لبنود المشغل والصيانة'}
              </div>
            </div>
            <button onclick="window.downloadAmMasterTemplate()" class="shrink-0 px-3 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:bg-blue-600/30 text-xs font-bold transition flex items-center gap-1.5 active:scale-95">
              <span>📥</span>
              <span>${isEn ? 'Download Excel' : 'تحميل القالب'}</span>
            </button>
          </div>

          <!-- رفع الملف -->
          <div class="space-y-2">
            <label class="block text-xs font-bold text-gray-300">
              ${isEn ? '2. Choose completed Excel file' : '2. اختر ملف الإكسيل بعد ملئه'}
            </label>
            <input type="file" id="amExcelFileInput" accept=".xlsx, .xls" onchange="window.previewAmExcelFile(this)" class="w-full text-xs text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 file:cursor-pointer bg-[#0F172A] p-2 rounded-xl border border-gray-700">
          </div>

          <!-- حاوية المعاينة -->
          <div id="amExcelPreviewContainer" class="space-y-2"></div>
        </div>

        <div class="p-4 border-t border-gray-800 bg-[#0F172A] flex justify-between items-center">
          <button onclick="document.getElementById('amBulkImportModal').remove()" class="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-xs font-bold text-gray-300 transition">
            ${isEn ? 'Cancel' : 'إلغاء'}
          </button>
          <button id="amConfirmImportBtn" onclick="window.confirmAmExcelImport()" disabled class="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-xs font-black text-white transition active:scale-95">
            ${isEn ? 'Save & Apply to System ✅' : 'تأكيد وحفظ في النظام ✅'}
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
};

let _parsedAmTemplates = null;

/**
 * فحص ومعاينة ملف الإكسيل
 */
window.previewAmExcelFile = async function(inputEl) {
  const isEn = (window.currentLang || 'ar') === 'en';
  const previewBox = document.getElementById('amExcelPreviewContainer');
  const confirmBtn = document.getElementById('amConfirmImportBtn');
  _parsedAmTemplates = null;
  if (confirmBtn) confirmBtn.disabled = true;

  const file = inputEl?.files?.[0];
  if (!file) {
    if (previewBox) previewBox.innerHTML = '';
    return;
  }

  if (previewBox) {
    previewBox.innerHTML = `
      <div class="bg-[#0F172A] border border-gray-800 rounded-xl p-4 text-center text-xs text-gray-400">
        ⏳ ${isEn ? 'Reading and verifying Excel file...' : 'جاري قراءة وفحص ملف الإكسيل...'}
      </div>
    `;
  }

  try {
    await ensureExcelJs();
    const buffer = await file.arrayBuffer();
    const workbook = new window.ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new Error(isEn ? 'No worksheet found in file.' : 'الملف لا يحتوي على أي ورقة عمل.');
    }

    const machineMap = {}; // { machineName: [ { id, ar, en, type, unit, role } ] }
    let totalItems = 0;

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // Header row

      const machine = cellValToText(row.getCell(1));
      const ar = cellValToText(row.getCell(2));
      const en = cellValToText(row.getCell(3));
      const rawType = cellValToText(row.getCell(4)).toLowerCase();
      const unit = cellValToText(row.getCell(5));
      const rawRole = cellValToText(row.getCell(6)).toLowerCase();

      if (!machine || (!ar && !en)) return;

      const isNumeric = rawType.includes('num') || rawType.includes('رقم');
      const isMaintainer = rawRole.includes('maint') || rawRole.includes('صيان') || rawRole.includes('مهندس');

      if (!machineMap[machine]) {
        machineMap[machine] = [];
      }

      const itemId = 'item_' + (machineMap[machine].length + 1) + '_' + Math.random().toString(36).substring(2, 6);

      machineMap[machine].push({
        id: itemId,
        ar: ar || en,
        en: en || ar,
        type: isNumeric ? 'numeric' : 'boolean',
        unit: unit || '',
        role: isMaintainer ? 'maintainer' : 'operator'
      });

      totalItems++;
    });

    const machineNames = Object.keys(machineMap);
    if (machineNames.length === 0 || totalItems === 0) {
      throw new Error(isEn ? 'No valid inspection items found. Ensure Machine Name and Point text are filled.' : 'لم يتم العثور على أي بنود صالحة. تأكد من ملء عمود اسم الماكينة ونص البند.');
    }

    _parsedAmTemplates = machineMap;

    // ITEMS-EDITOR: فحص الفروق مع القوالب الحالية في Firestore
    let diffSummaryHtml = '';
    try {
      const diffResults = await Promise.all(machineNames.map(async m => {
        try {
          const snap = await getDoc(doc(db, 'machineAmTemplates', m));
          if (!snap.exists()) {
            return { machine: m, added: machineMap[m].length, modified: 0, removed: 0, isNew: true };
          }
          const oldItems = snap.data().items || [];
          const newItems = machineMap[m];
          let added = 0;
          let modified = 0;
          newItems.forEach(n => {
            const match = oldItems.find(o => o.id === n.id || (o.ar && o.ar === n.ar));
            if (!match) added++;
            else if (match.type !== n.type || match.unit !== n.unit || match.role !== n.role) modified++;
          });
          const removed = oldItems.filter(o => !newItems.some(n => n.id === o.id || (o.ar && o.ar === n.ar))).length;
          return { machine: m, added, modified, removed, isNew: false, oldVersion: snap.data().templateVersion || 1 };
        } catch (_) {
          return { machine: m, added: machineMap[m].length, modified: 0, removed: 0, isNew: false };
        }
      }));

      diffSummaryHtml = `
        <div class="mt-2 pt-2 border-t border-gray-700/50 space-y-1">
          <div class="text-[10px] font-bold text-gray-300">📊 ${isEn ? 'Diff Preview vs Existing Templates:' : 'معاينة الفروق مقارنة بالقوالب الحالية:'}</div>
          <div class="max-h-36 overflow-y-auto space-y-1">
            ${diffResults.map(d => `
              <div class="bg-[#0F172A]/70 px-2 py-1 rounded text-[10px] flex items-center justify-between">
                <span class="font-medium text-white">${d.machine}</span>
                <span class="flex items-center gap-1.5 font-mono">
                  ${d.isNew ? `<span class="text-blue-400 font-bold">${isEn ? 'New Template' : 'قالب جديد'}</span>` : `
                    <span class="text-emerald-400">+${d.added} ${isEn ? 'add' : 'مضاف'}</span>
                    <span class="text-amber-400">~${d.modified} ${isEn ? 'mod' : 'معدل'}</span>
                    <span class="text-red-400">-${d.removed} ${isEn ? 'del' : 'محذوف'}</span>
                  `}
                </span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } catch (_) {}

    if (previewBox) {
      previewBox.innerHTML = `
        <div class="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 space-y-2">
          <div class="flex items-center justify-between text-xs font-bold text-emerald-400">
            <span>✅ ${isEn ? 'File analyzed successfully' : 'تم تحليل الملف بنجاح'}</span>
            <span>${machineNames.length} ${isEn ? 'Machines' : 'ماكينة'} (${totalItems} ${isEn ? 'Total Items' : 'بند فحص إجمالاً'})</span>
          </div>
          <div class="max-h-32 overflow-y-auto space-y-1.5 pr-1">
            ${machineNames.map(m => `
              <div class="bg-[#0F172A] border border-gray-800 rounded-lg p-2 flex items-center justify-between text-[11px]">
                <span class="font-bold text-white">🏭 ${m}</span>
                <span class="text-gray-400 font-bold bg-[#1E293B] px-2 py-0.5 rounded-full">${machineMap[m].length} ${isEn ? 'items' : 'بنود'}</span>
              </div>
            `).join('')}
          </div>
          ${diffSummaryHtml}
        </div>
      `;
    }

    if (confirmBtn) confirmBtn.disabled = false;
  } catch (err) {
    console.error('Error previewing AM Excel:', err);
    if (previewBox) {
      previewBox.innerHTML = `
        <div class="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400">
          ❌ ${err.message}
        </div>
      `;
    }
  }
};

/**
 * تأكيد حفظ بنود الفحص في Firestore دفعة واحدة
 */
window.confirmAmExcelImport = async function() {
  if (!_parsedAmTemplates) return;
  const isEn = (window.currentLang || 'ar') === 'en';
  const confirmBtn = document.getElementById('amConfirmImportBtn');

  const machineCount = Object.keys(_parsedAmTemplates).length;
  if (!confirm(isEn ? `Apply AM checklist templates to ${machineCount} machines?` : `تطبيق قوالب فحص الـ AM على ${machineCount} ماكينة في النظام؟`)) {
    return;
  }

  try {
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = `⏳ ${isEn ? 'Saving...' : 'جاري الحفظ...'}`;
    }

    const updater = localStorage.getItem('name') || 'Admin';
    const now = new Date().toISOString();

    for (const [machineName, items] of Object.entries(_parsedAmTemplates)) {
      // ITEMS-EDITOR: الحفاظ على سجل الإصدارات وزيادة templateVersion
      let nextVersion = 1;
      let history = [];
      try {
        const existingSnap = await getDoc(doc(db, 'machineAmTemplates', machineName));
        if (existingSnap.exists()) {
          const oldData = existingSnap.data();
          nextVersion = (oldData.templateVersion || 1) + 1;
          history = Array.isArray(oldData.history) ? oldData.history.slice(-9) : [];
          history.push({
            version: oldData.templateVersion || 1,
            updatedAt: oldData.updatedAt || now,
            updatedBy: oldData.updatedBy || updater,
            itemsCount: (oldData.items || []).length
          });
        }
      } catch (_) {}

      await setDoc(doc(db, 'machineAmTemplates', machineName), {
        items,
        templateVersion: nextVersion,
        history,
        updatedAt: now,
        updatedBy: updater
      });
    }

    alert(isEn ? `Successfully saved AM templates for ${machineCount} machines ✅` : `تم حفظ وتفعيل قوالب الـ AM لـ ${machineCount} ماكينة بنجاح ✅`);
    document.getElementById('amBulkImportModal')?.remove();
  } catch (err) {
    console.error('Failed to import AM templates:', err);
    alert((isEn ? 'Error saving templates: ' : 'حدث خطأ أثناء حفظ القوالب: ') + err.message);
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = isEn ? 'Save & Apply to System ✅' : 'تأكيد وحفظ في النظام ✅';
    }
  }
};
