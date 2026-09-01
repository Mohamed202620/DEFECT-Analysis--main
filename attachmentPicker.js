// ============================================================
// attachmentPicker.js
// مكوّن إدارة واختيار الصور والمرفقات المتعددة
// (كاميرا مباشرة + معرض الصور + معاينة + حذف مستقل + ضغط تلقائي)
// ============================================================

const attachmentStore = new Map();

/**
 * ضغط الصورة وتحويلها إلى Data URL
 * @param {File} file
 * @param {number} maxWidth
 * @param {number} quality
 * @returns {Promise<string>}
 */
export function compressImage(file, maxWidth = 900, quality = 0.75) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('الملف ليس صورة صالحة'));
    }

    const reader = new FileReader();
    reader.onerror = (err) => reject(err);
    reader.onload = (e) => {
      const img = new Image();
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

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * بناء كود الـ HTML لمكوّن اختيار المرفقات
 * @param {string} groupId معرّف مجموعة المرفقات
 * @param {Object} options خيارات التصميم والنصوص
 * @returns {string}
 */
export function buildAttachmentPickerHtml(groupId, options = {}) {
  const cameraLabel = options.cameraLabel || "📷 التقاط صورة";
  const galleryLabel = options.galleryLabel || "🖼️ من المعرض";
  const emptyText = options.emptyText || "لا توجد صور مرفقة";
  const buttonsWrapperClass = options.buttonsWrapperClass || "grid grid-cols-2 gap-2 mb-2";
  const cameraButtonClass = options.cameraButtonClass ||
    "bg-blue-600/20 border border-blue-500/50 hover:bg-blue-600/30 rounded-lg p-2.5 text-blue-400 font-bold transition active:scale-95 text-xs flex items-center justify-center gap-1.5";
  const galleryButtonClass = options.galleryButtonClass ||
    "bg-gray-700/50 border border-gray-600 hover:bg-gray-700 rounded-lg p-2.5 text-gray-300 font-bold transition active:scale-95 text-xs flex items-center justify-center gap-1.5";
  const gridClass = options.gridClass || "grid grid-cols-3 sm:grid-cols-4 gap-2 mb-2";

  return `
    <div id="${groupId}_container" class="attachment-picker-group">
      <!-- Input للكاميرا المباشرة -->
      <input
        type="file"
        id="${groupId}_camera_input"
        accept="image/*"
        capture="environment"
        class="hidden" />

      <!-- Input للمعرض (يدعم تحديد أكثر من صورة) -->
      <input
        type="file"
        id="${groupId}_gallery_input"
        accept="image/*"
        multiple
        class="hidden" />

      <!-- أزرار الاختيار -->
      <div class="${buttonsWrapperClass}">
        <button
          type="button"
          id="${groupId}_camera_btn"
          class="${cameraButtonClass}">
          <span>${cameraLabel}</span>
        </button>
        <button
          type="button"
          id="${groupId}_gallery_btn"
          class="${galleryButtonClass}">
          <span>${galleryLabel}</span>
        </button>
      </div>

      <!-- شبكة معاينة الصور المختارة -->
      <div id="${groupId}_preview_grid" class="${gridClass}"></div>

      <!-- نص الحالة عند عدم وجود صور -->
      <p id="${groupId}_empty_text" class="text-xs text-gray-400 text-center py-2">
        ${emptyText}
      </p>
    </div>
  `;
}

/**
 * تحديث واجهة المعاينة لمجموعة المرفقات
 * @param {string} groupId
 * @param {Object} config
 */
function renderAttachmentPreviews(groupId, config = {}) {
  const gridEl = document.getElementById(`${groupId}_preview_grid`);
  const emptyEl = document.getElementById(`${groupId}_empty_text`);
  if (!gridEl) return;

  const files = attachmentStore.get(groupId) || [];

  if (files.length === 0) {
    gridEl.innerHTML = '';
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
  }

  if (emptyEl) emptyEl.classList.add('hidden');

  gridEl.innerHTML = files.map((dataUrl, index) => `
    <div class="relative group rounded-lg overflow-hidden border border-gray-700 bg-slate-900 aspect-square flex items-center justify-center">
      <img src="${dataUrl}" alt="Attachment ${index + 1}" class="w-full h-full object-cover" />
      <button
        type="button"
        data-group="${groupId}"
        data-index="${index}"
        class="attachment-delete-btn absolute top-1 right-1 bg-red-600/80 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold transition-transform active:scale-90 shadow">
        ✕
      </button>
      <span class="absolute bottom-1 left-1 bg-black/60 text-[10px] text-white px-1 rounded">
        #${index + 1}
      </span>
    </div>
  `).join('');

  gridEl.querySelectorAll('.attachment-delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      removeAttachmentFile(groupId, idx, config);
    });
  });
}

