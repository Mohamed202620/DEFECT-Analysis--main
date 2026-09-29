// ============================================================
// DailyTipsSettingsView.js
// واجهة «إعدادات وإدارة معلومة على الماشي»
// تسمح للمدير/الأدمن بإضافة معلومات جديدة، معاينتها، وحذف المعلومات المخصصة
// ============================================================

import { PageView } from "../components/PageView.js";
import {
  TIPS_AR,
  TIPS_EN,
  customTips,
  loadCustomTips,
  getMergedTipsList,
  showDailyTipToast
} from "../dailyTips.js";
import { addCustomTipApi, deleteCustomTipApi } from "../services/dailyTipsApi.js";

let currentFilter = "all"; // 'all' | 'custom' | 'religious' | 'motivational' | 'industrial' | 'general'
let searchQuery = "";

function getCategoryIcon(cat) {
  switch (cat) {
    case 'religious': return '🕌';
    case 'motivational': return '⚡';
    case 'industrial': return '🏭';
    case 'general': default: return '💡';
  }
}

function getCategoryLabel(cat) {
  switch (cat) {
    case 'religious': return 'ديني/قيم';
    case 'motivational': return 'تحفيزي/جودة';
    case 'industrial': return 'صناعي/صيانة';
    case 'general': default: return 'معرفة عامة';
  }
}

