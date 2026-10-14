import { UserProfile, UserRole, UserStatus } from '../types';
import { db } from '../config/firebase';
import { collection, getDocs, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';

export async function fetchAllUsers(): Promise<UserProfile[]> {
  try {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map(d => ({
        id: d.id,
        uid: d.id,
        ...(d.data() as Omit<UserProfile, 'id'>)
      }));
    }
  } catch (err) {
    console.warn("Could not fetch users from Firestore:", err);
  }

  return [
    {
      id: 'u-1',
      name: 'م. أحمد حسنين',
      phone: '01067988554',
      role: 'admin',
      status: 'active',
      department: 'all',
      machineDepartment: 'frontend',
      job: 'مدير عام الصيانة والتشغيل',
      shift: 'A',
      line: 'Line 1'
    },
    {
      id: 'u-2',
      name: 'م. إبراهيم كمال',
      phone: '01122334455',
      role: 'engineer',
      status: 'active',
      department: 'frontend',
      machineDepartment: 'frontend',
      job: 'مهندس صيانة ميكانيكية',
      shift: 'B',
      line: 'Line 1'
    },
    {
      id: 'u-3',
      name: 'طارق حامد',
      phone: '01233445566',
      role: 'technician',
      status: 'active',
      department: 'backend',
      machineDepartment: 'backend',
      job: 'فني كهرباء وتحكم',
      shift: 'A',
      line: 'Line 2'
    },
    {
      id: 'u-4',
      name: 'علي حسن السعيد',
      phone: '01555667788',
      role: 'operator',
      status: 'pending',
      department: 'frontend',
      machineDepartment: 'frontend',
      job: 'مشغل ماكينة باودي ميكر',
      shift: 'C',
      line: 'Line 1'
    }
  ];
}

export async function updateUserStatus(userId: string, status: UserStatus): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', userId), { status });
  } catch (err) {
    console.warn("Update user status error:", err);
  }
}

export async function updateUserRole(userId: string, role: UserRole, permissions?: string[]): Promise<void> {
  try {
    const data: any = { role };
    if (permissions) data.permissions = permissions;
    await updateDoc(doc(db, 'users', userId), data);
  } catch (err) {
    console.warn("Update user role error:", err);
  }
}

export async function deleteUser(userId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'users', userId));
  } catch (err) {
    console.warn("Delete user error:", err);
  }
}
