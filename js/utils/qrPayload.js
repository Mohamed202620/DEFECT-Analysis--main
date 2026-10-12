import { normalizeLine } from "./lineUtils.js";

function decodeBase64QrPayload(text) {
  if (/\s/.test(text)) return null;
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(text)) return null;

  try {
    let base64 = text.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes).trim();
    if (/^(\{|mid:|https?:\/\/)/i.test(decoded)) return decoded;
  } catch {
    return null;
  }
  return null;
}

export function parseQrPayload(rawText) {
  let text = String(rawText || "").trim();
  if (!text) return { value: "", line: "" };

  const decodedBase64 = decodeBase64QrPayload(text);
  if (decodedBase64) text = decodedBase64;

  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object") {
        const type = String(parsed.m ?? parsed.machine ?? parsed.machineValue ?? parsed.v ?? parsed.id ?? "").trim();
        const unit = String(parsed.u ?? parsed.unit ?? "").trim();
        return {
          value: unit ? `${type} ${unit}`.trim() : type,
          line: normalizeLine(parsed.line ?? parsed.l ?? parsed.productionLine ?? "")
        };
      }
    } catch {
      return { value: text, line: "" };
    }
  }

  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      const value = url.searchParams.get("m") || url.searchParams.get("machine") || "";
      if (value) {
        return {
          value: String(value).trim(),
          line: normalizeLine(url.searchParams.get("line") || url.searchParams.get("l") || "")
        };
      }
    } catch {
      return { value: text, line: "" };
    }
  }

  let body = text;
  if (body.toUpperCase().startsWith("MID:")) body = body.slice(4).trim();
  const parts = body.split("|");
  if (parts.length > 1) {
    return { value: parts[0].trim(), line: normalizeLine(parts.slice(1).join("|")) };
  }
  return { value: body, line: "" };
}
