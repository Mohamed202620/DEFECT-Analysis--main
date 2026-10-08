const OCR_CONFUSABLE_DIGITS = {
  O: '0',
  Q: '0',
  I: '1',
  L: '1',
  Z: '2',
  S: '5',
  B: '8'
};

function normalizeDigits(text) {
  return String(text || '').replace(/[٠-٩۰-۹]/g, digit => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x6f0 ? code - 0x6f0 : code - 0x660);
  });
}

export function extractErrorCode(rawText) {
  const lines = normalizeDigits(rawText)
    .toUpperCase()
    .split(/\r?\n/)
    .map(line => line.replace(/[‐‑‒–—]/g, '-').trim());

  const patterns = [
    /\b(ERR(?:OR)?|ALM|ALARM|FAULT|FLT)(?:\s*([-_:])\s*|\s+|(?=[0-9OQILZB]))([0-9OQILZB][0-9OQILZSB]{0,4})\b/,
    /\b([A-Z]{1,4})(?:(?:\s*([-_:])\s*|\s+)([0-9OQILZB][0-9OQILZSB]{0,4})|([0-9][0-9OQILZSB]{0,4}))\b/
  ];

  for (const line of lines) {
    for (const [patternIndex, pattern] of patterns.entries()) {
      const match = line.match(pattern);
      if (!match) continue;

      const [, prefix, separator, separatedSuffix, attachedSuffix] = match;
      if (patternIndex === 1 && !separator && !attachedSuffix && prefix.length > 1) continue;
      const rawSuffix = separatedSuffix || attachedSuffix;
      const suffix = rawSuffix.replace(/[OQILZSB]/g, char => OCR_CONFUSABLE_DIGITS[char]);
      if (!/\d/.test(suffix)) continue;
      return `${prefix}${separator === '-' || separator === '_' ? separator : ''}${suffix}`;
    }
  }

  return '';
}

function otsuThreshold(histogram, pixelCount) {
  let totalIntensity = 0;
  for (let i = 0; i < histogram.length; i++) totalIntensity += i * histogram[i];

  let backgroundCount = 0;
  let backgroundIntensity = 0;
  let bestVariance = -1;
  let threshold = 127;

  for (let i = 0; i < histogram.length; i++) {
    backgroundCount += histogram[i];
    if (!backgroundCount) continue;
    const foregroundCount = pixelCount - backgroundCount;
    if (!foregroundCount) break;

    backgroundIntensity += i * histogram[i];
    const backgroundMean = backgroundIntensity / backgroundCount;
    const foregroundMean = (totalIntensity - backgroundIntensity) / foregroundCount;
    const variance = backgroundCount * foregroundCount * (backgroundMean - foregroundMean) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      threshold = i;
    }
  }
  return threshold;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = error => {
      URL.revokeObjectURL(url);
      reject(error);
    };
    image.src = url;
  });
}

export async function prepareOcrImages(file) {
  const image = await loadImage(file);
  const maxDimension = 2400;
  const scale = Math.min(maxDimension / image.width, maxDimension / image.height, 1.5);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Could not create an image-processing canvas');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  const pixelCount = canvas.width * canvas.height;
  const histogram = new Uint32Array(256);
  const luminance = new Uint8Array(pixelCount);

  for (let pixel = 0, offset = 0; pixel < pixelCount; pixel++, offset += 4) {
    const gray = Math.round(
      pixels[offset] * 0.299 +
      pixels[offset + 1] * 0.587 +
      pixels[offset + 2] * 0.114
    );
    luminance[pixel] = gray;
    histogram[gray]++;
  }

  const lowTarget = Math.floor(pixelCount * 0.02);
  const highTarget = Math.floor(pixelCount * 0.98);
  let cumulative = 0;
  let low = 0;
  let high = 255;
  for (let i = 0; i < 256; i++) {
    cumulative += histogram[i];
    if (cumulative >= lowTarget) {
      low = i;
      break;
    }
  }
  cumulative = 0;
  for (let i = 0; i < 256; i++) {
    cumulative += histogram[i];
    if (cumulative >= highTarget) {
      high = i;
      break;
    }
  }
  const contrastRange = Math.max(1, high - low);

  for (let pixel = 0, offset = 0; pixel < pixelCount; pixel++, offset += 4) {
    const gray = Math.max(0, Math.min(255, Math.round((luminance[pixel] - low) * 255 / contrastRange)));
    pixels[offset] = gray;
    pixels[offset + 1] = gray;
    pixels[offset + 2] = gray;
  }
  context.putImageData(imageData, 0, 0);
  const enhanced = canvas.toDataURL('image/png');

  const threshold = otsuThreshold(histogram, pixelCount);
  for (let pixel = 0, offset = 0; pixel < pixelCount; pixel++, offset += 4) {
    const gray = luminance[pixel] > threshold ? 255 : 0;
    pixels[offset] = gray;
    pixels[offset + 1] = gray;
    pixels[offset + 2] = gray;
  }
  context.putImageData(imageData, 0, 0);

  return {
    enhanced,
    thresholded: canvas.toDataURL('image/png')
  };
}

