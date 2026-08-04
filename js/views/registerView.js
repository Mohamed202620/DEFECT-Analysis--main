export const RegisterView = () => `
<div class="min-h-screen flex items-center justify-center p-4" dir="rtl">
  <form 
    onsubmit="event.preventDefault(); window.registerUser();" 
    class="w-full max-w-sm bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6 shadow-2xl space-y-4"
  >

    <!-- Logo -->
    <div class="flex justify-center">
      <img src="1000230635.png" alt="شعار الشركة" class="w-20 h-20 object-contain rounded-2xl"/>
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
      class="w-full p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] text-white focus:outline-none focus:border-blue-500 transition"
    />

    <!-- Phone -->
    <input
      id="regPhone"
      type="tel"
      placeholder="رقم الموبايل"
      required
      class="w-full p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] text-white focus:outline-none focus:border-blue-500 transition"
    />

    <!-- Shift -->
    <select
      id="regShift"
      required
      class="w-full p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] text-white focus:outline-none focus:border-blue-500 transition"
    >
      <option value="" disabled selected>اختر الشيفت</option>
      <option value="Green">Green</option>
      <option value="Red">Red</option>
      <option value="Blue">Blue</option>
    </select>

    <!-- Password -->
    <div class="relative">
      <input
        id="regPass"
        type="password"
        placeholder="كلمة السر"
        required
        class="w-full p-3 pl-12 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] text-white focus:outline-none focus:border-blue-500 transition"
      />
      <button
        type="button"
        onclick="
          const p = document.getElementById('regPass');
          const isPass = p.type === 'password';
          p.type = isPass ? 'text' : 'password';
          this.innerHTML = isPass ? '🙈' : '👁';
        "
        class="absolute left-3 top-1/2 -translate-y-1/2 text-xl focus:outline-none"
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
        class="w-full p-3 pl-12 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] text-white focus:outline-none focus:border-blue-500 transition"
      />
      <button
        type="button"
        onclick="
          const p = document.getElementById('regPass2');
          const isPass = p.type === 'password';
          p.type = isPass ? 'text' : 'password';
          this.innerHTML = isPass ? '🙈' : '👁';
        "
        class="absolute left-3 top-1/2 -translate-y-1/2 text-xl focus:outline-none"
        aria-label="Toggle password visibility"
      >
        👁
      </button>
    </div>

    <!-- Job -->
    <select
      id="regJob"
      required
      class="w-full p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] text-white focus:outline-none focus:border-blue-500 transition"
    >
      <option value="" disabled selected>اختر الوظيفة</option>
      <option value="Technician">Technician</option>
      <option value="Operator">Operator</option>
      <option value="Maintainer">Maintainer</option>
      <option value="Group Leader">Group Leader</option>
      <option value="Supervisor">Supervisor</option>
      <option value="Manager">Manager</option>
    </select>

    <!-- Department -->
    <select
      id="regDepartment"
      required
      class="w-full p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] text-white focus:outline-none focus:border-blue-500 transition"
    >
      <option value="" disabled selected>اختر القسم</option>
      <option value="Production">الإنتاج</option>
      <option value="Mechanical">الميكانيكا</option>
      <option value="Electrical">الكهرباء</option>
    </select>

    <!-- Code -->
    <input
      id="regCode"
      type="text"
      placeholder="رقم الكود"
      required
      class="w-full p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] text-white focus:outline-none focus:border-blue-500 transition"
    />

    <!-- Register -->
    <button
      type="submit"
      class="w-full py-3 bg-green-600 hover:bg-green-700 rounded-xl font-bold text-white transition-colors"
    >
      إنشاء الحساب
    </button>

    <!-- Back -->
    <button
      type="button"
      onclick="window.navigateTo('login')"
      class="w-full py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-bold text-white transition-colors"
    >
      رجوع
    </button>

  </form>
</div>
`;
