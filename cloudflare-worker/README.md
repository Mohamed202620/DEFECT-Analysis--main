# الـ Worker البديل المجاني لـ Cloud Functions

يعمل على Cloudflare Workers (خطة Free، بدون بطاقة) ويغني عن ترقية Firebase إلى Blaze. الإعداد الحالي في هذا الدليل خاص بمشروع الإنتاج `maintenance-defect-system`؛ لا تستخدم Worker الإنتاج أو بياناته مع تطبيق dev.
**لا تنشر `functions/` ولا تستخدم `firebase deploy` بدون `--only`** (سيحاول نشر الدوال ويفشل على Spark).

## الخطوات (تنفذ من الموبايل)

### 1) مفتاح حساب الخدمة من Firebase
Firebase Console ← ⚙️ Project settings ← **Service accounts** ← **Generate new private key**.
سيُنزَّل ملف JSON. افتحه وانسخ **كل** محتواه. لا ترسله لأي شخص ولا ترفعه على GitHub.

### 2) ضع الكود في الـ Worker
Cloudflare ← Workers & Pages ← `odd-sun-fab8` ← **Edit code** ← احذف الكود الموجود، والصق محتوى `worker.mjs` كاملًا ← **Deploy**.

### 3) أضف الإعدادات
`odd-sun-fab8` ← **Settings** ← **Variables and Secrets** ← Add:

| الاسم | النوع | القيمة |
|---|---|---|
| `FIREBASE_ENV` | Text | `production` |
| `FIREBASE_PROJECT_ID` | Text | `maintenance-defect-system` |
| `FIREBASE_HOSTING_SITE` | Text | `maintenance-defect-system` |
| `FIREBASE_API_KEY` | Text | Firebase project's web API key (used only to create a migrated Auth account) |
| `SERVICE_ACCOUNT_JSON` | **Secret** | محتوى ملف JSON كاملًا |
| `IMGBB_API_KEY` | **Secret** | مفتاح ImgBB (ولّد مفتاحًا جديدًا من imgbb.com/api: القديم كان ظاهرًا في الكود) |
| `ALLOWED_ORIGINS` | Text | نطاقات الإنتاج المسموح بها مفصولة بفواصل؛ مطلوب ولا يوجد fallback. |

لـ live Hosting deploy الحالي، حساب GitHub deployer يحتاج `roles/firebasehosting.admin` و`roles/serviceusage.apiKeysViewer` على المشروع. لا تستخدمه لحساب Worker.

اضغط **Deploy** بعد الحفظ، ثم احذف ملف JSON من الجهاز.

### 4) اختبار الـ Worker
افتح `https://odd-sun-fab8.mom379339.workers.dev/health` في المتصفح، ويجب أن يظهر `{"ok":true}`.

### 5) انشر التطبيق (بدون Functions)
```
firebase deploy --only hosting,firestore:rules,firestore:indexes
```
(النشر عبر GitHub Actions ينشر الاستضافة فقط، وهذا مناسب. أما القواعد والفهارس فانشرها بالأمر أعلاه.)

### 6) خطوة لمرة واحدة بعد النشر: حماية أكواد الموظفين (أدمن)
افتح صفحة **المستخدمين/الطلبات** واضغط **🔐 حماية أكواد الموظفين (مرة واحدة)**.
الأكواد القديمة كانت مخزنة في مستند المستخدم، وأي مستخدم نشط يقدر يقرأ مستندات الفنيين والمشرفين والأدمن.
الزر ينقلها **مجزّأة (hash)** إلى مجموعة مغلقة ويمسحها من المستند. **حتى تضغطه لن يستطيع الحسابات القديمة استعادة كلمة السر** (الحسابات الجديدة تُحمى تلقائيًا عند التسجيل). إن ظهرت رسالة "اضغط مرة أخرى" كرره.

### 7) جرّب
- بلاغ جديد **بصورة** ← يجب أن تظهر الصورة.
- تسجيل حساب جديد بكود موظف، ثم قبوله.
- من شاشة الدخول: **نسيت كلمة المرور** ← رقم الهاتف + كود الموظف + كلمة سر جديدة، ثم الدخول بها.
- جرّب كودًا خاطئًا ٦ مرات: يجب أن يُقفل الرقم ويظهر وقت الانتظار.
- حذف مستخدم تجريبي.

## نسيان كلمة السر (بواسطة المستخدم)
المستخدم يغيّر كلمة سره بنفسه: **رقم الهاتف + كود الموظف** المسجلين عند إنشاء الحساب. لا يوجد أي مسار يعيّن فيه الأدمن كلمة سر لأحد، فلا يطّلع عليها أحد.
- الكود يُخزَّن **هاشًا** في `userSecrets/{uid}` (مغلق تمامًا على العملاء)، وليس في مستند `users`.
- الحماية من التخمين: **٥ محاولات فاشلة لكل رقم كل ٢٤ ساعة**، و٤٠ طلبًا لكل جهاز (IP) كل ساعة. العدّاد ذري (طلبات متوازية لا تتجاوزه).
- رسالة الخطأ واحدة سواء الرقم أو الكود خاطئ (لا تكشف وجود الحساب).
- الأمان هنا بقدر **صعوبة تخمين كود الموظف**. كود من ٣ أرقام ضعيف نسبيًا؛ الأفضل كود أطول أو غير متسلسل.

