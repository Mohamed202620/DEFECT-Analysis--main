// ============================================================
// pageRenderer.js
// جدول التوجيه بين الصفحات (renderPage) + صفحات "غير مصرح"
// و"قيد التطوير"
// (تم استخراجه من router.js دون أي تغيير في السلوك - نفس ترتيب
// الـ cases، ونفس فحوصات الصلاحيات لكل صفحة بالضبط)
// ============================================================

import { PageView } from './components/PageView.js';
import { hasPermission } from './permissions.js';

import { LoginView } from './views/loginView.js';
import { RegisterView } from './views/registerView.js';
import { HomeView } from './views/homeView.js';
import { PMView } from './views/pmView.js';
import { ReportView } from './views/reportView.js';
import { ReportsView } from './views/reportsView.js';
import { SuggestionView } from './views/suggestionView.js';
import { IssueView } from './views/issueView.js';
import { MaintenanceView } from './views/MaintenanceView.js';
import { QualityView } from './views/QualityView.js';
import { SystemView } from './views/SystemView.js';
import { ErrorScannerView } from './views/ErrorScannerView.js';
import { RequestsView } from './views/RequestsView.js';

// ============================================================
// RENDER PAGES
// ============================================================

export function renderPage(page) {

switch (page) {

case 'login':  

  return LoginView();  


case 'register':  

  return RegisterView();  


case 'home':  

  return HomeView();  


case 'maintenance':  

  return hasPermission("maintenance")  
    ? MaintenanceView()  
    : unauthorizedPage("maintenance");  


case 'issue':  

  return hasPermission("issue")  
    ? IssueView()  
    : unauthorizedPage("issue");  


// ========================================================  
// كايزن  
// ========================================================  

case 'suggestion':  
case 'suggestions':  

  return hasPermission("suggestions")  
    ? SuggestionView()  
    : unauthorizedPage("suggestions");  


case 'pm':  

  return hasPermission("pm")  
    ? PMView()  
    : unauthorizedPage("pm");  


case 'quality':  

  return hasPermission("quality")  
    ? QualityView()  
    : unauthorizedPage("quality");  


case 'errorScanner':  

  return hasPermission("maintenance")  
    ? ErrorScannerView()  
    : unauthorizedPage("maintenance");  


case 'report':  

  return hasPermission("reports")  
    ? ReportView()  
    : unauthorizedPage("reports");  


case 'reports':  

  return hasPermission("reports")  
    ? ReportsView()  
    : unauthorizedPage("reports");  


// ========================================================  
// USERS  
// ========================================================  

case 'users':  

  return hasPermission("users")  

    ? PageView(  
        "👥 إدارة المستخدمين",  
        `  
          <div class="space-y-3">  

            <button  
              onclick="window.loadUsers()"  
              class="  
                w-full  
                bg-blue-600  
                hover:bg-blue-500  
                rounded-lg  
                p-3  
                font-bold  
                text-white  
                text-xs  
              "  
            >  
              🔄 تحديث القائمة  
            </button>  

            <div  
              id="usersContainer"  
              class="mt-4"  
            >  

              <div  
                class="  
                  text-center  
                  text-gray-500  
                  text-xs  
                "  
              >  
                جاري تحميل البيانات...  
              </div>  

            </div>  

          </div>  
        `  
      )  

    : unauthorizedPage("users");  


// ========================================================  
// REQUESTS  
// ========================================================  

case 'requests':  

  return hasPermission("requests")  
    ? RequestsView()  
    : unauthorizedPage("requests");  


case 'system':  

  return SystemView();  


default:  

  // إذا كان المستخدم مسجلاً دخوله بالفعل، فإن أي صفحة غير معروفة
  // (مثل صفحات لم تُبنَ بعد: qr, ai, kb, stats...) يجب ألا تُعيده
  // لشاشة تسجيل الدخول (يبدو كخروج مفاجئ)، بل تُظهر له رسالة واضحة
  const isLoggedIn =  
    localStorage.getItem("phone") ||  
    localStorage.getItem("userId");  

  return isLoggedIn  
    ? comingSoonPage(page)  
    : LoginView();

}

}

// ============================================================
// قيد التطوير (صفحات لم تُبنَ بعد)
// ============================================================

function comingSoonPage(page) {

return PageView(

"🚧 قيد التطوير",  

`  
  <div  
    class="  
      bg-[#1E293B]  
      p-6  
      rounded-xl  
      border  
      border-blue-500/30  
      text-center  
      text-xs  
      text-blue-300  
      font-bold  
    "  
  >  

    هذه الميزة (${page || ""}) لم تُفعّل بعد وسيتم إضافتها قريباً.  

  </div>  
`

);

}

// ============================================================
// UNAUTHORIZED
// ============================================================

function unauthorizedPage(permission) {

return PageView(

"⚠️ غير مصرح",  

`  
  <div  
    class="  
      bg-[#1E293B]  
      p-6  
      rounded-xl  
      border  
      border-red-500/30  
      text-center  
      text-xs  
      text-red-400  
      font-bold  
    "  
  >  

    ليس لديك صلاحية للوصول إلى:  
    ${permission}  

  </div>  
`

);

}
