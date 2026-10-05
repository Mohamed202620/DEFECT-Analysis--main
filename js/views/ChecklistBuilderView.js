// ============================================================
// ChecklistBuilderView.js - ITEMS-EDITOR
// محرر بنود الفحص الموحد (Daily AM & 5S Assessment Checklist Editor)
// طبقة عامة بنظام Adapters لإدارة بنود الفحص للمدير والأدمن
// يدعم: الإضافة السريعة، التعديل Inline، إعادة الترتيب، التعطيل Soft-Delete،
// الحذف النهائي، النسخ الجماعي، مكتبة البنود الشائعة، الفلترة اللحظية، المعاينة للفني، وسجل الإصدارات.
// ============================================================

import {
  db,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  writeBatch
} from '../providers/backend/index.js';
import {
  getMachineTypeEntries,
  ensureMachineCatalogReady,
  normalizeLine,
  formatLineLabel
} from '../machines.js';
import { isAdminRole, isManagerRole, getCurrentRole } from '../permissions.js';
import { DEFAULT_AM_ITEMS } from './DailyAMView.js';
import { FIVE_S_PILLARS } from './FiveSView.js';
import { queueOfflineAction } from '../services/offlineQueue.js';
import { escapeJsArg } from "../utils/escapeHtml.js";

// ============================================================
// ADAPTERS SPECIFICATION
// ============================================================
const AM_ADAPTER = {
  id: 'am',
  nameAr: 'فحص AM اليومي',
  nameEn: 'Daily AM Checklist',
  collection: 'machineAmTemplates',
  defaultItems: () => DEFAULT_AM_ITEMS.map((item, idx) => ({
    id: item.id || `am_item_${Date.now()}_${idx}`,
    label: { ar: item.ar || '', en: item.en || '' },
    type: item.type === 'numeric' ? 'numeric' : 'ok_nok',
    unit: item.unit || '',
    min: null,
    max: null,
    critical: false,
    photoRequired: false,
    howTo: { ar: '', en: '' },
    frequency: 'daily',
    order: idx + 1,
    active: true,
    role: item.role || 'operator'
  }))
};

const FIVE_S_ADAPTER = {
  id: '5s',
  nameAr: 'تقييم 5S',
  nameEn: '5S Assessment',
  collection: 'fiveSTemplates',
  defaultItems: () => FIVE_S_PILLARS.map((p, idx) => ({
    id: `5s_pillar_${p.id}`,
    pillar: p.id,
    label: { ar: p.ar || '', en: p.en || '' },
    type: 'ok_nok',
    weight: 1,
    critical: false,
    photoRequired: true,
    howTo: { ar: p.desc?.ar || '', en: p.desc?.en || '' },
    frequency: 'shift',
    order: idx + 1,
    active: true
  }))
};

const ADAPTERS = {
  am: AM_ADAPTER,
  '5s': FIVE_S_ADAPTER
};

// ============================================================
// PRESET LIBRARY (مكتبة البنود الشائعة الجاهزة)
// ============================================================
const PRESET_LIBRARY = {
  am: [
    {
      category: 'lubrication',
      categoryAr: 'التزييت والتشحيم',
      items: [
        { label: { ar: 'فحص منسوب الزيت في خزان التزييت الرئيسي', en: 'Check main lubrication oil tank level' }, type: 'ok_nok', critical: true, photoRequired: true, howTo: { ar: 'تأكد من أن المؤشر بين علامتي Min و Max', en: 'Ensure indicator is between Min & Max' } },
        { label: { ar: 'فحص تشحيم رولمانات البلي وسيور الحركة', en: 'Inspect bearing & conveyor chain greasing' }, type: 'ok_nok', critical: false, photoRequired: false }
      ]
    },
    {
      category: 'pneumatics',
      categoryAr: 'الهواء المضغوط والنيوماتيك',
      items: [
        { label: { ar: 'قياس ضغط الهواء المضغوط الرئيسي للماكينة', en: 'Measure main machine pneumatic air pressure' }, type: 'numeric', unit: 'Bar', min: 6, max: 8, critical: true, photoRequired: true, howTo: { ar: 'يجب أن تكون القراءة بين 6 إلى 8 بار', en: 'Gauge should read between 6 - 8 Bar' } },
        { label: { ar: 'فحص خراطيم وتوصيلات الهواء والتأكد من عدم وجود تسريب صوتي', en: 'Inspect pneumatic hoses for audible leaks' }, type: 'ok_nok', critical: false, photoRequired: true }
      ]
    },
    {
      category: 'electrical',
      categoryAr: 'الكهرباء والحساسات',
      items: [
        { label: { ar: 'قياس درجة حرارة المحرك الرئيسي بالأشعة', en: 'Measure main drive motor temperature' }, type: 'numeric', unit: '°C', min: 25, max: 75, critical: true, photoRequired: true },
        { label: { ar: 'نظافة عدسات وحساسات الرؤية والضوء (Photo-sensors)', en: 'Clean optical & proximity sensor lenses' }, type: 'ok_nok', critical: false, photoRequired: false },
        { label: { ar: 'التأكد من إغلاق أبواب اللوحات الكهربائية وإحكامها', en: 'Verify electrical enclosure doors locked' }, type: 'ok_nok', critical: true, photoRequired: true }
      ]
    },
    {
      category: 'safety',
      categoryAr: 'السلامة والأمان (Safety)',
      items: [
        { label: { ar: 'تجربة زر الإيقاف الطارئ (Emergency Stop) والتأكد من إيقاف الماكينة فوراً', en: 'Test Emergency Stop button immediate action' }, type: 'ok_nok', critical: true, photoRequired: true },
        { label: { ar: 'سلامة ستائر وحواجز الأمان الضوئية والميكانيكية', en: 'Safety light curtains & mechanical guards intact' }, type: 'ok_nok', critical: true, photoRequired: true }
      ]
    },
    {
      category: 'cleaning',
      categoryAr: 'النظافة العامة والميكانيكا',
      items: [
        { label: { ar: 'فحص وربط البراغي والمسامير المعرضة للاهتزاز', en: 'Check and tighten vibration-exposed bolts' }, type: 'ok_nok', critical: false, photoRequired: false },
        { label: { ar: 'إزالة الرايش وبقايا الإنتاج المتراكمة داخل ممرات الحركة', en: 'Clear production chips/debris from guide rails' }, type: 'ok_nok', critical: false, photoRequired: false }
      ]
    }
  ],
  '5s': [
    {
      pillar: 'sort',
      categoryAr: 'الفرز (Sort)',
      items: [
        { label: { ar: 'إزالة الأدوات المكسورة وقطع الغيار التالفة من جوار الماكينة', en: 'Remove broken tools and scrap from machine area' }, type: 'ok_nok', weight: 1, photoRequired: true },
        { label: { ar: 'عدم وجود كراتين أو خامات زائدة تعيق حركة الممر', en: 'No excess boxes or raw materials blocking aisles' }, type: 'ok_nok', weight: 1, photoRequired: false }
      ]
    },
    {
      pillar: 'setInOrder',
      categoryAr: 'الترتيب (Set In Order)',
      items: [
        { label: { ar: 'لوحة العدة مكتملة وكل أداة موضوعة في موضعها المظلل (Shadow Board)', en: 'Shadow board complete with every tool in marked place' }, type: 'ok_nok', weight: 1, photoRequired: true },
        { label: { ar: 'تحديد أماكن البالتات ومسارات الحركة بخطوط أرضية واضحة', en: 'Pallet drop zones and pathways visibly marked on floor' }, type: 'ok_nok', weight: 1, photoRequired: false }
      ]
    },
    {
      pillar: 'shine',
      categoryAr: 'النظافة (Shine)',
      items: [
        { label: { ar: 'جسم وهيكل الماكينة خالي تماماً من بقع الشحم والزيت القديمة', en: 'Machine body completely free of grease and oil spills' }, type: 'ok_nok', weight: 1, photoRequired: true },
        { label: { ar: 'أرضية منطقة العمل نظيفة وجافة لتجنب الانزلاق', en: 'Floor in work area clean and completely dry' }, type: 'ok_nok', weight: 1, photoRequired: true }
      ]
    },
    {
      pillar: 'standardize',
      categoryAr: 'توحيد المعايير (Standardize)',
      items: [
        { label: { ar: 'ملصقات التعريف ومعايير التشحيم اليومية معلقة وواضحة', en: 'Identification labels and daily lubrication chart displayed' }, type: 'ok_nok', weight: 1, photoRequired: false },
        { label: { ar: 'مؤشرات الضغط والحرارة عليها علامات النطاق الأخضر السليم', en: 'Gauges marked with green operating range zones' }, type: 'ok_nok', weight: 1, photoRequired: false }
      ]
    },
    {
      pillar: 'sustain',
      categoryAr: 'الاستمرارية (Sustain)',
      items: [
        { label: { ar: 'تسجيل تقييم 5S بنهاية الوردية بانتظام وبدون تأخير', en: 'Conduct and submit 5S check at end of every shift' }, type: 'ok_nok', weight: 1, photoRequired: false },
        { label: { ar: 'معالجة أي ملاحظة غير سليمة تم رصدها في الفحص السابق', en: 'Past 5S non-conformances resolved' }, type: 'ok_nok', weight: 1, photoRequired: true }
      ]
    }
  ]
};

