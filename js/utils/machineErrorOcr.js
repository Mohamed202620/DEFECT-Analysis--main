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