## القيود
- مستخدم نسي كود الموظف **لا يمكنه استعادة كلمة السر** (لا يوجد تدخل من الأدمن بالتصميم). ومن سجّل بكود فارغ سابقًا لا يملك وسيلة استعادة.
- من يعرف رقم هاتف شخص يمكنه استهلاك محاولاته الخمس اليومية فيمنعه مؤقتًا من الاستعادة (ثمن الحماية من التخمين).
- الحد المجاني: 100 ألف طلب يوميًا، و10 ms CPU للطلب. رفع الصور يمر كتدفق مباشر لهذا السبب. لو ظهرت أخطاء `Exceeded CPU Time Limits` في Metrics فأبلغني.
- فحص "آخر Admin" غير ذري (لا transaction): يحدث خلل فقط لو نزّل أدمنان بعضهما في اللحظة نفسها.
- إن سُرّب `SERVICE_ACCOUNT_JSON` فهو مفتاح Admin كامل: ألغِه من Firebase/Google Cloud وولّد غيره.

## إعداد dev المعزول

لا توجّه dev إلى `odd-sun-fab8` أو إلى Worker مرتبط بمشروع `maintenance-defect-system`. أنشئ Worker منفصلًا، وانسخ إليه `worker.mjs`، ثم اربطه بمشروع Firebase dev فقط. لا تنسخ إعدادات أو أسرار Worker الإنتاج.

في Cloudflare Dashboard → Workers & Pages أنشئ Worker dev جديدًا، والصق محتوى `worker.mjs`، ثم من Settings → Variables and Secrets أضف:

| الاسم | النوع | القيمة |
|---|---|---|
| `FIREBASE_ENV` | Text | `development` |
| `FIREBASE_PROJECT_ID` | Text | معرّف Firebase dev |
| `FIREBASE_HOSTING_SITE` | Text | معرّف موقع Hosting dev |
| `ALLOWED_ORIGINS` | Text | `https://<FIREBASE_DEV_HOSTING_SITE>.web.app` فقط؛ أضف نطاق dev البديل فقط عند استخدامه |
| `FIREBASE_API_KEY` | Text | Web API key الخاص بتطبيق Firebase dev |
| `SERVICE_ACCOUNT_JSON` | **Secret** | JSON لحساب خدمة Worker خاص بمشروع dev |
| `IMGBB_API_KEY` | **Secret** | مفتاح ImgBB مستقل لبيئة dev |

احفظ الإعدادات وانشر Worker dev. لا تضع `maintenance-defect-system` أو `my-dev-2026` ضمن إعداد dev. الكود يرفض وضع dev على مشروع الإنتاج، أو حساب خدمة لا يخص المشروع المحدد، أو origins إنتاجية، أو موقع Hosting غير المطابق. endpoint `/health` يعرض فقط البيئة ومعرّف المشروع وموقع Hosting (بيانات عامة) كي يتحقق الـ workflow من التطابق، ولا يعرض bindings السرية.

أنشئ حساب خدمة Worker منفصلًا عن GitHub deployer. امنحه `roles/firebaseauth.admin` و`roles/datastore.user` على مشروع dev فقط؛ راجع IAM permissions الفعلية بعد إضافة الأدوار، لأن حسابه يستطيع القراءة/الكتابة عبر Admin REST متجاوزًا Firestore Security Rules. لا تمنحه Owner أو Editor. خزّن مفاتيحه كـ Cloudflare Secrets فقط، ولا تطبعها أو ترفعها إلى Git.

في Firebase Console، أنشئ Web App وموقع Hosting في مشروع dev، فعّل Email/Password ضمن Authentication، وأضف نطاق Hosting dev إلى Authorized domains، وأنشئ Firestore database. راجع القواعد والفهارس ثم انشرهما يدويًا إلى مشروع dev فقط:

```sh
firebase deploy --only firestore:rules,firestore:indexes --project <FIREBASE_DEV_PROJECT_ID>
```

أضف عنوان Worker dev إلى GitHub variable `FIREBASE_DEV_BACKEND_WORKER_URL`. يجب أيضًا ضبط متغيرات Web App وHosting المدرجة في جذر README، وGitHub Secret `FIREBASE_DEV_SERVICE_ACCOUNT` لحساب Hosting مستقل محدود بصلاحية Firebase Hosting على مشروع dev. هذا المستودع لا يستطيع فحص Cloudflare bindings أو IAM grants الحية؛ اعتبر الإعداد غير مكتمل حتى تُراجعها يدويًا.
