import { saveDefectApi, fetchTicketsApi } from './services/api.js';
// إضافة: نفس دوال الحساب المستخدمة في صفحة الإحصائيات (statistics.js)
// اتعملها export من هناك بدون تغيير منطقها، عشان نعرض نفس الأرقام
// (MTTR / أكثر ماكينة / أفضل فني) في كارتات الرئيسية الجديدة من
// غير ما نكرر الكود ومن غير أي استعلام إضافي على قاعدة البيانات
import { computeMTTR, computeTopMachines, computeTechnicianPerformance } from './statistics.js';
// إضافة: مفاتيح الترجمة عشان الرسم البياني في الرئيسية (أيام
// الأسبوع + أسماء الأعمدة) ماتفضلش ثابتة بالعربي لما اللغة تتغيّر -
// نفس translations المستخدمة في كل الملفات التانية، بدون تكرار
import { translations } from './config.js';

// مصفوفة حفظ الصور محلية داخل وحدة العمليات
export let defectImages = [null, null, null];

// دالة إعادة ضبط حالة الصور والـ DOM
export function resetDefectForm() {
  defectImages = [null, null, null];

  // إعادة ضبط العناصر في الواجهة إن وجدت
  [0, 1, 2].forEach(index => {
    const img = document.getElementById(`imgPreview${index}`);
    if (img) {
      img.src = "";
      img.classList.add("hidden");
    }
  });

  const counterEl = document.getElementById("imgCounter");
  if (counterEl) counterEl.innerHTML = "رفع 0 من 3 صور";

  const nameEl = document.getElementById("defectName");
  if (nameEl) nameEl.value = "";
  
  const descEl = document.getElementById("defectDesc");
  if (descEl) descEl.value = "";
}

// ✅ 5. تحسين الضغط (900 و 0.75 كقيم افتراضية)
export function compressImage(file, maxWidth = 900, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onerror = (err) => reject(err);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onerror = (err) => reject(err);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
    };
  });
}

// دالة التعامل مع فتح واختيار ملفات الصور
export async function handleDefectFile(e, index) {
  const file = e.target.files[0];
  if (!file) return;

  // ✅ 2. التأكد أن الملف صورة
  if (!file.type.startsWith("image/")) {
    alert("⚠️ الملف المختار ليس صورة.");
    return;
  }

  // ✅ 1. منع تهنيج التطبيق عند اختيار صور كبيرة جداً
  if (file.size > 10 * 1024 * 1024) {
    alert("❌ حجم الصورة كبير جداً (الحد الأقصى 10MB)");
    return;
  }

  try {
    // ✅ 5. تطبيق إعدادات الضغط المحسنة
    const base64 = await compressImage(file, 900, 0.75);
    defectImages[index] = base64;

    const img = document.getElementById(`imgPreview${index}`);
    if (img) {
      img.src = base64;
      img.classList.remove("hidden");
    }

    const count = defectImages.filter(x => x !== null).length;
    const counterEl = document.getElementById("imgCounter");
    if (counterEl) {
      counterEl.innerHTML = count === 3 
        ? "✅ تم رفع جميع الصور (3/3)" 
        : `تم رفع ${count} من 3 صور`;
    }
  } catch (err) {
    alert("❌ حدث خطأ أثناء معالجة الصورة: " + err.message);
  }
}

