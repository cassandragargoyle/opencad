/**
 * T-VIEW-10: Legend view panel — create material/symbol/hatch legend views.
 */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentStore, isDocumentReadOnly } from '../stores/documentStore';
import { createLegendView, addLegendEntry, type LegendEntryType } from '../lib/legendView';

const ENTRY_TYPES: { value: LegendEntryType; label: string }[] = [
  { value: 'hatch',      label: 'Hatch / Fill' },
  { value: 'symbol',     label: 'Symbol' },
  { value: 'line-style', label: 'Line Style' },
  { value: 'keynote',    label: 'Keynote Row' },
];

export function LegendViewPanel(): React.ReactElement {
  const { t } = useTranslation();
  const document    = useDocumentStore((s) => s.document);
  const addView     = useDocumentStore((s) => s.addView);
  const pushHistory = useDocumentStore((s) => s.pushHistory);
  const isReadOnly  = isDocumentReadOnly();

  const [name,     setName]     = useState('Material Legend');
  const [entType,  setEntType]  = useState<LegendEntryType>('hatch');
  const [entLabel, setEntLabel] = useState('');
  const [entDesc,  setEntDesc]  = useState('');
  const [entries,  setEntries]  = useState<{ type: LegendEntryType; label: string; description: string }[]>([]);
  const [status,   setStatus]   = useState('');

  const existingLegends = useMemo(
    () => document
      ? Object.values(document.presentation.views).filter((v) => v.type === 'legend')
      : [],
    [document],
  );

  const addEntry = () => {
    if (!entLabel.trim()) return;
    setEntries((prev) => [...prev, { type: entType, label: entLabel.trim(), description: entDesc.trim() }]);
    setEntLabel('');
    setEntDesc('');
  };

  const createLegend = () => {
    if (isReadOnly || !document) return;
    const legend = createLegendView(name || `Legend ${existingLegends.length + 1}`);
    for (const e of entries) addLegendEntry(legend, e);
    pushHistory(`Add legend view "${legend.name}"`);
    addView(legend);
    setStatus(`Created "${legend.name}" with ${entries.length} entries`);
    setEntries([]);
    setName(`Legend ${existingLegends.length + 2}`);
  };

  return (
    <div className="panel legend-view-panel" role="region" aria-label="Legend Views">
      <h3 className="panel-title">{t('panels.legendView', 'Legend Views')}</h3>

      <div className="panel-body">
        <label className="field-label">
          Legend Name
          <input type="text" className="panel-input" value={name} onChange={(e) => setName(e.target.value)} disabled={isReadOnly} />
        </label>

        <h4 className="section-label">Add Entry</h4>
        <div className="field-row">
          <label className="field-label" style={{ width: '120px' }}>
            Type
            <select className="panel-select" value={entType} onChange={(e) => setEntType(e.target.value as LegendEntryType)} disabled={isReadOnly}>
              {ENTRY_TYPES.map((et) => (
                <option key={et.value} value={et.value}>{et.label}</option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Label
            <input type="text" className="panel-input" value={entLabel} onChange={(e) => setEntLabel(e.target.value)} placeholder="Brick veneer" disabled={isReadOnly} />
          </label>
        </div>
        <label className="field-label">
          Description
          <input type="text" className="panel-input" value={entDesc} onChange={(e) => setEntDesc(e.target.value)} placeholder="102mm facing brick to face of frame" disabled={isReadOnly} />
        </label>
        <button className="panel-btn" onClick={addEntry} disabled={isReadOnly || !entLabel.trim()}>
          Add Entry
        </button>

        {entries.length > 0 && (
          <div className="legend-entries">
            <h4 className="section-label">Entries ({entries.length})</h4>
            <ul className="view-list">
              {entries.map((e, i) => (
                <li key={i} className="view-item">
                  <span className="view-type-badge">{e.type[0]?.toUpperCase()}</span>
                  <span className="view-name">{e.label}</span>
                  {e.description && <span className="view-scale"> — {e.description}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <button className="panel-btn primary" onClick={createLegend} disabled={isReadOnly}>
          Create Legend View
        </button>

        {status && <p className="panel-status" role="status">{status}</p>}

        {existingLegends.length > 0 && (
          <div className="existing-views">
            <h4 className="section-label">Existing Legends ({existingLegends.length})</h4>
            <ul className="view-list">
              {existingLegends.map((v) => (
                <li key={v.id} className="view-item">
                  <span className="view-type-badge">L</span>
                  <span className="view-name">{v.name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
