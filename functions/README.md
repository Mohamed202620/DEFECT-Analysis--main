# functions/ — الكود متصل بالواجهة، لسه محتاج نشر فعلي (Phase 3)

⚠️ **الكود هنا بقى متصل فعلاً بالواجهة** (`js/services/usersApi.js`
بينادي عليه عبر `callCloudFunction` -
`js/providers/backend/firebaseBackendProvider.js`)، و`firebase.json`
بقى فيه إعداد `functions` يشاور على المجلد ده. لكن **الدوال نفسها
لسه مش منشورة فعلياً على Firebase** - النشر خطوة بنية تحتية (Infra)
حقيقية (خطة Blaze + `firebase deploy`) لازم تتاخد بمعرفتكم يدوياً،
مش حاجة أقدر أنفذها من هنا. لحد ما تتم، أي محاولة حذف مستخدم أو
تغيير دور "Admin نشط" من الواجهة هترجع رسالة خطأ واضحة (بدل ما
تتظاهر بالنجاح) - راجع `callCloudFunction` في
`firebaseBackendProvider.js`.

## ليه محتاجين الملف ده أصلاً؟

`deleteUserApi()` الحالية (في `js/services/usersApi.js`) بتحذف
مستند المستخدم من Firestore بس. حساب Firebase Authentication نفسه
(اللي بيسمح بتسجيل الدخول بكلمة السر) **مينفعش يتحذف من كود
العميل (Client SDK) لأي مستخدم غير المستخدم المسجّل دخوله حالياً** -
ده قيد من Firebase نفسه، مش نقص في الكود. الحل الوحيد هو استدعاء
`admin.auth().deleteUser(uid)` من سيرفر موثوق (Cloud Function) عن
طريق **Firebase Admin SDK**.

(تم عمل إصلاح جزئي منفصل بدون الحاجة لهذا الملف: `js/auth/login.js`
دلوقتي بيعمل `signOut()` فوراً لو حساب Auth موجود لكن مستنده في
Firestore محذوف، بدل ما يسيبه شكلياً "مسجّل دخول" - راجع الكومنت
هناك. ده بيمنع أي إرباك في الواجهة، لكن مايحذفش حساب الدخول نفسه.)

## الدوال الموجودة في هذا المجلد

1. **`deleteUserAccount`** — حذف حساب Firebase Auth الفعلي + مستند
   Firestore معاً عند حذف مستخدم (بند B3 في تقرير المراجعة). فحص
   "آخر Admin" + حذف المستند بيحصلوا معاً جوه Firestore Transaction
   واحدة ذرّية (راجع التعليق فوق الدالة في `index.js`) - عشان طلبين
   حذف متزامنين لأدمنين مختلفين ميقدروش يسيبوا النظام من غير أي
   Admin نشط. بينادي عليها `deleteUserApi` في
   `js/services/usersApi.js`.
2. **`updateUserRoleAccount`** — تغيير دور مستخدم في الحالة الحرجة
   بس: المستخدم المستهدف "Admin نشط" حالياً والدور الجديد مش
   "admin" (بند A1 في تقرير المراجعة - حماية "آخر Admin" على مستوى
   السيرفر، مش بس `firestore.rules`/الواجهة). نفس آلية الحماية
   الذرّية بتاعة `deleteUserAccount` فوق (Firestore Transaction).
   بينادي عليها `updatePermissionsApi` في نفس الملف، وبس في هذه
   الحالة تحديداً - باقي تغييرات الدور لسه بتحصل مباشرة عبر
   `updateDoc()`.
3. **`uploadImageViaImgbb`** — رفع الصور عبر ImgBB من السيرفر بدل
   كشف المفتاح في كود العميل (بند F/الأمان في تقرير المراجعة).
   محتاجة خطوة إضافية قبل النشر: تخزين المفتاح كـ Secret (مش في أي
   ملف بالمستودع):
   ```
   firebase functions:secrets:set IMGBB_API_KEY
   ```
   (هيطلب منك تلصق قيمة المفتاح الحالي من `js/config.js`، وبعد
   التأكد إن الرفع بيشتغل عبر السيرفر تقدر تشيله من `config.js`
   نهائياً - راجع `js/providers/README.md` لخطوات التفعيل الكاملة
   على مستوى العميل). هذه الدالة غير مرتبطة بإصلاحات Phase 3 (#4/#5)
   - موجودة هنا من قبل.

## خطوات النشر المطلوبة (يدوي - محتاج منكم)

1. **الاشتراك لازم يكون على خطة Blaze** (Pay-as-you-go) - Cloud
   Functions مش متاحة على الخطة المجانية (Spark) خالص. ده قرار
   فوترة (Billing) لازم يتاخد بمعرفتكم، مش حاجة أقدر أنفذها.
2. من جذر المشروع (`firebase.json` بقى فيه إعداد `functions` جاهز):
   لو `functions/node_modules` مش موجودة:
   ```
   cd functions && npm install
   ```
   (لو `firebase init functions` سألكم "overwrite functions/index.js؟"
   قولوا لأ، خلوه ياخد الملف الموجود هنا).
3. **نشر قواعد Firestore الجديدة كمان** (بند A1 - حماية آخر Admin -
   `firestore.rules` اتعدّل في هذه المرحلة):
   ```
   firebase deploy --only firestore:rules
   ```
4. نشر الدوال:
   ```
   firebase deploy --only functions
   ```
5. **تأكيد الـ region الفعلي**: الكود الحالي (`deleteUserAccount` و
   `updateUserRoleAccount` في `index.js`، و`FIREBASE_FUNCTIONS_REGION`
   في `js/config.js`) بيفترض `us-central1` (الافتراضي لو محددتوش
   region تاني). لو غيّرتوا الـ region هنا، لازم تغيّروا
   `FIREBASE_FUNCTIONS_REGION` في `js/config.js` بنفس القيمة (أو
   `window.APP_CONFIG.FIREBASE_FUNCTIONS_REGION`) عشان رابط
   الاستدعاء من المتصفح (`callCloudFunction` في
   `firebaseBackendProvider.js`) يطابق فعلاً.
6. بعد النشر، جربوا سيناريوهات الاختبار المذكورة في تقرير Phase 3
   (حذف مستخدم عادي، حذف آخر Admin - المفروض يترفض، تغيير دور
   Admin→فني مع وجود أدمن تاني، تغيير دور آخر Admin - المفروض يترفض،
   ومحاولة `updateDoc()`/`deleteDoc()` مباشرة من Console المتصفح
   على مستند Admin نشط - المفروض `firestore.rules` ترفضها فوراً حتى
   لو الدوال نفسها لسه مش منشورة).

## ملاحظة أمان

الدالتين بيتحققوا بنفسهم (على السيرفر، مش بس بيتوكلوا على الواجهة)
إن اللي بينادي عليهم Admin نشط فعلاً عن طريق قراءة مستنده في
Firestore مباشرة - نفس مبدأ "الصلاحيات بتتفحص في القاعدة/السيرفر
مش في الواجهة بس" المطبّق في `firestore.rules`. Firebase Admin SDK
(المُستخدم جوه الدوال) بيتجاوز `firestore.rules` تلقائياً، فده اللي
بيخلي الدالتين قادرين ينفذوا الحذف/التعديل رغم إن `firestore.rules`
بقى يمنع نفس العمليات دي من كود العميل مباشرة.
