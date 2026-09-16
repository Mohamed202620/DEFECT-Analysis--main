// ============================================================
// loadExternalScript.js
// تحميل مكتبة خارجية (CDN) بشكل كسول مع صلابة أعلى ضد مشاكل الشبكة
// المتقطعة (بيئة مصنع/واي فاي غير مستقر) - يُستخدم حالياً بواسطة
// QrScannerView.js (jsQR) و MachineProfileView.js (qrcode).
//
// إصلاح (بند حرج): الكود القديم في كلا الملفين كان بيخزّن الـ Promise
// الخاص بتحميل السكريبت في متغيّر عام (jsQRLoadPromise/qrCodeLoadPromise)
// ويرجّعه في أي استدعاء تالٍ - لكن لو فشل التحميل مرة واحدة (مثلاً
// انقطاع مؤقت في الإنترنت وقت الضغطة الأولى)، كان هذا الـPromise
// المرفوض (rejected) يفضل مخزّن للأبد، فأي محاولة تانية من المستخدم
// (حتى بعد رجوع الإنترنت) كانت بترجع نفس الفشل القديم فوراً من غير
// أي محاولة تحميل شبكة جديدة إطلاقاً - المستخدم كان مضطر يعمل تحديث
// كامل للصفحة (Reload) عشان يقدر يجرّب تاني. الدالة هنا بترجع دايماً
// الحالة الحقيقية: لو فشلت كل المصادر، بترمي الخطأ وتسيب المتغيّر
// فاضي عشان أي استدعاء تالٍ يبدأ محاولة تحميل شبكة جديدة فعلية.
//
// كمان بتجرّب أكتر من مصدر CDN بالتتابع (jsdelivr ثم unpkg) قبل ما
// تستسلم، عشان انقطاع/حجب مصدر واحد بس (زي jsdelivr في بعض الشبكات)
// ميوقفش الميزة بالكامل.
// ============================================================

/**
 * تحميل أول سكريبت شغّال من قائمة مصادر بديلة (نفس المكتبة/الإصدار).
 *
 * @param {string[]} urls - مصادر بديلة بالترتيب (تُجرَّب واحد تلو الآخر)
 * @param {() => any} checkGlobal - دالة ترجع القيمة العامة (window.X) لو
 *   المكتبة اتحمّلت فعلاً (تُستدعى بعد كل محاولة تحميل ناجحة ظاهرياً)
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<any>} - القيمة العامة نفسها (window.X) عند النجاح
 */
export function loadScriptWithFallback(urls, checkGlobal, { timeoutMs = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    let index = 0;

    const alreadyLoaded = checkGlobal();
    if (alreadyLoaded) {
      resolve(alreadyLoaded);
      return;
    }

    function tryNext() {
      if (index >= urls.length) {
        reject(new Error('All script sources failed to load: ' + urls.join(', ')));
        return;
      }

      const url = urls[index++];
      const script = document.createElement('script');
      let settled = false;

      // بعض الشبكات بتعمل "حجب صامت" (الطلب يفضل معلّق من غير أي
      // onerror) بدل رفض صريح - المهلة هنا بتضمن إننا منستناش للأبد
      // وننتقل للمصدر التالي
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        script.remove();
        tryNext();
      }, timeoutMs);

      script.src = url;

      script.onload = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const value = checkGlobal();
        if (value) {
          resolve(value);
        } else {
          // السكريبت اتحمّل لكن المتغيّر العام المتوقع مش موجود
          // (نسخة غير متوافقة/تغيّر في اسم الحزمة) - نجرّب المصدر التالي
          tryNext();
        }
      };

      script.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        script.remove();
        tryNext();
      };

      document.head.appendChild(script);
    }

    tryNext();
  });
}
