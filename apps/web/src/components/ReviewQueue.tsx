import type { ReviewItem } from "../types.js";
import { safeJson } from "../utils/format.js";

type Props = {
  reviews: ReviewItem[];
  selected?: ReviewItem;
  onSelect: (item: ReviewItem) => void;
  onApprove: (item: ReviewItem) => void;
  onReject: (item: ReviewItem) => void;
};

export function ReviewQueue({ reviews, selected, onSelect, onApprove, onReject }: Props) {
  return (
    <section className="review-layout">
      <div className="review-list">
        {reviews.length === 0 && <div className="empty">Review queue is clear.</div>}
        {reviews.map((item) => (
          <button aria-pressed={item.id === selected?.id} className={item.id === selected?.id ? "review-card selected" : "review-card"} key={item.id} onClick={() => onSelect(item)}>
            <strong>{item.kind}</strong>
            <span>{item.status}</span>
            <small>{item.id.slice(0, 8)}</small>
          </button>
        ))}
      </div>
      <aside className="detail-panel">
        <h3>Review detail</h3>
        {selected ? (
          <>
            <pre>{JSON.stringify(safeJson(selected.proposal_payload_json), null, 2)}</pre>
            <div className="actions">
              <button onClick={() => onApprove(selected)}>Approve</button>
              <button className="secondary" onClick={() => onReject(selected)}>Reject</button>
            </div>
            <p className="guardrail">Approving applies the proposal through the service layer. Imports never write directly to global records.</p>
          </>
        ) : <p className="muted">Select a review item. Keyboard shortcuts: `a` approve, `r` reject.</p>}
      </aside>
    </section>
  );
}
