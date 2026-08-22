import { BottomNav } from "../components/BottomNav.js";

export const MaintenanceView = () => `
<div class="p-4 max-w-md mx-auto pb-24 space-y-5 text-white">

  <!-- الهيدر الرئيسي -->
  <div class="flex items-center justify-between border-b border-gray-800 pb-3">
    <div>
      <h2 class="text-base font-bold text-blue-400 flex items-center gap-2">
        <span>🛠️</span> قسم الصيانة
      </h2>
      <p class="text-[11px] text-gray-400 mt-0.5">إدارة بلاغات الأعطال وصيانة المعدات</p>
    </div>
    <span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] px-2.5 py-1 rounded-full font-bold">
      الورشة
    </span>
  </div>

  <!-- شبكة الإجراءات السريعة -->
  <div class="grid gap-3.5" style="grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));">

    <!-- تسجيل عطل -->
    <div 
      onclick="window.navigateTo('issue')" 
      class="bg-[#1E293B] hover:bg-[#283548] border border-gray-800 hover:border-red-500/40 p-4 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all active:scale-95 shadow-md group">
      <div class="w-12 h-12 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center text-2xl mb-2 group-hover:scale-110 transition-transform">
        🚨
      </div>
      <span class="font-bold text-xs text-gray-100">تسجيل عطل</span>
      <span class="text-[10px] text-gray-400 mt-1">إبلاغ سريع عن توقف</span>
    </div>

    <!-- متابعة البلاغات (دورة حياة التذكرة) -->
    <div 
      onclick="window.navigateTo('tickets')" 
      class="bg-[#1E293B] hover:bg-[#283548] border border-gray-800 hover:border-emerald-500/40 p-4 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all active:scale-95 shadow-md group">
      <div class="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-2xl mb-2 group-hover:scale-110 transition-transform">
        📋
      </div>
      <span class="font-bold text-xs text-gray-100">متابعة البلاغات</span>
      <span class="text-[10px] text-gray-400 mt-1">تصنيف، إسناد، فحص وإغلاق</span>
    </div>

    <!-- نظام كايزن -->
    <div 
      onclick="window.navigateTo('suggestions')" 
      class="bg-[#1E293B] hover:bg-[#283548] border border-gray-800 hover:border-amber-500/40 p-4 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all active:scale-95 shadow-md group">
      <div class="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center text-2xl mb-2 group-hover:scale-110 transition-transform">
        💡
      </div>
      <span class="font-bold text-xs text-gray-100">نظام كايزن</span>
      <span class="text-[10px] text-gray-400 mt-1">مقترحات التحسين المستمر</span>
    </div>

    <!-- متابعة الكايزن (مراجعة واعتماد المقترحات) -->
    <div 
      onclick="window.navigateTo('kaizenBoard')" 
      class="bg-[#1E293B] hover:bg-[#283548] border border-gray-800 hover:border-amber-500/40 p-4 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all active:scale-95 shadow-md group">
      <div class="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center text-2xl mb-2 group-hover:scale-110 transition-transform">
        💡
      </div>
      <span class="font-bold text-xs text-gray-100">متابعة الكايزن</span>
      <span class="text-[10px] text-gray-400 mt-1">مراجعة واعتماد المقترحات</span>
    </div>

    <!-- Machine Error Scanner (زر عريض بارز) -->
    <div 
      onclick="window.navigateTo('errorScanner')" 
      class="col-span-2 bg-[#1E293B] hover:bg-[#283548] border border-gray-800 hover:border-indigo-500/40 p-4 rounded-2xl flex items-center justify-between cursor-pointer transition-all active:scale-98 shadow-md group">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
          🔎
        </div>
        <div class="text-right">
          <span class="font-bold text-xs text-gray-100 block">Machine Error Scanner</span>
          <span class="text-[10px] text-gray-400">تصوير شاشة العطل والبحث عنه تلقائياً</span>
        </div>
      </div>
      <span class="text-xs text-indigo-400 font-bold bg-indigo-500/10 px-3 py-1 rounded-lg border border-indigo-500/20 shadow-sm">
        مسح 📷
      </span>
    </div>

    <!-- QR الماكينة (زر عريض بارز) -->
    <div 
      onclick="window.navigateTo('qr')" 
      class="col-span-2 bg-[#1E293B] hover:bg-[#283548] border border-gray-800 hover:border-emerald-500/40 p-4 rounded-2xl flex items-center justify-between cursor-pointer transition-all active:scale-98 shadow-md group">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
          📱
        </div>
        <div class="text-right">
          <span class="font-bold text-xs text-gray-100 block">مسح QR الماكينات</span>
          <span class="text-[10px] text-gray-400">وصول سريع لبيانات المعدة بالكاميرا</span>
        </div>
      </div>
      <span class="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20 shadow-sm">
        مسح 📷
      </span>
    </div>

  </div>

</div>

${BottomNav("maintenance")}
`;
