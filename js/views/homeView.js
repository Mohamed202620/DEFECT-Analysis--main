import { BottomNav } from "../components/BottomNav.js";

export const HomeView = () => {
  const name = localStorage.getItem("name") || "المستخدم";
  const job = localStorage.getItem("job") || "فني صيانة";
  const stats = window.dashboardData || { open: 0, closed: 0, today: 0, total: 0 };

  // إعداد رقم الواتساب الخاص بك والرسالة الجاهزة
  const waNumber = "201067988554"; 
  const waMessage = "السلام عليكم أود التواصل معك بخصوص تطبيق الصيانة.";
  
  // تجهيز الرابط النهائي وتشفير الرسالة لتتناسب مع الرابط
  const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(waMessage)}`;

  return `
  <div class="p-4 max-w-md mx-auto pb-24 space-y-5 text-white">

    <!-- الهيدر والترحيب -->
    <div class="flex items-center justify-between border-b border-gray-800 pb-3">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-base shadow-inner">
          ${name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 class="text-sm font-bold text-white flex items-center gap-1">
            مرحباً، ${name} 👋
          </h2>
          <p class="text-[11px] text-gray-400">${job}</p>
        </div>
      </div>
      <button 
        onclick="window.toggleDarkMode()" 
        class="p-2 bg-[#1E293B] border border-gray-800 hover:border-gray-700 rounded-xl text-xs text-gray-300 active:scale-95 transition shadow-sm"
        title="تبديل الوضع">
        🌙 / ☀️
      </button>
    </div>

    <!-- ملخص العدادات الحية -->
    <div class="grid grid-cols-2 gap-3">
      
      <!-- أعطال مفتوحة -->
      <div class="bg-[#1E293B] border border-gray-800 p-3.5 rounded-2xl flex items-center justify-between shadow-md">
        <div>
          <span class="text-[11px] text-gray-400 block mb-0.5">أعطال مفتوحة</span>
          <span class="text-xl font-bold text-amber-400">${stats.open}</span>
        </div>
        <div class="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center text-lg">
          🟡
        </div>
      </div>

      <!-- تم إصلاحها -->
      <div class="bg-[#1E293B] border border-gray-800 p-3.5 rounded-2xl flex items-center justify-between shadow-md">
        <div>
          <span class="text-[11px] text-gray-400 block mb-0.5">تم إصلاحها</span>
          <span class="text-xl font-bold text-emerald-400">${stats.closed}</span>
        </div>
        <div class="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-lg">
          🟢
        </div>
      </div>

      <!-- أعطال اليوم -->
      <div class="bg-[#1E293B] border border-gray-800 p-3.5 rounded-2xl flex items-center justify-between shadow-md">
        <div>
          <span class="text-[11px] text-gray-400 block mb-0.5">أعطال اليوم</span>
          <span class="text-xl font-bold text-blue-400">${stats.today}</span>
        </div>
        <div class="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center text-lg">
          📅
        </div>
      </div>

      <!-- إجمالي البلاغات -->
      <div class="bg-[#1E293B] border border-gray-800 p-3.5 rounded-2xl flex items-center justify-between shadow-md">
        <div>
          <span class="text-[11px] text-gray-400 block mb-0.5">إجمالي البلاغات</span>
          <span class="text-xl font-bold text-purple-400">${stats.total}</span>
        </div>
        <div class="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center text-lg">
          📊
        </div>
      </div>

    </div>

    <!-- الوصول السريع -->
    <div class="space-y-2">
      <h3 class="text-xs font-bold text-gray-400 px-1">الوصول السريع</h3>
      <div class="grid grid-cols-2 gap-3">
        <button 
          onclick="window.navigateTo('issue')" 
          class="bg-[#1E293B] hover:bg-[#283548] border border-gray-800 hover:border-red-500/40 p-3 rounded-xl flex items-center gap-3 text-right transition active:scale-95 shadow-md">
          <span class="text-xl">🚨</span>
          <div>
            <div class="font-bold text-xs text-white">إبلاغ عن عطل</div>
            <div class="text-[10px] text-gray-400">تسجيل بلاغ جديد</div>
          </div>
        </button>

        <button 
          onclick="window.navigateTo('ai')" 
          class="bg-[#1E293B] hover:bg-[#283548] border border-gray-800 hover:border-indigo-500/40 p-3 rounded-xl flex items-center gap-3 text-right transition active:scale-95 shadow-md">
          <span class="text-xl">🤖</span>
          <div>
            <div class="font-bold text-xs text-white">فحص الذكاء الاصطناعي</div>
            <div class="text-[10px] text-gray-400">تحليل عيوب الإنتاج</div>
          </div>
        </button>
      </div>
    </div>

    <!-- الرسم البياني الرئيسي -->
    <div class="bg-[#1E293B] border border-gray-800 p-4 rounded-2xl space-y-3 shadow-md">
      <div class="flex items-center justify-between border-b border-gray-800 pb-2">
        <span class="text-xs font-bold text-gray-200">تحليل الأداء والأعطال</span>
        <span class="text-[10px] text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">تحديث أسبوعي</span>
      </div>
      <div style="height: 180px;">
        <canvas id="mainChart"></canvas>
      </div>
    </div>

    <!-- حقوق الملكية والتواصل عبر واتساب والوصول السريع -->
    <div class="pt-4 border-t border-gray-800/80 text-center space-y-3">
      
      <!-- زر التواصل مع المطور -->
      <button 
        onclick="window.open('${waUrl}', '_blank')" 
        class="w-full bg-[#1E293B] hover:bg-[#283548] border border-gray-800 hover:border-green-500/40 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-gray-300 hover:text-white transition active:scale-95 shadow-md">
        <span class="text-green-500">📱</span>
        <span>تواصل مع المطور</span>
      </button>

      <!-- زر تسجيل الخروج (تمت إضافته هنا) -->
      <button 
        onclick="if(confirm('هل أنت متأكد من رغبتك في تسجيل الخروج؟')) { localStorage.clear(); window.location.reload(); }" 
        class="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-red-400 hover:text-red-300 transition active:scale-95 shadow-md">
        <span>🚪</span>
        <span>تسجيل الخروج</span>
      </button>

      <!-- حقوق الملكية -->
      <p class="text-[10px] text-gray-500 font-medium tracking-wide">
        جميع الحقوق محفوظة بواسطة <span class="text-gray-300 font-semibold">Mohamed Hussein</span> © ${new Date().getFullYear()}
      </p>
    </div>

  </div>

  ${BottomNav("home")}
  `;
};
