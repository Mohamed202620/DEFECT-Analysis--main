// ============================================================
// dailyTipsApi.js
// خدمة إدارة وقراءة المعلومات اليومية «معلومة على الماشي» من Firestore
// المجموعة "daily_tips" في Firestore:
// المستند = { id, category, categoryTitle, title, text, lang, createdAt, createdBy, isCustom: true }
// ============================================================

import { db } from "../providers/backend/index.js";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  deleteDoc,
  query,
  orderBy
} from "../providers/backend/index.js";

const LOCAL_STORAGE_KEY = "mscanco_custom_daily_tips";
let customTipsCache = null;

/**
 * الحصول على النص الافتراضي لعنوان الفئة بالعربي والإنكليزي
 */
export function getDefaultCategoryTitle(category, isEn = false) {
  switch (category) {
    case 'religious':
      return isEn ? 'Faith & Integrity' : 'إتقان وقيم';
    case 'motivational':
      return isEn ? 'Motivation & Excellence' : 'تحفيز وجودة';
    case 'industrial':
      return isEn ? 'Industrial & Maintenance' : 'صيانة ووقاية';
    case 'general':
    default:
      return isEn ? 'Knowledge & Skill' : 'معرفة وتطوير';
  }
}

/**
 * قراءة القائمة من LocalStorage عند عدم توفر الاتصال أو للتحميل السريع
 */
function getLocalCustomTips() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * حفظ القائمة في LocalStorage
 */
function saveLocalCustomTips(tips) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tips));
  } catch {
    // ignore
  }
}

/**
 * جلب جميع المعلومات المخصصة من Firestore مع التنسيق والكاش
 */
export async function fetchCustomTipsApi({ forceRefresh = false } = {}) {
  if (!forceRefresh && customTipsCache !== null) {
    return { status: "success", data: customTipsCache };
  }

  try {
    const tipsRef = collection(db, "daily_tips");
    const q = query(tipsRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);

    const tips = [];
    querySnapshot.forEach(docSnap => {
      const data = docSnap.data();
      tips.push({
        id: docSnap.id,
        category: data.category || "general",
        categoryTitle: data.categoryTitle || getDefaultCategoryTitle(data.category, data.lang === 'en'),
        title: data.title || "",
        text: data.text || "",
        lang: data.lang || "ar",
        createdAt: data.createdAt || new Date().toISOString(),
        createdBy: data.createdBy || "Admin",
        isCustom: true
      });
    });

    customTipsCache = tips;
    saveLocalCustomTips(tips);
    return { status: "success", data: tips };
  } catch (error) {
    console.warn("Falling back to local custom tips storage due to:", error.message);
    const localTips = getLocalCustomTips();
    customTipsCache = localTips;
    return { status: "success", data: localTips, isOffline: true };
  }
}

/**
 * إضافة معلومة يومية مخصصة جديدة
 */
export async function addCustomTipApi(tipData) {
  try {
    const cleanData = {
      category: tipData.category || "general",
      categoryTitle: tipData.categoryTitle || getDefaultCategoryTitle(tipData.category, tipData.lang === 'en'),
      title: String(tipData.title || "").trim(),
      text: String(tipData.text || "").trim(),
      lang: tipData.lang || "ar",
      createdAt: new Date().toISOString(),
      createdBy: localStorage.getItem("name") || "Admin",
      isCustom: true
    };

    if (!cleanData.title || !cleanData.text) {
      return { status: "error", message: "يرجى تعبئة العنوان ونص المعلومة بالكامل." };
    }

    let createdId = "custom_" + Date.now();
    try {
      const docRef = await addDoc(collection(db, "daily_tips"), cleanData);
      createdId = docRef.id;
    } catch (fsError) {
      console.warn("Firestore save skipped/failed, saving locally:", fsError.message);
    }

    const newTip = { id: createdId, ...cleanData };
    const currentLocal = getLocalCustomTips();
    const updated = [newTip, ...currentLocal.filter(t => t.id !== createdId)];
    saveLocalCustomTips(updated);
    customTipsCache = updated;

    return { status: "success", message: "تمت إضافة المعلومة الجديدة بنجاح", data: newTip };
  } catch (error) {
    console.error("Error adding custom tip:", error);
    return { status: "error", message: error.message || "حدث خطأ أثناء إضافة المعلومة." };
  }
}

/**
 * حذف معلومة مخصصة
 */
export async function deleteCustomTipApi(tipId) {
  try {
    if (!tipId) {
      return { status: "error", message: "معرف المعلومة غير موجود" };
    }

    try {
      if (!tipId.startsWith("custom_")) {
        await deleteDoc(doc(db, "daily_tips", tipId));
      }
    } catch (fsError) {
      console.warn("Firestore delete failed, deleting locally:", fsError.message);
    }

    const currentLocal = getLocalCustomTips();
    const updated = currentLocal.filter(t => String(t.id) !== String(tipId));
    saveLocalCustomTips(updated);
    customTipsCache = updated;

    return { status: "success", message: "تم حذف المعلومة بنجاح" };
  } catch (error) {
    console.error("Error deleting custom tip:", error);
    return { status: "error", message: error.message || "فشل حذف المعلومة" };
  }
}
