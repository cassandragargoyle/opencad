/**
 * T-VIEW-06: Callout panel — place detail markers that cross-reference views.
 */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentStore, isDocumentReadOnly } from '../stores/documentStore';
import { createCalloutMarker, resolveCalloutLabel } from '../lib/callout';

export function CalloutPanel(): React.ReactElement {
  const { t } = useTranslation();
  const document    = useDocumentStore((s) => s.document);
  const addElement  = useDocumentStore((s) => s.addElement);
  const pushHistory = useDocumentStore((s) => s.pushHistory);
  const isReadOnly  = isDocumentReadOnly();

  const [targetViewId, setTargetViewId] = useState<string>('');
  const [status, setStatus] = useState('');

  const views = useMemo(
    () => document
      ? Object.values(document.presentation.views).filter(
          (v) => v.type === 'detail' || v.type === 'section' || v.type === 'elevation',
        )
      : [],
    [document],
  );

  const layers = useMemo(
    () => (document ? Object.values(document.organization.layers) : []),
    [document],
  );

  const placeCallout = () => {
    if (isReadOnly || !document || !targetViewId) return;
    const layerId = layers[0]?.id ?? 'default';
    const marker = createCalloutMarker({ x: 0, y: 0 }, targetViewId);
    const label  = resolveCalloutLabel(targetViewId, views);

    pushHistory(`Place callout → ${label}`);
    addElement({
      type: 'label',
      layerId,
      properties: {
        Kind: 'callout',
        TargetViewId: targetViewId,
        Label: label,
        CalloutId: marker.id,
      },
    });
    setStatus(`Placed callout → ${label}`);
  };

  return (
    <div className="panel callout-panel" role="region" aria-label="Callout Markers">
      <h3 className="panel-title">{t('panels.callout', 'Callout Markers')}</h3>

      <div className="panel-body">
        <label className="field-label">
          Reference View
          <select
            className="panel-select"
            value={targetViewId}
            onChange={(e) => setTargetViewId(e.target.value)}
            disabled={isReadOnly || views.length === 0}
          >
            <option value="">— select view —</option>
            {views.map((v) => (
              <option key={v.id} value={v.id}>
                {v.type.toUpperCase()} — {v.name}
              </option>
            ))}
          </select>
        </label>

        <button
          className="panel-btn primary"
          onClick={placeCallout}
          disabled={isReadOnly || !targetViewId}
        >
          Place Callout
        </button>

        {views.length === 0 && (
          <p className="panel-hint">
            No section, elevation, or detail views. Create views first.
          </p>
        )}

        {status && <p className="panel-status" role="status">{status}</p>}
      </div>
    </div>
  );
}
