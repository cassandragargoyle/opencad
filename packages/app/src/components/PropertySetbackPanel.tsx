/**
 * T-SITE-07: Property lines + setback envelope panel.
 * Lists property_line elements, lets user configure setback distances, and
 * generates a buildable envelope surface element.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentStore, isDocumentReadOnly } from '../stores/documentStore';
import {
  computeSetbackEnvelope,
  polygonCentroid,
  type Point2D,
  type SetbackDistances,
} from '../lib/setbackCalc';

const DEFAULT_SETBACKS: SetbackDistances = {
  front: 3000,  // 3 m
  rear:  3000,
  left:  1500,  // 1.5 m
  right: 1500,
};

/** Collect property_line element vertices into a polygon, sorted by endpoint chaining. */
function collectPropertyLinePolygon(
  elements: Record<string, { type: string; properties: Record<string, { value: unknown }> }>
): Point2D[] {
  const lines = Object.values(elements).filter((e) => e.type === 'property_line');
  if (lines.length === 0) return [];

  // If any property_line has a Points property, use that directly.
  const withPoints = lines.find(
    (e) => typeof e.properties['Points']?.value === 'string'
  );
  if (withPoints) {
    try {
      const pts = JSON.parse(withPoints.properties['Points']!.value as string) as Point2D[];
      if (pts.length >= 3) return pts;
    } catch { /* fall through */ }
  }

  // Build polygon from StartX/StartY/EndX/EndY segments by chaining endpoints.
  const segments = lines.map((e) => {
    const pv = (k: string) => typeof e.properties[k]?.value === 'number'
      ? (e.properties[k]!.value as number) : 0;
    return {
      x1: pv('StartX'), y1: pv('StartY'),
      x2: pv('EndX'),   y2: pv('EndY'),
    };
  });

  // Chain segments into a polygon by greedy nearest-endpoint matching.
  if (segments.length === 0) return [];
  const used = new Array(segments.length).fill(false);
  const poly: Point2D[] = [{ x: segments[0]!.x1, y: segments[0]!.y1 }];
  used[0] = true;

  for (let iter = 0; iter < segments.length; iter++) {
    const last = poly[poly.length - 1]!;
    let bestIdx = -1;
    let bestDist = Infinity;
    let reversed = false;

    for (let i = 0; i < segments.length; i++) {
      if (used[i]) continue;
      const s = segments[i]!;
      const d1 = (s.x1 - last.x) ** 2 + (s.y1 - last.y) ** 2;
      const d2 = (s.x2 - last.x) ** 2 + (s.y2 - last.y) ** 2;
      if (d1 < bestDist) { bestDist = d1; bestIdx = i; reversed = false; }
      if (d2 < bestDist) { bestDist = d2; bestIdx = i; reversed = true; }
    }
    if (bestIdx < 0) break;
    const s = segments[bestIdx]!;
    used[bestIdx] = true;
    poly.push(reversed ? { x: s.x1, y: s.y1 } : { x: s.x2, y: s.y2 });
  }

  return poly.length >= 3 ? poly.slice(0, -1) : []; // last = first, remove duplicate
}

function mmInput(
  label: string,
  value: number,
  onChange: (v: number) => void
): React.ReactElement {
  return (
    <label className="setback-panel__field">
      <span className="setback-panel__label">{label}</span>
      <input
        type="number"
        className="setback-panel__input"
        value={Math.round(value / 10) / 100} // show as meters
        min={0}
        step={0.1}
        onChange={(e) => onChange(parseFloat(e.target.value) * 1000 || 0)}
        aria-label={`${label} in meters`}
      />
      <span className="setback-panel__unit">m</span>
    </label>
  );
}

export function PropertySetbackPanel(): React.ReactElement {
  const { t } = useTranslation();
  const document   = useDocumentStore((s) => s.document);
  const addElement = useDocumentStore((s) => s.addElement);
  const pushHistory = useDocumentStore((s) => s.pushHistory);
  const isReadOnly = isDocumentReadOnly();

  const [setbacks, setSetbacks] = useState<SetbackDistances>(DEFAULT_SETBACKS);
  const [error, setError] = useState<string | null>(null);

  const polygon = useMemo(
    () => document ? collectPropertyLinePolygon(
      document.content.elements as Record<string, { type: string; properties: Record<string, { value: unknown }> }>
    ) : [],
    [document]
  );

  const { area } = useMemo(() => {
    if (polygon.length < 3) return { area: 0 };
    const n = polygon.length;
    let s = 0;
    for (let i = 0; i < n; i++) {
      const a = polygon[i]!;
      const b = polygon[(i + 1) % n]!;
      s += a.x * b.y - b.x * a.y;
    }
    return { area: Math.abs(s / 2) };
  }, [polygon]);

  const handleGenerate = useCallback(() => {
    if (!document || isReadOnly) return;
    setError(null);

    if (polygon.length < 3) {
      setError(t('panels.setback.errorNoPropertyLine'));
      return;
    }

    const result = computeSetbackEnvelope(polygon, setbacks);
    if (!result.buildable || result.polygon.length < 3) {
      setError(t('panels.setback.errorNoArea'));
      return;
    }

    const layers = Object.values(document.organization.layers);
    const layerId = layers[0]?.id ?? 'default';
    const centroid = polygonCentroid(result.polygon);

    pushHistory('Generate setback envelope');
    addElement({
      type: 'surface',
      layerId,
      properties: {
        Name:   { type: 'string', value: t('panels.setback.envelopeName') },
        Kind:   { type: 'string', value: 'setback_envelope' },
        Points: { type: 'string', value: JSON.stringify(result.polygon) },
        X:      { type: 'number', value: centroid.x },
        Y:      { type: 'number', value: centroid.y },
      },
    });
  }, [document, isReadOnly, polygon, setbacks, addElement, pushHistory, t]);

  if (!document) {
    return <div className="setback-panel__empty">{t('panels.landscape.noAssets')}</div>;
  }
  if (isReadOnly) {
    return <div className="setback-panel__empty">{t('panels.landscape.readOnly')}</div>;
  }

  return (
    <div className="setback-panel" role="region" aria-label={t('panels.setback.title')}>
      <h3 className="setback-panel__title">{t('panels.setback.title')}</h3>

      <div className="setback-panel__status">
        {polygon.length >= 3
          ? t('panels.setback.siteArea', { area: (area / 1e6).toFixed(1) })
          : t('panels.setback.noPropertyLine')}
      </div>

      <div className="setback-panel__fields">
        {mmInput(t('panels.setback.front'), setbacks.front,  (v) => setSetbacks((s) => ({ ...s, front:  v })))}
        {mmInput(t('panels.setback.rear'),  setbacks.rear,   (v) => setSetbacks((s) => ({ ...s, rear:   v })))}
        {mmInput(t('panels.setback.left'),  setbacks.left,   (v) => setSetbacks((s) => ({ ...s, left:   v })))}
        {mmInput(t('panels.setback.right'), setbacks.right,  (v) => setSetbacks((s) => ({ ...s, right:  v })))}
      </div>

      {error && <div className="setback-panel__error" role="alert">{error}</div>}

      <button
        className="setback-panel__generate-btn"
        onClick={handleGenerate}
        disabled={polygon.length < 3}
      >
        {t('panels.setback.generateEnvelope')}
      </button>
    </div>
  );
}
