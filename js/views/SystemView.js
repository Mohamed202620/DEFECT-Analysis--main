import { BottomNav } from "../components/BottomNav.js";

export const SystemView = () => `
<div class="p-4 max-w-md mx-auto pb-24 space-y-5 text-white">

  <!-- الهيدر الرئيسي -->
  <div class="flex items-center justify-between border-b border-gray-800 pb-3">
    <div>
      <h2 class="text-base font-bold text-blue-400 flex items-center gap-2">
        <span>👨‍💼</span> إدارة النظام والتحكم
      </h2>
      <p class="text-[11px] text-gray-400 mt-0.5">إدارة الصلاحيات والمعدات وإعدادات التطبيق</p>
    </div>
    <span class="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] px-2.5 py-1 rounded-full font-bold">
      Admin
    </span>
  </div>

  <!-- شبكة الخيارات -->
  <div class="grid grid-cols-2 gap-3.5">

    <!-- إدارة المستخدمين -->
    <div 
      onclick="window.navigateTo('users')" 
      class="bg-[#1E293B] hover:bg-[#283548] border border-gray-800 hover:border-blue-500/40 p-4 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all active:scale-95 shadow-md group">
      <div class="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center text-2xl mb-2 group-hover:scale-110 transition-transform">
        👥
      </div>
      <span class="font-bold text-xs text-gray-100">المستخدمون</span>
      <span class="text-[10px] text-gray-400 mt-1">الصلاحيات والفرق</span>
    </div>

    <!-- إدارة الماكينات -->
    <div 
      onclick="window.navigateTo('machines')" 
      class="bg-[#1E293B] hover:bg-[#283548] border border-gray-800 hover:border-blue-500/40 p-4 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all active:scale-95 shadow-md group">
      <div class="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-2xl mb-2 group-hover:scale-110 transition-transform">
        🏭
      </div>
      <span class="font-bold text-xs text-gray-100">الماكينات</span>
      <span class="text-[10px] text-gray-400 mt-1">المعدات ورموز QR</span>
    </div>

    <!-- إدارة الطلبات -->
    <div 
      onclick="window.navigateTo('requests')" 
      class="bg-[#1E293B] hover:bg-[#283548] border border-gray-800 hover:border-blue-500/40 p-4 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all active:scale-95 shadow-md group">
      <div class="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center text-2xl mb-2 group-hover:scale-110 transition-transform">
        ⏳
      </div>
      <span class="font-bold text-xs text-gray-100">الطلبات</span>
      <span class="text-[10px] text-gray-400 mt-1">الموافقات المعلقة</span>
    </div>

    <!-- إعدادات النظام -->
    <div 
      onclick="window.navigateTo('settings')" 
      class="bg-[#1E293B] hover:bg-[#283548] border border-gray-800 hover:border-blue-500/40 p-4 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all active:scale-95 shadow-md group">
      <div class="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center text-2xl mb-2 group-hover:scale-110 transition-transform">
        ⚙️
      </div>
      <span class="font-bold text-xs text-gray-100">الإعدادات</span>
      <span class="text-[10px] text-gray-400 mt-1">تنسيق وتطبيق النظام</span>
    </div>

  </div>

</div>

${BottomNav("system")}
`;
