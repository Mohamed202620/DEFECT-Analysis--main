import { parseTicketDate } from "../ticketStatusConstants.js";

export function getReportRecordDate(item) {
  return parseTicketDate(item?.createdAt || item?.date || item?.timestamp || null);
}

export function filterRecordsByDateRange(records, filterType, fromDate, toDate, now = new Date()) {
  if (!filterType || filterType === "all") return records;

  let start = null;
  let end = null;

  if (filterType === "today") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else if (filterType === "last7") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else if (filterType === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  } else if (filterType === "year") {
    start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  } else if (filterType === "custom") {
    if (fromDate) {
      start = new Date(`${fromDate}T00:00:00`);
      if (Number.isNaN(start.getTime())) throw new RangeError("Invalid report start date");
    }
    if (toDate) {
      end = new Date(`${toDate}T23:59:59.999`);
      if (Number.isNaN(end.getTime())) throw new RangeError("Invalid report end date");
    }
    if (!start && !end) return records;
  } else {
    return records;
  }

  if (start && end && start > end) {
    throw new RangeError("Report start date must not be after the end date");
  }

  return records.filter(item => {
    const itemDate = getReportRecordDate(item);
    if (!itemDate) return false;
    if (start && itemDate < start) return false;
    if (end && itemDate > end) return false;
    return true;
  });
}

export function sortRecordsNewestFirst(records) {
  return [...records].sort((a, b) => {
    const da = getReportRecordDate(a);
    const db = getReportRecordDate(b);
    return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
  });
}

export function localDateStamp(date = new Date()) {
  const pad = n => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function getMonthlyTicketStatusCounts(tickets) {
  const statuses = tickets.map(ticket => String(ticket.status || "").trim().toLowerCase());
  const closedCount = statuses.filter(status =>
    ["closed", "done", "مغلق", "مغلقة"].includes(status)
  ).length;
  const resolvedCount = statuses.filter(status =>
    ["resolved", "تم الإصلاح"].includes(status)
  ).length;
  const inProgressCount = statuses.filter(status =>
    ["in_progress", "assigned", "reopened", "قيد التنفيذ", "تم الإسناد"].includes(status)
  ).length;

  return {
    total: tickets.length,
    closed: closedCount,
    resolved: resolvedCount,
    inProgress: inProgressCount,
    pending: tickets.length - closedCount - resolvedCount - inProgressCount
  };
}

export function formatReportTicketStatus(status, isEn) {
  const value = String(status || "").trim().toLowerCase();
  const labels = {
    pending: ["جديد", "New"],
    new: ["جديد", "New"],
    assigned: ["تم الإسناد", "Assigned"],
    in_progress: ["قيد التنفيذ", "In Progress"],
    reopened: ["قيد التنفيذ", "In Progress"],
    resolved: ["بانتظار تأكيد المُبلّغ", "Awaiting Reporter Confirmation"],
    closed: ["مغلقة", "Closed"],
    done: ["مكتملة", "Completed"],
    "تم الإصلاح": ["تم الإصلاح", "Awaiting Reporter Confirmation"],
    "مغلق": ["مغلقة", "Closed"],
    "مغلقة": ["مغلقة", "Closed"],
    "قيد التنفيذ": ["قيد التنفيذ", "In Progress"],
    "تم الإسناد": ["تم الإسناد", "Assigned"],
    "جديد": ["جديد", "New"]
  };
  return labels[value]?.[isEn ? 1 : 0] || status || (isEn ? "New" : "جديد");
}
