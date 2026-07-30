export const HomeViewModule = {
  render: () => {
    const userName = localStorage.getItem('name') || 'مستخدم';
    const userRole = localStorage.getItem('role') || 'فني';

    return `
      <div class="app-header">
        <div class="text-xs font-bold flex items-center gap-2">
          <img src="1000230635.png" class="w-6 h-6 object-contain rounded"/>
          <span>👋 أهلاً: ${userName} (${userRole})</span>
        </div>
      </div>

      <div class="p-4 max-w-md mx-auto">
        <!-- قسم الصيانة والمهام المحدث (الأزرار الـ 5 المطلوبة) -->
        <div class="text-xs font-bold text-blue-400 mb-2">🛠️ قسم الصيانة والمهام</div>
        <div class="grid grid-cols-2 gap-2.5 mb-4">
          
          <div class="btn-action" onclick="navigateTo('report')">
            <span class="text-xl">🚨</span>
            <span class="text-xs font-bold">1. تسجيل عطل / ملاحظة</span>
          </div>

          <div class="btn-action" onclick="navigateTo('suggestion')">
            <span class="text-xl">💡</span>
            <span class="text-xs font-bold">2. تسجيل اقتراح جديد</span>
          </div>

          <div class="btn-action col-span-2" onclick="navigateTo('pm')">
            <span class="text-xl">🛠️</span>
            <span class="text-xs font-bold">3. أعمال الصيانة الوقائية PM</span>
          </div>

          <div class="btn-action col-span-2" onclick="navigateTo('reports')">
            <span class="text-xl">📊</span>
            <span class="text-xs font-bold">4. استخراج التقارير</span>
          </div>

          <div class="btn-action col-span-2" onclick="navigateTo('qr')">
            <span class="text-xl">📱</span>
            <span class="text-xs font-bold">5. مسح QR الماكينة</span>
          </div>

        </div>
      </div>
    `;
  }
};
