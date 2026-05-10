import { useEffect, useState } from "react";
import { getTabulatorExportPreview } from "../api.js";
import type { TabulatorExportPreview } from "../types.js";
import { parseArticleIdsInput, previewCoverageLabel, tabulatorBundleDownloadFilename, tabulatorBundleDownloadText, validateTabulatorBundleDownload } from "../utils/tabulatorPreview.js";

export function TabulatorPreviewScreen() {
  const [preview, setPreview] = useState<TabulatorExportPreview>();
  const [articleIdsText, setArticleIdsText] = useState("");
  const [sourceTagOrCommit, setSourceTagOrCommit] = useState("");
  const [downloadConfirmed, setDownloadConfirmed] = useState(false);
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);

  async function loadPreview(scopeToArticles = false) {
    setIsLoading(true);
    try {
      const articleIds = scopeToArticles ? parseArticleIdsInput(articleIdsText) : [];
      const next = await getTabulatorExportPreview({
        exported_by: "operator",
        source_tag_or_commit: sourceTagOrCommit.trim() || undefined,
        article_ids: articleIds.length > 0 ? articleIds : undefined
      });
      setPreview(next);
      setDownloadConfirmed(false);
      setError(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Preview failed.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadPreview(false);
  }, []);

  const summary = preview?.bundle.summary;
  const omittedRecords = preview?.metadata.omitted_records ?? [];
  const includedArticleIds = preview?.metadata.included_article_ids ?? [];
  const downloadValidation = validateTabulatorBundleDownload(preview);
  const canDownload = Boolean(preview && downloadConfirmed && downloadValidation.ok);

  function downloadBundle() {
    if (!preview) return;
    try {
      const text = tabulatorBundleDownloadText(preview);
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = tabulatorBundleDownloadFilename(preview.bundle.exported_at);
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setError(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Download validation failed.");
    }
  }

  return (
    <section className="export-preview">
      <div className="section-header">
        <div>
          <p className="eyebrow">Tabulator bridge</p>
          <h2>Reviewed media export preview</h2>
        </div>
        <button disabled={isLoading} onClick={() => loadPreview(false)}>{isLoading ? "Loading" : "Refresh preview"}</button>
      </div>

      <div className="guardrail export-guardrail" role="note">
        <strong>Local artifact only.</strong>
        <span>The preview can be downloaded as a local JSON file after operator confirmation. It does not write to Tabulator, call Tabulator, include contact methods, or include client-private overlay fields.</span>
      </div>

      <div className="export-grid">
        <div className="panel export-main">
          {error && <div className="error-inline" role="alert">{error}</div>}
          {isLoading && <div className="empty" role="status">Building preview from approved, provenance-backed BroadLister records.</div>}
          {!isLoading && !error && !preview && <div className="empty">No preview response returned.</div>}

          {preview && (
            <>
              <div className="preview-status">
                <div>
                  <span>Bundle</span>
                  <strong>{preview.bundle.schema}</strong>
                </div>
                <div>
                  <span>Export ID</span>
                  <strong>{preview.bundle.export_id}</strong>
                </div>
                <div>
                  <span>Generated</span>
                  <strong>{preview.metadata.generated_at}</strong>
                </div>
                <div>
                  <span>Mode</span>
                  <strong>{preview.metadata.mode}</strong>
                </div>
              </div>

              <div className="metric-grid export-metrics">
                <div className="metric"><span>{summary?.article_count ?? 0}</span><strong>Articles included</strong></div>
                <div className="metric"><span>{summary?.outlet_count ?? 0}</span><strong>Outlets included</strong></div>
                <div className="metric"><span>{summary?.byline_count ?? 0}</span><strong>Bylines included</strong></div>
                <div className="metric"><span>{summary?.tag_count ?? 0}</span><strong>Tags included</strong></div>
                <div className="metric"><span>{summary?.provenance_packet_count ?? 0}</span><strong>Provenance packets</strong></div>
                <div className="metric"><span>{omittedRecords.length}</span><strong>Omitted records</strong></div>
              </div>

              <section className="preview-section">
                <h3>Included reviewed records</h3>
                {includedArticleIds.length === 0 ? (
                  <div className="empty">No reviewed, provenance-backed articles are export-eligible for this preview.</div>
                ) : (
                  <table className="record-table">
                    <thead>
                      <tr><th>Article</th><th>Outlet</th><th>BroadLister ID</th></tr>
                    </thead>
                    <tbody>
                      {preview.bundle.articles.map((article) => (
                        <tr key={article.broadlister_article_id}>
                          <td data-label="Article"><strong>{article.title}</strong><small>{article.canonical_url}</small></td>
                          <td data-label="Outlet">{article.outlet_name}</td>
                          <td data-label="BroadLister ID"><code>{article.broadlister_article_id}</code></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              <section className="preview-section">
                <h3>Omitted or excluded records</h3>
                {omittedRecords.length === 0 ? (
                  <div className="empty">No omitted records in this preview.</div>
                ) : (
                  <div className="omission-list">
                    {omittedRecords.map((record) => (
                      <article key={`${record.broadlister_model}:${record.id}`} className="omission-card">
                        <span className="badge">{record.reason}</span>
                        <strong>{record.broadlister_model} <code>{record.id}</code></strong>
                        {record.detail && <small>{record.detail}</small>}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        <aside className="detail-panel export-side">
          <h3>Preview controls</h3>
          <p className="muted">Optional article ID scoping narrows the read-only preview. It does not write a file or queue an export.</p>
          <label>
            Source tag or commit
            <input value={sourceTagOrCommit} onChange={(event) => setSourceTagOrCommit(event.target.value)} placeholder="Optional git tag, commit, or operator label" />
          </label>
          <label>
            Article IDs
            <textarea value={articleIdsText} onChange={(event) => setArticleIdsText(event.target.value)} placeholder="Optional. One article ID per line or comma-separated." />
          </label>
          <div className="actions">
            <button disabled={isLoading} onClick={() => loadPreview(true)}>Preview selected IDs</button>
            <button className="secondary" disabled={isLoading} onClick={() => {
              setArticleIdsText("");
              void loadPreview(false);
            }}>Clear scope</button>
          </div>

          {preview && (
            <div className="preview-facts">
              <h4>Provenance coverage</h4>
              <p>{previewCoverageLabel(preview.bundle.summary.article_count, preview.bundle.summary.provenance_packet_count)}</p>
              <h4>Safety flags</h4>
              <ul>
                <li>Client overlays excluded: {preview.metadata.safety.client_overlay_fields_excluded ? "yes" : "no"}</li>
                <li>Contact methods exported: {preview.metadata.safety.contacts_exported ? "yes" : "no"}</li>
                <li>File writer added: {preview.metadata.safety.file_writer_added ? "yes" : "no"}</li>
                <li>Tabulator dependency allowed: {preview.metadata.safety.tabulator_runtime_dependency_allowed ? "yes" : "no"}</li>
              </ul>
            </div>
          )}

          <div className="download-card">
            <h3>Local JSON artifact</h3>
            <p>This creates a browser download of the reviewed media bundle currently shown in preview. It does not write a backend file, call Tabulator, import into Tabulator, or include contact methods/client-private overlays.</p>
            {downloadValidation.reasons.length > 0 && (
              <div className="error-inline" role="alert">
                {downloadValidation.reasons.join(" ")}
              </div>
            )}
            <label className="confirmation-check">
              <input type="checkbox" checked={downloadConfirmed} disabled={!preview || !downloadValidation.ok} onChange={(event) => setDownloadConfirmed(event.target.checked)} />
              <span>I confirm this downloads a local JSON artifact only; no Tabulator write/call occurs, and contact/client-private fields remain excluded.</span>
            </label>
            <button disabled={!canDownload} onClick={downloadBundle}>Download local JSON bundle</button>
          </div>
        </aside>
      </div>
    </section>
  );
}
