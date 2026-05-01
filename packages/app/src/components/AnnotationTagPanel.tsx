/**
 * T-VIEW-02: Annotation tag panel — place element tags with Pset-bound labels.
 */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentStore, isDocumentReadOnly } from '../stores/documentStore';
import {
  buildTagLabel,
  getTemplateForType,
  BUILTIN_TAG_TEMPLATES,
} from '../lib/tagSystem';

export function AnnotationTagPanel(): React.ReactElement {
  const { t } = useTranslation();
  const document    = useDocumentStore((s) => s.document);
  const addElement  = useDocumentStore((s) => s.addElement);
  const pushHistory = useDocumentStore((s) => s.pushHistory);
  const isReadOnly  = isDocumentReadOnly();

  const [selectedId, setSelectedId] = useState<string>('');
  const [status, setStatus]         = useState('');

  const elements = useMemo(
    () => (document ? Object.values(document.content.elements) : []),
    [document],
  );

  const supportedTypes = new Set(BUILTIN_TAG_TEMPLATES.map((t) => t.elementType));
  const taggableElements = elements.filter((el) => supportedTypes.has(el.type));

  const selectedEl = taggableElements.find((el) => el.id === selectedId);
  const preview = useMemo(() => {
    if (!selectedEl) return [];
    const tmpl = getTemplateForType(selectedEl.type);
    return buildTagLabel(selectedEl, tmpl);
  }, [selectedEl]);

  const placeTag = () => {
    if (!selectedEl || isReadOnly) return;
    const tmpl   = getTemplateForType(selectedEl.type);
    const lines  = buildTagLabel(selectedEl, tmpl);

    const layers = document ? Object.values(document.organization.layers) : [];
    const layerId = selectedEl.layerId || layers[0]?.id || 'default';

    pushHistory(`Place annotation tag on ${selectedEl.type}`);
    addElement({
      type: 'annotation',
      layerId,
      properties: {
        TaggedElementId: selectedEl.id,
        Lines: lines.join('\n'),
        TemplateType: tmpl.elementType,
      },
    });
    setStatus(`Tag placed for ${selectedEl.type} "${selectedEl.id}"`);
  };

  return (
    <div className="panel annotation-tag-panel" role="region" aria-label="Annotation Tags">
      <h3 className="panel-title">{t('panels.annotationTag', 'Annotation Tags')}</h3>

      <div className="panel-body">
        <label className="field-label">
          Element to Tag
          <select
            className="panel-select"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            disabled={isReadOnly || taggableElements.length === 0}
          >
            <option value="">— select element —</option>
            {taggableElements.map((el) => (
              <option key={el.id} value={el.id}>
                {el.type} — {el.id}
              </option>
            ))}
          </select>
        </label>

        {selectedEl && preview.length > 0 && (
          <div className="tag-preview" aria-label="Tag preview">
            <span className="field-label">Preview</span>
            <div className="tag-bubble">
              {preview.map((line, i) => (
                <div key={i} className="tag-line">{line || '—'}</div>
              ))}
            </div>
          </div>
        )}

        <button
          className="panel-btn primary"
          onClick={placeTag}
          disabled={isReadOnly || !selectedEl}
        >
          Place Tag
        </button>

        {status && (
          <p className="panel-status" role="status">{status}</p>
        )}

        {taggableElements.length === 0 && (
          <p className="panel-hint">
            No taggable elements in model. Add doors, windows, walls, or rooms first.
          </p>
        )}
      </div>
    </div>
  );
}
