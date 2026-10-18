# 🛠️ نظام إدارة الصيانة وتحليل العيوب (V1.0)
> Maintenance & Defect Analysis System

نظام تقدمي (PWA) لإدارة أعمال الصيانة الوقائية والطارئة وتحليل عيوب خطوط الإنتاج بالتكامل مع Google Sheets عبر Google Apps Script.

---

## 🚀 المميزات الرئيسية
* 🚨 **إدارة بلاغات الأعطال**: تسجيل سريع للبلاغات ومتابعة حالتها.
* 📷 **توثيق العيوب بالصور**: التقاط وتخزين 3 صور لكل عيب من زوايا مختلفة مع ضغط تلقائي للحجم.
* 📊 **لوحة متابعة تفاعلية**: رسوم بيانية توضح أكثر المعدات عطلاً وإحصائيات الإنتاج (Chart.js).
* 👥 **صلاحيات وسجلات**: أدوار للمستخدمين (مدير / مهندس / فني).
* 📱 **دعم PWA**: إمكانية التثبيت كـ تطبيق على الهواتف والعمل أوفلاين جزئياً.
* 🌐 **دعم لغتين**: دعم كامل للعربية والألمانية/الإنجليزية بالتنقل التلقائي لتجاه الصفحة (RTL/LTR).

---

## 📂 هيكل المشروع (Project Structure)

```text
├── index.html              # واجهة الصفحة الواحدة الرئيسي
├── manifest.json           # إعدادات تطبيق PWA
├── sw.js                   # Service Worker للتخزين المؤقت
├── firestore.rules         # قواعد أمان Firestore الموصى بها (راجع قسم الأمان بالأسفل)
└── js/
    ├── config.js           # إعدادات Firebase والترجمات
    ├── router.js           # نقطة الدخول - يجمع الموديولات التالية
    ├── permissions.js      # نظام الصلاحيات (hasPermission)
    ├── theme.js            # الوضع الليلي/النهاري
    ├── renderCore.js       # navigateTo() / render()
    ├── pageRenderer.js     # جدول التوجيه بين الصفحات
    ├── authHandlers.js     # معالجات تسجيل الدخول/الخروج/التسجيل
    ├── workflow.js         # منطق ضغط الصور وحفظ العيوب
    ├── errorScanner.js     # Machine Error Scanner (OCR)
    ├── knowledgeBase.js    # قاعدة المعرفة
    ├── statistics.js       # الإحصائيات
    ├── auth/
    │   ├── login.js        # تسجيل الدخول + التحقق من كلمة السر
    │   ├── register.js     # تسجيل حساب جديد
    │   └── logout.js       # تسجيل الخروج
    ├── services/
    │   ├── api.js              # نقطة دخول مركزية (Barrel) - يُعيد تصدير كل ما يلي
    │   ├── crypto.js           # تشفير كلمات السر (PBKDF2)
    │   ├── imageUpload.js      # رفع الصور على ImgBB
    │   ├── usersApi.js         # المستخدمون
    │   ├── defectsApi.js       # بلاغات عيوب الإنتاج
    │   ├── ticketsApi.js       # بلاغات الأعطال
    │   ├── dashboardApi.js     # بيانات لوحة المتابعة
    │   ├── machineErrorsApi.js # قاعدة معرفة أعطال الماكينات
    │   ├── pmApi.js            # الصيانة الوقائية
    │   └── suggestionsApi.js   # مقترحات الكايزن
    ├── components/          # مكونات واجهة قابلة لإعادة الاستخدام
    └── views/                # صفحات التطبيق (Home, Issue, PM, Reports...)
```

---

## 🔒 ملاحظات أمان مهمة

## النشر التلقائي عبر GitHub Actions

تم إعداد Workflowين للنشر التلقائي:

- الدفع إلى فرع `dev` ينشر إلى موقع Hosting الخاص بمشروع Firebase المنفصل `dev-test-37e8a` (target `dev` في `.firebaserc`) ويتصل بـ Worker التطوير `https://maintenance-backend-dev.mom379339.workers.dev` فقط.
- الدفع إلى فرع `main` ينشر إلى `maintenance-defect-system.web.app` (مشروع الإنتاج) كما كان، دون أي تغيير.

بيئة dev معزولة عن الإنتاج: Firestore وAuthentication وHosting والـ Worker كلها تابعة لـ `dev-test-37e8a`. اختيار البيئة يتم في `js/firebaseEnv.js`؛ إذا كانت إعدادات dev ناقصة أو تشير لمشروع/Worker الإنتاج يتوقف التطبيق برسالة واضحة ولا يتصل بالإنتاج إطلاقًا (لا يوجد fallback). خادم التطوير المحلي (`server.js` / `vite`) يعمل كـ dev افتراضيًا ويحتاج متغيرات `FIREBASE_*` الخاصة بمشروع dev (راجع `.env.example`)؛ ولتشغيله على الإنتاج صراحةً استخدم `APP_ENV=production`.

### نشر dev (GitHub Actions)

يستخدم Workflow الـ dev (`.github/workflows/firebase-hosting-dev.yml`) بيانات dev فقط، ولا يستخدم `FIREBASE_SERVICE_ACCOUNT` الخاص بالإنتاج. المطلوب في GitHub → Settings → Secrets and variables → Actions:

