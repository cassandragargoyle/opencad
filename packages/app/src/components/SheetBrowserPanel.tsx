/**
 * T-VIEW-08: Sheet browser panel — auto-numbered sheet index grouped by discipline.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isDocumentReadOnly } from '../stores/documentStore';
import {
  createSheet,
  autoNumberSheets,
  groupSheetsByDiscipline,
  buildSheetIndexRows,
  DISCIPLINE_LABELS,
  type Sheet,
  type Discipline,
} from '../lib/sheetIndex';
import { exportMultiSheetPDF } from '../lib/multiSheetPDF';

const DISCIPLINES: Discipline[] = ['A', 'S', 'M', 'E', 'P', 'C', 'L', 'T'];

export function SheetBrowserPanel(): React.ReactElement {
  const { t } = useTranslation();
  const isReadOnly = isDocumentReadOnly();

  const [sheets,     setSheets]     = useState<Sheet[]>([]);
  const [newTitle,   setNewTitle]   = useState('Floor Plan');
  const [newDisc,    setNewDisc]    = useState<Discipline>('A');
  const [newAuthor,  setNewAuthor]  = useState('');
  const [expandedDiscs, setExpandedDiscs] = useState<Set<string>>(new Set(['A']));
  const [status, setStatus] = useState('');

  const numbered = autoNumberSheets(sheets);
  const groups   = groupSheetsByDiscipline(numbered);
  const indexRows = buildSheetIndexRows(numbered);

  const addSheet = () => {
    if (!newTitle.trim()) return;
    setSheets((prev) => [...prev, createSheet({ title: newTitle.trim(), discipline: newDisc, author: newAuthor.trim() || undefined })]);
    setNewTitle('');
  };

  const removeSheet = (id: string) => {
    setSheets((prev) => prev.filter((s) => s.id !== id));
  };

  const toggleDisc = (disc: string) => {
    setExpandedDiscs((prev) => {
      const next = new Set(prev);
      if (next.has(disc)) next.delete(disc);
      else next.add(disc);
      return next;
    });
  };

  const handleExport = () => {
    if (numbered.length === 0) return;
    exportMultiSheetPDF(
      numbered.map((s) => ({
        title: s.title,
        sheetNumber: s.sheetNumber ?? '',
        widthMm: 297,
        heightMm: 210,
      })),
      { includeSheetIndex: true, plotStyle: 'colour' },
    );
    setStatus(`Exported ${numbered.length} sheet(s) as PDF`);
  };

  return (
    <div className="panel sheet-browser-panel" role="region" aria-label="Sheet Browser">
      <h3 className="panel-title">{t('panels.sheetBrowser', 'Sheet Browser')}</h3>

      <div className="panel-body">
        <h4 className="section-label">Add Sheet</h4>
        <div className="field-row">
          <label className="field-label" style={{ width: '60px' }}>
            Disc.
            <select className="panel-select" value={newDisc} onChange={(e) => setNewDisc(e.target.value as Discipline)} disabled={isReadOnly}>
              {DISCIPLINES.map((d) => (
                <option key={d} value={d}>{d} — {DISCIPLINE_LABELS[d] ?? d}</option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Title
            <input type="text" className="panel-input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Floor Plan" disabled={isReadOnly} />
          </label>
        </div>
        <label className="field-label">
          Author (optional)
          <input type="text" className="panel-input" value={newAuthor} onChange={(e) => setNewAuthor(e.target.value)} disabled={isReadOnly} />
        </label>
        <button className="panel-btn" onClick={addSheet} disabled={isReadOnly || !newTitle.trim()}>
          Add Sheet
        </button>

        {groups.size > 0 && (
          <div className="sheet-tree">
            <h4 className="section-label">Drawing Set</h4>
            {[...groups.entries()].map(([disc, discSheets]) => (
              <div key={disc} className="discipline-group">
                <button
                  className="discipline-header"
                  onClick={() => toggleDisc(disc)}
                  aria-expanded={expandedDiscs.has(disc)}
                >
                  <span>{disc} — {DISCIPLINE_LABELS[disc] ?? disc}</span>
                  <span>({discSheets.length})</span>
                </button>
                {expandedDiscs.has(disc) && (
                  <ul className="sheet-list">
                    {discSheets.map((s) => (
                      <li key={s.id} className="sheet-item">
                        <span className="sheet-num">{s.sheetNumber}</span>
                        <span className="sheet-title">{s.title}</span>
                        {!isReadOnly && (
                          <button
                            className="panel-btn-icon"
                            onClick={() => removeSheet(s.id)}
                            title="Remove sheet"
                            aria-label="Remove"
                          >×</button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {numbered.length > 0 && (
          <button className="panel-btn primary" onClick={handleExport}>
            Export Multi-Sheet PDF ({numbered.length} sheets)
          </button>
        )}

        {status && <p className="panel-status" role="status">{status}</p>}

        {indexRows.length > 0 && (
          <div className="sheet-index">
            <h4 className="section-label">Sheet Index</h4>
            <table className="data-table">
              <thead>
                <tr><th>No.</th><th>Title</th><th>Disc.</th></tr>
              </thead>
              <tbody>
                {indexRows.map((row) => (
                  <tr key={row.sheetNumber}>
                    <td>{row.sheetNumber}</td>
                    <td>{row.title}</td>
                    <td>{row.discipline}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
