import { KaizenSuggestion } from '../types';
import { db } from '../config/firebase';
import { collection, addDoc, getDocs, updateDoc, doc, query, orderBy, limit } from 'firebase/firestore';

export async function submitKaizen(data: Omit<KaizenSuggestion, 'id' | 'status' | 'date'>): Promise<KaizenSuggestion> {
  const now = new Date().toISOString();
  const newKaizen: Omit<KaizenSuggestion, 'id'> = {
    ...data,
    status: 'new',
    date: now
  };

  try {
    const docRef = await addDoc(collection(db, 'suggestions'), newKaizen);
    return { id: docRef.id, ...newKaizen };
  } catch (err) {
    console.warn("Saving suggestion locally:", err);
    const id = 'local_kz_' + Date.now();
    const full = { id, ...newKaizen };
    const saved = JSON.parse(localStorage.getItem('cached_kaizen') || '[]');
    saved.unshift(full);
    localStorage.setItem('cached_kaizen', JSON.stringify(saved));
    return full;
  }
}

export async function fetchKaizenSuggestions(): Promise<KaizenSuggestion[]> {
  try {
    const q = query(collection(db, 'suggestions'), orderBy('date', 'desc'), limit(100));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<KaizenSuggestion, 'id'>)
      }));
    }
  } catch (err) {
    console.warn("Could not fetch kaizen suggestions from Firestore:", err);
  }

  const cached = localStorage.getItem('cached_kaizen');
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {}
  }

  return [
    {
      id: 'kz-1',
      title: 'إعادة تصميم حاجز حماية سير نقل العلب لتفادي الانحشار المتكرر',
      line: 'Line 1',
      machine: 'Trimmer',
      category: 'سلامة وإنتاجية',
      problem: 'انحشار علب الألمنيوم عند المنعطف الحاد وتطاير بعض الحواف الحادة',
      solution: 'تركيب موجه تفلون مرن مع تقليل زاوية الانحناء بمقدار 15 درجة',
      impact: 'توفير 45 دقيقة توقف شهرياً ورفع معايير الأمان للمشغلين',
      name: 'محمد عبد الله',
      job: 'مشغل أول',
      department: 'frontend',
      shift: 'B',
      status: 'approved',
      date: new Date(Date.now() - 86400000 * 2).toISOString(),
      adminNotes: 'فكرة ممتازة وسيتم اعتمادها في خطة الـ PM القادمة'
    },
    {
      id: 'kz-2',
      title: 'إضافة حساس ضوئي عند مدخل فرن التجفيف (IBO)',
      line: 'Line 2',
      machine: 'IBO',
      category: 'جودة وتوفير طاقة',
      problem: 'تشغيل مراوح الشفط والحرارة بأقصى طاقة حتى أثناء توقف تغذية العلب',
      solution: 'ربط سرعة المراوح بحساس تواجد العلب عبر الـ PLC',
      impact: 'توفير استهلاك الغاز والكهرباء بنسبة 8%',
      name: 'محمود الصاوي',
      job: 'فني كهرباء',
      department: 'backend',
      shift: 'A',
      status: 'new',
      date: new Date(Date.now() - 86400000).toISOString()
    }
  ];
}

export async function updateKaizenStatus(
  id: string,
  status: KaizenSuggestion['status'],
  adminNotes?: string
): Promise<void> {
  try {
    await updateDoc(doc(db, 'suggestions', id), {
      status,
      ...(adminNotes ? { adminNotes } : {})
    });
  } catch (err) {
    console.warn("Local update kaizen:", err);
  }
}
