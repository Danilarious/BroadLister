import type { ApiRecord, ResourceName } from "../types.js";
import { DetailPanel } from "../components/DetailPanel.js";
import { RecordTable } from "../components/RecordTable.js";

const columnsByResource: Record<ResourceName, string[]> = {
  journalists: ["display_name", "merge_status", "home_region", "confidence_score"],
  outlets: ["name", "slug", "outlet_type", "country"],
  articles: ["title", "byline_text", "language", "published_at"],
  tags: ["name", "slug", "kind", "description"]
};

type Props = {
  resource: ResourceName;
  records: ApiRecord[];
  selected?: ApiRecord;
  query: string;
  onQuery: (value: string) => void;
  onSelect: (record: ApiRecord) => void;
};

export function DirectoryScreen({ resource, records, selected, query, onQuery, onSelect }: Props) {
  return (
    <section className="workspace-grid">
      <div className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Global media graph</p>
            <h2>{resource}</h2>
          </div>
          <label className="search-field">
            <span>Search</span>
            <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder={`Find ${resource}`} />
          </label>
        </div>
        <RecordTable records={records} columns={columnsByResource[resource]} selectedId={selected?.id} onSelect={onSelect} />
      </div>
      <DetailPanel record={selected} title={`${resource} detail`} />
    </section>
  );
}