// ============================================================
// تحليل أسطر OCR (Alarm History متعدد الأسطر) + التحقق مقابل قاعدة المعرفة
//
// السبب الحقيقي للنتائج الخاطئة: extractErrorCode كان بياخد "أول سطر" يطابق نمط عام
// (كلمة 1-4 حروف + أرقام) من غير أي اعتبار للثقة، ومالوش نمط للصيغة الفعلية في شاشات
// الأعطال "059-SHEET DELIVERY ..."، فكان بيلتقط ضجيج الأعمدة المقطوعة (زي NE9). وبعدها
// النتيجة كانت بتتكتب مباشرة في الحقول وتتبحث تلقائياً كأنها مؤكدة، ونص OCR الخام كله
// كان بيتحط في خانة الرسالة. الدوال دي pure (بدون DOM/Firebase) عشان تتختبر مباشرة.
// ============================================================

export const OCR_MIN_LINE_CONFIDENCE = 55;   // أقل من كده السطر مايدخلش مرشحين
export const OCR_CONFIRM_CONFIDENCE = 60;    // حد اعتماد النتيجة (مع تطابق KB)
export const OCR_CONFIRM_MARGIN = 12;        // الفرق المطلوب عن أقرب مرشح تاني

const HEADER_WORDS = /^(ALARM(S)?\s*HISTORY|ALARM(S)?|HISTORY|MESSAGE|DESCRIPTION|TIME|DATE|ACK|PAGE|ACTIVE|CLEAR|RESET)\b/;
const MESSAGE_STOP = /\b(AM|PM)\s*$/;

function digitsOnlyFix(token) {
  return token.replace(/[OQILZSB]/g, ch => OCR_CONFUSABLE_DIGITS[ch]);
}

