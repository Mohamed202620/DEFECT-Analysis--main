export const QualityView = () => `
<div class="p-4 max-w-md mx-auto">

<h2 class="text-blue-400 font-bold mb-3">
📦 تحليل العيوب
</h2>

<div class="grid grid-cols-2 gap-3">

<div class="btn-action" onclick="window.navigateTo('defect')">
📷<br>تصوير عيب
</div>

<div class="btn-action" onclick="window.navigateTo('ai')">
🤖<br>اكتشاف العيب
</div>

<div class="btn-action" onclick="window.navigateTo('kb')">
📚<br>قاعدة المعرفة
</div>

<div class="btn-action" onclick="window.navigateTo('stats')">
📈<br>الإحصائيات
</div>

</div>

</div>
`;
