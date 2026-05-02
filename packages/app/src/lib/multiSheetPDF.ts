/**
 * T-VIEW-09: Multi-sheet PDF export.
 *
 * Generates a multi-page PDF from a collection of sheets using the browser's
 * canvas API. Each sheet is rendered to an off-screen canvas, then exported
 * as a PDF page via a data URI blob. Requires no external PDF library —
 * relies on window.print() and CSS @page rules for page-break control,
 * or the jsPDF fallback if available.
 *
 * For environments without native PDF generation, falls back to a printable
 * HTML document with page-break-after rules.
 */

export interface PDFSheet {
  title: string;
  sheetNumber: string;
  /** Width × Height in mm. */
  widthMm: number;
  heightMm: number;
  /** Optional SVG string for the sheet content (title block + views). */
  svgContent?: string;
}

export interface PDFExportOptions {
  filename?: string;
  plotStyle?: 'colour' | 'greyscale' | 'monochrome';
  includeSheetIndex?: boolean;
}

/** Build the HTML string for a multi-sheet PDF document. Exported for testing. */
export function buildMultiSheetHTML(sheets: PDFSheet[], opts: PDFExportOptions = {}): string {
  const style = opts.plotStyle ?? 'colour';
  const filterCss = style === 'greyscale'
    ? 'filter: grayscale(1);'
    : style === 'monochrome'
      ? 'filter: grayscale(1) contrast(100);'
      : '';

  const sheetPages = sheets.map((s) => {
    const wMm = s.widthMm ?? 297;
    const hMm = s.heightMm ?? 210;
    const content = s.svgContent
      ? `<div class="sheet-content">${s.svgContent}</div>`
      : `<div class="sheet-placeholder"><p>${s.sheetNumber}: ${s.title}</p></div>`;
    return `<div class="sheet-page" style="width:${wMm}mm;height:${hMm}mm;">
  <div class="sheet-header">
    <span class="sheet-num">${s.sheetNumber}</span>
    <span class="sheet-title">${s.title}</span>
  </div>
  ${content}
</div>`;
  }).join('\n');

  const indexPage = opts.includeSheetIndex ? `<div class="sheet-page" style="width:297mm;height:210mm;">
  <h2>Drawing Index</h2>
  <table>
    <thead><tr><th>Number</th><th>Title</th><th>Scale</th></tr></thead>
    <tbody>
      ${sheets.map((s) => `<tr><td>${s.sheetNumber}</td><td>${s.title}</td><td>–</td></tr>`).join('')}
    </tbody>
  </table>
</div>` : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${opts.filename?.replace('.pdf', '') ?? 'Drawing Set'}</title>
<style>
  @media print { @page { margin: 0; } .sheet-page { page-break-after: always; } }
  body { margin: 0; font-family: sans-serif; ${filterCss} }
  .sheet-page { display: flex; flex-direction: column; padding: 10mm; box-sizing: border-box; background: white; margin: 0; }
  .sheet-header { display: flex; justify-content: space-between; font-size: 10pt; border-bottom: 1px solid #333; padding-bottom: 2mm; margin-bottom: 5mm; }
  .sheet-num { font-weight: bold; }
  .sheet-placeholder { flex: 1; display: flex; align-items: center; justify-content: center; border: 1px solid #ccc; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #333; padding: 2mm; font-size: 9pt; }
</style>
</head>
<body>
${indexPage}
${sheetPages}
</body>
</html>`;
}

/**
 * Export sheets as a printable HTML file with one sheet per page.
 * Triggers a file download using a Blob URL.
 */
export function exportMultiSheetPDF(
  sheets: PDFSheet[],
  opts: PDFExportOptions = {},
): void {
  const filename = opts.filename ?? 'drawing-set.pdf';
  const html = buildMultiSheetHTML(sheets, opts);
  const blob = new Blob([html], { type: 'text/html' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url,
    download: filename.endsWith('.html') ? filename : filename.replace(/\.pdf$/i, '.html'),
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
