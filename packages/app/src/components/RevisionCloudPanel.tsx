/**
 * T-VIEW-04: Revision cloud panel — place revision clouds and manage revision table.
 */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentStore, isDocumentReadOnly } from '../stores/documentStore';
import { buildRevisionCloudPath } from '../lib/revisionCloud';

interface Revision {
  id: string;
  number: number;
  description: string;
  date: string;
}

const SAMPLE_POLYGON = [
  { x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 3000 }, { x: 0, y: 3000 },
];

export function RevisionCloudPanel(): React.ReactElement {
  const { t } = useTranslation();
  const document    = useDocumentStore((s) => s.document);
  const addElement  = useDocumentStore((s) => s.addElement);
  const pushHistory = useDocumentStore((s) => s.pushHistory);
  const isReadOnly  = isDocumentReadOnly();

  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [newDesc, setNewDesc]     = useState('');
  const [newDate, setNewDate]     = useState(new Date().toISOString().slice(0, 10));
  const [status,  setStatus]      = useState('');

  const layers = useMemo(
    () => (document ? Object.values(document.organization.layers) : []),
    [document],
  );

  const addRevision = () => {
    if (!newDesc.trim()) return;
    const rev: Revision = {
      id: `rev_${Date.now().toString(36)}`,
      number: revisions.length + 1,
      description: newDesc.trim(),
      date: newDate,
    };
    setRevisions((prev) => [...prev, rev]);
    setNewDesc('');
  };

  const placeCloud = (rev: Revision) => {
    if (isReadOnly || !document) return;
    const layerId = layers[0]?.id ?? 'default';
    const path = buildRevisionCloudPath(SAMPLE_POLYGON, 300);

    pushHistory(`Place revision cloud Rev ${rev.number}`);
    addElement({
      type: 'revision_cloud',
      layerId,
      properties: {
        RevisionNumber: rev.number,
        RevisionDescription: rev.description,
        RevisionDate: rev.date,
        CloudPath: path,
      },
    });
    setStatus(`Placed Rev ${rev.number} cloud`);
  };

  return (
    <div className="panel revision-cloud-panel" role="region" aria-label="Revision Clouds">
      <h3 className="panel-title">{t('panels.revisionCloud', 'Revision Clouds')}</h3>

      <div className="panel-body">
        <h4 className="section-label">Add Revision</h4>
        <label className="field-label">
          Description
          <input
            type="text"
            className="panel-input"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Structural revision per RFI-023"
            disabled={isReadOnly}
          />
        </label>
        <label className="field-label">
          Date
          <input
            type="date"
            className="panel-input"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            disabled={isReadOnly}
          />
        </label>
        <button
          className="panel-btn"
          onClick={addRevision}
          disabled={isReadOnly || !newDesc.trim()}
        >
          Add to Revision Table
        </button>

        {revisions.length > 0 && (
          <div className="revision-table">
            <h4 className="section-label">Revision Table</h4>
            <table className="data-table">
              <thead>
                <tr><th>Rev</th><th>Description</th><th>Date</th><th></th></tr>
              </thead>
              <tbody>
                {revisions.map((rev) => (
                  <tr key={rev.id}>
                    <td>{rev.number}</td>
                    <td>{rev.description}</td>
                    <td>{rev.date}</td>
                    <td>
                      <button
                        className="panel-btn-small"
                        onClick={() => placeCloud(rev)}
                        disabled={isReadOnly}
                        title="Place cloud"
                      >
                        Place
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {status && <p className="panel-status" role="status">{status}</p>}
      </div>
    </div>
  );
}