// State
let currentTab = 'am'; // 'am' or '5s'
let currentTargetId = ''; // e.g. "Bodymaker 01"
let currentItems = [];
let loadedTemplateVersion = 1;
let loadedHistory = [];
let editingItemId = null;
let allMachineOptions = [];
let itemSearchQuery = '';
let itemStatusFilter = 'all'; // 'all', 'active', 'inactive', 'critical'

function t() {
  const isEn = (window.currentLang || 'ar') === 'en';
  return {
    pageTitle: isEn ? 'Checklist Items Editor' : 'محرر بنود الفحص وقوالب الماكينات',
    pageSubtitle: isEn
      ? 'Manage and customize AM and 5S inspection points directly'
      : 'إدارة وتخصيص بنود فحص الصيانة الذاتية AM وتقييم 5S مباشرة',
    tabAm: isEn ? '📋 Daily AM' : '📋 فحص AM اليومي',
    tab5s: isEn ? '🧹 5S Assessment' : '🧹 تقييم 5S',
    selectMachine: isEn ? 'Select Machine...' : 'اختر الماكينة...',
    noMachineSelected: isEn ? 'Please choose a machine to view or edit its checklist.' : 'يرجى اختيار ماكينة لعرض بنود الفحص وتعديلها.',
    addItemBtn: isEn ? 'Add Item' : 'إضافة بند جديد',
    presetsBtn: isEn ? 'Presets Library' : 'مكتبة بنود شائعة',
    copyFromBtn: isEn ? 'Copy Template' : 'نسخ من ماكينة',
    previewBtn: isEn ? 'Preview' : 'معاينة كفني',
    historyBtn: isEn ? 'History' : 'سجل الإصدارات',
    saveBtn: isEn ? 'Save Template' : 'حفظ القالب',
    itemsCount: isEn ? 'Items' : 'بنود',
    activeLabel: isEn ? 'Active' : 'مفعل',
    inactiveLabel: isEn ? 'Disabled' : 'معطل',
    criticalBadge: isEn ? 'Critical' : 'حرج',
    photoReqBadge: isEn ? 'Photo Req' : 'صورة إجبارية',
    numericType: isEn ? 'Numeric Reading' : 'قراءة رقمية',
    okNokType: isEn ? 'OK / Not OK' : 'سليم / غير سليم',
    textType: isEn ? 'Text Note' : 'نصي / ملاحظة',
    dailyFreq: isEn ? 'Daily' : 'يومي',
    shiftFreq: isEn ? 'Every Shift' : 'كل وردية',
    weeklyFreq: isEn ? 'Weekly' : 'أسبوعي',
    saveSuccess: isEn ? 'Template saved successfully ✅' : 'تم حفظ القالب بنجاح وتطبيقه على النظام ✅',
    versionConflict: isEn ? '⚠️ Template was updated by another manager. Please refresh!' : '⚠️ تم تعديل هذا القالب بواسطة مدير آخر. يرجى التحديث لتجنب التعارض!',
    copySuccess: isEn ? 'Items copied successfully! Remember to save.' : 'تم نسخ البنود بنجاح! لا تنسَ الضغط على حفظ القالب.',
    applySuccess: isEn ? 'Item applied to target machines ✅' : 'تم تطبيق البند على الماكينات المحددة بنجاح ✅',
    confirmSoftDelete: isEn ? 'Disable this item? (It remains archived in past records)' : 'هل تريد تعطيل هذا البند؟ (سيبقى محفوظاً في السجلات التاريخية)',
    confirmPermanentDelete: isEn ? 'Delete this item permanently from this machine template?' : 'هل تريد حذف هذا البند نهائياً من قالب هذه الماكينة؟',
    offlineQueued: isEn ? 'Offline: Changes saved locally and will sync when reconnected.' : 'أنت غير متصل بالإنترنت: تم حفظ التعديل محلياً وسيتم المزامنة تلقائياً عند عودة الاتصال.'
  };
}

export const ChecklistBuilderView = () => {
  const isEn = (window.currentLang || 'ar') === 'en';
  const tr = t();

  // فحص الصلاحية الصارم: مدير أو أدمن فقط
  const role = getCurrentRole();
  if (!isAdminRole(role) && !isManagerRole(role)) {
    return `
      <div class="app-page p-4 max-w-md mx-auto text-center space-y-4 pt-12 text-white">
        <div class="text-4xl">🔒</div>
        <h2 class="text-lg font-bold text-red-400">${isEn ? 'Access Denied' : 'غير مصرح بالدخول'}</h2>
        <p class="text-xs text-gray-400">${isEn ? 'Only Managers and Admins can access the Checklist Editor.' : 'محرر بنود الفحص مخصص للمديرين ورؤساء الأقسام والأدمن فقط.'}</p>
        <button onclick="window.goBack('home')" class="px-4 py-2 bg-gray-800 text-white rounded-xl text-xs font-bold">${isEn ? 'Back Home' : 'رجوع للرئيسية'}</button>
      </div>
    `;
  }

  return `
  <div class="app-page p-3 sm:p-4 md:p-6 max-w-5xl mx-auto pb-28 text-white space-y-4">
    <!-- الشريط العلوي -->
    <div class="flex items-center justify-between">
      <button onclick="window.goBack('home')" class="bg-[#1E293B] hover:bg-[#283548] active:scale-95 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 border border-slate-700/80 shadow-sm cursor-pointer">
        <span class="text-amber-400 font-black">${isEn ? '←' : '→'}</span>
        <span>${isEn ? 'Back' : 'رجوع'}</span>
      </button>

      <div class="flex items-center gap-2">
        <span id="cbOnlineBadge" class="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>${isEn ? 'System Live' : 'مُصلح وقابل للتخصيص'}</span>
        </span>
      </div>
    </div>

    <!-- ترويسة الصفحة -->
    <div class="bg-gradient-to-r from-[#1E293B] via-[#1E293B] to-[#0F172A] p-4 rounded-2xl border border-slate-800 shadow-lg flex items-center justify-between flex-wrap gap-3">
      <div class="flex items-center gap-3">
        <span class="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-xl shrink-0 shadow-inner">🛠️</span>
        <div>
          <h1 class="text-base sm:text-lg font-black text-white leading-tight">${tr.pageTitle}</h1>
          <p class="text-[11px] text-slate-400 mt-0.5">${tr.pageSubtitle}</p>
        </div>
      </div>

      <!-- التبويبات الرئيسية (AM / 5S) -->
      <div class="flex bg-[#0F172A] p-1 rounded-xl border border-slate-800 shrink-0">
        <button
          type="button"
          id="cbTabAmBtn"
          onclick="window.switchChecklistTab('am')"
          class="py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all bg-blue-600 text-white shadow-sm cursor-pointer">
          ${tr.tabAm}
        </button>
        <button
          type="button"
          id="cbTab5sBtn"
          onclick="window.switchChecklistTab('5s')"
          class="py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all text-slate-400 hover:text-white cursor-pointer">
          ${tr.tab5s}
        </button>
      </div>
    </div>

    <!-- شريط التحكم واختيار الماكينة والقالب -->
    <div class="bg-[#1E293B] border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-3.5 shadow-xl">
      
      <div class="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
        <!-- اختيار الماكينة -->
        <div class="sm:col-span-8">
          <label class="block text-[11px] font-bold text-slate-300 mb-1 flex items-center justify-between">
            <span>🏭 ${isEn ? 'Select Target Machine:' : 'الماكينة المستهدفة للتعود والتخصيص:'}</span>
            <span id="cbMachineLineTag" class="text-[10px] text-blue-400 font-normal"></span>
          </label>
          <div class="relative">
            <select
              id="cbMachineSelect"
              onchange="window.onChecklistMachineSelected(this.value)"
              class="w-full p-2.5 rounded-xl bg-[#0F172A] border border-slate-700 text-white text-xs outline-none focus:border-blue-500 transition shadow-inner font-medium">
              <option value="" disabled selected>${tr.selectMachine}</option>
            </select>
          </div>
        </div>

        <!-- معلومات النسخة وزر الحفظ -->
        <div class="sm:col-span-4 flex items-center justify-end gap-2 pt-1 sm:pt-4">
          <span id="cbVersionBadge" class="text-[10px] font-mono font-bold text-slate-300 bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-700 shadow-inner">
            v1
          </span>
          <button
            type="button"
            id="cbSaveTemplateBtn"
            onclick="window.saveCurrentChecklistTemplate()"
            disabled
            class="flex-1 sm:flex-none px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/20 transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer">
            <span>💾</span>
            <span>${tr.saveBtn}</span>
          </button>
        </div>
      </div>

      <!-- أزرار الإجراءات السريعة (تظهر عند اختيار ماكينة) -->
      <div id="cbToolbarActions" class="hidden flex flex-wrap gap-2 pt-3 border-t border-slate-800">
        <button
          type="button"
          onclick="window.openAddItemModal()"
          class="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer">
          <span>➕</span>
          <span>${tr.addItemBtn}</span>
        </button>

        <button
          type="button"
          onclick="window.openPresetsModal()"
          class="px-3.5 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 active:scale-95 text-purple-300 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer">
          <span>💡</span>
          <span>${tr.presetsBtn}</span>
        </button>

        <button
          type="button"
          onclick="window.openCopyFromModal()"
          class="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 active:scale-95 text-slate-200 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer">
          <span>📋</span>
          <span>${tr.copyFromBtn}</span>
        </button>

        <button
          type="button"
          onclick="window.openTechPreviewModal()"
          class="px-3.5 py-2 bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 active:scale-95 text-sky-300 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer">
          <span>👁️</span>
          <span>${tr.previewBtn}</span>
        </button>

        <button
          type="button"
          onclick="window.openHistoryModal()"
          class="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 active:scale-95 text-slate-300 font-bold text-xs rounded-xl transition flex items-center gap-1.5 ms-auto cursor-pointer">
          <span>🕒</span>
          <span>${tr.historyBtn}</span>
        </button>
      </div>

    </div>

    <!-- فلتر وبحث البنود داخل الماكينة الحالية -->
    <div id="cbItemFilterBar" class="hidden bg-[#1E293B] border border-slate-800 rounded-xl p-2.5 flex items-center justify-between flex-wrap gap-2 text-xs">
      <div class="flex items-center gap-2 flex-1 min-w-[200px]">
        <span class="text-slate-400">🔍</span>
        <input
          id="cbItemSearchInput"
          type="text"
          oninput="window.filterChecklistItems()"
          placeholder="${isEn ? 'Search points in current machine...' : 'بحث سريع في بنود الفحص المفتوحة...'}"
          class="w-full bg-[#0F172A] border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-blue-500 transition">
      </div>

      <div class="flex items-center gap-1.5 shrink-0 text-[11px]">
        <button type="button" onclick="window.setChecklistFilterStatus('all')" id="btnFilterAll" class="px-2.5 py-1 rounded-lg font-bold bg-blue-600 text-white transition">
          ${isEn ? 'All' : 'الكل'}
        </button>
        <button type="button" onclick="window.setChecklistFilterStatus('active')" id="btnFilterActive" class="px-2.5 py-1 rounded-lg font-bold bg-slate-800 text-slate-400 hover:text-white transition">
          🟢 ${isEn ? 'Active' : 'المفعلة'}
        </button>
        <button type="button" onclick="window.setChecklistFilterStatus('critical')" id="btnFilterCritical" class="px-2.5 py-1 rounded-lg font-bold bg-slate-800 text-slate-400 hover:text-white transition">
          ⚠️ ${isEn ? 'Critical' : 'الحرجة'}
        </button>
      </div>
    </div>

    <!-- حاوية بنود الفحص -->
    <div id="cbItemsContainer" class="space-y-2.5">
      <div class="bg-[#1E293B] rounded-2xl p-10 border border-slate-800 text-center text-xs text-slate-400 shadow-md">
        ${tr.noMachineSelected}
      </div>
    </div>
  </div>

  <!-- حاوية النوافذ المنبثقة (Modals Container) -->
  <div id="cbModalsContainer"></div>
  `;
};

