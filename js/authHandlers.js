// ============================================================
// authHandlers.js
// معالجات تسجيل الدخول / إنشاء حساب / تسجيل الخروج / تحميل
// المستخدمين (صفحة users المبسطة)
// (تم استخراجه من router.js دون أي تغيير في السلوك الظاهر -
// نفس التحقق من البيانات، ونفس رسائل الأخطاء بالضبط)
// ============================================================

import { login } from './auth/login.js';

import {
  fetchUsers,
  registerUserApi
} from './services/api.js';

import { navigateTo } from './renderCore.js';
import { setCurrentRole, setCurrentPermissions } from './permissions.js';
import { DEBUG } from './config.js';

// طباعة تشخيصية في وضع التطوير فقط - كانت بتطبع بيانات المستخدم
// كاملة (الاسم/الهاتف/الدور/الصلاحيات) في الكونسول لكل عملية
// دخول أو تحميل مستخدمين، حتى لو مش في وضع تطوير
function dlog(...args) {
  if (DEBUG) console.log(...args);
}

// ============================================================
// LOGIN
// ============================================================

window.doLogin = async function () {

try {

const phoneInput =  
  document.getElementById("loginPhone");  

const passwordInput =  
  document.getElementById("loginPass");  


const phone =  
  phoneInput?.value?.trim() || "";  

const password =  
  passwordInput?.value?.trim() || "";  


// ========================================================  
// التحقق من البيانات  
// ========================================================  

if (!phone || !password) {  

  alert(  
    "⚠️ يرجى إدخال رقم الموبايل وكلمة السر."  
  );  

  return;  

}  


// ========================================================  
// زر الدخول  
// ========================================================  

const button =  
  document.getElementById("loginBtn");  


if (button) {  

  button.disabled = true;  

  button.innerText =  
    "جاري تسجيل الدخول...";  

}  


// ========================================================  
// Firebase Login  
// ========================================================  

const result =  
  await login(  
    phone,  
    password  
  );  


dlog(  
  "LOGIN RESULT:",  
  result  
);  


// ========================================================  
// إعادة الزر  
// ========================================================  

if (button) {  

  button.disabled = false;  

  button.innerText =  
    "دخول";  

}  


// ========================================================  
// فشل تسجيل الدخول  
// ========================================================  

if (  
  !result ||  
  result.status !== "success"  
) {  

  alert(  
    result?.message ||  
    "فشل تسجيل الدخول."  
  );  

  return;  

}  


// ========================================================  
// بيانات المستخدم  
// ========================================================  

const user =  
  result.user || {};  


// ========================================================  
// حفظ بيانات المستخدم  
// ========================================================  

localStorage.setItem(  
  "userId",  
  user.id || user.uid || ""  
);  

localStorage.setItem(  
  "name",  
  user.name || ""  
);  

localStorage.setItem(  
  "phone",  
  user.phone || phone  
);  

localStorage.setItem(  
  "job",  
  user.job || ""  
);  

localStorage.setItem(  
  "shift",  
  user.shift || ""  
);  

localStorage.setItem(  
  "department",  
  user.department || ""  
);  

localStorage.setItem(  
  "role",  
  (user.role || "")  
    .trim()  
    .toLowerCase()  
);  

localStorage.setItem(  
  "permissions",  
  user.permissions || ""  
);  


// ========================================================  
// تحديث حالة التطبيق  
// ========================================================  

setCurrentRole(  
  (user.role || "")  
    .trim()  
    .toLowerCase()  
);  


setCurrentPermissions(  
  (user.permissions || "")  
    .split(",")  
    .map(  
      p =>  
        p.trim().toLowerCase()  
    )  
    .filter(Boolean)  
);  


// ========================================================  
// الانتقال للرئيسية  
// (navigateTo("home") تُنتج بالضبط نفس تأثير التعيين اليدوي
// السابق لـ currentPage + history.pushState + render())
// ========================================================  

navigateTo("home");

if (typeof window.initNotificationBell === "function") {
  window.initNotificationBell();
}

} catch (error) {

console.error(  
  "LOGIN ERROR:",  
  error  
);  


const button =  
  document.getElementById("loginBtn");  


if (button) {  

  button.disabled = false;  

  button.innerText =  
    "دخول";  

}  


alert(  
  "حدث خطأ أثناء تسجيل الدخول."  
);

}

};

// ============================================================
// REGISTER USER
// ============================================================

