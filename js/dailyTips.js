// ============================================================
// js/dailyTips.js
// نظام «معلومة على الماشي» (Daily Insights & Tips)
// - كارت ثابت في صفحة النظام يتغير يومياً الساعة 12:00 ظهراً
// - Toast منبثق يظهر مرتين يومياً (بعد 5 ثوانٍ ثم بعد 4 ساعات)
//   ويختفي بعد 7 ثوانٍ ولا يتكرر في نفس اليوم
// - 60 معلومة حصرية ومحققة بـ العربية والإنجليزية (دينية، تحفيزية، صناعية، عامة)
// ============================================================

export const TIPS_AR = [
  {
    "id": 1,
    "category": "religious",
    "categoryTitle": "إتقان وعمل",
    "title": "قيمة الإتقان في العمل",
    "text": "قال النبي ﷺ: «إنَّ اللهَ تعالى يُحِبُّ إذا عمِلَ أحدُكُم عَمَلاً أنْ يُتْقِنَهُ». الإتقان ليس مجرد مهارة، بل عبادة ومسؤولية أخلاقية ترفع شأن صاحبها ومؤسسته."
  },
  {
    "id": 2,
    "category": "religious",
    "categoryTitle": "أمانة ومسؤولية",
    "title": "الأمانة في بيئة العمل",
    "text": "قال تعالى: ﴿إِنَّ خَيْرَ مَنِ اسْتَأْجَرْتَ الْقَوِيُّ الْأَمِينُ﴾. القوة في الكفاءة المهنية، والأمانة في صيانة الممتلكات وحفظ أسرار العمل وسلامة الفريق."
  },
  {
    "id": 3,
    "category": "religious",
    "categoryTitle": "تعاون ومشاركة",
    "title": "بركة العمل الجماعي",
    "text": "قال تعالى: ﴿وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّقْوَى﴾. نجاح خطوط الإنتاج والصيانة يعتمد على تكامل السواعد ونقاء النوايا وروح الفريق الواحد."
  },
  {
    "id": 4,
    "category": "religious",
    "categoryTitle": "صدق وإخلاص",
    "title": "الصدق في التقارير الفنية",
    "text": "قال النبي ﷺ: «عَلَيْكُمْ بِالصِّدْقِ فَإِنَّ الصِّدْقَ يَهْدِي إِلَى الْبِرِّ». تسجيل الأعطال والأرقام بدقة وصدق دون مواربة هو أساس الصيانة الناجحة."
  },
  {
    "id": 5,
    "category": "religious",
    "categoryTitle": "حفظ النعم والموارد",
    "title": "صيانة الماكينات شكر للنعمة",
    "text": "الحفاظ على المعدات وترشيد استهلاك قطع الغيار والطاقة هو صون للمقدرات وشكر عملي لنعم الله، وتجنب للإهدار والتبذير."
  },
  {
    "id": 6,
    "category": "religious",
    "categoryTitle": "سلامة ووقاية",
    "title": "حفظ النفس والسلامة أولاً",
    "text": "قال تعالى: ﴿وَلَا تُلْقُوا بِأَيْدِيكُمْ إِلَى التَّهْلُكَةِ﴾. الالتزام بإجراءات السلامة المهنية ومهمات الوقاية الشخصية واجب ديني وأخلاقي لحماية الأرواح."
  },
  {
    "id": 7,
    "category": "religious",
    "categoryTitle": "حسن المعاملة",
    "title": "الكلمة الطيبة والروح الإيجابية",
    "text": "قال النبي ﷺ: «والكَلِمَةُ الطَّيِّبَةُ صَدَقَةٌ». التقدير المتبادل والتعامل الراقي بين الفنيين والمهندسين والإداريين ينشر بيئة عمل محفزة ومثمرة."
  },
  {
    "id": 8,
    "category": "religious",
    "categoryTitle": "إتقان وسعي",
    "title": "شرف الكسب باليد",
    "text": "سُئل رسول الله ﷺ: أي الكسب أطيب؟ قال: «عَمَلُ الرَّجُلِ بِيَدِهِ، وكُلُّ بَيْعٍ مَبْرُورٍ». العمل الصناعي واليدوي من أشرف الأعمال التي تبني الأوطان."
  },
  {
    "id": 9,
    "category": "religious",
    "categoryTitle": "عدالة وتقدير",
    "title": "أداء الحقوق لأصحابها",
    "text": "قال النبي ﷺ: «أَعْطُوا الأَجِيرَ أَجْرَهُ قَبْلَ أَنْ يَجِفَّ عَرَقُهُ». التقدير المادي والمعنوي لجهد كل عامل وفني هو عماد الاستقرار المؤسسي."
  },
  {
    "id": 10,
    "category": "religious",
    "categoryTitle": "بصيرة وتطوير",
    "title": "طلب العلم والتطوير المستمر",
    "text": "قال تعالى: ﴿وَقُل رَّبِّ زِدْنِي عِلْمًا﴾. مواكبة التقنيات الحديثة وفهم أسرار الماكينات ومخططاتها الكهربائية والميكانيكية هو سعي محمود في العلم."
  },
  {
    "id": 11,
    "category": "religious",
    "categoryTitle": "نصح وتوجيه",
    "title": "النصيحة ونقل الخبرة",
    "text": "قال النبي ﷺ: «الدِّينُ النَّصِيحَةُ». تدريب الزملاء الجدد ونقل خبرات الصيانة المتراكمة بأمانة دون كتمان يثري رأس المال البشري للمصنع."
  },
  {
    "id": 12,
    "category": "religious",
    "categoryTitle": "صبر وحكمة",
    "title": "الصبر عند تشخيص الأعطال",
    "text": "تشخيص الأعطال المعقدة يتطلب نفساً صبوراً وفكراً متأنياً. استعن بالهدوء والمنهج العلمي في تتبع الأسباب الجذرية."
  },
  {
    "id": 13,
    "category": "religious",
    "categoryTitle": "نظافة وتنظيم",
    "title": "النظافة وترتيب مكان العمل",
    "text": "النظافة عنوان التحضر ودعامة الأمان؛ نظافة المعدات وأرضية المصنع وترتيب العدد يكشف التسريبات مبكراً ويمنع حوادث الانزلاق."
  },
  {
    "id": 14,
    "category": "religious",
    "categoryTitle": "وفاء بالعهود",
    "title": "الالتزام بمواعيد الصيانة والتسليم",
    "text": "قال تعالى: ﴿وَأَوْفُوا بِالْعَهْدِ ۖ إِنَّ الْعَهْدَ كَانَ مَسْئُولًا﴾. احترام خطط الصيانة الوقائية ومواعيد تسليم خطوط الإنتاج يبني الثقة والمصداقية."
  },
  {
    "id": 15,
    "category": "religious",
    "categoryTitle": "نية وعطاء",
    "title": "استحضار النية الصالحة",
    "text": "اجعل عملك اليومي وسعيك على رزق أسرتك بنية إعمار الأرض وسد احتياجات مجتمعك، فتتحول ساعات العمل إلى حسنات مضاعفة."
  },
  {
    "id": 16,
    "category": "motivational",
    "categoryTitle": "تحفيز وجودة",
    "title": "مفهوم الجودة الحقيقية",
    "text": "الجودة ليست حدثاً عارضاً، بل هي عادة يومية تُمارس عندما لا يراك أحد. افعل الشيء الصحيح دائماً بأعلى معايير الإتقان."
  },
  {
    "id": 17,
    "category": "motivational",
    "categoryTitle": "انضباط وتركيز",
    "title": "الانضباط يصنع الفارق",
    "text": "الدافع يجعلك تبدأ، لكن الانضباط اليومي هو ما يجعلك تستمر وتتفوق. خطوة دقيقة ثابتة يومياً تبني مصنعاً رائداً عالمياً."
  },
  {
    "id": 18,
    "category": "motivational",
    "categoryTitle": "عمل جماعي",
    "title": "قوة الفريق المتكامل",
    "text": "الموهبة تكسب المباريات الفردية، لكن العمل الجماعي والتنسيق العالي بين الصيانة والإنتاج والجودة هو ما يصنع البطولات الصناعية."
  },
  {
    "id": 19,
    "category": "motivational",
    "categoryTitle": "تحسين كايزن",
    "title": "فلسفة التحسين المستمر (Kaizen)",
    "text": "لا تنتظر أزمة لتبتكر؛ تحسين بسيط بنسبة 1% يومياً في بيئة العمل يؤدي إلى نقلة نوعية هائلة وتراكمية على مدار العام."
  },
  {
    "id": 20,
    "category": "motivational",
    "categoryTitle": "مرونة وابتكار",
    "title": "العطل هو فرصة للتعلم",
    "text": "كل توقف أو خلل غير متوقع يحمل درساً قيماً. وثّق المشكلة وحللها لتضمن عدم تكرارها مرة أخرى لبناء قاعدة معرفة صلبة."
  },
  {
    "id": 21,
    "category": "motivational",
    "categoryTitle": "شغف ومهنية",
    "title": "الفخر بالصناعة",
    "text": "كل منتج يخرج من خطوط الإنتاج يحمل بصمة جهدك وعرقك. فليكن عملك مصدر فخر لك ولعائلتك ولمصنعك."
  },
  {
    "id": 22,
    "category": "motivational",
    "categoryTitle": "إدارة الوقت",
    "title": "قيمة الدقائق في الإنتاج",
    "text": "في عالم الصناعة، تقليل زمن التوقف (Downtime) بمقدار 5 دقائق يعني إنتاج مئات الوحدات الإضافية وتوفير تكاليف تشغيلية ثمينة."
  },
  {
    "id": 23,
    "category": "motivational",
    "categoryTitle": "مبادرة وإيجابية",
    "title": "كن صاحب المبادرة الأولى",
    "text": "لا تنتظر حتى يطلب منك أحد إصلاح الخلل الظاهر أو رفع تقرير؛ المبادرة السريعة تعكس عقلية القيادة والحرص على الصالح العام."
  },
  {
    "id": 24,
    "category": "motivational",
    "categoryTitle": "تركيز ودقة",
    "title": "التفاصيل الصغيرة تصنع التميز",
    "text": "المصانع العالمية لا تختلف عن غيرها في الآلات الكبرى فحسب، بل في اهتمامها الدقيق بأدق تفاصيل المعايرة والربط والتنظيف."
  },
  {
    "id": 25,
    "category": "motivational",
    "categoryTitle": "تقدير الذات",
    "title": "أنت ركيزة أساسية في النجاح",
    "text": "بدون جهود فريق الصيانة والفنيين والمهندسين لا تدور عجلة الإنتاج. دورك حيوي ومحوري في استمرارية نبض الشركة."
  },
  {
    "id": 26,
    "category": "motivational",
    "categoryTitle": "تفكير حل المشكلات",
    "title": "التركيز على الحلول لا اللوم",
    "text": "عند وقوع العطل، استثمر طاقتك 20% في فهم ما حدث و80% في إيجاد الحل الجذري لمنع تكراره، بعيداً عن ثقافة إلقاء اللوم."
  },
  {
    "id": 27,
    "category": "motivational",
    "categoryTitle": "إتقان مهني",
    "title": "المهنية سلوك متكامل",
    "text": "المهنية تبدأ من الالتزام بالمظهر المناسب وارتداء مهمات الوقاية، مروراً بالحديث المهذب، وصولاً إلى تسليم التقارير الفنية المكتملة."
  },
  {
    "id": 28,
    "category": "motivational",
    "categoryTitle": "روح التحدي",
    "title": "تحدي الأهداف والمستهدفات",
    "text": "رفع كفاءة المعدات (OEE) وتقليل نسبة الهالك (Scrap) ليست أرقاماً جافة، بل تحديات يومية تثبت قدرات وكفاءة فريق العمل."
  },
  {
    "id": 29,
    "category": "motivational",
    "categoryTitle": "ثقافة الشفافية",
    "title": "الوضوح سر السرعة",
    "text": "التواصل المباشر والشفاف بين الورديات واكتمال سجل التسليم والتسلم يمنع هدر الساعات ويضمن تدفق العمل بدون انقطاع."
  },
  {
    "id": 30,
    "category": "motivational",
    "categoryTitle": "تطوير مستمر",
    "title": "استثمر في مهاراتك يومياً",
    "text": "قراءة دليل تشغيل جديد أو فهم رسم بياني كهربائي أو تعلم حيلة في المعايرة يرفع قيمتك السوقية وخبرتك الاحترافية باستمرار."
  },
  {
    "id": 31,
    "category": "industrial",
    "categoryTitle": "صيانة ووقاية",
    "title": "الصيانة الوقائية (PM)",
    "text": "الصيانة الوقائية المنفذة في موعدها تكلف 10 أضعاف أقل من الإصلاح الطارئ بعد انهيار المعدة، وتحمي جدول الإنتاج من المفاجآت."
  },
  {
    "id": 32,
    "category": "industrial",
    "categoryTitle": "منهجية 5S",
    "title": "تطبيق منهجية الـ 5S اليابانية",
    "text": "تصنيف (Sort)، ترتيب (Set in order)، تنظيف (Shine)، توحيد المعايير (Standardize)، واستدامة (Sustain) — سر بيئة العمل الآمنة والمنتجة."
  },
  {
    "id": 33,
    "category": "industrial",
    "categoryTitle": "سلامة مهنية",
    "title": "إجراءات LOTO لقفل مصادر الطاقة",
    "text": "عزل مصادر الطاقة وتطبيق بطاقات وقفل الأمان (Lockout/Tagout) قبل فتح أي لوحة كهربائية أو جزء متحرك يحمي حياتك وزملاءك."
  },
  {
    "id": 34,
    "category": "industrial",
    "categoryTitle": "صيانة شاملة TPM",
    "title": "الصيانة الذاتية للمشغل (Autonomous Maintenance)",
    "text": "المشغل هو خط الدفاع الأول للماكينة؛ الفحص البصري اليومي واكتشاف الأصوات والاهتزازات غير الطبيعية يمنع 70% من الأعطال الكارثية."
  },
  {
    "id": 35,
    "category": "industrial",
    "categoryTitle": "تحليل الأسباب الجذرية",
    "title": "منهجية لماذا الخمس (5 Whys)",
    "text": "عند حدوث العطل، اسأل 'لماذا؟' 5 مرات متتالية للوصول إلى الجذر الحقيقي للمشكلة بدلاً من الاكتفاء بمعالجة العَرَض السطحي."
  },
  {
    "id": 36,
    "category": "industrial",
    "categoryTitle": "مؤشرات الأداء OEE",
    "title": "الفاعلية الشاملة للمعدات (OEE)",
    "text": "مؤشر OEE يقيس: الإتاحة (Availability) × الأداء (Performance) × الجودة (Quality). تحسين أي عنصر يرفع العائد الإنتاجي فوراً."
  },
  {
    "id": 37,
    "category": "industrial",
    "categoryTitle": "تزييت وتشحيم",
    "title": "التزييت والتشحيم الصحيح",
    "text": "أكثر من 50% من تلف المحامل (Bearings) ناتج عن سوء التشحيم أو تلوث الشحم. التزم بالنوع والكمية والجدول الزمني الموصى به."
  },
  {
    "id": 38,
    "category": "industrial",
    "categoryTitle": "حماية من الخطأ",
    "title": "مبدأ بوكا يوكي (Poka-Yoke)",
    "text": "تصميم عمليات التجميع والصيانة بطريقة تجعل من المستحيل تركيب القطعة مقلوبة أو عكس الاتجاه يقضي على الأخطاء البشرية تماماً."
  },
  {
    "id": 39,
    "category": "industrial",
    "categoryTitle": "حرارة وكهرباء",
    "title": "الفحص الحراري للوحات الكهرباء",
    "text": "ارتفاع درجة حرارة القواطع والروزتات مؤشر مباشر على ارتخاء الربط أو زيادة الحمل؛ الفحص الدوري يمنع حرائق اللوحات الكهربائية."
  },
  {
    "id": 40,
    "category": "industrial",
    "categoryTitle": "هواء مضغوط ونيوماتيك",
    "title": "تسريبات الهواء المضغوط هدر خفي",
    "text": "تسريب هواء بقطر 3 ملم في شبكة النيوماتيك يهدر آلاف الكيلوواط سنوياً. صيانة الخراطيم والوصلات تحافظ على ضغط الخط وتوفر الطاقة."
  },
  {
    "id": 41,
    "category": "industrial",
    "categoryTitle": "معايرة وأجهزة",
    "title": "أهمية المعايرة الدورية للمقاييس",
    "text": "أجهزة قياس الحرارة والضغط والوزن تفقد دقتها تدريجياً. المعايرة المجدولة تضمن بقاء المنتجات مطابقة للمواصفات القياسية الدولية."
  },
  {
    "id": 42,
    "category": "industrial",
    "categoryTitle": "مؤشرات MTTR و MTBF",
    "title": "مؤشرات سرعة الإصلاح واستقرار المعدة",
    "text": "هدف الصيانة تقليل MTTR (متوسط زمن الإصلاح) وزيادة MTBF (متوسط الزمن بين الأعطال) لضمان أعلى موثوقية للخطوط."
  },
  {
    "id": 43,
    "category": "industrial",
    "categoryTitle": "محاذاة وربط",
    "title": "محاذاة المحاور وسيور الحركة",
    "text": "عدم محاذاة الطنابير وسيور النقل يسبب اهتزازات وتآكل سريع للسيور وتلف رولمان البلي. تحقق دائماً من الشد والمحاذاة بالليزر."
  },
  {
    "id": 44,
    "category": "industrial",
    "categoryTitle": "إدارة قطع الغيار",
    "title": "المخزون الاستراتيجي للقطع الحرجة",
    "text": "تحديد قطع الغيار الحرجة (Critical Spares) والاحتفاظ بحد أمان أدنى يمنع توقف المصنع لأيام انتظاراً لشحنة استيراد طارئة."
  },
  {
    "id": 45,
    "category": "industrial",
    "categoryTitle": "تحسين مستمر",
    "title": "توثيق التعديلات الفنية (Engineering Change)",
    "text": "أي تعديل كهربائي أو ميكانيكي على الماكينة يجب تحديثه فوراً في المخططات ورسم الدوائر حتى لا يضلل الفنيين في المستقبل."
  },
  {
    "id": 46,
    "category": "general",
    "categoryTitle": "معرفة وتطوير",
    "title": "قاعدة 80/20 في الأعطال (Pareto)",
    "text": "80% من ساعات التوقف غالباً سببها 20% فقط من الماكينات أو القطع الحرجة. ركّز جهود الصيانة المركزة على هذه الـ 20% أولاً."
  },
  {
    "id": 47,
    "category": "general",
    "categoryTitle": "تواصل مهني",
    "title": "تسليم الوردية الفعال",
    "text": "التسليم الشفهي والكتابي الدقيق بين الورديات حول سلوك الماكينات والملاحظات الغريبة يوفر ساعات من التشخيص الضائع على الوردية القادمة."
  },
  {
    "id": 48,
    "category": "general",
    "categoryTitle": "بيئة العمل وإرجونوميكس",
    "title": "الوضعيات السليمة لحمل الأوزان",
    "text": "احرص على ثني الركبتين واستقامة الظهر عند رفع المحركات أو المعدات الثقيلة، واستعن بالروافع لتفادي إصابات العمود الفقري."
  },
  {
    "id": 49,
    "category": "general",
    "categoryTitle": "هدر صناعي (Muda)",
    "title": "القضاء على أشكال الهدر السبعة",
    "text": "في الإنتاج الرشيق: تقليل النقل الزائد، الحركات غير الضرورية، الانتظار، وفرط المعالجة يضاعف الإنتاجية بدون أي تكاليف إضافية."
  },
  {
    "id": 50,
    "category": "general",
    "categoryTitle": "إدارة الأزمات",
    "title": "الهدوء والتفكير المتسلسل في الطوارئ",
    "text": "عند التوقف الحرج، اتّبع شجرة التشخيص خطوة بخطوة؛ التسرع في تغيير القطع عشوائياً يعقد المشكلة ويزيد وقت التوقف."
  },
  {
    "id": 51,
    "category": "general",
    "categoryTitle": "أتمتة وحساسات",
    "title": "نظافة الحساسات والخلايا الكهروضوئية",
    "text": "تراكم الغبار أو بقع الزيت على عدسات الحساسات الضوئية ومفاتيح النهاية (Limit Switches) سبب رئيسي في توقفات الخطوط الوهمية."
  },
  {
    "id": 52,
    "category": "general",
    "categoryTitle": "تحكم وتطوير",
    "title": "أخذ نسخ احتياطية لبرامج PLC",
    "text": "الاحتفاظ بنسخ احتياطية دورية ومحدثة من برامج التحكم PLC وشاشات HMI يحمي المصنع من التوقف الطويل عند تلف كروت الذاكرة."
  },
  {
    "id": 53,
    "category": "general",
    "categoryTitle": "صحة وسلامة",
    "title": "الإضاءة والتهوية في صالة الإنتاج",
    "text": "الإضاءة الكافية في نقاط الفحص والتهوية الجيدة تقلل إجهاد المشغلين وتخفض احتمالية ارتكاب الأخطاء الفنية بنسبة تفوق 30%."
  },
  {
    "id": 54,
    "category": "general",
    "categoryTitle": "هندسة ومواصفات",
    "title": "معايير العزم السليم للبراغي (Torque)",
    "text": "استخدام مفتاح العزم (Torque Wrench) لربط البراغي بالقوة المحددة يمنع تلف السن وارتخاء المسامير تحت تأثير الاهتزازات المستمرة."
  },
  {
    "id": 55,
    "category": "general",
    "categoryTitle": "مراقبة بيئية",
    "title": "التخلص الآمن من الزيوت المستهلكة",
    "text": "تجميع الزيوت والمذيبات المستعملة في أوعية مخصصة وإعادة تدويرها يحمي شبكات الصرف والبيئة ويعزز الامتثال لمعايير ISO 14001."
  },
  {
    "id": 56,
    "category": "general",
    "categoryTitle": "تنظيم العدد",
    "title": "لوحات الظل للعدد والأدوات (Shadow Board)",
    "text": "تخصيص مكان محدد وظل مرسوم لكل أداة ومفتاح يضمن استرجاعها فوراً بعد الصيانة ويمنع نسيان أي أداة داخل جسم الماكينة."
  },
  {
    "id": 57,
    "category": "general",
    "categoryTitle": "تخطيط استباقي",
    "title": "الصيانة التنبؤية (Predictive Maintenance)",
    "text": "استخدام تحليل الاهتزازات والتصوير الحراري يكشف علامات الفشل المبكرة قبل أسابيع من الانهيار الفعلي، مما يتيح التدخل المجدول."
  },
  {
    "id": 58,
    "category": "general",
    "categoryTitle": "تطوير العمليات",
    "title": "دورة ديمنج للتحسين المستمر (PDCA)",
    "text": "خطط (Plan) -> نفّذ (Do) -> افحص النتائج (Check) -> طبّق التحسين قياسياً (Act). تكرار هذه الدورة يضمن التطور المؤسسي الدائم."
  },
  {
    "id": 59,
    "category": "general",
    "categoryTitle": "توحيد العمليات SOP",
    "title": "إجراءات التشغيل القياسية (SOP)",
    "text": "كتابة خطوات واضحة ومصورة لإجراءات التشغيل والصيانة يضمن الحصول على نفس الجودة العالية بغض النظر عن الفني المنفذ."
  },
  {
    "id": 60,
    "category": "general",
    "categoryTitle": "رؤية مستقبلية",
    "title": "التحول الرقمي للصيانة (CMMS)",
    "text": "استخدام هذا النظام الرقمي لتسجيل البلاغات وقطع الغيار وسجلات الماكينات يحول البيانات اليومية إلى رؤى استراتيجية تقود المصنع نحو المستقبل."
  }
];

