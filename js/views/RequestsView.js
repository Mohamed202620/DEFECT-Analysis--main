import { BottomNav } from "../components/BottomNav.js";
import { DEBUG, ALL_PERMISSIONS } from "../config.js";
import { isAdminRole, setCurrentRole, setCurrentPermissions } from "../permissions.js";

// طباعة تشخيصية في وضع التطوير فقط - كانت بتطبع بيانات كل
// المستخدمين (أسماء/أرقام هواتف/أدوار) في الكونسول لكل زائر
// عادي، حتى لو مش في وضع تطوير
function dlog(...args) {
  if (DEBUG) console.log(...args);
}

import {
  fetchUsers,
  updatePermissionsApi,
  updateUserStatusApi,
  deleteUserApi
} from "../services/api.js";


// ======================================
// المتغيرات
// ======================================

let usersCache = [];


// ======================================
// قائمة الصلاحيات الموحدة في التطبيق
// ======================================

const PERMISSIONS = [

  // الرئيسية
  { value: "home", label: "🏠 الرئيسية" },

  // الصيانة
  // ملاحظة: "maintenance" كانت صلاحية افتراضية (DEFAULT_USER_PERMISSIONS)
  // لكنها لم تكن معروضة كخيار هنا، فكان حفظ صلاحيات أي مستخدم من
  // هذه الشاشة يحذفها بصمت (لأن الحفظ يعتمد على الصناديق المعروضة
  // فقط). تمت إضافتها الآن لتطابق config.js وتفادي هذا الخلل.
  { value: "maintenance", label: "🔧 قسم الصيانة (رئيسي)" },
  { value: "issue", label: "🚨 تسجيل عطل" },
  { value: "pm", label: "📝 الصيانة الوقائية" },
  { value: "log", label: "📋 سجل الصيانة" },
  { value: "suggestions", label: "💡 كايزن" },
  { value: "reports", label: "📊 التقارير" },
  { value: "qr", label: "📱 QR الماكينات" },
  { value: "errorScanner", label: "🔎 فاحص أعطال الماكينات (OCR)" },

  // الجودة
  { value: "quality", label: "📦 الجودة" },

  // الذكاء والمعرفة
  { value: "ai", label: "🤖 فحص AI" },
  { value: "kb", label: "📚 قاعدة المعرفة" },

  // الإحصائيات والتصدير
  { value: "statistics", label: "📈 الإحصائيات" },
  { value: "export", label: "📤 تصدير التقارير" },

  // إدارة النظام
  { value: "users", label: "👥 إدارة المستخدمين" },
  { value: "requests", label: "⏳ طلبات الانضمام" },
  { value: "machines", label: "🏭 إدارة الماكينات" },
  { value: "settings", label: "⚙️ إعدادات النظام" }

];


// ======================================
// واجهة المستخدم
// ======================================

