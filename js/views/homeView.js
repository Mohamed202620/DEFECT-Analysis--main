import { translations } from '../config.js';
import { BottomNav } from "../components/BottomNav.js";

// دالة أزرار الوصول السريع المربوطة بالمتغيرات الديناميكية
const QuickActionBtn = (icon, label, target) => `
  <div class="dyn-btn backdrop-blur-md rounded-2xl p-4 text-center border active:scale-95 transition-all cursor-pointer shadow-sm" onclick="window.navigateTo('${target}')">
    <div class="text-3xl mb-2 drop-shadow-md">${icon}</div>
    <div class="font-bold text-xs">${label}</div>
  </div>
`;

export const HomeView = () => {
  const currentLang = window.currentLang || 'ar';
  const t = translations[currentLang] || translations['ar'];
  
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const savedName = localStorage.getItem("name") || user.name || "مستخدم";
  const savedRole = localStorage.getItem("role") || user.role || "tech";

  const data = window.dashboardData || { open: 0, closed: 0, today: 0, total: 0 };

  const roleName =
      savedRole === "admin"
      ? (currentLang === "ar" ? "مدير" : "Admin")
      : savedRole === "engineer"
      ? (currentLang === "ar" ? "مهندس" : "Engineer")
      : (currentLang === "ar" ? "فني" : "Technician");

  return `
  <!-- ستايل ديناميكي مضمون 100% متوافق مع أي نظام للـ Dark Mode -->
  <style>
    :root {
      --app-header-bg: rgba(255, 255, 255, 0.95);
      --app-card-bg: #ffffff;
      --app-card-inner: #f9fafb;
      --app-btn-bg: #ffffff;
      --app-btn-hover: #f3f4f6;
      --app-border: #e5e7eb;
      --app-text: #1f2937;
      --app-text-muted: #6b7280;
      --app-support-bg: #eff6ff;
      --app-support-border: #bfdbfe;
      --app-support-text: #1d4ed8;
      --app-icon-bg: #f3f4f6;
    }
    
    /* بمجرد تحول الـ body للوضع الليلي، تتغير كل الألوان تلقائياً */
    .dark, body.dark, .dark-mode, [data-theme="dark"] {
      --app-header-bg: rgba(14, 17, 23, 0.9);
      --app-card-bg: rgba(30, 41, 59, 0.4);
      --app-card-inner: rgba(0, 0, 0, 0.2);
      --app-btn-bg: rgba(30, 41, 59, 0.6);
      --app-btn-hover: rgba(255, 255, 255, 0.1);
      --app-border: rgba(255, 255, 255, 0.08);
      --app-text: #f3f4f6;
      --app-text-muted: #9ca3af;
      --app-support-bg: rgba(37, 99, 235, 0.15);
      --app-support-border: rgba(37, 99, 235, 0.3);
      --app-support-text: #93c5fd;
      --app-icon-bg: rgba(255, 255, 255, 0.05);
    }

    /* ربط المتغيرات بالكلاسات */
    .dyn-header { background-color: var(--app-header-bg); border-color: var(--app-border); color: var(--app-text); }
    .dyn-card { background-color: var(--app-card-bg); border-color: var(--app-border); color: var(--app-text); box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
    .dyn-card-inner { background-color: var(--app-card-inner); border-color: var(--app-border); }
    .dyn-btn { background-color: var(--app-btn-bg); border-color: var(--app-border); color: var(--app-text); }
    .dyn-btn:hover { background-color: var(--app-btn-hover); }
    .dyn-text-muted { color: var(--app-text-muted); }
    .dyn-support { background-color: var(--app-support-bg); border-color: var(--app-support-border); color: var(--app-support-text); }
    .dyn-icon { background-color: var(--app-icon-bg); border-color: var(--app-border); color: var(--app-text); }
  </style>

  <!-- الهيدر -->
  <div class="dyn-header flex justify-between items-center p-4 border-b backdrop-blur-xl sticky top-0 z-50 transition-colors duration-300">
    <div class="flex items-center gap-3">
      <img src="1000230635.png" class="w-8 h-8 object-contain rounded-full border shadow-sm" style="border-color: var(--app-border)"/>
      <div class="flex flex-col">
        <span class="text-xs font-bold">👋 ${t.welcome || 'أهلاً'} ${savedName}</span>
        <span class="text-[10px] dyn-text-muted">${roleName}</span>
      </div>
    </div>
    
    <div class="flex gap-2 items-center">
      <button class="dyn-icon w-8 h-8 rounded-full border flex items-center justify-center cursor-pointer hover:opacity-80 transition text-xs font-bold" onclick="window.toggleLanguage()">
        ${t.langBtn || 'EN'}
      </button>
      <button class="dyn-icon w-8 h-8 rounded-full border flex items-center justify-center cursor-pointer hover:opacity-80 transition text-sm" onclick="window.toggleDarkMode()">
        🌙
      </button>
      
      <!-- زر الخروج بلون أحمر خفيف -->
      <button class="w-8 h-8 rounded-full border flex items-center justify-center cursor-pointer hover:bg-red-500 hover:text-white transition-all shadow-sm" 
              style="background-color: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2); color: #ef4444;"
              onclick="window.logout()" title="${t.logout || 'تسجيل الخروج'}">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      </button>
    </div>
  </div>

  <div class="p-4 max-w-md mx-auto pb-28">
    
    <!-- كارت الإحصائيات -->
    <div class="dyn-card backdrop-blur-lg rounded-3xl p-5 border mb-6 transition-colors duration-300">
      <div class="flex justify-between items-center text-xs font-bold mb-5">
        <span>${t.dashTitle || '📊 لوحة المتابعة'}</span>
        <span class="dyn-support px-3 py-1 rounded-full text-[10px] font-bold">${t.today || 'اليوم'}</span>
      </div>
      
      <div class="grid grid-cols-4 gap-2 text-center mb-5">
        <div class="dyn-card-inner p-3 rounded-2xl border transition-colors duration-300">
          <div class="text-xl font-black text-orange-500 drop-shadow-sm">${data.open}</div>
          <div class="text-[9px] dyn-text-muted mt-1">${t.openTickets || 'مفتوحة'}</div>
        </div>
        <div class="dyn-card-inner p-3 rounded-2xl border transition-colors duration-300">
          <div class="text-xl font-black text-red-500 drop-shadow-sm">${data.closed}</div>
          <div class="text-[9px] dyn-text-muted mt-1">إصلاح</div>
        </div>
        <div class="dyn-card-inner p-3 rounded-2xl border transition-colors duration-300">
          <div class="text-xl font-black text-blue-500 drop-shadow-sm">${data.today}</div>
          <div class="text-[9px] dyn-text-muted mt-1">${t.todayDefects || 'العيوب'}</div>
        </div>
        <div class="dyn-card-inner p-3 rounded-2xl border transition-colors duration-300">
          <div class="text-xl font-black text-green-500 drop-shadow-sm">${data.total}</div>
          <div class="text-[9px] dyn-text-muted mt-1">الإجمالي</div>
        </div>
      </div>
      <div style="height: 130px;" class="w-full">
        <canvas id="chartMachines"></canvas>
      </div>
    </div>

    <h3 class="text-sm font-bold mb-3 px-2 flex items-center gap-2" style="color: var(--app-text)">⚡ الوصول السريع</h3>
    <div class="grid grid-cols-3 gap-3 mb-8">
      ${QuickActionBtn('🚨', 'تسجيل عطل', 'maintenance_new')}
      ${QuickActionBtn('📷', 'تصوير عيب', 'quality_new')}
      ${QuickActionBtn('📱', 'مسح QR', 'qr_scan')}
    </div>

    <!-- الفوتر -->
    <div class="flex flex-col items-center space-y-4 mt-6">
      <button
        onclick="window.contactSupport()"
        class="dyn-support flex items-center justify-center gap-2 w-[80%] py-3 rounded-full border text-xs font-bold transition-all backdrop-blur-md shadow-sm cursor-pointer active:scale-95">
        💬 تواصل مع الدعم الفني
      </button>
      
      <div class="text-[10px] dyn-text-muted">
        ${t.copy || 'جميع الحقوق محفوظة'}
      </div>
    </div>
  </div>

  ${BottomNav("home")}
  `;
};
