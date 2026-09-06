# Provider Abstraction Layer

هذا المجلد هو نقطة الفصل (Seam) بين منطق التطبيق (services/*.js) وبين
مزوّد الـ Backend الفعلي (حالياً Firebase) ومزوّد استضافة الصور
(حالياً ImgBB).

## الفكرة

- **`services/*.js`** = طبقة Business/Data Access. هي وحدها اللي بتحتوي
  منطق التطبيق (قواعد الصلاحيات، تجميع البيانات، إلخ)، ومفروض متعرفش
  حاجة عن تفاصيل Firebase أو ImgBB الداخلية. دلوقتي كل ملفات
  services بتستورد أي أداة اتصال بالـ Backend (collection, doc,
  getDocs...) من `providers/backend/index.js` بدل ما تستورد مباشرة من
  `firebase.js`/`config.js`، وأي رفع صورة بيتم عبر
  `providers/storage/index.js`.

- **`providers/backend/`** = تنفيذ فعلي (Adapter) لواجهة الـ Backend.
  - `firebaseBackendProvider.js`: التنفيذ الحالي (Firebase Firestore +
    Auth) - بيعيد تصدير نفس الدوال من `firebase.js`/`config.js`.
  - `index.js`: نقطة التبديل الوحيدة. لو حبينا نستبدل Firebase بمزود
    تاني مستقبلاً، بنضيف ملف تنفيذ جديد (مثلاً
    `supabaseBackendProvider.js`) بنفس الأسماء المُصدَّرة، ونغيّر
    سطر واحد بس في `index.js` يشاور عليه بدل Firebase. باقي كل ملفات
    `services/*.js` (وأي كود تاني يستخدم الـ Provider) هيفضل شغال
    من غير أي تعديل.

- **`providers/storage/`** = نفس الفكرة لاستضافة الصور.
  - `storageProvider.js`: توثيق الواجهة المطلوبة (`uploadImage`).
  - `imgbbStorageProvider.js`: التنفيذ الحالي (ImgBB).
  - `index.js`: نقطة التبديل - لتغيير المزود لاحقاً لـ Firebase
    Storage أو Cloudinary مثلاً، بنضيف ملف تنفيذ جديد بنفس الواجهة
    ونغيّر سطر واحد في `index.js`.

## مهم

- هذا التعديل **Abstraction فقط** - لم يتم تغيير أي منطق تطبيق حالي،
  ولا استبدال أي مزود فعلي. Firebase وImgBB لسه هما المزوّدين الوحيدين
  الشغالين فعلياً.
- مفاتيح الـ API (زي `IMGBB_API_KEY`) لسه في مكانها الحالي
  (`config.js`) بنفس القيم - نقل المفاتيح لسيرفر وسيط منفصل عن هذا
  التعديل ومطلوب بشكل مستقل (راجع تقرير المراجعة، بند "F" و"Security").
- `config.js` نفسه لسه مسؤول عن تهيئة Firebase App (`initializeApp`,
  `firebaseConfig`) - ده جزء من "تفاصيل التنفيذ" الطبيعية لأي مزود،
  ومش محتاج يتلف لمكان تاني في هذه المرحلة.

## نقل IMGBB_API_KEY لسيرفر وسيط (آخر بند من F - جاهز، غير مُفعّل)

تم تجهيز الحل الكامل بدون تفعيله فعلياً (بنفس مبدأ عدم عمل Migration
فعلي الآن):

- `functions/index.js` → `uploadImageViaImgbb`: Cloud Function بتخزن
  المفتاح كـ Secret على السيرفر وترفع الصورة نيابة عن العميل.
- `js/providers/storage/serverProxyStorageProvider.js`: تنفيذ بديل
  لواجهة StorageProvider بينادي الـ Function دي بدل ImgBB مباشرة.
- `src-firebase.js`: تم إضافة تصدير `getFunctions`/`httpsCallable`
  (يحتاج `npm run build` لينعكس في `js/firebase.js` الفعلي).

**للتفعيل الكامل (بالترتيب):** `npm run build` → نشر الـ Function
(`functions/README.md`) → تغيير سطر واحد في
`providers/storage/index.js` ليشاور على `serverProxyStorageProvider`
بدل `imgbbStorageProvider` → حذف `IMGBB_API_KEY` من `config.js`
نهائياً بعد التأكد إن كل الرفع بيعدي عبر السيرفر.

