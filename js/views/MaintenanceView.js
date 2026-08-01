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
