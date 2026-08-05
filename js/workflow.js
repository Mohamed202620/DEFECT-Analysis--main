import { saveDefectApi } from './services/api.js';

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

// دالة ضغط الصور باستخدام Promise
export function compressImage(file, maxWidth = 1000, quality = 0.8) {
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

  try {
    const base64 = await compressImage(file, 1000, 0.8);
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

  const payload = {
    action: "saveDefect",
    user: { name: userName, phone, job, role },
    line,
    stage,
    name,
    location,
    description,
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

    try {
      selectedIssueImage = await compressImage(file, 1000, 0.8);
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
  const issueId = document.getElementById('generatedIssueId')?.textContent;

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
    action: "saveIssue",
    issueId,
    line,
    machine,
    priority,
    type,
    category,
    description,
    location,
    suggestion,
    image: selectedIssueImage,
    reporter: {
      name: localStorage.getItem("name") || "",
      job: localStorage.getItem("job") || "",
      department: localStorage.getItem("department") || "",
      shift: localStorage.getItem("shift") || ""
    },
    status: "open",
    createdAt: new Date().toISOString()
  };

  try {
    const { saveIssueApi } = await import('./services/api.js');
    const res = await saveIssueApi(payload);
    if (res && res.status === 'success') {
      alert("✅ تم حفظ وإرسال البلاغ بنجاح");
      selectedIssueImage = null;
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

