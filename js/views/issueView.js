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

            <option value="">اختر النوع</option>

            <option>⚡ كهرباء</option>
            <option>⚙ ميكانيكا</option>
            <option>💻 برمجة</option>
            <option>🦺 Safety</option>

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

        <div class="bg-[#0F172A] rounded-xl p-3 border border-gray-700 mb-4">

            <div class="mb-2">
                👤
                <b>المبلغ:</b>
                ${localStorage.getItem("name") || ""}
            </div>

            <div class="mb-2">
                💼
                <b>الوظيفة:</b>
                ${localStorage.getItem("job") || ""}
            </div>

            <div class="mb-2">
                📅
                <b>التاريخ:</b>
                ${new Date().toLocaleString()}
            </div>

        </div>

        <!-- الصورة -->

        <label class="block mb-2 text-sm font-bold">

            صورة (اختياري)

        </label>

        <input
            id="issueImage"
            type="file"
            accept="image/*"
            capture="environment"
            class="w-full mb-5 text-sm">

        <!-- حفظ -->

        <button

            onclick="window.saveIssue()"

            class="w-full py-3 bg-blue-600 rounded-xl font-bold text-white">

            💾 حفظ وإرسال البلاغ

        </button>

    </div>

</div>
`;