export const TIPS_EN = [
  {
    "id": 1,
    "category": "religious",
    "categoryTitle": "Mastery & Craftsmanship",
    "title": "The Value of Perfection in Work",
    "text": "The Prophet ﷺ said: 'God loves that whenever any of you does a job, he accomplishes it with mastery and precision.' Professional mastery is both a virtue and an ethical duty that elevates the worker and the organization."
  },
  {
    "id": 2,
    "category": "religious",
    "categoryTitle": "Integrity & Responsibility",
    "title": "Integrity in the Workplace",
    "text": "The Quran highlights: 'The best one you can hire is the strong and the trustworthy.' Strength lies in technical competence, and trustworthiness lies in safeguarding assets, trade secrets, and team safety."
  },
  {
    "id": 3,
    "category": "religious",
    "categoryTitle": "Cooperation & Teamwork",
    "title": "The Power of Collaboration",
    "text": "The Quran urges: 'Cooperate in righteousness and piety.' The success of manufacturing lines and maintenance relies on unified efforts, sincere intentions, and genuine teamwork."
  },
  {
    "id": 4,
    "category": "religious",
    "categoryTitle": "Honesty & Transparency",
    "title": "Honesty in Technical Reporting",
    "text": "The Prophet ﷺ said: 'Adhere to truthfulness, for truthfulness leads to righteousness.' Logging defects, downtime, and operational metrics accurately without concealment is the foundation of effective maintenance."
  },
  {
    "id": 5,
    "category": "religious",
    "categoryTitle": "Resource Stewardship",
    "title": "Maintaining Machinery as Stewardship",
    "text": "Properly servicing industrial equipment and economizing spare parts and energy usage is a practical gratitude for resources and a prevention of wasteful consumption."
  },
  {
    "id": 6,
    "category": "religious",
    "categoryTitle": "Safety & Prevention",
    "title": "Preserving Life & Safety First",
    "text": "The Quran commands: 'Do not throw yourselves into destruction with your own hands.' Strict adherence to occupational health and personal protective equipment (PPE) is an ethical obligation to safeguard lives."
  },
  {
    "id": 7,
    "category": "religious",
    "categoryTitle": "Kind Demeanor",
    "title": "Good Words & Positive Spirit",
    "text": "The Prophet ﷺ said: 'A kind word is an act of charity.' Mutual respect and constructive communication among technicians, engineers, and supervisors cultivate a motivating and productive workplace."
  },
  {
    "id": 8,
    "category": "religious",
    "categoryTitle": "Dignity of Labor",
    "title": "Honor in Handiwork and Industry",
    "text": "The Prophet ﷺ was asked what type of earning is purest, and he replied: 'A person's work with their own hands, and every honest transaction.' Industrial craft is an honorable endeavor that builds nations."
  },
  {
    "id": 9,
    "category": "religious",
    "categoryTitle": "Justice & Recognition",
    "title": "Fulfilling Rights of Workers",
    "text": "The Prophet ﷺ said: 'Give the worker his due before his sweat dries.' Recognizing and valuing the dedication of every worker and engineer is fundamental to organizational stability."
  },
  {
    "id": 10,
    "category": "religious",
    "categoryTitle": "Continuous Learning",
    "title": "Pursuing Knowledge and Mastery",
    "text": "The Quran teaches: 'And say: My Lord, increase me in knowledge.' Keeping up with advanced industrial technology, schematics, and mechanical insights is a commendable pursuit of wisdom."
  },
  {
    "id": 11,
    "category": "religious",
    "categoryTitle": "Mentorship",
    "title": "Sharing Expertise & Mentorship",
    "text": "The Prophet ﷺ said: 'Religion is sincere counsel.' Faithfully mentoring junior colleagues and passing on maintenance expertise strengthens the collective capability of the plant."
  },
  {
    "id": 12,
    "category": "religious",
    "categoryTitle": "Patience & Wisdom",
    "title": "Patience During Troubleshooting",
    "text": "Diagnosing complex root causes requires patience and systematic thought. Rely on calm composure and the scientific method to uncover deep underlying issues."
  },
  {
    "id": 13,
    "category": "religious",
    "categoryTitle": "Cleanliness & Order",
    "title": "Cleanliness & Organized Workspaces",
    "text": "Orderliness is the cornerstone of safety. Keeping equipment, shop floors, and toolsets clean immediately highlights fluid leaks and prevents slips and trip hazards."
  },
  {
    "id": 14,
    "category": "religious",
    "categoryTitle": "Commitment & Trust",
    "title": "Honoring Maintenance Commitments",
    "text": "The Quran reminds: 'And fulfill every commitment, for commitments will be asked about.' Respecting preventive maintenance schedules and handover deadlines builds lasting institutional trust."
  },
  {
    "id": 15,
    "category": "religious",
    "categoryTitle": "Sincere Purpose",
    "title": "Finding Purpose in Daily Work",
    "text": "Approaching your daily work and providing for your family with the intention of community building and excellence turns ordinary working hours into lasting virtues."
  },
  {
    "id": 16,
    "category": "motivational",
    "categoryTitle": "Quality Mindset",
    "title": "The True Meaning of Quality",
    "text": "Quality is not an accident; it is a daily habit practiced especially when no one is watching. Strive to execute every task with peak precision and integrity."
  },
  {
    "id": 17,
    "category": "motivational",
    "categoryTitle": "Discipline & Focus",
    "title": "Discipline Drives Excellence",
    "text": "Motivation gets you started, but daily discipline keeps you growing and leading. Consistent, meticulous daily progress builds a world-class manufacturing facility."
  },
  {
    "id": 18,
    "category": "motivational",
    "categoryTitle": "Team Synergy",
    "title": "The Power of an Integrated Team",
    "text": "Individual talent wins isolated tasks, but cross-functional coordination between Maintenance, Production, and Quality creates industrial championships."
  },
  {
    "id": 19,
    "category": "motivational",
    "categoryTitle": "Kaizen Philosophy",
    "title": "Continuous Improvement (Kaizen)",
    "text": "Do not wait for a crisis to innovate. A simple 1% daily improvement in your workspace and workflow leads to monumental positive transformation over the year."
  },
  {
    "id": 20,
    "category": "motivational",
    "categoryTitle": "Growth Mindset",
    "title": "Failures Are Learning Opportunities",
    "text": "Every breakdown and unexpected stoppage carries a valuable lesson. Document and analyze the root cause to build a resilient institutional knowledge base."
  },
  {
    "id": 21,
    "category": "motivational",
    "categoryTitle": "Craft Pride",
    "title": "Pride in Industrial Craft",
    "text": "Every unit emerging from the production line bears the mark of your dedication. Let your daily craftsmanship be a source of pride for yourself, your family, and your team."
  },
  {
    "id": 22,
    "category": "motivational",
    "categoryTitle": "Time Efficiency",
    "title": "The Value of Minutes in Production",
    "text": "In modern manufacturing, shaving 5 minutes of downtime translates into hundreds of additional finished goods and substantial operational savings."
  },
  {
    "id": 23,
    "category": "motivational",
    "categoryTitle": "Proactive Initiative",
    "title": "Take the First Initiative",
    "text": "Do not wait for someone else to flag a minor issue or fix a hazard. Taking swift initiative demonstrates leadership and true dedication to collective success."
  },
  {
    "id": 24,
    "category": "motivational",
    "categoryTitle": "Detail Orientation",
    "title": "Small Details Create Distinction",
    "text": "World-class factories differ from the rest not just in machinery, but in their unwavering attention to calibration, tightening torque, and cleanliness."
  },
  {
    "id": 25,
    "category": "motivational",
    "categoryTitle": "Crucial Contribution",
    "title": "You Are a Pillar of Success",
    "text": "Without the tireless expertise of technicians and engineers, production lines cannot run. Your role is vital to keeping the heartbeat of the factory strong."
  },
  {
    "id": 26,
    "category": "motivational",
    "categoryTitle": "Solution Focus",
    "title": "Focus on Solutions, Not Blame",
    "text": "When a fault occurs, spend 20% of your energy understanding the event and 80% implementing permanent preventive solutions, free from the culture of blame."
  },
  {
    "id": 27,
    "category": "motivational",
    "categoryTitle": "Holistic Professionalism",
    "title": "Professionalism is a Total Behavior",
    "text": "Professionalism spans from wearing full safety gear and polite communication to delivering thorough, comprehensive maintenance logs."
  },
  {
    "id": 28,
    "category": "motivational",
    "categoryTitle": "Goal Driven",
    "title": "Embracing High Performance Targets",
    "text": "Boosting Overall Equipment Effectiveness (OEE) and reducing scrap rates are daily benchmarks that showcase the prowess and agility of our team."
  },
  {
    "id": 29,
    "category": "motivational",
    "categoryTitle": "Clear Communication",
    "title": "Clarity Breeds Speed",
    "text": "Transparent and precise communication during shift handovers prevents lost hours and ensures continuous, frictionless operational momentum."
  },
  {
    "id": 30,
    "category": "motivational",
    "categoryTitle": "Skill Growth",
    "title": "Invest in Your Skills Daily",
    "text": "Reading a technical manual, studying a complex schematic, or mastering a new calibration technique continuously compounds your professional market value."
  },
  {
    "id": 31,
    "category": "industrial",
    "categoryTitle": "Preventive Maintenance",
    "title": "Timely Preventive Maintenance (PM)",
    "text": "Scheduled preventive maintenance costs 10 times less than emergency breakdown repairs and protects the production schedule from costly surprises."
  },
  {
    "id": 32,
    "category": "industrial",
    "categoryTitle": "5S Methodology",
    "title": "Implementing the 5S Framework",
    "text": "Sort, Set in order, Shine, Standardize, and Sustain — the proven Japanese formula for a clean, hazard-free, and high-efficiency industrial workspace."
  },
  {
    "id": 33,
    "category": "industrial",
    "categoryTitle": "Electrical Safety",
    "title": "LOTO Procedures (Lockout / Tagout)",
    "text": "Isolating energy sources and applying Lockout/Tagout locks and tags before opening electrical panels or servicing moving parts protects your life and colleagues."
  },
  {
    "id": 34,
    "category": "industrial",
    "categoryTitle": "Autonomous Maintenance",
    "title": "Operator Autonomous Maintenance",
    "text": "Operators are the first line of defense; daily visual inspections and early detection of abnormal sounds and vibrations prevent up to 70% of major failures."
  },
  {
    "id": 35,
    "category": "industrial",
    "categoryTitle": "Root Cause Analysis",
    "title": "The 5 Whys Methodology",
    "text": "When a breakdown occurs, ask 'Why?' five consecutive times to dig past surface symptoms and resolve the root mechanism causing the breakdown."
  },
  {
    "id": 36,
    "category": "industrial",
    "categoryTitle": "OEE Metrics",
    "title": "Overall Equipment Effectiveness (OEE)",
    "text": "OEE is calculated as Availability × Performance × Quality. Enhancing any of these three pillars immediately raises plant productivity and throughput."
  },
  {
    "id": 37,
    "category": "industrial",
    "categoryTitle": "Precision Lubrication",
    "title": "Proper Lubrication Practice",
    "text": "Over 50% of bearing failures stem from improper lubrication or grease contamination. Always use the specified lubricant type, volume, and interval."
  },
  {
    "id": 38,
    "category": "industrial",
    "categoryTitle": "Error Proofing",
    "title": "The Poka-Yoke Principle",
    "text": "Designing fixtures and assembly steps so parts can only fit in the correct orientation completely eliminates human installation errors."
  },
  {
    "id": 39,
    "category": "industrial",
    "categoryTitle": "Thermography",
    "title": "Thermal Inspection of Electrical Panels",
    "text": "Elevated temperatures on circuit breakers and busbars indicate loose connections or overcurrent; regular thermography prevents catastrophic electrical fires."
  },
  {
    "id": 40,
    "category": "industrial",
    "categoryTitle": "Pneumatic Efficiency",
    "title": "Compressed Air Leaks Waste Energy",
    "text": "A 3mm compressed air leak in a pneumatic line wastes thousands of kilowatt-hours annually. Prompt hose and fitting repairs preserve line pressure and power."
  },
  {
    "id": 41,
    "category": "industrial",
    "categoryTitle": "Metrology & Calibration",
    "title": "Regular Gauge Calibration",
    "text": "Temperature, pressure, and weight sensors drift over time. Scheduled calibration guarantees that manufactured products continually meet rigorous international specs."
  },
  {
    "id": 42,
    "category": "industrial",
    "categoryTitle": "Reliability KPI",
    "title": "Balancing MTTR and MTBF",
    "text": "The core objective of maintenance engineering is minimizing Mean Time to Repair (MTTR) while maximizing Mean Time Between Failures (MTBF)."
  },
  {
    "id": 43,
    "category": "industrial",
    "categoryTitle": "Alignment & Belts",
    "title": "Shaft and Pulley Alignment",
    "text": "Misaligned pulleys and drive belts cause rapid wear, high vibration, and bearing breakdown. Always verify tension and laser alignment during replacement."
  },
  {
    "id": 44,
    "category": "industrial",
    "categoryTitle": "Spare Parts Strategy",
    "title": "Strategic Stock of Critical Spares",
    "text": "Categorizing critical spare parts and maintaining a safety buffer prevents multi-day factory shutdowns while waiting for urgent overseas shipments."
  },
  {
    "id": 45,
    "category": "industrial",
    "categoryTitle": "Change Management",
    "title": "Engineering Change Documentation",
    "text": "Any electrical or mechanical modification made to machinery must immediately be updated on the schematics to prevent future troubleshooting confusion."
  },
  {
    "id": 46,
    "category": "general",
    "categoryTitle": "Pareto Analysis",
    "title": "The 80/20 Pareto Rule in Downtime",
    "text": "Roughly 80% of machine downtime is caused by 20% of critical equipment or failure modes. Target focused maintenance on this vital 20% first."
  },
  {
    "id": 47,
    "category": "general",
    "categoryTitle": "Communication",
    "title": "Effective Shift Handover",
    "text": "Thorough verbal and written handovers detailing unusual machine behavior save incoming shifts hours of diagnostic guesswork."
  },
  {
    "id": 48,
    "category": "general",
    "categoryTitle": "Ergonomics",
    "title": "Safe Lifting Ergonomics",
    "text": "Always bend your knees and keep your back straight when lifting motors or heavy fixtures, and use mechanical hoists to prevent severe spinal strain."
  },
  {
    "id": 49,
    "category": "general",
    "categoryTitle": "Lean Manufacturing",
    "title": "Eliminating the 7 Wastes (Muda)",
    "text": "In Lean manufacturing: minimizing excess transport, unnecessary motion, waiting, and overprocessing dramatically boosts output at zero extra cost."
  },
  {
    "id": 50,
    "category": "general",
    "categoryTitle": "Emergency Protocol",
    "title": "Calm, Stepwise Emergency Diagnostics",
    "text": "During critical stoppages, follow diagnostic decision trees systematically; haphazardly swapping parts exacerbates issues and inflates downtime."
  },
  {
    "id": 51,
    "category": "general",
    "categoryTitle": "Automation Sensors",
    "title": "Clean Photoelectric Sensors & Limit Switches",
    "text": "Accumulated dust or oil mist on optical sensor lenses and limit switches is a leading cause of phantom line stoppages. Clean them routinely."
  },
  {
    "id": 52,
    "category": "general",
    "categoryTitle": "Automation Control",
    "title": "Regular Backups of PLC & HMI Programs",
    "text": "Maintaining updated offline backups of PLC logic and HMI projects protects the plant from extended shutdowns in the event of memory card corruption."
  },
  {
    "id": 53,
    "category": "general",
    "categoryTitle": "Workplace Lighting",
    "title": "Adequate Lighting & Ventilation",
    "text": "Proper illumination at inspection stations and fresh ventilation reduce operator fatigue and lower technical inspection error rates by over 30%."
  },
  {
    "id": 54,
    "category": "general",
    "categoryTitle": "Torque Standards",
    "title": "Applying Proper Fastener Torque",
    "text": "Using a calibrated torque wrench to tighten critical bolts avoids thread stripping while ensuring fasteners do not loosen under continuous vibration."
  },
  {
    "id": 55,
    "category": "general",
    "categoryTitle": "Environmental Care",
    "title": "Safe Disposal of Spent Industrial Oils",
    "text": "Collecting spent oils and solvents in designated containers for certified recycling protects drainage systems and ensures compliance with ISO 14001."
  },
  {
    "id": 56,
    "category": "general",
    "categoryTitle": "Tool Management",
    "title": "Shadow Boards for Tool Organization",
    "text": "Designating a shaped silhouette for every tool ensures quick retrieval during maintenance and guarantees no tool is inadvertently left inside a machine."
  },
  {
    "id": 57,
    "category": "general",
    "categoryTitle": "Predictive Maintenance",
    "title": "Predictive Condition Monitoring (PdM)",
    "text": "Vibration analysis and infrared thermography reveal early warning signs of component failure weeks before actual breakdown, allowing scheduled repairs."
  },
  {
    "id": 58,
    "category": "general",
    "categoryTitle": "Process Improvement",
    "title": "Deming's PDCA Continuous Improvement Cycle",
    "text": "Plan -> Do -> Check -> Act. Iterating through this structured cycle guarantees enduring institutional growth and process refinement."
  },
  {
    "id": 59,
    "category": "general",
    "categoryTitle": "Standardization",
    "title": "Standard Operating Procedures (SOP)",
    "text": "Developing clear, illustrated SOPs for maintenance and operations ensures uniform high quality regardless of who performs the task."
  },
  {
    "id": 60,
    "category": "general",
    "categoryTitle": "Digital Transformation",
    "title": "Digital CMMS Excellence",
    "text": "Using this digital CMMS platform to log tickets, parts, and machine histories turns everyday maintenance data into strategic insights that propel the factory forward."
  }
];

