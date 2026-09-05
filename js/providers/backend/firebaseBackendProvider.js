// ============================================================
// firebaseBackendProvider.js
// تنفيذ Firebase الفعلي لواجهة الـ Backend Provider (راجع
// providers/README.md). هذا الملف هو نقطة إعادة التصدير الوحيدة
// لأدوات Firestore/Auth الخام (collection, doc, getDocs...) ولـ
// db/auth نفسها - أي ملف تاني في طبقة services يفترض يستوردهم من
// index.js في هذا المجلد، مش من هنا مباشرة ولا من firebase.js/
// config.js.
//
// لو حبينا نستبدل Firebase بمزود تاني مستقبلاً: نضيف ملف تنفيذ جديد
// بنفس الأسماء المُصدَّرة هنا (نفس التوقيعات قدر الإمكان)، ونغيّر
// سطر الاستيراد في index.js بس.
// ============================================================

// الـ instances المُهيّأة فعلاً (تهيئة Firebase App نفسها لسه في
// config.js - ده تفصيلة تنفيذ داخلية طبيعية لمزود Firebase، مش جزء
// من الواجهة العامة اللي services المفروض تتعامل معاها)
export { db, auth } from "../../config.js";

// أدوات Firestore + Auth الخام المُستخدمة فعلياً عبر كل ملفات
// services/*.js حالياً (نفس الأسماء والتوقيعات القادمة من Firebase
// SDK بدون أي تعديل في المنطق)
export {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  getCountFromServer,
  createUserWithEmailAndPassword,
  signOut,
  deleteUser
} from "../../firebase.js";
