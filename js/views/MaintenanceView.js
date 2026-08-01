export const MaintenanceView = () => `
<div class="p-4 max-w-md mx-auto">

<h2 class="text-blue-400 font-bold mb-3">
🛠️ قسم الصيانة
</h2>

<div class="grid grid-cols-2 gap-3">

<div class="btn-action" onclick="window.navigateTo('issue')">
🚨<br>تسجيل عطل
</div>

<div class="btn-action" onclick="window.navigateTo('suggestions')">
💡<br>نظام كايزن
</div>

<div class="btn-action" onclick="window.navigateTo('pm')">
📝<br>الصيانة الوقائية
</div>

<div class="btn-action" onclick="window.navigateTo('reports')">
📊<br>التقارير
</div>

<div class="col-span-2 btn-action" onclick="window.navigateTo('qr')">
📱<br>QR الماكينة
</div>

</div>

</div>
`;
