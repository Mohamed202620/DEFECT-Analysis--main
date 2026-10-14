import { Ticket, TicketLog, TicketStatus, TicketPriority } from '../types';
import { db } from '../config/firebase';
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

export async function generateTicketId(): Promise<string> {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `TKT-${year}-${rand}`;
}

export async function createTicket(
  ticketData: Omit<Ticket, 'id' | 'createdAt' | 'status'> & { status?: TicketStatus }
): Promise<Ticket> {
  const issueId = await generateTicketId();
  const now = new Date().toISOString();

  const newTicket: Omit<Ticket, 'id'> = {
    ...ticketData,
    issueId,
    status: ticketData.status || 'pending',
    createdAt: now,
    updatedAt: now,
    shiftNotes: ticketData.shiftNotes || [],
    images: ticketData.images || [],
    spareParts: ticketData.spareParts || []
  };

  try {
    const docRef = await addDoc(collection(db, 'tickets'), {
      ...newTicket,
      serverTime: serverTimestamp()
    });

    // Add creation log
    await addDoc(collection(db, 'ticketLogs'), {
      ticketId: docRef.id,
      action: 'create',
      performedBy: ticketData.reportedBy || 'User',
      timestamp: now,
      note: 'تم تسجيل بلاغ العطل بنجاح'
    });

    return { id: docRef.id, ...newTicket };
  } catch (err) {
    console.warn("Falling back to local storage ticket:", err);
    // Offline / fallback storage
    const id = 'local_' + Date.now();
    const fullTicket = { id, ...newTicket };
    const saved = JSON.parse(localStorage.getItem('cached_tickets') || '[]');
    saved.unshift(fullTicket);
    localStorage.setItem('cached_tickets', JSON.stringify(saved));
    return fullTicket;
  }
}

export async function fetchTickets(): Promise<Ticket[]> {
  try {
    const q = query(collection(db, 'tickets'), orderBy('createdAt', 'desc'), limit(150));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<Ticket, 'id'>)
      }));
    }
  } catch (err) {
    console.warn("Error fetching tickets from Firestore:", err);
  }

  // Fallback to cached tickets or mock initial data
  const cached = localStorage.getItem('cached_tickets');
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      // ignore
    }
  }

  return getInitialMockTickets();
}

export function subscribeToTickets(callback: (tickets: Ticket[]) => void): () => void {
  try {
    const q = query(collection(db, 'tickets'), orderBy('createdAt', 'desc'), limit(150));
    return onSnapshot(q, (snapshot) => {
      const tickets = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<Ticket, 'id'>)
      }));
      callback(tickets);
    }, (err) => {
      console.warn("Snapshot error, falling back:", err);
      fetchTickets().then(callback);
    });
  } catch (err) {
    fetchTickets().then(callback);
    return () => {};
  }
}

export async function fetchActiveTicketForMachine(machine: string, line: string): Promise<Ticket | null> {
  try {
    const q = query(
      collection(db, 'tickets'),
      where('machine', '==', machine),
      where('line', '==', line),
      where('status', 'in', ['pending', 'assigned', 'in_progress', 'waiting_parts'])
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0];
      return { id: d.id, ...(d.data() as Omit<Ticket, 'id'>) };
    }
  } catch (e) {
    console.warn("Active ticket query fallback:", e);
  }
  return null;
}

export async function updateTicketStatus(
  ticketId: string,
  newStatus: TicketStatus,
  user: string,
  extra?: { rootCause?: string; actionTaken?: string; note?: string; downtimeMinutes?: number }
): Promise<void> {
  const now = new Date().toISOString();
  const updateData: any = {
    status: newStatus,
    updatedAt: now
  };

  if (newStatus === 'resolved') {
    updateData.resolvedAt = now;
  }
  if (newStatus === 'closed') {
    updateData.closedAt = now;
  }
  if (extra?.rootCause) updateData.rootCause = extra.rootCause;
  if (extra?.actionTaken) updateData.actionTaken = extra.actionTaken;
  if (extra?.downtimeMinutes !== undefined) updateData.downtimeMinutes = extra.downtimeMinutes;

  try {
    await updateDoc(doc(db, 'tickets', ticketId), updateData);
    await addDoc(collection(db, 'ticketLogs'), {
      ticketId,
      action: newStatus,
      performedBy: user,
      timestamp: now,
      note: extra?.note || `تم تحديث الحالة إلى ${newStatus}`
    });
  } catch (err) {
    console.warn("Local update for ticket:", err);
    const saved = JSON.parse(localStorage.getItem('cached_tickets') || '[]');
    const idx = saved.findIndex((t: Ticket) => t.id === ticketId);
    if (idx !== -1) {
      saved[idx] = { ...saved[idx], ...updateData };
      localStorage.setItem('cached_tickets', JSON.stringify(saved));
    }
  }
}

