import { translations } from '../config.js';
import { BottomNav } from "../components/BottomNav.js";

// دالة مخصصة لإنشاء أزرار "الوصول السريع" بلمسة زجاجية (Glassmorphism)
const QuickActionBtn = (icon, label, target) => `
  <div class="bg-[#1E293B]/60 backdrop-blur-md rounded-2xl p-4 text-center border border-white/10 active:scale-95 transition-all cursor-pointer hover:bg-white/10 shadow-sm" onclick="window.navigateTo('${target}')">
    <div class="text-3xl mb-2 drop-shadow-md">${icon}</div>
    <div class="font-bold text-xs text-gray-200">${label}</div>
  </div>
`;

export const HomeView = () => {
  // جلب اللغة الحالية المعتمدة في النظام
  const currentLang = window.currentLang || 'ar';
  const t = translations[currentLang] || translations['ar'];
  
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const savedName = localStorage.getItem("name") || user.name || "مستخدم";
  const savedRole = localStorage.getItem("role") || user.role || "tech";

  // حماية بيانات الـ Dashboard
  const data = window.dashboardData || { open: 0, closed: 0, today: 0, total: 0 };

  const roleName =
      savedRole === "admin"
      ? (currentLang === "ar" ? "مدير" : "Admin")
      : savedRole === "engineer"
      ? (currentLang === "ar" ? "مهندس" : "Engineer")
      : (currentLang === "ar" ? "فني" : "Technician");

  return `
  <!-- الهيدر الجديد: نظيف، يحتوي على زر الخروج، اللغة، والوضع الليلي -->
  <div class="flex justify-between items-center p-4 border-b border-white/10 bg-[#0E1117]/80 backdrop-blur-xl sticky top-0 z-50">
    <div class="flex items-center gap-3">
      <img src="1000230635.png" class="w-8 h-8 object-contain rounded-full border border-white/20 shadow-sm"/>
      <div class="flex flex-col">
        <span class="text-xs font-bold text-gray-100">👋 ${t.welcome || 'أهلاً'} ${savedName}</span>
        <span class="text-[10px] text-gray-400">${roleName}</span>
      </div>
    </div>
    
    <div class="flex gap-2 items-center">
      <!-- زر اللغة -->
      <button class="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center cursor-pointer hover:bg-white/10 transition text-xs font-bold" onclick="window.toggleLanguage()">
        ${t.langBtn || 'EN'}
      </button>
      <!-- زر الوضع الليلي -->
      <button class="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center cursor-pointer hover:bg-white/10 transition text-sm" onclick="window.toggleDarkMode()">
        🌙
      </button>
      <!-- زر تسجيل الخروج (انتقل للأعلى) -->
      <button class="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center cursor-pointer hover:bg-red-500/20 transition text-sm" onclick="window.logout()" title="${t.logout || 'تسجيل الخروج'}">
        🚪
      </button>
    </div>
  </div>

  <div class="p-4 max-w-md mx-auto pb-28"> <!-- مسافة سفلية لحماية المحتوى من شريط الـ BottomNav العائم -->
    
    <!-- كارت الإحصائيات (بلمسة عصرية وتأثير نيون خفيف) -->
    <div class="bg-[#1E293B]/40 backdrop-blur-lg rounded-3xl p-5 border border-white/5 mb-6 shadow-lg">
      <div class="flex justify-between items-center text-xs font-bold mb-5">
        <span class="text-gray-200">${t.dashTitle || '📊 لوحة المتابعة'}</span>
        <span class="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-[10px]">${t.today || 'اليوم'}</span>
      </div>
      
      <div class="grid grid-cols-4 gap-2 text-center mb-5">
        <div class="bg-black/20 p-3 rounded-2xl border border-white/5">
          <div class="text-xl font-black text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]">${data.open}</div>
          <div class="text-[9px] text-gray-400 mt-1">${t.openTickets || 'مفتوحة'}</div>
        </div>
        <div class="bg-black/20 p-3 rounded-2xl border border-white/5">
          <div class="text-xl font-black text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]">${data.closed}</div>
          <div class="text-[9px] text-gray-400 mt-1">إصلاح</div>
        </div>
        <div class="bg-black/20 p-3 rounded-2xl border border-white/5">
          <div class="text-xl font-black text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]">${data.today}</div>
          <div class="text-[9px] text-gray-400 mt-1">${t.todayDefects || 'العيوب'}</div>
        </div>
        <div class="bg-black/20 p-3 rounded-2xl border border-white/5">
          <div class="text-xl font-black text-green-500 drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]">${data.total}</div>
          <div class="text-[9px] text-gray-400 mt-1">الإجمالي</div>
        </div>
      </div>
      
      <div style="height: 130px;" class="w-full">
        <canvas id="chartMachines"></canvas>
      </div>
    </div>

    <!-- قسم الوصول السريع (بديل الكروت المكررة) -->
    <h3 class="text-sm font-bold mb-3 text-gray-300 px-2">⚡ الوصول السريع</h3>
    <div class="grid grid-cols-3 gap-3 mb-8">
      ${QuickActionBtn('🚨', 'تسجيل عطل', 'maintenance_new')}
      ${QuickActionBtn('📷', 'تصوير عيب', 'quality_new')}
      ${QuickActionBtn('📱', 'مسح QR', 'qr_scan')}
    </div>

    <!-- الفوتر الجديد (خفيف وأنيق بدون كتل ضخمة) -->
    <div class="flex flex-col items-center space-y-4 mt-4">
      <button
        onclick="window.contactSupport()"
        class="flex items-center justify-center gap-2 w-[80%] py-3 bg-white/5 hover:bg-white/10 active:scale-95 rounded-full border border-white/10 text-xs font-semibold text-gray-300 transition-all backdrop-blur-sm shadow-sm cursor-pointer">
        💬 تواصل مع الدعم الفني
      </button>
      
      <div class="text-[10px] text-gray-500 opacity-60">
        ${t.copy || 'جميع الحقوق محفوظة'}
      </div>
    </div>

  </div>

  <!-- استدعاء الشريط السفلي العائم (يفترض أن تصميمه في ملفه الخاص أصبح عائماً) -->
  ${BottomNav("home")}
  `;
};
