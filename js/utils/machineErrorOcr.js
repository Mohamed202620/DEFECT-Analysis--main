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
  const line = normalizeDigits(rawLine)
    .toUpperCase()
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  if (line.length < 4 || HEADER_WORDS.test(line)) return null;

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
export function analyzeAlarmLines(lines, kbEntries = [], { machineType = '' } = {}) {
  const kb = (Array.isArray(kbEntries) ? kbEntries : []).filter(e => e && e.errorCode);
  const scopedKb = machineType
    ? kb.filter(e => !e.machine || String(e.machine) === String(machineType))
    : kb;

  const raw = [];
  lines.forEach((entry, index) => {
    const text = typeof entry === 'string' ? entry : entry.text;
    const confidence = typeof entry === 'string' ? 0 : Number(entry.confidence) || 0;
    if (confidence && confidence < OCR_MIN_LINE_CONFIDENCE) return;
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
    score += c.pattern === 'numeric-dash' ? 12 : 8;
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
  }).sort((a, b) => b.score - a.score);

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