/**
 * تهيئة وتفعيل أزرار والمدخلات الخاصة بمجموعة المرفقات
 * @param {string} groupId
 * @param {Object} options
 */
export function initAttachmentPicker(groupId, options = {}) {
  const maxFiles = options.maxFiles || 5;
  const maxFileSizeMB = options.maxFileSizeMB || 10;
  const maxWidth = options.maxWidth || 900;
  const quality = options.quality || 0.75;
  const emptyText = options.emptyText || "لا توجد صور مرفقة";

  const config = { maxFiles, maxFileSizeMB, maxWidth, quality, emptyText };

  if (!attachmentStore.has(groupId)) {
    attachmentStore.set(groupId, []);
  }

  const cameraBtn = document.getElementById(`${groupId}_camera_btn`);
  const galleryBtn = document.getElementById(`${groupId}_gallery_btn`);
  const cameraInput = document.getElementById(`${groupId}_camera_input`);
  const galleryInput = document.getElementById(`${groupId}_gallery_input`);

  const handleFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return;

    const currentFiles = attachmentStore.get(groupId) || [];
    const filesArray = Array.from(fileList);

    for (const file of filesArray) {
      if (currentFiles.length >= maxFiles) {
        alert(`الحد الأقصى للصور هو ${maxFiles} صور.`);
        break;
      }

      if (file.size > maxFileSizeMB * 1024 * 1024) {
        alert(`حجم الصورة "${file.name}" يتجاوز ${maxFileSizeMB} ميجابايت.`);
        continue;
      }

      try {
        const compressed = await compressImage(file, maxWidth, quality);
        currentFiles.push(compressed);
      } catch (err) {
        console.error('Error compressing image:', err);
      }
    }

    attachmentStore.set(groupId, currentFiles);
    renderAttachmentPreviews(groupId, config);
  };

  if (cameraBtn && cameraInput) {
    cameraBtn.onclick = () => cameraInput.click();
    cameraInput.onchange = (e) => {
      handleFiles(e.target.files);
      cameraInput.value = '';
    };
  }

  if (galleryBtn && galleryInput) {
    galleryBtn.onclick = () => galleryInput.click();
    galleryInput.onchange = (e) => {
      handleFiles(e.target.files);
      galleryInput.value = '';
    };
  }

  renderAttachmentPreviews(groupId, config);
}

/**
 * حذف صورة محددة من المجموعة
 * @param {string} groupId
 * @param {number} index
 * @param {Object} config
 */
export function removeAttachmentFile(groupId, index, config = {}) {
  const current = attachmentStore.get(groupId) || [];
  if (index >= 0 && index < current.length) {
    current.splice(index, 1);
    attachmentStore.set(groupId, current);
    renderAttachmentPreviews(groupId, config);
  }
}

/**
 * جلب مصفوفة الصور (Base64) لمجموعة معينة
 * @param {string} groupId
 * @returns {Array<string>}
 */
export function getAttachmentFiles(groupId) {
  return attachmentStore.get(groupId) || [];
}

/**
 * تفريغ مصفوفة الصور لمجموعة معينة
 * @param {string} groupId
 */
export function resetAttachmentFiles(groupId) {
  attachmentStore.set(groupId, []);
  const gridEl = document.getElementById(`${groupId}_preview_grid`);
  const emptyEl = document.getElementById(`${groupId}_empty_text`);
  if (gridEl) gridEl.innerHTML = '';
  if (emptyEl) emptyEl.classList.remove('hidden');
}