/**
 * حساب مؤشر المعلومة اليومية الثابتة مع التبديل التلقائي الساعة 12:00 ظهراً كل يوم
 */
export function getDailyTipIndex(customDate = new Date()) {
  const now = new Date(customDate);
  // إزاحة 12 ساعة لتبدأ اليوم الجديد للمعلومة الساعة 12:00 ظهراً
  const shifted = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const totalDays = Math.floor(shifted.getTime() / (24 * 60 * 60 * 1000));
  return Math.abs(totalDays) % TIPS_AR.length;
}

/**
 * جلب المعلومة الحالية حسب اللغة ومؤشر اليوم أو مؤشر مخصص
 */
export function getDailyTip(lang = null, tipIndex = null) {
  const currentLang = lang || window.currentLang || localStorage.getItem('lang') || 'ar';
  const list = currentLang === 'en' ? TIPS_EN : TIPS_AR;
  const index = tipIndex !== null ? tipIndex : getDailyTipIndex();
  const safeIndex = Math.abs(index) % list.length;
  return {
    ...list[safeIndex],
    lang: currentLang,
    index: safeIndex
  };
}

/**
 * أيقونة الفئة
 */
function getCategoryIcon(category) {
  switch (category) {
    case 'religious':
      return '🕌';
    case 'motivational':
      return '⚡';
    case 'industrial':
      return '🏭';
    case 'general':
    default:
      return '💡';
  }
}

