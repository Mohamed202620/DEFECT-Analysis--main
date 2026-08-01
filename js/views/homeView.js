import { translations } from '../config.js';

// دالة إنشاء الأزرار مع التأكد من الربط بـ window لضمان عمل الأزرار
const ActionBtn = (icon, label, target) => `
  <div class="btn-action cursor-pointer p-3 bg-[#0E1117] border border-gray-800 rounded-xl flex flex-col items-center justify-center hover:border-blue-500 transition active:scale-95" onclick="window.navigateTo('${target}')">
    <span class="text-2xl mb-1">${icon}</span>
    <span class="text-xs font-semibold text-center">${label}</span>
  </div>
`;

export const HomeView = () => {
  // جلب اللغة الحالية المعتمدة في النظام
  const currentLang = window.currentLang || 'ar';
  const isEn = currentLang === 'en';
  const t = translations[currentLang] || translations['ar'];
  
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const savedName = localStorage.getItem("name") || user.name || "مستخدم";
  const savedRole = localStorage.getItem("role") || user.role || "tech";

  // حماية بيانات الـ Dashboard من الـ Crash
  const data = window.dashboardData || { open: 0, closed: 0, today: 0, total: 0 };

  const roleName =
      savedRole === "admin"
      ? (currentLang === "ar" ? "(مدير)" : "(Admin)")
      : savedRole === "engineer"
      ? (currentLang === "ar" ? "(مهندس)" : "(Engineer)")
      : (currentLang === "ar" ? "(فني)" : "(Technician)");

  return `
  <!-- الهيدر العلوي -->
  <div class="app-header flex justify-between items-center p-3 bg-[#111827] border-b border-gray-800">
    <div class="text-xs font-bold flex items-center gap-2">
      <img src="1000230635.png" class="w-6 h-6 object-contain rounded"/>
      <span>
        👋 ${t.welcome || 'أهلاً:'}
        ${savedName}
        <span class="font-normal opacity-70">
          ${roleName}
        </span>
      </span>
    </div>
    <div class="flex gap-1.5 items-center">
      <span class="btn-icon text-xs bg-gray-800 px-2 py-1 rounded">
        ${savedRole==="admin"?"👨‍💼 Admin":
        savedRole==="engineer"?"👷 Engineer":"🔧 Technician"}
      </span>
      <button class="btn-icon p-1 bg-gray-800 rounded" onclick="window.toggleLanguage()">${t.langBtn || 'EN'}</button>
      <button class="btn-icon p-1 bg-gray-800 rounded" onclick="window.toggleDarkMode()">🌙</button>
    </div>
  </div>

  <!-- محتوى الصفحة الرئيسية -->
  <div class="p-4 max-w-md mx-auto pb-24">
    
    <!-- كارت الإحصائيات -->
    <div class="dashboard-card bg-[#111827] p-3 rounded-xl border border-gray-800 mb-4">
      <div class="flex justify-between items-center text-xs font-bold mb-3">
        <span>${t.dashTitle || '📊 لوحة المتابعة'}</span>
        <span class="opacity-60">${t.today || 'اليوم'}</span>
      </div>
      <div class="grid grid-cols-4 gap-2 text-center mb-3">
        <div class="bg-[#0E1117] p-2 rounded-lg border border-gray-800">
          <div class="text-lg font-bold text-orange-500">
            ${data.open}
          </div>
          <div class="text-[10px] opacity-70">${t.openTickets || 'بلاغات مفتوحة'}</div>
        </div>
        <div class="bg-[#0E1117] p-2 rounded-lg border border-gray-800">
          <div class="text-lg font-bold text-red-500">
            ${data.closed}
          </div>
          <div class="text-[10px] opacity-70">${isEn ? 'Repaired' : 'تم الإصلاح'}</div>
        </div>
        <div class="bg-[#0E1117] p-2 rounded-lg border border-gray-800">
          <div class="text-lg font-bold text-blue-500">
            ${data.today}
          </div>
          <div class="text-[10px] opacity-70">${t.todayDefects || 'عيوب اليوم'}</div>
        </div>
        <div class="bg-[#0E1117] p-2 rounded-lg border border-gray-800">
          <div class="text-lg font-bold text-green-500">
            ${data.total}
          </div>
          <div class="text-[10px] opacity-70">
            ${isEn ? 'Total Tickets' : 'إجمالي البلاغات'}
          </div>
        </div>
      </div>
      <div style="height: 130px;">
        <canvas id="chartMachines"></canvas>
      </div>
    </div>

    <!-- أزرار الإجراءات السريعة الهامة فقط -->
    <div class="text-xs font-bold text-blue-400 mb-2">
      ⚡ ${isEn ? 'Quick Actions' : 'إجراءات سريعة'}
    </div>

    <div class="grid grid-cols-2 gap-2.5 mb-4">
      ${ActionBtn('🚨', isEn ? 'Report Issue' : 'تسجيل عطل أو ملاحظة', 'issue')}
      ${ActionBtn('📷', isEn ? 'Capture Defect' : 'تصوير عيب', 'defect')}
      
      <div class="col-span-2">
        ${ActionBtn('📱', isEn ? 'Scan Machine QR' : 'مسح QR الماكينة', 'qr')}
      </div>
    </div>

    <!-- الفوتر مع زر التواصل والدعم -->
    <footer class="text-center p-4 text-[11px] opacity-60 border-t border-gray-800 mt-6 space-y-2">
      <button
        onclick="window.contactSupport()"
        class="w-full py-3 bg-green-600 hover:bg-green-700 active:scale-95 rounded-xl font-bold text-xs text-white transition shadow-lg">
        💬 ${isEn ? 'Contact Support & Development' : 'تواصل مع الدعم الفني والتطوير'}
      </button>
      <button onclick="window.logout()" class="w-full py-2 bg-red-600 hover:bg-red-700 active:scale-95 rounded-lg font-bold text-xs text-white transition my-2">
        ${t.logout || 'تسجيل الخروج ➔'}
      </button>
      <div>${t.copy || ''}</div>
    </footer>
  </div>

  <!-- Bottom Navigation (شريط التنقل السفلي الثابت) -->
  <div class="fixed bottom-0 left-0 right-0 bg-[#111827] border-t border-gray-700 z-50">
      <div class="grid grid-cols-4 text-center">
          <button onclick="window.navigateTo('home')" class="py-2.5 text-blue-400 flex flex-col items-center justify-center">
              <div class="text-xl">🏠</div>
              <div class="text-[10px] font-medium">${isEn ? 'Home' : 'الرئيسية'}</div>
          </button>

          <button onclick="window.navigateTo('maintenance')" class="py-2.5 text-gray-400 hover:text-white flex flex-col items-center justify-center">
              <div class="text-xl">🛠️</div>
              <div class="text-[10px] font-medium">${isEn ? 'Maintenance' : 'الصيانة'}</div>
          </button>

          <button onclick="window.navigateTo('quality')" class="py-2.5 text-gray-400 hover:text-white flex flex-col items-center justify-center">
              <div class="text-xl">📦</div>
              <div class="text-[10px] font-medium">${isEn ? 'Defects' : 'العيوب'}</div>
          </button>

          <button onclick="window.navigateTo('system')" class="py-2.5 text-gray-400 hover:text-white flex flex-col items-center justify-center">
              <div class="text-xl">👨‍💼</div>
              <div class="text-[10px] font-medium">${isEn ? 'System' : 'الإدارة'}</div>
          </button>
      </div>
  </div>
  `;
};
