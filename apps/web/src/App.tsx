import { useEffect, useMemo, useState } from "react";
import { approveReview, createResource, listResource, listReviews, rejectReview } from "./api.js";
import { ReviewQueue } from "./components/ReviewQueue.js";
import { CampaignScreen } from "./screens/CampaignScreen.js";
import { DirectoryScreen } from "./screens/DirectoryScreen.js";
import { ImportScreen } from "./screens/ImportScreen.js";
import type { ApiRecord, Client, ResourceName, ReviewItem } from "./types.js";

type Screen = ResourceName | "dashboard" | "imports" | "review" | "campaigns";

const navItems: Array<{ id: Screen; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "journalists", label: "Journalists" },
  { id: "outlets", label: "Outlets" },
  { id: "articles", label: "Articles" },
  { id: "tags", label: "Tags" },
  { id: "campaigns", label: "Campaigns" },
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
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
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
    Promise.all([refreshClients(), refreshReviews()])
      .catch((caught: Error) => setError(caught.message))
      .finally(() => setIsLoading(false));
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
    setIsBusy(true);
    try {
      await approveReview(item.id);
      await refreshReviews();
    } finally {
      setIsBusy(false);
    }
  }

  async function reject(item: ReviewItem) {
    setIsBusy(true);
    try {
      await rejectReview(item.id, "Rejected in the BroadLister UI");
      await refreshReviews();
    } finally {
      setIsBusy(false);
    }
  }

  async function createTraceClient() {
    setIsBusy(true);
    try {
      const client = await createResource("clients", { slug: `trace-finance-${Date.now()}`, display_name: "Trace Finance" }) as Client;
      await refreshClients();
      setActiveClientId(client.id);
    } finally {
      setIsBusy(false);
    }
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
          <p className="eyebrow">Sevenfold MediaDesk</p>
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

      {error && <div className="error" role="alert"><strong>Something needs attention.</strong><span>{error}</span></div>}
      {isLoading && <div className="notice" role="status">Loading BroadLister workspace.</div>}

      {screen === "dashboard" && (
        <section className="dashboard">
          <div className="hero panel">
            <div>
              <p className="eyebrow">Media intelligence workspace</p>
              <h2>Build sourced media lists without leaking client strategy.</h2>
              <p>Review proposed records, inspect provenance, build campaign overlays, approve lists, and export operator-facing artifacts. BroadLister records work, it does not send outreach.</p>
            </div>
            <aside>
              <strong>Safety posture</strong>
              <span>No outbound outreach. No Gmail. No systemd. Overlay data stays client-scoped.</span>
            </aside>
          </div>
          <div className="metric-grid">
            <div className="metric"><span>{counts.pendingReviews}</span><strong>Pending review</strong></div>
            <div className="metric"><span>{counts.currentRecords}</span><strong>Current rows</strong></div>
            <div className="metric"><span>{counts.activeClient}</span><strong>Selected client</strong></div>
          </div>
          <div className="actions">
            <button onClick={() => setScreen("imports")}>Import records</button>
            <button onClick={() => setScreen("review")}>Review proposals</button>
            <button className="secondary" disabled={isBusy} onClick={createTraceClient}>{isBusy ? "Adding client" : "Add Trace Finance client"}</button>
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

      {screen === "campaigns" && (
        <CampaignScreen activeClient={activeClient} />
      )}
    </main>
  );
}
