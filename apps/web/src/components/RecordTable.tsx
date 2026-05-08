import type { ApiRecord } from "../types.js";
import { formatValue } from "../utils/format.js";

type Props = {
  records: ApiRecord[];
  columns: string[];
  selectedId?: string;
  onSelect: (record: ApiRecord) => void;
};

export function RecordTable({ records, columns, selectedId, onSelect }: Props) {
  if (records.length === 0) {
    return <div className="empty">No records yet. Import CSV rows, paste an article URL, or create records through the API.</div>;
  }

  return (
    <table className="record-table">
      <thead>
        <tr>
          {columns.map((column) => <th key={column}>{column.replace(/_/g, " ")}</th>)}
        </tr>
      </thead>
      <tbody>
        {records.map((record) => (
          <tr
            className={record.id === selectedId ? "selected" : ""}
            key={record.id}
            onClick={() => onSelect(record)}
            tabIndex={0}
          >
            {columns.map((column) => <td key={column}>{formatValue(record[column])}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

