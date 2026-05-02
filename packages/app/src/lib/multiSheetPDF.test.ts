/**
 * T-VIEW-09: Unit tests for multiSheetPDF — multi-page PDF export.
 * Tests use buildMultiSheetHTML (pure) to avoid DOM/Blob complexity.
 */
import { describe, it, expect } from 'vitest';
import { buildMultiSheetHTML, type PDFSheet } from './multiSheetPDF';

function makeSheets(n: number): PDFSheet[] {
  return Array.from({ length: n }, (_, i) => ({
    title: `Sheet ${i + 1}`,
    sheetNumber: `A-${101 + i}`,
    widthMm: 297,
    heightMm: 210,
  }));
}

describe('T-VIEW-09: multiSheetPDF', () => {
  it('returns a non-empty HTML string for one sheet', () => {
    const html = buildMultiSheetHTML(makeSheets(1));
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('<!DOCTYPE html>');
  });

  it('returns valid HTML for empty sheet array', () => {
    const html = buildMultiSheetHTML([]);
    expect(html).toContain('<!DOCTYPE html>');
  });

  it('generates one sheet-page div per sheet', () => {
    const html = buildMultiSheetHTML(makeSheets(3));
    const matches = html.match(/class="sheet-page"/g);
    expect(matches).toHaveLength(3);
  });

  it('includes sheet numbers in generated HTML', () => {
    const html = buildMultiSheetHTML([{
      title: 'Ground Floor',
      sheetNumber: 'A-101',
      widthMm: 297,
      heightMm: 210,
    }]);
    expect(html).toContain('A-101');
  });

  it('includes index page when includeSheetIndex is true', () => {
    const html = buildMultiSheetHTML(makeSheets(2), { includeSheetIndex: true });
    expect(html).toContain('Drawing Index');
  });

  it('extra sheet-page div for the index page', () => {
    const html = buildMultiSheetHTML(makeSheets(2), { includeSheetIndex: true });
    const matches = html.match(/class="sheet-page"/g);
    // 2 content sheets + 1 index page = 3
    expect(matches).toHaveLength(3);
  });

  it('applies greyscale filter when plotStyle is greyscale', () => {
    const html = buildMultiSheetHTML(makeSheets(1), { plotStyle: 'greyscale' });
    expect(html).toContain('grayscale');
  });

  it('includes SVG content when provided', () => {
    const html = buildMultiSheetHTML([{
      title: 'Floor Plan',
      sheetNumber: 'A-101',
      widthMm: 297,
      heightMm: 210,
      svgContent: '<svg><rect/></svg>',
    }]);
    expect(html).toContain('<svg><rect/></svg>');
  });

  it('colour plotStyle does not apply filter', () => {
    const html = buildMultiSheetHTML(makeSheets(1), { plotStyle: 'colour' });
    expect(html).not.toContain('grayscale');
  });

  it('sheet width and height are embedded in inline style', () => {
    const html = buildMultiSheetHTML([{
      title: 'Plan',
      sheetNumber: 'A-101',
      widthMm: 420,
      heightMm: 297,
    }]);
    expect(html).toContain('width:420mm');
    expect(html).toContain('height:297mm');
  });
});
