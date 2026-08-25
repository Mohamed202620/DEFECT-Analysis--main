# ملفات مُعدَّلة - داشبورد الرئيسية (Home Dashboard Upgrade)

3 ملفات فقط اتغيّروا، طبقاً لمراجعة الـ UI/UX السابقة. انسخهم فوق نفس المسارات
في مشروعك (استبدال كامل).

## 1) js/views/homeView.js
- **إصلاح حرج:** الكارتات كانت بألوان ثابتة (`bg-[#1E293B]`, `text-white`) بدل
  متغيرات الثيم (`dyn-card`, `dyn-text-muted`) - يعني زرار الوضع الليلي/النهاري
  كان بيقلب شريط التنقل السفلي بس وباقي الصفحة ثابتة. اتصلحت بالكامل.
- استبدال كل الإيموجي في كارتات الـ KPI والوصول السريع بأيقونات SVG داخل
  دائرة gradient.
- Badge أحمر نابض (`animate-pulse`) يظهر تلقائياً فوق "أعطال مفتوحة" لو فيه
  بلاغ بأولوية High مفتوح.
- 3 كارتات جديدة: متوسط زمن الإصلاح (MTTR)، أكثر ماكينة عطلاً، أفضل فني -
  IDs جاهزة (`statMttrValue`, `statTopMachineName`, `statTopTechName`) بتتملى
  من workflow.js.
- عنصر `kaizenNeedsEditBadge` جاهز كـ hook لعدد مقترحات "يحتاج تعديل" لكن
  متروك عمداً بدون بيانات حية (يحتاج real-time listener + cleanup، شرحت
  السبب في تعليق داخل الكود).
- باقي الأزرار (واتساب / تسجيل الخروج / الفوتر) بقت تستخدم متغيرات الثيم
  بدل الألوان الثابتة.
- كل الـ IDs القديمة (`statOpenCount`, `statClosedCount`, ...) اتحفظت زي
  ما هي - مفيش أي كسر لأي كود تاني بيعتمد عليها.

## 2) js/workflow.js
- استيراد `computeMTTR` / `computeTopMachines` / `computeTechnicianPerformance`
  من `statistics.js` (بدل تكرار المنطق).
- `loadDashboardStats()` بقت كمان تحسب: هل فيه بلاغ حرج مفتوح (لـ badge
  الـ Critical) + MTTR + أكثر ماكينة + أفضل فني، وتحدّث الـ DOM بنفس نمط
  `setText` الموجود بالفعل - **بدون أي استعلام إضافي لقاعدة البيانات**
  (نفس مصفوفة `tickets` اللي بتتجاب أصلاً).

## 3) js/statistics.js
- تغيير وحيد: إضافة `export` لثلاث دوال كانت داخلية
  (`computeMTTR`, `computeTopMachines`, `computeTechnicianPerformance`)
  عشان `workflow.js` يقدر يستخدمها. **صفر تغيير في منطق أي دالة.**

---

⚠️ ملحوظة: الملفات دي بُنيت بالاعتماد على السياق الموجود في الـ zip اللي
بعتهولي (بما فيه `permissions.js`, `dashboardApi.js`, `router.js`,
`renderCore.js`) لكن من غير تشغيل فعلي على Firebase حقيقي أو على الموبايل
- يُفضّل تختبرها محلياً (Dark/Light toggle، وظهور/اختفاء الـ Critical badge،
والكارتات الجديدة) قبل ما تنزلها للإنتاج.
