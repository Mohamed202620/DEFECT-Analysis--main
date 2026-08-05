export const RegisterView = () => `
<div class="min-h-screen bg-[#0F172A] flex items-center justify-center p-4 text-white" dir="rtl">
  <form 
    onsubmit="event.preventDefault(); window.registerUser();" 
    class="w-full max-w-sm bg-[#1E293B] border border-gray-800 rounded-2xl p-6 shadow-2xl space-y-4"
  >

    <!-- Logo -->
    <div class="flex justify-center">
      <div class="w-20 h-20 bg-[#0F172A] rounded-2xl p-2 border border-gray-700 flex items-center justify-center shadow-inner">
        <img src="1000230635.png" alt="شعار الشركة" class="max-h-full max-w-full object-contain" onerror="this.src='https://cdn-icons-png.flaticon.com/512/1063/1063376.png'"/>
      </div>
    </div>

    <!-- Title -->
    <h2 class="text-xl font-bold text-center text-blue-400">
      إنشاء حساب جديد
    </h2>

    <!-- Name -->
    <input
      id="regName"
      type="text"
      placeholder="الاسم بالكامل"
      required
      class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition text-sm"
    />

    <!-- Phone -->
    <input
      id="regPhone"
      type="tel"
      placeholder="رقم الموبايل"
      required
      class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition text-sm"
    />

    <!-- Shift -->
    <select
      id="regShift"
      required
      class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white focus:outline-none focus:border-blue-500 transition text-sm"
    >
      <option value="" disabled selected class="bg-[#0F172A] text-gray-400">اختر الشيفت</option>
      <option value="Green" class="bg-[#0F172A] text-white">Green</option>
      <option value="Red" class="bg-[#0F172A] text-white">Red</option>
      <option value="Blue" class="bg-[#0F172A] text-white">Blue</option>
    </select>

    <!-- Password -->
    <div class="relative">
      <input
        id="regPass"
        type="password"
        placeholder="كلمة السر"
        required
        class="w-full p-3 pl-12 rounded-lg bg-[#0F172A] border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition text-sm"
      />
      <button
        type="button"
        onclick="
          const p = document.getElementById('regPass');
          const isPass = p.type === 'password';
          p.type = isPass ? 'text' : 'password';
          this.innerHTML = isPass ? '🙈' : '👁';
        "
        class="absolute left-3 top-1/2 -translate-y-1/2 text-xl focus:outline-none text-gray-400"
        aria-label="Toggle password visibility"
      >
        👁
      </button>
    </div>

    <!-- Confirm Password -->
    <div class="relative">
      <input
        id="regPass2"
        type="password"
        placeholder="تأكيد كلمة السر"
        required
        class="w-full p-3 pl-12 rounded-lg bg-[#0F172A] border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition text-sm"
      />
      <button
        type="button"
        onclick="
          const p = document.getElementById('regPass2');
          const isPass = p.type === 'password';
          p.type = isPass ? 'text' : 'password';
          this.innerHTML = isPass ? '🙈' : '👁';
        "
        class="absolute left-3 top-1/2 -translate-y-1/2 text-xl focus:outline-none text-gray-400"
        aria-label="Toggle password visibility"
      >
        👁
      </button>
    </div>

    <!-- Job -->
    <select
      id="regJob"
      required
      class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white focus:outline-none focus:border-blue-500 transition text-sm"
    >
      <option value="" disabled selected class="bg-[#0F172A] text-gray-400">اختر الوظيفة</option>
      <option value="Technician" class="bg-[#0F172A] text-white">Technician</option>
      <option value="Operator" class="bg-[#0F172A] text-white">Operator</option>
      <option value="Maintainer" class="bg-[#0F172A] text-white">Maintainer</option>
      <option value="Group Leader" class="bg-[#0F172A] text-white">Group Leader</option>
      <option value="Supervisor" class="bg-[#0F172A] text-white">Supervisor</option>
      <option value="Manager" class="bg-[#0F172A] text-white">Manager</option>
    </select>

    <!-- Department -->
    <select
      id="regDepartment"
      required
      class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white focus:outline-none focus:border-blue-500 transition text-sm"
    >
      <option value="" disabled selected class="bg-[#0F172A] text-gray-400">اختر القسم</option>
      <option value="Production" class="bg-[#0F172A] text-white">الإنتاج</option>
      <option value="Mechanical" class="bg-[#0F172A] text-white">الميكانيكا</option>
      <option value="Electrical" class="bg-[#0F172A] text-white">الكهرباء</option>
    </select>

    <!-- Code -->
    <input
      id="regCode"
      type="text"
      placeholder="رقم الكود"
      required
      class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition text-sm"
    />

    <!-- Register -->
    <button
      type="submit"
      class="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 rounded-xl font-bold text-white transition-all shadow-lg"
    >
      إنشاء الحساب
    </button>

    <!-- Back -->
    <button
      type="button"
      onclick="window.navigateTo('login')"
      class="w-full py-3 bg-slate-700 hover:bg-slate-600 active:scale-95 rounded-xl font-bold text-white transition-all shadow-md"
    >
      رجوع
    </button>

  </form>
</div>
`;