// دالة حفظ وإرسال بيانات العيوب
export async function saveDefectData() {
  if (defectImages.includes(null)) {
    alert("⚠️ يرجى رفع ثلاث صور للعيب لتأكيد البلاغ.");
    return;
  }

  const nameEl = document.getElementById("defectName");
  const name = nameEl ? nameEl.value.trim() : "";
  if (!name) {
    alert("⚠️ يرجى إدخال اسم العيب");
    return;
  }

  const btn = document.getElementById("submitBtn");
  const originalBtnText = btn ? btn.innerHTML : "✅ حفظ وإرسال";

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = "⏳ جاري الحفظ والإرسال...";
  }

  const line = document.getElementById("lineSelect")?.value || "";
  const stage = document.getElementById("stageSelect")?.value || "";
  const location = document.getElementById("defectLocation")?.value.trim() || "";
  const description = document.getElementById("defectDesc")?.value.trim() || "";

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const phone = localStorage.getItem("phone") || currentUser.phone || "";
  const userName = localStorage.getItem("name") || currentUser.name || "";
  const job = localStorage.getItem("job") || currentUser.job || "";
  const role = localStorage.getItem("role") || currentUser.role || "";

  // ✅ 8. إضافة رقم البلاغ كمعرف فريد
  const defectId = "DF-" + Date.now();

  const payload = {
    // ✅ 4. تم إزالة action: "saveDefect"
    defectId, // المعرف المضاف حديثاً
    user: { name: userName, phone, job, role },
    line,
    stage,
    name,
    location,
    description,
    
    // ✅ 7. ملاحظة: سيتم استبدال هذه الحقول لاحقاً بـ image1Url... بعد تفعيل Firebase Storage
    image1: defectImages[0],
    image2: defectImages[1],
    image3: defectImages[2],
    
    date: new Date().toISOString()
  };

  try {
    const result = await saveDefectApi(payload);
    if (result.status === 'success') {
      alert('✅ تم حفظ العيب بنجاح');
      resetDefectForm();
      if (typeof window.navigateTo === 'function') {
        window.navigateTo('home');
      }
    } else {
      alert('❌ حدث خطأ أثناء الحفظ: ' + (result.message || 'خطأ غير معروف'));
    }
  } catch (error) {
    alert('❌ خطأ في الاتصال: ' + error.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalBtnText;
    }
  }
}

// ربط الدوال التفاعلية بـ Window لتسهيل استدعائها من الـ HTML مباشرة
window.handleDefectFile = handleDefectFile;
window.saveDefectData = saveDefectData;
window.resetDefectForm = resetDefectForm;

// ==========================================
// منطق معالجة وحفظ بلاغات الأعطال (Issue Logic)
// ==========================================

let selectedIssueImage = null;

// الاستماع لاختيار الصور من الكاميرا أو المعرض في واجهة البلاغات
document.addEventListener('change', async (e) => {
  if (e.target && (e.target.id === 'cameraImage' || e.target.id === 'galleryImage')) {
    const file = e.target.files[0];
    if (!file) return;

    // ✅ 2. التأكد أن الملف صورة
    if (!file.type.startsWith("image/")) {
      alert("⚠️ الملف المختار ليس صورة.");
      return;
    }

    // ✅ 1. منع تهنيج التطبيق للصور الضخمة
    if (file.size > 10 * 1024 * 1024) {
      alert("❌ حجم الصورة كبير جداً (الحد الأقصى 10MB)");
      return;
    }

    try {
      // ✅ 5. تحسين الضغط (900، 0.75)
      selectedIssueImage = await compressImage(file, 900, 0.75);
      const preview = document.getElementById('previewImage');
      const nameTxt = document.getElementById('imageName');

      if (preview) {
        preview.src = selectedIssueImage;
        preview.classList.remove('hidden');
      }
      if (nameTxt) {
        nameTxt.textContent = `📷 تم إرفاق الصورة: ${file.name || 'مباشرة'}`;
        nameTxt.classList.remove('text-gray-400');
        nameTxt.classList.add('text-emerald-400');
      }
    } catch (err) {
      alert("❌ خطأ أثناء معالجة الصورة: " + err.message);
    }
  }
});

