import { BottomNav } from "../components/BottomNav.js";

export const SystemView = () => {
  const permissions =
    (localStorage.getItem("permissions") || "")
      .split(",")
      .map(p => p.trim());

  const isAdmin =
    (localStorage.getItem("role") || "") === "admin";

  const can = (permission) =>
    isAdmin || permissions.includes("all") || permissions.includes(permission);

  return `
<div class="p-4 max-w-md mx-auto pb-24 space-y-5 text-white">

  <!-- الهيدر الرئيسي -->
  <div class="flex items-center justify-between border-b border-gray-800 pb-3">

    <div>
      <h2 class="text-base font-bold text-blue-400 flex items-center gap-2">
        <span>👨‍💼</span>
        إدارة النظام والتحكم
      </h2>
      <p class="text-[11px] text-gray-400 mt-0.5">
        إدارة المستخدمين والصلاحيات وإعدادات التطبيق
      </p>
    </div>

    <span class="
      bg-blue-500/10
      text-blue-400
      border
      border-blue-500/20
      text-[10px]
      px-2.5
      py-1
      rounded-full
      font-bold
    ">
      ${(localStorage.getItem("role") || "user").toUpperCase()}
    </span>

  </div>

  <!-- شبكة الخيارات -->
  <div class="grid grid-cols-2 gap-3.5">

    ${can("users") ? `
    <div
      onclick="window.navigateTo('users')"
      class="bg-[#1E293B] hover:bg-[#283548] border border-gray-800 hover:border-blue-500/40 p-4 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all active:scale-95 shadow-md group">

      <div class="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center text-2xl mb-2">
        👥
      </div>

      <span class="font-bold text-xs text-gray-100">
        المستخدمون
      </span>

      <span class="text-[10px] text-gray-400 mt-1">
        إدارة الحسابات والصلاحيات
      </span>

    </div>
    ` : ""}

    ${can("requests") ? `
    <div
      onclick="window.navigateTo('requests')"
      class="bg-[#1E293B] hover:bg-[#283548] border border-gray-800 hover:border-amber-500/40 p-4 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all active:scale-95 shadow-md group">

      <div class="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center text-2xl mb-2">
        ⏳
      </div>

      <span class="font-bold text-xs text-gray-100">
        طلبات الانضمام
      </span>

      <span class="text-[10px] text-gray-400 mt-1">
        مراجعة المستخدمين الجدد
      </span>

    </div>
    ` : ""}

    ${can("machines") ? `
    <div
      onclick="alert('🚧 قريباً')"
      class="bg-[#1E293B] hover:bg-[#283548] border border-gray-800 hover:border-emerald-500/40 p-4 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all active:scale-95 shadow-md group">

      <div class="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-2xl mb-2">
        🏭
      </div>

      <span class="font-bold text-xs text-gray-100">
        الماكينات
      </span>

      <span class="text-[10px] text-gray-400 mt-1">
        إدارة المعدات و QR
      </span>

    </div>
    ` : ""}

    ${can("settings") ? `
    <div
      onclick="alert('⚙️ قريباً')"
      class="bg-[#1E293B] hover:bg-[#283548] border border-gray-800 hover:border-purple-500/40 p-4 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all active:scale-95 shadow-md group">

      <div class="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center text-2xl mb-2">
        ⚙️
      </div>

      <span class="font-bold text-xs text-gray-100">
        الإعدادات
      </span>

      <span class="text-[10px] text-gray-400 mt-1">
        إعدادات النظام
      </span>

    </div>
    ` : ""}

  </div>

</div>

${BottomNav("system")}
  `;
};
