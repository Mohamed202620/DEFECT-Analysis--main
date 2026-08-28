import { login } from './login.js';
import { register } from './register.js';
import { logout } from './logout.js';
import { setCurrentRole, setCurrentPermissions, isAdminRole } from '../permissions.js';

/**
 * 1. معالجة تسجيل الدخول
 */
export async function doLogin() {
  const phoneInput = document.getElementById('loginPhone');
  const passInput = document.getElementById('loginPass');
  const loginBtn = document.getElementById('loginBtn');

  if (!phoneInput || !passInput) return;

  const phone = phoneInput.value.trim();
  const pass = passInput.value.trim();

  // تغيير حالة الزر أثناء الانتظار
  if (loginBtn) {
    loginBtn.disabled = true;
    loginBtn.innerText = 'جاري التحقق...';
  }

  try {
    const response = await login(phone, pass);

    if (response && response.status === 'success') {
      const user = response.user || response.data || {};

      // حفظ بيانات المستخدم في الذاكرة المحلية
      localStorage.setItem('currentUser', JSON.stringify(user));
      localStorage.setItem('userId', user.id || user.uid || '');
      localStorage.setItem('name', user.name || '');
      localStorage.setItem('phone', user.phone || phone);
      localStorage.setItem('job', user.job || '');
      localStorage.setItem('shift', user.shift || '');
      localStorage.setItem('department', user.department || '');

      const userRole = (user.role || '').trim().toLowerCase();
      localStorage.setItem('role', userRole);

      let userPerms = user.permissions || '';
      if (isAdminRole(userRole)) {
        userPerms = userPerms ? `all,${userPerms}` : 'all,home,maintenance,issue,suggestions,pm,log,reports,qr,errorScanner,quality,ai,kb,statistics,export,users,requests,machines,settings';
      }
      localStorage.setItem('permissions', userPerms);

      // تحديث حالة الصلاحيات المركزية
      setCurrentRole(userRole);
      setCurrentPermissions(userPerms);

      // التوجيه للصفحة الرئيسية
      if (typeof window.navigateTo === 'function') {
        window.navigateTo('home');
      }
    } else {
      alert(response.message || 'بيانات الدخول غير صحيحة');
    }
  } catch (error) {
    console.error('Login Error:', error);
    alert('حدث خطأ أثناء الاتصال بالسيرفر');
  } finally {
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.innerText = 'دخول';
    }
  }
}

/**
 * 2. معالجة إنشاء حساب جديد
 */
export async function registerUser() {
  const name = document.getElementById('regName')?.value.trim();
  const phone = document.getElementById('regPhone')?.value.trim();
  const shift = document.getElementById('regShift')?.value.trim();
  const pass = document.getElementById('regPass')?.value.trim();
  const pass2 = document.getElementById('regPass2')?.value.trim();
  const job = document.getElementById('regJob')?.value.trim();
  const department = document.getElementById('regDepartment')?.value.trim();
  const code = document.getElementById('regCode')?.value.trim();

  // التحقق من تطابق كلمتي السر
  if (pass !== pass2) {
    alert('كلمتا السر غير متطابقتين!');
    return;
  }

  const submitBtn = document.querySelector('form button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = 'جاري إنشاء الحساب...';
  }

  try {
    const response = await register({
      name,
      phone,
      shift,
      password: pass,
      job,
      department,
      code
    });

    if (response && response.status === 'success') {
      alert('تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول.');
      if (typeof window.navigateTo === 'function') {
        window.navigateTo('login');
      }
    } else {
      alert(response.message || 'فشل عملية إنشاء الحساب');
    }
  } catch (error) {
    console.error('Register Error:', error);
    alert('حدث خطأ أثناء إرسال البيانات');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = 'إنشاء الحساب';
    }
  }
}

/**
 * 3. معالجة تسجيل الخروج
 */
export async function logoutUser() {
  try {
    await logout();
  } catch (error) {
    console.error('Logout Error:', error);
  } finally {
    localStorage.removeItem('currentUser'); // تنظيف جلسة المستخدم المحلي أيضاً
    if (typeof window.navigateTo === 'function') {
      window.navigateTo('login');
    }
  }
}

// تعيين الدوال على مستوى النافذة (window) لكي تستجيب لأحداث الـ HTML مباشرة
window.doLogin = doLogin;
window.registerUser = registerUser;
window.logoutUser = logoutUser;
