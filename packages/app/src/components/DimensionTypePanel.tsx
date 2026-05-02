/**
 * T-VIEW-07: Dimension type panel — place angular, radial, ordinate, and chain
 * dimension annotations using the existing dimensions.ts compute library.
 */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentStore, isDocumentReadOnly } from '../stores/documentStore';
import {
  angularDim,
  radialDim,
  diameterDim,
  chainDim,
  ordinateDim,
  formatDimension,
  type DimensionKind,
} from '../lib/dimensions';

const DIM_TYPES: { value: DimensionKind; label: string; desc: string }[] = [
  { value: 'angular',   label: 'Angular',   desc: 'Angle between two lines' },
  { value: 'radial',    label: 'Radius',     desc: 'R-value of arc or circle' },
  { value: 'diameter',  label: 'Diameter',   desc: 'Ø-value of arc or circle' },
  { value: 'chain',     label: 'Chain',      desc: 'Continuous linear chain' },
  { value: 'ordinate',  label: 'Ordinate',   desc: 'Baseline offsets from origin' },
];

export function DimensionTypePanel(): React.ReactElement {
  const { t } = useTranslation();
  const document    = useDocumentStore((s) => s.document);
  const addElement  = useDocumentStore((s) => s.addElement);
  const pushHistory = useDocumentStore((s) => s.pushHistory);
  const isReadOnly  = isDocumentReadOnly();

  const [dimKind, setDimKind] = useState<DimensionKind>('angular');
  const [preview, setPreview] = useState('');
  const [status,  setStatus]  = useState('');

  // Angular: input two angles (degrees) and compute the dimension
  const [angle1, setAngle1] = useState('0');
  const [angle2, setAngle2] = useState('45');

  // Radial / diameter: radius input
  const [radius, setRadius] = useState('1000');

  // Chain: comma-separated positions
  const [chainPos, setChainPos] = useState('0,500,1200,2000');

  // Ordinate: origin + target points
  const [originX, setOriginX]   = useState('0');
  const [originY, setOriginY]   = useState('0');
  const [targets, setTargets]   = useState('500,0 1000,0 1500,0');

  const layers = useMemo(
    () => (document ? Object.values(document.organization.layers) : []),
    [document],
  );

  const computePreview = () => {
    try {
      if (dimKind === 'angular') {
        const a1 = parseFloat(angle1) * (Math.PI / 180);
        const a2 = parseFloat(angle2) * (Math.PI / 180);
        const lineA = {
          a: { x: 0, y: 0 },
          b: { x: Math.cos(a1), y: Math.sin(a1) },
        };
        const lineB = {
          a: { x: 0, y: 0 },
          b: { x: Math.cos(a2), y: Math.sin(a2) },
        };
        const val = angularDim(lineA, lineB);
        setPreview(formatDimension({ kind: 'angular', value: val, unit: 'deg', precision: 2 }));
      } else if (dimKind === 'radial') {
        const r = parseFloat(radius) || 0;
        const val = radialDim({ centre: { x: 0, y: 0 }, radius: r });
        setPreview(formatDimension({ kind: 'radial', value: val, prefix: 'R', suffix: ' mm' }));
      } else if (dimKind === 'diameter') {
        const r = parseFloat(radius) || 0;
        const val = diameterDim({ centre: { x: 0, y: 0 }, radius: r });
        setPreview(formatDimension({ kind: 'diameter', value: val, prefix: 'Ø', suffix: ' mm' }));
      } else if (dimKind === 'chain') {
        const positions = chainPos.split(',').map((s) => parseFloat(s.trim())).filter(isFinite);
        const segs = chainDim(positions);
        setPreview(segs.map((s) => `${s} mm`).join(' + '));
      } else if (dimKind === 'ordinate') {
        const origin = { x: parseFloat(originX) || 0, y: parseFloat(originY) || 0 };
        const pts = targets.split(/\s+/).map((pair) => {
          const [x, y] = pair.split(',').map(Number);
          return { x: x ?? 0, y: y ?? 0 };
        });
        const { xs, ys } = ordinateDim(origin, pts);
        setPreview(`X: ${xs.join(', ')} | Y: ${ys.join(', ')}`);
      }
    } catch { setPreview('—'); }
  };

  const placeDimension = () => {
    if (isReadOnly || !document) return;
    const layerId = layers[0]?.id ?? 'default';
    computePreview();
    pushHistory(`Place ${dimKind} dimension`);
    addElement({
      type: 'dimension',
      layerId,
      properties: {
        DimensionKind: dimKind,
        Value: preview,
      },
    });
    setStatus(`Placed ${dimKind} dimension: ${preview}`);
  };

  return (
    <div className="panel dimension-type-panel" role="region" aria-label="Dimension Types">
      <h3 className="panel-title">{t('panels.dimensions', 'Dimension Types')}</h3>

      <div className="panel-body">
        <div className="tool-tabs" role="tablist">
          {DIM_TYPES.map((d) => (
            <button
              key={d.value}
              role="tab"
              aria-selected={dimKind === d.value}
              className={`tool-tab ${dimKind === d.value ? 'active' : ''}`}
              onClick={() => setDimKind(d.value)}
              title={d.desc}
            >
              {d.label}
            </button>
          ))}
        </div>

        {dimKind === 'angular' && (
          <div className="field-row">
            <label className="field-label half">
              Line 1 angle (°)
              <input type="number" className="panel-input" value={angle1} onChange={(e) => setAngle1(e.target.value)} disabled={isReadOnly} />
            </label>
            <label className="field-label half">
              Line 2 angle (°)
              <input type="number" className="panel-input" value={angle2} onChange={(e) => setAngle2(e.target.value)} disabled={isReadOnly} />
            </label>
          </div>
        )}

        {(dimKind === 'radial' || dimKind === 'diameter') && (
          <label className="field-label">
            Radius (mm)
            <input type="number" className="panel-input" value={radius} onChange={(e) => setRadius(e.target.value)} disabled={isReadOnly} />
          </label>
        )}

        {dimKind === 'chain' && (
          <label className="field-label">
            Positions (comma-separated mm)
            <input type="text" className="panel-input" value={chainPos} onChange={(e) => setChainPos(e.target.value)} disabled={isReadOnly} placeholder="0,500,1200,2000" />
          </label>
        )}

        {dimKind === 'ordinate' && (
          <>
            <div className="field-row">
              <label className="field-label half">
                Origin X
                <input type="number" className="panel-input" value={originX} onChange={(e) => setOriginX(e.target.value)} disabled={isReadOnly} />
              </label>
              <label className="field-label half">
                Origin Y
                <input type="number" className="panel-input" value={originY} onChange={(e) => setOriginY(e.target.value)} disabled={isReadOnly} />
              </label>
            </div>
            <label className="field-label">
              Target points (x,y space-separated)
              <input type="text" className="panel-input" value={targets} onChange={(e) => setTargets(e.target.value)} disabled={isReadOnly} placeholder="500,0 1000,0 1500,0" />
            </label>
          </>
        )}

        <button className="panel-btn" onClick={computePreview} disabled={isReadOnly}>
          Preview
        </button>

        {preview && (
          <div className="dimension-preview">
            <span className="field-label">Result: </span>
            <code className="dim-value">{preview}</code>
          </div>
        )}

        <button className="panel-btn primary" onClick={placeDimension} disabled={isReadOnly}>
          Place Dimension
        </button>

        {status && <p className="panel-status" role="status">{status}</p>}
      </div>
    </div>
  );
}
