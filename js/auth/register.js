import { register } from "../services/auth.js";

export const RegisterView = () => {
  return `
  <div class="p-4 max-w-md mx-auto pb-10 space-y-5 text-white">

    <!-- الهيدر والترويسة -->
    <div class="text-center space-y-2 border-b border-gray-800 pb-4 pt-2">
      <div class="w-14 h-14 mx-auto rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 text-2xl shadow-inner">
        👤
      </div>
      <h2 class="text-base font-bold text-white">إنشاء حساب جديد</h2>
      <p class="text-[11px] text-gray-400">أدخل بياناتك للانضمام إلى نظام الصيانة</p>
    </div>

    <!-- نموذج التسجيل -->
    <form onsubmit="window.handleRegister(event)" class="space-y-3">
      
      <!-- الاسم الكامل -->
      <div>
        <label class="block text-[11px] font-bold text-gray-400 mb-1 px-1">الاسم الكامل</label>
        <input type="text" id="reg-name" required placeholder="مثال: محمد حسين" 
          class="w-full bg-[#1E293B] border border-gray-800 focus:border-blue-500/60 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none transition shadow-sm" />
      </div>

      <!-- رقم الهاتف والكود الوظيفي -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-[11px] font-bold text-gray-400 mb-1 px-1">رقم الهاتف</label>
          <input type="tel" id="reg-phone" required placeholder="010xxxxxxx" 
            class="w-full bg-[#1E293B] border border-gray-800 focus:border-blue-500/60 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none transition shadow-sm" />
        </div>
        <div>
          <label class="block text-[11px] font-bold text-gray-400 mb-1 px-1">الكود الوظيفي</label>
          <input type="text" id="reg-code" required placeholder="EMP-101" 
            class="w-full bg-[#1E293B] border border-gray-800 focus:border-blue-500/60 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none transition shadow-sm" />
        </div>
      </div>

      <!-- الوظيفة والقسم -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-[11px] font-bold text-gray-400 mb-1 px-1">الوظيفة</label>
          <input type="text" id="reg-job" required placeholder="فني صيانة" 
            class="w-full bg-[#1E293B] border border-gray-800 focus:border-blue-500/60 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none transition shadow-sm" />
        </div>
        <div>
          <label class="block text-[11px] font-bold text-gray-400 mb-1 px-1">القسم</label>
          <input type="text" id="reg-department" required placeholder="الكهرباء / الميكانيكا" 
            class="w-full bg-[#1E293B] border border-gray-800 focus:border-blue-500/60 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none transition shadow-sm" />
        </div>
      </div>

      <!-- الوردية وكلمة السر -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-[11px] font-bold text-gray-400 mb-1 px-1">الوردية</label>
          <select id="reg-shift" required class="w-full bg-[#1E293B] border border-gray-800 focus:border-blue-500/60 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition shadow-sm">
            <option value="">اختر الوردية</option>
            <option value="صباحية">صباحية</option>
            <option value="مسائية">مسائية</option>
            <option value="ليلية">ليلية</option>
          </select>
        </div>
        <div>
          <label class="block text-[11px] font-bold text-gray-400 mb-1 px-1">كلمة السر</label>
          <input type="password" id="reg-password" required placeholder="••••••••" 
            class="w-full bg-[#1E293B] border border-gray-800 focus:border-blue-500/60 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none transition shadow-sm" />
        </div>
      </div>

      <!-- تنبيهات الأخطاء والنجاح -->
      <div id="reg-status-msg" class="hidden p-3 rounded-xl text-xs text-center font-bold transition"></div>

      <!-- زر التسجيل -->
      <button type="submit" id="reg-submit-btn"
        class="w-full bg-blue-600 hover:bg-blue-500 active:scale-95 transition text-white font-bold py-3 px-4 rounded-xl text-xs shadow-md mt-2 flex items-center justify-center gap-2">
        <span>إنشاء الحساب</span>
        <span>✨</span>
      </button>

    </form>

    <!-- العودة لتسجيل الدخول -->
    <div class="pt-3 border-t border-gray-800/80 text-center">
      <p class="text-xs text-gray-400">
        لديك حساب بالفعل؟ 
        <button onclick="window.navigateTo('login')" class="text-blue-400 hover:underline font-bold mr-1">
          تسجيل الدخول
        </button>
      </p>
    </div>

  </div>
  `;
};

// دالة المعالجة والتوصيل بخدمة register الأصلية دون تعديل منطقها
window.handleRegister = async (event) => {
  event.preventDefault();
  
  const btn = document.getElementById("reg-submit-btn");
  const msgDiv = document.getElementById("reg-status-msg");
  
  btn.disabled = true;
  btn.innerHTML = `جاري التسجيل... ⏳`;
  msgDiv.className = "hidden";

  const userData = {
    name: document.getElementById("reg-name").value,
    phone: document.getElementById("reg-phone").value,
    code: document.getElementById("reg-code").value,
    job: document.getElementById("reg-job").value,
    department: document.getElementById("reg-department").value,
    shift: document.getElementById("reg-shift").value,
    password: document.getElementById("reg-password").value
  };

  const res = await register(userData);

  btn.disabled = false;
  btn.innerHTML = `<span>إنشاء الحساب</span><span>✨</span>`;

  msgDiv.classList.remove("hidden");
  if (res.status === "success" || res.success) {
    msgDiv.className = "p-3 rounded-xl text-xs text-center font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
    msgDiv.innerText = res.message || "تم إنشاء الحساب بنجاح!";
    setTimeout(() => window.navigateTo('login'), 1500);
  } else {
    msgDiv.className = "p-3 rounded-xl text-xs text-center font-bold bg-red-500/10 text-red-400 border border-red-500/20";
    msgDiv.innerText = res.message || "حدث خطأ أثناء التسجيل.";
  }
};
