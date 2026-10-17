// ============================================================
// sequenceCore.js
// خوارزمية حجز الرقم التسلسلي (وحدة نقية قابلة للاختبار بدون Firebase).
//
// المبدأ (Compare-And-Swap عبر قواعد Firestore، بدون Transactions):
//   1) نقرأ قيمة العدّاد الحالية من السيرفر (N).
//   2) نرسل دفعة ذرّية (writeBatch) تحتوي: تحديث العدّاد إلى N+1 + كتابة السجل برقمه.
//   3) قاعدة counters تقبل الزيادة بمقدار 1 فقط من القيمة الحالية على السيرفر؛
//      فإن سبقنا مستخدم آخر لنفس الرقم تُرفض الدفعة كاملة (لا يُكتب شيء)
//      فنعيد قراءة العدّاد ونجرّب الرقم التالي.
// النتيجة: لا تكرار ولا فجوات (الرقم والسجل يُكتبان معاً أو لا يُكتب أيٌّ منهما).
// ============================================================

import { formatSequenceNumber } from "./recordNumber.js";

export const MAX_ALLOCATION_ATTEMPTS = 12;

const CONTENTION_CODES = new Set(["permission-denied", "aborted", "failed-precondition", "already-exists"]);

function looksLikeContention(error) {
  const code = String(error?.code || "").replace(/^firestore\//, "");
  if (CONTENTION_CODES.has(code)) return true;
  return /missing or insufficient permissions|already exists|aborted/i.test(String(error?.message || ""));
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {string} type  نوع السجل (tickets | suggestions | pmOrders ...)
 * @param {(batch:any, unifiedNumber:string)=>void} addWrites  تضيف كتابات السجل إلى الدفعة
 * @param {{ readCounter:(type:string)=>Promise<number>, commit:(type:string,next:number,unifiedNumber:string,addWrites:Function)=>Promise<void>, sleep?:Function, maxAttempts?:number }} deps
 * @returns {Promise<{unifiedNumber:string, number:number}>}
 */
export async function allocateAndCommit(type, addWrites, deps) {
  const maxAttempts = deps.maxAttempts || MAX_ALLOCATION_ATTEMPTS;
  const sleep = deps.sleep || defaultSleep;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const current = await deps.readCounter(type);
    const next = (Number.isInteger(current) && current > 0 ? current : 0) + 1;
    const unifiedNumber = formatSequenceNumber(type, next);

    try {
      await deps.commit(type, next, unifiedNumber, addWrites);
      return { unifiedNumber, number: next };
    } catch (error) {
      lastError = error;
      if (!looksLikeContention(error)) throw error;

      // هل خسرنا السباق فعلاً؟ (العدّاد على السيرفر وصل لهذا الرقم أو تجاوزه)
      // لو لم يتقدّم العدّاد فالرفض سببه قاعدة أخرى (بيانات السجل نفسه) فلا نعيد المحاولة.
      const after = await deps.readCounter(type);
      if (!(Number.isInteger(after) && after >= next)) throw error;

      await sleep(Math.floor(Math.random() * 60 * attempt));
    }
  }

  throw lastError || new Error("تعذر حجز رقم تسلسلي");
}
