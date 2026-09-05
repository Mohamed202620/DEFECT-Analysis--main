import { translations } from "../config.js";

export const LoginView = () => {
  const currentLang = window.currentLang || "ar";
  const t = (translations[currentLang] || translations.ar).login;
  const dir = currentLang === "ar" ? "rtl" : "ltr";

  return `
  <div id="loginScreen" class="min-h-screen bg-[#0F172A] flex items-center justify-center p-4 text-white" dir="${dir}">
    <form 
      onsubmit="event.preventDefault(); window.doLogin();" 
      class="w-full max-w-sm bg-[#1E293B] border border-gray-800 rounded-2xl p-6 shadow-2xl space-y-4"
    >
      
      <!-- الشعار -->
      <div class="flex justify-center mb-2">
        <div class="w-20 h-20 bg-[#0F172A] rounded-2xl p-2 border border-gray-700 flex items-center justify-center shadow-inner">
          <img src="assets/icons/app-icon.png" alt="شعار النظام" class="max-h-full max-w-full object-contain" onerror="this.src='https://cdn-icons-png.flaticon.com/512/1063/1063376.png'"/>
        </div>
      </div>
      
      <!-- العنوان -->
      <h2 class="text-xl font-bold text-center text-blue-400">${t.title}</h2>
      
      <!-- رقم الموبايل -->
      <div>
        <label for="loginPhone" class="block text-xs font-bold mb-1 text-gray-300">${t.phone}</label>
        <input 
          id="loginPhone" 
          type="tel" 
          autocomplete="tel"
          placeholder="${t.phone}" 
          required
          class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white placeholder-gray-400 text-sm focus:outline-none focus:border-blue-500 transition shadow-sm"
        />
      </div>
      
      <!-- كلمة السر -->
      <div>
        <label for="loginPass" class="block text-xs font-bold mb-1 text-gray-300">${t.password}</label>
        <div class="relative">
          <input 
            id="loginPass" 
            type="password" 
            autocomplete="current-password"
            placeholder="${t.password}" 
            required
            class="w-full p-3 pl-12 rounded-lg bg-[#0F172A] border border-gray-700 text-white placeholder-gray-400 text-sm focus:outline-none focus:border-blue-500 transition shadow-sm"
          />
          <button
            type="button"
            onclick="
              const p = document.getElementById('loginPass');
              const isPass = p.type === 'password';
              p.type = isPass ? 'text' : 'password';
              this.innerHTML = isPass ? '🙈' : '👁';
            "
            class="absolute left-3 top-1/2 -translate-y-1/2 text-xl focus:outline-none text-gray-400"
            aria-label="${t.showHidePass}"
          >
            👁
          </button>
        </div>
      </div>
      
      <!-- زر الدخول -->
      <button 
        id="loginBtn" 
        type="submit" 
        class="w-full py-3 bg-blue-600 hover:bg-blue-500 active:scale-95 rounded-xl font-bold text-sm text-white transition shadow-lg"
      >
        ${t.loginBtn}
      </button>

      <!-- زر إنشاء حساب جديد -->
      <button
        type="button"
        onclick="window.navigateTo('register')"
        class="w-full py-3 mt-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 rounded-xl font-bold text-sm text-white transition shadow-lg"
      >
        ${t.registerBtn}
      </button>

      <!-- نسيت كلمة المرور -->
      <div class="text-center mt-4">
        <button
          type="button"
          onclick="document.getElementById('forgotPasswordModal').classList.remove('hidden')"
          class="text-xs text-blue-400 hover:text-blue-300 underline focus:outline-none"
        >
          ${t.forgotPassword}
        </button>
      </div>

    </form>
    <!-- Modal استعادة كلمة المرور -->
    <div id="forgotPasswordModal" class="hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-[#1E293B] border border-gray-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <h3 class="text-lg font-bold text-white mb-2">${t.resetPasswordTitle}</h3>
        <p class="text-xs text-gray-400 mb-4">${t.resetPasswordDesc}</p>
        <form onsubmit="event.preventDefault(); window.doForgotPassword();">
          <input 
            id="forgotPhone" 
            type="tel" 
            placeholder="${t.phone}" 
            required
            class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white placeholder-gray-400 text-sm focus:outline-none focus:border-blue-500 transition mb-4"
          />
          <button 
            id="forgotBtn"
            type="submit" 
            class="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-sm text-white transition"
          >
            ${t.sendResetLink}
          </button>
          <button 
            type="button" 
            onclick="document.getElementById('forgotPasswordModal').classList.add('hidden')"
            class="w-full py-3 mt-2 bg-transparent border border-gray-600 hover:bg-gray-800 rounded-xl font-bold text-sm text-gray-300 transition"
          >
            ${t.backToLogin}
          </button>
        </form>
      </div>
    </div>
  </div>
`;
};
