import { BottomNav } from "../components/BottomNav.js";
import { fetchUsers, updatePermissionsApi } from "../services/api.js";


let allUsers = [];



export const RequestsView = () => `

<div class="p-4 max-w-md mx-auto pb-24 text-white space-y-4">


    <!-- Header -->
    <div>

        <h2 class="text-xl font-bold text-blue-400">
            👥 إدارة المستخدمين
        </h2>

        <p class="text-sm text-gray-400">
            عرض وتعديل صلاحيات المستخدمين
        </p>

    </div>



    <!-- Statistics -->

    <div class="grid grid-cols-4 gap-2 text-center text-xs">


        <div class="bg-[#1E293B] rounded-xl p-3">
            <div id="countAll" class="text-blue-400 text-lg font-bold">
                0
            </div>
            الكل
        </div>


        <div class="bg-[#1E293B] rounded-xl p-3">
            <div id="countActive" class="text-green-400 text-lg font-bold">
                0
            </div>
            فعال
        </div>


        <div class="bg-[#1E293B] rounded-xl p-3">
            <div id="countPending" class="text-yellow-400 text-lg font-bold">
                0
            </div>
            معلق
        </div>


        <div class="bg-[#1E293B] rounded-xl p-3">
            <div id="countRejected" class="text-red-400 text-lg font-bold">
                0
            </div>
            مرفوض
        </div>


    </div>




    <!-- Search -->

    <input

        id="userSearch"

        oninput="window.filterUsers()"

        placeholder="🔍 بحث بالاسم أو الرقم"

        class="w-full p-3 rounded-xl bg-[#1E293B] border border-gray-700 text-white text-sm"

    />





    <!-- Filter -->

    <select

        id="statusFilter"

        onchange="window.filterUsers()"

        class="w-full p-3 rounded-xl bg-[#1E293B] border border-gray-700 text-white text-sm"

    >

        <option value="all">
            كل المستخدمين
        </option>


        <option value="active">
            فعال
        </option>


        <option value="pending">
            معلق
        </option>


        <option value="rejected">
            مرفوض
        </option>


    </select>





    <!-- Users -->

    <div id="usersContainer" class="space-y-3">


        <div class="text-center text-gray-400 py-8">
            جاري تحميل المستخدمين...
        </div>


    </div>



</div>


${BottomNav("system")}

`;





export async function loadPendingUsers(){


    const result = await fetchUsers();



    if(result.status !== "success"){

        document.getElementById("usersContainer").innerHTML =

        `
        <div class="text-red-400 text-center">
        فشل تحميل البيانات
        </div>
        `;

        return;

    }



    allUsers = result.data || [];



    updateStatistics();



    renderUsers(allUsers);

}





function updateStatistics(){


    document.getElementById("countAll").innerHTML =
        allUsers.length;


    document.getElementById("countActive").innerHTML =
        allUsers.filter(
            u => (u.status || "").trim() === "active"
        ).length;


    document.getElementById("countPending").innerHTML =
        allUsers.filter(
            u => (u.status || "").trim() === "pending"
        ).length;


    document.getElementById("countRejected").innerHTML =
        allUsers.filter(
            u => (u.status || "").trim() === "rejected"
        ).length;


}






function renderUsers(users){


    const container =
        document.getElementById("usersContainer");


    if(!container) return;



    if(!users.length){

        container.innerHTML =
        `
        <div class="text-center text-gray-400 py-8">
        لا يوجد مستخدمين
        </div>
        `;

        return;

    }





    container.innerHTML = users.map(user => `


<div class="bg-[#1E293B] rounded-xl p-4 border border-gray-700">


<div class="font-bold text-blue-400">
👤 ${user.name || ""}
</div>


<div class="text-sm text-gray-300">
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



<div class="mt-2 text-xs">

الحالة:
<span class="${
(user.status==="active")
?"text-green-400"
:(user.status==="pending")
?"text-yellow-400"
:"text-red-400"
}">
${user.status || ""}
</span>


</div>





<select

onchange="window.changeRole('${user.id}',this.value)"

class="w-full mt-3 p-2 rounded-lg bg-[#0F172A] border border-gray-700 text-white text-sm"

>


<option value="user"
${user.role==="user"?"selected":""}>
User
</option>


<option value="engineer"
${user.role==="engineer"?"selected":""}>
Engineer
</option>


<option value="supervisor"
${user.role==="supervisor"?"selected":""}>
Supervisor
</option>


<option value="manager"
${user.role==="manager"?"selected":""}>
Manager
</option>


<option value="admin"
${user.role==="admin"?"selected":""}>
Admin
</option>


</select>



</div>


`).join("");



}







window.filterUsers=function(){


    const text =
    document.getElementById("userSearch").value
    .toLowerCase();



    const status =
    document.getElementById("statusFilter").value;




    const filtered =
    allUsers.filter(user=>{


        const matchText =

        (
            user.name ||
            ""
        )
        .toLowerCase()
        .includes(text)

        ||

        (
            user.phone ||
            ""
        )
        .includes(text);



        const matchStatus =

        status==="all"

        ||

        user.status===status;



        return matchText && matchStatus;


    });



    renderUsers(filtered);


};







window.changeRole = async function(id,role){



    let permissions = "all";



    if(role==="admin"){

        permissions="all";

    }



    const result =
    await updatePermissionsApi(
        id,
        role,
        permissions
    );



    alert(
        result.message ||
        "تم تحديث الصلاحية"
    );



};






window.loadPendingUsers =
loadPendingUsers;



setTimeout(()=>{

    loadPendingUsers();

},100);
