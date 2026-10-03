# الـ Worker البديل المجاني لـ Cloud Functions

يعمل على Cloudflare Workers (خطة Free، بدون بطاقة) ويغني عن ترقية Firebase إلى Blaze.
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
| `FIREBASE_PROJECT_ID` | Text | `maintenance-defect-system` |
| `SERVICE_ACCOUNT_JSON` | **Secret** | محتوى ملف JSON كاملًا |
| `IMGBB_API_KEY` | **Secret** | مفتاح ImgBB (ولّد مفتاحًا جديدًا من imgbb.com/api: القديم كان ظاهرًا في الكود) |
| `ALLOWED_ORIGINS` | Text (اختياري) | نطاقات التطبيق مفصولة بفواصل. الافتراضي: نطاقات `maintenance-defect-system` و`my-dev-2026` و`localhost:3000` |

اضغط **Deploy** بعد الحفظ، ثم احذف ملف JSON من الجهاز.

### 4) اختبار الـ Worker
افتح `https://odd-sun-fab8.mom379339.workers.dev/health` في المتصفح، ويجب أن يظهر `{"ok":true}`.

### 5) انشر التطبيق (بدون Functions)
```
firebase deploy --only hosting,firestore:rules,firestore:indexes
```
(النشر عبر GitHub Actions ينشر الاستضافة فقط، وهذا مناسب. أما القواعد والفهارس فانشرها بالأمر أعلاه.)

### 6) جرّب
- بلاغ جديد **بصورة** ← يجب أن تظهر الصورة.
- أدمن: "إعادة تعيين كلمة السر" لمستخدم، ثم دخوله بالكلمة الجديدة.
- حذف مستخدم تجريبي.

## القيود
- `migrateLegacyAccount` (ترحيل الحسابات القديمة) **غير مدعومة**؛ مستخدم قديم غير مرحَّل لن يستطيع الدخول.
- الحد المجاني: 100 ألف طلب يوميًا، و10 ms CPU للطلب. رفع الصور يمر كتدفق مباشر لهذا السبب. لو ظهرت أخطاء `Exceeded CPU Time Limits` في Metrics فأبلغني.
- فحص "آخر Admin" غير ذري (لا transaction): يحدث خلل فقط لو نزّل أدمنان بعضهما في اللحظة نفسها.
- إن سُرّب `SERVICE_ACCOUNT_JSON` فهو مفتاح Admin كامل: ألغِه من Firebase/Google Cloud وولّد غيره.
