// ============================================================
// suggestionsApi.js
// مقترحات الكايزن (Kaizen Suggestions) - جزء مستخرج من
// services/api.js بدون أي تغيير في المنطق أو الأسماء المُصدَّرة.
// ============================================================

import { db } from "../config.js";

import {
  collection,
  addDoc
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


// ============================================================
// KAIZEN SUGGESTIONS - مقترحات التحسين المستمر
// ============================================================


/**
 * حفظ مقترح كايزن في مجموعة "suggestions"
 */
export async function saveSuggestionApi(payload) {

  try {

    const docRef = await addDoc(
      collection(db, "suggestions"),
      {
        ...payload,
        createdAt: new Date().toISOString()
      }
    );

    return {
      status: "success",
      id: docRef.id,
      message: "تم إرسال مقترح الكايزن بنجاح"
    };

  } catch (error) {

    console.error("Error saving suggestion:", error);

    return {
      status: "error",
      message: error.message
    };

  }

}


