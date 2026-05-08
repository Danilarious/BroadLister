import type { ApiRecord } from "../types.js";
import { formatValue } from "../utils/format.js";

type Props = {
  record?: ApiRecord;
  title: string;
};

const provenanceFields = new Set(["bio_short", "notes_public", "value", "title", "source_url", "citation_id"]);

export function DetailPanel({ record, title }: Props) {
  if (!record) {
    return (
      <aside className="detail-panel">
        <h3>{title}</h3>
        <p className="muted">Select a row to inspect details and provenance fields.</p>
      </aside>
    );
  }

  return (
    <aside className="detail-panel">
      <div className="detail-header">
        <h3>{title}</h3>
        <span className="badge">id {record.id.slice(0, 8)}</span>
      </div>
      <div className="field-list">
        {Object.entries(record).map(([key, value]) => (
          <div className="field-row" key={key}>
            <div>
              <strong>{key}</strong>
              {provenanceFields.has(key) && <span className="provenance-chip">provenance pop-out</span>}
            </div>
            <pre>{formatValue(value)}</pre>
          </div>
        ))}
      </div>
      <p className="guardrail">Global records show sourced facts only. Client strategy belongs in Phase 3 overlay panels.</p>
    </aside>
  );
}

