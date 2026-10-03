// ============================================================
// dashboardApi.js
// بيانات لوحة المتابعة الرئيسية - جزء مستخرج من services/api.js
// بدون أي تغيير في المنطق أو الأسماء المُصدَّرة.
// ============================================================

import { db } from "../providers/backend/index.js";

import {
  collection,
  getDocs
} from "../providers/backend/index.js";


// ============================================================
// DASHBOARD
// ============================================================


/**
 * بيانات لوحة المتابعة
 */
export async function fetchDashboardDataApi() {

  try {

    const ticketsSnap =
      await getDocs(
        collection(
          db,
          "tickets"
        )
      );


    const defectsSnap =
      await getDocs(
        collection(
          db,
          "defects"
        )
      );


    return {

      status:
        "success",

      data: {

        openTicketsCount:
          ticketsSnap.size,

        defectsCount:
          defectsSnap.size

      }

    };


  } catch (error) {

    console.error(
      "Error fetching dashboard data:",
      error
    );


    return {

      status:
        "error",

      message:
        error.message

    };

  }

}


