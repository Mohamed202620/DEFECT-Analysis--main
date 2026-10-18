export type UserRole =
  | 'admin'
  | 'manager'
  | 'supervisor'
  | 'engineer'
  | 'maintainer'
  | 'technician'
  | 'operator'
  | 'user';

export type UserStatus = 'active' | 'pending' | 'suspended';
export type Department = 'frontend' | 'backend' | 'general' | 'all';
export type Line = 'Line 1' | 'Line 2' | 'Line 3' | 'All';

export interface UserProfile {
  id: string;
  uid?: string;
  name: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  department?: string;
  machineDepartment?: 'frontend' | 'backend';
  job?: string;
  shift?: string;
  line?: string;
  permissions?: string[];
  createdAt?: string;
}

export type TicketStatus =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'waiting_parts'
  | 'resolved'
  | 'closed';

export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type TicketCategory =
  | 'ميكانيكا'
  | 'كهرباء'
  | 'برمجة'
  | 'جودة'
  | 'تشغيل'
  | 'Safety'
  | 'أخرى';

export interface TicketLog {
  id: string;
  action: string;
  performedBy: string;
  timestamp: string;
  note?: string;
  fromStatus?: string;
  toStatus?: string;
}

export interface Ticket {
  id: string;
  issueId?: string;
  unifiedNumber?: number;
  title?: string;
  description: string;
  line: string;
  department: string;
  machine: string;
  machineUnit?: string;
  category: TicketCategory | string;
  priority: TicketPriority;
  status: TicketStatus;
  reportedBy: string;
  reporterPhone?: string;
  reporterShift?: string;
  assignedTo?: string;
  assignedToName?: string;
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  downtimeMinutes?: number;
  rootCause?: string;
  actionTaken?: string;
  spareParts?: string[];
  images?: string[];
  shiftNotes?: { author: string; shift: string; note: string; timestamp: string }[];
  isOverdue?: boolean;
}

export interface MachineType {
  id?: string;
  key: string;
  units: string[];
  department: 'frontend' | 'backend';
  active?: boolean;
}

export interface KaizenSuggestion {
  id: string;
  title: string;
  line: string;
  machine: string;
  category: string;
  problem: string;
  solution: string;
  impact: string;
  name: string;
  job?: string;
  department?: string;
  shift?: string;
  phone?: string;
  anonymous?: boolean;
  status: 'new' | 'under_review' | 'approved' | 'implemented' | 'rejected';
  date: string;
  images?: string[];
  adminNotes?: string;
}

export interface PMOrder {
  id: string;
  issueId?: string;
  line: string;
  machine: string;
  description: string;
  category?: string;
  priority?: string;
  plannedDate?: string;
  pmStatus: 'unplanned' | 'planned' | 'in_progress' | 'completed' | 'deferred';
  assignedTo?: string;
  downtimeRequired?: boolean;
  tasks?: { id: string; title: string; completed: boolean }[];
  maintenanceNotes?: string;
  createdAt: string;
}

export interface MachineErrorGuide {
  id: string;
  machineType: string;
  code: string;
  title: string;
  symptoms?: string;
  causes: string[];
  solutions: string[];
  verified: boolean;
  verifiedBy?: string;
}

export interface FiveSPillar {
  id: 'sort' | 'setInOrder' | 'shine' | 'standardize' | 'sustain';
  rating: number; // 1-5
  note?: string;
}

export interface Holiday {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  daysCount: number;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  ticketId?: string;
  type?: 'ticket' | 'pm' | 'kaizen' | 'system';
}
