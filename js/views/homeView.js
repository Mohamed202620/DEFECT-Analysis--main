// js/views/homeView.js
const HomeViewModule = {
  render: (data) => {
    const userRole = localStorage.getItem('role') || 'prod_tech';
    const t = translations[currentLang];

    return `
      <div class="app-header">
        <div class="text-xs font-bold flex items-center gap-2">
          <img src="1000230635.png" class="w-6 h-6 object-contain rounded"/>
          <span>👋 ${t.welcome} ${localStorage.getItem('name') || ''}</span>
        </div>
        <div class="flex gap-1.5 items-center">
          <button class="btn-icon" onclick="toggleLanguage()">${t.langBtn}</button>
          <button class="btn-icon" onclick="toggleDarkMode()">🌙</button>
        </div>
      </div>

      <div class="p-4 max-w-md mx-auto">
        <!-- Dashboard Summary -->
        <div class="dashboard-card">
          <div class="flex justify-between items-center text-xs font-bold mb-3">
            <span>${t.dashTitle}</span>
            <span class="opacity-60">${t.today}</span>
          </div>
          <div class="grid grid-cols-4 gap-2 text-center mb-3">
            <div class="bg-[#0E1117] p-2 rounded-lg border border-gray-800">
              <div class="text-lg font-bold text-orange-500">${dashboardData.open || 0}</div>
              <div class="text-[10px] opacity-70">مفتوحة</div>
            </div>
            <div class="bg-[#0E1117] p-2 rounded-lg border border-gray-800">
              <div class="text-lg font-bold text-blue-500">${dashboardData.today || 0}</div>
              <div class="text-[10px] opacity-70">اليوم</div>
            </div>
            <div class="bg-[#0E1117] p-2 rounded-lg border border-gray-800">
              <div class="text-lg font-bold text-green-500">${dashboardData.closed || 0}</div>
              <div class="text-[10px] opacity-70">مغلقة</div>
            </div>
            <div class="bg-[#0E1117] p-2 rounded-lg border border-gray-800">
              <div class="text-lg font-bold text-purple-500">${dashboardData.total || 0}</div>
              <div class="text-[10px] opacity-70">الإجمالي</div>
            </div>
          </div>
        </div>

        <!-- 1️⃣ قسم الصيانة والمهام (الأزرار الخمسة المحدثة) -->
        <div class="text-xs font-bold text-blue-400 mb-2">🛠️ قسم الصيانة والمهام</div>
        <div class="grid grid-cols-2 gap-2.5 mb-4">
          ${ActionBtn('🚨', '1. تسجيل عطل / ملاحظة', 'report')}
          ${ActionBtn('💡', '2. تسجيل اقتراح جديد', 'suggestion')}
          <div class="col-span-2">${ActionBtn('🛠️', '3. أعمال الصيانة الوقائية PM', 'pm')}</div>
          <div class="col-span-2">${ActionBtn('📊', '4. استخراج التقارير', 'reports')}</div>
          <div class="col-span-2">${ActionBtn('📱', '5. مسح QR الماكينة', 'qr')}</div>
        </div>

        <!-- قسم العيوب النمطية -->
        <div class="text-xs font-bold text-blue-400 mb-2">${t.secDefects}</div>
        <div class="grid grid-cols-2 gap-2.5 mb-4">
          ${ActionBtn('📷', t.d1, 'defect')}
          ${ActionBtn('🤖', t.d2, 'ai')}
          ${ActionBtn('📚', t.d3, 'kb')}
          ${ActionBtn('📊', t.d4, 'stats')}
        </div>

        ${userRole === 'admin' ? `
          <div class="text-xs font-bold text-blue-400 mb-2">👥 إدارة المستخدمين</div>
          <div class="grid grid-cols-2 gap-2.5 mb-4">
            ${ActionBtn('⚙️', 'إدارة المستخدمين', 'users')}
            ${ActionBtn('📥', 'طلبات التسجيل', 'requests')}
          </div>
        ` : ''}
      </div>
    `;
  }
};