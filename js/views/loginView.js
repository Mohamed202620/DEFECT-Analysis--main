Export const LoginView = () => `
  <div id="loginScreen" class="min-h-screen bg-[#0F172A] flex items-center justify-center p-4 text-white" dir="rtl">
    <form 
      onsubmit="event.preventDefault(); window.doLogin();" 
      class="w-full max-w-sm bg-[#1E293B] border border-gray-800 rounded-2xl p-6 shadow-2xl space-y-4"
    >
      
      <!-- الشعار -->
      <div class="flex justify-center mb-2">
        <div class="w-20 h-20 bg-[#0F172A] rounded-2xl p-2 border border-gray-700 flex items-center justify-center shadow-inner">
          <img src="1000230635.png" alt="شعار النظام" class="max-h-full max-w-full object-contain" onerror="this.src='https://cdn-icons-png.flaticon.com/512/1063/1063376.png'"/>
        </div>
      </div>
      
      <!-- العنوان -->
      <h2 class="text-xl font-bold text-center text-blue-400">تسجيل دخول النظام</h2>
      
      <!-- رقم الموبايل -->
      <div>
        <label class="block text-xs font-bold mb-1 text-gray-300">رقم الموبايل</label>
        <input 
          id="loginPhone" 
          type="tel" 
          placeholder="رقم الموبايل" 
          required
          class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white placeholder-gray-400 text-sm focus:outline-none focus:border-blue-500 transition shadow-sm"
        />
      </div>
      
      <!-- كلمة السر -->
      <div>
        <label class="block text-xs font-bold mb-1 text-gray-300">كلمة السر</label>
        <div class="relative">
          <input 
            id="loginPass" 
            type="password" 
            placeholder="كلمة السر" 
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
        class="w-full py-3 bg-blue-600 hover:bg-blue-500 active:scale-95 rounded-xl font-bold text-sm text-white transition shadow-lg"
      >
        دخول
      </button>

      <!-- زر إنشاء حساب جديد -->
      <button
        type="button"
        onclick="window.navigateTo('register')"
        class="w-full py-3 mt-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 rounded-xl font-bold text-sm text-white transition shadow-lg"
      >
        ➕ إنشاء حساب جديد
      </button>

    </form>
  </div>
`;
