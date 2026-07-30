// دالة ضغط الصور قبل الرفع
export function compressImage(file, maxWidth, quality, callback) {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = (event) => {
    const img = new Image();
    img.src = event.target.result;
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
      callback(canvas.toDataURL('image/jpeg', quality));
    };
  };
}

// دالة التعامل مع فتح واختيار ملفات الصور
export function handleDefectFile(e, index) {
  const file = e.target.files[0];
  if (!file) return;

  compressImage(file, 1000, 0.8, function(base64){
    defectImages[index] = base64;

    const img = document.getElementById("imgPreview" + index);
    if(img) {
      img.src = base64;
      img.classList.remove("hidden");
    }

    const count = defectImages.filter(x => x !== null).length;

    const counterEl = document.getElementById("imgCounter");
    if(counterEl) {
      counterEl.innerHTML = "تم رفع " + count + " من 3 صور";
      if(count === 3){
        counterEl.innerHTML = "✅ تم رفع جميع الصور";
      }
    }
  });
}

// دالة حفظ وإرسال بيانات العيوب
export async function saveDefectData() {
  if (defectImages.includes(null)) {
    alert("يرجى رفع ثلاث صور للعيب.");
    return;
  }

  const name = document.getElementById("defectName").value.trim();
  if (!name) {
    alert("⚠️ يرجى إدخال اسم العيب");
    return;
  }

  const btn = document.getElementById("submitBtn");
  btn.disabled = true;
  btn.innerHTML = "⏳ جاري الحفظ والإرسال...";

  const line = document.getElementById("lineSelect").value;
  const stage = document.getElementById("stageSelect").value;
  const location = document.getElementById("defectLocation").value.trim();
  const description = document.getElementById("defectDesc").value.trim();

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const phone = localStorage.getItem("phone") || currentUser.phone || "";
  const userName = localStorage.getItem("name") || currentUser.name || "";
  const job = localStorage.getItem("job") || currentUser.job || "";
  const role = localStorage.getItem("role") || currentUser.role || "";

  const payload = {
    action: "saveDefect",
    user: {
      name: userName,
      phone: phone,
      job: job,
      role: role
    },
    line: line,
    stage: stage,
    name: name,
    location: location,
    description: description,
    image1: defectImages[0],
    image2: defectImages[1],
    image3: defectImages[2],
    date: new Date().toLocaleString('ar-EG')
  };

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (result.status === 'success') {
      alert('✅ تم الحفظ بنجاح');
      defectImages = [null, null, null]; // إعادة ضبط المصفوفة
      navigateTo('home');
    } else {
      btn.disabled = false;
      btn.innerHTML = "✅ حفظ وإرسال";
      alert('❌ حدث خطأ أثناء الحفظ: ' + (result.message || 'خطأ غير معروف'));
    }
  } catch (error) {
    btn.disabled = false;
    btn.innerHTML = "✅ حفظ وإرسال";
    alert('❌ خطأ: ' + error.message);
  }
}