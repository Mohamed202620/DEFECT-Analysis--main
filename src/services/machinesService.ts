import { MachineType } from '../types';
import { db } from '../config/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';

function padNumbers(count: number): string[] {
  const list: string[] = [];
  for (let i = 1; i <= count; i++) {
    list.push(String(i).padStart(2, '0'));
  }
  return list;
}

export const DEFAULT_MACHINE_TYPES: MachineType[] = [
  // Frontend
  { key: "Coil Handling", units: [], department: "frontend", active: true },
  { key: "Baler", units: [], department: "frontend", active: true },
  { key: "Cupper", units: [], department: "frontend", active: true },
  { key: "Bodymaker", units: padNumbers(11), department: "frontend", active: true },
  { key: "Trimmer", units: [], department: "frontend", active: true },
  { key: "Washer", units: [], department: "frontend", active: true },
  { key: "Front End Line Control", units: [], department: "frontend", active: true },

  // Backend
  { key: "Decorator", units: padNumbers(2), department: "backend", active: true },
  { key: "Spray", units: padNumbers(11), department: "backend", active: true },
  { key: "IBO", units: [], department: "backend", active: true },
  { key: "Necker", units: [], department: "backend", active: true },
  { key: "Palletizer", units: [], department: "backend", active: true },
  { key: "Depalletizer", units: [], department: "backend", active: true },
  { key: "Mid Line Control", units: [], department: "backend", active: true },
  { key: "Back End Line Control", units: [], department: "backend", active: true },
  { key: "STRAP", units: ["A1", "A2", "B1", "B2"], department: "backend", active: true }
];

export async function fetchMachineTypes(): Promise<MachineType[]> {
  try {
    const snap = await getDocs(collection(db, 'machineTypes'));
    if (!snap.empty) {
      return snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<MachineType, 'id'>)
      }));
    }
  } catch (err) {
    console.warn("Could not fetch machines from Firestore, using default catalog:", err);
  }
  return DEFAULT_MACHINE_TYPES;
}

export function filterMachinesByDept(
  machines: MachineType[],
  userDept?: 'frontend' | 'backend' | 'all' | string,
  isAdminOrManager: boolean = false
): MachineType[] {
  if (isAdminOrManager || !userDept || userDept === 'all' || userDept === 'general') {
    return machines;
  }
  return machines.filter(m => m.department === userDept);
}

export async function addMachineType(machine: Omit<MachineType, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'machineTypes'), machine);
  return docRef.id;
}

export async function updateMachineType(id: string, machine: Partial<MachineType>): Promise<void> {
  await updateDoc(doc(db, 'machineTypes', id), machine);
}

export async function deleteMachineType(id: string): Promise<void> {
  await deleteDoc(doc(db, 'machineTypes', id));
}