export const RequestsView = () => `

<div class="app-page p-4 max-w-md mx-auto pb-24 space-y-4 text-white">

    <!-- Header & Back Button -->
    <div class="flex items-center justify-between border-b border-gray-800 pb-3">
        <div class="flex items-center gap-3">
            <button
                type="button"
                onclick="window.navigateTo('system')"
                class="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 px-3 py-2 rounded-xl text-amber-400 font-black transition-all duration-150 active:scale-95 shadow-sm flex items-center gap-1.5 cursor-pointer">
                <span class="text-base rtl:rotate-180">‹</span>
                <span class="text-xs text-slate-200">رجوع</span>
            </button>
            <div>
                <h2 class="text-base font-black text-blue-400 flex items-center gap-2">
                    <span>👥</span> إدارة المستخدمين والصلاحيات
                </h2>
                <p class="text-[11px] text-gray-400 mt-0.5 font-medium">
                    إدارة الحسابات وتعيين الأدوار والصلاحيات
                </p>
            </div>
        </div>
    </div>


    <!-- Search -->

    <div class="relative">
        <input
            id="userSearch"
            oninput="window.searchUsers()"
            placeholder="🔍 بحث بالاسم أو رقم الهاتف..."
            class="w-full p-3 rtl:pr-10 ltr:pl-10 rounded-xl bg-[#0F172A] border border-gray-700 text-white text-xs outline-none focus:border-blue-500 transition shadow-inner"
        >
        <span class="absolute top-3.5 rtl:right-3.5 ltr:left-3.5 text-gray-400 text-xs pointer-events-none">🔍</span>
    </div>


    <!-- Filters -->

    <div class="grid grid-cols-2 gap-3">

        <select
            id="statusFilter"
            onchange="window.filterUsers()"
            class="bg-[#0F172A] border border-gray-700 rounded-xl p-3 text-xs text-white outline-none focus:border-blue-500 transition shadow-inner cursor-pointer">

            <option value="">
                كل الحالات
            </option>

            <option value="active">
                🟢 Active (مفعل)
            </option>

            <option value="pending">
                🟡 Pending (قيد الانتظار)
            </option>

            <option value="rejected">
                🔴 Rejected (مرفوض)
            </option>

        </select>


        <select
            id="roleFilter"
            onchange="window.filterUsers()"
            class="bg-[#0F172A] border border-gray-700 rounded-xl p-3 text-xs text-white outline-none focus:border-blue-500 transition shadow-inner cursor-pointer">

            <option value="">
                كل الأدوار
            </option>

            <option value="admin">
                👑 Admin
            </option>

            <option value="manager">
                🧑‍💼 Manager
            </option>

            <option value="supervisor">
                👨‍🔧 Supervisor
            </option>

            <option value="engineer">
                👨‍💻 Engineer
            </option>

            <option value="technician">
                🛠 Technician
            </option>

            <option value="operator">
                ⚙️ Operator
            </option>

        </select>

    </div>


    <!-- عدد المستخدمين -->

    <div
        id="usersCount"
        class="text-xs text-gray-400">

        إجمالي المستخدمين : 0

    </div>


    <!-- القائمة -->

    <div
        id="usersContainer"
        class="space-y-4">

        <div class="text-center text-gray-500 py-8">

            جاري تحميل المستخدمين...

        </div>

    </div>

</div>


${BottomNav("system")}

`;


// ======================================
// إنشاء Checkbox للصلاحية
// ======================================

function permissionCheckbox(
    id,
    value,
    label,
    checked,
    disabled
) {

    return `

    <label
        class="flex items-center gap-2
               bg-[#0F172A]
               border border-gray-800
               rounded-lg
               p-2
               cursor-pointer">

        <input
            type="checkbox"
            class="perm-${id}"
            value="${value}"
            ${checked ? "checked" : ""}
            ${disabled ? "disabled" : ""}
        >

        <span class="text-[11px]">
            ${label}
        </span>

    </label>

    `;
}


// ======================================
// رسم المستخدمين
// ======================================

