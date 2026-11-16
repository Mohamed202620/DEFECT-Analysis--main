import { CLOSED_STATUSES, parseTicketDate } from "../ticketStatusConstants.js";

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildManagerTrendSeries(tickets, { now = new Date(), days = 10, isEnglish = false } = {}) {
  const points = new Map();
  const labels = [];

  for (let offset = days - 1; offset >= 0; offset--) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    const key = localDateKey(date);
    points.set(key, { newCount: 0, resolvedCount: 0 });
    labels.push(date.toLocaleDateString(isEnglish ? "en-US" : "ar-EG", {
      weekday: "short",
      month: "numeric",
      day: "numeric"
    }));
  }

  (Array.isArray(tickets) ? tickets : []).forEach(ticket => {
    const created = parseTicketDate(ticket.createdAtServer) || parseTicketDate(ticket);
    if (created) {
      const point = points.get(localDateKey(created));
      if (point) point.newCount++;
    }

    if (!CLOSED_STATUSES.includes(String(ticket.status || "").trim().toLowerCase())) return;
    const resolved = parseTicketDate(ticket.resolvedAtServer)
      || parseTicketDate(ticket.resolvedAt)
      || parseTicketDate(ticket.updatedAt);
    if (!resolved) return;
    const point = points.get(localDateKey(resolved));
    if (point) point.resolvedCount++;
  });

  const series = Array.from(points.values());
  return {
    labels,
    newCounts: series.map(point => point.newCount),
    resolvedCounts: series.map(point => point.resolvedCount)
  };
}