/**
 * متغير لتتبع الفهرس المعروض حالياً في الكارت الثابت
 */
let currentCardTipIndex = null;

/**
 * توليد كود HTML لكارت معلومة على الماشي في صفحة النظام (SystemView)
 * تصميم Dark بحدود ذهبية وهوية صناعية أنيقة مع زر للتنقل اليدوي
 */
export function renderDailyTipCard(overrideIndex = null) {
  const isEn = (window.currentLang || localStorage.getItem('lang') || 'ar') === 'en';
  if (overrideIndex !== null) {
    currentCardTipIndex = overrideIndex;
  } else if (currentCardTipIndex === null) {
    currentCardTipIndex = getDailyTipIndex();
  }
  const tip = getDailyTip(isEn ? 'en' : 'ar', currentCardTipIndex);
  const icon = getCategoryIcon(tip.category);

  return `
  <!-- ========================================================
       كارت ثابت: «معلومة على الماشي» (يتغير يومياً ويسمح بالتصفح)
       ======================================================== -->
  <div id="mscanco-daily-tip-card" class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1E293B] via-[#0F172A] to-[#0B1120] border-2 border-amber-500/50 shadow-xl shadow-amber-950/20 p-4 transition-all duration-300 hover:border-amber-400 group">
    
    <!-- خلفية جمالية خافتة -->
    <div class="absolute -top-12 rtl:-left-12 ltr:-right-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>
    <div class="absolute -bottom-8 rtl:-right-8 ltr:-left-8 w-24 h-24 bg-blue-500/10 rounded-full blur-xl pointer-events-none"></div>

    <!-- رأس الكارت -->
    <div class="flex items-center justify-between gap-2 border-b border-amber-500/20 pb-2.5 mb-3">
      <div class="flex items-center gap-2">
        <span class="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center text-base shadow-inner group-hover:scale-110 transition-transform">
          ✨
        </span>
        <div>
          <h3 class="text-xs font-black text-amber-400 tracking-wide flex items-center gap-1.5">
            <span>${isEn ? 'Daily Insight' : 'معلومة على الماشي'}</span>
            <span class="text-[9px] font-normal text-amber-300/70 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-500/30">#${tip.id}</span>
          </h3>
          <span class="text-[10px] text-gray-400 flex items-center gap-1">
            <span>${icon}</span>
            <span>${tip.categoryTitle}</span>
          </span>
        </div>
      </div>

      <div class="flex items-center gap-1.5">
        <button
          type="button"
          onclick="window.cycleDailyTipCard()"
          class="text-[9.5px] font-bold text-amber-300 hover:text-white bg-amber-500/20 hover:bg-amber-500/30 px-2 py-1 rounded-lg border border-amber-500/30 flex items-center gap-1 active:scale-95 transition-all cursor-pointer shadow-sm"
          title="${isEn ? 'Show another tip' : 'عرض معلومة أخرى'}"
        >
          <span>🔄</span>
          <span>${isEn ? 'Next Tip' : 'معلومة أخرى'}</span>
        </button>
        <div class="text-[9px] font-medium text-amber-400/80 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20 hidden sm:flex items-center gap-1">
          <span>⏰</span>
          <span>${isEn ? '12:00 PM' : 'تتجدد 12 ظهراً'}</span>
        </div>
      </div>
    </div>

    <!-- عنوان المعلومة -->
    <h4 class="text-xs font-bold text-white mb-1.5 flex items-center gap-1.5">
      <span class="text-amber-400 font-black">▫</span>
      <span>${tip.title}</span>
    </h4>

    <!-- نص المعلومة -->
    <p class="text-[11.5px] leading-relaxed text-slate-200 font-normal select-text pr-1 pl-1">
      ${tip.text}
    </p>

    <!-- شريط سفلي خفيف -->
    <div class="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[9px] text-gray-400">
      <span class="flex items-center gap-1 text-gray-400">
        <span>🏭</span>
        <span>${isEn ? 'CMMS Excellence Tip' : 'إرشادات التميز والجودة'}</span>
      </span>
      <div class="flex items-center gap-2">
        <button
          type="button"
          onclick="window.showDailyTipToast()"
          class="text-amber-400/90 hover:text-amber-300 underline underline-offset-2 transition-colors cursor-pointer"
        >
          ${isEn ? 'Popup preview' : 'معاينة منبثقة'}
        </button>
        <span class="text-amber-500/80 font-mono">MSCANCO</span>
      </div>
    </div>
  </div>
  `;
}

