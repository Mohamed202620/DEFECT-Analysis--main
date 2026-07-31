export const IssueView = () => `
<div class="p-4 max-w-md mx-auto space-y-4">

    <button
        onclick="window.navigateTo('home')"
        class="bg-gray-700 px-3 py-2 rounded-lg text-white">
        ⬅ رجوع
    </button>

    <div class="bg-[#1E293B] rounded-2xl p-4 border border-gray-700">

        <h2 class="text-xl font-bold text-blue-400 mb-4">
            📝 تسجيل عطل أو ملاحظة
        </h2>

        <!-- الخط -->

        <label class="block mb-2 text-sm font-bold">
            الخط
        </label>

        <select id="issueLine"
            class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white mb-4">

            <option value="">اختر الخط</option>
            <option>Line 1</option>
            <option>Line 2</option>

        </select>

        <!-- الماكينة -->

        <label class="block mb-2 text-sm font-bold">
            الماكينة
        </label>

        <select id="issueMachine"
            class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white mb-4">

            <option value="">اختر الماكينة</option>

            <option>Coil Handling</option>
            <option>Baler</option>
            <option>Cupper</option>
            <option>Bodymaker</option>
            <option>Trimmer</option>
            <option>Washer</option>
            <option>Decorator</option>
            <option>Spray</option>
            <option>IBO</option>
            <option>Necker</option>
            <option>Palletizer</option>
            <option>Depalletizer</option>
            <option>Front End Line Control</option>
            <option>Mid Line Control</option>
            <option>Back End Line Control</option>

        </select>

        <!-- درجة الأولوية -->

        <label class="block mb-2 text-sm font-bold">
        درجة الأولوية
        </label>

        <select
        id="issuePriority"
        class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white mb-4">

        <option value="High">🔴 عالية</option>
        <option value="Medium" selected>🟡 متوسطة</option>
        <option value="Low">🟢 منخفضة</option>

        </select>

        <!-- نوع البلاغ -->

        <label class="block mb-2 text-sm font-bold">
            نوع البلاغ
        </label>

        <div class="flex gap-5 mb-4">

            <label>
                <input
                    type="radio"
                    name="issueType"
                    value="Breakdown"
                    checked>

                عطل
            </label>

            <label>

                <input
                    type="radio"
                    name="issueType"
                    value="Observation">

                ملاحظة

            </label>

        </div>

        <!-- نوع العطل -->

        <label class="block mb-2 text-sm font-bold">
            نوع العطل
        </label>

        <select id="issueCategory"
        class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white mb-4">

        <option value="">اختر نوع العطل</option>

        <option>⚡ كهرباء</option>
        <option>⚙️ ميكانيكا</option>
        <option>💻 برمجة</option>
        <option>🛡️ Safety</option>
        <option>📦 جودة</option>
        <option>❓ أخرى</option>

        </select>

        <!-- وصف المشكلة -->

        <label class="block mb-2 text-sm font-bold">
            وصف المشكلة
        </label>

        <textarea
            id="issueDescription"
            rows="4"
            class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white mb-4"
            placeholder="اكتب وصف المشكلة"></textarea>

        <!-- مكان العطل داخل الماكينة -->

        <label class="block mb-2 text-sm font-bold">
        مكان العطل داخل الماكينة
        </label>

        <input
        id="issueLocation"
        type="text"
        placeholder="مثال: Main Motor - Sensor - Bearing"
        class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white mb-4">

        <!-- اقتراح الحل -->

        <label class="block mb-2 text-sm font-bold">
            اقتراح الحل (اختياري)
        </label>

        <textarea
            id="issueSuggestion"
            rows="3"
            class="w-full p-3 rounded-lg bg-[#0F172A] border border-gray-700 text-white mb-4"
            placeholder="اقتراح الحل"></textarea>

        <!-- بيانات المبلغ -->

        <div class="bg-[#0F172A] rounded-xl p-3 border border-gray-700 mb-4 space-y-2">

        <div>👤 <b>المبلغ:</b> ${localStorage.getItem("name") || ""}</div>

        <div>💼 <b>الوظيفة:</b> ${localStorage.getItem("job") || ""}</div>

        <div>🏢 <b>القسم:</b> ${localStorage.getItem("department") || ""}</div>

        <div>🔵 <b>الشيفت:</b> ${localStorage.getItem("shift") || ""}</div>

        <div>📅 <b>التاريخ:</b> ${new Date().toLocaleString("ar-EG")}</div>

        <div>
        🆔 <b>رقم البلاغ:</b>
        ${Date.now()}
        </div>

        </div>

        <!-- الصورة -->

        <label class="block mb-2 text-sm font-bold">
        صورة (اختياري)
        </label>

        <div class="grid grid-cols-2 gap-2 mb-4">

        <input
        id="cameraImage"
        type="file"
        accept="image/*"
        capture="environment"
        class="hidden">

        <button
        onclick="document.getElementById('cameraImage').click()"
        class="bg-blue-600 rounded-lg p-3 text-white font-bold">

        📷 تصوير

        </button>

        <input
        id="galleryImage"
        type="file"
        accept="image/*"
        class="hidden">

        <button
        onclick="document.getElementById('galleryImage').click()"
        class="bg-gray-700 rounded-lg p-3 text-white font-bold">

        🖼️ المعرض

        </button>

        </div>

        <div
        id="imageName"
        class="text-center text-xs text-gray-400 mb-3">

        لم يتم اختيار صورة

        </div>

        <img
        id="previewImage"
        class="hidden rounded-xl border border-gray-700 w-full mb-4"/>

        <!-- حالة البلاغ -->

        <label class="block mb-2 text-sm font-bold">

        حالة البلاغ

        </label>

        <input

        value="🟡 مفتوح"

        readonly

        class="w-full p-3 rounded-lg bg-[#111827] border border-gray-700 text-yellow-400 mb-4">

        <!-- حفظ -->

        <button

        onclick="window.confirmIssue()"

        class="w-full py-3 bg-blue-600 rounded-xl font-bold text-white">

        💾 حفظ وإرسال البلاغ

        </button>

    </div>

</div>
`;