// js/views/reportView.js
const ReportViewModule = {
  render: () => `
    <div class="p-4 max-w-md mx-auto space-y-4">
      <button onclick="navigateTo('home')" class="bg-gray-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold">⬅️ رجوع</button>
      <h2 class="text-base font-bold text-blue-400">🚨 تسجيل عطل أو ملاحظة جديدة</h2>
      
      <form id="ticketForm" onsubmit="ReportViewModule.handleSubmit(event)" class="space-y-3">
        <div>
          <label class="block text-xs font-bold mb-1 opacity-70">الشيفت الحالي *</label>
          <select id="ticketShift" class="w-full p-2.5 rounded-lg bg-[#1E293B] border border-gray-700 text-xs text-white" required>
            <option value="Green">Green Shift</option>
            <option value="Blue">Blue Shift</option>
            <option value="Red">Red Shift</option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-bold mb-1 opacity-70">المعدة / الماكينة *</label>
          <select id="ticketMachine" class="w-full p-2.5 rounded-lg bg-[#1E293B] border border-gray-700 text-xs text-white" required>
            <option value="">اختر الماكينة...</option>
            <option value="Bodymaker 1">Bodymaker 1</option>
            <option value="Bodymaker 2">Bodymaker 2</option>
            <option value="Necker">Necker</option>
            <option value="Decorator">Decorator</option>
            <option value="Washer">Washer</option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-bold mb-1 opacity-70">نوع العطل *</label>
          <select id="ticketType" class="w-full p-2.5 rounded-lg bg-[#1E293B] border border-gray-700 text-xs text-white" required>
            <option value="ميكانيكي">ميكانيكي</option>
            <option value="كهربائي">كهربائي</option>
            <option value="برمجي / كنترول">برمجي / كنترول</option>
            <option value="جودة / إنتاج">جودة / إنتاج</option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-bold mb-1 opacity-70">وصف العطل *</label>
          <textarea id="ticketDesc" placeholder="أدخل تفاصيل العطل..." class="w-full p-2.5 rounded-lg bg-[#1E293B] border border-gray-700 text-xs text-white h-20" required></textarea>
        </div>

        <div>
          <label class="block text-xs font-bold mb-1 opacity-70">اقتراح الحل (اختياري)</label>
          <input id="ticketSolution" placeholder="إذا كان لديك مقترح للإصلاح..." class="w-full p-2.5 rounded-lg bg-[#1E293B] border border-gray-700 text-xs text-white" />
        </div>

        <div>
          <label class="block text-xs font-bold mb-1 opacity-70">صورة العطل (اختياري)</label>
          <input id="ticketImg" type="file" accept="image/*" class="w-full text-xs text-gray-400 bg-[#1E293B] p-2 rounded-lg border border-gray-700" />
        </div>

        <button type="submit" id="submitTicketBtn" class="w-full p-3 bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl font-bold text-xs text-white transition">
          حفظ وإرسال ✅
        </button>
      </form>
    </div>
  `,

  handleSubmit: async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitTicketBtn');
    btn.disabled = true;
    btn.innerHTML = '⏳ جاري التحقق والحل...';

    const payload = {
      action: 'createTicket',
      shift: document.getElementById('ticketShift').value,
      machine: document.getElementById('ticketMachine').value,
      type: document.getElementById('ticketType').value,
      description: document.getElementById('ticketDesc').value,
      suggestedSolution: document.getElementById('ticketSolution').value,
      user: {
        name: localStorage.getItem('name') || '',
        phone: localStorage.getItem('phone') || '',
        role: localStorage.getItem('role') || 'prod_tech'
      },
      timestamp: new Date().toISOString()
    };

    try {
      const response = await fetch(CONFIG.GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      });
      const res = await response.json();

      if (res.status === 'confirmed_existing') {
        alert(`⚠️ العطل مسجل بالفعل على هذه الماكينة!\nتم إضافة تأكيدك (Confirmed By) برقم الشيفت: ${payload.shift}`);
      } else {
        alert('✅ تم تسجيل البلاغ بنجاح برقم #' + res.ticketId);
      }
      navigateTo('home');
    } catch (err) {
      alert('حدث خطأ أثناء الاتصال بالسيرفر');
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'حفظ وإرسال ✅';
    }
  }
};