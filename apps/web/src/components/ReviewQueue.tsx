import { useEffect, useMemo, useState } from "react";
import { getReviewContext } from "../api.js";
import type { ReviewContext, ReviewItem } from "../types.js";
import { safeJson } from "../utils/format.js";

type Props = {
  reviews: ReviewItem[];
  selected?: ReviewItem;
  selectedBatchId?: string;
  kindFilter: string;
  isBusy?: boolean;
  onKindFilter: (kind: string) => void;
  onClearBatch: () => void;
  onSelect: (item: ReviewItem) => void;
  onApprove: (item: ReviewItem) => void;
  onReject: (item: ReviewItem) => void;
  onDefer: (item: ReviewItem) => void;
};

const kindLabels: Record<string, string> = {
  bulk_import_row: "CSV row",
  contact_method_candidate: "Contact method",
  tag_candidate: "Tag",
  outlet_candidate: "Outlet",
  article_candidate: "Article",
  journalist_candidate: "Journalist",
  byline_candidate: "Byline",
  article_tag_candidate: "Article tag",
  client_relevance_candidate: "Client relevance"
};

export function ReviewQueue({ reviews, selected, selectedBatchId, kindFilter, isBusy, onKindFilter, onClearBatch, onSelect, onApprove, onReject, onDefer }: Props) {
  const [context, setContext] = useState<ReviewContext>();
  const [contextError, setContextError] = useState<string>();
  const kinds = useMemo(() => Array.from(new Set(reviews.map((item) => item.kind))).sort(), [reviews]);
  const proposal = selected ? safeJson(selected.proposal_payload_json) as Record<string, unknown> : undefined;
  const data = proposal?.data as Record<string, unknown> | undefined;

  useEffect(() => {
    setContext(undefined);
    setContextError(undefined);
    if (!selected) return;
    getReviewContext(selected.id)
      .then(setContext)
      .catch((error: Error) => setContextError(error.message));
  }, [selected?.id]);

  return (
    <section className="review-layout">
      <div className="review-list">
        <div className="review-toolbar panel">
          <div>
            <p className="eyebrow">Operator review</p>
            <h2>Review Queue</h2>
            <p className="muted">Imports propose records. Approval applies deterministic matching, dependency checks, and client-scoped guards.</p>
          </div>
          <label>
            Proposal kind
            <select value={kindFilter} onChange={(event) => onKindFilter(event.target.value)}>
              <option value="">All pending kinds</option>
              {kinds.map((kind) => <option value={kind} key={kind}>{kindLabels[kind] ?? kind}</option>)}
            </select>
          </label>
          {selectedBatchId && (
            <button className="secondary" onClick={onClearBatch}>
              Clear import batch filter
            </button>
          )}
        </div>
        {selectedBatchId && <div className="notice compact">Showing pending proposals for import batch <code>{selectedBatchId.slice(0, 8)}</code>.</div>}
        {reviews.length === 0 && <div className="empty">Review queue is clear for the current filters.</div>}
        {reviews.map((item) => (
          <button aria-pressed={item.id === selected?.id} className={item.id === selected?.id ? "review-card selected" : "review-card"} key={item.id} onClick={() => onSelect(item)}>
            <span className="badge">{kindLabels[item.kind] ?? item.kind}</span>
            <strong>{summaryFromItem(item)}</strong>
            <span>{item.status}</span>
            <small>{item.id.slice(0, 8)}</small>
          </button>
        ))}
      </div>
      <aside className="detail-panel">
        <h3>Review detail</h3>
        {selected ? (
          <>
            <div className="review-detail-stack">
              <div className="review-summary">
                <span className="badge">{kindLabels[selected.kind] ?? selected.kind}</span>
                <h4>{context?.summary ?? summaryFromItem(selected)}</h4>
                <p>{actionCopy(context?.recommended_action)}</p>
              </div>

              {data && <EntitySummary data={data} />}

              <section className="reconciliation-panel">
                <h4>Likely matches</h4>
                {!context && !contextError && <p className="muted">Checking deterministic matches.</p>}
                {contextError && <p className="error-inline">{contextError}</p>}
                {context?.matches.length === 0 && <p className="muted">No deterministic match found. Approval will create a new global record when dependencies are resolved.</p>}
                {context?.matches.map((match) => (
                  <div className="match-row" key={`${match.model}-${match.id}`}>
                    <strong>{match.label}</strong>
                    <span>{match.model} · {match.confidence} confidence</span>
                    <small>{match.reason}</small>
                  </div>
                ))}
              </section>

              <section className="reconciliation-panel">
                <h4>Dependencies</h4>
                {context?.dependencies.length === 0 && <p className="muted">No linked records required.</p>}
                {context?.dependencies.map((dependency) => (
                  <div className={`dependency-row ${dependency.status}`} key={`${dependency.model}-${dependency.label}`}>
                    <span className="status-dot" aria-hidden="true" />
                    <div>
                      <strong>{dependency.label}</strong>
                      <span>{dependency.model} · {dependency.status}</span>
                      <small>{dependency.reason}</small>
                    </div>
                  </div>
                ))}
              </section>

              <details>
                <summary>Raw proposal JSON</summary>
                <pre>{JSON.stringify(proposal, null, 2)}</pre>
              </details>
            </div>
            <div className="actions">
              <button disabled={isBusy} onClick={() => onApprove(selected)}>Approve or match</button>
              <button className="secondary" disabled={isBusy} onClick={() => onDefer(selected)}>Defer</button>
              <button className="secondary danger-action" disabled={isBusy} onClick={() => onReject(selected)}>Reject</button>
            </div>
            <p className="guardrail">Approval runs through the service layer. Imports never write directly to global records, and client relevance stays client-scoped.</p>
          </>
        ) : <p className="muted">Select a review item. Keyboard shortcuts: `a` approve, `r` reject, `d` defer.</p>}
      </aside>
    </section>
  );
}

function summaryFromItem(item: ReviewItem): string {
  const proposal = safeJson(item.proposal_payload_json) as Record<string, unknown>;
  const data = proposal.data as Record<string, unknown> | undefined;
  if (!data) return item.kind;
  return String(data.title ?? data.display_name ?? data.name ?? data.journalist_display_name ?? data.tag_slug ?? data.value ?? item.kind);
}

function actionCopy(action?: ReviewContext["recommended_action"]): string {
  if (action === "match_existing") return "Likely duplicate found. Approval will match the existing record instead of creating another.";
  if (action === "resolve_dependencies") return "Linked records are missing. Approve or match dependencies first, or defer this item.";
  if (action === "advisory_apply") return "Advisory proposal. Approval applies a scoped relationship or note after dependencies resolve.";
  if (action === "reject_or_defer") return "Review carefully, then reject or defer.";
  return "No deterministic duplicate found. Approval can create a new record.";
}

function EntitySummary({ data }: { data: Record<string, unknown> }) {
  const entries = [
    ["Title", data.title],
    ["Name", data.display_name ?? data.name ?? data.journalist_display_name],
    ["Outlet", data.outlet_name],
    ["URL", data.url_canonical ?? data.article_url_canonical],
    ["Contact", data.value],
    ["Tag", data.slug ?? data.tag_slug],
    ["Client", data.client_slug],
    ["Reason", data.reason ?? data.rationale]
  ].filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0);

  if (entries.length === 0) return null;
  return (
    <dl className="entity-summary">
      {entries.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
