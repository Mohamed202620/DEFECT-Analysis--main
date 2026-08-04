export const RegisterView = () => `
<div class="min-h-screen flex items-center justify-center p-4">
  <div class="w-full max-w-sm bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6 shadow-2xl space-y-4">

    <!-- Logo -->
    <div class="flex justify-center">
      <img src="1000230635.png" class="w-20 h-20 object-contain rounded-2xl"/>
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
      class="w-full p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] text-white"
    />

    <!-- Phone -->
    <input
      id="regPhone"
      type="tel"
      placeholder="رقم الموبايل"
      class="w-full p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] text-white"
    />

    <!-- Shift -->
    <select
      id="regShift"
      class="w-full p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] text-white"
    >
      <option value="">اختر الشيفت</option>
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
        class="w-full p-3 pl-12 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] text-white"
      />

      <button
        type="button"
        onclick="
          const p=document.getElementById('regPass');
          if(p.type==='password'){
            p.type='text';
            this.innerHTML='🙈';
          }else{
            p.type='password';
            this.innerHTML='👁';
          }
        "
        class="absolute left-3 top-1/2 -translate-y-1/2 text-xl"
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
        class="w-full p-3 pl-12 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] text-white"
      />

      <button
        type="button"
        onclick="
          const p=document.getElementById('regPass2');
          if(p.type==='password'){
            p.type='text';
            this.innerHTML='🙈';
          }else{
            p.type='password';
            this.innerHTML='👁';
          }
        "
        class="absolute left-3 top-1/2 -translate-y-1/2 text-xl"
      >
        👁
      </button>
    </div>

    <!-- Job -->
    <select
      id="regJob"
      class="w-full p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] text-white"
    >
      <option value="">اختر الوظيفة</option>
      <option value="Technician">Technician</option>
      <option value="Operator">Operator</option>
      <option value="Maintainer">Maintainer</option>
      <option value="Group Leader">Group Leader</option>
      <option value="Supervisor">Supervisor</option>
      <option value="Manager">Manager</option>
    </select>

    <!-- Department -->
    <input
      id="regDepartment"
      type="text"
      placeholder="القسم"
      class="w-full p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] text-white"
    />

    <!-- Code -->
    <input
      id="regCode"
      type="text"
      placeholder="رقم الكود"
      class="w-full p-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] text-white"
    />

    <!-- Register -->
    <button
      onclick="window.registerUser()"
      class="w-full py-3 bg-green-600 hover:bg-green-700 rounded-xl font-bold text-white"
    >
      إنشاء الحساب
    </button>

    <!-- Back -->
    <button
      onclick="window.navigateTo('login')"
      class="w-full py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-bold text-white"
    >
      رجوع
    </button>

  </div>
</div>
`;
