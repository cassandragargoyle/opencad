/**
 * T-VIEW-05: Keynote panel — manage model and user keynotes, place keynote tags.
 */
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentStore, isDocumentReadOnly } from '../stores/documentStore';
import {
  createKeynoteTable,
  addKeynote,
  resolveKeynoteLabel,
  filterKeynotesByType,
  type KeynoteTable,
  type KeynoteType,
} from '../lib/keynote';

export function KeynotePanel(): React.ReactElement {
  const { t } = useTranslation();
  const document    = useDocumentStore((s) => s.document);
  const addElement  = useDocumentStore((s) => s.addElement);
  const pushHistory = useDocumentStore((s) => s.pushHistory);
  const isReadOnly  = isDocumentReadOnly();

  const tableRef = useRef<KeynoteTable>(createKeynoteTable());
  const [, forceUpdate] = useState(0);

  const [code,     setCode]    = useState('');
  const [text,     setText]    = useState('');
  const [knType,   setKnType]  = useState<KeynoteType>('model');
  const [selectedId, setSelectedId] = useState<string>('');
  const [status,   setStatus]  = useState('');

  const layers = useMemo(
    () => (document ? Object.values(document.organization.layers) : []),
    [document],
  );

  const _modelKeys = filterKeynotesByType(tableRef.current, 'model');
  const _userKeys  = filterKeynotesByType(tableRef.current, 'user');
  const allKeys   = tableRef.current.entries;

  const addKey = () => {
    if (!code.trim() || !text.trim()) return;
    addKeynote(tableRef.current, { type: knType, code: code.trim(), text: text.trim() });
    setCode('');
    setText('');
    forceUpdate((n) => n + 1);
  };

  const placeKeynote = () => {
    if (isReadOnly || !document || !selectedId) return;
    const label = resolveKeynoteLabel(tableRef.current, selectedId);
    const layerId = layers[0]?.id ?? 'default';

    pushHistory(`Place keynote ${label}`);
    addElement({
      type: 'annotation',
      layerId,
      properties: {
        Kind: 'keynote',
        KeynoteId: selectedId,
        Label: label,
      },
    });
    setStatus(`Placed keynote: ${label}`);
  };

  return (
    <div className="panel keynote-panel" role="region" aria-label="Keynotes">
      <h3 className="panel-title">{t('panels.keynote', 'Keynotes')}</h3>

      <div className="panel-body">
        <h4 className="section-label">Add Keynote</h4>
        <div className="field-row">
          <label className="field-label" style={{ width: '80px' }}>
            Type
            <select className="panel-select" value={knType} onChange={(e) => setKnType(e.target.value as KeynoteType)} disabled={isReadOnly}>
              <option value="model">Model</option>
              <option value="user">User</option>
            </select>
          </label>
          <label className="field-label" style={{ width: '80px' }}>
            Code
            <input type="text" className="panel-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="M-01" disabled={isReadOnly} />
          </label>
        </div>
        <label className="field-label">
          Text
          <input type="text" className="panel-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Cast-in-place concrete" disabled={isReadOnly} />
        </label>
        <button className="panel-btn" onClick={addKey} disabled={isReadOnly || !code.trim() || !text.trim()}>
          Add Keynote
        </button>

        {allKeys.length > 0 && (
          <>
            <h4 className="section-label">Keynote Table ({allKeys.length})</h4>
            <table className="data-table">
              <thead><tr><th>#</th><th>Code</th><th>Description</th><th>Type</th></tr></thead>
              <tbody>
                {allKeys.map((kn) => (
                  <tr
                    key={kn.id}
                    className={selectedId === kn.id ? 'selected' : ''}
                    onClick={() => setSelectedId(kn.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>{kn.number}</td>
                    <td>{kn.code}</td>
                    <td>{kn.text}</td>
                    <td>{kn.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button
              className="panel-btn primary"
              onClick={placeKeynote}
              disabled={isReadOnly || !selectedId}
            >
              Place Selected Keynote
            </button>
          </>
        )}

        {status && <p className="panel-status" role="status">{status}</p>}
      </div>
    </div>
  );
}