// دالة حفظ وإرسال البلاغ المربوطة بزر الحفظ
window.confirmIssue = async function() {
  const line = document.getElementById('issueLine')?.value;
  const machine = document.getElementById('issueMachine')?.value;
  const priority = document.getElementById('issuePriority')?.value;
  const type = document.querySelector('input[name="issueType"]:checked')?.value || "Breakdown";
  const category = document.getElementById('issueCategory')?.value;
  const description = document.getElementById('issueDescription')?.value?.trim();
  const location = document.getElementById('issueLocation')?.value?.trim();
  const suggestion = document.getElementById('issueSuggestion')?.value?.trim();
  // ✅ توليد معرف فريد للبلاغ بنفس أسلوب defectId
  // (العنصر generatedIssueId# غير موجود فعلياً في IssueView، لذا كان
  // issueId يصل دائماً كـ undefined قبل هذا التعديل)
  const issueId = "IS-" + Date.now();

  if (!line || !machine || !category || !description) {
    alert("⚠️ يرجى استكمال البيانات الأساسية: (الخط، الماكينة، نوع العطل، والوصف)");
    return;
  }

  const btn = document.querySelector('button[onclick="window.confirmIssue()"]');
  const originalText = btn ? btn.innerHTML : "💾 حفظ وإرسال البلاغ";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = "⏳ جاري الإرسال...";
  }

  const payload = {
    // ✅ 4. تم إزالة action: "saveIssue"
    issueId,
    line,
    machine,
    priority,
    type,
    category,
    description,
    location,
    suggestion,
    image: selectedIssueImage, // مستقبلاً سيتم رفعها كـ imageUrl

    // اسم/معرّف المُبلّغ بشكل مسطّح (يُستخدم في دورة حياة التذكرة:
    // قواعد الأمان وواجهة "Review & Closure" - راجع ticketsBoard.js)
    reportedBy: localStorage.getItem("name") || "",
    reportedByUid: localStorage.getItem("userId") || "",

    reporter: {
      name: localStorage.getItem("name") || "",
      job: localStorage.getItem("job") || "",
      department: localStorage.getItem("department") || "",
      shift: localStorage.getItem("shift") || ""
    },

    // دورة حياة التذكرة تبدأ دائماً بـ pending (كانت "open" سابقاً -
    // تم تصحيحها لتطابق حالات: pending -> assigned -> resolved ->
    // closed | reopened)
    status: "pending",
    createdAt: new Date().toISOString()
  };

  try {
    const { saveIssueApi } = await import('./services/api.js');
    const res = await saveIssueApi(payload);
    if (res && (res.status === 'success' || res.status === 'queued')) {
      alert(
        res.status === 'queued'
          ? "📴 لا يوجد اتصال حالياً - تم حفظ البلاغ محلياً وسيتم إرساله تلقائياً عند عودة الإنترنت"
          : "✅ تم حفظ وإرسال البلاغ بنجاح"
      );
      
      // ✅ 3. إعادة ضبط حقول البلاغ بعد الحفظ قبل العودة للرئيسية
      selectedIssueImage = null;
      if (document.getElementById("issueDescription")) document.getElementById("issueDescription").value = "";
      if (document.getElementById("issueSuggestion")) document.getElementById("issueSuggestion").value = "";
      if (document.getElementById("issueLocation")) document.getElementById("issueLocation").value = "";
      
      const preview = document.getElementById("previewImage");
      if(preview){
          preview.src = "";
          preview.classList.add("hidden");
      }

      if (typeof window.navigateTo === 'function') {
        window.navigateTo('home');
      }
    } else {
      alert("❌ حدث خطأ أثناء الإرسال: " + (res?.message || "خطأ غير معروف"));
    }
  } catch (err) {
    alert("❌ خطأ بالاتصال: " + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
};

// ==========================================
// رسم بياني للأعطال والأداء (Home Chart)
// ديناميكي بالكامل مع فلاتر زمنية [يومي / أسبوعي / شهري] - بيتجمّع
// من نفس تذاكر Firestore (حقل createdAt) اللي بيجيبها loadDashboardStats()
// من غير أي طلب إضافي لقاعدة البيانات، وبيتحدّث بـ chart.update()
// من غير ما يعيد تحميل الصفحة أو يهدم الرسم البياني
// ==========================================

let chartInstance = null;

// الفلتر الزمني الحالي - بيفضل محفوظ حتى لو المستخدم بدّل صفحة ورجع
export let currentChartRange = 'weekly';

// نفس تصنيف "مغلق" المستخدم في loadDashboardStats بالظبط - اتنقل هنا
// كثابت مشترك عشان الرسم البياني وكارتات الـ KPI يتفقوا في نفس المنطق
const CLOSED_STATUSES = ['closed', 'resolved', 'done', 'مغلق', 'تم الإصلاح'];

// آخر نسخة من مصفوفة التذاكر (تم جلبها فعلياً من Firestore عبر
// fetchTicketsApi داخل loadDashboardStats) - بتتخزن هنا عشان تبديل
// الفلتر يعيد الحساب فوراً محلياً من غير أي Round-trip جديد للسيرفر
let lastTicketsSnapshot = [];

function isClosedStatus(status) {
  return CLOSED_STATUSES.includes(String(status || '').trim().toLowerCase());
}

// ------------------------------------------------------------
// تجميع بيانات الرسم البياني حسب الفلتر المطلوب من مصفوفة التذاكر
// ------------------------------------------------------------
function buildChartDataset(tickets, range, lang) {
  const t = (translations[lang] || translations.en).home;
  const now = new Date();

  if (range === 'daily') {
    // توزيع أعطال اليوم الحالي على مدار الساعة (00:00 → 23:00)
    const labels = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0') + ':00');
    const open = new Array(24).fill(0);
    const closed = new Array(24).fill(0);
    const todayStr = now.toDateString();

    tickets.forEach(ticket => {
      const created = ticket.createdAt ? new Date(ticket.createdAt) : null;
      if (!created || isNaN(created) || created.toDateString() !== todayStr) return;

      const hour = created.getHours();
      if (isClosedStatus(ticket.status)) closed[hour]++;
      else open[hour]++;
    });

    return { labels, open, closed };
  }

  if (range === 'monthly') {
    // توزيع أعطال الشهر الحالي على أسابيعه (حتى 5 أسابيع حسب طول الشهر)
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weeksCount = Math.ceil(daysInMonth / 7);

    const labels = Array.from({ length: weeksCount }, (_, i) => `${t.chartWeekShort} ${i + 1}`);
    const open = new Array(weeksCount).fill(0);
    const closed = new Array(weeksCount).fill(0);

    tickets.forEach(ticket => {
      const created = ticket.createdAt ? new Date(ticket.createdAt) : null;
      if (!created || isNaN(created)) return;
      if (created.getFullYear() !== year || created.getMonth() !== month) return;

      const weekIndex = Math.min(weeksCount - 1, Math.floor((created.getDate() - 1) / 7));
      if (isClosedStatus(ticket.status)) closed[weekIndex]++;
      else open[weekIndex]++;
    });

    return { labels, open, closed };
  }

  // الافتراضي: أسبوعي - من السبت إلى الجمعة (أسبوع العمل الحالي، مش
  // بالضرورة آخر 7 أيام متدحرجة)، بنفس ترتيب t.weekdays (يبدأ بالسبت)
  const labels = t.weekdays;
  const open = new Array(7).fill(0);
  const closed = new Array(7).fill(0);

  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  // عدد الأيام منذ آخر سبت (JS: الأحد=0 ... السبت=6)
  const daysSinceSaturday = (now.getDay() + 1) % 7;
  startOfWeek.setDate(startOfWeek.getDate() - daysSinceSaturday);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  tickets.forEach(ticket => {
    const created = ticket.createdAt ? new Date(ticket.createdAt) : null;
    if (!created || isNaN(created)) return;
    if (created < startOfWeek || created >= endOfWeek) return;

    const dayIndex = (created.getDay() + 1) % 7; // 0=السبت ... 6=الجمعة
    if (isClosedStatus(ticket.status)) closed[dayIndex]++;
    else open[dayIndex]++;
  });

  return { labels, open, closed };
}

// إنشاء تدرّج لوني عمودي لطبقة التعبئة تحت كل خط (بديل أنيق للون
// الفلات الثابت السابق - بيبهت تدريجياً لحد الشفافية عند قاعدة الرسم)
function buildGradient(ctx, area, hexColor, alpha) {
  if (!area) return `${hexColor}${alpha}`;
  const gradient = ctx.createLinearGradient(0, area.top, 0, area.bottom);
  gradient.addColorStop(0, hexColor + '55');
  gradient.addColorStop(1, hexColor + '02');
  return gradient;
}

// ------------------------------------------------------------
// إنشاء/تحديث الرسم البياني
// - أول مرة (chartInstance غير موجود): بيتعمل new Chart()
// - أي تحديث بعد كده (تبديل فلتر/لغة/داتا جديدة): بنعدّل labels
//   والـ datasets في نفس الـ instance وننادي chart.update() بس،
//   من غير ما نهدم/نعيد إنشاء الكانفاس بالكامل
// ------------------------------------------------------------
export function renderMainChart(range = currentChartRange, tickets = lastTicketsSnapshot) {
  const canvas = document.getElementById('mainChart');
  if (!canvas) return;

  currentChartRange = range;
  window.mainChartRange = currentChartRange;
  lastTicketsSnapshot = Array.isArray(tickets) ? tickets : lastTicketsSnapshot;

  const lang = window.currentLang || 'ar';
  const t = (translations[lang] || translations.en).home;
  const isRtl = lang === 'ar';

  const data = buildChartDataset(lastTicketsSnapshot, currentChartRange, lang);

  if (chartInstance) {
    chartInstance.data.labels = data.labels;
    chartInstance.data.datasets[0].label = t.kpiOpen;
    chartInstance.data.datasets[0].data = data.open;
    chartInstance.data.datasets[1].label = t.kpiClosed;
    chartInstance.data.datasets[1].data = data.closed;
    chartInstance.options.rtl = isRtl;
    chartInstance.update();
    updateChartRangeButtons(currentChartRange);
    return;
  }

  chartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [
        {
          // نفس نص كارت "أعطال مفتوحة" (t.kpiOpen) بدل تكرار ترجمة
          // مستقلة لنفس المعنى
          label: t.kpiOpen,
          data: data.open,
          borderColor: '#F59E0B',
          backgroundColor: (context) => buildGradient(context.chart.ctx, context.chart.chartArea, '#F59E0B', ''),
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: '#F59E0B',
          tension: 0.4,
          cubicInterpolationMode: 'monotone',
          fill: true
        },
        {
          // نفس نص كارت "تم إصلاحها" (t.kpiClosed)
          label: t.kpiClosed,
          data: data.closed,
          borderColor: '#10B981',
          backgroundColor: (context) => buildGradient(context.chart.ctx, context.chart.chartArea, '#10B981', ''),
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: '#10B981',
          tension: 0.4,
          cubicInterpolationMode: 'monotone',
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      rtl: isRtl,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#9CA3AF', font: { size: 10 } }, rtl: isRtl },
        tooltip: { rtl: isRtl, textDirection: isRtl ? 'rtl' : 'ltr' }
      },
      scales: {
        x: { ticks: { color: '#9CA3AF' }, grid: { color: 'rgba(51, 65, 85, 0.2)' } },
        y: { ticks: { color: '#9CA3AF', precision: 0 }, grid: { color: 'rgba(51, 65, 85, 0.2)' }, beginAtZero: true }
      }
    }
  });

  updateChartRangeButtons(currentChartRange);
}

