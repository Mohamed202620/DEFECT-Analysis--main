// ============================================================
// usersApi.js
// إدارة المستخدمين (جلب / تسجيل / صلاحيات / حالة / حذف)
// جزء مستخرج من services/api.js بدون أي تغيير في المنطق أو
// الأسماء المُصدَّرة.
// ============================================================

import {
  db,
  DEFAULT_USER_PERMISSIONS
} from "../config.js";

// أداة تشفير كلمات السر (PBKDF2) - راجع services/crypto.js لتفاصيل السبب
import { generateSalt, hashPassword } from "./crypto.js";

import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


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


    // ========================================================
    // تشفير كلمة السر قبل التخزين (بدل حفظها Plaintext)
    // ========================================================
    //
    // بنفصل password عن باقي بيانات المستخدم، وبنستبدلها بـ
    // passwordHash + salt. راجع services/crypto.js لتفاصيل السبب.
    // ========================================================

    const { password, ...userDataWithoutPassword } = userData;

    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);

    const docRef =
      await addDoc(
        collection(db, "users"),
        {

          ...userDataWithoutPassword,

          passwordHash,

          salt,

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


