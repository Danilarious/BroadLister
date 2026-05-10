import { useState } from "react";
import { importCsv, ingestUrl } from "../api.js";

type Props = {
  onImported: (batchId?: string) => void;
};

export function ImportScreen({ onImported }: Props) {
  const [csv, setCsv] = useState("Name,Outlet\nJane Reporter,Example Daily\n");
  const [url, setUrl] = useState("https://example.com/story");
  const [html, setHtml] = useState("<html lang=\"en\"><head><title>Example Story</title><meta name=\"author\" content=\"Jane Reporter\"></head></html>");
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submitCsv() {
    setBusy(true);
    try {
      const batch = await importCsv({
        label: `UI import ${new Date().toISOString()}`,
        csv,
        mapping: { Name: "display_name", Outlet: "outlet_name" }
      });
      setMessage(`CSV import created batch ${batch.id}`);
      onImported(batch.id);
    } finally {
      setBusy(false);
    }
  }

  async function submitUrl() {
    setBusy(true);
    try {
      const result = await ingestUrl({ url, html });
      setMessage(`URL ingest created ${result.review_items.length} review items`);
      onImported();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="import-grid">
      <div className="panel">
        <p className="eyebrow">Import wizard</p>
        <h2>CSV import</h2>
        <p className="muted">Use columns named Name and Outlet. Imported rows become review items before they touch global records.</p>
        <label>CSV rows<textarea value={csv} onChange={(event) => setCsv(event.target.value)} /></label>
        <button disabled={busy} onClick={submitCsv}>{busy ? "Creating review items" : "Create review items"}</button>
      </div>
      <div className="panel">
        <p className="eyebrow">Single URL ingest</p>
        <h2>Article snapshot</h2>
        <label>Article URL<input value={url} onChange={(event) => setUrl(event.target.value)} /></label>
        <label>HTML snapshot<textarea value={html} onChange={(event) => setHtml(event.target.value)} /></label>
        <button disabled={busy} onClick={submitUrl}>{busy ? "Creating proposals" : "Propose article records"}</button>
      </div>
      {message && <div className="notice">{message}</div>}
    </section>
  );
}
