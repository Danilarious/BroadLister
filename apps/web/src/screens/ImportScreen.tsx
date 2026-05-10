import { useState } from "react";
import { importCsv, ingestUrl, previewCsv } from "../api.js";
import type { CsvPreview, UrlIngestResult } from "../types.js";

type Props = {
  onImported: (batchId?: string) => void;
  onOpenReview: (batchId?: string) => void;
};

type ImportStatus = {
  kind: "success" | "error" | "info";
  message: string;
};

const starterCsv = "name,outlet,role,email,beat,location,profile url,notes\nJane Reporter,Example Daily,Reporter,jane@example.com,stablecoins,Brazil,https://example.com/jane,Trace-relevant source\n";

function entityKinds(result?: UrlIngestResult): string[] {
  return result?.review_items.map((item) => item.kind).filter((kind, index, all) => all.indexOf(kind) === index) ?? [];
}

export function ImportScreen({ onImported, onOpenReview }: Props) {
  const [csv, setCsv] = useState(starterCsv);
  const [csvFileName, setCsvFileName] = useState<string>();
  const [csvPreview, setCsvPreview] = useState<CsvPreview>();
  const [url, setUrl] = useState("https://www.coindesk.com/policy/2026/05/02/brazil-s-central-bank-bans-stablecoin-and-crypto-settlement-in-cross-border-payments");
  const [html, setHtml] = useState("");
  const [status, setStatus] = useState<ImportStatus>();
  const [busy, setBusy] = useState<"csv-preview" | "csv-import" | "url" | undefined>();
  const [lastUrlResult, setLastUrlResult] = useState<UrlIngestResult>();
  const [lastBatchId, setLastBatchId] = useState<string>();

  async function loadCsvFile(file?: File) {
    if (!file) return;
    setCsvFileName(file.name);
    setCsvPreview(undefined);
    setStatus({ kind: "info", message: `Loaded ${file.name}. Preview before creating review items.` });
    setCsv(await file.text());
  }

  async function submitPreview() {
    setBusy("csv-preview");
    setStatus(undefined);
    try {
      const preview = await previewCsv({ label: csvFileName ?? "Operator CSV import", csv });
      setCsvPreview(preview);
      setStatus({ kind: "success", message: `Preview ready: ${preview.row_count} rows, ${Object.keys(preview.detected_mapping).length} mapped fields.` });
    } catch (error) {
      setStatus({ kind: "error", message: readableError(error) });
    } finally {
      setBusy(undefined);
    }
  }

  async function submitCsv() {
    setBusy("csv-import");
    setStatus(undefined);
    try {
      const batch = await importCsv({
        label: csvFileName ? `CSV file ${csvFileName}` : `UI import ${new Date().toISOString()}`,
        csv,
        mapping: csvPreview?.detected_mapping ?? {}
      });
      setLastBatchId(batch.id);
      setStatus({ kind: "success", message: `Created review items from ${batch.row_count} CSV rows.` });
      onImported(batch.id);
    } catch (error) {
      setStatus({ kind: "error", message: readableError(error) });
    } finally {
      setBusy(undefined);
    }
  }

  async function submitUrl() {
    setBusy("url");
    setStatus(undefined);
    setLastUrlResult(undefined);
    try {
      const result = await ingestUrl({ url, html: html.trim() || undefined });
      setLastUrlResult(result);
      setLastBatchId(result.import_batch?.id);
      setStatus({
        kind: result.summary.fetch_error ? "info" : "success",
        message: `Created ${result.review_items.length} review proposals for "${result.summary.article_title}".`
      });
      onImported(result.import_batch?.id);
    } catch (error) {
      setStatus({ kind: "error", message: readableError(error) });
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <section className="import-grid">
      <div className="panel import-panel">
        <p className="eyebrow">Contact import</p>
        <h2>CSV media contacts</h2>
        <p className="muted">Upload a CSV or paste rows. BroadLister previews common fields, then creates review items only. Contact methods stay unverified and not lawful-to-store by default.</p>
        <label>
          CSV file
          <input accept=".csv,text/csv" type="file" onChange={(event) => void loadCsvFile(event.target.files?.[0])} />
        </label>
        <label>
          CSV rows
          <textarea value={csv} onChange={(event) => {
            setCsv(event.target.value);
            setCsvPreview(undefined);
          }} />
        </label>
        <div className="actions">
          <button disabled={Boolean(busy)} onClick={submitPreview}>{busy === "csv-preview" ? "Previewing" : "Preview CSV"}</button>
          <button className="secondary" disabled={Boolean(busy) || !csvPreview} onClick={submitCsv}>{busy === "csv-import" ? "Creating review items" : "Create review items"}</button>
        </div>
        {csvPreview && (
          <div className="import-result">
            <strong>{csvPreview.row_count} rows ready</strong>
            <span>Mapped fields: {Object.values(csvPreview.detected_mapping).join(", ") || "none detected"}</span>
            <div className="preview-list">
              {csvPreview.sample.map((row, index) => (
                <pre key={index}>{JSON.stringify(row.mapped, null, 2)}</pre>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="panel import-panel">
        <p className="eyebrow">Article ingest</p>
        <h2>Article URL</h2>
        <p className="muted">Paste a normal article URL. BroadLister fetches bounded page metadata server-side and creates review-gated proposals. If a site blocks fetches, paste optional HTML below for local/offline extraction testing.</p>
        <label>Article URL<input value={url} onChange={(event) => setUrl(event.target.value)} /></label>
        <label>Optional pasted HTML for local/offline extraction testing<textarea placeholder="<html>...</html>" value={html} onChange={(event) => setHtml(event.target.value)} /></label>
        <button disabled={Boolean(busy)} onClick={submitUrl}>{busy === "url" ? "Creating proposals" : "Propose article records"}</button>
        {lastUrlResult && (
          <div className="import-result">
            <strong>{lastUrlResult.review_items.length} review proposals created</strong>
            <span>Entities: {entityKinds(lastUrlResult).join(", ")}</span>
            <span>Outlet: {lastUrlResult.summary.outlet_name}</span>
            {lastUrlResult.summary.authors.length > 0 && <span>Byline: {lastUrlResult.summary.authors.join(", ")}</span>}
            {lastUrlResult.summary.tags.length > 0 && <span>Candidate tags: {lastUrlResult.summary.tags.join(", ")}</span>}
            {lastUrlResult.summary.client_relevance && <span>{lastUrlResult.summary.client_relevance}</span>}
          </div>
        )}
      </div>

      {status && <div className={`notice ${status.kind}`} role={status.kind === "error" ? "alert" : "status"}>{status.message}</div>}
      {(lastUrlResult || lastBatchId) && <button onClick={() => onOpenReview(lastBatchId)}>Open Review Queue</button>}
    </section>
  );
}

function readableError(error: unknown): string {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message) as { message?: string; error?: string };
      return parsed.message ?? parsed.error ?? error.message;
    } catch {
      return error.message;
    }
  }
  return "Import failed.";
}
