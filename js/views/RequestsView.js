import { BottomNav } from "../components/BottomNav.js";
import { updateUserStatusApi, fetchUsers } from "../services/api.js";


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




/**
 * تحميل المستخدمين المنتظرين
 */
export async function loadPendingUsers() {


    const container =
        document.getElementById(
            "pendingUsersContainer"
        );


    if (!container) return;



    const result = await fetchUsers();



    if (result.status !== "success") {


        container.innerHTML = `

            <div class="text-red-400 text-center">
                فشل تحميل البيانات
            </div>

        `;

        return;

    }



    const pending =
        (result.data || [])
        .filter(user =>
            (user.status || "").trim() === "pending"
        );




    if (!pending.length) {


        container.innerHTML = `

            <div class="text-center text-gray-400 py-10">
                لا توجد طلبات جديدة
            </div>

        `;


        return;

    }




    container.innerHTML = pending.map(user => `


        <div
        class="bg-[#1E293B] rounded-xl p-4 border border-gray-700"
        >


            <div class="font-bold text-blue-400">
                ${user.name || "بدون اسم"}
            </div>



            <div class="text-sm text-gray-300 mt-1">
                📱 ${user.phone || ""}
            </div>



            <div class="text-sm text-gray-300">
                💼 ${user.job || ""}
            </div>



            <div class="text-sm text-gray-300">
                🏢 ${user.department || ""}
            </div>



            <div class="text-sm text-gray-300">
                🔄 ${user.shift || ""}
            </div>



            <div class="mt-4 flex gap-2">


                <button
                class="flex-1 bg-green-600 hover:bg-green-500 py-2 rounded-lg font-bold"
                onclick="window.approveUser('${user.id}')"
                >
                    ✅ قبول
                </button>




                <button
                class="flex-1 bg-red-600 hover:bg-red-500 py-2 rounded-lg font-bold"
                onclick="window.rejectUser('${user.id}')"
                >
                    ❌ رفض
                </button>



            </div>



        </div>



    `).join("");



}





// قبول المستخدم
window.approveUser = async function(id) {


    const result =
        await updateUserStatusApi(
            id,
            "active"
        );



    alert(
        result.message ||
        "تم قبول المستخدم"
    );



    loadPendingUsers();

};





// رفض المستخدم
window.rejectUser = async function(id) {


    const result =
        await updateUserStatusApi(
            id,
            "rejected"
        );



    alert(
        result.message ||
        "تم رفض المستخدم"
    );



    loadPendingUsers();

};




// إتاحة الدالة للتطبيق
window.loadPendingUsers = loadPendingUsers;



// تحميل الطلبات بعد ظهور الصفحة
setTimeout(() => {

    loadPendingUsers();

}, 100);