// إبقاء initMainChart بنفس الاسم/التوقيع القديم (بينادي عليه
// renderCore.js AUTO LOAD بتاع صفحة الرئيسية) - بيرسم بأحدث فلتر
// محفوظ وبآخر تذاكر متوفرة (لسه هتتحدّث فعلياً لما loadDashboardStats
// يجيب البيانات الحقيقية بعد كده بلحظات)
export function initMainChart(customData = null) {
  // customData: مسار توافق قديم فقط (لا يوجد أي استدعاء حالي في
  // المشروع بيبعت بيانات جاهزة) - المسار الطبيعي الحالي هو رسم
  // آخر فلتر محفوظ من آخر تذاكر متوفرة، وبعدها loadDashboardStats()
  // بيجيب البيانات الحقيقية من Firestore ويحدّث الرسم فوراً
  if (customData && Array.isArray(customData.labels)) {
    lastTicketsSnapshot = [];
    renderMainChart(currentChartRange, []);
    chartInstance.data.labels = customData.labels;
    chartInstance.data.datasets[0].data = customData.open;
    chartInstance.data.datasets[1].data = customData.closed;
    chartInstance.update();
    return;
  }

  renderMainChart(currentChartRange, lastTicketsSnapshot);
}

window.initMainChart = initMainChart;

