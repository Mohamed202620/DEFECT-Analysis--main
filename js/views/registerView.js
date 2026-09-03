import { translations } from "../config.js";

export const RegisterView = () => {
  const currentLang = window.currentLang || "ar";
  const t = (translations[currentLang] || translations.ar).register;
  const dir = currentLang === "ar" ? "rtl" : "ltr";

  return `
<div class="min-h-screen bg-[#0F172A] flex items-center justify-center p-4 text-white py-8" dir="${dir}">
  <form 
    onsubmit="event.preventDefault(); window.registerUser();" 
    class="w-full max-w-sm bg-[#1E293B] border border-gray-800 rounded-2xl p-6 shadow-2xl space-y-4"
  >

    <!-- Logo -->
    <div class="flex justify-center mb-2">
      <div class="w-20 h-20 bg-[#0F172A] rounded-2xl p-2 border border-gray-700 flex items-center justify-center shadow-inner">
        <img src="assets/icons/app-icon.png" alt="شعار الشركة" class="max-h-full max-w-full object-contain" onerror="this.src='https://cdn-icons-png.flaticon.com/512/1063/1063376.png'"/>
      </div>
    </div>

    <!-- Title -->
    <h2 class="text-xl font-bold text-center text-blue-400 mb-4">
      ${t.title}
    </h2>

    <!-- Name -->
    <div>
      <label for="regName" class="block text-xs font-bold mb-1 text-gray-300">${t.fullName}</label>
      <input
        id="regName"
        type="text"
        autocomplete="name"
        placeholder="${t.fullName}"
        required
        class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition text-sm shadow-sm"
      />
    </div>

    <!-- Phone -->
    <div>
      <label for="regPhone" class="block text-xs font-bold mb-1 text-gray-300">${t.phone}</label>
      <input
        id="regPhone"
        type="tel"
        autocomplete="tel"
        placeholder="${t.phone}"
        required
        class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition text-sm shadow-sm"
      />
    </div>

    <!-- Shift -->
    <div>
      <label for="regShift" class="block text-xs font-bold mb-1 text-gray-300">${t.shift}</label>
      <select
        id="regShift"
        required
        class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white focus:outline-none focus:border-blue-500 transition text-sm shadow-sm appearance-none"
      >
        <option value="" disabled selected class="bg-[#0F172A] text-gray-400">${t.selectShift}</option>
        <option value="Green" class="bg-[#0F172A] text-white">Green</option>
        <option value="Red" class="bg-[#0F172A] text-white">Red</option>
        <option value="Blue" class="bg-[#0F172A] text-white">Blue</option>
      </select>
    </div>

    <!-- Password -->
    <div>
      <label for="regPass" class="block text-xs font-bold mb-1 text-gray-300">${t.password}</label>
      <div class="relative">
        <input
          id="regPass"
          type="password"
          autocomplete="new-password"
          placeholder="${t.password}"
          required
          class="w-full p-3 pl-12 rounded-lg bg-[#0F172A] border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition text-sm shadow-sm"
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
          aria-label="${t.password}"
        >
          👁
        </button>
      </div>
    </div>

    <!-- Confirm Password -->
    <div>
      <label for="regPass2" class="block text-xs font-bold mb-1 text-gray-300">${t.confirmPassword}</label>
      <div class="relative">
        <input
          id="regPass2"
          type="password"
          autocomplete="new-password"
          placeholder="${t.confirmPassword}"
          required
          class="w-full p-3 pl-12 rounded-lg bg-[#0F172A] border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition text-sm shadow-sm"
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
          aria-label="${t.confirmPassword}"
        >
          👁
        </button>
      </div>
    </div>

    <!-- Job -->
    <div>
      <label for="regJob" class="block text-xs font-bold mb-1 text-gray-300">${t.job}</label>
      <select
        id="regJob"
        required
        class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white focus:outline-none focus:border-blue-500 transition text-sm shadow-sm appearance-none"
      >
        <option value="" disabled selected class="bg-[#0F172A] text-gray-400">${t.selectJob}</option>
        <option value="Technician" class="bg-[#0F172A] text-white">Technician</option>
        <option value="Operator" class="bg-[#0F172A] text-white">Operator</option>
        <option value="Maintainer" class="bg-[#0F172A] text-white">Maintainer</option>
        <option value="Group Leader" class="bg-[#0F172A] text-white">Group Leader</option>
        <option value="Supervisor" class="bg-[#0F172A] text-white">Supervisor</option>
        <option value="Manager" class="bg-[#0F172A] text-white">Manager</option>
      </select>
    </div>

    <!-- Department -->
    <div>
      <label for="regDepartment" class="block text-xs font-bold mb-1 text-gray-300">${t.department}</label>
      <select
        id="regDepartment"
        required
        class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white focus:outline-none focus:border-blue-500 transition text-sm shadow-sm appearance-none"
      >
        <option value="" disabled selected class="bg-[#0F172A] text-gray-400">${t.selectDepartment}</option>
        <option value="Production" class="bg-[#0F172A] text-white">${t.deptProduction}</option>
        <option value="Mechanical" class="bg-[#0F172A] text-white">${t.deptMechanical}</option>
        <option value="Electrical" class="bg-[#0F172A] text-white">${t.deptElectrical}</option>
      </select>
    </div>

    <!-- Code -->
    <div>
      <label for="regCode" class="block text-xs font-bold mb-1 text-gray-300">${t.code}</label>
      <input
        id="regCode"
        type="text"
        placeholder="${t.code}"
        required
        class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition text-sm shadow-sm"
      />
    </div>

    <!-- Buttons -->
    <div class="pt-2">
      <button
        type="submit"
        class="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 rounded-xl font-bold text-white transition-all shadow-lg mb-3"
      >
        ${t.submitBtn}
      </button>

      <button
        type="button"
        onclick="window.goBack('login')"
        class="w-full py-3 bg-slate-700 hover:bg-slate-600 active:scale-95 rounded-xl font-bold text-white transition-all shadow-md"
      >
        ${t.backBtn}
      </button>
    </div>

  </form>
</div>
`;
};
