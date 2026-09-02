// ============================================================
// MachinesView.js
// صفحة "إدارة الماكينات" (System Hub) - إضافة/تعديل/تعطيل/حذف
// أنواع الماكينات المستخدمة في كل فورمات التطبيق (تسجيل عطل، كايزن،
// فاحص الأعطال، بحث الصيانة). نفس أسلوب RequestsView.js/
// holidaysManagement.js.
//
// بعد أي تعديل هنا، refreshMachineTypesCache() (من machines.js)
// بتتنادى عشان أي فورم تاني في التطبيق يشوف القائمة المحدثة فوراً
// من غير ما يحتاج يعمل Refresh كامل للصفحة.
// ============================================================

import { BottomNav } from "../components/BottomNav.js";

import {
  fetchMachineTypesApi,
  addMachineTypeApi,
  updateMachineTypeApi,
  setMachineTypeActiveApi,
  deleteMachineTypeApi,
  seedDefaultMachineTypesApi
} from "../services/api.js";

import {
  DEFAULT_MACHINE_TYPES,
  refreshMachineTypesCache,
  getMachinesForUser
} from "../machines.js";

import { getCurrentRole, isAdminRole } from "../permissions.js";

// حالة التعديل الحالية (null = وضع "إضافة جديد")
let editingMachineTypeId = null;

// بيانات المستخدم الحالي المستخدمة لتحديد الصلاحيات في هذه الشاشة -
// راجع getMachinesForUser (machines.js) لمنطق الفلترة، وملحوظة
// "machineDepartment" هناك لتفسير سبب استخدام هذا الحقل المستقل بدل
// حقل "department" العام الموجود بالفعل لبيانات المستخدم
function getCurrentUserForMachines() {
  return {
    role: getCurrentRole(),
    machineDepartment: localStorage.getItem("machineDepartment") || ""
  };
}

// هل المستخدم الحالي يقدر يعدّل قسم الماكينة (Backend/Frontend)؟
// أدمن فقط - Engineer/Technician (أو أي دور تاني) للعرض فقط، حتى لو
// كان معاه صلاحية "machines" أصلاً للوصول للشاشة دي
function canEditMachineDepartment() {
  return isAdminRole(getCurrentRole());
}


// ======================================
// واجهة المستخدم
// ======================================

export const MachinesView = () => `

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
                    <span>🏭</span> إدارة الماكينات
                </h2>
                <p class="text-[11px] text-gray-400 mt-0.5 font-medium">
                    إضافة/تعديل أنواع الماكينات المستخدمة في تسجيل الأعطال والكايزن
                </p>
            </div>
        </div>
    </div>


    <!-- فورم إضافة/تعديل -->
    <div id="machineFormBox" class="bg-[#1E293B] border border-gray-800 rounded-2xl p-4 space-y-3">

        <h3 id="machineFormTitle" class="text-sm font-bold text-blue-400">➕ إضافة نوع ماكينة جديد</h3>

        <input
            id="machineKeyInput"
            type="text"
            placeholder="اسم نوع الماكينة (مثال: Bodymaker)"
            class="w-full p-2.5 rounded-lg bg-[#0F172A] border border-gray-700 text-white text-xs outline-none focus:border-blue-500 transition"
        >

        <!-- القسم (Backend/Frontend) - Required. في وضع "إضافة" دايماً
             قابل للاختيار؛ في وضع "تعديل" بيتحول تلقائياً لعرض فقط لو
             المستخدم الحالي مش أدمن (راجع window.editMachineType) -->
        <div>
            <label class="block text-[10px] font-bold mb-1 text-gray-400">القسم (Department) *</label>
            <select
                id="machineDepartmentInput"
                required
                class="w-full p-2.5 rounded-lg bg-[#0F172A] border border-gray-700 text-white text-xs outline-none focus:border-blue-500 transition appearance-none">
                <option value="" disabled selected>اختر القسم</option>
                <option value="backend">🛠️ Backend</option>
                <option value="frontend">🖥️ Frontend</option>
            </select>
            <div id="machineDepartmentReadonly" class="hidden mt-1 text-[10px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-2">
                🔒 تعديل القسم مقصور على الأدمن فقط - القسم الحالي:
                <span id="machineDepartmentReadonlyValue" class="text-white"></span>
            </div>
        </div>

        <div>
            <input
                id="machineUnitsInput"
                type="text"
                placeholder="الوحدات الفرعية مفصولة بفاصلة (اختياري - مثال: 01,02,03)"
                class="w-full p-2.5 rounded-lg bg-[#0F172A] border border-gray-700 text-white text-xs outline-none focus:border-blue-500 transition"
            >
            <button
                type="button"
                onclick="window.generateMachineUnits()"
                class="mt-1.5 text-[10px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5 hover:bg-amber-500/20 transition active:scale-95">
                🔢 توليد أرقام تلقائي (01، 02، ...)
            </button>
        </div>

        <div class="grid grid-cols-2 gap-2">
            <button
                id="machineSaveBtn"
                onclick="window.saveMachineType()"
                class="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white transition active:scale-95">
                ➕ إضافة
            </button>
            <button
                id="machineCancelBtn"
                onclick="window.cancelEditMachineType()"
                class="w-full py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 font-bold text-xs text-white transition active:scale-95 hidden">
                إلغاء التعديل
            </button>
        </div>

    </div>


    <!-- عدد الأنواع + تحديث -->
    <div class="flex items-center justify-between">
        <div id="machinesCount" class="text-xs text-gray-400">جاري التحميل...</div>
        <button
            onclick="window.loadMachinesAdmin()"
            class="text-[11px] font-bold text-gray-300 bg-[#1E293B] border border-gray-700 rounded-lg px-2.5 py-1.5 hover:border-gray-600 transition">
            🔄 تحديث
        </button>
    </div>


    <!-- القائمة -->
    <div id="machinesContainer" class="space-y-2.5">
        <div class="text-center text-gray-500 py-8 text-xs">جاري تحميل أنواع الماكينات...</div>
    </div>


    <!-- استرجاع القائمة الافتراضية -->
    <button
        onclick="window.seedDefaultMachineTypesAdmin()"
        class="w-full py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 font-bold text-[11px] text-amber-300 transition active:scale-95">
        📋 استرجاع أي نوع ناقص من القائمة الافتراضية
    </button>

</div>


${BottomNav("system")}

`;


