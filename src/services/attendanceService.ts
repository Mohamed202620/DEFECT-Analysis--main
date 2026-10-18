import { Holiday } from '../types';
import { db } from '../config/firebase';
import { collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';

export interface AttendanceCycle {
  startDate: string;
  endDate: string;
  daysPassed: number;
  totalDays: number;
  progressPercent: number;
  shiftName: string;
  overtimeHours: number;
  estimatedBonus: number;
}

export function calculateAttendanceCycle(shift: string = 'A'): AttendanceCycle {
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let start: Date;
  let end: Date;

  if (currentDay >= 21) {
    // Current cycle started on 21st of this month, ends on 20th of next month
    start = new Date(currentYear, currentMonth, 21);
    end = new Date(currentYear, currentMonth + 1, 20);
  } else {
    // Current cycle started on 21st of previous month, ends on 20th of this month
    start = new Date(currentYear, currentMonth - 1, 21);
    end = new Date(currentYear, currentMonth, 20);
  }

  const totalTime = end.getTime() - start.getTime();
  const passedTime = Math.max(0, now.getTime() - start.getTime());
  const totalDays = Math.round(totalTime / (1000 * 3600 * 24));
  const daysPassed = Math.min(totalDays, Math.round(passedTime / (1000 * 3600 * 24)));
  const progressPercent = Math.min(100, Math.round((daysPassed / totalDays) * 100));

  return {
    startDate: start.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }),
    endDate: end.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }),
    daysPassed,
    totalDays,
    progressPercent,
    shiftName: shift,
    overtimeHours: 12.5,
    estimatedBonus: 850
  };
}

export const DEFAULT_HOLIDAYS_2026: Holiday[] = [
  { id: 'h1', name: 'عيد الفطر المبارك', date: '2026-03-20', daysCount: 3 },
  { id: 'h2', name: 'عيد تحرير سيناء', date: '2026-04-25', daysCount: 1 },
  { id: 'h3', name: 'عيد العمال', date: '2026-05-01', daysCount: 1 },
  { id: 'h4', name: 'عيد الأضحى المبارك', date: '2026-05-27', daysCount: 4 },
  { id: 'h5', name: 'ثورة 30 يونيو', date: '2026-06-30', daysCount: 1 },
  { id: 'h6', name: 'عيد القوات المسلحة (6 أكتوبر)', date: '2026-10-06', daysCount: 1 }
];

export async function fetchHolidays(): Promise<Holiday[]> {
  try {
    const snap = await getDocs(collection(db, 'holidays'));
    if (!snap.empty) {
      return snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<Holiday, 'id'>)
      }));
    }
  } catch (err) {
    console.warn("Could not fetch holidays:", err);
  }
  return DEFAULT_HOLIDAYS_2026;
}

export async function addHoliday(holiday: Omit<Holiday, 'id'>): Promise<void> {
  try {
    await addDoc(collection(db, 'holidays'), holiday);
  } catch (err) {
    console.warn("Local add holiday:", err);
  }
}

export async function deleteHoliday(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'holidays', id));
  } catch (err) {
    console.warn("Local delete holiday:", err);
  }
}