function renderUsers(users) {

    const container =
        document.getElementById("usersContainer");

    const count =
        document.getElementById("usersCount");


    if (!container) return;


    if (count) {

        count.innerHTML =
            `إجمالي المستخدمين : ${users.length}`;

    }


    if (!users.length) {

        container.innerHTML = `

        <div class="text-center text-gray-400 py-10">

            لا يوجد مستخدمون

        </div>

        `;

        return;

    }


    container.innerHTML =

        users.map(user => {

            const perms =
                (user.permissions || "")
                    .split(",")
                    .map(p => p.trim())
                    .filter(Boolean);


            const protectedAdmin =
                isAdminRole(user.role);


            const hasAll =
                perms.includes("all") || protectedAdmin;


            const checked =
                permission =>
                    hasAll ||
                    perms.includes(permission);


            return `

            <div
                class="
                bg-[#1E293B]
                rounded-2xl
                border border-gray-700
                p-4
                space-y-4
                shadow
                ">


                <!-- بيانات المستخدم -->

                <div>

                    <div
                        class="font-bold text-blue-400 text-sm">

                        👤 ${user.name || "-"}

                    </div>


                    <div
                        class="text-xs text-gray-300 mt-1">

                        📱 ${user.phone || ""}

                    </div>


                    <div
                        class="text-xs text-gray-300">

                        💼 ${user.job || ""}

                    </div>


                    <div
                        class="text-xs text-gray-300">

                        🔵 ${user.shift || ""}

                    </div>

                </div>


                <!-- الحالة -->

                <div class="text-xs">

                    الحالة :

                    <span class="${
                        user.status === "active"
                            ? "text-green-400"
                            : user.status === "pending"
                                ? "text-yellow-400"
                                : "text-red-400"
                    }">

                        ${user.status || "-"}

                    </span>

                </div>


                <!-- الدور -->

                <div>

                    <label
                        class="text-xs text-gray-400">

                        الدور

                    </label>


                    <select
                        id="role-${user.id}"
                        class="
                        w-full
                        mt-1
                        rounded-lg
                        p-2
                        bg-[#0F172A]
                        border
                        border-gray-700
                        text-sm
                        "
                        ${protectedAdmin ? "disabled" : ""}>

                        <option
                            value="admin"
                            ${user.role === "admin" ? "selected" : ""}>

                            Admin

                        </option>

                        <option
                            value="manager"
                            ${user.role === "manager" ? "selected" : ""}>

                            Manager

                        </option>

                        <option
                            value="supervisor"
                            ${user.role === "supervisor" ? "selected" : ""}>

                            Supervisor

                        </option>

                        <option
                            value="engineer"
                            ${user.role === "engineer" ? "selected" : ""}>

                            Engineer

                        </option>

                        <option
                            value="technician"
                            ${user.role === "technician" ? "selected" : ""}>

                            Technician

                        </option>

                        <option
                            value="operator"
                            ${user.role === "operator" ? "selected" : ""}>

                            Operator

                        </option>

                    </select>

                </div>


                <!-- الصلاحيات -->

                <div>

                    <div
                        class="text-xs text-gray-400 mb-2">

                        الصلاحيات

                    </div>


                    <div
                        class="
                        grid
                        grid-cols-2
                        gap-2
                        text-xs
                        ">

                        ${PERMISSIONS.map(permission =>

                            permissionCheckbox(
                                user.id,
                                permission.value,
                                permission.label,
                                checked(permission.value),
                                protectedAdmin
                            )

                        ).join("")}


                    </div>

                </div>


                <!-- كل الصلاحيات -->

                <div>

                    <label
                        class="
                        flex
                        items-center
                        gap-2
                        bg-blue-500/10
                        border
                        border-blue-500/20
                        rounded-lg
                        p-2
                        ">

                        <input
                            type="checkbox"
                            class="perm-${user.id}"
                            value="all"
                            ${hasAll ? "checked" : ""}
                            ${protectedAdmin ? "disabled" : ""}>

                        <span
                            class="text-xs font-bold text-blue-400">

                            ⭐ كل الصلاحيات

                        </span>

                    </label>

                </div>


                ${
                    protectedAdmin

                    ?

                    `

                    <div
                        class="
                        text-center
                        text-blue-400
                        text-xs
                        bg-blue-500/10
                        p-2
                        rounded-lg
                        ">

                        🔒 الحساب الرئيسي محمي

                    </div>

                    `

                    :

                    `

                    <button
                        onclick="window.saveUserPermissions('${user.id}')"
                        class="
                        w-full
                        py-3
                        rounded-xl
                        bg-blue-600
                        hover:bg-blue-500
                        transition
                        font-bold
                        ">

                        💾 حفظ الصلاحيات

                    </button>


                    ${
                        user.status === "pending"

                        ?

                        `

                        <div
                            class="grid grid-cols-2 gap-2 mt-2">

                            <button
                                onclick="window.approveUser('${user.id}')"
                                class="
                                bg-green-600
                                hover:bg-green-500
                                transition
                                rounded-xl
                                py-2
                                font-bold
                                ">

                                ✅ قبول

                            </button>


                            <button
                                onclick="window.rejectUser('${user.id}')"
                                class="
                                bg-red-600
                                hover:bg-red-500
                                transition
                                rounded-xl
                                py-2
                                font-bold
                                ">

                                ❌ رفض

                            </button>

                        </div>

                        `

                        :

                        ""

                    }


                    <!-- حذف المستخدم -->

                    <div class="mt-4">

                        <button
                            onclick="window.deleteUser('${user.id}', '${(user.name || "").replace(/'/g, "\\'")}')"
                            class="
                                w-full
                                py-2
                                rounded-xl
                                bg-red-700
                                hover:bg-red-600
                                transition
                                font-bold
                                text-sm
                            "
                        >

                            🗑️ حذف المستخدم نهائيًا

                        </button>

                    </div>

                    `

                }


            </div>

            `;

        }).join("");

}