// ============================================================
// INITIALIZATION & EVENT HANDLERS
// ============================================================
window.initChecklistBuilderView = async function () {
  await ensureMachineCatalogReady();

  // تعبئة قائمة الماكينات المسجلة
  const entries = getMachineTypeEntries({ includeInactive: false });
  allMachineOptions = [];
  entries.forEach(entry => {
    const units = Array.isArray(entry.units) && entry.units.length ? entry.units : [''];
    units.forEach(u => {
      const val = u ? `${entry.key} ${u}`.trim() : entry.key;
      allMachineOptions.push({
        value: val,
        key: entry.key,
        unit: u,
        line: entry.line || '',
        department: entry.department || ''
      });
    });
  });

  const select = document.getElementById('cbMachineSelect');
  if (select) {
    const isEn = (window.currentLang || 'ar') === 'en';
    select.innerHTML = `
      <option value="" disabled selected>${isEn ? 'Select Machine...' : 'اختر الماكينة...'}</option>
      ${allMachineOptions.map(m => `
        <option value="${escapeHtml(m.value)}">🏭 ${escapeHtml(m.value)}${m.line ? ` (${formatLineLabel(m.line)})` : ''}</option>
      `).join('')}
    `;

    // إذا كانت هناك ماكينة نشطة، نختارها تلقائياً
    const active = localStorage.getItem('activeMachine');
    if (active && allMachineOptions.some(m => m.value === active)) {
      select.value = active;
      window.onChecklistMachineSelected(active);
    }
  }
};

window.switchChecklistTab = function (tabKey) {
  if (currentTab === tabKey) return;
  currentTab = tabKey;

  const amBtn = document.getElementById('cbTabAmBtn');
  const fiveSBtn = document.getElementById('cbTab5sBtn');

  if (tabKey === 'am') {
    amBtn.className = 'py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all bg-blue-600 text-white shadow-sm cursor-pointer';
    fiveSBtn.className = 'py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all text-slate-400 hover:text-white cursor-pointer';
  } else {
    fiveSBtn.className = 'py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all bg-emerald-600 text-white shadow-sm cursor-pointer';
    amBtn.className = 'py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all text-slate-400 hover:text-white cursor-pointer';
  }

  // إعادة تحميل بنود الماكينة الحالية للتبويب الجديد
  if (currentTargetId) {
    window.onChecklistMachineSelected(currentTargetId);
  }
};

window.onChecklistMachineSelected = async function (machineVal) {
  if (!machineVal) return;
  currentTargetId = machineVal;
  const isEn = (window.currentLang || 'ar') === 'en';
  const adapter = ADAPTERS[currentTab];

  const mOpt = allMachineOptions.find(m => m.value === machineVal);
  const lineTag = document.getElementById('cbMachineLineTag');
  if (lineTag) {
    lineTag.textContent = mOpt?.line ? formatLineLabel(mOpt.line) : '';
  }

  const toolbar = document.getElementById('cbToolbarActions');
  if (toolbar) toolbar.classList.remove('hidden');

  const filterBar = document.getElementById('cbItemFilterBar');
  if (filterBar) filterBar.classList.remove('hidden');

  const container = document.getElementById('cbItemsContainer');
  if (container) {
    container.innerHTML = `
      <div class="bg-[#1E293B] rounded-2xl p-8 border border-slate-800 text-center text-xs text-slate-400 animate-pulse">
        ⏳ ${isEn ? 'Loading checklist template...' : 'جاري تحميل بنود الفحص...'}
      </div>
    `;
  }

  try {
    const docSnap = await getDoc(doc(db, adapter.collection, machineVal));
    if (docSnap.exists() && docSnap.data().items && docSnap.data().items.length > 0) {
      currentItems = docSnap.data().items.map((item, idx) => ({
        ...item,
        order: item.order != null ? item.order : idx + 1,
        active: item.active !== false
      }));
      loadedTemplateVersion = docSnap.data().templateVersion || 1;
      loadedHistory = Array.isArray(docSnap.data().history) ? docSnap.data().history : [];
    } else {
      // استخدام البنود الافتراضية
      currentItems = adapter.defaultItems();
      loadedTemplateVersion = 1;
      loadedHistory = [];
    }
  } catch (err) {
    console.warn("Failed to fetch template, using defaults:", err);
    currentItems = adapter.defaultItems();
    loadedTemplateVersion = 1;
  }

  // فرز البنود حسب حقل order
  currentItems.sort((a, b) => (a.order || 0) - (b.order || 0));

  // تحديث شارة الإصدار وزر الحفظ
  const vBadge = document.getElementById('cbVersionBadge');
  if (vBadge) vBadge.textContent = `v${loadedTemplateVersion}`;

  const saveBtn = document.getElementById('cbSaveTemplateBtn');
  if (saveBtn) saveBtn.disabled = false;

  renderItemsList();
};

window.setChecklistFilterStatus = function(status) {
  itemStatusFilter = status;
  ['All', 'Active', 'Critical'].forEach(st => {
    const btn = document.getElementById(`btnFilter${st}`);
    if (btn) {
      if (st.toLowerCase() === status) {
        btn.className = 'px-2.5 py-1 rounded-lg font-bold bg-blue-600 text-white transition';
      } else {
        btn.className = 'px-2.5 py-1 rounded-lg font-bold bg-slate-800 text-slate-400 hover:text-white transition';
      }
    }
  });
  renderItemsList();
};

window.filterChecklistItems = function() {
  const input = document.getElementById('cbItemSearchInput');
  itemSearchQuery = (input?.value || '').trim().toLowerCase();
  renderItemsList();
};

