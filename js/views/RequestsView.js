import { BottomNav } from "../components/BottomNav.js";

export const RequestsView = () => `
<div class="p-4 max-w-md mx-auto pb-24 text-white">

    <div class="mb-4">
        <h2 class="text-xl font-bold text-amber-400">
            ⏳ طلبات الانضمام
        </h2>

        <p class="text-sm text-gray-400">
            المستخدمون الذين ينتظرون موافقة المدير
        </p>
    </div>

    <div
        id="pendingUsersContainer"
        class="space-y-3"
    >
        <div class="text-center text-gray-400 py-8">
            جارٍ تحميل الطلبات...
        </div>
    </div>

</div>

${BottomNav("system")}
`;

export async function loadPendingUsers() {

    const container = document.getElementById("pendingUsersContainer");

    const { fetchUsers } = await import("../services/api.js");

    const result = await fetchUsers();

    if (result.status !== "success") {
        container.innerHTML = `
            <div class="text-red-400 text-center">
                فشل تحميل البيانات
            </div>
        `;
        return;
    }

    const pending = result.data.filter(u => u.status === "pending");

    if (!pending.length) {
        container.innerHTML = `
            <div class="text-center text-gray-400 py-10">
                لا توجد طلبات جديدة
            </div>
        `;
        return;
    }

    container.innerHTML = pending.map(user => `
        <div class="bg-[#1E293B] rounded-xl p-4 border border-gray-700">

            <div class="font-bold text-blue-400">
                ${user.name}
            </div>

            <div class="text-sm text-gray-300 mt-1">
                📱 ${user.phone}
            </div>

            <div class="text-sm text-gray-300">
                💼 ${user.job}
            </div>

            <div class="text-sm text-gray-300">
                🏢 ${user.department}
            </div>

            <div class="text-sm text-gray-300">
                🔄 ${user.shift}
            </div>

            <div class="mt-4 flex gap-2">

                <button
                    class="flex-1 bg-green-600 py-2 rounded-lg"
                    onclick="window.approveUser('${user.id}')"
                >
                    ✅ قبول
                </button>

                <button
                    class="flex-1 bg-red-600 py-2 rounded-lg"
                    onclick="window.rejectUser('${user.id}')"
                >
                    ❌ رفض
                </button>

            </div>

        </div>
    `).join("");
}