export async function assignTicket(ticketId: string, technicianName: string, managerName: string): Promise<void> {
  const now = new Date().toISOString();
  try {
    await updateDoc(doc(db, 'tickets', ticketId), {
      assignedTo: technicianName,
      status: 'assigned',
      updatedAt: now
    });
    await addDoc(collection(db, 'ticketLogs'), {
      ticketId,
      action: 'assign',
      performedBy: managerName,
      timestamp: now,
      note: `تم إسناد البلاغ إلى الفني: ${technicianName}`
    });
  } catch (err) {
    console.warn("Local assign fallback:", err);
  }
}

export async function appendShiftNote(ticketId: string, author: string, shift: string, note: string): Promise<void> {
  const now = new Date().toISOString();
  const newNote = { author, shift, note, timestamp: now };
  try {
    const ticketDoc = await getDoc(doc(db, 'tickets', ticketId));
    if (ticketDoc.exists()) {
      const existing = ticketDoc.data().shiftNotes || [];
      await updateDoc(doc(db, 'tickets', ticketId), {
        shiftNotes: [...existing, newNote],
        updatedAt: now
      });
    }
  } catch (err) {
    console.warn("Local shift note fallback:", err);
  }
}

export async function fetchTicketLogs(ticketId: string): Promise<TicketLog[]> {
  try {
    const q = query(collection(db, 'ticketLogs'), where('ticketId', '==', ticketId), orderBy('timestamp', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id,
      ...(d.data() as Omit<TicketLog, 'id'>)
    }));
  } catch {
    return [
      {
        id: '1',
        action: 'create',
        performedBy: 'النظام',
        timestamp: new Date().toISOString(),
        note: 'تم تسجيل البلاغ في النظام'
      }
    ];
  }
}

export function computeDashboardMetrics(tickets: Ticket[]) {
  const todayStr = new Date().toISOString().slice(0, 10);
  let open = 0;
  let closed = 0;
  let today = 0;
  let overdue = 0;
  let critical = 0;

  tickets.forEach(t => {
    const isClosed = t.status === 'resolved' || t.status === 'closed';
    if (!isClosed) {
      open++;
      if (t.priority === 'Critical' || t.priority === 'High') {
        critical++;
      }
      // Check overdue (more than 4 hours in open state)
      const createdTime = new Date(t.createdAt).getTime();
      if (Date.now() - createdTime > 4 * 60 * 60 * 1000) {
        overdue++;
      }
    } else {
      closed++;
    }

    if (t.createdAt && t.createdAt.slice(0, 10) === todayStr) {
      today++;
    }
  });

  return {
    open,
    closed,
    today,
    overdue,
    critical,
    total: tickets.length
  };
}

function getInitialMockTickets(): Ticket[] {
  const now = new Date();
  const subHours = (h: number) => new Date(now.getTime() - h * 3600000).toISOString();

  return [
    {
      id: 'mock-1',
      issueId: 'TKT-2026-1042',
      line: 'Line 1',
      department: 'frontend',
      machine: 'Bodymaker 03',
      category: 'ميكانيكا',
      priority: 'Critical',
      status: 'in_progress',
      description: 'تسريب زيت هيدروليكي أسفل الرام الرئيسي مع اهتزاز غير طبيعي أثناء التشغيل',
      reportedBy: 'أحمد محمود',
      reporterShift: 'وردية A',
      assignedTo: 'م. إبراهيم كمال',
      createdAt: subHours(1.5),
      shiftNotes: [
        { author: 'أحمد محمود', shift: 'A', note: 'تم إيقاف الماكينة فوراً لمنع تفاقم العطل', timestamp: subHours(1.4) }
      ]
    },
    {
      id: 'mock-2',
      issueId: 'TKT-2026-1041',
      line: 'Line 2',
      department: 'backend',
      machine: 'Decorator 01',
      category: 'كهرباء',
      priority: 'High',
      status: 'pending',
      description: 'إنذار متكرر لحساس تغذية العلب E-402 مع توقف السير',
      reportedBy: 'سعيد عبد الله',
      reporterShift: 'وردية B',
      createdAt: subHours(3.2)
    },
    {
      id: 'mock-3',
      issueId: 'TKT-2026-1039',
      line: 'Line 1',
      department: 'backend',
      machine: 'Palletizer',
      category: 'برمجة',
      priority: 'Medium',
      status: 'waiting_parts',
      description: 'تأخير في حركة ذراع الرص الهوائي وبانتظار بلف الهواء البديل',
      reportedBy: 'محمود عبد الرازق',
      reporterShift: 'وردية A',
      assignedTo: 'طارق حامد',
      createdAt: subHours(6.0)
    },
    {
      id: 'mock-4',
      issueId: 'TKT-2026-1035',
      line: 'Line 2',
      department: 'frontend',
      machine: 'Washer',
      category: 'ميكانيكا',
      priority: 'Low',
      status: 'resolved',
      description: 'تنظيف وتغيير فلاتر دورة الشطف الأولى',
      reportedBy: 'ياسر فوزي',
      reporterShift: 'وردية C',
      assignedTo: 'م. إبراهيم كمال',
      createdAt: subHours(18.0),
      resolvedAt: subHours(15.0),
      actionTaken: 'تم استبدال الفلاتر وتنظيف الفوهات وضبط الضغط إلى 3.5 بار'
    }
  ];
}