// ------------------------------------------------------------
// تبديل فلتر الرسم البياني (يُستدعى من أزرار Segmented Control في
// homeView.js) - إعادة حساب فوري من التذاكر المخزّنة محلياً + تحديث
// الرسم البياني (chart.update()) من غير أي إعادة تحميل للصفحة
// ------------------------------------------------------------
window.setMainChartRange = function (range) {
  if (!['daily', 'weekly', 'monthly'].includes(range)) return;
  renderMainChart(range, lastTicketsSnapshot);
};

// تحديث الشكل المرئي لأزرار الفلتر (النشط/غير النشط) بدون أي إعادة
// رسم لباقي الصفحة
function updateChartRangeButtons(activeRange) {
  const container = document.getElementById('chartRangeControl');
  if (!container) return;

  container.querySelectorAll('[data-range]').forEach(btn => {
    const isActive = btn.getAttribute('data-range') === activeRange;
    btn.classList.toggle('bg-blue-600', isActive);
    btn.classList.toggle('text-white', isActive);
    btn.classList.toggle('shadow-sm', isActive);
    btn.classList.toggle('dyn-text-muted', !isActive);
    btn.classList.toggle('opacity-60', !isActive);
  });
}

window.updateChartRangeButtons = updateChartRangeButtons;

// ==========================================
// بيانات لوحة المتابعة الحقيقية (Dashboard Stats)
// كانت أرقام لوحة المتابعة (open/closed/today/total) ثابتة
// دائماً على صفر لأن window.dashboardData لم يكن يُملأ من أي
// مكان رغم وجود fetchTicketsApi جاهزة. تم ربطها الآن دون أي
// تغيير في بنية قاعدة البيانات - فقط قراءة من "tickets" الحالية
// ==========================================

