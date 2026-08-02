export const LoginView = () => `
  <div id="loginScreen" class="min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-sm bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6 shadow-2xl space-y-4">
      <div class="flex justify-center mb-2">
        <img src="1000230635.png" alt="Logo" class="w-20 h-20 object-contain rounded-2xl shadow-lg"/>
      </div>
      <h2 class="text-xl font-bold text-center text-blue-400">تسجيل دخول النظام</h2>
      <div>
        <label class="block text-xs font-bold mb-1 opacity-70">رقم الموبايل</label>
        <input id="loginPhone" type="tel" placeholder="رقم الموبايل" class="w-full p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] text-white text-sm focus:outline-none focus:border-blue-500"/>
      </div>
      <div>
        <label class="block text-xs font-bold mb-1 opacity-70">كلمة السر</label>
        <input id="loginPass" type="password" placeholder="كلمة السر" class="w-full p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] text-white text-sm focus:outline-none focus:border-blue-500"/>
      </div>
      <button id="loginBtn" onclick="window.doLogin()" class="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl font-bold text-sm text-white transition shadow-lg">دخول</button>

      <button
          onclick="window.navigateTo('register')"
          class="w-full py-3 mt-3 bg-green-600 hover:bg-green-700 active:scale-95 rounded-xl font-bold text-sm text-white transition shadow-lg">
          ➕ إنشاء حساب جديد
      </button>
    </div>
  </div>
`;