window.registerUser =
async function () {

try {

const name =  
  document  
    .getElementById("regName")  
    ?.value  
    ?.trim() || "";  


const phone =  
  document  
    .getElementById("regPhone")  
    ?.value  
    ?.trim() || "";  


const password =  
  document  
    .getElementById("regPass")  
    ?.value  
    ?.trim() || "";  


const confirmPassword =  
  document  
    .getElementById("regPass2")  
    ?.value  
    ?.trim() || "";  


const shift =  
  document  
    .getElementById("regShift")  
    ?.value  
    ?.trim() || "";  


const job =  
  document  
    .getElementById("regJob")  
    ?.value  
    ?.trim() || "";  


const department =  
  document  
    .getElementById("regDepartment")  
    ?.value  
    ?.trim() || "";  


const code =  
  document  
    .getElementById("regCode")  
    ?.value  
    ?.trim() || "";  


if (  
  !name ||  
  !phone ||  
  !password ||  
  !confirmPassword ||  
  !shift ||  
  !job ||  
  !department ||  
  !code  
) {  

  alert(  
    "⚠️ يرجى إدخال جميع البيانات المطلوبة."  
  );  

  return;  

}  


if (  
  password !==  
  confirmPassword  
) {  

  alert(  
    "⚠️ كلمتا السر غير متطابقتين."  
  );  

  return;  

}  


const userData = {  

  name,  

  phone,  

  password,  

  shift,  

  job,  

  department,  

  code  

};  


const submitButton =  
  document.querySelector(  
    'form button[type="submit"]'  
  );  


if (submitButton) {  

  submitButton.disabled =  
    true;  

  submitButton.innerText =  
    "جاري إنشاء الحساب...";  

}  


const result =  
  await registerUserApi(  
    userData  
  );  


if (submitButton) {  

  submitButton.disabled =  
    false;  

  submitButton.innerText =  
    "إنشاء الحساب";  

}  


if (  
  result.status !==  
  "success"  
) {  

  alert(  
    result.message ||  
    "حدث خطأ أثناء التسجيل."  
  );  

  return;  

}  


alert(  
  result.message ||  
  "تم إرسال طلب التسجيل بنجاح."  
);  


navigateTo("login");

} catch (error) {

console.error(  
  "REGISTER ERROR:",  
  error  
);  


alert(  
  "حدث خطأ أثناء إنشاء الحساب."  
);

}

};

// ============================================================
// LOAD USERS
// ============================================================

window.loadUsers =
async function () {

dlog(
"DEBUG: Load Users Started..."
);

const container =
document.getElementById(
"usersContainer"
);

if (!container) {

console.warn(  
  "usersContainer غير موجود"  
);  

return;

}

container.innerHTML = `

<div  
  class="  
    text-center  
    py-8  
    text-gray-400  
  "  
>  

  جاري تحميل المستخدمين...  

</div>

`;

try {

const result =  
  await fetchUsers();  


dlog(  
  "DEBUG: API Result:",  
  result  
);  


if (  
  result.status !==  
  "success"  
) {  

  container.innerHTML = `  

    <div  
      class="  
        text-red-400  
        text-center  
        py-6  
      "  
    >  

      خطأ:  
      ${result.message || "فشل تحميل المستخدمين"}  

    </div>  

  `;  

  return;  

}  


const usersList =  
  Array.isArray(result.data)  
    ? result.data  
    : [];  


dlog(  
  "DEBUG: Users Count:",  
  usersList.length  
);  


if (!usersList.length) {  

  container.innerHTML = `  

    <div  
      class="  
        text-center  
        text-gray-500  
        py-6  
      "  
    >  

      لا يوجد مستخدمون مسجلون حالياً  

    </div>  

  `;  

  return;  

}  


let html = "";  


usersList.forEach(  
  user => {  

    html += `  

      <div  
        class="  
          bg-[#1E293B]  
          rounded-xl  
          p-3  
          mb-3  
          text-white  
          text-xs  
          border  
          border-gray-700  
        "  
      >  

        <div>  
          <b>  
            ${user.name || "مستخدم بدون اسم"}  
          </b>  
        </div>  

        <div class="text-gray-400">  
          📱 ${user.phone || ""}  
        </div>  

        <div class="text-blue-400">  
          الدور:  
          ${user.role || "pending"}  
        </div>  

        <div class="text-gray-400">  
          الحالة:  
          ${user.status || "-"}  
        </div>  

        <div class="text-gray-400">  
          الشيفت:  
          ${user.shift || "-"}  
        </div>  

        <div class="text-gray-400">  
          القسم:  
          ${user.department || "-"}  
        </div>  

      </div>  

    `;  

  }  
);  


container.innerHTML =  
  html;

} catch (error) {

console.error(  
  "LOAD USERS ERROR:",  
  error  
);  


container.innerHTML = `  

  <div  
    class="  
      text-red-400  
      text-center  
      py-6  
    "  
  >  

    حدث خطأ أثناء تحميل المستخدمين  

  </div>  

`;

}

};

// ============================================================
// LOGOUT
// ============================================================

window.logout =
function () {

if (typeof window.destroyNotificationBell === "function") {
  window.destroyNotificationBell();
}

localStorage.clear();

setCurrentRole("");

setCurrentPermissions([]);

navigateTo(
"login"
);

};
