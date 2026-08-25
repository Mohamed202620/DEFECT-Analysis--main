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
// ==========================================
let chartInstance = null;

export function initMainChart(customData = null) {
  const canvas = document.getElementById('mainChart');
  if (!canvas) return;

  if (chartInstance) {
    chartInstance.destroy();
  }

  // اللغة الحالية (نفس نمط الاستخدام في BottomNav.js / homeView.js)
  const lang = window.currentLang || 'en';
  const t = (translations[lang] || translations.en).home;

  // ✅ 6. الهيكل جاهز لاستقبال بيانات (customData) مستوردة من Firestore
  const defaultData = {
    labels: t.weekdays,
    open: [4, 2, 5, 1, 3, 2, 0],
    closed: [3, 4, 4, 3, 5, 4, 1]
  };

  // لو فيه customData بأيام مترجمة بالفعل من المستدعي، نستخدمها زي
  // ما هي؛ غير كده نستخدم أيام الأسبوع المترجمة تلقائياً فوق
  const data = customData || defaultData;

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
          backgroundColor: 'rgba(245, 158, 11, 0.15)',
          borderWidth: 2,
          pointRadius: 4,
          tension: 0.35,
          fill: true
        },
        {
          // نفس نص كارت "تم إصلاحها" (t.kpiClosed)
          label: t.kpiClosed,
          data: data.closed,
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          borderWidth: 2,
          pointRadius: 4,
          tension: 0.35,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#9CA3AF', font: { size: 10 } } }
      },
      scales: {
        x: { ticks: { color: '#9CA3AF' }, grid: { color: 'rgba(51, 65, 85, 0.2)' } },
        y: { ticks: { color: '#9CA3AF', precision: 0 }, grid: { color: 'rgba(51, 65, 85, 0.2)' } }
      }
    }
  });
}

window.initMainChart = initMainChart;

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

  const closedStatuses = ['closed', 'resolved', 'done', 'مغلق', 'تم الإصلاح'];

  tickets.forEach(ticket => {
    const status = String(ticket.status || '').trim().toLowerCase();

    if (closedStatuses.includes(status)) {
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
    const status = String(t.status || '').trim().toLowerCase();
    const isOpen = !closedStatuses.includes(status);
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