// ============================================================
// RENDERING ITEMS LIST (INLINE EDIT & REORDER)
// ============================================================
function renderItemsList() {
  const container = document.getElementById('cbItemsContainer');
  if (!container) return;

  const isEn = (window.currentLang || 'ar') === 'en';
  const tr = t();

  if (!currentItems || currentItems.length === 0) {
    container.innerHTML = `
      <div class="bg-[#1E293B] rounded-2xl p-8 border border-slate-800 text-center space-y-3">
        <p class="text-xs text-slate-400">${isEn ? 'No inspection points in this template.' : 'لا توجد بنود فحص في هذا القالب.'}</p>
        <button onclick="window.openAddItemModal()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white shadow-md cursor-pointer">
          ➕ ${tr.addItemBtn}
        </button>
      </div>
    `;
    return;
  }

  // فلترة البنود حسب البحث والفلتر الجانبي
  let filtered = currentItems.filter(item => {
    const isActive = item.active !== false;
    if (itemStatusFilter === 'active' && !isActive) return false;
    if (itemStatusFilter === 'critical' && !item.critical) return false;

    if (itemSearchQuery) {
      const arLabel = (item.label?.ar || item.ar || '').toLowerCase();
      const enLabel = (item.label?.en || item.en || '').toLowerCase();
      const howTo = (item.howTo?.ar || item.howTo?.en || '').toLowerCase();
      return arLabel.includes(itemSearchQuery) || enLabel.includes(itemSearchQuery) || howTo.includes(itemSearchQuery);
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="bg-[#1E293B] rounded-2xl p-6 border border-slate-800 text-center text-xs text-slate-400">
        🔍 ${isEn ? 'No inspection points matched your search query.' : 'لم يتم العثور على بنود مطابقة لنتائج الفلترة.'}
      </div>
    `;
    return;
  }

  const itemsHtml = filtered.map((item, index) => {
    const originalIndex = currentItems.findIndex(i => i.id === item.id);
    const labelText = item.label ? (isEn ? (item.label.en || item.label.ar) : (item.label.ar || item.label.en)) : (isEn ? item.en : item.ar);
    const howToText = item.howTo ? (isEn ? item.howTo.en : item.howTo.ar) : '';
    const isActive = item.active !== false;

    // Badges
    const typeBadge = item.type === 'numeric'
      ? `<span class="text-[9.5px] font-bold px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 font-mono">🔢 ${item.unit || tr.numericType}</span>`
      : item.type === 'text'
      ? `<span class="text-[9.5px] font-bold px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">📝 ${tr.textType}</span>`
      : `<span class="text-[9.5px] font-bold px-2 py-0.5 rounded bg-slate-700/60 text-slate-300 border border-slate-600/50">✅ ${tr.okNokType}</span>`;

    const criticalBadge = item.critical
      ? `<span class="text-[9.5px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">⚠️ ${tr.criticalBadge}</span>`
      : '';

    const photoBadge = item.photoRequired
      ? `<span class="text-[9.5px] font-bold px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">📷 ${tr.photoReqBadge}</span>`
      : '';

    const pillarBadge = item.pillar
      ? `<span class="text-[9.5px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono">🏛️ ${item.pillar.toUpperCase()}</span>`
      : '';

    return `
      <div
        id="cbItemRow_${escapeHtml(item.id)}"
        class="bg-[#1E293B] rounded-2xl p-3.5 sm:p-4 border ${isActive ? 'border-slate-800' : 'border-red-900/40 opacity-60 bg-slate-900/40'} transition hover:border-slate-700 shadow-md space-y-2.5">
        
        <!-- الصف الرئيسي: الترتيب + العنوان + الإجراءات -->
        <div class="flex items-start justify-between gap-2.5">
          <div class="flex items-start gap-2.5 flex-1 min-w-0">
            <!-- أزرار الصعود والهبوط السريع -->
            <div class="flex flex-col gap-1 shrink-0 pt-0.5">
              <button
                type="button"
                onclick="window.moveChecklistItem(${originalIndex}, -1)"
                ${originalIndex === 0 ? 'disabled' : ''}
                class="w-6 h-5 bg-slate-800 hover:bg-slate-700 disabled:opacity-20 rounded text-[10px] flex items-center justify-center text-slate-300 transition cursor-pointer"
                title="${isEn ? 'Move Up' : 'تحريك لأعلى'}">▲</button>
              <button
                type="button"
                onclick="window.moveChecklistItem(${originalIndex}, 1)"
                ${originalIndex === currentItems.length - 1 ? 'disabled' : ''}
                class="w-6 h-5 bg-slate-800 hover:bg-slate-700 disabled:opacity-20 rounded text-[10px] flex items-center justify-center text-slate-300 transition cursor-pointer"
                title="${isEn ? 'Move Down' : 'تحريك لأسفل'}">▼</button>
            </div>

            <!-- اسم البند والبادجات -->
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 flex-wrap mb-1">
                <span class="text-[10px] font-mono font-bold text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded">#${originalIndex + 1}</span>
                ${pillarBadge}
                ${typeBadge}
                ${criticalBadge}
                ${photoBadge}
              </div>
              <h4 class="text-xs sm:text-sm font-bold text-white break-words ${!isActive ? 'line-through text-slate-400' : ''}">
                ${escapeHtml(labelText)}
              </h4>
              ${howToText ? `
                <div class="text-[10px] text-slate-300 bg-slate-900/60 p-2 rounded-xl border border-slate-800/80 mt-1.5 flex items-start gap-1.5">
                  <span class="text-amber-400">💡</span>
                  <span class="leading-relaxed">${escapeHtml(howToText)}</span>
                </div>
              ` : ''}
              ${item.type === 'numeric' && (item.min != null || item.max != null) ? `
                <div class="text-[10px] text-blue-300 font-mono mt-1 bg-blue-950/30 px-2 py-0.5 rounded w-fit border border-blue-500/20">
                  [${item.min != null ? `Min: ${item.min} ` : ''}${item.max != null ? `Max: ${item.max} ` : ''}${item.unit || ''}]
                </div>
              ` : ''}
            </div>
          </div>

          <!-- أزرار الإجراءات السريعة على البند -->
          <div class="flex items-center gap-1.5 shrink-0">
            <!-- مفتاح التفعيل/التعطيل (Soft Delete) -->
            <button
              type="button"
              onclick="window.toggleChecklistItemActive('${escapeJsArg(item.id)}')"
              class="px-2.5 py-1 rounded-xl text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                isActive
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25'
                  : 'bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25'
              }"
              title="${isActive ? tr.activeLabel : tr.inactiveLabel}">
              <span>${isActive ? '🟢' : '🔴'}</span>
              <span class="hidden sm:inline">${isActive ? tr.activeLabel : tr.inactiveLabel}</span>
            </button>

            <!-- زر التعديل -->
            <button
              type="button"
              onclick="window.openEditItemModal('${escapeJsArg(item.id)}')"
              class="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer text-xs active:scale-95"
              title="${isEn ? 'Edit' : 'تعديل'}">
              ✏️
            </button>

            <!-- تطبيق على ماكينات أخرى -->
            <button
              type="button"
              onclick="window.openApplyToOthersModal('${escapeJsArg(item.id)}')"
              class="p-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 transition cursor-pointer text-xs active:scale-95"
              title="${isEn ? 'Apply to other machines' : 'تطبيق على ماكينات أخرى'}">
              🚀
            </button>

            <!-- حذف نهائي -->
            <button
              type="button"
              onclick="window.deleteChecklistItemPermanent('${escapeJsArg(item.id)}')"
              class="p-2 rounded-xl bg-red-600/15 hover:bg-red-600/30 text-red-400 border border-red-500/30 transition cursor-pointer text-xs active:scale-95"
              title="${isEn ? 'Delete permanently' : 'حذف نهائي'}">
              🗑️
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="flex items-center justify-between px-1 text-xs text-slate-400 font-bold mb-1">
      <span>${filtered.length} من أصل ${currentItems.length} ${tr.itemsCount}</span>
      <span class="text-[10px] text-slate-500 font-normal">${isEn ? 'Use ▲▼ to reorder items' : 'استخدم الأسهم ▲▼ لإعادة ترتيب البنود'}</span>
    </div>
    <div class="space-y-2">
      ${itemsHtml}
    </div>
  `;
}

window.moveChecklistItem = function (index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= currentItems.length) return;

  const item = currentItems.splice(index, 1)[0];
  currentItems.splice(newIndex, 0, item);

  // تحديث حقل order
  currentItems.forEach((it, idx) => {
    it.order = idx + 1;
  });

  renderItemsList();
};

window.toggleChecklistItemActive = function (itemId) {
  const item = currentItems.find(i => i.id === itemId);
  if (!item) return;

  const tr = t();
  if (item.active !== false) {
    if (!confirm(tr.confirmSoftDelete)) return;
    item.active = false;
  } else {
    item.active = true;
  }

  item.updatedAt = new Date().toISOString();
  item.updatedBy = localStorage.getItem('name') || 'Manager';

  renderItemsList();
};

window.deleteChecklistItemPermanent = function (itemId) {
  const item = currentItems.find(i => i.id === itemId);
  if (!item) return;

  const tr = t();
  if (!confirm(tr.confirmPermanentDelete)) return;

  currentItems = currentItems.filter(i => i.id !== itemId);
  currentItems.forEach((it, idx) => {
    it.order = idx + 1;
  });

  renderItemsList();
};

// ============================================================
// ADD / EDIT ITEM MODAL (2-STEP QUICK FORM)
// ============================================================
window.openAddItemModal = function () {
  editingItemId = null;
  renderItemFormModal({
    id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    label: { ar: '', en: '' },
    type: 'ok_nok',
    pillar: currentTab === '5s' ? 'sort' : undefined,
    weight: 1,
    min: null,
    max: null,
    unit: '',
    critical: false,
    photoRequired: false,
    howTo: { ar: '', en: '' },
    frequency: currentTab === '5s' ? 'shift' : 'daily',
    active: true
  });
};

window.openEditItemModal = function (itemId) {
  const item = currentItems.find(i => i.id === itemId);
  if (!item) return;
  editingItemId = itemId;
  renderItemFormModal(item);
};

function renderItemFormModal(itemData) {
  const isEn = (window.currentLang || 'ar') === 'en';
  const isEdit = !!editingItemId;
  const is5s = currentTab === '5s';

  const modalContainer = document.getElementById('cbModalsContainer');
  if (!modalContainer) return;

  const arText = itemData.label ? (itemData.label.ar || '') : (itemData.ar || '');
  const enText = itemData.label ? (itemData.label.en || '') : (itemData.en || '');
  const howToAr = itemData.howTo?.ar || '';
  const howToEn = itemData.howTo?.en || '';

  modalContainer.innerHTML = `
    <div id="cbItemFormModal" class="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div class="bg-[#1E293B] border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        
        <!-- Header -->
        <div class="p-4 bg-[#0F172A] border-b border-slate-800 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2">
            <span class="text-base">${isEdit ? '✏️' : '➕'}</span>
            <h3 class="font-bold text-white text-sm">
              ${isEdit ? (isEn ? 'Edit Inspection Point' : 'تعديل بند الفحص') : (isEn ? 'Add New Inspection Point' : 'إضافة بند فحص جديد')}
            </h3>
          </div>
          <button type="button" onclick="document.getElementById('cbItemFormModal')?.remove()" class="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer">✕</button>
        </div>

        <!-- Form Body -->
        <form id="cbItemForm" onsubmit="window.saveItemFormData(event)" class="p-4 overflow-y-auto space-y-4">
          <input type="hidden" id="cbfId" value="${escapeHtml(itemData.id)}">

          <!-- STEP 1: الأساسيات (النص والنوع) -->
          <div class="space-y-3">
            <div class="text-[11px] font-black text-blue-400 tracking-wide flex items-center gap-1.5">
              <span>1️⃣</span>
              <span>${isEn ? 'Basic Information' : 'البيانات الأساسية للبند'}</span>
            </div>

            <!-- النص العربي -->
            <div>
              <label class="block text-[11px] font-bold text-slate-300 mb-1">
                ${isEn ? 'Description (Arabic) *' : 'نص البند (بالعربية) *'}
              </label>
              <textarea
                id="cbfLabelAr"
                required
                rows="2"
                placeholder="${isEn ? 'e.g. Check main oil level...' : 'مثال: فحص منسوب الزيت في خزان التزييت الرئيسي...'}"
                class="w-full p-2.5 rounded-xl bg-[#0F172A] border border-slate-700 text-white text-xs outline-none focus:border-blue-500 transition resize-none shadow-inner">${escapeHtml(arText)}</textarea>
            </div>

            <!-- النص الإنجليزي -->
            <div>
              <label class="block text-[11px] font-bold text-slate-300 mb-1">
                ${isEn ? 'Description (English)' : 'نص البند (بالإنجليزي - اختياري)'}
              </label>
              <input
                id="cbfLabelEn"
                type="text"
                value="${escapeHtml(enText)}"
                placeholder="e.g. Check lubrication oil level..."
                class="w-full p-2.5 rounded-xl bg-[#0F172A] border border-slate-700 text-white text-xs outline-none focus:border-blue-500 transition">
            </div>

            <!-- نوع التقييم -->
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[11px] font-bold text-slate-300 mb-1">
                  ${isEn ? 'Evaluation Type' : 'نوع الفحص'}
                </label>
                <select
                  id="cbfType"
                  onchange="window.onItemTypeChanged(this.value)"
                  class="w-full p-2.5 rounded-xl bg-[#0F172A] border border-slate-700 text-white text-xs outline-none focus:border-blue-500 transition">
                  <option value="ok_nok" ${itemData.type === 'ok_nok' ? 'selected' : ''}>✅ ${isEn ? 'OK / Not OK' : 'سليم / غير سليم'}</option>
                  <option value="numeric" ${itemData.type === 'numeric' ? 'selected' : ''}>🔢 ${isEn ? 'Numeric Reading' : 'قراءة رقمية'}</option>
                  <option value="text" ${itemData.type === 'text' ? 'selected' : ''}>📝 ${isEn ? 'Text Note' : 'ملاحظة نصية'}</option>
                </select>
              </div>

              <!-- في حالة 5S: اختيار الركيزة -->
              ${is5s ? `
              <div>
                <label class="block text-[11px] font-bold text-emerald-400 mb-1">
                  ${isEn ? '5S Pillar' : 'الركيزة (5S)'}
                </label>
                <select
                  id="cbfPillar"
                  class="w-full p-2.5 rounded-xl bg-[#0F172A] border border-slate-700 text-white text-xs outline-none focus:border-emerald-500 transition font-bold">
                  ${FIVE_S_PILLARS.map(p => `
                    <option value="${escapeHtml(p.id)}" ${itemData.pillar === p.id ? 'selected' : ''}>${isEn ? p.en : p.ar}</option>
                  `).join('')}
                </select>
              </div>
              ` : `
              <div>
                <label class="block text-[11px] font-bold text-slate-300 mb-1">
                  ${isEn ? 'Frequency' : 'الدورية'}
                </label>
                <select
                  id="cbfFrequency"
                  class="w-full p-2.5 rounded-xl bg-[#0F172A] border border-slate-700 text-white text-xs outline-none focus:border-blue-500 transition">
                  <option value="daily" ${itemData.frequency === 'daily' ? 'selected' : ''}>${isEn ? 'Daily' : 'يومي'}</option>
                  <option value="shift" ${itemData.frequency === 'shift' ? 'selected' : ''}>${isEn ? 'Every Shift' : 'كل وردية'}</option>
                  <option value="weekly" ${itemData.frequency === 'weekly' ? 'selected' : ''}>${isEn ? 'Weekly' : 'أسبوعي'}</option>
                </select>
              </div>
              `}
            </div>

            <!-- الحقول الرقمية المخصصة (تظهر فقط عند اختيار numeric) -->
            <div id="cbfNumericFields" class="${itemData.type === 'numeric' ? '' : 'hidden'} p-3 rounded-xl bg-[#0F172A] border border-slate-800 space-y-2">
              <div class="text-[10px] font-bold text-blue-300">⚙️ ${isEn ? 'Numeric Limits & Unit:' : 'الحدود الرقمية ووحدة القياس:'}</div>
              <div class="grid grid-cols-3 gap-2">
                <div>
                  <label class="block text-[9.5px] text-slate-400 mb-1">${isEn ? 'Min' : 'الحد الأدنى'}</label>
                  <input id="cbfMin" type="number" step="any" value="${itemData.min != null ? itemData.min : ''}" class="w-full p-2 rounded-lg bg-[#1E293B] border border-slate-700 text-white text-xs">
                </div>
                <div>
                  <label class="block text-[9.5px] text-slate-400 mb-1">${isEn ? 'Max' : 'الحد الأقصى'}</label>
                  <input id="cbfMax" type="number" step="any" value="${itemData.max != null ? itemData.max : ''}" class="w-full p-2 rounded-lg bg-[#1E293B] border border-slate-700 text-white text-xs">
                </div>
                <div>
                  <label class="block text-[9.5px] text-slate-400 mb-1">${isEn ? 'Unit' : 'الوحدة'}</label>
                  <input id="cbfUnit" type="text" value="${escapeHtml(itemData.unit || '')}" placeholder="Bar / °C" class="w-full p-2 rounded-lg bg-[#1E293B] border border-slate-700 text-white text-xs">
                </div>
              </div>
            </div>
          </div>

          <!-- STEP 2: خيارات متقدمة قابلة للطي (Collapsible) -->
          <details class="group rounded-xl border border-slate-800 bg-[#0F172A]/50 overflow-hidden" open>
            <summary class="p-3 text-[11px] font-bold text-slate-300 cursor-pointer flex items-center justify-between select-none hover:bg-slate-800/40">
              <span class="flex items-center gap-1.5">
                <span>2️⃣</span>
                <span>${isEn ? 'Advanced Options (Critical, Photos, How-To)' : 'خيارات متقدمة (حرج، صور، إرشادات الفحص)'}</span>
              </span>
              <span class="text-xs text-slate-500 transition-transform group-open:rotate-180">▼</span>
            </summary>

            <div class="p-3 pt-1 space-y-3 border-t border-slate-800/80">
              <!-- أزرار الاختيار (Checkboxes) -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <label class="flex items-center gap-2 p-2 rounded-lg bg-[#1E293B] border border-slate-700/60 cursor-pointer">
                  <input type="checkbox" id="cbfCritical" ${itemData.critical ? 'checked' : ''} class="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 bg-slate-800 border-slate-600">
                  <span class="text-xs text-amber-300 font-bold">⚠️ ${isEn ? 'Critical Item' : 'بند حرج'}</span>
                </label>

                <label class="flex items-center gap-2 p-2 rounded-lg bg-[#1E293B] border border-slate-700/60 cursor-pointer">
                  <input type="checkbox" id="cbfPhotoRequired" ${itemData.photoRequired ? 'checked' : ''} class="w-4 h-4 rounded text-sky-500 focus:ring-sky-500 bg-slate-800 border-slate-600">
                  <span class="text-xs text-sky-300 font-bold">📷 ${isEn ? 'Photo Required if NOT OK' : 'صورة إجبارية عند العطل'}</span>
                </label>
              </div>

              <!-- تعليمات الفحص (How-To) -->
              <div>
                <label class="block text-[10px] font-bold text-slate-400 mb-1">
                  💡 ${isEn ? 'Inspection Instructions / How-To (Arabic):' : 'تعليمات/إرشادات الفحص السريع للفني:'}
                </label>
                <input
                  id="cbfHowToAr"
                  type="text"
                  value="${escapeHtml(howToAr)}"
                  placeholder="${isEn ? 'Short instruction for the technician...' : 'مثال: وجّه مقياس الحرارة لمنتصف محرك السحب...'}"
                  class="w-full p-2.5 rounded-xl bg-[#1E293B] border border-slate-700 text-white text-xs outline-none focus:border-blue-500 transition">
              </div>

              <div>
                <label class="block text-[10px] font-bold text-slate-400 mb-1">
                  💡 ${isEn ? 'Inspection Instructions (English):' : 'تعليمات الفحص بالإنجليزي:'}
                </label>
                <input
                  id="cbfHowToEn"
                  type="text"
                  value="${escapeHtml(howToEn)}"
                  placeholder="Short instruction in English..."
                  class="w-full p-2.5 rounded-xl bg-[#1E293B] border border-slate-700 text-white text-xs outline-none focus:border-blue-500 transition">
              </div>
            </div>
          </details>

          <!-- زر الحفظ -->
          <div class="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onclick="document.getElementById('cbItemFormModal')?.remove()"
              class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition cursor-pointer">
              ${isEn ? 'Cancel' : 'إلغاء'}
            </button>
            <button
              type="submit"
              class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-xs font-bold text-white shadow-md transition flex items-center gap-1.5 cursor-pointer">
              <span>✅</span>
              <span>${isEdit ? (isEn ? 'Update Item' : 'تحديث البند') : (isEn ? 'Add to List' : 'إضافة للقائمة')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

window.onItemTypeChanged = function (type) {
  const numericBox = document.getElementById('cbfNumericFields');
  if (numericBox) {
    numericBox.classList.toggle('hidden', type !== 'numeric');
  }
};

window.saveItemFormData = function (event) {
  event.preventDefault();
  const isEn = (window.currentLang || 'ar') === 'en';

  const labelAr = document.getElementById('cbfLabelAr')?.value?.trim();
  const labelEn = document.getElementById('cbfLabelEn')?.value?.trim();
  const type = document.getElementById('cbfType')?.value || 'ok_nok';
  const pillar = document.getElementById('cbfPillar')?.value;
  const frequency = document.getElementById('cbfFrequency')?.value || 'daily';

  const minVal = document.getElementById('cbfMin')?.value;
  const maxVal = document.getElementById('cbfMax')?.value;
  const unit = document.getElementById('cbfUnit')?.value?.trim() || '';

  const critical = !!document.getElementById('cbfCritical')?.checked;
  const photoRequired = !!document.getElementById('cbfPhotoRequired')?.checked;
  const howToAr = document.getElementById('cbfHowToAr')?.value?.trim() || '';
  const howToEn = document.getElementById('cbfHowToEn')?.value?.trim() || '';

  if (!labelAr) {
    alert(isEn ? 'Please enter the item description in Arabic' : 'يرجى إدخال وصف البند بالعربية');
    return;
  }

  const updatedBy = localStorage.getItem('name') || 'Manager';
  const updatedAt = new Date().toISOString();

  if (editingItemId) {
    // تعديل بند موجود
    const idx = currentItems.findIndex(i => i.id === editingItemId);
    if (idx !== -1) {
      currentItems[idx] = {
        ...currentItems[idx],
        label: { ar: labelAr, en: labelEn || labelAr },
        type,
        pillar: pillar || currentItems[idx].pillar,
        frequency,
        min: minVal !== '' ? Number(minVal) : null,
        max: maxVal !== '' ? Number(maxVal) : null,
        unit,
        critical,
        photoRequired,
        howTo: { ar: howToAr, en: howToEn },
        updatedBy,
        updatedAt
      };
    }
  } else {
    // إضافة بند جديد في نهاية القائمة
    const newItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: { ar: labelAr, en: labelEn || labelAr },
      type,
      pillar,
      frequency,
      min: minVal !== '' ? Number(minVal) : null,
      max: maxVal !== '' ? Number(maxVal) : null,
      unit,
      critical,
      photoRequired,
      howTo: { ar: howToAr, en: howToEn },
      order: currentItems.length + 1,
      active: true,
      updatedBy,
      updatedAt
    };
    currentItems.push(newItem);
  }

  document.getElementById('cbItemFormModal')?.remove();
  renderItemsList();
};

// ============================================================
// PRESET LIBRARY MODAL (مكتبة البنود الشائعة)
// ============================================================
window.openPresetsModal = function () {
  const isEn = (window.currentLang || 'ar') === 'en';
  const modalContainer = document.getElementById('cbModalsContainer');
  if (!modalContainer) return;

  const presets = PRESET_LIBRARY[currentTab] || [];

  const categoriesHtml = presets.map((cat, catIdx) => `
    <div class="bg-[#0F172A] border border-slate-800 rounded-xl p-3 space-y-2">
      <h4 class="text-xs font-bold text-purple-400 flex items-center gap-1.5">
        <span>📁</span>
        <span>${cat.categoryAr}</span>
      </h4>
      <div class="space-y-1.5">
        ${cat.items.map((it, itIdx) => `
          <div class="flex items-center justify-between p-2 rounded-lg bg-[#1E293B] hover:bg-slate-800/80 transition text-xs border border-slate-700/50">
            <div class="min-w-0 pr-2">
              <div class="font-bold text-white text-[11px] truncate">${escapeHtml(it.label.ar)}</div>
              <div class="text-[9.5px] text-slate-400 truncate">${escapeHtml(it.label.en || '')}</div>
            </div>
            <button
              type="button"
              onclick="window.addPresetItem(${catIdx}, ${itIdx})"
              class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] active:scale-95 transition shrink-0 cursor-pointer">
              ➕ ${isEn ? 'Add' : 'إضافة'}
            </button>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  modalContainer.innerHTML = `
    <div id="cbPresetsModal" class="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div class="bg-[#1E293B] border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col my-auto max-h-[85vh]">
        <div class="p-4 bg-[#0F172A] border-b border-slate-800 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2">
            <span>💡</span>
            <h3 class="font-bold text-white text-sm">
              ${isEn ? 'Common Checklist Presets Library' : 'مكتبة بنود الفحص الشائعة'}
            </h3>
          </div>
          <button type="button" onclick="document.getElementById('cbPresetsModal')?.remove()" class="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer">✕</button>
        </div>
        <div class="p-4 overflow-y-auto space-y-3">
          <p class="text-[11px] text-slate-400">
            ${isEn ? 'Add ready-made standardized points to your checklist with a single click:' : 'أضف بنود فحص قياسية معتمدة إلى قائمة فحص الماكينة بضغطة واحدة:'}
          </p>
          ${categoriesHtml}
        </div>
      </div>
    </div>
  `;
};

window.addPresetItem = function (catIdx, itIdx) {
  const isEn = (window.currentLang || 'ar') === 'en';
  const presets = PRESET_LIBRARY[currentTab] || [];
  const cat = presets[catIdx];
  if (!cat || !cat.items[itIdx]) return;

  const preset = cat.items[itIdx];
  const newItem = {
    id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    label: { ar: preset.label.ar, en: preset.label.en || preset.label.ar },
    type: preset.type || 'ok_nok',
    pillar: cat.pillar || (currentTab === '5s' ? 'sort' : undefined),
    min: preset.min != null ? preset.min : null,
    max: preset.max != null ? preset.max : null,
    unit: preset.unit || '',
    critical: !!preset.critical,
    photoRequired: !!preset.photoRequired,
    howTo: preset.howTo ? { ar: preset.howTo.ar || '', en: preset.howTo.en || '' } : { ar: '', en: '' },
    frequency: currentTab === '5s' ? 'shift' : 'daily',
    order: currentItems.length + 1,
    active: true,
    updatedBy: localStorage.getItem('name') || 'Manager',
    updatedAt: new Date().toISOString()
  };

  currentItems.push(newItem);
  renderItemsList();

  // تأثير تأكيد خفيف
  const btn = event?.currentTarget;
  if (btn) {
    btn.textContent = isEn ? 'Added ✅' : 'تمت الإضافة ✅';
    btn.className = 'px-2.5 py-1 rounded-lg bg-slate-700 text-emerald-400 font-bold text-[10px] shrink-0';
    setTimeout(() => {
      btn.textContent = isEn ? 'Add' : 'إضافة';
      btn.className = 'px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] active:scale-95 transition shrink-0 cursor-pointer';
    }, 1500);
  }
};

// ============================================================
// COPY FROM ANOTHER MACHINE
// ============================================================
window.openCopyFromModal = function () {
  const isEn = (window.currentLang || 'ar') === 'en';
  const modalContainer = document.getElementById('cbModalsContainer');
  if (!modalContainer) return;

  const otherMachines = allMachineOptions.filter(m => m.value !== currentTargetId);

  modalContainer.innerHTML = `
    <div id="cbCopyModal" class="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div class="bg-[#1E293B] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col my-auto">
        <div class="p-4 bg-[#0F172A] border-b border-slate-800 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span>📋</span>
            <h3 class="font-bold text-white text-sm">
              ${isEn ? 'Copy Template from Another Machine' : 'نسخ القالب من ماكينة أخرى'}
            </h3>
          </div>
          <button type="button" onclick="document.getElementById('cbCopyModal')?.remove()" class="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer">✕</button>
        </div>
        <div class="p-4 space-y-3">
          <p class="text-[11px] text-slate-400">
            ${isEn
              ? `Select a source machine to copy its ${currentTab.toUpperCase()} inspection points to <strong>${escapeHtml(currentTargetId)}</strong>:`
              : `اختر ماكينة المصدر لنسخ بنود فحص الـ ${currentTab.toUpperCase()} منها إلى <strong>${escapeHtml(currentTargetId)}</strong>:`}
          </p>

          <select id="cbCopySourceSelect" class="w-full p-2.5 rounded-xl bg-[#0F172A] border border-slate-700 text-white text-xs outline-none focus:border-blue-500">
            <option value="" disabled selected>${isEn ? 'Select Source Machine...' : 'اختر ماكينة المصدر...'}</option>
            ${otherMachines.map(m => `
              <option value="${escapeHtml(m.value)}">🏭 ${escapeHtml(m.value)}${m.line ? ` (${formatLineLabel(m.line)})` : ''}</option>
            `).join('')}
          </select>

          <div class="p-2.5 rounded-xl bg-[#0F172A] border border-slate-800 space-y-1 text-xs">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="copyMode" value="replace" checked class="text-blue-600 bg-slate-800 border-slate-700">
              <span class="text-slate-200 font-bold">${isEn ? 'Replace current items completely' : 'استبدال البنود الحالية بالكامل'}</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="copyMode" value="merge" class="text-blue-600 bg-slate-800 border-slate-700">
              <span class="text-slate-200 font-bold">${isEn ? 'Merge with current items' : 'دمج البنود الجديدة مع البنود الحالية'}</span>
            </label>
          </div>

          <div class="pt-2 flex items-center justify-end gap-2">
            <button type="button" onclick="document.getElementById('cbCopyModal')?.remove()" class="px-3.5 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-300">
              ${isEn ? 'Cancel' : 'إلغاء'}
            </button>
            <button type="button" onclick="window.confirmCopyFromMachine()" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white shadow-md active:scale-95 transition cursor-pointer">
              ${isEn ? 'Copy Points' : 'نسخ البنود'}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
};

window.confirmCopyFromMachine = async function () {
  const isEn = (window.currentLang || 'ar') === 'en';
  const sourceVal = document.getElementById('cbCopySourceSelect')?.value;
  if (!sourceVal) return;

  const copyMode = document.querySelector('input[name="copyMode"]:checked')?.value || 'replace';
  const adapter = ADAPTERS[currentTab];
  try {
    const snap = await getDoc(doc(db, adapter.collection, sourceVal));
    if (!snap.exists() || !snap.data().items || snap.data().items.length === 0) {
      alert(isEn ? 'The selected machine has no custom items.' : 'الماكينة المختارة لا تحتوي على بنود مخصصة.');
      return;
    }

    const copiedItems = snap.data().items.map((item, idx) => ({
      ...item,
      id: `item_${Date.now()}_${idx}`,
      active: item.active !== false
    }));

    if (copyMode === 'merge') {
      copiedItems.forEach(item => {
        if (!currentItems.some(i => i.label?.ar === item.label?.ar)) {
          currentItems.push({ ...item, order: currentItems.length + 1 });
        }
      });
    } else {
      if (!confirm(isEn ? `Replace current items with ${copiedItems.length} points from ${sourceVal}?` : `استبدال البنود الحالية بـ (${copiedItems.length}) بند من ${sourceVal}؟`)) {
        return;
      }
      currentItems = copiedItems;
      currentItems.forEach((it, idx) => { it.order = idx + 1; });
    }

    document.getElementById('cbCopyModal')?.remove();
    renderItemsList();
    alert(t().copySuccess);
  } catch (err) {
    alert((isEn ? 'Error copying template: ' : 'حدث خطأ أثناء النسخ: ') + err.message);
  }
};

// ============================================================
// APPLY ITEM TO OTHER MACHINES (تطبيق بند على ماكينات أخرى)
// ============================================================
window.openApplyToOthersModal = function (itemId) {
  const item = currentItems.find(i => i.id === itemId);
  if (!item) return;

  const isEn = (window.currentLang || 'ar') === 'en';
  const modalContainer = document.getElementById('cbModalsContainer');
  if (!modalContainer) return;

  const labelText = item.label ? (isEn ? item.label.en : item.label.ar) : (isEn ? item.en : item.ar);
  const otherMachines = allMachineOptions.filter(m => m.value !== currentTargetId);

  modalContainer.innerHTML = `
    <div id="cbApplyModal" class="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div class="bg-[#1E293B] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col my-auto max-h-[85vh]">
        <div class="p-4 bg-[#0F172A] border-b border-slate-800 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span>🚀</span>
            <h3 class="font-bold text-white text-sm">
              ${isEn ? 'Apply Item to Other Machines' : 'تطبيق هذا البند على ماكينات أخرى'}
            </h3>
          </div>
          <button type="button" onclick="document.getElementById('cbApplyModal')?.remove()" class="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer">✕</button>
        </div>

        <div class="p-4 space-y-3 overflow-y-auto">
          <div class="p-2.5 rounded-xl bg-[#0F172A] border border-slate-800 text-xs text-blue-300 font-bold">
            ${escapeHtml(labelText)}
          </div>

          <p class="text-[11px] text-slate-400">
            ${isEn ? 'Select target machines to add or sync this item into:' : 'حدد الماكينات التي ترغب في إضافة أو مزامنة هذا البند إليها:'}
          </p>

          <div class="flex items-center justify-between text-[11px] pb-1">
            <button type="button" onclick="document.querySelectorAll('.cb-target-chk').forEach(c => c.checked = true)" class="text-blue-400 hover:underline cursor-pointer font-bold">
              ${isEn ? 'Select All' : 'تحديد الكل'}
            </button>
            <button type="button" onclick="document.querySelectorAll('.cb-target-chk').forEach(c => c.checked = false)" class="text-slate-400 hover:underline cursor-pointer font-bold">
              ${isEn ? 'Deselect All' : 'إلغاء التحديد'}
            </button>
          </div>

          <div class="max-h-52 overflow-y-auto space-y-1.5 pr-1">
            ${otherMachines.map(m => `
              <label class="flex items-center gap-2 p-2 rounded-lg bg-[#0F172A] border border-slate-800 hover:border-slate-700 cursor-pointer text-xs">
                <input type="checkbox" value="${escapeHtml(m.value)}" class="cb-target-chk w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700">
                <span class="font-medium text-white">${escapeHtml(m.value)}</span>
                ${m.line ? `<span class="text-[10px] text-slate-500">(${formatLineLabel(m.line)})</span>` : ''}
              </label>
            `).join('')}
          </div>

          <div class="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
            <button type="button" onclick="document.getElementById('cbApplyModal')?.remove()" class="px-3.5 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-300">
              ${isEn ? 'Cancel' : 'إلغاء'}
            </button>
            <button type="button" onclick="window.confirmApplyItemToMachines('${escapeJsArg(item.id)}')" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white shadow-md active:scale-95 transition cursor-pointer">
              ${isEn ? 'Apply Item' : 'تطبيق البند'}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
};

window.confirmApplyItemToMachines = async function (itemId) {
  const item = currentItems.find(i => i.id === itemId);
  if (!item) return;

  const isEn = (window.currentLang || 'ar') === 'en';
  const checkboxes = document.querySelectorAll('.cb-target-chk:checked');
  const targetMachines = Array.from(checkboxes).map(c => c.value);

  if (targetMachines.length === 0) {
    alert(isEn ? 'Please select at least one machine.' : 'يرجى تحديد ماكينة واحدة على الأقل.');
    return;
  }

  const adapter = ADAPTERS[currentTab];
  const updater = localStorage.getItem('name') || 'Manager';
  const now = new Date().toISOString();

  try {
    for (const machineName of targetMachines) {
      const snap = await getDoc(doc(db, adapter.collection, machineName));
      let mItems = snap.exists() && snap.data().items ? snap.data().items : adapter.defaultItems();
      let mVersion = snap.exists() ? (snap.data().templateVersion || 1) + 1 : 1;

      // هل البند موجود بالفعل؟ إذا كان موجوداً نحدثه، وإلا نضيفه
      const existingIdx = mItems.findIndex(i => i.id === item.id || (i.label?.ar && i.label.ar === item.label?.ar));
      if (existingIdx !== -1) {
        mItems[existingIdx] = { ...item, id: mItems[existingIdx].id };
      } else {
        mItems.push({ ...item, id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, order: mItems.length + 1 });
      }

      await setDoc(doc(db, adapter.collection, machineName), {
        items: mItems,
        templateVersion: mVersion,
        updatedAt: now,
        updatedBy: updater
      }, { merge: true });
    }

    document.getElementById('cbApplyModal')?.remove();
    alert(t().applySuccess);
  } catch (err) {
    alert((isEn ? 'Error applying item: ' : 'حدث خطأ أثناء التطبيق: ') + err.message);
  }
};

// ============================================================
// PREVIEW AS TECHNICIAN MODAL (معاينة كما يراها الفني)
// ============================================================
window.openTechPreviewModal = function () {
  const isEn = (window.currentLang || 'ar') === 'en';
  const modalContainer = document.getElementById('cbModalsContainer');
  if (!modalContainer) return;

  // البنود المفعلة فقط
  const activeItems = currentItems.filter(i => i.active !== false);

  const previewCards = activeItems.map((item, idx) => {
    const labelText = item.label ? (isEn ? item.label.en : item.label.ar) : (isEn ? item.en : item.ar);
    const howToText = item.howTo ? (isEn ? item.howTo.en : item.howTo.ar) : '';

    return `
      <div class="bg-[#1E293B] p-3.5 rounded-xl border ${item.critical ? 'border-amber-500/40' : 'border-slate-800'} space-y-2.5">
        <div class="flex items-start justify-between gap-2">
          <div class="text-xs font-bold text-slate-200">
            <span class="text-blue-400 font-mono">#${idx + 1}</span> ${escapeHtml(labelText)}
          </div>
          ${item.critical ? `<span class="shrink-0 text-[9.5px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">⚠️ ${isEn ? 'Critical' : 'حرج'}</span>` : ''}
        </div>
        ${howToText ? `<div class="text-[10px] text-sky-300 bg-sky-950/40 p-2 rounded-xl border border-sky-800/40">💡 ${escapeHtml(howToText)}</div>` : ''}

        ${item.type === 'numeric' ? `
          <div class="flex items-center gap-2 bg-[#0F172A] p-2 rounded-lg border border-slate-700 w-full sm:w-1/2">
            <input type="number" placeholder="${isEn ? 'Enter reading' : 'أدخل القراءة'}" class="w-full bg-transparent text-xs text-white outline-none">
            <span class="text-xs text-slate-400 font-bold px-1">${item.unit || ''}</span>
          </div>
          ${(item.min != null || item.max != null) ? `
            <div class="text-[9.5px] text-slate-400 font-mono">
              [Min: ${item.min != null ? item.min : '-'} | Max: ${item.max != null ? item.max : '-'}]
            </div>
          ` : ''}
        ` : item.type === 'text' ? `
          <input type="text" placeholder="${isEn ? 'Notes / Observations...' : 'ملاحظات الفني...'}" class="w-full p-2 bg-[#0F172A] rounded-lg border border-slate-700 text-xs text-white outline-none">
        ` : ''}

        <div class="grid grid-cols-3 gap-1.5 pt-1">
          <button type="button" class="py-2 rounded-lg text-xs font-bold border border-slate-700 bg-[#0F172A] text-emerald-400 hover:bg-emerald-950/30">${isEn ? 'OK' : 'سليم'}</button>
          <button type="button" class="py-2 rounded-lg text-xs font-bold border border-slate-700 bg-[#0F172A] text-red-400 hover:bg-red-950/30">${isEn ? 'Not OK' : 'غير سليم'}</button>
          <button type="button" class="py-2 rounded-lg text-xs font-bold border border-slate-700 bg-[#0F172A] text-slate-400 hover:bg-slate-800">${isEn ? 'N/A' : 'لا ينطبق'}</button>
        </div>
      </div>
    `;
  }).join('');

  modalContainer.innerHTML = `
    <div id="cbTechPreviewModal" class="fixed inset-0 bg-black/85 backdrop-blur-md z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div class="bg-[#0F172A] border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]">
        <div class="p-4 bg-[#1E293B] border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h3 class="font-bold text-white text-sm flex items-center gap-1.5">
              <span>👁️</span>
              <span>${isEn ? 'Technician View Simulation' : 'معاينة شاشة الفحص كما يراها الفني'}</span>
            </h3>
            <p class="text-[10px] text-slate-400 mt-0.5">${escapeHtml(currentTargetId)} • ${activeItems.length} ${isEn ? 'active points' : 'بند مفعل'}</p>
          </div>
          <button type="button" onclick="document.getElementById('cbTechPreviewModal')?.remove()" class="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer">✕</button>
        </div>
        <div class="p-4 overflow-y-auto space-y-3 bg-[#0F172A]">
          ${previewCards}
        </div>
      </div>
    </div>
  `;
};

// ============================================================
// VERSION HISTORY & ROLLBACK (سجل التغييرات والرجوع لإصدار سابق)
// ============================================================
window.openHistoryModal = function () {
  const isEn = (window.currentLang || 'ar') === 'en';
  const modalContainer = document.getElementById('cbModalsContainer');
  if (!modalContainer) return;

  const historyEntries = loadedHistory || [];

  modalContainer.innerHTML = `
    <div id="cbHistoryModal" class="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div class="bg-[#1E293B] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col my-auto max-h-[85vh]">
        <div class="p-4 bg-[#0F172A] border-b border-slate-800 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2">
            <span>🕒</span>
            <h3 class="font-bold text-white text-sm">
              ${isEn ? 'Template Version History' : 'سجل تعديلات وإصدارات القالب'}
            </h3>
          </div>
          <button type="button" onclick="document.getElementById('cbHistoryModal')?.remove()" class="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer">✕</button>
        </div>

        <div class="p-4 overflow-y-auto space-y-2">
          <div class="p-2.5 rounded-xl bg-blue-950/20 border border-blue-800/40 text-xs flex items-center justify-between">
            <span class="font-bold text-blue-300">${isEn ? 'Current Active Version' : 'الإصدار الحالي النشط'}</span>
            <span class="font-mono font-bold text-white">v${loadedTemplateVersion}</span>
          </div>

          ${historyEntries.length === 0 ? `
            <div class="text-center py-6 text-xs text-slate-500">
              ${isEn ? 'No previous revisions recorded yet.' : 'لا توجد إصدارات سابقة مسجلة حتى الآن.'}
            </div>
          ` : `
            <div class="space-y-1.5">
              ${historyEntries.slice().reverse().map(h => `
                <div class="p-2.5 rounded-xl bg-[#0F172A] border border-slate-800 text-xs flex items-center justify-between">
                  <div>
                    <div class="font-bold text-slate-200">v${h.version} • ${h.itemsCount || 0} ${isEn ? 'items' : 'بند'}</div>
                    <div class="text-[10px] text-slate-500 mt-0.5">${escapeHtml(h.updatedBy || 'Manager')} • ${new Date(h.updatedAt).toLocaleString(isEn ? 'en-US' : 'ar-EG')}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    </div>
  `;
};

// ============================================================
// SAVE TEMPLATE (CONCURRENCY CHECK & OFFLINE QUEUE)
// ============================================================
window.saveCurrentChecklistTemplate = async function () {
  if (!currentTargetId) return;
  const isEn = (window.currentLang || 'ar') === 'en';
  const tr = t();
  const adapter = ADAPTERS[currentTab];
  const saveBtn = document.getElementById('cbSaveTemplateBtn');

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = `⏳ ${isEn ? 'Saving...' : 'جاري الحفظ...'}`;
  }

  const updater = localStorage.getItem('name') || 'Manager';
  const now = new Date().toISOString();

  // فحص حالة الاتصال (Offline Queueing)
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    try {
      await queueOfflineAction({
        type: 'save_checklist_template',
        collection: adapter.collection,
        targetId: currentTargetId,
        items: currentItems,
        updatedAt: now,
        updatedBy: updater
      });
      alert(tr.offlineQueued);
    } catch (_) {}
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `<span>💾</span><span>${tr.saveBtn}</span>`;
    }
    return;
  }

  try {
    // 1) فحص التعارض (Optimistic Concurrency Check)
    let currentRemoteVersion = 0;
    let existingHistory = [];
    try {
      const remoteSnap = await getDoc(doc(db, adapter.collection, currentTargetId));
      if (remoteSnap.exists()) {
        currentRemoteVersion = remoteSnap.data().templateVersion || 1;
        existingHistory = Array.isArray(remoteSnap.data().history) ? remoteSnap.data().history.slice(-9) : [];
      }
    } catch (_) {}

    if (currentRemoteVersion > loadedTemplateVersion) {
      if (!confirm(tr.versionConflict + '\n' + (isEn ? 'Do you still want to overwrite?' : 'هل ترغب في المتابعة والكتابة فوق التعديلات؟'))) {
        window.onChecklistMachineSelected(currentTargetId);
        return;
      }
    }

    const nextVersion = Math.max(loadedTemplateVersion, currentRemoteVersion) + 1;

    // حفظ النسخة الحالية في التاريخ
    existingHistory.push({
      version: loadedTemplateVersion,
      updatedAt: now,
      updatedBy: updater,
      itemsCount: currentItems.length
    });

    const payload = {
      items: currentItems,
      templateVersion: nextVersion,
      history: existingHistory,
      updatedAt: now,
      updatedBy: updater
    };

    await setDoc(doc(db, adapter.collection, currentTargetId), payload);

    loadedTemplateVersion = nextVersion;
    loadedHistory = existingHistory;

    const vBadge = document.getElementById('cbVersionBadge');
    if (vBadge) vBadge.textContent = `v${nextVersion}`;

    alert(tr.saveSuccess);
  } catch (err) {
    console.error("Error saving checklist template:", err);
    alert((isEn ? 'Failed to save template: ' : 'فشل حفظ القالب: ') + err.message);
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `<span>💾</span><span>${tr.saveBtn}</span>`;
    }
  }
};

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
