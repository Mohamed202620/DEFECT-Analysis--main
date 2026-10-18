import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'ar' | 'en';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  isRtl: boolean;
  t: (key: string, defaultText?: string) => string;
}

const translations = {
  ar: {
    appName: "نظام إدارة الصيانة وتحليل العيوب",
    home: "الرئيسية",
    maintenance: "مركز الصيانة",
    tickets: "متابعة البلاغات",
    newIssue: "تسجيل عطل",
    pm: "الصيانة الوقائية",
    pmOrders: "أوامر الصيانة PM",
    kaizen: "نظام كايزن",
    kaizenBoard: "لوحة الكايزن",
    errorScanner: "فاحص أكواد الأعطال",
    machines: "إدارة الماكينات",
    fiveS: "تقييم 5S",
    dailyAM: "فحص المشغل اليومي (AM)",
    knowledgeBase: "قاعدة المعرفة",
    stats: "الإحصائيات والتحليلات",
    users: "المستخدمين والصلاحيات",
    settings: "إعدادات النظام",
    login: "تسجيل الدخول",
    register: "إنشاء حساب جديد",
    logout: "تسجيل الخروج",
    back: "رجوع",
    save: "حفظ",
    cancel: "إلغاء",
    submit: "إرسال",
    search: "بحث",
    filter: "تصفية",
    status: "الحالة",
    priority: "الأولوية",
    line: "خط الإنتاج",
    department: "القسم",
    machine: "الماكينة",
    unit: "الوحدة",
    description: "الوصف",
    actions: "الإجراءات",
    details: "التفاصيل",
    attachments: "المرفقات",
    notes: "الملاحظات",
    openTickets: "أعطال مفتوحة",
    closedTickets: "تم إصلاحها",
    todayTickets: "أعطال اليوم",
    overdueTickets: "بلاغات متأخرة",
    totalTickets: "إجمالي البلاغات",
    criticalBreakdown: "عطل حرج!",
    technician: "الفني",
    assignedTo: "المسند إليه",
    reportedBy: "المُبلّغ",
    createdAt: "تاريخ البلاغ",
    liveSystem: "نظام حي 🟢",
    whatsappSupport: "تواصل مع مسؤول الصيانة عبر واتساب",
    attendanceTitle: "حاسبة الحضور والورديات",
    currentShift: "الوردية الحالية",
    overtimeHours: "ساعات الإضافي",
    quickActions: "الإجراءات السريعة",
    highPriority: "عالية",
    mediumPriority: "متوسطة",
    lowPriority: "منخفضة",
    statusPending: "قيد الانتظار",
    statusAssigned: "تم الإسناد",
    statusInProgress: "قيد التنفيذ",
    statusWaitingParts: "بانتظار قطع الغيار",
    statusResolved: "تم الإصلاح",
    statusClosed: "مغلق",
    categoryMech: "ميكانيكا",
    categoryElec: "كهرباء",
    categoryProg: "برمجة وحساسات",
    categoryQuality: "جودة",
    categorySafety: "سلامة وصحة مهنية",
    categoryOther: "أخرى",
  },
  en: {
    appName: "Maintenance & Defect Analysis System",
    home: "Home",
    maintenance: "Maintenance Hub",
    tickets: "Track Tickets",
    newIssue: "Report Breakdown",
    pm: "Preventive Maint.",
    pmOrders: "PM Work Orders",
    kaizen: "Kaizen System",
    kaizenBoard: "Kaizen Board",
    errorScanner: "Error Code Scanner",
    machines: "Machines Directory",
    fiveS: "5S Assessment",
    dailyAM: "Autonomous Maint. (AM)",
    knowledgeBase: "Knowledge Base",
    stats: "Analytics & Stats",
    users: "Users & Access",
    settings: "System Settings",
    login: "Sign In",
    register: "Register Account",
    logout: "Log Out",
    back: "Back",
    save: "Save",
    cancel: "Cancel",
    submit: "Submit",
    search: "Search",
    filter: "Filter",
    status: "Status",
    priority: "Priority",
    line: "Production Line",
    department: "Department",
    machine: "Machine",
    unit: "Unit",
    description: "Description",
    actions: "Actions",
    details: "Details",
    attachments: "Attachments",
    notes: "Notes",
    openTickets: "Open Breakdowns",
    closedTickets: "Resolved",
    todayTickets: "Today's Tickets",
    overdueTickets: "Overdue",
    totalTickets: "Total Tickets",
    criticalBreakdown: "Critical Breakdown!",
    technician: "Technician",
    assignedTo: "Assigned To",
    reportedBy: "Reported By",
    createdAt: "Created At",
    liveSystem: "Live System 🟢",
    whatsappSupport: "Contact Maintenance Lead on WhatsApp",
    attendanceTitle: "Shift & Attendance Clock",
    currentShift: "Current Shift",
    overtimeHours: "Overtime Hours",
    quickActions: "Quick Actions",
    highPriority: "High",
    mediumPriority: "Medium",
    lowPriority: "Low",
    statusPending: "Pending",
    statusAssigned: "Assigned",
    statusInProgress: "In Progress",
    statusWaitingParts: "Waiting Parts",
    statusResolved: "Resolved",
    statusClosed: "Closed",
    categoryMech: "Mechanical",
    categoryElec: "Electrical",
    categoryProg: "Programming/Sensors",
    categoryQuality: "Quality",
    categorySafety: "Safety",
    categoryOther: "Other",
  }
};

const LanguageContext = createContext<LanguageContextType>({
  lang: 'ar',
  setLang: () => {},
  isRtl: true,
  t: (key: string) => key
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    return (localStorage.getItem('lang') as Language) || 'ar';
  });

  const isRtl = lang === 'ar';

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('lang', newLang);
    document.documentElement.lang = newLang;
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
  };

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
  }, [lang, isRtl]);

  const t = (key: string, defaultText?: string): string => {
    const dict = translations[lang] as Record<string, string>;
    return dict[key] || defaultText || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, isRtl, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
