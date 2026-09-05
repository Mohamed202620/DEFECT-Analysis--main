// ============================================================
// usersApi.js
// إدارة المستخدمين (جلب / تسجيل / صلاحيات / حالة / حذف)
// جزء مستخرج من services/api.js بدون أي تغيير في المنطق أو
// الأسماء المُصدَّرة.
// ============================================================

import {
  DEFAULT_USER_PERMISSIONS,
  phoneToAuthEmail
} from "../config.js";

import {
  db,
  auth,
  createUserWithEmailAndPassword,
  signOut,
  deleteUser,
  collection,
  getDocs,
  getDoc,
  addDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit
} from "../providers/backend/index.js";
import { isAdminRole } from "../permissions.js";

// إصلاح (وركفلو تسجيل الدخول/إنشاء حساب): الدور اللي بيتحدد وقت
// قبول طلب الانضمام (updateUserStatusApi تحت) كان دايماً "technician"
// بشكل ثابت، بغض النظر عن "الوظيفة" اللي اختارها المستخدم في فورم
// التسجيل (regJob في registerView.js). دلوقتي بيتحدد حسب الوظيفة
// المُختارة فعلاً - الصلاحيات (permissions) تفضل كما هي
// (DEFAULT_USER_PERMISSIONS) في كل الحالات؛ الأدمن لسه قادر يعدّل
// الدور/الصلاحيات يدوياً بعد القبول لو محتاج (updatePermissionsApi)
const JOB_TO_ROLE = {
  technician: "technician",
  operator: "operator",
  maintainer: "technician",
  "group leader": "manager",
  supervisor: "manager",
  manager: "manager"
};

function roleFromJob(job) {
  const key = String(job || "").trim().toLowerCase();
  return JOB_TO_ROLE[key] || "technician";
}


// ============================================================
// USERS
// ============================================================

/**
 * عدد طلبات الانضمام المعلّقة (status == "pending") - استعلام خفيف
 * (بدون تحميل كل بيانات المستخدمين) لعرضه كشارة/Badge سريعة في
 * صفحة النظام (بند C1 في تقرير المراجعة)، بدل ما يضطر الأدمن يدخل
 * صفحة "طلبات الانضمام" كل مرة عشان يعرف هل فيه طلبات جديدة أصلاً.
 *
 * @returns {Promise<number>}
 */
export async function countPendingUsersApi() {

  try {

    const pendingQuery = query(
      collection(db, "users"),
      where("status", "==", "pending")
    );

    const snap = await getDocs(pendingQuery);

    return snap.size;

  } catch (error) {

    console.error("Error counting pending users:", error);
    return 0;

  }

}

// إصلاح (بند A3 في تقرير المراجعة - Production Readiness): fetchUsers()
// كانت بتجيب كل مستند users بدون أي limit ولا أي Cache، فكل تنقل
// بين تابي "المستخدمون"/"طلبات الانضمام" (وكلاهما بينادي
// loadUsersManagement() تلقائياً عند كل دخول للصفحة - راجع
// renderCore.js) كان بيعمل قراءة كاملة لكل الكولكشن من جديد. مع
// مئات الموظفين، ده استهلاك غير ضروري لقراءات Firestore.
//
// الحل هنا (بدون تغيير أي منطق فلترة/بحث موجود في RequestsView.js،
// وهو منطق Client-side بيحتاج المجموعة كاملة أصلاً - Pagination
// حقيقي بـ Cursor هيحتاج إعادة بناء شاشة البحث والفلاتر نفسها،
// ومش ضروري بحجم "مئات" الموظفين المذكور):
//   ١) Cache قصير المدة (نفس نمط fetchManagersAndAdminsApi/
//      fetchTechniciansApi تحت) - يمنع إعادة القراءة الكاملة مع كل
//      تنقل سريع بين التابين لمدة USERS_CACHE_TTL_MS.
//   ٢) limit() صريح كسقف أمان (لا يوجد حالياً أي سقف إطلاقاً) -
//      لو اتضرب، بيظهر تحذير في الـ Console لتنبيه المطور إن العدد
//      قرّب من الحد ومحتاج نراجع الموضوع فعلياً وقتها (Pagination
//      حقيقي أو بحث Server-side).
//   ٣) invalidateUsersCache() بتتنادى بعد أي عملية تعديل فعلية
//      (قبول/رفض/تغيير دور/حذف) عشان أول تحديث للشاشة بعد أي
//      إجراء يعرض البيانات الفعلية فوراً بدل الكاش القديم.
const USERS_CACHE_TTL_MS = 60 * 1000; // دقيقة واحدة
const USERS_SAFETY_LIMIT = 1000; // سقف أمان مؤقت - راجع الملاحظة فوق
let usersCache = null; // { data, fetchedAt }