/**
 * التنقل للمعلومة التالية داخل الكارت الثابت
 */
export function cycleDailyTipCard() {
  if (currentCardTipIndex === null) {
    currentCardTipIndex = getDailyTipIndex();
  }
  currentCardTipIndex = (currentCardTipIndex + 1) % TIPS_AR.length;

  const card = document.getElementById('mscanco-daily-tip-card');
  if (card) {
    card.classList.add('opacity-40', 'scale-[0.99]');
    setTimeout(() => {
      card.outerHTML = renderDailyTipCard(currentCardTipIndex);
    }, 150);
  }
}

// ============================================================
// منطق الـ Toast المنبثق
// - مدة العرض: 25 ثانية (تبقى فترة أطول تكفي للقراءة والتدبر)
// - ميزة الإيقاف المؤقت عند التمرير بالماوس أو اللمس (Pause on Hover)
// - يتكرر أكثر من مرة في اليوم (كل 60 دقيقة طوال ورديات العمل، حتى 8 مرات يومياً)
// - ينتقل تلقائياً إلى معلومة جديدة في كل ظهور خلال اليوم
// - يحتوي على زر للانتقال الفوري للمعلومة التالية وزر للإغلاق السريع
// ============================================================

const TOAST_STORAGE_KEY = 'mscanco_daily_tip_toast_v3';
export const TOAST_DURATION_MS = 25000;         // 25 ثانية (تبقى فترة أطول بكثير)
export const MIN_INTERVAL_MS = 60 * 60 * 1000;  // تكرار كل 60 دقيقة على الأقل
export const MAX_TIPS_PER_DAY = 8;              // إمكانية الظهور حتى 8 مرات يومياً
const FIRST_CHECK_DELAY_MS = 5000;              // أول ظهور بعد 5 ثوانٍ من فتح التطبيق