// ======================================
// البحث + الفلاتر
// ======================================

window.filterUsers = function () {

    const search =
        (
            document
                .getElementById("userSearch")
                ?.value || ""
        )
        .toLowerCase()
        .trim();


    const status =
        document
            .getElementById("statusFilter")
            ?.value || "";


    const role =
        document
            .getElementById("roleFilter")
            ?.value || "";


    const filtered =
        usersCache.filter(user => {

            const matchSearch =

                (user.name || "")
                    .toLowerCase()
                    .includes(search)

                ||

                (user.phone || "")
                    .includes(search);


            const matchStatus =
                !status ||
                user.status === status;


            const matchRole =
                !role ||
                user.role === role;


            return (
                matchSearch &&
                matchStatus &&
                matchRole
            );

        });


    renderUsers(filtered);

};


window.searchUsers =
    window.filterUsers;


// ======================================
// حفظ الصلاحيات
// ======================================

window.saveUserPermissions =
async function(id) {

    const role =
        document
            .getElementById(`role-${id}`)
            ?.value;


    if (!role) {

        alert("⚠️ لم يتم تحديد الدور");

        return;

    }


    const permissions = [];


    document
        .querySelectorAll(`.perm-${id}:checked`)
        .forEach(box => {

            permissions.push(box.value);

        });

    if (isAdminRole(role)) {
        if (!permissions.includes("all")) {
            permissions.unshift("all");
        }
        ALL_PERMISSIONS.forEach(p => {
            if (!permissions.includes(p)) permissions.push(p);
        });
    }


    const result =
        await updatePermissionsApi(
            id,
            role,
            permissions.join(",")
        );


    alert(
        result.message ||
        (
            result.status === "success"
                ? "تم حفظ الصلاحيات"
                : "حدث خطأ"
        )
    );


    if (result.status === "success") {
        const currentUid = localStorage.getItem("userId") || "";
        if (id === currentUid) {
            localStorage.setItem("role", role);
            localStorage.setItem("permissions", permissions.join(","));
            setCurrentRole(role);
            setCurrentPermissions(permissions.join(","));
        }

        loadUsersManagement();

    }

};


// ======================================
// قبول مستخدم
// ======================================

window.approveUser =
async function(id) {

    const result =
        await updateUserStatusApi(
            id,
            "active"
        );


    alert(
        result.message ||
        "تم تحديث الحالة"
    );


    loadUsersManagement();

};


// ======================================
// رفض مستخدم
// ======================================

window.rejectUser =
async function(id) {

    const result =
        await updateUserStatusApi(
            id,
            "rejected"
        );


    alert(
        result.message ||
        "تم تحديث الحالة"
    );


    loadUsersManagement();

};


// ======================================
// حذف مستخدم نهائيًا
// ======================================

