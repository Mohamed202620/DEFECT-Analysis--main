import { translations } from '../config.js';

export const HomeView = () => {
  const currentLang = window.currentLang || 'ar';
  const t = translations[currentLang] || translations['ar'];

  const userName = localStorage.getItem("name") || "Mohamed Hussein";
  const userJob = localStorage.getItem("job") || "Maintainer back end";
  const initialLetter = userName.charAt(0).toUpperCase();
  const currentYear = new Date().getFullYear();

  return `
  <div class="p-4 max-w-md mx-auto space-y-5 pb-24 text-white">

    <!-- الشريط العلوي (Header) شامل أزرار التحكم -->
    <div class="flex items-center justify-between bg-[#1E293B] p-3 rounded-2xl border border-gray-800 shadow-md">
      
      <!-- الأزرار العليا: ثيم / لغة / دعم المطور -->
      <div class="flex items-center gap-2">
        <!-- زر الوضع الداكن/الفاتح -->
        <button type="button" onclick="window.toggleDarkMode()" 
          class="bg-[#0F172A] hover:bg-gray-700 px-2.5 py-1.5 rounded-xl text-xs border border-gray-700 transition">
          🌙 / ☀️
        </button>

        <!-- زر تغيير اللغة (عربي / EN) -->
        <button type="button" onclick="window.toggleLanguage()" 
          class="bg-[#0F172A] hover:bg-gray-700 px-2.5 py-1.5 rounded-xl text-xs font-bold border border-gray-700 transition text-blue-400">
          🌐 ${currentLang === 'ar' ? 'EN' : 'عربي'}
        </button>

        <!-- زر التواصل مع المطور (واتساب الدعم) -->
        <button type="button" onclick="window.contactSupport()" 
          class="bg-blue-600 hover:bg-blue-500 px-2.5 py-1.5 rounded-xl text-xs font-bold text-white transition flex items-center gap-1 shadow">
          💬 الدعم
        </button>
      </div>

      <!-- اسم المستخدم والصورة الشخصية -->
      <div class="flex items-center gap-2 text-right">
        <div>
          <h2 class="text-sm font-bold flex items-center gap-1 justify-end">
            ${userName} 🖐️
          </h2>
          <p class="text-[10px] text-gray-400">${userJob}</p>
        </div>
        <div class="w-9 h-9 rounded-full bg-blue-700/80 border border-blue-400 flex items-center justify-center font-bold text-sm text-white shadow">
          ${initialLetter}
        </div>
      </div>

    </div>

    <!-- كروت إحصائيات الأعطال -->
    <div class="grid grid-cols-2 gap-3">
      <div class="bg-[#1E293B] p-4 rounded-2xl border border-gray-800 text-center relative overflow-hidden">
        <span class="w-3 h-3 rounded-full bg-amber-500 absolute top-3 left-3"></span>
        <p class="text-xs text-gray-400 mb-1">أعطال مفتوحة</p>
        <span class="text-2xl font-bold text-amber-500">0</span>
      </div>

      <div class="bg-[#1E293B] p-4 rounded-2xl border border-gray-800 text-center relative overflow-hidden">
        <span class="w-3 h-3 rounded-full bg-emerald-500 absolute top-3 left-3"></span>
        <p class="text-xs text-gray-400 mb-1">تم إصلاحها</p>
        <span class="text-2xl font-bold text-emerald-500">0</span>
      </div>

      <div class="bg-[#1E293B] p-4 rounded-2xl border border-gray-800 text-center relative overflow-hidden">
        <span class="text-[10px] p-1 bg-blue-900/50 text-blue-400 rounded absolute top-3 left-3">📅 17</span>
        <p class="text-xs text-gray-400 mb-1">أعطال اليوم</p>
        <span class="text-2xl font-bold text-blue-400">0</span>
      </div>

      <div class="bg-[#1E293B] p-4 rounded-2xl border border-gray-800 text-center relative overflow-hidden">
        <span class="text-xs absolute top-3 left-3">📊</span>
        <p class="text-xs text-gray-400 mb-1">إجمالي البلاغات</p>
        <span class="text-2xl font-bold text-purple-400">0</span>
      </div>
    </div>

    <!-- الوصول السريع -->
    <div>
      <h3 class="text-xs font-bold text-gray-400 mb-2">الوصول السريع</h3>
      <div class="grid grid-cols-2 gap-3">
        
        <button onclick="window.navigateTo('issue')" 
          class="bg-[#1E293B] hover:bg-gray-800 p-3 rounded-2xl border border-gray-800 text-right flex justify-between items-center transition">
          <div>
            <h4 class="text-xs font-bold text-white">إبلاغ عن عطل</h4>
            <p class="text-[10px] text-gray-400">تسجيل بلاغ جديد</p>
          </div>
          <span class="text-xl">🚨</span>
        </button>

        <button onclick="window.navigateTo('ai')" 
          class="bg-[#1E293B] hover:bg-gray-800 p-3 rounded-2xl border border-gray-800 text-right flex justify-between items-center transition">
          <div>
            <h4 class="text-xs font-bold text-white">فحص الذكاء الاصطناعي</h4>
            <p class="text-[10px] text-gray-400">تحليل عيوب الإنتاج</p>
          </div>
          <span class="text-xl">🤖</span>
        </button>

      </div>
    </div>

    <!-- رسم بياني للأداء والأعطال -->
    <div class="bg-[#1E293B] p-4 rounded-2xl border border-gray-800">
      <div class="flex justify-between items-center mb-3">
        <button onclick="window.initMainChart()" class="bg-blue-900/40 text-blue-400 border border-blue-800 text-[10px] px-2 py-1 rounded-lg">تحديث أسبوعي</button>
        <h3 class="text-xs font-bold text-gray-200">تحليل الأداء والأعطال</h3>
      </div>
      <div class="h-48">
        <canvas id="mainChart"></canvas>
      </div>
    </div>

    <!-- شريط جميع الحقوق محفوظة -->
    <div class="text-center pt-2 pb-4 border-t border-gray-800/60">
      <p class="text-[11px] text-gray-400 font-medium">
        جميع الحقوق محفوظة © ${currentYear}
      </p>
      <p class="text-[10px] text-blue-400 font-bold mt-0.5">
        تصوير وتطوير: المهندس محمد حسين ⚙️
      </p>
    </div>

  </div>
  `;
};