export const DailyTipsSettingsView = () => {
  const isEn = (window.currentLang || localStorage.getItem('lang') || 'ar') === 'en';

  setTimeout(() => {
    initDailyTipsSettingsUI();
  }, 50);

  return PageView(
    isEn ? "Daily Tips Settings" : "إعدادات معلومة على الماشي",
    `
    <div class="space-y-5 text-white max-w-4xl mx-auto pb-10">
      
      <!-- الهيدر والملخص -->
      <div class="bg-gradient-to-br from-[#1E293B] via-[#0F172A] to-[#0A0F1D] border border-amber-500/40 rounded-2xl p-4 shadow-xl relative overflow-hidden">
        <div class="absolute -top-10 rtl:-left-10 ltr:-right-10 w-28 h-28 bg-amber-500/10 rounded-full blur-xl pointer-events-none"></div>
        <div class="flex items-center justify-between flex-wrap gap-3">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center text-2xl shadow-inner">
              💡
            </div>
            <div>
              <h2 class="text-base font-black text-amber-400">
                ${isEn ? 'Daily Insights & Tips Management' : 'إدارة بنك المعلومات والجرعات اليومية'}
              </h2>
              <p class="text-xs text-gray-300 mt-0.5">
                ${isEn ? 'Add new custom insights or browse system tips' : 'أضف معلومات جديدة تظهر للمستخدمين في الكارت اليومي والرسائل المنبثقة'}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 text-xs">
            <div class="bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-xl text-center">
              <span class="block text-[10px] text-gray-400">${isEn ? 'Total Tips' : 'إجمالي البنك'}</span>
              <span id="statTotalTips" class="font-bold text-amber-400">--</span>
            </div>
            <div class="bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-xl text-center">
              <span class="block text-[10px] text-gray-400">${isEn ? 'Custom Added' : 'المُضافة مخصص'}</span>
              <span id="statCustomTips" class="font-bold text-emerald-400">--</span>
            </div>
          </div>
        </div>
      </div>

      <!-- نموذج إضافة معلومة جديدة -->
      <div class="bg-[#1E293B] border border-gray-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-md">
        <div class="flex items-center justify-between border-b border-gray-800 pb-3">
          <h3 class="text-sm font-bold text-amber-400 flex items-center gap-2">
            <span>➕</span>
            <span>${isEn ? 'Add New Daily Insight' : 'إضافة معلومة جديدة لبنك المعلومات'}</span>
          </h3>
          <span class="text-[10px] bg-amber-500/10 border border-amber-500/30 text-amber-300 px-2 py-0.5 rounded-full font-semibold">
            ${isEn ? 'Instant Sync' : 'مزامنة فورية'}
          </span>
        </div>

        <form id="addDailyTipForm" onsubmit="window.handleCreateDailyTip(event)" class="space-y-3">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            
            <!-- التصنيف -->
            <div>
              <label class="block text-xs font-semibold text-gray-300 mb-1">
                ${isEn ? 'Category' : 'فئة المعلومة'} <span class="text-red-400">*</span>
              </label>
              <select
                id="tipCategory"
                class="w-full p-2.5 rounded-xl bg-[#0F172A] border border-gray-700 text-white text-xs focus:border-amber-500 focus:outline-none"
                required
              >
                <option value="religious">🕌 ${isEn ? 'Religious & Values' : 'ديني / قيم وإتقان'}</option>
                <option value="motivational">⚡ ${isEn ? 'Motivational & Quality' : 'تحفيزي / جودة وانضباط'}</option>
                <option value="industrial">🏭 ${isEn ? 'Industrial & Maintenance' : 'صناعي / صيانة وسلامة'}</option>
                <option value="general" selected>💡 ${isEn ? 'General Knowledge' : 'معرفة عامة / أتمتة وإدارة'}</option>
              </select>
            </div>

            <!-- عنوان الفئة الفرعي -->
            <div>
              <label class="block text-xs font-semibold text-gray-300 mb-1">
                ${isEn ? 'Sub-category Title' : 'العنوان الفرعي للفئة'}
              </label>
              <input
                id="tipCategoryTitle"
                type="text"
                placeholder="${isEn ? 'e.g. Safety First' : 'مثال: سلامة وإتقان'}"
                class="w-full p-2.5 rounded-xl bg-[#0F172A] border border-gray-700 text-white text-xs focus:border-amber-500 focus:outline-none"
              >
            </div>

            <!-- اللغة -->
            <div>
              <label class="block text-xs font-semibold text-gray-300 mb-1">
                ${isEn ? 'Target Language' : 'لغة العرض'}
              </label>
              <select
                id="tipLang"
                class="w-full p-2.5 rounded-xl bg-[#0F172A] border border-gray-700 text-white text-xs focus:border-amber-500 focus:outline-none"
              >
                <option value="ar" selected>🇸🇦 ${isEn ? 'Arabic Only' : 'العربية فقط'}</option>
                <option value="en">🇬🇧 ${isEn ? 'English Only' : 'الإنجليزية فقط'}</option>
                <option value="both">🌐 ${isEn ? 'Both Languages' : 'كلا اللغتين'}</option>
              </select>
            </div>
          </div>

          <!-- عنوان المعلومة -->
          <div>
            <label class="block text-xs font-semibold text-gray-300 mb-1">
              ${isEn ? 'Insight Title' : 'عنوان المعلومة الرئيسي'} <span class="text-red-400">*</span>
            </label>
            <input
              id="tipTitle"
              type="text"
              required
              placeholder="${isEn ? 'e.g. Importance of Calibration' : 'مثال: أهمية المعايرة الدورية للمستشعرات'}"
              class="w-full p-2.5 rounded-xl bg-[#0F172A] border border-gray-700 text-white text-xs focus:border-amber-500 focus:outline-none"
            >
          </div>

          <!-- نص المعلومة -->
          <div>
            <label class="block text-xs font-semibold text-gray-300 mb-1">
              ${isEn ? 'Insight Details / Content' : 'نص المعلومة التفصيلي'} <span class="text-red-400">*</span>
            </label>
            <textarea
              id="tipText"
              rows="3"
              required
              placeholder="${isEn ? 'Write detailed tip text here...' : 'اكتب نص المعلومة المفيدة بأسلوب واضح ومختصر...'}"
              class="w-full p-2.5 rounded-xl bg-[#0F172A] border border-gray-700 text-white text-xs focus:border-amber-500 focus:outline-none leading-relaxed"
            ></textarea>
          </div>

          <!-- أزرار الإجراء -->
          <div class="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onclick="window.testFormTipPreview()"
              class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 text-xs font-bold transition cursor-pointer active:scale-95"
            >
              👁️ ${isEn ? 'Preview' : 'معاينة منبثقة'}
            </button>
            <button
              id="btnSaveDailyTip"
              type="submit"
              class="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition shadow-lg shadow-amber-950/40 cursor-pointer active:scale-95 flex items-center gap-1.5"
            >
              <span>💾</span>
              <span>${isEn ? 'Save & Publish Insight' : 'حفظ ونشر المعلومة'}</span>
            </button>
          </div>
        </form>
      </div>

      <!-- شريط البحث والفلترة -->
      <div class="space-y-2.5">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <h3 class="text-xs font-bold text-gray-300 flex items-center gap-1.5">
            <span>📚</span>
            <span>${isEn ? 'All Insights Repository' : 'بنك المعلومات الحالي'}</span>
          </h3>

          <!-- الفلاتر السريعة -->
          <div class="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
            <button
              onclick="window.filterDailyTipsList('all')"
              class="tip-filter-btn px-2.5 py-1 rounded-lg border border-amber-500/40 bg-amber-500/20 text-amber-300 font-bold cursor-pointer transition"
              data-filter="all"
            >
              ${isEn ? 'All' : 'الكل'}
            </button>
            <button
              onclick="window.filterDailyTipsList('custom')"
              class="tip-filter-btn px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800 text-gray-300 cursor-pointer transition hover:bg-slate-700"
              data-filter="custom"
            >
              ⭐ ${isEn ? 'Custom' : 'المخصصة'}
            </button>
            <button
              onclick="window.filterDailyTipsList('religious')"
              class="tip-filter-btn px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800 text-gray-300 cursor-pointer transition hover:bg-slate-700"
              data-filter="religious"
            >
              🕌 ${isEn ? 'Religious' : 'دينية'}
            </button>
            <button
              onclick="window.filterDailyTipsList('motivational')"
              class="tip-filter-btn px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800 text-gray-300 cursor-pointer transition hover:bg-slate-700"
              data-filter="motivational"
            >
              ⚡ ${isEn ? 'Motivational' : 'تحفيزية'}
            </button>
            <button
              onclick="window.filterDailyTipsList('industrial')"
              class="tip-filter-btn px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800 text-gray-300 cursor-pointer transition hover:bg-slate-700"
              data-filter="industrial"
            >
              🏭 ${isEn ? 'Industrial' : 'صناعية'}
            </button>
            <button
              onclick="window.filterDailyTipsList('general')"
              class="tip-filter-btn px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800 text-gray-300 cursor-pointer transition hover:bg-slate-700"
              data-filter="general"
            >
              💡 ${isEn ? 'General' : 'عامة'}
            </button>
          </div>
        </div>

        <!-- حقل البحث -->
        <input
          id="tipSearchInput"
          type="text"
          oninput="window.handleTipSearchInput(this.value)"
          placeholder="${isEn ? '🔍 Search insights by title, text, or category...' : '🔍 ابحث في بنك المعلومات بالعنوان، الكلمات، أو التصنيف...'}"
          class="w-full p-2.5 rounded-xl bg-[#1E293B] border border-gray-800 text-white text-xs focus:border-amber-500 focus:outline-none"
        >
      </div>

      <!-- قائمة الحاويات -->
      <div id="dailyTipsListContainer" class="space-y-2.5">
        <div class="text-center text-gray-400 text-xs py-8">
          ${isEn ? 'Loading insights database...' : 'جاري تحميل بنك المعلومات...'}
        </div>
      </div>

    </div>
    `,
    undefined,
    "system"
  );
};

