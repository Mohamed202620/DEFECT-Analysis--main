import { BottomNav } from "../components/BottomNav.js";
import {
  fetchUsers,
  updatePermissionsApi,
  updateUserStatusApi
} from "../services/api.js";

// ======================================
// المتغيرات
// ======================================
let usersCache = [];

// ======================================
// واجهة المستخدم (View)
// ======================================
export const RequestsView = () => `
<div class="p-4 max-w-md mx-auto pb-24 space-y-4 text-white">

    <!-- Header -->
    <div>
        <h2 class="text-xl font-bold text-blue-400">
            👥 إدارة المستخدمين
        </h2>
        <p class="text-xs text-gray-400 mt-1">
            إدارة الحسابات والأدوار والصلاحيات
        </p>
    </div>

    <!-- Search -->
    <input
        id="userSearch"
        oninput="window.searchUsers()"
        placeholder="🔍 بحث بالاسم أو رقم الهاتف"
        class="w-full p-3 rounded-xl bg-[#1E293B] border border-gray-700 text-white text-sm"
    >

    <!-- Filters -->
    <div class="grid grid-cols-2 gap-3">
        <select
            id="statusFilter"
            onchange="window.filterUsers()"
            class="bg-[#1E293B] border border-gray-700 rounded-xl p-3 text-sm">
            <option value="">كل الحالات</option>
            <option value="active">🟢 Active</option>
            <option value="pending">🟡 Pending</option>
            <option value="rejected">🔴 Rejected</option>
        </select>

        <select
            id="roleFilter"
            onchange="window.filterUsers()"
            class="bg-[#1E293B] border border-gray-700 rounded-xl p-3 text-sm">
            <option value="">كل الأدوار</option>
            <option value="admin">👑 Admin</option>
            <option value="manager">🧑‍💼 Manager</option>
            <option value="supervisor">👨‍🔧 Supervisor</option>
            <option value="engineer">👨‍💻 Engineer</option>
            <option value="technician">🛠 Technician</option>
            <option value="operator">⚙️ Operator</option>
        </select>
    </div>

    <!-- عدد المستخدمين -->
    <div id="usersCount" class="text-xs text-gray-400">
        إجمالي المستخدمين : 0
    </div>

    <!-- القائمة -->
    <div id="usersContainer" class="space-y-4">
        <div class="text-center text-gray-500 py-8">
            جاري تحميل المستخدمين...
        </div>
    </div>

</div>

${BottomNav("system")}
`;

// ======================================
// المكونات المساعدة (Helpers)
// ======================================
function permissionCheckbox(id, value, label, checked, disabled) {
    return `
    <label class="flex items-center gap-2">
        <input
            type="checkbox"
            class="perm-${id}"
            value="${value}"
            ${checked}
            ${disabled ? "disabled" : ""}
        >
        <span>${label}</span>
    </label>
    `;
}