function invalidateUsersCache() {
  usersCache = null;
}

/**
 * جلب المستخدمين
 * @param {{ forceRefresh?: boolean }} [options]
 */
export async function fetchUsers({ forceRefresh = false } = {}) {

  if (
    !forceRefresh &&
    usersCache &&
    (Date.now() - usersCache.fetchedAt) < USERS_CACHE_TTL_MS
  ) {
    return { status: "success", data: usersCache.data };
  }

  try {

    const usersQuery =
      query(
        collection(db, "users"),
        limit(USERS_SAFETY_LIMIT)
      );

    // جلب كل المستندات (حتى سقف الأمان) مباشرة لتفادي مشاكل الفهارس
    // أو نقص حقل الترتيب
    const querySnapshot =
      await getDocs(usersQuery);

    if (querySnapshot.size >= USERS_SAFETY_LIMIT) {
      console.warn(
        `⚠️ fetchUsers() وصل لسقف الأمان (${USERS_SAFETY_LIMIT} مستخدم). ` +
        `قائمة المستخدمين قد تكون غير مكتملة - محتاجين نراجع Pagination حقيقي.`
      );
    }


    const users = [];


    querySnapshot.forEach(docSnap => {

      const data =
        docSnap.data();


      // عدم إرسال أي بيانات متعلقة بكلمة السر للواجهة
      // (password: النمط القديم Plaintext قبل التحديث،
      //  passwordHash/salt: النمط الجديد المشفّر)
      const {
        password,
        passwordHash,
        salt,
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

    usersCache = { data: users, fetchedAt: Date.now() };


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
 *
 * بيتم إنشاء حساب Firebase Authentication حقيقي (Email/Password،
 * برقم موبايل محوَّل لإيميل داخلي عبر phoneToAuthEmail - راجع
 * config.js) بدل التشفير اليدوي القديم بـ PBKDF2. مستند بيانات
 * المستخدم في Firestore بيتخزن بنفس معرّف الحساب (uid) بدل معرّف
 * عشوائي، عشان قواعد الأمان (firestore.rules) تقدر تربط الطلبات
 * بصاحبها فعلياً عبر request.auth.uid.
 */
export async function registerUserApi(userData) {

  try {

    const phone =
      String(
        userData.phone || ""
      ).trim();

    const password =
      String(
        userData.password || ""
      );


    if (!phone) {
      return {
        status: "error",
        message: "رقم الموبايل مطلوب."
      };
    }


    // منع تكرار رقم الهاتف (فحص إضافي قبل محاولة إنشاء حساب Auth،
    // اللي هيرفض تلقائياً برضه لو الإيميل الداخلي المشتق منه مكرر)
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


    // ========================================================
    // إنشاء حساب Firebase Authentication حقيقي
    // ========================================================

    const email = phoneToAuthEmail(phone);

    let cred;
    try {
      cred = await createUserWithEmailAndPassword(auth, email, password);
    } catch (authError) {

      const message =
        authError.code === "auth/email-already-in-use"
          ? "رقم الهاتف مسجل بالفعل."
          : authError.code === "auth/weak-password"
            ? "كلمة السر ضعيفة جداً (٦ أحرف على الأقل)."
            : "حدث خطأ أثناء إنشاء حساب الدخول.";

      return { status: "error", message };
    }


    // ========================================================
    // مستند بيانات المستخدم الإضافية - بدون أي حقل خاص بكلمة السر
    // (Firebase Auth بيتولى تخزين/تشفير كلمة السر بنفسه)
    // ========================================================

    const { password: _pw, ...userDataWithoutPassword } = userData;

    const rawShift = String(userData.shift || "").trim();
    const shiftLower = rawShift.toLowerCase();
    const shiftColor = shiftLower.includes("green") || shiftLower.includes("خضراء") ? "green" :
                       shiftLower.includes("red") || shiftLower.includes("حمراء") ? "red" :
                       shiftLower.includes("blue") || shiftLower.includes("زرقاء") ? "blue" : "green";

    try {

      await setDoc(
        doc(db, "users", cred.user.uid),
        {
          name: String(userData.name || "").trim(),
          phone,
          code: String(userData.code || "").trim(),
          job: String(userData.job || "Technician").trim(),
          department: String(userData.department || "Production").trim(),
          shift: rawShift || "Green",
          shiftColor: userData.shiftColor || shiftColor,
          // ملحوظة: حقول hourlyRate/monthTargetHours اتشالت من هنا -
          // بيانات المرتب أصبحت محلية 100% على جهاز كل مستخدم
          // (راجع payrollLocalStore.js) ولا يجوز تخزينها في Firestore
          leaveBalance: Number(userData.leaveBalance) || 21,
          ...userDataWithoutPassword,
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

    } catch (firestoreError) {

      // نادراً ما يحصل: حساب Auth اتعمل لكن فشل كتابة مستند
      // البيانات. نحاول حذف حساب Auth المتخلف لنمنع وجود مستخدم
      // Authentication بلا مستند المستخدم في Firestore.
      console.error("Error saving user profile after auth creation:", firestoreError);

      try {
        if (auth.currentUser) {
          await deleteUser(auth.currentUser);
        }
      } catch (cleanupError) {
        console.error("Failed to delete orphaned auth user:", cleanupError);
      }

      try {
        await signOut(auth);
      } catch (signOutError) {
        console.warn("Failed to sign out after cleanup:", signOutError);
      }

      return {
        status: "error",
        message: "تم إنشاء حساب الدخول لكن حدث خطأ أثناء حفظ بياناتك، يرجى المحاولة مرة أخرى."
      };
    }

    // بعد إنشاء حساب Auth ومستند المستخدم، نسجل خروج المستخدم من الجلسة
    // لأن الحساب ما زال في حالة pending ولا يجب أن يبقى مسجلاً دخوله.
    try {
      await signOut(auth);
    } catch (err) {
      console.warn('Warning: failed to signOut after registration:', err?.message || err);
    }


    invalidateUsersCache();

    return {

      status:
        "success",

      id:
        cred.user.uid,

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
// TECHNICIANS (لقائمة اختيار الفني عند تصنيف/إسناد التذكرة)
// ============================================================

// إضافة (تحسين الأداء): تخزين مؤقت بسيط في الذاكرة لنتيجة
// fetchTechniciansApi لمدة TECHNICIANS_CACHE_TTL_MS - كانت بتتنادى من
// جديد (قراءة من Firestore) في كل مرة يتفتح فيها مودال "إسناد" أو
// "إعادة إسناد" حتى لو نفس المستخدم فتح المودال أكتر من مرة خلال
// دقايق قليلة. التخزين هنا لمدة الجلسة بس (متغير Module-level، بيتصفر
// تلقائياً بإعادة تحميل الصفحة) - مفيش أي بيانات حساسة بتتخزن غير
// اللي أصلاً بترجع من نفس الدالة
const TECHNICIANS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 دقائق
let techniciansCache = null; // { data, fetchedAt }

// إصلاح (بند مرتفع الأولوية - إشعار عند بلاغ جديد): نفس فكرة الكاش
// فوق بالظبط لكن لقائمة المدراء/الأدمن - تُستخدم في saveIssueApi
// (ticketsApi.js) عشان نبعت إشعار لكل مدير/أدمن نشط فور تسجيل بلاغ
// عطل جديد، بدل ما يفضل معتمد على فتحهم اليدوي للوحة البلاغات
const MANAGERS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 دقائق
let managersAndAdminsCache = null; // { data, fetchedAt }

/**
 * جلب المستخدمين اللي دورهم مدير/أدمن فقط (نشطين) - تُستخدم لإرسال
 * إشعار جماعي عند إنشاء بلاغ عطل جديد (راجع saveIssueApi في
 * ticketsApi.js). ملحوظة: firestore.rules -> match /users/{userId}
 * -> allow list لازم يسمح صراحة بـ role in ["admin","manager"] لأي
 * مستخدم نشط (مش بس للأدمن/المدير نفسه) عشان الاستعلام ده يشتغل من
 * جهاز أي مستخدم عادي بيسجل بلاغ - راجع تعليق الإصلاح المقابل في
 * firestore.rules
 */
export async function fetchManagersAndAdminsApi({ forceRefresh = false } = {}) {

  if (
    !forceRefresh &&
    managersAndAdminsCache &&
    (Date.now() - managersAndAdminsCache.fetchedAt) < MANAGERS_CACHE_TTL_MS
  ) {
    return { status: "success", data: managersAndAdminsCache.data };
  }

  try {

    const q =
      query(
        collection(db, "users"),
        where("role", "in", ["admin", "manager"])
      );

    const querySnapshot = await getDocs(q);

    const managers = [];

    querySnapshot.forEach(docSnap => {

      const data = docSnap.data();

      if ((data.status || "").trim().toLowerCase() !== "active") {
        return;
      }

      managers.push({
        id: docSnap.id,
        name: data.name || "",
        role: data.role || ""
      });

    });

    managersAndAdminsCache = { data: managers, fetchedAt: Date.now() };

    return { status: "success", data: managers };

  } catch (error) {

    console.error("Error fetching managers/admins:", error);

    return { status: "error", message: error.message };

  }

}

/**
 * جلب المستخدمين اللي دورهم فني/مهندس فقط - تُستخدم في واجهة
 * تصنيف وإسناد التذاكر (راجع ticketsApi.js -> assignTicketApi).
 * الاستعلام مقيّد بحقل role عمداً (where) بدل جلب كل المستخدمين،
 * عشان يتوافق مع قاعدة الأمان الخاصة بقراءة /users كمجموعة
 * (راجع firestore.rules).
 */
export async function fetchTechniciansApi({ forceRefresh = false } = {}) {

  if (
    !forceRefresh &&
    techniciansCache &&
    (Date.now() - techniciansCache.fetchedAt) < TECHNICIANS_CACHE_TTL_MS
  ) {
    return { status: "success", data: techniciansCache.data };
  }

  try {

    const q =
      query(
        collection(db, "users"),
        where("role", "in", ["technician", "engineer"])
      );

    const querySnapshot =
      await getDocs(q);

    const technicians = [];

    querySnapshot.forEach(docSnap => {

      const data = docSnap.data();

      if ((data.status || "").trim().toLowerCase() !== "active") {
        return;
      }

      technicians.push({
        id: docSnap.id,
        name: data.name || "",
        role: data.role || "",
        department: data.department || ""
      });

    });

    techniciansCache = { data: technicians, fetchedAt: Date.now() };

    return { status: "success", data: technicians };

  } catch (error) {

    console.error("Error fetching technicians:", error);

    return { status: "error", message: error.message };

  }

}


// ============================================================
// حماية آخر Admin في النظام (بند A1 في تقرير المراجعة)
// ============================================================

/**
 * عدد المستخدمين الذين دورهم "admin" وحالتهم "active" حالياً، مع
 * إمكانية استثناء مستخدم واحد (المستخدم المستهدف بالتعديل/الحذف)
 * من العد - عشان نعرف هل هيفضل أدمن نشط تاني بعد العملية ولا لأ.
 *
 * @param {string} [excludeUserId]
 * @returns {Promise<number>}
 */
async function countOtherActiveAdmins(excludeUserId) {

  const adminsQuery = query(
    collection(db, "users"),
    where("role", "==", "admin"),
    where("status", "==", "active")
  );

  const snap = await getDocs(adminsQuery);

  let count = 0;
  snap.forEach((docSnap) => {
    if (docSnap.id !== excludeUserId) count++;
  });

  return count;

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


    // حماية آخر Admin: لو المستخدم ده حالياً "admin" نشط، ومطلوب
    // تغيير دوره لأي دور تاني، لازم يفضل أدمن نشط واحد على الأقل
    // غيره بعد العملية - وإلا هيتقفل النظام بالكامل بلا أي أدمن.
    if (role !== "admin") {

      const currentSnap = await getDoc(userRef);
      const currentData = currentSnap.exists() ? currentSnap.data() : null;
      const wasActiveAdmin =
        currentData &&
        currentData.role === "admin" &&
        currentData.status === "active";

      if (wasActiveAdmin) {

        const remaining = await countOtherActiveAdmins(userId);

        if (remaining === 0) {
          return {
            status: "error",
            message:
              "لا يمكن تغيير دور هذا المستخدم لأنه آخر Admin نشط في النظام. عيّن أدمن آخر أولاً قبل تغيير هذا الدور."
          };
        }

      }

    }


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

    invalidateUsersCache();


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
// UPDATE USER MACHINE DEPARTMENT (Backend / Frontend)
// ============================================================

/**
 * تحديث تصنيف المستخدم (Backend/Frontend) المستخدم في فلترة قائمة
 * الماكينات حسب القسم (راجع getMachinesForUser في machines.js).
 *
 * ملحوظة: هذا حقل مستقل تماماً اسمه "machineDepartment"، وليس نفس
 * حقل "department" العام الموجود بالفعل في مستند المستخدم (القسم
 * التنظيمي: Production/Mechanical/Electrical - مُستخدم في التسجيل/
 * الملف الشخصي/كايزن/التقارير). عمل حقل مستقل هنا بدل التعديل على
 * الحقل الموجود يمنع أي كسر لأي شاشة تانية بتعرض/تعتمد على القيمة
 * التنظيمية الحالية.
 */
export async function updateUserMachineDepartmentApi(userId, machineDepartment) {

  try {

    if (!userId) {
      return { status: "error", message: "معرف المستخدم غير موجود" };
    }

    const cleanDept =
      String(machineDepartment || "").trim().toLowerCase() === "frontend"
        ? "frontend"
        : "backend";

    await updateDoc(
      doc(db, "users", userId),
      {
        machineDepartment: cleanDept,
        updatedAt: new Date().toISOString(),
        updatedBy: localStorage.getItem("name") || "Admin"
      }
    );

    invalidateUsersCache();

    return { status: "success", message: "تم تحديث تصنيف القسم (Backend/Frontend)" };

  } catch (error) {

    console.error("Error updating user machine department:", error);

    return { status: "error", message: error.message };

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

      // إصلاح: الدور بيتحدد حسب "الوظيفة" اللي اختارها المستخدم في
      // فورم التسجيل (job) بدل ما يبقى "technician" ثابتة للجميع
      const userSnap = await getDoc(userRef);
      const job = userSnap.exists() ? userSnap.data().job : "";

      updateData.role =
        roleFromJob(job);


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

    invalidateUsersCache();


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
// DELETE USER
// ============================================================

// ⚠️ ملحوظة بعد تفعيل Firebase Authentication:
// الدالة دي بتحذف مستند بيانات المستخدم من Firestore فقط. حساب
// Firebase Auth نفسه (اللي بيسمح بتسجيل الدخول) مينفعش يتحذف من
// كود العميل (Client SDK) لأي مستخدم غير المستخدم المسجّل دخوله
// حالياً - محتاج Firebase Admin SDK من سيرفر/Cloud Function.
// عملياً: حذف مستند users/{uid} كافي لمنع الدخول (فحص status/role
// في login.js هيفشل لو المستند مش موجود)، لكن حساب Auth بيفضل
// موجود فعلياً حتى يتم حذفه لاحقاً عبر Admin SDK لو احتجتم ده.
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

    // حماية آخر Admin (بند A1): نفس منطق updatePermissionsApi - لو
    // المستخدم المطلوب حذفه هو آخر أدمن نشط، امنع الحذف بدل ما
    // يتقفل النظام بالكامل.
    const currentSnap = await getDoc(userRef);
    const currentData = currentSnap.exists() ? currentSnap.data() : null;
    const isActiveAdmin =
      currentData &&
      currentData.role === "admin" &&
      currentData.status === "active";

    if (isActiveAdmin) {

      const remaining = await countOtherActiveAdmins(userId);

      if (remaining === 0) {
        return {
          status: "error",
          message:
            "لا يمكن حذف هذا المستخدم لأنه آخر Admin نشط في النظام. عيّن أدمن آخر أولاً قبل حذف هذا الحساب."
        };
      }

    }

    await deleteDoc(userRef);

    invalidateUsersCache();

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


