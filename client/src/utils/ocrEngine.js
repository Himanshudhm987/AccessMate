import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.0.379'}/pdf.worker.min.mjs`;
}

// Worker cache to prevent wasteful re-downloads
let activeWorker = null;
let activeLang = null;

/**
 * Preprocesses image on a canvas for enhanced Hindi/English OCR.
 * Preserves delicate Devanagari matras, anusvara, and diacritics.
 */
export async function preprocessImage(imageElement, options = {}) {
  const {
    grayscale = true,
    contrast = 25,
    binarize = false,
    sharpen = false,
    rotation = 0
  } = options;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  let width = imageElement.naturalWidth || imageElement.width || 800;
  let height = imageElement.naturalHeight || imageElement.height || 600;

  // Handle rotation
  if (rotation === 90 || rotation === 270) {
    canvas.width = height;
    canvas.height = width;
  } else {
    canvas.width = width;
    canvas.height = height;
  }

  ctx.save();
  if (rotation === 90) {
    ctx.translate(height, 0);
    ctx.rotate((90 * Math.PI) / 180);
  } else if (rotation === 180) {
    ctx.translate(width, height);
    ctx.rotate((180 * Math.PI) / 180);
  } else if (rotation === 270) {
    ctx.translate(0, width);
    ctx.rotate((270 * Math.PI) / 180);
  }

  ctx.drawImage(imageElement, 0, 0, width, height);
  ctx.restore();

  if (!grayscale && contrast === 0 && !binarize && !sharpen) {
    return canvas;
  }

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  // Contrast factor calculation
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    if (grayscale) {
      // Luminance weights (Rec. 709)
      const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = gray;
      g = gray;
      b = gray;
    }

    if (contrast !== 0) {
      r = Math.min(255, Math.max(0, factor * (r - 128) + 128));
      g = Math.min(255, Math.max(0, factor * (g - 128) + 128));
      b = Math.min(255, Math.max(0, factor * (b - 128) + 128));
    }

    if (binarize) {
      // Conservative threshold preserving thin Hindi matras
      const val = (r + g + b) / 3;
      const threshold = 135;
      const finalVal = val > threshold ? 255 : 0;
      r = finalVal;
      g = finalVal;
      b = finalVal;
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }

  ctx.putImageData(imgData, 0, 0);

  // Optional mild 3x3 convolution sharpening
  if (sharpen) {
    const sharpCanvas = document.createElement('canvas');
    sharpCanvas.width = canvas.width;
    sharpCanvas.height = canvas.height;
    const sharpCtx = sharpCanvas.getContext('2d');
    sharpCtx.drawImage(canvas, 0, 0);

    const src = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const dst = sharpCtx.createImageData(canvas.width, canvas.height);
    const s = src.data;
    const d = dst.data;
    const w = canvas.width;
    const h = canvas.height;

    const kernel = [
       0, -0.5,  0,
      -0.5,  3, -0.5,
       0, -0.5,  0
    ];

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let acc = 0;
        let ki = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * w + (x + kx)) * 4;
            acc += s[idx] * kernel[ki++];
          }
        }
        const outIdx = (y * w + x) * 4;
        const clamped = Math.min(255, Math.max(0, acc));
        d[outIdx] = clamped;
        d[outIdx + 1] = clamped;
        d[outIdx + 2] = clamped;
        d[outIdx + 3] = 255;
      }
    }
    return sharpCanvas;
  }

  return canvas;
}

/**
 * Renders a PDF page to a canvas with 2.0x DPI scale for optimal OCR clarity.
 */
export async function renderPdfPageToCanvas(pdfArrayBuffer, pageNumber = 1) {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: pdfArrayBuffer });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    const page = await pdf.getPage(Math.min(Math.max(1, pageNumber), numPages));
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

    return {
      canvas,
      numPages,
      currentPage: pageNumber
    };
  } catch (err) {
    console.error('[PDF] Error rendering page:', err);
    throw new Error(`Failed to render PDF: ${err.message}`);
  }
}

/**
 * Reusable worker instance manager for Tesseract.js
 */
export async function getOcrWorker(lang = 'eng+hin', onProgress = () => {}) {
  // If active worker exists and language matches, reuse it!
  if (activeWorker && activeLang === lang) {
    return activeWorker;
  }

  if (activeWorker) {
    try {
      await activeWorker.terminate();
    } catch (e) {
      console.warn('[OCR] Error terminating previous worker:', e);
    }
    activeWorker = null;
    activeLang = null;
  }

  const worker = await createWorker(lang, 1, {
    logger: m => {
      if (m.status === 'recognizing text') {
        onProgress({ phase: 'recognizing', progress: Math.round(m.progress * 100), status: 'Recognizing text…' });
      } else {
        onProgress({ phase: 'loading', progress: 0, status: m.status });
      }
    }
  });

  activeWorker = worker;
  activeLang = lang;
  return activeWorker;
}

/**
 * Perform recognition on image or canvas
 */
export async function performOcr(imageOrCanvas, lang = 'eng+hin', onProgress = () => {}) {
  const worker = await getOcrWorker(lang, onProgress);
  const result = await worker.recognize(imageOrCanvas);

  return {
    text: result.data.text.trim(),
    confidence: Math.round(result.data.confidence || 0),
    words: result.data.words || [],
    lines: result.data.lines || []
  };
}

/**
 * Terminate cached worker on unmount
 */
export async function cleanupOcrWorker() {
  if (activeWorker) {
    try {
      await activeWorker.terminate();
    } catch {}
    activeWorker = null;
    activeLang = null;
  }
}