function normalizeKey(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// مفتاح مقارنة متسامح مع التباس 0/O 1/I 5/S 8/B (للمقارنة فقط - مش لاختراع كود)
function confusableKey(value) {
  return digitsOnlyFix(normalizeKey(value));
}

export function cleanOcrMessage(text) {
  const words = String(text || '')
    .replace(/[|_~`^<>{}\[\]\\]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  // نشيل الرموز المفردة والذيل التافه (زي "iil") بدون المساس بالكلمات الحقيقية
  while (words.length && (words[words.length - 1].length <= 2 && !/^\d+$/.test(words[words.length - 1]) || /^[^A-Za-z0-9]+$/.test(words[words.length - 1]))) {
    words.pop();
  }
  const joined = words.join(' ').replace(/^[-–—:.\s]+/, '').trim();
  return joined;
}

function messageLooksReal(message) {
  const letters = (message.match(/[A-Za-z]/g) || []).length;
  if (message.length < 6 || letters / message.length < 0.6) return false;
  return message.split(/\s+/).filter(w => w.length >= 2).length >= 2;
}

function tokenSet(text) {
  return new Set(
    String(text || '').toUpperCase().split(/[^A-Z0-9]+/).filter(w => w.length >= 3)
  );
}

export function messageSimilarity(a, b) {
  const A = tokenSet(a);
  const B = tokenSet(b);
  if (!A.size || !B.size) return 0;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return shared / Math.max(A.size, B.size);
}

// تحليل سطر واحد -> مرشح أو null
export function parseAlarmLine(rawLine) {
  let line = normalizeDigits(rawLine)
    .toUpperCase()
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  if (line.length < 4 || HEADER_WORDS.test(line)) return null;

  // عمود الوقت في سجل الأعطال ("30 AM" / "10:30 AM" / تاريخ + وقت) ملوش علاقة بالكود،
  // ولو فضل ممكن يتقري "30" كأنه كود
  line = line.replace(/^(?:\d{1,4}[\/.-]\d{1,2}[\/.-]\d{1,4}\s+)?(?:\d{1,2}(?:[:.]\d{2}){0,2}\s*)?(?:AM|PM)\b\s*/, '').trim();
  if (line.length < 4) return null;

  // 1) "059-SHEET DELIVERY DID NOT GET SHEET" (الصيغة الفعلية لشاشات الإنذارات)
  let m = line.match(/(?:^|\s)([0-9OQILZSB]{2,5})\s?-\s?([A-Z][A-Z0-9 ,/'.()&-]{4,})$/);
  if (m) {
    const code = digitsOnlyFix(m[1]);
    // الكود لازم يبقى فيه رقم حقيقي في الأصل (مش كلمة زي "BIZ")
    if (/\d/.test(m[1]) && /^\d{2,5}$/.test(code)) {
      const message = cleanOcrMessage(m[2]);
      if (messageLooksReal(message)) return { code, message, pattern: 'numeric-dash' };
    }
  }

  // 1b) نفس الصيغة لكن الشرطة اتفقدت في الـ OCR ("059 SHEET DELIVERY ..."): الشرطة الرفيعة
  // بتضيع كتير. لازم الكود في أول السطر، وغالباً بيتقبل كمرشح مراجعة بس (بدون مطابقة KB)
  m = line.match(/^([0-9OQILZSB]{2,5})\s+([A-Z][A-Z0-9 ,/'.()&-]{4,})$/);
  if (m) {
    const code = digitsOnlyFix(m[1]);
    if (/\d/.test(m[1]) && /^\d{2,5}$/.test(code)) {
      const message = cleanOcrMessage(m[2]);
      if (messageLooksReal(message)) return { code, message, pattern: 'numeric-space' };
    }
  }

  // 2) بادئة صريحة: ERR 204 / ALM-12 / FAULT 108 / E05
  m = line.match(/(?:^|\s)(ERR(?:OR)?|ALM|ALARM|FAULT|FLT|E|F)\s?[-_:]?\s?([0-9OQILZSB]{1,5})(?=\s|$|-|:)\s*[-:]?\s*(.*)$/);
  if (m && /\d/.test(m[2])) {
    const suffix = digitsOnlyFix(m[2]);
    if (/^\d{1,5}$/.test(suffix)) {
      const prefix = m[1] === 'ERROR' ? 'ERR' : m[1];
      return { code: `${prefix}${suffix}`, message: cleanOcrMessage(m[3]), pattern: 'prefixed' };
    }
  }

  return null;
}

// تحليل كل الأسطر. lines: [{ text, confidence }]. kbEntries: [{ errorCode, errorMessage, machine }]
// minLineConfidence: حد استبعاد الأسطر ضعيفة القراءة. في "السطر المحدد" بالمستخدم بنخفضه
// (المستخدم اختار السطر بنفسه) فيظهر كمرشح مراجعة بثقته الحقيقية بدل ما يختفي - والاعتماد
// التلقائي لسه محتاج ثقة OCR_CONFIRM_CONFIDENCE + مطابقة KB. allowLoose: يسمح بمرشحين
// صيغة "059 SHEET..." (بدون شرطة) حتى لو مش في الـ KB؛ غير كده بيتقبلوا لو في الـ KB بس.
export function analyzeAlarmLines(lines, kbEntries = [], { machineType = '', minLineConfidence = OCR_MIN_LINE_CONFIDENCE, allowLoose = false } = {}) {
  const kb = (Array.isArray(kbEntries) ? kbEntries : []).filter(e => e && e.errorCode);
  const scopedKb = machineType
    ? kb.filter(e => !e.machine || String(e.machine) === String(machineType))
    : kb;

  const raw = [];
  lines.forEach((entry, index) => {
    const text = typeof entry === 'string' ? entry : entry.text;
    const confidence = typeof entry === 'string' ? 0 : Number(entry.confidence) || 0;
    if (confidence && confidence < minLineConfidence) return;
    const parsed = parseAlarmLine(text);
    if (parsed) raw.push({ ...parsed, lineIndex: index, confidence, lineText: String(text).trim() });
  });

  // تجميع حسب الكود (نفس الإنذار بيتكرر في التاريخ) - ونحتفظ بأعلى ثقة وأقرب سطر للأعلى
  const byCode = new Map();
  for (const c of raw) {
    const key = confusableKey(c.code);
    const prev = byCode.get(key);
    if (!prev) {
      byCode.set(key, { ...c, occurrences: 1 });
    } else {
      prev.occurrences++;
      if (c.confidence > prev.confidence) {
        prev.confidence = c.confidence;
        if (c.message.length >= prev.message.length) prev.message = c.message;
        prev.code = c.code;
      }
    }
  }

  const candidates = [...byCode.values()].map(c => {
    // مطابقة KB: بالكود (متسامح مع الالتباس)، أو بتشابه الرسالة لو الكود نفسه اتقرا غلط
    const byCodeMatch = scopedKb.filter(e => confusableKey(e.errorCode) === confusableKey(c.code));
    let kbMatch = byCodeMatch[0] || null;
    let kbBy = kbMatch ? 'code' : '';
    if (kbMatch && byCodeMatch.length > 1 && c.message) {
      kbMatch = byCodeMatch
        .map(e => ({ e, s: messageSimilarity(c.message, e.errorMessage) }))
        .sort((a, b) => b.s - a.s)[0].e;
    }
    if (!kbMatch && c.message) {
      const best = scopedKb
        .map(e => ({ e, s: messageSimilarity(c.message, e.errorMessage) }))
        .sort((a, b) => b.s - a.s)[0];
      if (best && best.s >= 0.75) { kbMatch = best.e; kbBy = 'message'; }
    }

    const baseConfidence = c.confidence || 60;
    let score = baseConfidence;
    score += c.pattern === 'numeric-dash' ? 12 : (c.pattern === 'numeric-space' ? 6 : 8);
    score += Math.min(10, (c.occurrences - 1) * 5);
    score += Math.max(0, 6 - c.lineIndex);            // ميل بسيط للأحدث (الأعلى) - مش حاسم
    if (kbMatch) score += kbBy === 'code' ? 40 : 25;

    return {
      code: kbMatch ? String(kbMatch.errorCode).toUpperCase() : c.code,   // من الـ KB فقط، لا اختراع
      ocrCode: c.code,
      message: c.message,
      confidence: Math.round(baseConfidence),
      score: Math.round(score),
      pattern: c.pattern,
      occurrences: c.occurrences,
      lineIndex: c.lineIndex,
      inKb: !!kbMatch,
      kbBy,
      kbMessage: kbMatch ? (kbMatch.errorMessage || '') : ''
    };
  }).filter(c => allowLoose || c.pattern !== 'numeric-space' || c.inKb)
    .sort((a, b) => b.score - a.score);

  // قرار الاعتماد: مرشح KB واحد واضح فقط (ثقة كافية + فارق عن التاني). غير كده = Needs Review
  let status = candidates.length ? 'review' : 'none';
  let selected = null;
  if (candidates.length) {
    const [top, second] = candidates;
    const margin = second ? top.score - second.score : Infinity;
    const effective = top.kbBy === 'message' ? Math.max(top.confidence, 0) : top.confidence;
    // في Alarm History الأحدث غالباً في الأعلى: لا نعتمد كود من سطر أدنى لو فيه مرشح
    // أعلى منه (حتى لو مجهول للـ KB) - ده قرار للمستخدم، مش للـ OCR
    const isTopmost = candidates.every(c => c === top || top.lineIndex <= c.lineIndex);
    if (top.inKb && isTopmost && effective >= OCR_CONFIRM_CONFIDENCE && margin >= OCR_CONFIRM_MARGIN) {
      status = 'confirmed';
      selected = top;
    }
  }

  return { status, selected, candidates };
}

// ============================================================
// قراءة منطقة محددة بواسطة المستخدم (سطر واحد من سجل الأعطال)
//
// سجل Alarm History كله أعطال حقيقية، والعامل وحده يعرف أيها يقصد، فبدل تخمين السطر
// بنخليه يحدد مستطيل حوله، ونقرأ المقطع ده بس (مكبّر ومعالج لوحده) بوضع سطر واحد.
// الإحداثيات كلها نسب (0..1) من أبعاد الصورة المعروضة، فمستقلة عن حجم الشاشة.
// ============================================================

export const DEFAULT_CROP_RECT = Object.freeze({ x: 0.05, y: 0.38, w: 0.9, h: 0.08 });
export const MIN_CROP_W = 0.1;
export const MIN_CROP_H = 0.025;

export function clampCropRect(rect) {
  const num = (v, fallback) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
  let w = Math.min(1, Math.max(MIN_CROP_W, num(rect?.w, DEFAULT_CROP_RECT.w)));
  let h = Math.min(1, Math.max(MIN_CROP_H, num(rect?.h, DEFAULT_CROP_RECT.h)));
  const x = Math.min(1 - w, Math.max(0, num(rect?.x, DEFAULT_CROP_RECT.x)));
  const y = Math.min(1 - h, Math.max(0, num(rect?.y, DEFAULT_CROP_RECT.y)));
  return { x, y, w, h };
}

// يختار من أسطر المقطع السطر الأقرب لمركزه الرأسي والذي يُفهم كعطل. السطر المجاور
// المقصوص جزئياً (بسبب حدود المستطيل) بيبقى أبعد عن المركز فمايتاخدش.
// lines: [{ text, confidence, bbox?: { y0, y1 } }]، heightPx: ارتفاع صورة المقطع.
export function pickLineNearCenter(lines, heightPx) {
  const list = Array.isArray(lines) ? lines : [];
  if (!list.length) return [];
  const withBox = list.filter(l => l && l.bbox && Number.isFinite(l.bbox.y0) && Number.isFinite(l.bbox.y1));
  // لو المكتبة ما رجّعتش إحداثيات، نسيب كل الأسطر للتحليل العادي
  if (!withBox.length || !Number.isFinite(heightPx)) return list;
  const center = heightPx / 2;
  const ranked = withBox
    .map(l => ({ l, d: Math.abs((l.bbox.y0 + l.bbox.y1) / 2 - center) }))
    .sort((a, b) => a.d - b.d);
  for (const { l } of ranked) {
    if (parseAlarmLine(l.text)) return [l];
  }
  return [];
}

// يحدد شريط السطر الأقرب لمركز المقطع بإسقاط أفقي للحبر (كل صف: نسبة البكسل الغامق)،
// فلو مستطيل المستخدم غطّى شرائح من الصفوف المجاورة بتتشال قبل الـ OCR بدل ما تتدمج
// في نص مشوّش. بترجّع { top, bottom } (شامل) أو null لو مفيش تمييز واضح.
export function findCenterTextBand(rowInk) {
  const n = rowInk.length;
  if (n < 8) return null;
  const smooth = new Float32Array(n);
  for (let y = 0; y < n; y++) {
    let sum = 0, c = 0;
    for (let k = -1; k <= 1; k++) { const yy = y + k; if (yy >= 0 && yy < n) { sum += rowInk[yy]; c++; } }
    smooth[y] = sum / c;
  }
  let peak = 0;
  for (let y = 0; y < n; y++) if (smooth[y] > peak) peak = smooth[y];
  if (peak < 0.03) return null;
  const cutoff = Math.max(0.2 * peak, 0.015);
  const gapTolerance = Math.max(2, Math.round(n * 0.03));

  const bands = [];
  let cur = null;
  for (let y = 0; y < n; y++) {
    if (smooth[y] >= cutoff) {
      if (cur && y - cur.bottom <= gapTolerance + 1) cur.bottom = y;
      else { cur = { top: y, bottom: y }; bands.push(cur); }
    }
  }
  if (!bands.length) return null;
  const tallest = Math.max(...bands.map(b => b.bottom - b.top + 1));
  // شرائح الصفوف المجاورة المقصوصة قصيرة جداً مقارنة بالسطر الكامل
  const solid = bands.filter(b => (b.bottom - b.top + 1) >= tallest * 0.45);
  const center = (n - 1) / 2;
  const dist = b => (b.top <= center && center <= b.bottom) ? 0 : Math.min(Math.abs(b.top - center), Math.abs(b.bottom - center));
  solid.sort((a, b) => dist(a) - dist(b));
  const chosen = solid[0];
  if (!chosen) return null;
  // الفجوة لأقرب شريط تاني (حتى الشرائح الجزئية) - عشان الهامش مايتوسعش فوق الصف المجاور
  let gapAbove = Infinity;
  let gapBelow = Infinity;
  for (const b of bands) {
    if (b === chosen) continue;
    if (b.bottom < chosen.top) gapAbove = Math.min(gapAbove, chosen.top - b.bottom - 1);
    else if (b.top > chosen.bottom) gapBelow = Math.min(gapBelow, b.top - chosen.bottom - 1);
  }
  return { top: chosen.top, bottom: chosen.bottom, gapAbove, gapBelow };
}

// ------------------------------------------------------------
// معالجة بكسلات (pure - بدون DOM) عشان تتختبر مباشرة
// ------------------------------------------------------------

// متوسط محلي (Box blur) بالصورة التكاملية: O(n) مهما كان نصف القطر
export function boxMean(src, w, h, rx, ry) {
  const W = w + 1;
  const integral = new Float64Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += src[y * w + x];
      integral[(y + 1) * W + (x + 1)] = integral[y * W + (x + 1)] + rowSum;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - ry);
    const y1 = Math.min(h, y + ry + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - rx);
      const x1 = Math.min(w, x + rx + 1);
      const area = (x1 - x0) * (y1 - y0);
      const sum = integral[y1 * W + x1] - integral[y0 * W + x1] - integral[y1 * W + x0] + integral[y0 * W + x0];
      out[y * w + x] = sum / area;
    }
  }
  return out;
}

// يحوّل أي صورة رمادية لـ "نص غامق على خلفية بيضاء" ثابتة الإضاءة:
// 1) يطرح الخلفية المحلية (بيشيل انحدار الإضاءة/اللمعان زي أسفل شاشتك الباهت)
// 2) يحدد قطبية النص (فاتح أو غامق) من الجهة ذات الذيل الأقوى (النص تباينه أعلى من الخلفية)
// 3) يمط التباين بحيث الخلفية = 255 والنص = 0
export function normalizeForOcr(lum, w, h, { rx, ry } = {}) {
  const count = w * h;
  const meanX = Math.max(2, Math.round(rx || w / 6));
  const meanY = Math.max(2, Math.round(ry || h / 3));
  // تكرار البكسلات الحدّية قبل التمويه: النافذة المقصوصة عند الحافة كانت بتحرّف تقدير الخلفية
  // (وبالتالي بتظهر حبر وهمي على أطراف المقطع)
  const pw = w + meanX * 2;
  const ph = h + meanY * 2;
  const padded = new Uint8Array(pw * ph);
  for (let y = 0; y < ph; y++) {
    const sy = Math.min(h - 1, Math.max(0, y - meanY));
    for (let x = 0; x < pw; x++) {
      const sx = Math.min(w - 1, Math.max(0, x - meanX));
      padded[y * pw + x] = lum[sy * w + sx];
    }
  }
  const paddedMean = boxMean(padded, pw, ph, meanX, meanY);
  const mean = new Float32Array(count);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) mean[y * w + x] = paddedMean[(y + meanY) * pw + (x + meanX)];
  }

  const diff = new Float32Array(count);
  const pos = [];
  const neg = [];
  for (let i = 0; i < count; i++) {
    const d = lum[i] - mean[i];
    diff[i] = d;
    if (d > 0) pos.push(d); else if (d < 0) neg.push(-d);
  }
  const tail = arr => {
    if (!arr.length) return 0;
    arr.sort((a, b) => a - b);
    return arr[Math.min(arr.length - 1, Math.floor(arr.length * 0.995))];
  };
  const posTail = tail(pos);
  const negTail = tail(neg);
  const textIsBright = posTail > negTail;
  const scale = Math.max(8, textIsBright ? posTail : negTail);

  const out = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const ink = textIsBright ? diff[i] : -diff[i];       // قوة "النص" في البكسل
    // منطقة ميتة 10% من تباين النص: تمسح انحياز تقدير الخلفية وضجيج الحبيبات الخفيف
    const v = 255 - Math.max(0, Math.min(255, ((ink - scale * 0.1) / (scale * 0.9)) * 255));
    out[i] = v;
  }
  return { gray: out, textIsBright, contrast: scale };
}

// صفوف الحبر لتحديد شريط السطر (النص غامق: قيمة أقل من 128 تقريباً بعد التسوية)
function rowInkOf(gray, w, h) {
  const rowInk = new Float32Array(h);
  for (let y = 0; y < h; y++) {
    let ink = 0;
    for (let x = 0; x < w; x++) if (gray[y * w + x] < 128) ink++;
    rowInk[y] = ink / w;
  }
  return rowInk;
}

function toLuminance(px, count) {
  const lum = new Uint8Array(count);
  for (let i = 0, o = 0; i < count; i++, o += 4) {
    lum[i] = Math.round(px[o] * 0.299 + px[o + 1] * 0.587 + px[o + 2] * 0.114);
  }
  return lum;
}

function grayToDataUrl(gray, w, h, pad) {
  const out = document.createElement('canvas');
  out.width = w + pad * 2;
  out.height = h + pad * 2;
  const octx = out.getContext('2d', { willReadFrequently: true });
  octx.fillStyle = '#fff';
  octx.fillRect(0, 0, out.width, out.height);
  const tmp = document.createElement('canvas');
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext('2d', { willReadFrequently: true });
  const img = tctx.getImageData(0, 0, w, h);
  for (let i = 0, o = 0; i < w * h; i++, o += 4) {
    img.data[o] = img.data[o + 1] = img.data[o + 2] = gray[i];
    img.data[o + 3] = 255;
  }
  tctx.putImageData(img, 0, 0);
  octx.drawImage(tmp, pad, pad);
  return out.toDataURL('image/png');
}

const TARGET_INK_HEIGHT = 44;   // ارتفاع النص المثالي لـ Tesseract (بكسل) بعد التكبير

// قراءة منطقة السطر المحدد بمرحلتين:
//  (1) مرور خفيف لتحديد شريط السطر الأوسط (مع تسوية الإضاءة) وقياس ارتفاع الحرف الحقيقي
//  (2) إعادة القص من الصورة الأصلية على الشريط فقط وبمقياس يخلّي ارتفاع الحرف ~44px
//      (التكبير الثابت القديم كان بيطلع الحرف أصغر/أكبر من اللازم حسب حجم الصورة والمستطيل)
// بترجّع نسختين: رمادية مسوّاة (enhanced) وثنائية (thresholded)، وارتفاع الصورة النهائية.
export async function prepareRegionImages(file, rect) {
  const image = await loadImage(file);
  const r = clampCropRect(rect);
  const sx = Math.round(r.x * image.width);
  const sy = Math.round(r.y * image.height);
  const sw = Math.max(1, Math.round(r.w * image.width));
  const sh = Math.max(1, Math.round(r.h * image.height));

  const draw = (srcY, srcH, scale) => {
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(srcH * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Could not create an image-processing canvas');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, sx, srcY, sw, srcH, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    return { w, h, lum: toLuminance(data, w * h) };
  };

  // (1) مرور تحديد الشريط
  const scale1 = Math.min(2, Math.max(0.5, 1200 / sw), Math.max(1, 120 / sh));
  const p1 = draw(sy, sh, scale1);
  const n1 = normalizeForOcr(p1.lum, p1.w, p1.h, { rx: p1.w / 6, ry: Math.max(3, p1.h * 0.35) });
  const band = findCenterTextBand(rowInkOf(n1.gray, p1.w, p1.h));

  let srcTop = sy;
  let srcHeight = sh;
  let inkHeightSrc = sh * 0.6;
  if (band) {
    inkHeightSrc = Math.max(4, (band.bottom - band.top + 1) / scale1);
    const wanted = inkHeightSrc * 0.35;
    // الهامش مايتجاوزش نص الفجوة لأقرب سطر مجاور (بدون ما يسرّب حبر منه)
    const marginTop = Math.min(wanted, Number.isFinite(band.gapAbove) ? Math.max(0, (band.gapAbove / scale1) / 2 - 1) : wanted);
    const marginBottom = Math.min(wanted, Number.isFinite(band.gapBelow) ? Math.max(0, (band.gapBelow / scale1) / 2 - 1) : wanted);
    srcTop = Math.max(0, Math.round(sy + band.top / scale1 - marginTop));
    const srcBottom = Math.min(image.height, Math.round(sy + (band.bottom + 1) / scale1 + marginBottom));
    srcHeight = Math.max(1, srcBottom - srcTop);
  }

  // (2) القص النهائي بمقياس يناسب حجم الحرف
  const scale2 = Math.min(5, Math.max(0.5, TARGET_INK_HEIGHT / inkHeightSrc), 3200 / sw);
  const p2 = draw(srcTop, srcHeight, scale2);
  const inkH2 = Math.max(8, inkHeightSrc * scale2);
  const n2 = normalizeForOcr(p2.lum, p2.w, p2.h, { rx: Math.max(6, inkH2 * 4), ry: Math.max(4, inkH2 * 1.2) });

  const hist = new Uint32Array(256);
  for (let i = 0; i < n2.gray.length; i++) hist[n2.gray[i]]++;
  const threshold = otsuThreshold(hist, n2.gray.length);
  const binary = new Uint8Array(n2.gray.length);
  for (let i = 0; i < binary.length; i++) binary[i] = n2.gray[i] > threshold ? 255 : 0;

  const pad = Math.max(16, Math.round(p2.h * 0.3));
  return {
    enhanced: grayToDataUrl(n2.gray, p2.w, p2.h, pad),
    thresholded: grayToDataUrl(binary, p2.w, p2.h, pad),
    height: p2.h + pad * 2
  };
}

// ============================================================
// مطابقة تقريبية مع قاموس الـ KB (lexicon) عندما تفشل قراءة السطر
//
// لما الصورة ضعيفة (انعكاس/ميل/إضاءة) الـ OCR بيطلع نص مشوّه ("M 79-8 DELIVERY UID" بدل
// "059-SHEET DELIVERY DID NOT GET SHEET"). لكن المفردات المحتملة محدودة: رسائل أعطال
// الماكينة المختارة في الـ KB. فبنقارن النص المشوّه بكل رسائل الـ KB بتشابه على مستوى
// الحرف (Levenshtein) ونقدّم أقرب 3 كاقتراحات للمستخدم يختار منها. الكود دايماً من الـ KB
// نفسه (مفيش اختراع)، والاقتراح مابيتعتمدش تلقائياً أبداً.
// ============================================================

export function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = new Array(n + 1);
  let cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

function wordSimilarity(a, b) {
  const longest = Math.max(a.length, b.length);
  return longest ? 1 - levenshtein(a, b) / longest : 0;
}

// تمييز لاتيني فقط (الحروف العربية الهلوسة من النموذج مالهاش قيمة هنا) + توحيد الالتباس
function latinWords(text) {
  return String(text || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .split(' ')
    .filter(w => w.length >= 2);
}

// نسبة تغطية رسالة KB بكلمات النص المقروء، مرجّحة بطول الكلمة
export function messageCoverage(ocrWords, kbMessage) {
  const kbWords = latinWords(kbMessage).filter(w => w.length >= 3);
  if (!kbWords.length || !ocrWords.length) return 0;
  let total = 0;
  let got = 0;
  for (const kw of kbWords) {
    total += kw.length;
    let best = 0;
    for (const ow of ocrWords) {
      const sim = wordSimilarity(ow, kw);
      if (sim > best) best = sim;
    }
    if (best >= 0.6) got += kw.length * best;
  }
  return total ? got / total : 0;
}

export function suggestKbMatches(texts, kbEntries = [], { machineType = '', limit = 3, minScore = 0.3, excludeCodes = [] } = {}) {
  const kb = (Array.isArray(kbEntries) ? kbEntries : []).filter(e => e && e.errorCode && e.errorMessage);
  const scoped = machineType ? kb.filter(e => !e.machine || String(e.machine) === String(machineType)) : kb;
  const ocrWords = [...new Set((Array.isArray(texts) ? texts : [texts]).flatMap(latinWords))];
  if (!ocrWords.length || !scoped.length) return [];
  const exclude = new Set(excludeCodes.map(c => confusableKey(c)));
  const seen = new Set();

  const scored = [];
  for (const e of scoped) {
    const key = confusableKey(e.errorCode);
    if (exclude.has(key) || seen.has(key)) continue;
    const similarity = messageCoverage(ocrWords, e.errorMessage);
    if (similarity < minScore) continue;
    seen.add(key);
    scored.push({
      code: String(e.errorCode).toUpperCase(),
      ocrCode: '',
      message: e.errorMessage,
      kbMessage: e.errorMessage,
      confidence: Math.round(similarity * 100),
      score: Math.round(similarity * 100),
      pattern: 'kb-fuzzy',
      occurrences: 1,
      lineIndex: 99,
      inKb: true,
      kbBy: 'fuzzy',
      suggested: true
    });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
