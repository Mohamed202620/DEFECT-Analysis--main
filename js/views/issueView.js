import { saveIssueApi } from '../services/api.js';
import { compressImage } from '../workflow.js';

let selectedIssueImage = null;

// تهيئة معالجة اختيار/تصوير الصور
export function initIssueEvents() {
  const cameraInput = document.getElementById('cameraImage');
  const galleryInput = document.getElementById('galleryImage');

  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      selectedIssueImage = await compressImage(file, 1000, 0.8);
      
      const preview = document.getElementById('previewImage');
      const nameTxt = document.getElementById('imageName');
      
      if (preview && nameTxt) {
        preview.src = selectedIssueImage;
        preview.classList.remove('hidden');
        nameTxt.textContent = `📷 تم إرفاق الصورة: ${file.name || 'مباشرة'}`;
        nameTxt.classList.replace('text-gray-400', 'text-emerald-400');
      }
    } catch (err) {
      alert("❌ تعذر معالجة الصورة: " + err.message);
    }
  };

  if (cameraInput) cameraInput.onchange = handleImageSelect;
  if (galleryInput) galleryInput.onchange = handleImageSelect;
}

// دالة تأكيد وحفظ البلاغ
window.confirmIssue = async function() {
  const line = document.getElementById('issueLine')?.value;
  const machine = document.getElementById('issueMachine')?.value;
  const priority = document.getElementById('issuePriority')?.value;
  const type = document.querySelector('input[name="issueType"]:checked')?.value;
  const category = document.getElementById('issueCategory')?.value;
  const description = document.getElementById('issueDescription')?.value.trim();
  const location = document.getElementById('issueLocation')?.value.trim();
  const suggestion = document.getElementById('issueSuggestion')?.value.trim();
  const issueId = document.getElementById('generatedIssueId')?.textContent;

  if (!line || !machine || !category || !description) {
    alert("⚠️ يرجى استكمال البيانات الأساسية: (الخط، الماكينة، نوع العطل، والوصف)");
    return;
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
    const res = await saveIssueApi(payload);
    if (res.status === 'success') {
      alert("✅ تم إرسال البلاغ بنجاح");
      selectedIssueImage = null;
      window.navigateTo('home');
    } else {
      alert("❌ فشل إرسال البلاغ: " + (res.message || "خطأ غير معروف"));
    }
  } catch (err) {
    alert("❌ خطأ بالاتصال: " + err.message);
  }
};