window.deleteUser =
async function(id, name) {

    const confirmed =
        confirm(
            `⚠️ هل أنت متأكد من حذف المستخدم:\n\n${name}\n\nسيتم حذفه نهائيًا من النظام.`
        );

    if (!confirmed) {
        return;
    }

    const result =
        await deleteUserApi(id);

    if (result.status !== "success") {

        alert(
            result.message ||
            "❌ فشل حذف المستخدم"
        );

        return;
    }

    alert("✅ تم حذف المستخدم نهائيًا");

    await loadUsersManagement();

};


// ======================================
// تحميل جميع المستخدمين
// ======================================

export async function loadUsersManagement() {

    dlog("========== LOAD USERS START ==========");

    const container =
        document.getElementById("usersContainer");

    const count =
        document.getElementById("usersCount");

    dlog("Container:", container);
    dlog("Count element:", count);

    if (!container) {

        console.error(
            "❌ usersContainer غير موجود في الصفحة"
        );

        return;
    }

    container.innerHTML = `
        <div class="text-center py-8 text-gray-400">
            جاري تحميل المستخدمين...
        </div>
    `;

    try {

        const result = await fetchUsers();

        dlog(
            "🔥 fetchUsers RESULT:",
            result
        );

        dlog(
            "🔥 result.data:",
            result?.data
        );

        dlog(
            "🔥 Array:",
            Array.isArray(result?.data)
        );

        dlog(
            "🔥 Length:",
            Array.isArray(result?.data)
                ? result.data.length
                : "NOT ARRAY"
        );


        if (
            !result ||
            result.status !== "success"
        ) {

            console.error(
                "❌ fetchUsers failed:",
                result
            );

            container.innerHTML = `
                <div class="text-center text-red-400 py-8">
                    ❌ فشل تحميل المستخدمين
                </div>
            `;

            if (count) {
                count.innerHTML =
                    "إجمالي المستخدمين : 0";
            }

            return;
        }


        // التأكد أن البيانات Array
        const users = Array.isArray(result.data)
            ? result.data
            : [];


        dlog(
            "✅ USERS BEFORE RENDER:",
            users
        );


        usersCache = users;


        // تحديث العدد مباشرة
        if (count) {

            count.innerHTML =
                `إجمالي المستخدمين : ${users.length}`;

        }


        // رسم المستخدمين
        renderUsers(users);


        dlog(
            "========== LOAD USERS END =========="
        );


    } catch (error) {

        console.error(
            "❌ LOAD USERS ERROR:",
            error
        );

        container.innerHTML = `
            <div class="text-center text-red-400 py-8">
                ❌ حدث خطأ أثناء تحميل المستخدمين
                <br>
                <span class="text-xs">
                    ${error.message || ""}
                </span>
            </div>
        `;

    }

}


// ======================================
// ربط الدالة
// ======================================

window.loadUsersManagement =
    loadUsersManagement;


// ======================================
// توافق مع Router القديم
// ======================================

export async function loadPendingUsers() {

    return await loadUsersManagement();

}


// ======================================
// التحميل التلقائي
// ======================================
// ملاحظة: كان هذا التحميل يعمل بشكل غير مشروط عند استيراد
// الموديول (أي عند إقلاع التطبيق بالكامل، بغض النظر عن الصفحة
// الحالية أو صلاحيات المستخدم)، مما يسبب طلب Firestore غير
// ضروري (وربما خطأ صلاحيات) في كل مرة يُفتح فيها التطبيق.
// تم تقييده الآن بالتأكد من وجود عنصر usersContainer فعلياً
// في الصفحة الحالية (أي أن المستخدم بالفعل على صفحة
// users/requests)، وهو نفس الفحص المستخدم في router.js.

setTimeout(() => {

    if (!document.getElementById("usersContainer")) {
        return;
    }

    dlog("🚀 AUTO LOAD USERS");

    loadUsersManagement();

}, 300);
