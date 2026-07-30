export const HomeView = () => {
  const t = translations[currentLang];
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const savedName = localStorage.getItem("name") || user.name || "مستخدم";
  const savedRole = localStorage.getItem("role") || user.role || "tech";

  const roleName =
      savedRole === "admin"
      ? (currentLang === "ar" ? "(مدير)" : "(Admin)")
      : savedRole === "engineer"
      ? (currentLang === "ar" ? "(مهندس)" : "(Engineer)")
      : (currentLang === "ar" ? "(فني)" : "(Technician)");

  return `
  <div class="app-header">
    <div class="text-xs font-bold flex items-center gap-2">
      <img src="1000230635.png" class="w-6 h-6 object-contain rounded"/>
      <span>
        👋 ${t.welcome}
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
      <button class="btn-icon" onclick="toggleLanguage()">${t.langBtn}</button>
      <button class="btn-icon" onclick="toggleDarkMode()">🌙</button>
    </div>
  </div>

  <div class="p-4 max-w-md mx-auto">
    <div class="dashboard-card">
      <div class="flex justify-between items-center text-xs font-bold mb-3">
        <span>${t.dashTitle}</span>
        <span class="opacity-60">${t.today}</span>
      </div>
      <div class="grid grid-cols-4 gap-2 text-center mb-3">
        <div class="bg-[#0E1117] p-2 rounded-lg border border-gray-800">
          <div class="text-lg font-bold text-orange-500">
            ${dashboardData.open}
          </div>
          <div class="text-[10px] opacity-70">${t.openTickets}</div>
        </div>
        <div class="bg-[#0E1117] p-2 rounded-lg border border-gray-800">
          <div class="text-lg font-bold text-red-500">
            ${dashboardData.closed}
          </div>
          <div class="text-[10px] opacity-70">تم الإصلاح</div>
        </div>
        <div class="bg-[#0E1117] p-2 rounded-lg border border-gray-800">
          <div class="text-lg font-bold text-blue-500">
            ${dashboardData.today}
          </div>
          <div class="text-[10px] opacity-70">${t.todayDefects}</div>
        </div>
        <div class="bg-[#0E1117] p-2 rounded-lg border border-gray-800">
          <div class="text-lg font-bold text-green-500">
            ${dashboardData.total}
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

    <div class="text-xs font-bold text-blue-400 mb-2">${t.secMaint}</div>
    <div class="grid grid-cols-2 gap-2.5 mb-4">
      ${ActionBtn('🚨', t.m1, 'report')}
      ${ActionBtn('📝', t.m2, 'pm')}
      ${ActionBtn('📋', t.m3, 'log')}
      ${ActionBtn('🗓️', t.m4, 'schedule')}
      <div class="col-span-2">${ActionBtn('📱', t.m5, 'qr')}</div>
    </div>

    <div class="text-xs font-bold text-blue-400 mb-2">${t.secDefects}</div>
    <div class="grid grid-cols-2 gap-2.5 mb-4">
      ${ActionBtn('📷', t.d1, 'defect')}
      ${ActionBtn('🤖', t.d2, 'ai')}
      ${ActionBtn('📚', t.d3, 'kb')}
      ${ActionBtn('📊', t.d4, 'stats')}
      <div class="col-span-2">${ActionBtn('📄', t.d5, 'reports')}</div>
    </div>

    ${savedRole === 'admin' ? `
      <div class="text-xs font-bold text-blue-400 mb-2">${t.secUsers}</div>
      ${ActionBtn('⚙️', t.u1, 'users')}
    ` : ''}
  </div>

  <footer class="text-center p-4 text-[11px] opacity-60 border-t border-gray-800 mt-6 space-y-2">
    <button
      onclick="contactSupport()"
      class="w-full py-3 bg-green-600 hover:bg-green-700 active:scale-95 rounded-xl font-bold text-xs text-white transition shadow-lg">
      💬 تواصل مع الدعم الفني والتطوير