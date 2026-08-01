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
