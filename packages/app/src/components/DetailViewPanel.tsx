/**
 * T-VIEW-03: Detail view panel — define zoomed 2D detail regions.
 */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentStore, isDocumentReadOnly } from '../stores/documentStore';
import { createDetailView, getDetailViewElements } from '../lib/detailView';

export function DetailViewPanel(): React.ReactElement {
  const { t } = useTranslation();
  const document    = useDocumentStore((s) => s.document);
  const addView     = useDocumentStore((s) => s.addView);
  const pushHistory = useDocumentStore((s) => s.pushHistory);
  const isReadOnly  = isDocumentReadOnly();

  const [name,  setName]  = useState('Detail 1');
  const [x,     setX]     = useState('0');
  const [y,     setY]     = useState('0');
  const [w,     setW]     = useState('5000');
  const [h,     setH]     = useState('3000');
  const [scale, setScale] = useState('10');
  const [status, setStatus] = useState('');

  const elements = useMemo(
    () => (document ? Object.values(document.content.elements) : []),
    [document],
  );

  const existingDetails = useMemo(
    () => (document
      ? Object.values(document.presentation.views).filter((v) => v.type === 'detail')
      : []),
    [document],
  );

  const regionElements = useMemo(() => {
    const region = {
      x: parseFloat(x) || 0,
      y: parseFloat(y) || 0,
      width:  parseFloat(w) || 5000,
      height: parseFloat(h) || 3000,
    };
    return getDetailViewElements(elements, region);
  }, [elements, x, y, w, h]);

  const createDetail = () => {
    if (isReadOnly || !document) return;
    const region = {
      x: parseFloat(x) || 0,
      y: parseFloat(y) || 0,
      width:  parseFloat(w) || 5000,
      height: parseFloat(h) || 3000,
    };
    const scaleNum = parseFloat(scale) || 10;
    const view = createDetailView(name || `Detail ${existingDetails.length + 1}`, region, scaleNum);
    pushHistory(`Add detail view "${view.name}"`);
    addView(view);
    setStatus(`Created "${view.name}" — ${regionElements.length} element(s) in region`);
    setName(`Detail ${existingDetails.length + 2}`);
  };

  return (
    <div className="panel detail-view-panel" role="region" aria-label="Detail Views">
      <h3 className="panel-title">{t('panels.detailView', 'Detail Views')}</h3>

      <div className="panel-body">
        <label className="field-label">
          View Name
          <input
            type="text"
            className="panel-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isReadOnly}
          />
        </label>

        <div className="field-row">
          <label className="field-label half">
            Origin X (mm)
            <input type="number" className="panel-input" value={x} onChange={(e) => setX(e.target.value)} disabled={isReadOnly} />
          </label>
          <label className="field-label half">
            Origin Y (mm)
            <input type="number" className="panel-input" value={y} onChange={(e) => setY(e.target.value)} disabled={isReadOnly} />
          </label>
        </div>
        <div className="field-row">
          <label className="field-label half">
            Width (mm)
            <input type="number" className="panel-input" value={w} onChange={(e) => setW(e.target.value)} disabled={isReadOnly} />
          </label>
          <label className="field-label half">
            Height (mm)
            <input type="number" className="panel-input" value={h} onChange={(e) => setH(e.target.value)} disabled={isReadOnly} />
          </label>
        </div>

        <label className="field-label">
          Print Scale (1:x)
          <input type="number" className="panel-input" value={scale} onChange={(e) => setScale(e.target.value)} disabled={isReadOnly} min="1" />
        </label>

        <p className="panel-hint">
          {regionElements.length} element(s) in region
        </p>

        <button
          className="panel-btn primary"
          onClick={createDetail}
          disabled={isReadOnly}
        >
          Create Detail View
        </button>

        {status && (
          <p className="panel-status" role="status">{status}</p>
        )}

        {existingDetails.length > 0 && (
          <div className="existing-views">
            <h4 className="section-label">Detail Views ({existingDetails.length})</h4>
            <ul className="view-list">
              {existingDetails.map((v) => (
                <li key={v.id} className="view-item">
                  <span className="view-type-badge">D</span>
                  <span className="view-name">{v.name}</span>
                  {v.detailRegion && (
                    <span className="view-scale"> 1:{v.detailRegion.scale ?? '?'}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