export async function loadDashboardStats() {

  const result = await fetchTicketsApi();

  if (!result || result.status !== 'success') return;

  const tickets = Array.isArray(result.data) ? result.data : [];

  const todayStr = new Date().toDateString();

  let open = 0;
  let closed = 0;
  let today = 0;

  tickets.forEach(ticket => {
    if (isClosedStatus(ticket.status)) {
      closed++;
    } else {
      open++;
    }

    if (ticket.createdAt) {
      const created = new Date(ticket.createdAt);
      if (!isNaN(created) && created.toDateString() === todayStr) {
        today++;
      }
    }
  });

  const stats = {
    open,
    closed,
    today,
    total: tickets.length
  };

  window.dashboardData = stats;

  // ============================================================
  // الرسم البياني: نفس مصفوفة التذاكر اللي جاية فعلياً من Firestore
  // (fetchTicketsApi فوق) بتتخزّن وتتبعت للرسم البياني عشان يتحدّث
  // بالفلتر الزمني الحالي (يومي/أسبوعي/شهري) من غير أي طلب إضافي
  // ============================================================
  renderMainChart(currentChartRange, tickets);

  const setText = (id, value) => {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  };

  setText('statOpenCount', stats.open);
  setText('statClosedCount', stats.closed);
  setText('statTodayCount', stats.today);
  setText('statTotalCount', stats.total);

  // ============================================================
  // إضافة: تنبيه "بلاغ حرج" + كارتات MTTR / أكثر ماكينة عطلاً /
  // أفضل فني في الرئيسية - كل ده من نفس مصفوفة tickets اللي
  // اتجابت فوق بالفعل، فمفيش أي طلب إضافي لقاعدة البيانات
  // ============================================================

  // تنبيه حي: فيه بلاغ مفتوح بأولوية "High"؟
  const hasCritical = tickets.some(t => {
    const isOpen = !isClosedStatus(t.status);
    return isOpen && String(t.priority || '').trim() === 'High';
  });

  const criticalBadge = document.getElementById('criticalBadge');
  if (criticalBadge) {
    criticalBadge.classList.toggle('hidden', !hasCritical);
    criticalBadge.classList.toggle('flex', hasCritical);
  }

  // متوسط زمن الإصلاح (MTTR) - نفس حساب statistics.js بالظبط
  const { avgHours, sampleSize } = computeMTTR(tickets);
  const mttrDisplay = !sampleSize
    ? '—'
    : avgHours < 1
      ? `${Math.round(avgHours * 60)} د`
      : avgHours < 24
        ? `${avgHours.toFixed(1)} س`
        : `${(avgHours / 24).toFixed(1)} يوم`;
  setText('statMttrValue', mttrDisplay);

  // أكثر ماكينة عطلاً (أول عنصر بس من نفس دالة statistics.js)
  const [topMachine] = computeTopMachines(tickets, 1);
  setText('statTopMachineName', topMachine ? `${topMachine[0]} (${topMachine[1]})` : 'لا توجد بيانات');

  // أفضل فني حسب عدد البلاغات المُنجزة (أول عنصر بس)
  const [topTech] = computeTechnicianPerformance(tickets, 1);
  setText('statTopTechName', topTech ? `${topTech[0]} (${topTech[1]})` : 'لا توجد بيانات');
}

window.loadDashboardStats = loadDashboardStats;
