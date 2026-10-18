// ============================================================
// sequenceApi.js
// الترقيم التسلسلي الموحد (BR-001 / KZ-001 / PM-001 ...) على خطة Firebase Spark
// المجانية بدون Cloud Functions وبدون Transactions (غير مُصدَّرة من حزمة js/firebase.js).
//
// - لكل نوع سجل عدّاد مستقل في counters/{type}.
// - الحجز والكتابة ذرّيان: العدّاد والسجل في writeBatch واحدة، وقاعدة counters تقبل
//   +1 فقط (Compare-And-Swap) فلا تكرار ولا فجوات حتى مع إنشاء متزامن من عدة مستخدمين.
// - الخوارزمية نفسها في utils/sequenceCore.js (قابلة للاختبار بدون شبكة).
// ============================================================

import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  limit,
  writeBatch
} from "../providers/backend/index.js";
import { auth } from "../config.js";
import { getCurrentRole, isAdminRole } from "../permissions.js";
import { SEQUENCE_PREFIXES, isSequenceType, formatSequenceNumber } from "../utils/recordNumber.js";
import { allocateAndCommit } from "../utils/sequenceCore.js";

function requireType(type) {
  if (!isSequenceType(type)) {
    throw new Error(`نوع الترقيم غير مدعوم: ${type}`);
  }
  return SEQUENCE_PREFIXES[type];
}

async function readCounterValue(type) {
  const snap = await getDoc(doc(db, "counters", type));
  const current = snap.exists() ? Number(snap.data().current) : 0;
  return Number.isInteger(current) && current > 0 ? current : 0;
}

async function commitWithCounter(type, next, unifiedNumber, addWrites) {
  const prefix = SEQUENCE_PREFIXES[type];
  const batch = writeBatch(db);
  // بدون merge عمداً: المستند يُستبدل بالحقول الأربعة المسموحة في القواعد فقط
  batch.set(doc(db, "counters", type), {
    current: next,
    prefix,
    updatedAt: new Date().toISOString(),
    updatedBy: auth.currentUser.uid
  });
  addWrites(batch, unifiedNumber);
  await batch.commit();
}

/**
 * يحجز الرقم التالي ويكتب السجل معاً في عملية ذرّية واحدة.
 * addWrites(batch, unifiedNumber) تضيف كتابات السجل (batch.set / batch.update) برقمه.
 * عند الفشل يُرمى خطأ ولا يُستهلك أي رقم (الدفعة كلها تُرفض).
 *
 * @returns {Promise<{unifiedNumber:string, number:number}>}
 */
export async function commitWithSequence(type, addWrites) {
  requireType(type);

  if (!auth.currentUser) {
    throw new Error("يجب تسجيل الدخول أولاً لتوليد رقم تسلسلي.");
  }
  // الحجز يحتاج اتصالاً فعلياً بالسيرفر (الطابور المحلي يعيد المحاولة عند عودة الاتصال).
  // رسالة الخطأ لا تحتوي مؤشرات "دائمة" فيبقى الإجراء في طابور الأوفلاين.
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new Error("تعذر توليد الرقم التسلسلي، حاول مرة أخرى");
  }

  return allocateAndCommit(type, addWrites, {
    readCounter: readCounterValue,
    commit: commitWithCounter
  });
}

/**
 * قراءة فقط: القيمة الحالية للعدّاد والرقم القادم (للمراجعة/الإدارة).
 */
export async function getSequenceCounter(type) {
  const prefix = requireType(type);
  const current = await readCounterValue(type);
  return {
    type,
    prefix,
    current,
    nextDisplayNumber: formatSequenceNumber(type, current + 1)
  };
}

// ------------------------------------------------------------
// إعادة ضبط العدّادات عند الإطلاق الرسمي (أدمن فقط)
// تلمس مستندات counters فقط - لا تحذف أي سجل ولا تؤثر على العلاقات أو الصلاحيات،
// وترفض إعادة الضبط لأي نوع ما زالت له سجلات (حماية من التكرار وفقدان الربط).
// ------------------------------------------------------------
const SEQUENCE_SOURCES = {
  tickets:       [{ collection: "tickets", field: "unifiedNumber" }, { collection: "tickets", field: "originalUnifiedNumber" }],
  pmOrders:      [{ collection: "tickets", field: "unifiedNumber" }],
  suggestions:   [{ collection: "suggestions", field: "unifiedNumber" }],
  defects:       [{ collection: "defects", field: "unifiedNumber" }],
  machineErrors: [{ collection: "machineErrors", field: "unifiedNumber" }],
  checklists:    [{ collection: "machineChecklists", field: "unifiedNumber" }],
  pmRecords:     [{ collection: "pmRecords", field: "unifiedNumber" }]
};

async function countExistingRecords(type) {
  const prefix = `${SEQUENCE_PREFIXES[type]}-`;
  const upper = `${SEQUENCE_PREFIXES[type]}.`; // '.' يأتي مباشرة بعد '-' فيحدد نطاق البادئة
  let found = 0;
  for (const source of SEQUENCE_SOURCES[type] || []) {
    const snap = await getDocs(query(
      collection(db, source.collection),
      where(source.field, ">=", prefix),
      where(source.field, "<", upper),
      limit(1)
    ));
    found += snap.size;
  }
  return found;
}

/**
 * @param {{ types?: string[], dryRun?: boolean }} options
 * @returns {Promise<Array<{type:string, prefix:string, current:number, hasRecords:boolean, reset:boolean, reason?:string}>>}
 */
export async function resetSequenceCountersForLaunch({ types = Object.keys(SEQUENCE_PREFIXES), dryRun = false } = {}) {
  if (!auth.currentUser) throw new Error("يجب تسجيل الدخول أولاً.");
  if (!isAdminRole(getCurrentRole())) throw new Error("هذه العملية مقصورة على الأدمن فقط.");

  const report = [];
  for (const type of types) {
    const prefix = requireType(type);
    const current = await readCounterValue(type);
    const row = { type, prefix, current, hasRecords: false, reset: false };

    if (current === 0) {
      row.reason = "العدّاد يبدأ من 001 بالفعل";
      report.push(row);
      continue;
    }

    row.hasRecords = (await countExistingRecords(type)) > 0;
    if (row.hasRecords) {
      row.reason = "توجد سجلات بهذا النوع - لا يمكن إعادة الضبط قبل تنظيف بيانات الاختبار";
    } else if (!dryRun) {
      await setDoc(doc(db, "counters", type), {
        current: 0,
        prefix,
        updatedAt: new Date().toISOString(),
        updatedBy: auth.currentUser.uid
      });
      row.reset = true;
    }
    report.push(row);
  }
  return report;
}
