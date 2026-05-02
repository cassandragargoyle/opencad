/**
 * T-SITE-06: Toposolid import panel — paste CSV or GeoJSON elevation data
 * to create a topography element in the document.
 */
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentStore, isDocumentReadOnly } from '../stores/documentStore';
import { parseCSV, parseGeoJSON } from '../lib/topoParser';

export function TopoImportPanel(): React.ReactElement {
  const { t } = useTranslation();
  const document  = useDocumentStore((s) => s.document);
  const addElement = useDocumentStore((s) => s.addElement);
  const pushHistory = useDocumentStore((s) => s.pushHistory);
  const isReadOnly = isDocumentReadOnly();

  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const handleImport = useCallback(() => {
    if (!document || isReadOnly || !text.trim()) return;
    setError(null);
    setImporting(true);

    try {
      const trimmed = text.trim();
      let points: Array<{ x: number; y: number; z: number }>;

      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        // GeoJSON.
        const json = JSON.parse(trimmed) as unknown;
        const result = parseGeoJSON(json);
        points = result.points;
      } else {
        // CSV x,y,z.
        const result = parseCSV(trimmed);
        points = result.points;
      }

      if (points.length < 3) {
        setError(t('panels.topoImport.errorTooFewPoints', { min: 3 }));
        setImporting(false);
        return;
      }

      const bb = points.reduce(
        (acc, p) => ({
          minX: Math.min(acc.minX, p.x), maxX: Math.max(acc.maxX, p.x),
          minY: Math.min(acc.minY, p.y), maxY: Math.max(acc.maxY, p.y),
          minZ: Math.min(acc.minZ, p.z), maxZ: Math.max(acc.maxZ, p.z),
        }),
        { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity }
      );

      const layers = Object.values(document.organization.layers);
      const layerId = layers[0]?.id ?? 'default';

      pushHistory('Import terrain');
      addElement({
        type: 'topography',
        layerId,
        properties: {
          Points: { type: 'string', value: JSON.stringify(points) },
          Name:   { type: 'string', value: t('panels.topoImport.defaultName') },
          X:      { type: 'number', value: bb.minX },
          Y:      { type: 'number', value: bb.minY },
          Width:  { type: 'number', value: bb.maxX - bb.minX },
          Depth:  { type: 'number', value: bb.maxY - bb.minY },
        },
      });

      setText('');
    } catch (e) {
      setError(t('panels.topoImport.errorParse', { msg: String(e) }));
    } finally {
      setImporting(false);
    }
  }, [document, isReadOnly, text, addElement, pushHistory, t]);

  if (!document) {
    return <div className="topo-import-panel__empty">{t('panels.landscape.noAssets')}</div>;
  }
  if (isReadOnly) {
    return <div className="topo-import-panel__empty">{t('panels.landscape.readOnly')}</div>;
  }

  return (
    <div className="topo-import-panel" role="region" aria-label={t('panels.topoImport.title')}>
      <h3 className="topo-import-panel__title">{t('panels.topoImport.title')}</h3>
      <p className="topo-import-panel__hint">{t('panels.topoImport.hint')}</p>

      <textarea
        className="topo-import-panel__textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        placeholder={t('panels.topoImport.placeholder')}
        aria-label={t('panels.topoImport.textareaLabel')}
        spellCheck={false}
      />

      {error && (
        <div className="topo-import-panel__error" role="alert">{error}</div>
      )}

      <button
        className="topo-import-panel__import-btn"
        onClick={handleImport}
        disabled={importing || !text.trim()}
        aria-busy={importing}
      >
        {importing
          ? t('panels.topoImport.importing')
          : t('panels.topoImport.importBtn')}
      </button>
    </div>
  );
}