// ======================================
// تحميل + رسم القائمة
// ======================================

window.loadMachinesAdmin = async function () {

    const container = document.getElementById("machinesContainer");
    const count = document.getElementById("machinesCount");

    if (!container) return;

    container.innerHTML = `
        <div class="text-center text-gray-500 py-8 text-xs">جاري تحميل أنواع الماكينات...</div>
    `;

    const result = await fetchMachineTypesApi();

    if (result.status !== "success") {
        container.innerHTML = `
            <div class="text-center text-red-400 py-8 text-xs">❌ فشل تحميل أنواع الماكينات</div>
        `;
        if (count) count.textContent = "إجمالي الأنواع : 0";
        return;
    }

    // تطبيق الصلاحية فعلياً على مستوى البيانات نفسها (مش مجرد إخفاء
    // زر) - Admin يشوف كل الماكينات، وأي دور تاني يشوف بس ماكينات
    // قسمه (راجع getMachinesForUser / getCurrentUserForMachines فوق)
    const types = getMachinesForUser(getCurrentUserForMachines(), result.data);

    // كاش محلي بسيط في الصفحة نفسها عشان زرار "تعديل" يقدر يقرأ
    // بيانات العنصر من غير طلب Firestore إضافي - نفس القائمة المفلترة
    // المعروضة فعلياً (عشان محدش يقدر يعدّل عنصر مش ظاهر له أصلاً)
    window.__machinesAdminCache = types;

    if (count) {
        const activeCount = types.filter(m => m.active !== false).length;
        count.textContent = `إجمالي الأنواع : ${types.length} (${activeCount} مفعّل)`;
    }

    if (!types.length) {
        container.innerHTML = `
            <div class="text-center text-gray-500 py-8 text-xs">لا توجد أنواع ماكينات مضافة بعد.</div>
        `;
        return;
    }

    container.innerHTML = types.map(m => `
        <div class="bg-[#1E293B] border border-gray-800 rounded-xl p-3 ${m.active === false ? "opacity-60" : ""}">
            <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="text-xs font-bold text-gray-100">${m.key}</span>
                        ${m.active === false
                            ? `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">معطّل</span>`
                            : `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-500/15 text-green-400">مفعّل</span>`
                        }
                        ${m.department === "frontend"
                            ? `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300">🖥️ Frontend</span>`
                            : `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300">🛠️ Backend</span>`
                        }
                    </div>
                    ${m.units && m.units.length
                        ? `<div class="flex flex-wrap gap-1 mt-1.5">
                            ${m.units.map(u => `<span class="text-[10px] bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-300">${u}</span>`).join("")}
                           </div>`
                        : `<div class="text-[10px] text-gray-500 mt-1">بدون وحدات فرعية</div>`
                    }
                </div>
            </div>

            <div class="grid grid-cols-3 gap-1.5 mt-2.5">
                <button
                    onclick="window.editMachineType('${m.id}')"
                    class="py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-300 text-[10px] font-bold hover:bg-blue-600/30 transition active:scale-95">
                    ✏️ تعديل
                </button>
                <button
                    onclick="window.toggleMachineTypeActive('${m.id}', ${m.active !== false})"
                    class="py-1.5 rounded-lg ${m.active !== false ? "bg-amber-600/20 border border-amber-500/30 text-amber-300 hover:bg-amber-600/30" : "bg-green-600/20 border border-green-500/30 text-green-300 hover:bg-green-600/30"} text-[10px] font-bold transition active:scale-95">
                    ${m.active !== false ? "⏸️ تعطيل" : "▶️ تفعيل"}
                </button>
                <button
                    onclick="window.deleteMachineType('${m.id}', '${m.key.replace(/'/g, "\\'")}')"
                    class="py-1.5 rounded-lg bg-red-600/20 border border-red-500/30 text-red-300 text-[10px] font-bold hover:bg-red-600/30 transition active:scale-95">
                    🗑️ حذف
                </button>
            </div>
        </div>
    `).join("");

};


// ======================================
// إضافة / تعديل
// ======================================

window.saveMachineType = async function () {

    const keyInput = document.getElementById("machineKeyInput");
    const unitsInput = document.getElementById("machineUnitsInput");
    const deptSelect = document.getElementById("machineDepartmentInput");

    const key = (keyInput?.value || "").trim();
    const units = (unitsInput?.value || "")
        .split(",")
        .map(u => u.trim())
        .filter(Boolean);

    if (!key) {
        alert("⚠️ يرجى إدخال اسم نوع الماكينة أولاً.");
        return;
    }

    // القسم (Backend/Frontend):
    //  - وضع "إضافة": مطلوب دايماً من الفورم أياً كان دور المستخدم.
    //  - وضع "تعديل" + أدمن: مسموح يغيّره من الفورم (مطلوب برضه).
    //  - وضع "تعديل" + غير أدمن: عرض فقط - بنبعت نفس القيمة الحالية
    //    كما هي من الكاش المحلي بدل قيمة الـ select (المُعطّل أصلاً)،
    //    وعلى أي حال updateMachineTypeApi بيتجاهل أي تعديل للقسم من
    //    غير أدمن حتى لو اتبعتت قيمة مختلفة - تطبيق فعلي مزدوج للصلاحية
    let department;

    if (!editingMachineTypeId || canEditMachineDepartment()) {
        department = (deptSelect?.value || "").trim().toLowerCase();
        if (department !== "backend" && department !== "frontend") {
            alert("⚠️ يرجى اختيار القسم (Backend/Frontend).");
            return;
        }
    } else {
        const current = (window.__machinesAdminCache || []).find(m => m.id === editingMachineTypeId);
        department = current?.department === "frontend" ? "frontend" : "backend";
    }

    const result = editingMachineTypeId
        ? await updateMachineTypeApi(editingMachineTypeId, key, units, department)
        : await addMachineTypeApi(key, units, department);

    if (result.status !== "success") {
        alert("❌ " + (result.message || "حدث خطأ أثناء الحفظ."));
        return;
    }

    window.cancelEditMachineType();

    // تحديث الكاش المستخدم في باقي فورمات التطبيق فوراً
    await refreshMachineTypesCache();

    window.loadMachinesAdmin();

};

window.editMachineType = function (machineTypeId) {

    const item = (window.__machinesAdminCache || []).find(m => m.id === machineTypeId);
    if (!item) return;

    editingMachineTypeId = machineTypeId;

    const keyInput = document.getElementById("machineKeyInput");
    const unitsInput = document.getElementById("machineUnitsInput");
    const deptSelect = document.getElementById("machineDepartmentInput");
    const deptReadonly = document.getElementById("machineDepartmentReadonly");
    const deptReadonlyValue = document.getElementById("machineDepartmentReadonlyValue");
    const title = document.getElementById("machineFormTitle");
    const saveBtn = document.getElementById("machineSaveBtn");
    const cancelBtn = document.getElementById("machineCancelBtn");

    const currentDept = item.department === "frontend" ? "frontend" : "backend";

    if (keyInput) keyInput.value = item.key;
    if (unitsInput) unitsInput.value = (item.units || []).join(",");
    if (deptSelect) deptSelect.value = currentDept;
    if (title) title.textContent = `✏️ تعديل نوع الماكينة: ${item.key}`;
    if (saveBtn) saveBtn.textContent = "💾 حفظ التعديل";
    if (cancelBtn) cancelBtn.classList.remove("hidden");

    // القسم (Department): عرض فقط لغير الأدمن - Engineer/Technician
    // يشوفوا القسم الحالي بدون القدرة الفعلية على تغييره (راجع
    // canEditMachineDepartment وتطبيق الصلاحية في saveMachineType /
    // updateMachineTypeApi)
    if (canEditMachineDepartment()) {
        deptSelect?.classList.remove("hidden");
        if (deptSelect) deptSelect.disabled = false;
        deptReadonly?.classList.add("hidden");
    } else {
        deptSelect?.classList.add("hidden");
        if (deptSelect) deptSelect.disabled = true;
        if (deptReadonlyValue) deptReadonlyValue.textContent = currentDept === "frontend" ? "🖥️ Frontend" : "🛠️ Backend";
        deptReadonly?.classList.remove("hidden");
    }

    document.getElementById("machineFormBox")?.scrollIntoView({ behavior: "smooth", block: "start" });

};

window.cancelEditMachineType = function () {

    editingMachineTypeId = null;

    const keyInput = document.getElementById("machineKeyInput");
    const unitsInput = document.getElementById("machineUnitsInput");
    const deptSelect = document.getElementById("machineDepartmentInput");
    const deptReadonly = document.getElementById("machineDepartmentReadonly");
    const title = document.getElementById("machineFormTitle");
    const saveBtn = document.getElementById("machineSaveBtn");
    const cancelBtn = document.getElementById("machineCancelBtn");

    if (keyInput) keyInput.value = "";
    if (unitsInput) unitsInput.value = "";
    // وضع "إضافة": القسم دايماً قابل للاختيار (مطلوب) لأي مستخدم
    // وصل للشاشة دي، بغض النظر عن دوره
    if (deptSelect) {
        deptSelect.value = "";
        deptSelect.disabled = false;
        deptSelect.classList.remove("hidden");
    }
    deptReadonly?.classList.add("hidden");
    if (title) title.textContent = "➕ إضافة نوع ماكينة جديد";
    if (saveBtn) saveBtn.textContent = "➕ إضافة";
    if (cancelBtn) cancelBtn.classList.add("hidden");

};


// ======================================
// تفعيل / تعطيل / حذف
// ======================================

window.toggleMachineTypeActive = async function (machineTypeId, currentlyActive) {

    const result = await setMachineTypeActiveApi(machineTypeId, !currentlyActive);

    if (result.status !== "success") {
        alert("❌ " + (result.message || "فشل تحديث الحالة."));
        return;
    }

    await refreshMachineTypesCache();

    window.loadMachinesAdmin();

};

window.deleteMachineType = async function (machineTypeId, key) {

    const confirmed = confirm(
        `⚠️ هل أنت متأكد من حذف نوع الماكينة نهائياً:\n\n${key}\n\n` +
        `ملحوظة: البلاغات القديمة المرتبطة بهذا الاسم ستحتفظ بالنص كما هو، لكنه لن يظهر في أي فورم أو فلتر بعد الحذف. لو تحب تحتفظ بإمكانية البحث عنه لاحقاً، استخدم "تعطيل" بدل الحذف النهائي.`
    );

    if (!confirmed) return;

    const result = await deleteMachineTypeApi(machineTypeId);

    if (result.status !== "success") {
        alert("❌ " + (result.message || "فشل حذف نوع الماكينة."));
        return;
    }

    await refreshMachineTypesCache();

    window.loadMachinesAdmin();

};


// ======================================
// توليد أرقام تلقائي للوحدات الفرعية
// ======================================

window.generateMachineUnits = function () {

    const countStr = prompt("عدد الوحدات المرقّمة (مثال: 11 → 01..11):", "");
    const count = parseInt(countStr, 10);

    if (!countStr || isNaN(count) || count <= 0) return;

    const units = [];
    for (let i = 1; i <= count; i++) units.push(String(i).padStart(2, "0"));

    const unitsInput = document.getElementById("machineUnitsInput");
    if (unitsInput) unitsInput.value = units.join(",");

};


// ======================================
// استرجاع القائمة الافتراضية (يتخطى أي اسم موجود بالفعل)
// ======================================

window.seedDefaultMachineTypesAdmin = async function () {

    const confirmed = confirm(
        "هل تريد استرجاع أي نوع ماكينة من القائمة الافتراضية غير موجود حالياً؟\n\n" +
        "الأنواع الموجودة بالفعل (مفعّلة أو معطّلة) لن تتكرر ولن تتأثر."
    );
    if (!confirmed) return;

    const result = await seedDefaultMachineTypesApi(DEFAULT_MACHINE_TYPES);

    if (result.status !== "success") {
        alert("❌ " + (result.message || "حدث خطأ."));
        return;
    }

    await refreshMachineTypesCache();

    alert(result.added > 0 ? `✅ تم إضافة ${result.added} نوع ماكينة.` : "كل الأنواع الافتراضية موجودة بالفعل.");

    window.loadMachinesAdmin();

};
