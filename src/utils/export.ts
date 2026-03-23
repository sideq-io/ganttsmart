import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

/**
 * Temporarily removes overflow clipping so the full scrollable
 * content is captured, then restores original styles.
 */
async function captureAsDataUrl(element: HTMLElement): Promise<string> {
  const origOverflow = element.style.overflow;
  const origOverflowX = element.style.overflowX;
  const origWidth = element.style.width;
  const origMaxWidth = element.style.maxWidth;

  element.style.overflow = 'visible';
  element.style.overflowX = 'visible';
  element.style.width = element.scrollWidth + 'px';
  element.style.maxWidth = 'none';

  try {
    const dataUrl = await toPng(element, {
      pixelRatio: 2,
      width: element.scrollWidth,
      height: element.scrollHeight,
      backgroundColor: getComputedStyle(element).backgroundColor || '#161b22',
    });
    return dataUrl;
  } finally {
    element.style.overflow = origOverflow;
    element.style.overflowX = origOverflowX;
    element.style.width = origWidth;
    element.style.maxWidth = origMaxWidth;
  }
}

export async function exportAsPng(element: HTMLElement): Promise<void> {
  const dataUrl = await captureAsDataUrl(element);

  const link = document.createElement('a');
  link.download = `gantt-${new Date().toISOString().slice(0, 10)}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function exportAsPdf(element: HTMLElement): Promise<void> {
  const dataUrl = await captureAsDataUrl(element);

  // Load image to get dimensions
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load captured image'));
    img.src = dataUrl;
  });

  const pdfWidth = img.width / 2;
  const pdfHeight = img.height / 2;

  const pdf = new jsPDF({
    orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
    unit: 'px',
    format: [pdfWidth, pdfHeight],
  });

  pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
  pdf.save(`gantt-${new Date().toISOString().slice(0, 10)}.pdf`);
}