| الاسم | النوع | القيمة |
| --- | --- | --- |
| `FIREBASE_DEV_PROJECT_ID` | Secret أو Variable | `dev-test-37e8a` |
| `FIREBASE_DEV_SERVICE_ACCOUNT` | Secret | JSON حساب خدمة تابع لمشروع `dev-test-37e8a` (صلاحية Firebase Hosting Admin على الأقل) |
| `FIREBASE_DEV_API_KEY` | Secret أو Variable | apiKey لتطبيق Web المسجّل في مشروع dev (من Firebase Console) |
| `FIREBASE_DEV_APP_ID` | Secret أو Variable | appId لتطبيق Web نفسه |
| `FIREBASE_DEV_MESSAGING_SENDER_ID` | Secret أو Variable | messagingSenderId لمشروع dev |
| `FIREBASE_DEV_STORAGE_BUCKET` | اختياري | افتراضيًا `dev-test-37e8a.firebasestorage.app`؛ اضبطه إن كان الـ bucket الفعلي `.appspot.com` |

قبل النشر يتحقق الـ Workflow من: (1) أن معرّف المشروع هو `dev-test-37e8a` وأن حساب الخدمة تابع له (وليس للإنتاج)، (2) أن `/health` في Worker التطوير يعيد `development` ومشروع `dev-test-37e8a` وموقع Hosting نفسه، (3) أن موقع Hosting المستهدف موجود فعلًا داخل مشروع dev (`firebase hosting:sites:list`)، ثم ينشر مع توليد `api/config.js` الخاص بـ dev أثناء التشغيل فقط (الملف المحفوظ في المستودع لا يتغير).

للنشر اليدوي من نسخة محلية موثوقة، عيّن متغيرات `FIREBASE_DEV_*` أعلاه (بدون السر) واستخدم `npm run deploy:dev`؛ ينشر Hosting target `dev` على `dev-test-37e8a` فقط. لنشر قواعد Firestore وindexes على dev استخدم `npm run deploy:dev:rules` (مشروع dev صريح). لا يوجد Workflow ينشر القواعد أو Functions تلقائيًا لأي بيئة؛ واختبر القواعد بـ Emulator (`npm run test:rules`) قبل أي تغيير.

المشروع بيتواصل مباشرة من المتصفح مع Firestore (بدون باك-إند وسيط)، لكنه **بيستخدم Firebase Authentication حقيقي** (Email/Password، عبر تحويل رقم الهاتف لإيميل داخلي - راجع `js/auth/login.js` و`phoneToAuthEmail` في `config.js`)، والحسابات القديمة (نظام الدخول المخصص القديم) بتترحّل تلقائياً لحساب Auth حقيقي عند أول تسجيل دخول ليها بعد هذا التحديث. بناءً عليه، **`firestore.rules` فعلاً بتقدر تفرّق بين مستخدم عادي وأدمن/مدير** عن طريق قراءة مستند `users/{uid}` الخاص بالمستخدم المسجّل دخوله فعليًا (`request.auth.uid`) والتحقق من حقل `role` فيه - راجع الدوال المساعدة `myProfile()`/`myRole()`/`isActive()` في أول `firestore.rules`. ⚠️ *(تحديث: نسخة سابقة من هذا القسم كانت بتقول إن مفيش Firebase Authentication حقيقي وإن الـ Rules مقدرش تفرّق بين الأدوار - ده لم يكن يعكس الكود الفعلي بشكل دقيق، وتم تصحيحه هنا)*.

نقاط لازم تعرفها:

1. **كلمات السر مشفّرة (PBKDF2 + Salt)** عبر `js/services/crypto.js` كخطوة وسيطة إضافية أثناء الترحيل لـ Firebase Auth - راجع الملف لتفاصيل السبب والطريقة.
2. **`firestore.rules`**: ملف قواعد أمان جاهز في جذر المشروع - **لازم تنسخه فعليًا** إلى Firebase Console (Firestore Database → Rules) أو تنشره بـ Firebase CLI، إضافته للمشروع وحدها مش كافية. هذا الملف هو خط الدفاع الحقيقي (Server-Side)؛ أي تحقق من الصلاحيات في كود الواجهة (`permissions.js`, `machines.js`) هو لتحسين تجربة الاستخدام فقط ومش كافي وحده كحماية، لأنه قابل للتجاوز من متصفح المستخدم (DevTools).
3. **فلترة الماكينات حسب القسم (Backend/Frontend)**: مطبّقة على مستويين متكاملين - (أ) الواجهة: `getMachinesForUser`/`getMachineTypeEntries` في `js/machines.js` بتعرض للمستخدم بس ماكينات قسمه، (ب) القاعدة: مستندات `machineErrors`/`machineErrorLogs`/`pmRecords` بتتحفظ بحقل `department` تلقائي، و`firestore.rules` بترفض أي محاولة إنشاء بقسم غير قسم المستخدم نفسه إلا للأدوار صاحبة الوصول الكامل (admin/manager/engineer). ⚠️ القاعدة بتتحقق إن القيمة المُرسلة تطابق قسم المستخدم، مش إنها فعلاً القسم الصحيح لاسم الماكينة (قيد في شكل بيانات `machineTypes` الحالي - راجع التعليق في `firestore.rules` نفسه لتفاصيل السبب والحل المستقبلي المقترح).
4. **أداة Eruda (كونسول للموبايل)**: بقت مُعطّلة افتراضيًا، وبتتفعّل فقط بإضافة `?debug=1` للرابط أو بضبط `localStorage.debug = "true"` يدويًا.
5. **`IMGBB_API_KEY`** في `config.js` مفتاح ظاهر في كود الموقع بحكم إنه تطبيق Static بالكامل بدون سيرفر - ده طبيعي لخدمات زي دي لكن يُفضّل عمل Rotate له من وقت للتاني من حساب ImgBB، وللاستخدام الإنتاجي الفعلي يُنصح بالانتقال لتخزين مملوك للشركة (Firebase Storage على خطة Blaze مثلاً) بدل خدمة خارجية مجانية، نظرًا لحساسية صور الأعطال كسجل تدقيق داخلي.