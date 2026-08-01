import { translations } from '../config.js';

// دالة إنشاء الأزرار مع التأكد من الربط بـ window لضمان عمل الأزرار
const ActionBtn = (icon, label, target) => `
  <div class="btn-action cursor-pointer" onclick="window.navigateTo('${target}')">
    <span class="text-xl">${icon}</span>
    <span class="text-xs font-semibold mt-1">${label}</span>
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

  // دالة فحص الصلاحية آمنة في حال عدم إتاحة window.can بعد
  const canAccess = (perm) => (typeof window.can === 'function' ? window.can(perm) : true);

  return `
  <div class="app-header">
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
      <span class="btn-icon">
        ${savedRole==="admin"?"👨‍💼 Admin":
        savedRole==="engineer"?"👷 Engineer":"🔧 Technician"}
      </span>
      <button class="btn-icon cursor-pointer" onclick="window.toggleLanguage()">${t.langBtn || 'EN'}</button>
      <button class="btn-icon cursor-pointer" onclick="window.toggleDarkMode()">🌙</button>
    </div>
  </div>

  <!-- تم إضافة pb-28 لمنع غطاء البار السفلي على أزرار الفوتر -->
  <div class="p-4 max-w-md mx-auto pb-28">
    <div class="dashboard-card">
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
          <div class="text-[10px] opacity-70">تم الإصلاح</div>
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
            إجمالي البلاغات
          </div>
        </div>
      </div>
      <div style="height: 130px;">
        <canvas id="chartMachines"></canvas>
      </div>
    </div>

    <!-- قسم الصيانة -->
    <div class="text-xs font-bold text-blue-400 mb-2">
    🛠️ قسم الصيانة والمهام
    </div>

    <div class="grid grid-cols-2 gap-2.5 mb-4">

    ${ActionBtn('🚨','تسجيل عطل أو ملاحظة','issue')}

    ${ActionBtn('💡', isEn ? 'Kaizen Suggestions' : 'نظام كايزن', 'suggestions')}

    ${canAccess("pm") ? ActionBtn('📝','أعمال الصيانة الوقائية PM','pm') : ''}

    ${canAccess("reports") ? ActionBtn('📊','التقارير والتصدير','reports') : ''}

    <div class="col-span-2">
    ${ActionBtn('📱','مسح QR الماكينة','qr')}
    </div>

    </div>

    <!-- قسم تحليل العيوب -->

    <div class="text-xs font-bold text-blue-400 mb-2">
    📦 قسم تحليل عيوب الإنتاج
    </div>

    <div class="grid grid-cols-2 gap-2.5 mb-4">

    ${ActionBtn('📷','تصوير عيب','defect')}

    ${ActionBtn('🤖','اكتشاف العيب','ai')}

    ${ActionBtn('📚','قاعدة المعرفة','kb')}

    ${canAccess("stats") ? ActionBtn('📈','الإحصائيات','stats') : ''}

    </div>

    <!-- الإدارة -->

    ${canAccess("users") ? `

    <div class="text-xs font-bold text-blue-400 mb-2">
    👨‍💼 إدارة النظام
    </div>

    <div class="grid grid-cols-2 gap-2.5">

    ${ActionBtn('👥','المستخدمون','users')}

    ${ActionBtn('🏭','الماكينات','machines')}

    ${ActionBtn('⏳','الطلبات','requests')}

    ${ActionBtn('⚙️','الإعدادات','settings')}

    </div>

    ` : ''}
  </div>

  <footer class="text-center p-4 text-[11px] opacity-60 border-t border-gray-800 mt-6 space-y-2 pb-24">
    <button
      onclick="window.contactSupport()"
      class="w-full py-3 bg-green-600 hover:bg-green-700 active:scale-95 rounded-xl font-bold text-xs text-white transition shadow-lg cursor-pointer">
      💬 تواصل مع الدعم الفني والتطوير
    </button>
    <button onclick="window.logout()" class="w-full py-2 bg-red-600 hover:bg-red-700 active:scale-95 rounded-lg font-bold text-xs text-white transition my-2 cursor-pointer">
      ${t.logout || 'تسجيل الخروج ➔'}
    </button>
    <div>${t.copy || ''}</div>
  </footer>

  <!-- Bottom Navigation (شريط التنقل السفلي المعدل للاستجابة) -->
  <div class="fixed bottom-0 left-0 right-0 bg-[#111827] border-t border-gray-700 z-[999]">
      <div class="grid grid-cols-4 text-center">

          <div onclick="window.navigateTo('home')" class="py-3 text-blue-400 cursor-pointer select-none active:opacity-70">
              <div class="text-xl">🏠</div>
              <div class="text-[11px]">${isEn ? 'Home' : 'الرئيسية'}</div>
          </div>

          <div onclick="window.navigateTo('maintenance')" class="py-3 text-gray-400 hover:text-white cursor-pointer select-none active:opacity-70">
              <div class="text-xl">🛠️</div>
              <div class="text-[11px]">${isEn ? 'Maintenance' : 'الصيانة'}</div>
          </div>

          <div onclick="window.navigateTo('quality')" class="py-3 text-gray-400 hover:text-white cursor-pointer select-none active:opacity-70">
              <div class="text-xl">📦</div>
              <div class="text-[11px]">${isEn ? 'Defects' : 'العيوب'}</div>
          </div>

          ${canAccess("users") ? `
          <div onclick="window.navigateTo('system')" class="py-3 text-gray-400 hover:text-white cursor-pointer select-none active:opacity-70">
              <div class="text-xl">👨‍💼</div>
              <div class="text-[11px]">${isEn ? 'System' : 'الإدارة'}</div>
          </div>
          ` : `
          <div onclick="window.navigateTo('settings')" class="py-3 text-gray-400 hover:text-white cursor-pointer select-none active:opacity-70">
              <div class="text-xl">⚙️</div>
              <div class="text-[11px]">${isEn ? 'Settings' : 'الإعدادات'}</div>
          </div>
          `}

      </div>
  </div>
  `;
};
