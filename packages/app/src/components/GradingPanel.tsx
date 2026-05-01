/**
 * T-SITE-08: Grading panel — spot levels, drainage arrows, and cut/fill analysis.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentStore, isDocumentReadOnly } from '../stores/documentStore';
import {
  computeCutFill,
  formatSpotLevel,
  formatSlope,
  type ElevationGrid,
} from '../lib/gradingCalc';

type GradingTool = 'spot_level' | 'drainage_arrow' | 'cutfill';

export function GradingPanel(): React.ReactElement {
  const { t } = useTranslation();
  const document  = useDocumentStore((s) => s.document);
  const addElement = useDocumentStore((s) => s.addElement);
  const pushHistory = useDocumentStore((s) => s.pushHistory);
  const isReadOnly = isDocumentReadOnly();

  const [tool, setTool] = useState<GradingTool>('spot_level');
  const [spotElev, setSpotElev] = useState('0.000');
  const [spotPrefix, setSpotPrefix] = useState('FL');

  // Collect existing spot levels from document for cut/fill analysis.
  const spotLevels = useMemo(() => {
    if (!document) return [];
    return Object.values(document.content.elements).filter(
      (e) => e.type === 'annotation' &&
        (e.properties as Record<string, { value: unknown }>)['Kind']?.value === 'spot_level'
    );
  }, [document]);

  // Simple cut/fill demo: compare topography elements against Z=0 datum.
  const cutFillResult = useMemo(() => {
    if (!document) return null;
    const topoEls = Object.values(document.content.elements).filter(
      (e) => e.type === 'topography'
    );
    if (topoEls.length === 0) return null;

    const topo = topoEls[0]!;
    const ptsRaw = (topo.properties as Record<string, { value: unknown }>)['Points']?.value;
    if (typeof ptsRaw !== 'string') return null;

    try {
      const pts: Array<{ x: number; y: number; z: number }> = JSON.parse(ptsRaw);
      if (pts.length < 4) return null;

      const n = Math.ceil(Math.sqrt(pts.length));
      const elevs = new Float32Array(n * n);
      const zeros = new Float32Array(n * n);
      pts.slice(0, n * n).forEach((p, i) => { elevs[i] = p.z; });

      const xRange = Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x)) || 1;
      const yRange = Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y)) || 1;

      const existing: ElevationGrid = { cols: n, rows: n, elevations: elevs, rangeX: xRange, rangeY: yRange };
      const datum:    ElevationGrid = { cols: n, rows: n, elevations: zeros, rangeX: xRange, rangeY: yRange };

      return computeCutFill(existing, datum);
    } catch {
      return null;
    }
  }, [document]);

  const placeSpotLevel = useCallback((x: number, y: number) => {
    if (!document || isReadOnly) return;
    const zMm = parseFloat(spotPrefix === '' ? spotElev : spotElev) * 1000;
    const z = Number.isFinite(zMm) ? zMm : 0;
    const label = formatSpotLevel(z, spotPrefix);
    const layers = Object.values(document.organization.layers);
    const layerId = layers[0]?.id ?? 'default';
    pushHistory('Place spot level');
    addElement({
      type: 'annotation',
      layerId,
      properties: {
        Kind:      { type: 'string', value: 'spot_level' },
        X:         { type: 'number', value: x },
        Y:         { type: 'number', value: y },
        Elevation: { type: 'number', value: z },
        Label:     { type: 'string', value: label },
      },
    });
  }, [document, isReadOnly, spotElev, spotPrefix, addElement, pushHistory]);

  // Expose spot level placer on window for viewport integration.
  React.useEffect(() => {
    if (tool !== 'spot_level') return;
    const win = window as unknown as Record<string, unknown>;
    win.__gradingPlaceSpotLevel = placeSpotLevel;
    return () => { delete win.__gradingPlaceSpotLevel; };
  }, [tool, placeSpotLevel]);

  if (!document) {
    return <div className="grading-panel__empty">{t('panels.landscape.noAssets')}</div>;
  }
  if (isReadOnly) {
    return <div className="grading-panel__empty">{t('panels.landscape.readOnly')}</div>;
  }

  return (
    <div className="grading-panel" role="region" aria-label={t('panels.grading.title')}>
      <h3 className="grading-panel__title">{t('panels.grading.title')}</h3>

      {/* Tool selector */}
      <div className="grading-panel__tools" role="toolbar" aria-label={t('panels.grading.tools')}>
        {(['spot_level', 'drainage_arrow', 'cutfill'] as GradingTool[]).map((id) => (
          <button
            key={id}
            className={`grading-panel__tool-btn${tool === id ? ' active' : ''}`}
            onClick={() => setTool(id)}
            aria-pressed={tool === id}
          >
            {t(`panels.grading.tool.${id}`)}
          </button>
        ))}
      </div>

      {/* Spot level tool */}
      {tool === 'spot_level' && (
        <div className="grading-panel__tool-settings">
          <label className="grading-panel__field">
            <span>{t('panels.grading.prefix')}</span>
            <select
              className="grading-panel__select"
              value={spotPrefix}
              onChange={(e) => setSpotPrefix(e.target.value)}
              aria-label={t('panels.grading.prefix')}
            >
              <option value="FL">FL</option>
              <option value="NGL">NGL</option>
              <option value="FFL">FFL</option>
              <option value="TW">TW</option>
              <option value="BW">BW</option>
            </select>
          </label>
          <label className="grading-panel__field">
            <span>{t('panels.grading.elevation')}</span>
            <input
              type="number"
              className="grading-panel__input"
              value={spotElev}
              step={0.001}
              onChange={(e) => setSpotElev(e.target.value)}
              aria-label={t('panels.grading.elevation')}
            />
            <span className="grading-panel__unit">m</span>
          </label>
          <div className="grading-panel__preview">
            {formatSpotLevel(parseFloat(spotElev) * 1000 || 0, spotPrefix)}
          </div>
          <p className="grading-panel__hint">{t('panels.grading.spotLevelHint')}</p>

          <div className="grading-panel__spot-list">
            <strong>{t('panels.grading.placedSpotLevels', { count: spotLevels.length })}</strong>
          </div>
        </div>
      )}

      {/* Drainage arrow tool */}
      {tool === 'drainage_arrow' && (
        <div className="grading-panel__tool-settings">
          <p className="grading-panel__hint">{t('panels.grading.drainageHint')}</p>
        </div>
      )}

      {/* Cut/fill analysis */}
      {tool === 'cutfill' && (
        <div className="grading-panel__cutfill">
          {cutFillResult ? (
            <>
              <div className="grading-panel__stat">
                <span className="grading-panel__stat-label">{t('panels.grading.cutVolume')}</span>
                <span className="grading-panel__stat-value cut">
                  {(cutFillResult.cutVolume / 1e9).toFixed(2)} m³
                </span>
              </div>
              <div className="grading-panel__stat">
                <span className="grading-panel__stat-label">{t('panels.grading.fillVolume')}</span>
                <span className="grading-panel__stat-value fill">
                  {(cutFillResult.fillVolume / 1e9).toFixed(2)} m³
                </span>
              </div>
              <div className="grading-panel__stat">
                <span className="grading-panel__stat-label">{t('panels.grading.netVolume')}</span>
                <span className={`grading-panel__stat-value ${cutFillResult.netVolume >= 0 ? 'fill' : 'cut'}`}>
                  {cutFillResult.netVolume >= 0 ? '+' : ''}
                  {(cutFillResult.netVolume / 1e9).toFixed(2)} m³
                </span>
              </div>
            </>
          ) : (
            <p className="grading-panel__hint">{t('panels.grading.noCutFillData')}</p>
          )}
        </div>
      )}
    </div>
  );
}

export { formatSlope };
