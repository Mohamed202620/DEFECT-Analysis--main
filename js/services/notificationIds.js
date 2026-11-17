export async function stableNotificationId(prefix, resourceId, recipientUid) {
  const input = `${resourceId}\0${recipientUid}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  const suffix = Array.from(new Uint8Array(digest).slice(0, 16), byte => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}${suffix}`;
}
