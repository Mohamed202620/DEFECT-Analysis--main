const RETRY_BASE_DELAY_MS = 60_000;
const RETRY_MAX_DELAY_MS = 60 * 60_000;

export function getOfflineSyncRetryDelay(attempts) {
  const count = Number.isFinite(Number(attempts))
    ? Math.max(1, Math.floor(Number(attempts)))
    : 1;
  const exponent = Math.min(count - 1, 6);
  return Math.min(RETRY_BASE_DELAY_MS * (2 ** exponent), RETRY_MAX_DELAY_MS);
}

export function isOfflineSyncRetryDue(nextAttemptAt, now = Date.now()) {
  const timestamp = Number(nextAttemptAt);
  return !Number.isFinite(timestamp) || timestamp <= now;
}

export function getOfflineSyncDocumentId(localId) {
  const safeId = String(localId || "").replace(/[^a-zA-Z0-9_-]/g, "_");
  if (!safeId) throw new Error("Offline sync id is required");
  return `offline_${safeId}`;
}