/**
 * حقن أنماط شريط التقدم والإيقاف المؤقت
 */
function ensureTipToastStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('mscanco-tip-toast-styles')) return;

  const style = document.createElement('style');
  style.id = 'mscanco-tip-toast-styles';
  style.textContent = `
    @keyframes mscancoToastProgressAnim {
      0% { width: 100%; }
      100% { width: 0%; }
    }
    .mscanco-toast-progress-bar {
      animation: mscancoToastProgressAnim ${TOAST_DURATION_MS}ms linear forwards;
    }
    .mscanco-toast-paused .mscanco-toast-progress-bar {
      animation-play-state: paused !important;
    }
  `;
  document.head.appendChild(style);
}

/**
 * الحصول على تاريخ اليوم بنسق YYYY-MM-DD
 */
function getTodayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * قراءة حالة إشعارات اليوم من الـ localStorage
 */
function getToastState() {
  const today = getTodayDateString();
  const defaultState = {
    date: today,
    shownCount: 0,
    lastShownTime: 0,
    lastTipIndex: getDailyTipIndex()
  };

  try {
    const raw = localStorage.getItem(TOAST_STORAGE_KEY);
    if (!raw) return defaultState;

    const parsed = JSON.parse(raw);
    if (parsed.date !== today) {
      // يوم جديد، تصفير العداد وتحديث التاريخ
      return defaultState;
    }
    return {
      date: today,
      shownCount: Number(parsed.shownCount) || 0,
      lastShownTime: Number(parsed.lastShownTime) || 0,
      lastTipIndex: parsed.lastTipIndex !== undefined ? Number(parsed.lastTipIndex) : getDailyTipIndex()
    };
  } catch {
    return defaultState;
  }
}

