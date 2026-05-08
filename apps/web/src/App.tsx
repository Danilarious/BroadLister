const navItems = ["Dashboard", "Journalists", "Outlets", "Articles", "Tags", "Campaigns", "Imports", "Review Queue"];

export function App() {
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Sevenfold MediaDesk prototype</p>
          <h1>BroadLister</h1>
        </div>
        <div className="client-switcher">Client: none selected</div>
      </header>
      <nav className="nav" aria-label="Primary">
        {navItems.map((item) => <a href="#" key={item}>{item}</a>)}
      </nav>
      <section className="hero">
        <div>
          <p className="eyebrow">Phase 1 admin shell</p>
          <h2>Provenance-aware media intelligence, local-first.</h2>
          <p>
            Use the API for Phase 1 CRUD, CSV import, review queue, provenance, and overlay records.
            Phase 2 will replace this shell with the full operator UI.
          </p>
        </div>
        <aside>
          <strong>Safety posture</strong>
          <span>No outbound outreach. No Gmail. No systemd. No cross-client overlay leakage.</span>
        </aside>
      </section>
    </main>
  );
}

