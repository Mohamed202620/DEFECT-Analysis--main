export const LoginView = () => `
  <div id="loginScreen" class="min-h-screen flex items-center justify-center p-4" dir="rtl">
    <form 
      onsubmit="event.preventDefault(); window.doLogin();" 
      class="w-full max-w-sm bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6 shadow-2xl space-y-4"
    >
      
      <!-- الشعار -->
      <div class="flex justify-center mb-2">
        <img src="1000230635.png" alt="شعار النظام" class="w-20 h-20 object-contain rounded-2xl shadow-lg"/>
      </div>
      
      <!-- العنوان -->
      <h2 class="text-xl font-bold text-center text-blue-400">تسجيل دخول النظام</h2>
      
      <!-- رقم الموبايل -->
      <div>
        <label class="block text-xs font-bold mb-1 opacity-70 text-white">رقم الموبايل</label>
        <input 
          id="loginPhone" 
          type="tel" 
          placeholder="رقم الموبايل" 
          required
          class="w-full p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] text-white text-sm focus:outline-none focus:border-blue-500 transition"
        />
      </div>
      
      <!-- كلمة السر -->
      <div>
        <label class="block text-xs font-bold mb-1 opacity-70 text-white">كلمة السر</label>
        <div class="relative">
          <input 
            id="loginPass" 
            type="password" 
            placeholder="كلمة السر" 
            required
            class="w-full p-3 pl-12 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] text-white text-sm focus:outline-none focus:border-blue-500 transition"
          />
          <button
            type="button"
            onclick="
              const p = document.getElementById('loginPass');
              const isPass = p.type === 'password';
              p.type = isPass ? 'text' : 'password';
              this.innerHTML = isPass ? '🙈' : '👁';
            "
            class="absolute left-3 top-1/2 -translate-y-1/2 text-xl focus:outline-none"
            aria-label="إظهار أو إخفاء كلمة المرور"
          >
            👁
          </button>
        </div>
      </div>
      
      <!-- زر الدخول -->
      <button 
        id="loginBtn" 
        type="submit" 
        class="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl font-bold text-sm text-white transition shadow-lg"
      >
        دخول
      </button>

      <!-- زر إنشاء حساب جديد -->
      <button
        type="button"
        onclick="window.navigateTo('register')"
        class="w-full py-3 mt-3 bg-green-600 hover:bg-green-700 active:scale-95 rounded-xl font-bold text-sm text-white transition shadow-lg"
      >
        ➕ إنشاء حساب جديد
      </button>

    </form>
  </div>
`;
