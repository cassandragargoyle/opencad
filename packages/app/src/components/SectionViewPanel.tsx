/**
 * T-VIEW-01: Section view panel — create section cuts and elevation views.
 */
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentStore, isDocumentReadOnly } from '../stores/documentStore';
import { sectionPlaneFromMarker, computeSectionCut } from '../lib/sectionCut';
import type { ViewSchema } from '@opencad/document';

type ViewTool = 'section' | 'elevation';

const ELEVATION_DIRS = [
  { value: 'N', label: 'North' },
  { value: 'S', label: 'South' },
  { value: 'E', label: 'East' },
  { value: 'W', label: 'West' },
] as const;

export function SectionViewPanel(): React.ReactElement {
  const { t } = useTranslation();
  const document   = useDocumentStore((s) => s.document);
  const addView    = useDocumentStore((s) => s.addView);
  const pushHistory = useDocumentStore((s) => s.pushHistory);
  const isReadOnly  = isDocumentReadOnly();

  const [tool, setTool] = useState<ViewTool>('section');
  const [viewName, setViewName] = useState('Section 1');
  const [x1, setX1] = useState('0');
  const [y1, setY1] = useState('0');
  const [x2, setX2] = useState('10000');
  const [y2, setY2] = useState('0');
  const [zBottom, setZBottom] = useState('0');
  const [zTop,    setZTop]    = useState('3000');
  const [depth,   setDepth]   = useState('6000');
  const [elevDir, setElevDir] = useState<'N' | 'S' | 'E' | 'W'>('N');
  const [status,  setStatus]  = useState('');

  const elements = useMemo(
    () => document ? Object.values(document.content.elements) : [],
    [document],
  );

  const existingSections = useMemo(
    () => document
      ? Object.values(document.presentation.views).filter(
          (v) => v.type === 'section' || v.type === 'elevation',
        )
      : [],
    [document],
  );

  const createSection = () => {
    if (isReadOnly || !document) return;
    const px1 = parseFloat(x1) || 0;
    const py1 = parseFloat(y1) || 0;
    const px2 = parseFloat(x2) || 10000;
    const py2 = parseFloat(y2) || 0;
    const pzBottom = parseFloat(zBottom) || 0;
    const pzTop    = parseFloat(zTop)    || 3000;
    const pdepth   = parseFloat(depth)   || 6000;

    const plane = sectionPlaneFromMarker(
      { x: px1, y: py1 },
      { x: px2, y: py2 },
      { zBottom: pzBottom, zTop: pzTop, depth: pdepth },
    );

    const cuts = computeSectionCut(elements, plane);
    const id = `section_${Date.now().toString(36)}`;

    const view: ViewSchema = {
      id,
      name: viewName || `Section ${existingSections.length + 1}`,
      type: 'section',
      camera: {
        position: { x: (px1 + px2) / 2, y: pzBottom, z: (py1 + py2) / 2 },
        target:   { x: (px1 + px2) / 2, y: (pzBottom + pzTop) / 2, z: (py1 + py2) / 2 },
        up: { x: 0, y: 1, z: 0 },
        fov: 50, near: 1, far: 100_000,
      },
      sectionCut: { x1: px1, y1: py1, x2: px2, y2: py2, zBottom: pzBottom, zTop: pzTop, depth: pdepth },
    };

    pushHistory(`Add section view "${view.name}"`);
    addView(view);
    setStatus(`Created "${view.name}" — ${cuts.length} element(s) cut`);
    setViewName(`Section ${existingSections.length + 2}`);
  };

  const createElevation = () => {
    if (isReadOnly || !document) return;
    const id = `elevation_${Date.now().toString(36)}`;
    const view: ViewSchema = {
      id,
      name: viewName || `Elevation ${elevDir}`,
      type: 'elevation',
      camera: {
        position: { x: 0, y: 0, z: 0 },
        target:   { x: 0, y: 0, z: 0 },
        up: { x: 0, y: 1, z: 0 },
        fov: 50, near: 1, far: 100_000,
      },
      elevationDir: elevDir,
    };
    pushHistory(`Add elevation view "${view.name}"`);
    addView(view);
    setStatus(`Created elevation "${view.name}" (${elevDir})`);
    setViewName(`Elevation ${elevDir}${existingSections.length + 2}`);
  };

  return (
    <div className="panel section-view-panel" role="region" aria-label="Section Views">
      <h3 className="panel-title">{t('panels.sectionView', 'Section &amp; Elevation Views')}</h3>

      {/* Tool selector */}
      <div className="tool-tabs" role="tablist">
        {(['section', 'elevation'] as ViewTool[]).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={tool === tab}
            className={`tool-tab ${tool === tab ? 'active' : ''}`}
            onClick={() => setTool(tab)}
          >
            {tab === 'section' ? 'Section Cut' : 'Elevation'}
          </button>
        ))}
      </div>

      <div className="panel-body">
        <label className="field-label">
          View Name
          <input
            type="text"
            className="panel-input"
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            disabled={isReadOnly}
          />
        </label>

        {tool === 'section' && (
          <>
            <div className="field-row">
              <label className="field-label half">
                Start X (mm)
                <input type="number" className="panel-input" value={x1} onChange={(e) => setX1(e.target.value)} disabled={isReadOnly} />
              </label>
              <label className="field-label half">
                Start Y (mm)
                <input type="number" className="panel-input" value={y1} onChange={(e) => setY1(e.target.value)} disabled={isReadOnly} />
              </label>
            </div>
            <div className="field-row">
              <label className="field-label half">
                End X (mm)
                <input type="number" className="panel-input" value={x2} onChange={(e) => setX2(e.target.value)} disabled={isReadOnly} />
              </label>
              <label className="field-label half">
                End Y (mm)
                <input type="number" className="panel-input" value={y2} onChange={(e) => setY2(e.target.value)} disabled={isReadOnly} />
              </label>
            </div>
            <div className="field-row">
              <label className="field-label half">
                Elevation Bottom (mm)
                <input type="number" className="panel-input" value={zBottom} onChange={(e) => setZBottom(e.target.value)} disabled={isReadOnly} />
              </label>
              <label className="field-label half">
                Elevation Top (mm)
                <input type="number" className="panel-input" value={zTop} onChange={(e) => setZTop(e.target.value)} disabled={isReadOnly} />
              </label>
            </div>
            <label className="field-label">
              Depth (mm)
              <input type="number" className="panel-input" value={depth} onChange={(e) => setDepth(e.target.value)} disabled={isReadOnly} />
            </label>
            <button
              className="panel-btn primary"
              onClick={createSection}
              disabled={isReadOnly}
            >
              Create Section View
            </button>
          </>
        )}

        {tool === 'elevation' && (
          <>
            <label className="field-label">
              Direction
              <select
                className="panel-select"
                value={elevDir}
                onChange={(e) => setElevDir(e.target.value as 'N' | 'S' | 'E' | 'W')}
                disabled={isReadOnly}
              >
                {ELEVATION_DIRS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </label>
            <button
              className="panel-btn primary"
              onClick={createElevation}
              disabled={isReadOnly}
            >
              Create Elevation View
            </button>
          </>
        )}

        {status && (
          <p className="panel-status" role="status">{status}</p>
        )}

        {existingSections.length > 0 && (
          <div className="existing-views">
            <h4 className="section-label">Existing Views ({existingSections.length})</h4>
            <ul className="view-list">
              {existingSections.map((v) => (
                <li key={v.id} className="view-item">
                  <span className="view-type-badge">{v.type === 'section' ? 'S' : v.elevationDir ?? 'E'}</span>
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
