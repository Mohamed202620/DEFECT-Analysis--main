import { BottomNav } from "../components/BottomNav.js";

export const SystemView = () => `
<div class="p-4 max-w-md mx-auto">

<h2 class="text-blue-400 font-bold mb-3">
👨‍💼 إدارة النظام
</h2>

<div class="grid grid-cols-2 gap-3">

<div class="btn-action" onclick="window.navigateTo('users')">
👥<br>المستخدمون
</div>

<div class="btn-action" onclick="window.navigateTo('machines')">
🏭<br>الماكينات
</div>

<div class="btn-action" onclick="window.navigateTo('requests')">
⏳<br>الطلبات
</div>

<div class="btn-action" onclick="window.navigateTo('settings')">
⚙️<br>الإعدادات
</div>

</div>

</div>

<div style="height:80px"></div>

${BottomNav("system")}
`;