function renderUsers(users) {
    const container = document.getElementById("usersContainer");
    const count = document.getElementById("usersCount");

    if (!container) return;

    if (count) {
        count.innerHTML = `إجمالي المستخدمين : ${users.length}`;
    }

    if (!users.length) {
        container.innerHTML = `
        <div class="text-center text-gray-400 py-10">
            لا يوجد مستخدمون
        </div>`;
        return;
    }

    container.innerHTML = users.map(user => {
        const perms = (user.permissions || "").split(",").map(p => p.trim());
        const checked = (p) => perms.includes(p) ? "checked" : "";
        const protectedAdmin = user.role === "admin";

        return `
        <div class="bg-[#1E293B] rounded-2xl border border-gray-700 p-4 space-y-4 shadow">
            
            <!-- بيانات المستخدم -->
            <div>
                <div class="font-bold text-blue-400 text-sm">
                    👤 ${user.name || "-"}
                </div>
                <div class="text-xs text-gray-300 mt-1">
                    📱 ${user.phone || ""}
                </div>
                <div class="text-xs text-gray-300">
                    💼 ${user.job || ""}
                </div>
                <div class="text-xs text-gray-300">
                    🔵 ${user.shift || ""}
                </div>
            </div>

            <!-- الحالة -->
            <div class="text-xs">
                الحالة :
                <span class="${
                    user.status === "active" ? "text-green-400" :
                    user.status === "pending" ? "text-yellow-400" : "text-red-400"
                }">
                    ${user.status}
                </span>
            </div>

            <!-- الدور -->
            <div>
                <label class="text-xs text-gray-400">الدور</label>
                <select
                    id="role-${user.id}"
                    class="w-full mt-1 rounded-lg p-2 bg-[#0F172A] border border-gray-700 text-sm"
                    ${protectedAdmin ? "disabled" : ""}
                >
                    <option value="admin" ${user.role === "admin" ? "selected" : ""}>Admin</option>
                    <option value="manager" ${user.role === "manager" ? "selected" : ""}>Manager</option>
                    <option value="supervisor" ${user.role === "supervisor" ? "selected" : ""}>Supervisor</option>
                    <option value="engineer" ${user.role === "engineer" ? "selected" : ""}>Engineer</option>
                    <option value="technician" ${user.role === "technician" ? "selected" : ""}>Technician</option>
                    <option value="operator" ${user.role === "operator" ? "selected" : ""}>Operator</option>
                </select>
            </div>

            <!-- الصلاحيات الشاملة -->
            <div>
                <div class="text-xs text-gray-400 mb-2">الصلاحيات</div>
                <div class="grid grid-cols-2 gap-2 text-xs">
                    ${permissionCheckbox(user.id, "home", "🏠 الرئيسية", checked("home"), protectedAdmin)}
                    ${permissionCheckbox(user.id, "issue", "🚨 تسجيل عطل", checked("issue"), protectedAdmin)}
                    ${permissionCheckbox(user.id, "pm", "📝 الصيانة الوقائية", checked("pm"), protectedAdmin)}
                    ${permissionCheckbox(user.id, "log", "📋 سجل الصيانة", checked("log"), protectedAdmin)}
                    ${permissionCheckbox(user.id, "reports", "📊 التقارير", checked("reports"), protectedAdmin)}
                    ${permissionCheckbox(user.id, "quality", "📦 الجودة", checked("quality"), protectedAdmin)}
                    ${permissionCheckbox(user.id, "ai", "🤖 تحليل AI", checked("ai"), protectedAdmin)}
                    ${permissionCheckbox(user.id, "kb", "📚 قاعدة المعرفة", checked("kb"), protectedAdmin)}
                    ${permissionCheckbox(user.id, "suggestions", "💡 كايزن", checked("suggestions"), protectedAdmin)}
                    ${permissionCheckbox(user.id, "qr", "📱 QR", checked("qr"), protectedAdmin)}
                    ${permissionCheckbox(user.id, "statistics", "📈 الإحصائيات", checked("statistics"), protectedAdmin)}
                    ${permissionCheckbox(user.id, "export", "📤 تصدير التقارير", checked("export"), protectedAdmin)}
                    ${permissionCheckbox(user.id, "users", "👥 إدارة المستخدمين", checked("users"), protectedAdmin)}
                    ${permissionCheckbox(user.id, "requests", "⏳ طلبات الانضمام", checked("requests"), protectedAdmin)}
                    ${permissionCheckbox(user.id, "machines", "🏭 إدارة الماكينات", checked("machines"), protectedAdmin)}
                    ${permissionCheckbox(user.id, "settings", "⚙️ إعدادات النظام", checked("settings"), protectedAdmin)}
                    ${permissionCheckbox(user.id, "all", "👑 المدير الكامل", checked("all"), protectedAdmin)}
                </div>
            </div>

            ${
                protectedAdmin ?
                `<div class="text-center text-blue-400 text-xs">
                    🔒 الحساب الرئيسي محمي
                </div>` :
                `
                <button
                    onclick="window.saveUserPermissions('${user.id}')"
                    class="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 transition font-bold">
                    💾 حفظ
                </button>
                ${user.status === "pending" ? `
                <div class="grid grid-cols-2 gap-2 mt-2">
                    <button
                        onclick="window.approveUser('${user.id}')"
                        class="bg-green-600 hover:bg-green-500 transition rounded-xl py-2 font-bold">
                        ✅ قبول
                    </button>
                    <button
                        onclick="window.rejectUser('${user.id}')"
                        class="bg-red-600 hover:bg-red-500 transition rounded-xl py-2 font-bold">
                        ❌ رفض
                    </button>
                </div>
                ` : ""}
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
    const search = (document.getElementById("userSearch")?.value || "").toLowerCase().trim();
    const status = document.getElementById("statusFilter")?.value || "";
    const role = document.getElementById("roleFilter")?.value || "";

    const filtered = usersCache.filter(user => {
        const matchSearch = (user.name || "").toLowerCase().includes(search) || (user.phone || "").includes(search);
        const matchStatus = !status || user.status === status;
        const matchRole = !role || user.role === role;
        
        return matchSearch && matchStatus && matchRole;
    });

    renderUsers(filtered);
};

window.searchUsers = window.filterUsers;

// ======================================
// حفظ الصلاحيات
// ======================================
window.saveUserPermissions = async function(id) {
    const role = document.getElementById(`role-${id}`).value;
    const permissions = [];
    
    document.querySelectorAll(`.perm-${id}:checked`).forEach(box => permissions.push(box.value));

    const result = await updatePermissionsApi(id, role, permissions.join(","));
    alert(result.message || "تم حفظ التعديلات");
};

// ======================================
// قبول مستخدم
// ======================================
window.approveUser = async function(id) {
    const result = await updateUserStatusApi(id, "active");
    alert(result.message);
    loadUsersManagement();
};

// ======================================
// رفض مستخدم
// ======================================
window.rejectUser = async function(id) {
    const result = await updateUserStatusApi(id, "rejected");
    alert(result.message);
    loadUsersManagement();
};

// ======================================
// تحميل المستخدمين
// ======================================
export async function loadUsersManagement() {
    const container = document.getElementById("usersContainer");
    if (!container) return;

    container.innerHTML = `
        <div class="text-center py-8 text-gray-400">
            جاري التحميل...
        </div>`;

    const result = await fetchUsers();

    if (result.status !== "success") {
        container.innerHTML = `
        <div class="text-center text-red-400 py-8">
            فشل تحميل المستخدمين
        </div>`;
        return;
    }

    usersCache = result.data || [];
    renderUsers(usersCache);
}

// ======================================
// ربط الدوال وتصديرها
// ======================================
window.loadUsersManagement = loadUsersManagement;
export const loadPendingUsers = loadUsersManagement;

// ======================================
// التحميل التلقائي
// ======================================
setTimeout(() => {
    loadUsersManagement();
}, 200);
