export const HomeViewModule = {
  render: () => {
    const userRole = localStorage.getItem('role') || 'مدير';
    const userName = localStorage.getItem('name') || 'محمد حسن';

    return `
      <!-- Header Bar -->
      <div class="flex justify-between items-center p-3 bg-[#1E293B]/80 backdrop-blur rounded-xl mb-4 border border-gray-800">
        <div class="flex items-center gap-2">
          <span class="text-xs">👋 أهلاً: <b>${userName}</b></span>
          <span class="text-[10px] bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-md border border-blue-700/50">(${userRole})</span>
        </div>
        <div class="flex items-center gap-2">
          <button class="p-1.5 bg-[#0F172A] rounded-lg text-xs">🌙</button>
          <button class="px-2 py-1 bg-[#0F172A] text-[10px] font-bold rounded-lg border border-gray-700">EN</button>
        </div>
      </div>

      <!-- Dashboard Dashboard / لوحة المتابعة -->
      <div class="bg-[#1E293B] p-4 rounded-2xl border border-gray-800 mb-5 space-y-3">
        <div class="flex justify-between items-center text-xs font-bold text-gray-300">
          <span>📊 لوحة المتابعة</span>
          <span class="text-[10px] text-gray-400">اليوم</span>
        </div>

        <!-- Metric Cards -->
        <div class="grid grid-cols-3 gap-2">
          <div class="bg-[#0F172A] p-2.5 rounded-xl border border-gray-800 text-center">
            <div class="text-[15px] font-black text-amber-500">3</div>
            <div class="text-[9px] text-gray-400 mt-0.5">بلاغات مفتوحة</div>
          </div>
          <div class="bg-[#0F172A] p-2.5 rounded-xl border border-gray-800 text-center">
            <div class="text-[15px] font-black text-rose-500">5</div>
            <div class="text-[9px] text-gray-400 mt-0.5">PM متاخرة</div>
          </div>
          <div class="bg-[#0F172A] p-2.5 rounded-xl border border-gray-800 text-center">
            <div class="text-[15px] font-black text-blue-400">12</div>
            <div class="text-[9px] text-gray-400 mt-0.5">عيوب اليوم</div>
          </div>
        </div>

        <!-- Simple Chart Representation -->
        <div class="h-24 bg-[#0F172A] rounded-xl p-2 flex items-end justify-around gap-2 border border-gray-800/80">
          <div class="w-1/3 bg-orange-600 rounded-t-md h-full flex flex-col justify-end items-center pb-1">
            <span class="text-[9px] text-white font-bold">8</span>
          </div>
          <div class="w-1/3 bg-blue-600 rounded-t-md h-3/4 flex flex-col justify-end items-center pb-1">
            <span class="text-[9px] text-white font-bold">5</span>
          </div>
          <div class="w-1/3 bg-gray-600 rounded-t-md h-1/2 flex flex-col justify-end items-center pb-1">
            <span class="text-[9px] text-white font-bold">3</span>
          </div>
        </div>
        <div class="flex justify-around text-[9px] text-gray-400">
          <span>ماكينة 2</span>
          <span>خط الدهان 1</span>
          <span>مكبس 4</span>
        </div>
      </div>

      <!-- Section 1: قسم الصيانة والمهام (الأزرار الأساسية الـ 5) -->
      <div class="space-y-2 mb-5">
        <div class="text-xs font-bold text-blue-400 flex items-center gap-1 mb-2">
          🛠️ <span>قسم الصيانة والمهام</span>
        </div>
        
        <div class="grid grid-cols-2 gap-2.5">
          <button onclick="router.navigateTo('report')" class="p-3.5 bg-[#1E293B] hover:bg-[#283548] border border-gray-800 rounded-xl flex flex-col items-center justify-center gap-1.5 transition">
            <span class="text-xl">🚨</span>
            <span class="text-xs font-bold text-gray-200">1. تسجيل عطل / ملاحظة</span>
          </button>

          <button onclick="router.navigateTo('suggestion')" class="p-3.5 bg-[#1E293B] hover:bg-[#283548] border border-gray-800 rounded-xl flex flex-col items-center justify-center gap-1.5 transition">
            <span class="text-xl">💡</span>
            <span class="text-xs font-bold text-gray-200">2. تسجيل اقتراح جديد</span>
          </button>
        </div>

        <button onclick="router.navigateTo('pm')" class="w-full p-3.5 bg-[#1E293B] hover:bg-[#283548] border border-gray-800 rounded-xl flex items-center justify-center gap-2 transition">
          <span class="text-xl">🛠️</span>
          <span class="text-xs font-bold text-gray-200">3. أعمال الصيانة الوقائية PM</span>
        </button>

        <button onclick="router.navigateTo('reports')" class="w-full p-3.5 bg-[#1E293B] hover:bg-[#283548] border border-gray-800 rounded-xl flex items-center justify-center gap-2 transition">
          <span class="text-xl">📊</span>
          <span class="text-xs font-bold text-gray-200">4. استخراج التقارير</span>
        </button>

        <button onclick="alert('جاري فتح الكاميرا لمسح الـ QR...')" class="w-full p-3.5 bg-[#1E293B] hover:bg-[#283548] border border-gray-800 rounded-xl flex items-center justify-center gap-2 transition">
          <span class="text-xl">📱</span>
          <span class="text-xs font-bold text-gray-200">5. مسح QR الماكينة</span>
        </button>
      </div>

      <!-- Section 2: قسم تحليل عيوب الإنتاج -->
      <div class="space-y-2 mb-5 opacity-80">
        <div class="text-xs font-bold text-amber-400 flex items-center gap-1 mb-2">
          📦 <span>قسم تحليل عيوب الإنتاج</span>
        </div>
        <div class="grid grid-cols-2 gap-2.5">
          <button class="p-3 bg-[#1E293B] border border-gray-800 rounded-xl flex flex-col items-center gap-1">
            <span class="text-lg">📷</span>
            <span class="text-[11px] font-bold">تصوير عيب</span>
          </button>
          <button class="p-3 bg-[#1E293B] border border-gray-800 rounded-xl flex flex-col items-center gap-1">
            <span class="text-lg">🤖</span>
            <span class="text-[11px] font-bold">فحص AI</span>
          </button>
        </div>
      </div>

      <!-- Footer / الخروج -->
      <div class="pt-4 border-t border-gray-800/80 text-center space-y-2">
        <button onclick="location.reload()" class="text-xs text-rose-500 hover:underline font-bold">
          تسجيل الخروج ➔
        </button>
        <div class="text-[10px] text-gray-500">© 2026 جميع الحقوق محفوظة | Mohamed Hassan</div>
      </div>
    `;
  }
};