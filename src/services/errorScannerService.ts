import { MachineErrorGuide } from '../types';
import { db } from '../config/firebase';
import { collection, getDocs, addDoc, query, where } from 'firebase/firestore';

export const DEFAULT_ERROR_GUIDES: MachineErrorGuide[] = [
  {
    id: 'err-1',
    machineType: 'Bodymaker',
    code: 'E-102',
    title: 'Hydraulic Pressure Low / انخفاض ضغط الزيت الهيدروليكي',
    symptoms: 'توقف حركة الرام الرئيسي وظهور ضوء تحذيري أحمر في لوحة HMI',
    causes: [
      'انسداد فلتر خط التغذية الرئيسي للزيت',
      'عطل في صمام تخفيف الضغط (Pressure Relief Valve)',
      'انخفاض مستوى الزيت في الخزان عن الحد الأدنى'
    ],
    solutions: [
      'فحص مؤشر مستوى الزيت في الخزان وتزويده إن لزم',
      'فحص مقياس ضغط الطلمبة وضبط الصمام على 140 بار',
      'استبدال عنصر فلتر الزيت الدقيق (10 ميكرون)'
    ],
    verified: true,
    verifiedBy: 'م. رئيس قسم الصيانة'
  },
  {
    id: 'err-2',
    machineType: 'Decorator',
    code: 'E-402',
    title: 'Can Feed Infeed Jam / انحشار العلب عند التغذية',
    symptoms: 'عدم وصول العلب إلى ماندريل الطباعة وسماع صوت احتكاك',
    causes: [
      'اتساخ أو انحراف حساس التزامن الضوئي (Photo Sensor)',
      'تراكم أحبار أو ورنيش جاف على مسار دليل العلب (Guide Rails)',
      'ضغط تفريغ الهواء (Vacuum) غير كافٍ لسحب العلب'
    ],
    solutions: [
      'تنظيف عدسة الحساس الضوئي بمذيب الكحول وإعادة ضبط المسافة',
      'تنظيف مجاري السير وإزالة العلب المشوهة يدوياً',
      'فحص خرطوم الفاكيوم ومضخة التفريغ والتأكد من ضغط -0.7 بار'
    ],
    verified: true,
    verifiedBy: 'م. الصيانة الميكانيكية'
  },
  {
    id: 'err-3',
    machineType: 'Cupper',
    code: 'F-008',
    title: 'Lube Oil Flow Fault / انقطاع تدفق زيت التزييت',
    symptoms: 'تحذير تزييت العمود الرئيسي وتوقف القاطع التلقائي',
    causes: [
      'فقاعات هواء داخل دورة التزييت المغلقة',
      'مفتاح تدفق الزيت (Flow Switch) معطل أو متسخ'
    ],
    solutions: [
      'تنفيس خطوط التزييت والتأكد من خروج الزيت بدون هواء',
      'تنظيف وفحص توصيلات الـ Flow Switch الكهربائية'
    ],
    verified: true,
    verifiedBy: 'مهندس الكهرباء والتحكم'
  },
  {
    id: 'err-4',
    machineType: 'Spray',
    code: 'SP-12',
    title: 'Internal Lacquer Nozzle Clog / انسداد نوزل الرش الداخلي',
    symptoms: 'عدم انتظام وزن طبقة الورنيش الداخلية وظهور عيوب كيميائية',
    causes: [
      'جفاف الورنيش داخل الإبرة الدقيقة أثناء التوقف المؤقت',
      'انخفاض ضغط رش الورنيش عن 65 بار'
    ],
    solutions: [
      'غسيل دائري فوري لمسدس الرش بمذيب التنظيف المخصص',
      'استبدال رأس النوزل (Tungsten Carbide Tip)',
      'فحص فلتر مدخل المسدس'
    ],
    verified: true,
    verifiedBy: 'مشرف قسم الطلاء'
  }
];

export async function findErrorGuide(machineType: string, code: string): Promise<MachineErrorGuide | null> {
  const normCode = code.trim().toUpperCase();
  try {
    const q = query(
      collection(db, 'machineErrors'),
      where('machineType', '==', machineType),
      where('code', '==', normCode)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0];
      return { id: d.id, ...(d.data() as Omit<MachineErrorGuide, 'id'>) };
    }
  } catch (err) {
    console.warn("Firestore error lookup failed:", err);
  }

  // Fallback to local default catalog
  const found = DEFAULT_ERROR_GUIDES.find(
    g => g.machineType.toLowerCase() === machineType.toLowerCase() &&
         (g.code.toUpperCase() === normCode || normCode.includes(g.code.toUpperCase()))
  );

  return found || null;
}

export async function addErrorGuide(guide: Omit<MachineErrorGuide, 'id'>): Promise<void> {
  try {
    await addDoc(collection(db, 'machineErrors'), guide);
  } catch (err) {
    console.warn("Could not save to firestore, saved in memory:", err);
    DEFAULT_ERROR_GUIDES.push({ id: 'local_' + Date.now(), ...guide });
  }
}
