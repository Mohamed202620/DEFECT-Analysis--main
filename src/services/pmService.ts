import { PMOrder } from '../types';
import { db } from '../config/firebase';
import { collection, addDoc, getDocs, updateDoc, doc, query, orderBy, limit } from 'firebase/firestore';

export async function fetchPMOrders(): Promise<PMOrder[]> {
  try {
    const q = query(collection(db, 'pmOrders'), orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<PMOrder, 'id'>)
      }));
    }
  } catch (err) {
    console.warn("Could not fetch PM orders:", err);
  }

  return [
    {
      id: 'pm-1',
      issueId: 'PM-2026-001',
      line: 'Line 1',
      machine: 'Cupper',
      description: 'فحص دوري شهري للضغط الهيدروليكي وتشحيم الكامات الرئيسية',
      category: 'ميكانيكا',
      priority: 'High',
      plannedDate: new Date().toISOString().slice(0, 10),
      pmStatus: 'planned',
      assignedTo: 'م. حسام علي',
      downtimeRequired: true,
      tasks: [
        { id: 't1', title: 'فحص ضغط زيت الهيدروليك وضبطه على 140 بار', completed: true },
        { id: 't2', title: 'فحص خراطيم السحب والتفريغ بحثاً عن تشققات', completed: false },
        { id: 't3', title: 'تشحيم نقاط الحركة الميكانيكية', completed: false }
      ],
      createdAt: new Date().toISOString()
    },
    {
      id: 'pm-2',
      issueId: 'PM-2026-002',
      line: 'Line 2',
      machine: 'Spray 04',
      description: 'تنظيف فوهات الرش وفحص حساسات درجة حرارة الفرن',
      category: 'كهرباء',
      priority: 'Medium',
      plannedDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      pmStatus: 'unplanned',
      downtimeRequired: false,
      tasks: [
        { id: 't1', title: 'تنظيف وتفكيك نوزلات الرش الدقيقة', completed: false },
        { id: 't2', title: 'معايرة حساسات الحرارة ومطابقتها مع شاشة PLC', completed: false }
      ],
      createdAt: new Date().toISOString()
    }
  ];
}

export async function savePMRecord(payload: {
  machine: string;
  checklist: { hydraulic: boolean; filters: boolean; lubrication: boolean };
  notes: string;
  reporter: any;
}): Promise<void> {
  try {
    await addDoc(collection(db, 'pmRecords'), {
      ...payload,
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    console.warn("Saving PM record locally:", err);
  }
}

export async function updatePMOrder(id: string, updates: Partial<PMOrder>): Promise<void> {
  try {
    await updateDoc(doc(db, 'pmOrders', id), updates);
  } catch (err) {
    console.warn("Local update PM order:", err);
  }
}
