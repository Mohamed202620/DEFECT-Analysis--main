// ============================================================
// authHandlers.js
// معالجات تسجيل الدخول / إنشاء حساب / تسجيل الخروج
// (تم استخراجه من router.js دون أي تغيير في السلوك الظاهر -
// نفس التحقق من البيانات، ونفس رسائل الأخطاء بالضبط)
// ============================================================

import { login } from './auth/login.js';

import {
  registerUserApi
} from './services/api.js';

import { navigateTo } from './renderCore.js';
import { setCurrentRole, setCurrentPermissions, isAdminRole } from './permissions.js';
import { auth, DEBUG, translations, ALL_PERMISSIONS } from './config.js';
import { signOut } from './firebase.js';

// إصلاح (ترجمة شاملة): كل نصوص التنبيهات ورسائل الحالة هنا كانت
// ثابتة بالعربي - دلوقتي بتتقرأ من translations.auth حسب
// window.currentLang، وأزرار الدخول/التسجيل بتشارك نفس التسميات
// الموجودة أصلاً في translations.login / translations.register
function t() {
  const currentLang = window.currentLang || "ar";
  return (translations[currentLang] || translations.ar).auth;
}

function loginLabel() {
  const currentLang = window.currentLang || "ar";
  return (translations[currentLang] || translations.ar).login.loginBtn;
}

function registerLabel() {
  const currentLang = window.currentLang || "ar";
  return (translations[currentLang] || translations.ar).register.submitBtn;
}

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
    t().fillPhonePassword  
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
    t().loggingIn;  

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
    loginLabel();  

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
    t().loginFailed  
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

const userRole = (user.role || "").trim().toLowerCase();
let userPerms = user.permissions || "";
if (isAdminRole(userRole)) {
  userPerms = userPerms ? `all,${userPerms}` : ALL_PERMISSIONS.join(",");
}

localStorage.setItem("role", userRole);
localStorage.setItem("permissions", userPerms);

// ========================================================  
// تحديث حالة التطبيق  
// ========================================================  

setCurrentRole(userRole);
setCurrentPermissions(userPerms);

// ========================================================  
// الانتقال للرئيسية  
// ========================================================  

navigateTo("home");

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
    loginLabel();  

}  


alert(  
  t().loginErrorGeneric  
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
    t().fillAllFields  
  );  

  return;  

}  


if (  
  password !==  
  confirmPassword  
) {  

  alert(  
    t().passwordMismatch  
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
    t().creatingAccount;  

}  


const result =  
  await registerUserApi(  
    userData  
  );  


if (submitButton) {  

  submitButton.disabled =  
    false;  

  submitButton.innerText =  
    registerLabel();  

}  


if (  
  result.status !==  
  "success"  
) {  

  alert(  
    result.message ||  
    t().registerErrorGeneric  
  );  

  return;  

}  


alert(  
  result.message ||  
  t().registerSuccessDefault  
);  


navigateTo("login");

} catch (error) {

console.error(  
  "REGISTER ERROR:",  
  error  
);  


alert(  
  t().registerErrorCatch  
);

}

};

// ============================================================
// LOAD USERS
// ============================================================
// إصلاح (توحيد): الدالة القديمة (قائمة عرض فقط) اتشالت من هنا لأن
// صفحة "users" بقت بتستخدم UsersManagementView() (نفس واجهة/منطق
// صفحة "requests") بدل القالب القديم اللي كان بينادي الدالة دي -
// راجع RequestsView.js -> loadUsersManagement() بدلاً منها

// ============================================================
// LOGOUT
// ============================================================

window.logout = async function () {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout Error:", error);
  }
  localStorage.clear();
  setCurrentRole("");
  setCurrentPermissions([]);
  navigateTo("login");
};
