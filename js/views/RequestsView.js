import { BottomNav } from "../components/BottomNav.js";
import {
    updateUserStatusApi,
    fetchUsers,
    updatePermissionsApi
} from "../services/api.js";


export const RequestsView = () => `

<div class="p-4 max-w-md mx-auto pb-24 text-white">

    <div class="mb-4">

        <h2 class="text-xl font-bold text-blue-400">
            👥 إدارة المستخدمين والصلاحيات
        </h2>

        <p class="text-sm text-gray-400">
            عرض وتعديل حسابات المستخدمين
        </p>

    </div>


    <!-- البحث -->

    <input

        id="userSearch"

        oninput="window.searchUsers()"

        placeholder="🔍 بحث بالاسم أو رقم الموبايل"

        class="
        w-full
        p-3
        mb-4
        rounded-xl
        bg-[#1E293B]
        border
        border-gray-700
        text-sm
        text-white
        "

    >



    <div
        id="usersContainer"
        class="space-y-3"
    >

        <div class="text-center text-gray-400 py-8">
            جاري تحميل المستخدمين...
        </div>


    </div>


</div>


${BottomNav("system")}

`;



// تخزين المستخدمين مؤقتاً

let usersCache = [];




// تحميل المستخدمين

export async function loadUsersManagement(){


    const container =
        document.getElementById(
            "usersContainer"
        );


    if(!container) return;



    const result =
        await fetchUsers();



    if(result.status !== "success"){


        container.innerHTML = `

        <div class="text-red-400 text-center">
            فشل تحميل المستخدمين
        </div>

        `;

        return;

    }



    usersCache =
        result.data || [];



    renderUsers(usersCache);


}





// عرض المستخدمين

function renderUsers(users){


    const container =
        document.getElementById(
            "usersContainer"
        );


    if(!container) return;



    if(!users.length){


        container.innerHTML = `

        <div class="text-center text-gray-400 py-8">
            لا يوجد مستخدمين
        </div>

        `;

        return;

    }





    container.innerHTML =
    users.map(user => `


<div class="
bg-[#1E293B]
rounded-xl
p-4
border
border-gray-700
space-y-2
">


<div class="font-bold text-blue-400">
👤 ${user.name || "بدون اسم"}
</div>


<div class="text-xs text-gray-300">
📱 ${user.phone || ""}
</div>


<div class="text-xs text-gray-300">
💼 ${user.job || ""}
</div>


<div class="text-xs text-gray-300">
🏢 ${user.department || ""}
</div>


<div class="text-xs text-gray-300">
🔄 ${user.shift || ""}
</div>



<div class="text-xs">

الحالة:
<span class="
${user.status==="active"
?"text-green-400"
:user.status==="pending"
?"text-yellow-400"
:"text-red-400"}
">

${user.status || ""}

</span>

</div>





<label class="text-xs text-gray-400">
الدور
</label>


<select

id="role-${user.id}"

class="
w-full
p-2
rounded-lg
bg-[#0F172A]
border
border-gray-700
text-xs
"

>


<option value="user"
${user.role==="user"?"selected":""}>
User
</option>


<option value="engineer"
${user.role==="engineer"?"selected":""}>
Engineer
</option>


<option value="tech"
${user.role==="tech"?"selected":""}>
Tech
</option>


<option value="admin"
${user.role==="admin"?"selected":""}>
Admin
</option>


</select>





<label class="text-xs text-gray-400">
الصلاحيات
</label>


<select

id="perm-${user.id}"

class="
w-full
p-2
rounded-lg
bg-[#0F172A]
border
border-gray-700
text-xs
"

>


<option value="all"
${user.permissions==="all"?"selected":""}>
كل الصلاحيات
</option>


<option value="report,issue,log"
${user.permissions==="report,issue,log"?"selected":""}>
تقارير + أعطال
</option>


<option value="report"
${user.permissions==="report"?"selected":""}>
تقارير فقط
</option>


<option value=""
${!user.permissions?"selected":""}>
بدون صلاحيات
</option>


</select>





<button

onclick="window.saveUserPermissions('${user.id}')"

class="
w-full
bg-blue-600
hover:bg-blue-500
rounded-lg
py-2
text-xs
font-bold
"

>

💾 حفظ التعديل

</button>




${
user.status==="pending"

?

`

<div class="flex gap-2 mt-2">

<button

onclick="window.approveUser('${user.id}')"

class="
flex-1
bg-green-600
rounded-lg
py-2
text-xs
font-bold
">

✅ قبول

</button>


<button

onclick="window.rejectUser('${user.id}')"

class="
flex-1
bg-red-600
rounded-lg
py-2
text-xs
font-bold
">

❌ رفض

</button>


</div>

`

:""

}



</div>



`).join("");

}





// البحث

window.searchUsers = function(){


const value =
document.getElementById(
"userSearch"
)?.value
.toLowerCase()
.trim();



const filtered =
usersCache.filter(user =>


(user.name||"")
.toLowerCase()
.includes(value)


||

(user.phone||"")
.includes(value)


);



renderUsers(filtered);


};






// حفظ الصلاحيات

window.saveUserPermissions =
async function(id){


const role =
document.getElementById(
`role-${id}`
).value;



const permissions =
document.getElementById(
`perm-${id}`
).value;



const result =
await updatePermissionsApi(
id,
role,
permissions
);



alert(
result.message ||
"تم الحفظ"
);



};






// قبول

window.approveUser =
async function(id){


const result =
await updateUserStatusApi(
id,
"active"
);


alert(result.message);


loadUsersManagement();


};






// رفض

window.rejectUser =
async function(id){


const result =
await updateUserStatusApi(
id,
"rejected"
);


alert(result.message);


loadUsersManagement();


};





window.loadUsersManagement =
loadUsersManagement;


// توافق مع النسخة القديمة من app.js
export const loadPendingUsers =
loadUsersManagement;


setTimeout(()=>{

    loadUsersManagement();

},100); 
