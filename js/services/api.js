// ============================================================
// API SERVICE
// Firebase Firestore
// ============================================================

import {
  db,
  storage,
  DEFAULT_USER_PERMISSIONS
} from "../config.js";


import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


import {
  ref,
  uploadString,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js";


// ============================================================
// رفع الصور على Firebase Storage
// ============================================================
//
// السبب: كانت الصور (Base64) تُخزَّن مباشرة داخل مستندات
// Firestore، ما يؤدي أحياناً لتضخم حجم المستند (قد يتجاوز حد
// الـ 1MB لكل مستند في حالة 3 صور)، وكان هذا سبب ظهور
// "Error loading documents" في Firebase Console عند تصفح
// مجموعة machineErrors تحديداً بسبب حجم حقل الصورة الكبير.
//
// الحل: رفع كل صورة فعلياً إلى Firebase Storage، وتخزين رابط
// التحميل (Download URL) فقط داخل مستند Firestore بدل الـ
// Base64 الكامل - المستند بقى صغير جداً (كيلوبايتات قليلة).
//
// ملاحظة مهمة: يتطلب هذا وجود Firebase Storage مفعّل على
// المشروع + قواعد أمان (Storage Rules) تسمح بالرفع للمستخدمين
// المسجلين، وإلا سيفشل الرفع برسالة "unauthorized" واضحة بدل
// الفشل الصامت أو الحفظ الكامل كـ Base64.
// ============================================================

/**
 * رفع صورة Base64 (Data URL) إلى Firebase Storage
 * وإرجاع رابط التحميل النهائي (Download URL)
 *
 * @param {string} base64 صورة بصيغة data:image/... (من compressImage)
 * @param {string} path المسار داخل Storage (مثال: "defects/DF-123/image1.jpg")
 * @returns {Promise<string|null>} رابط الصورة، أو null إذا لم تكن هناك صورة
 */
async function uploadBase64Image(base64, path) {

  if (
    !base64 ||
    typeof base64 !== "string" ||
    !base64.startsWith("data:image")
  ) {
    return null;
  }

  const imageRef = ref(storage, path);

  await uploadString(imageRef, base64, "data_url");

  return await getDownloadURL(imageRef);

}


// ============================================================
// USERS
// ============================================================


/**
 * جلب المستخدمين
 */
export async function fetchUsers() {

  try {

    const usersRef =
      collection(db, "users");

    // جلب كل المستندات مباشرة لتفادي مشاكل الفهارس أو نقص حقل الترتيب
    const querySnapshot =
      await getDocs(usersRef);


    const users = [];


    querySnapshot.forEach(docSnap => {

      const data =
        docSnap.data();


      // عدم إرسال كلمة السر للواجهة
      const {
        password,
        ...safeData
      } = data;


      users.push({

        id:
          docSnap.id,

        ...safeData,

        status:
          (data.status || "")
            .trim(),

        role:
          (data.role || "")
            .trim(),

        permissions:
          (data.permissions || "")
            .trim()

      });

    });


    // ترتيب المستخدمين برمجياً من الأحدث للأقدم بأمان تام
    users.sort((a, b) => {
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });


    return {

      status:
        "success",

      data:
        users

    };


  } catch (error) {

    console.error(
      "Error fetching users:",
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


// ============================================================
// REGISTER USER
// ============================================================


/**
 * تسجيل مستخدم جديد
 */
export async function registerUserApi(userData) {

  try {

    const phone =
      String(
        userData.phone || ""
      ).trim();


    // منع تكرار رقم الهاتف
    if (phone) {

      const q =
        query(
          collection(db, "users"),
          where("phone", "==", phone)
        );


      const querySnapshot =
        await getDocs(q);


      if (!querySnapshot.empty) {

        return {

          status:
            "error",

          message:
            "رقم الهاتف مسجل بالفعل."

        };

      }

    }


    const docRef =
      await addDoc(
        collection(db, "users"),
        {

          ...userData,

          // الحساب الجديد ينتظر الموافقة
          role:
            "pending",

          permissions:
            "",

          status:
            "pending",

          createdAt:
            new Date().toISOString()

        }
      );


    return {

      status:
        "success",

      id:
        docRef.id,

      message:
        "تم إرسال طلب التسجيل، بانتظار موافقة المسؤول"

    };


  } catch (error) {

    console.error(
      "Error registering user:",
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


// ============================================================
// UPDATE USER PERMISSIONS
// ============================================================


/**
 * تحديث الدور والصلاحيات
 */
export async function updatePermissionsApi(
  userId,
  role,
  permissions
) {

  try {

    const userRef =
      doc(
        db,
        "users",
        userId
      );


    await updateDoc(
      userRef,
      {

        role,

        permissions,

        updatedAt:
          new Date().toISOString(),

        updatedBy:
          localStorage.getItem("name")
          || "Admin"

      }
    );


    return {

      status:
        "success",

      message:
        "تم تحديث الصلاحيات"

    };


  } catch (error) {

    console.error(
      "Error updating permissions:",
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


// ============================================================
// UPDATE USER STATUS
// ============================================================


/**
 * قبول أو رفض المستخدم
 *
 * active   = قبول
 * rejected = رفض
 */
export async function updateUserStatusApi(
  userId,
  status
) {

  try {

    const userRef =
      doc(
        db,
        "users",
        userId
      );


    const updateData = {

      status,

      updatedAt:
        new Date().toISOString(),

      updatedBy:
        localStorage.getItem("name")
        || "Admin"

    };


    // ========================================================
    // قبول المستخدم
    // ========================================================

    if (status === "active") {

      updateData.role =
    "technician"; 


      // استخدام الصلاحيات الموحدة
      updateData.permissions =
        DEFAULT_USER_PERMISSIONS;


      updateData.approvedAt =
        new Date().toISOString();


      updateData.approvedBy =
        localStorage.getItem("name")
        || "Admin";

    }


    // ========================================================
    // رفض المستخدم
    // ========================================================

    if (status === "rejected") {

      updateData.role =
        "pending";


      updateData.permissions =
        "";

    }


    await updateDoc(
      userRef,
      updateData
    );


    return {

      status:
        "success",

      message:
        status === "active"

          ? "تم قبول المستخدم وتفعيل الحساب"

          : "تم رفض طلب المستخدم"

    };


  } catch (error) {

    console.error(
      "Error updating user status:",
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


// ============================================================
// DEFECTS
// ============================================================


/**
 * حفظ بلاغ عطل أو عيب
 * (يرفع الصور الثلاث فعلياً إلى Firebase Storage أولاً، ويحفظ
 * روابطها فقط داخل المستند بدل الـ Base64 الكامل)
 */
export async function saveDefectApi(
  payload
) {

  try {

    // فصل حقول الصور Base64 عن باقي البيانات
    const {
      image1,
      image2,
      image3,
      ...restPayload
    } = payload;

    const defectId =
      payload.defectId ||
      ("DF-" + Date.now());

    // رفع الصور الثلاث بالتوازي (كل صورة فارغة/null تُرجع null فوراً)
    const [image1Url, image2Url, image3Url] =
      await Promise.all([
        uploadBase64Image(image1, `defects/${defectId}/image1.jpg`),
        uploadBase64Image(image2, `defects/${defectId}/image2.jpg`),
        uploadBase64Image(image3, `defects/${defectId}/image3.jpg`)
      ]);

    const docRef =
      await addDoc(
        collection(db, "defects"),
        {

          ...restPayload,

          defectId,

          ...(image1Url && { image1Url }),
          ...(image2Url && { image2Url }),
          ...(image3Url && { image3Url }),

          createdAt:
            new Date().toISOString()

        }
      );


    return {

      status:
        "success",

      id:
        docRef.id

    };


  } catch (error) {

    console.error(
      "Error saving defect:",
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


// ============================================================
// ISSUES / TICKETS (بلاغات الأعطال)
// ============================================================


/**
 * حفظ بلاغ عطل جديد (يُستخدم من IssueView / workflow.js -> confirmIssue)
 * يتم الحفظ في نفس مجموعة "tickets" التي تُقرأ بواسطة
 * fetchTicketsApi و updateTicketStatusApi حفاظاً على توافق الـ Architecture الحالي
 */
export async function saveIssueApi(
  payload
) {

  try {

    // فصل حقل الصورة Base64 عن باقي البيانات ورفعها إلى Storage
    const {
      image,
      ...restPayload
    } = payload;

    const issueId =
      payload.issueId ||
      ("IS-" + Date.now());

    const imageUrl =
      await uploadBase64Image(
        image,
        `tickets/${issueId}/image.jpg`
      );

    const docRef =
      await addDoc(
        collection(db, "tickets"),
        {

          ...restPayload,

          issueId,

          ...(imageUrl && { imageUrl }),

          createdAt:
            payload?.createdAt ||
            new Date().toISOString()

        }
      );


    return {

      status:
        "success",

      id:
        docRef.id

    };


  } catch (error) {

    console.error(
      "Error saving issue/ticket:",
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


// ============================================================
// TICKETS
// ============================================================


/**
 * جلب التذاكر
 */
export async function fetchTicketsApi() {

  try {

    const ticketsRef =
      collection(
        db,
        "tickets"
      );


    const q =
      query(
        ticketsRef,
        orderBy(
          "createdAt",
          "desc"
        )
      );


    const querySnapshot =
      await getDocs(q);


    const tickets = [];


    querySnapshot.forEach(
      docSnap => {

        tickets.push({

          id:
            docSnap.id,

          ...docSnap.data()

        });

      }
    );


    return {

      status:
        "success",

      data:
        tickets

    };


  } catch (error) {

    console.error(
      "Error fetching tickets:",
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


// ============================================================
// UPDATE TICKET
// ============================================================


/**
 * تحديث حالة التذكرة
 */
export async function updateTicketStatusApi(
  ticketId,
  status,
  notes = ""
) {

  try {

    const ticketRef =
      doc(
        db,
        "tickets",
        ticketId
      );


    await updateDoc(
      ticketRef,
      {

        status,

        notes,

        updatedAt:
          new Date().toISOString(),

        updatedBy:
          localStorage.getItem("name")
          || ""

      }
    );


    return {

      status:
        "success"

    };


  } catch (error) {

    console.error(
      "Error updating ticket:",
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


// ============================================================
// DELETE USER
// ============================================================

export async function deleteUserApi(userId) {

  try {

    if (!userId) {

      return {
        status: "error",
        message: "معرف المستخدم غير موجود"
      };

    }

    const userRef =
      doc(
        db,
        "users",
        userId
      );

    await deleteDoc(userRef);

    return {

      status: "success",

      message: "تم حذف المستخدم نهائيًا"

    };

  } catch (error) {

    console.error(
      "Error deleting user:",
      error
    );

    return {

      status: "error",

      message:
        error.message ||
        "فشل حذف المستخدم"

    };

  }

}


// ============================================================
// MACHINE ERROR SCANNER (Machine Error Scanner)
// ميزة جديدة: قاعدة معرفة أعطال الماكينات (OCR) + سجل التكرار
// نفس نمط الدوال المستخدم أعلاه (Firestore Firestore) دون أي
// تغيير في باقي مجموعات البيانات الحالية
// ============================================================


/**
 * تطبيع كود العطل لضمان مطابقة موحدة عند البحث/منع التكرار
 */
function normalizeErrorCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}


/**
 * البحث عن عطل بواسطة الكود في مجموعة "machineErrors"
 */
export async function findMachineErrorByCode(code) {

  try {

    const normalized = normalizeErrorCode(code);

    if (!normalized) {
      return { status: "error", message: "كود العطل مطلوب" };
    }

    const q = query(
      collection(db, "machineErrors"),
      where("errorCode", "==", normalized)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return { status: "success", found: false, data: null };
    }

    const docSnap = querySnapshot.docs[0];

    return {
      status: "success",
      found: true,
      data: { id: docSnap.id, ...docSnap.data() }
    };

  } catch (error) {

    console.error("Error finding machine error:", error);

    return {
      status: "error",
      message: error.message
    };

  }

}


/**
 * حفظ عطل جديد في قاعدة المعرفة (كـ Pending Review افتراضياً)
 * يمنع تكرار نفس كود العطل قدر الإمكان
 */
export async function saveMachineErrorApi(payload) {

  try {

    const normalized = normalizeErrorCode(payload?.errorCode);

    if (!normalized) {
      return { status: "error", message: "يرجى إدخال كود العطل" };
    }

    // منع تكرار نفس الكود
    const existing = await findMachineErrorByCode(normalized);

    if (existing.status === "success" && existing.found) {
      return {
        status: "error",
        duplicate: true,
        message: "هذا الكود مسجل بالفعل في قاعدة المعرفة",
        data: existing.data
      };
    }

    // فصل حقل الصورة Base64 ورفعها إلى Storage بدل حفظها كاملة
    // داخل المستند (هذا كان السبب المباشر في تضخم حجم مستندات
    // machineErrors وظهور "Error loading documents" في الكونسول)
    const { image, ...restPayload } = payload;

    const imageUrl = await uploadBase64Image(
      image,
      `machineErrors/${normalized}-${Date.now()}.jpg`
    );

    const docRef = await addDoc(
      collection(db, "machineErrors"),
      {
        ...restPayload,
        errorCode: normalized,
        ...(imageUrl && { imageUrl }),
        status: payload?.status || "pending_review",
        createdAt: new Date().toISOString()
      }
    );

    return {
      status: "success",
      id: docRef.id,
      message: "تم إضافة العطل بنجاح وهو الآن قيد المراجعة"
    };

  } catch (error) {

    console.error("Error saving machine error:", error);

    return {
      status: "error",
      message: error.message
    };

  }

}


/**
 * اعتماد (تأكيد) عطل كان قيد المراجعة - إجراء إداري
 */
export async function verifyMachineErrorApi(errorId) {

  try {

    const ref = doc(db, "machineErrors", errorId);

    await updateDoc(ref, {
      status: "verified",
      verifiedAt: new Date().toISOString(),
      verifiedBy: localStorage.getItem("name") || "Admin"
    });

    return { status: "success", message: "تم اعتماد العطل بنجاح" };

  } catch (error) {

    console.error("Error verifying machine error:", error);

    return { status: "error", message: error.message };

  }

}


/**
 * تسجيل ظهور جديد لعطل معروف (سجل الأعطال السابق)
 * وربط الصورة الملتقطة بهذا الظهور
 */
export async function logMachineErrorOccurrenceApi(payload) {

  try {

    const normalized = normalizeErrorCode(payload?.errorCode);

    if (!normalized) {
      return { status: "error", message: "كود العطل مطلوب" };
    }

    // نفس مبدأ رفع الصورة إلى Storage بدل تخزينها Base64 كاملة
    const { image, ...restPayload } = payload;

    const imageUrl = await uploadBase64Image(
      image,
      `machineErrorLogs/${normalized}-${Date.now()}.jpg`
    );

    const docRef = await addDoc(
      collection(db, "machineErrorLogs"),
      {
        ...restPayload,
        errorCode: normalized,
        ...(imageUrl && { imageUrl }),
        scannedAt: new Date().toISOString()
      }
    );

    return { status: "success", id: docRef.id };

  } catch (error) {

    console.error("Error logging machine error occurrence:", error);

    return { status: "error", message: error.message };

  }

}


/**
 * جلب سجل الأعطال السابق لكود معين (آخر 10 ظهورات)
 */
export async function fetchMachineErrorHistoryApi(code) {

  try {

    const normalized = normalizeErrorCode(code);

    if (!normalized) {
      return { status: "success", data: [] };
    }

    const q = query(
      collection(db, "machineErrorLogs"),
      where("errorCode", "==", normalized),
      orderBy("scannedAt", "desc"),
      limit(10)
    );

    const querySnapshot = await getDocs(q);

    const logs = [];

    querySnapshot.forEach(docSnap => {
      logs.push({ id: docSnap.id, ...docSnap.data() });
    });

    return { status: "success", data: logs };

  } catch (error) {

    // ملاحظة: قد يتطلب هذا الاستعلام فهرس Firestore مركب
    // (errorCode + scannedAt) - في حال عدم وجوده نُعيد قائمة فارغة
    // بدلاً من كسر الواجهة
    console.error("Error fetching machine error history:", error);

    return { status: "success", data: [] };

  }

}


// ============================================================
// PREVENTIVE MAINTENANCE (PM) - سجل الصيانة الوقائية
// ============================================================


/**
 * حفظ نموذج صيانة وقائية (PM) في مجموعة "pmRecords"
 */
export async function savePmApi(payload) {

  try {

    const docRef = await addDoc(
      collection(db, "pmRecords"),
      {
        ...payload,
        createdAt: new Date().toISOString()
      }
    );

    return {
      status: "success",
      id: docRef.id,
      message: "تم حفظ نموذج الصيانة الوقائية بنجاح"
    };

  } catch (error) {

    console.error("Error saving PM record:", error);

    return {
      status: "error",
      message: error.message
    };

  }

}


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


// ============================================================
// KNOWLEDGE BASE (قاعدة المعرفة) - عرض/تصفح كل الأعطال المسجلة
// ============================================================


/**
 * جلب كل أعطال قاعدة المعرفة (machineErrors) لعرضها في صفحة
 * قاعدة المعرفة (Knowledge Base)
 */
export async function fetchAllMachineErrorsApi() {

  try {

    const querySnapshot = await getDocs(
      collection(db, "machineErrors")
    );

    const data = [];

    querySnapshot.forEach(docSnap => {
      data.push({ id: docSnap.id, ...docSnap.data() });
    });

    return { status: "success", data };

  } catch (error) {

    console.error("Error fetching machine errors list:", error);

    return { status: "error", message: error.message, data: [] };

  }

}


/**
 * جلب كل سجلات ظهور الأعطال (machineErrorLogs) منذ تاريخ معين
 * تُستخدم لحساب أكثر الأعطال تكراراً خلال فترة (يومي/أسبوعي/شهري)
 * استعلام بحقل واحد فقط (scannedAt) لتفادي الحاجة لفهرس مركب
 */
export async function fetchMachineErrorLogsSinceApi(sinceIso) {

  try {

    const q = query(
      collection(db, "machineErrorLogs"),
      where("scannedAt", ">=", sinceIso)
    );

    const querySnapshot = await getDocs(q);

    const data = [];

    querySnapshot.forEach(docSnap => {
      data.push({ id: docSnap.id, ...docSnap.data() });
    });

    return { status: "success", data };

  } catch (error) {

    console.error("Error fetching machine error logs since date:", error);

    // فشل ناعم بدلاً من كسر الواجهة
    return { status: "success", data: [] };

  }

}
