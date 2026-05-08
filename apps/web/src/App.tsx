import { useEffect, useMemo, useState } from "react";
import { approveReview, createResource, listResource, listReviews, rejectReview } from "./api.js";
import { ReviewQueue } from "./components/ReviewQueue.js";
import { DirectoryScreen } from "./screens/DirectoryScreen.js";
import { ImportScreen } from "./screens/ImportScreen.js";
import type { ApiRecord, Client, ResourceName, ReviewItem } from "./types.js";

type Screen = ResourceName | "dashboard" | "imports" | "review";

const navItems: Array<{ id: Screen; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "journalists", label: "Journalists" },
  { id: "outlets", label: "Outlets" },
  { id: "articles", label: "Articles" },
  { id: "tags", label: "Tags" },
  { id: "imports", label: "Imports" },
  { id: "review", label: "Review Queue" }
];

const resourceScreens = new Set(["journalists", "outlets", "articles", "tags"]);

export function App() {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState<ApiRecord[]>([]);
  const [selected, setSelected] = useState<ApiRecord>();
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [selectedReview, setSelectedReview] = useState<ReviewItem>();
  const [clients, setClients] = useState<Client[]>([]);
  const [activeClientId, setActiveClientId] = useState("");
  const [error, setError] = useState<string>();
  const [importBatchId, setImportBatchId] = useState<string>();

  const activeClient = clients.find((client) => client.id === activeClientId);

  async function refreshReviews(batchId = importBatchId) {
    const next = await listReviews("pending", batchId);
    setReviews(next);
    setSelectedReview(next[0]);
  }

  async function refreshClients() {
    const next = await fetch("/api/clients").then((response) => response.json()) as Client[];
    setClients(next);
  }

  useEffect(() => {
    refreshClients().catch((caught: Error) => setError(caught.message));
    refreshReviews().catch((caught: Error) => setError(caught.message));
  }, []);

  useEffect(() => {
    if (!resourceScreens.has(screen)) return;
    listResource(screen as ResourceName, query)
      .then((next) => {
        setRecords(next);
        setSelected(next[0]);
      })
      .catch((caught: Error) => setError(caught.message));
  }, [screen, query]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (screen !== "review" || !selectedReview) return;
      if (event.key === "a") void approve(selectedReview);
      if (event.key === "r") void reject(selectedReview);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, selectedReview]);

  async function approve(item: ReviewItem) {
    await approveReview(item.id);
    await refreshReviews();
  }

  async function reject(item: ReviewItem) {
    await rejectReview(item.id, "Rejected in Phase 2 UI");
    await refreshReviews();
  }

  async function createTraceClient() {
    const client = await createResource("clients", { slug: "trace-finance", display_name: "Trace Finance" }) as Client;
    await refreshClients();
    setActiveClientId(client.id);
  }

  const counts = useMemo(() => ({
    pendingReviews: reviews.length,
    activeClient: activeClient?.display_name ?? "None selected",
    currentRecords: records.length
  }), [reviews.length, activeClient, records.length]);

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Sevenfold MediaDesk prototype</p>
          <h1>BroadLister</h1>
        </div>
        <label className="client-switcher">
          <span>Client</span>
          <select value={activeClientId} onChange={(event) => setActiveClientId(event.target.value)}>
            <option value="">None selected</option>
            {clients.map((client) => <option value={client.id} key={client.id}>{client.display_name}</option>)}
          </select>
        </label>
      </header>

      <nav className="nav" aria-label="Primary">
        {navItems.map((item) => (
          <button className={screen === item.id ? "active" : ""} key={item.id} onClick={() => setScreen(item.id)}>
            {item.label}
          </button>
        ))}
      </nav>

      {error && <div className="error" role="alert">{error}</div>}

      {screen === "dashboard" && (
        <section className="dashboard">
          <div className="hero panel">
            <div>
              <p className="eyebrow">Phase 2 operator UI</p>
              <h2>Review first. Cite facts. Keep client strategy scoped.</h2>
              <p>Browse global media records, import proposals, inspect provenance, and clear review items without adding any outreach automation.</p>
            </div>
            <aside>
              <strong>Safety posture</strong>
              <span>No outbound outreach. No Gmail. No systemd. Overlay data stays client-scoped.</span>
            </aside>
          </div>
          <div className="metric-grid">
            <div className="metric"><span>{counts.pendingReviews}</span><strong>Pending review items</strong></div>
            <div className="metric"><span>{counts.currentRecords}</span><strong>Rows in active directory</strong></div>
            <div className="metric"><span>{counts.activeClient}</span><strong>Active client</strong></div>
          </div>
          <div className="actions">
            <button onClick={() => setScreen("imports")}>Start CSV import</button>
            <button onClick={() => setScreen("review")}>Open review queue</button>
            <button className="secondary" onClick={createTraceClient}>Add Trace Finance client</button>
          </div>
        </section>
      )}

      {resourceScreens.has(screen) && (
        <DirectoryScreen
          resource={screen as ResourceName}
          records={records}
          selected={selected}
          query={query}
          onQuery={setQuery}
          onSelect={setSelected}
        />
      )}

      {screen === "review" && (
        <ReviewQueue reviews={reviews} selected={selectedReview} onSelect={setSelectedReview} onApprove={approve} onReject={reject} />
      )}

      {screen === "imports" && (
        <ImportScreen onImported={(batchId) => {
          setImportBatchId(batchId);
          refreshReviews(batchId).then(() => setScreen("review")).catch((caught: Error) => setError(caught.message));
        }} />
      )}
    </main>
  );
}