/**
 * حفظ حالة الإشعار
 */
function saveToastState(state) {
  try {
    localStorage.setItem(TOAST_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

/**
 * إظهار الـ Toast المنبثق
 * @param {number|null} tipIndex مؤشر معلومة محددة أو اختيار متسلسل تلقائي
 * @param {boolean} isManualTrigger إذا كان الاستدعاء يدوياً (لا يخضع لقيود الفاصل الزمني)
 */
export function showDailyTipToast(tipIndex = null, isManualTrigger = false) {
  ensureTipToastStyles();

  // إزالة أي Toast معروض مسبقاً
  const existing = document.getElementById('mscanco-daily-tip-toast');
  if (existing) {
    if (existing._autoHideTimer) clearTimeout(existing._autoHideTimer);
    existing.remove();
  }

  const isEn = (window.currentLang || localStorage.getItem('lang') || 'ar') === 'en';
  const state = getToastState();

  // تحديد رقم المعلومة
  let resolvedIndex;
  if (tipIndex !== null && !isNaN(tipIndex)) {
    resolvedIndex = Math.abs(tipIndex) % TIPS_AR.length;
  } else {
    // اختيار المعلومة التالية بشكل دوري للتنويع طوال اليوم
    resolvedIndex = (state.lastTipIndex + 1) % TIPS_AR.length;
  }

  const tip = getDailyTip(isEn ? 'en' : 'ar', resolvedIndex);
  const icon = getCategoryIcon(tip.category);

  // تحديث الحالة وحفظها
  state.shownCount = (state.shownCount || 0) + 1;
  state.lastShownTime = Date.now();
  state.lastTipIndex = resolvedIndex;
  saveToastState(state);

  const toast = document.createElement('div');
  toast.id = 'mscanco-daily-tip-toast';
  toast.dir = isEn ? 'ltr' : 'rtl';
  toast.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-[999999] max-w-lg w-[94%] sm:w-[480px] bg-gradient-to-br from-[#1E293B] via-[#0F172A] to-[#0A0F1D] border-2 border-amber-500 shadow-2xl shadow-amber-900/50 rounded-2xl p-4 text-white transition-all duration-500 transform translate-y-0 opacity-100 cursor-default select-text';

  toast.innerHTML = `
    <!-- رأس الـ Toast -->
    <div class="flex items-center justify-between gap-2 border-b border-amber-500/30 pb-2 mb-2.5">
      <div class="flex items-center gap-2">
        <span class="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center text-sm shadow-inner">
          ✨
        </span>
        <div>
          <div class="text-xs font-black text-amber-400 flex items-center gap-1.5">
            <span>${isEn ? 'Daily Insight' : 'معلومة على الماشي'}</span>
            <span class="text-[9px] font-normal text-amber-300/80 bg-amber-950/70 px-1.5 py-0.5 rounded border border-amber-500/30">#${tip.id}</span>
            <span id="tipPauseIndicator" class="hidden text-[8.5px] font-bold text-amber-300 bg-amber-500/25 px-1.5 py-0.5 rounded border border-amber-500/40 items-center gap-1 animate-pulse">
              ⏸️ ${isEn ? 'Reading paused' : 'المؤقت متوقف للقراءة'}
            </span>
          </div>
          <div class="text-[10px] text-gray-400 flex items-center gap-1">
            <span>${icon}</span>
            <span>${tip.categoryTitle}</span>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-1.5">
        <!-- زر المعلومة التالية داخل التوست -->
        <button
          type="button"
          id="nextDailyTipToastBtn"
          class="text-amber-300 hover:text-white text-[10px] font-bold px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 active:scale-95 rounded-lg transition-all cursor-pointer border border-amber-500/30 flex items-center gap-1"
          title="${isEn ? 'Show next tip' : 'عرض المعلومة التالية'}"
        >
          <span>↻</span>
          <span class="hidden sm:inline">${isEn ? 'Next' : 'التالية'}</span>
        </button>

        <!-- زر الإغلاق -->
        <button
          type="button"
          id="closeDailyTipToastBtn"
          class="text-gray-400 hover:text-white text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 active:scale-95 rounded-lg transition-all cursor-pointer border border-slate-700"
          title="${isEn ? 'Close' : 'إغلاق'}"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- العنوان -->
    <div class="text-xs font-bold text-amber-300 mb-1.5 flex items-center gap-1.5">
      <span>💡</span>
      <span>${tip.title}</span>
    </div>

    <!-- نص المعلومة (مريح للقراءة وواضح) -->
    <div class="text-xs sm:text-[12.5px] leading-relaxed text-slate-100 mb-3 select-text font-normal">
      ${tip.text}
    </div>

    <!-- معلومات الشريط السفلي -->
    <div class="flex items-center justify-between text-[9px] text-slate-400 mb-2">
      <span class="flex items-center gap-1 text-amber-400/80">
        <span>⏱️</span>
        <span>${isEn ? 'Stays for 25s (hover to pause)' : 'تبقى 25 ثانية (ثبت المؤشر للقراءة)'}</span>
      </span>
      <span class="text-slate-400">
        ${isEn ? `Today's view: ${state.shownCount}/${MAX_TIPS_PER_DAY}` : `مرات اليوم: ${state.shownCount} من ${MAX_TIPS_PER_DAY}`}
      </span>
    </div>

    <!-- شريط التناقص التلقائي للوقت (25 ثانية مع دعم الإيقاف المؤقت) -->
    <div class="w-full bg-slate-800/90 h-1.5 rounded-full overflow-hidden border border-slate-700/60 relative">
      <div id="mscanco-toast-progress" class="mscanco-toast-progress-bar bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 h-full w-full rounded-full"></div>
    </div>
  `;

  document.body.appendChild(toast);

  // إعداد مؤقت الإغلاق التلقائي مع دعم الإيقاف المؤقت عند التمرير بالماوس أو اللمس
  let remainingMs = TOAST_DURATION_MS;
  let timerStart = Date.now();
  let autoHideTimer = null;
  let isPaused = false;

  const pauseIndicator = toast.querySelector('#tipPauseIndicator');

  function startTimer(duration) {
    timerStart = Date.now();
    remainingMs = duration;
    autoHideTimer = setTimeout(() => {
      dismissToast(toast);
    }, duration);
    toast._autoHideTimer = autoHideTimer;
  }

  function pauseToast() {
    if (isPaused) return;
    isPaused = true;
    if (autoHideTimer) {
      clearTimeout(autoHideTimer);
      autoHideTimer = null;
    }
    const elapsed = Date.now() - timerStart;
    remainingMs = Math.max(1000, remainingMs - elapsed);
    toast.classList.add('mscanco-toast-paused');
    if (pauseIndicator) {
      pauseIndicator.classList.remove('hidden');
      pauseIndicator.classList.add('inline-flex');
    }
  }

  function resumeToast() {
    if (!isPaused) return;
    isPaused = false;
    toast.classList.remove('mscanco-toast-paused');
    if (pauseIndicator) {
      pauseIndicator.classList.add('hidden');
      pauseIndicator.classList.remove('inline-flex');
    }
    startTimer(remainingMs);
  }

  // تفعيل مؤقت الإغلاق التلقائي الأولي
  startTimer(TOAST_DURATION_MS);

  // أحداث التمرير بالماوس (Pause on Hover)
  toast.addEventListener('mouseenter', pauseToast);
  toast.addEventListener('mouseleave', resumeToast);

  // أحداث شاشات اللمس والموبايل
  toast.addEventListener('touchstart', pauseToast, { passive: true });
  toast.addEventListener('touchend', () => {
    // ترك مهلة بسيطة قبل الاستئناف بعد اللمس
    setTimeout(resumeToast, 1200);
  });

  // زر الإغلاق اليدوي
  const closeBtn = toast.querySelector('#closeDailyTipToastBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissToast(toast);
    });
  }

  // زر الانتقال للمعلومة التالية
  const nextBtn = toast.querySelector('#nextDailyTipToastBtn');
  if (nextBtn) {
    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissToast(toast, () => {
        showDailyTipToast((resolvedIndex + 1) % TIPS_AR.length, true);
      });
    });
  }
}

/**
 * إخفاء الـ Toast بحركة انسيابية
 */
function dismissToast(toast, onDismissed = null) {
  if (!toast || !toast.parentNode) return;
  if (toast._autoHideTimer) {
    clearTimeout(toast._autoHideTimer);
    toast._autoHideTimer = null;
  }
  toast.classList.add('opacity-0', '-translate-y-4', 'duration-300');
  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
    if (typeof onDismissed === 'function') {
      onDismissed();
    }
  }, 320);
}

/**
 * فحص شروط التكرار وإظهار التوست تلقائياً
 */
function checkAndTriggerTipToast() {
  const state = getToastState();
  const now = Date.now();
  const timeSinceLast = now - (state.lastShownTime || 0);

  // الشروط:
  // 1. لم يتجاوز الحد الأقصى للمرات اليومية (8 مرات)
  // 2. مر على آخر ظهور 60 دقيقة على الأقل (أو أول ظهور في اليوم)
  const isFirstOfToday = !state.lastShownTime || state.shownCount === 0;
  const isIntervalElapsed = timeSinceLast >= MIN_INTERVAL_MS;

  if (state.shownCount < MAX_TIPS_PER_DAY && (isFirstOfToday || isIntervalElapsed)) {
    showDailyTipToast();
  }
}

let schedulerInterval = null;

/**
 * تهيئة جدولة إظهار الـ Toast المتكرر خلال اليوم:
 * 1. فحص أول مرة بعد 5 ثوانٍ من فتح التطبيق
 * 2. فحص دوري مستمر كل دقيقة طوال فترة تشغيل التطبيق (يتكرر كل 60 دقيقة حتى 8 مرات يومياً)
 * 3. فحص تلقائي عند العودة لتبويب التطبيق بعد فترة غياب
 */
export function initDailyTipsScheduler() {
  ensureTipToastStyles();

  // 1. الفحص الأولي بعد 5 ثوانٍ
  setTimeout(() => {
    checkAndTriggerTipToast();
  }, FIRST_CHECK_DELAY_MS);

  // 2. فحص دوري مستمر في الخلفية كل 60 ثانية
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }
  schedulerInterval = setInterval(() => {
    checkAndTriggerTipToast();
  }, 60 * 1000);

  // 3. فحص عند استئناف واستعادة نشاط الشاشة
  if (typeof document !== 'undefined' && !window._mscancoTipVisibilityBound) {
    window._mscancoTipVisibilityBound = true;
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        setTimeout(() => {
          checkAndTriggerTipToast();
        }, 3000);
      }
    });
  }
}

// تهيئة تلقائية فورية وتصدير الدوال لـ window
if (typeof window !== 'undefined') {
  window.renderDailyTipCard = renderDailyTipCard;
  window.cycleDailyTipCard = cycleDailyTipCard;
  window.showDailyTipToast = showDailyTipToast;
  window.getDailyTip = getDailyTip;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDailyTipsScheduler);
  } else {
    initDailyTipsScheduler();
  }
}

export default {
  TIPS_AR,
  TIPS_EN,
  getDailyTipIndex,
  getDailyTip,
  renderDailyTipCard,
  cycleDailyTipCard,
  showDailyTipToast,
  initDailyTipsScheduler,
  TOAST_DURATION_MS,
  MIN_INTERVAL_MS,
  MAX_TIPS_PER_DAY
};
