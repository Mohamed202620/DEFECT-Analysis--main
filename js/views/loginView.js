import { login } from './auth/login.js';

// ربط الدالة بالـ window لتكون متاحة لـ onsubmit في LoginView
window.doLogin = async () => {
  const phoneInput = document.getElementById("loginPhone");
  const passInput = document.getElementById("loginPass");
  const btn = document.getElementById("loginBtn");

  if (!phoneInput || !passInput || !btn) return;

  const phone = phoneInput.value.trim();
  const pass = passInput.value.trim();

  if (!phone || !pass) {
    alert("يرجى إدخال رقم الموبايل وكلمة السر");
    return;
  }

  // 1. تغيير حالة الزر أثناء التحميل
  btn.disabled = true;
  const originalText = btn.innerHTML;
  btn.innerHTML = `جاري التحقق... ⏳`;

  try {
    // 2. استدعاء خدمة تسجيل الدخول
    const result = await login(phone, pass);

    if (result.status === "success" || result.success) {
      const userData = result.user || result.data || result;

      // 3. 🔑 معالجة الصلاحيات (معالجة اختلاف مسميات الشيت مثل Manager أو Admin)
      const rawRole = String(userData.role || userData.job || "").toLowerCase().trim();
      const adminKeywords = ["admin", "manager", "supervisor", "مدير", "مشرف", "أدمن"];
      
      const isAdmin = adminKeywords.some(keyword => rawRole.includes(keyword));
      userData.role = isAdmin ? "admin" : "user";

      // 4. حفظ البيانات في الجلسة المحلية (localStorage)
      localStorage.setItem("userToken", result.token || "token_" + Date.now());
      localStorage.setItem("userData", JSON.stringify(userData));
      window.currentUser = userData;

      // 5. التوجيه للشاشة المناسبة بناءً على الصلاحية
      // (تأكد من مطابقة اسم الشاشة في router.js مثل SystemView أو adminDashboard)
      const targetRoute = isAdmin ? "SystemView" : "homeView";

      if (typeof window.navigateTo === "function") {
        window.navigateTo(targetRoute);
      }
    } else {
      alert(result.message || "بيانات الدخول غير صحيحة");
    }
  } catch (err) {
    console.error("Login Exception:", err);
    alert("حدث خطأ مفاجئ أثناء تسجيل الدخول");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
};