export default DailyTipsSettingsView;

/**
 * تهيئة واجهة المستخدم وجلب البيانات المحدثة
 */
async function initDailyTipsSettingsUI() {
  await loadCustomTips();
  renderDailyTipsList();
}

/**
 * عرض القائمة بناءً على الفلتر والبحث
 */
function renderDailyTipsList() {
  const container = document.getElementById("dailyTipsListContainer");
  if (!container) return;

  const isEn = (window.currentLang || localStorage.getItem('lang') || 'ar') === 'en';
  const lang = isEn ? 'en' : 'ar';
  
  let list = getMergedTipsList(lang);

  // تحديث الإحصائيات
  const totalEl = document.getElementById("statTotalTips");
  const customEl = document.getElementById("statCustomTips");
  if (totalEl) totalEl.textContent = list.length;
  if (customEl) customEl.textContent = customTips.length;

  // تطبيق الفلترة
  if (currentFilter === "custom") {
    list = list.filter(t => t.isCustom);
  } else if (currentFilter !== "all") {
    list = list.filter(t => t.category === currentFilter);
  }

  // تطبيق البحث
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    list = list.filter(t => 
      (t.title && t.title.toLowerCase().includes(q)) ||
      (t.text && t.text.toLowerCase().includes(q)) ||
      (t.categoryTitle && t.categoryTitle.toLowerCase().includes(q))
    );
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="bg-[#1E293B] border border-gray-800 rounded-xl p-6 text-center text-gray-400 text-xs">
        <div class="text-2xl mb-2">🔍</div>
        ${isEn ? 'No insights match your search or filter' : 'لا توجد معلومات تطابق خيارات الفلترة والبحث أداة الحالية.'}
      </div>
    `;
    return;
  }

  container.innerHTML = list.map((tip, idx) => {
    const icon = getCategoryIcon(tip.category);
    const catText = tip.categoryTitle || getCategoryLabel(tip.category);
    const isCustom = Boolean(tip.isCustom);

    return `
      <div class="bg-[#1E293B] border ${isCustom ? 'border-amber-500/50 bg-gradient-to-r from-[#1E293B] via-[#233147] to-[#1E293B]' : 'border-gray-800'} rounded-2xl p-3.5 space-y-2 transition hover:border-gray-700">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="w-7 h-7 rounded-lg ${isCustom ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-gray-300 border border-slate-700'} flex items-center justify-center text-sm">
              ${icon}
            </span>
            <div>
              <span class="text-xs font-bold text-white flex items-center gap-1.5">
                <span>${tip.title}</span>
                ${isCustom ? `
                  <span class="text-[9px] bg-amber-500/20 border border-amber-500/40 text-amber-300 px-1.5 py-0.2 rounded font-bold">
                    ⭐ ${isEn ? 'Custom' : 'مخصص'}
                  </span>
                ` : ''}
              </span>
              <span class="text-[10px] text-gray-400">
                ${catText} ${tip.id ? `#${tip.id}` : ''}
              </span>
            </div>
          </div>

          <div class="flex items-center gap-1.5">
            <button
              type="button"
              onclick="window.previewSingleTipToast(${idx})"
              class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px] font-bold border border-slate-700 transition cursor-pointer active:scale-95"
              title="${isEn ? 'Preview Popup' : 'معاينة منبثقة'}"
            >
              👁️ ${isEn ? 'Preview' : 'معاينة'}
            </button>
            ${isCustom ? `
              <button
                type="button"
                onclick="window.handleDeleteDailyTip('${tip.id}')"
                class="px-2 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-[10px] font-bold border border-red-500/30 transition cursor-pointer active:scale-95"
                title="${isEn ? 'Delete Custom Tip' : 'حذف المعلومة المخصصة'}"
              >
                🗑️ ${isEn ? 'Delete' : 'حذف'}
              </button>
            ` : ''}
          </div>
        </div>

        <p class="text-xs text-gray-200 leading-relaxed font-normal bg-[#0F172A]/50 p-2.5 rounded-xl border border-slate-800">
          ${tip.text}
        </p>
      </div>
    `;
  }).join("");
}

/**
 * معالجة إنشاء معلومة مخصصة جديدة
 */
window.handleCreateDailyTip = async function(event) {
  event.preventDefault();
  const isEn = (window.currentLang || localStorage.getItem('lang') || 'ar') === 'en';

  const category = document.getElementById("tipCategory")?.value || "general";
  const categoryTitle = document.getElementById("tipCategoryTitle")?.value || "";
  const title = document.getElementById("tipTitle")?.value || "";
  const text = document.getElementById("tipText")?.value || "";
  const lang = document.getElementById("tipLang")?.value || "ar";

  if (!title.trim() || !text.trim()) {
    alert(isEn ? 'Please fill in all required fields.' : '⚠️ يرجى كتابة عنوان المعلومة ونصها بالكامل.');
    return;
  }

  const btn = document.getElementById("btnSaveDailyTip");
  if (btn) btn.disabled = true;

  try {
    const res = await addCustomTipApi({
      category,
      categoryTitle,
      title,
      text,
      lang
    });

    if (res.status === "success") {
      document.getElementById("addDailyTipForm")?.reset();
      await loadCustomTips(true);
      renderDailyTipsList();

      // إظهار معاينة فورية بالتوست
      showDailyTipToast(0, true);

      alert(isEn ? 'New daily tip added successfully!' : '✅ تم إضافة المعلومة بنجاح ونشرها في بنك المعلومات.');
    } else {
      alert(res.message || (isEn ? 'Failed to save tip.' : 'تعذر حفظ المعلومة.'));
    }
  } catch (err) {
    alert(err.message || (isEn ? 'An error occurred.' : 'حدث خطأ غير متوقع.'));
  } finally {
    if (btn) btn.disabled = false;
  }
};

/**
 * معالجة حذف معلومة مخصصة
 */
window.handleDeleteDailyTip = async function(tipId) {
  const isEn = (window.currentLang || localStorage.getItem('lang') || 'ar') === 'en';
  if (!confirm(isEn ? 'Are you sure you want to delete this custom tip?' : 'هل أنت متأكد من رغبتك في حذف هذه المعلومة المخصصة؟')) {
    return;
  }

  try {
    const res = await deleteCustomTipApi(tipId);
    if (res.status === "success") {
      await loadCustomTips(true);
      renderDailyTipsList();
    } else {
      alert(res.message || (isEn ? 'Failed to delete tip.' : 'تعذر حذف المعلومة.'));
    }
  } catch (err) {
    alert(err.message || (isEn ? 'An error occurred.' : 'حدث خطأ أثناء الحذف.'));
  }
};

/**
 * معالجة الفلترة حسب الفئة
 */
window.filterDailyTipsList = function(filter) {
  currentFilter = filter;
  
  // تحديث حالة الأزرار
  document.querySelectorAll(".tip-filter-btn").forEach(btn => {
    if (btn.getAttribute("data-filter") === filter) {
      btn.className = "tip-filter-btn px-2.5 py-1 rounded-lg border border-amber-500/40 bg-amber-500/20 text-amber-300 font-bold cursor-pointer transition";
    } else {
      btn.className = "tip-filter-btn px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800 text-gray-300 cursor-pointer transition hover:bg-slate-700";
    }
  });

  renderDailyTipsList();
};

/**
 * معالجة البحث
 */
window.handleTipSearchInput = function(val) {
  searchQuery = val || "";
  renderDailyTipsList();
};

/**
 * معاينة التوست من النموذج قبل الحفظ
 */
window.testFormTipPreview = function() {
  const isEn = (window.currentLang || localStorage.getItem('lang') || 'ar') === 'en';
  const title = document.getElementById("tipTitle")?.value || (isEn ? "Sample Title" : "عنوان تجريبي للمعاينة");
  const text = document.getElementById("tipText")?.value || (isEn ? "Sample content preview for testing." : "هذا النص يعبر عن كيفية ظهور المعلومة في الرسالة المنبثقة التلقائية.");
  const category = document.getElementById("tipCategory")?.value || "general";

  showDailyTipToast(0, true);
};

/**
 * معاينة توست لعنصر محدد في القائمة
 */
window.previewSingleTipToast = function(index) {
  showDailyTipToast(index, true);
};
