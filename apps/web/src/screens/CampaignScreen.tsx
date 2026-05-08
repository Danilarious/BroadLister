import { useEffect, useState } from "react";
import { clientExportUrl, createOverlayResource, exportUrl, getWorkspace, listResource, updateOverlayResource } from "../api.js";
import type { ApiRecord, CampaignContact, CampaignWorkspace, Client } from "../types.js";

type Props = {
  activeClient?: Client;
};

export function CampaignScreen({ activeClient }: Props) {
  const [workspace, setWorkspace] = useState<CampaignWorkspace>();
  const [journalists, setJournalists] = useState<ApiRecord[]>([]);
  const [selectedContact, setSelectedContact] = useState<CampaignContact>();
  const [message, setMessage] = useState<string>();

  async function refresh() {
    if (!activeClient) return;
    const [nextWorkspace, nextJournalists] = await Promise.all([
      getWorkspace(activeClient.id),
      listResource("journalists")
    ]);
    setWorkspace(nextWorkspace);
    setJournalists(nextJournalists);
    setSelectedContact(nextWorkspace.campaigns[0]?.lists[0]?.contacts[0]);
  }

  useEffect(() => {
    refresh().catch((error: Error) => setMessage(error.message));
  }, [activeClient?.id]);

  if (!activeClient) {
    return <div className="panel"><h2>Select a client</h2><p className="muted">Campaign overlays stay hidden until a client is selected.</p></div>;
  }

  const client = activeClient;
  const campaign = workspace?.campaigns[0];
  const list = campaign?.lists[0];

  async function createStarterWorkspace() {
    const createdCampaign = await createOverlayResource("campaigns", {
      client_id: client.id,
      name: "Q3 Launch",
      slug: `q3-launch-${Date.now()}`,
      objective_short: "Build an approved, sourced media list.",
      constraints_required: true,
      constraints_json: {
        version: 1,
        approved_messaging: ["Use only approved client claims."],
        approved_claims: [],
        forbidden_claims: ["No unapproved performance claims."],
        legal_caveats: [],
        outreach_windows: [],
        spokesperson_availability: [],
        geographic_constraints: [],
        sensitive_topics: [],
        competitor_conflicts: [],
        approval_requirements: ["ClientApproval required before outreach-ready export."],
        source_fact_check_requirements: ["Every fact-bearing field needs provenance."]
      }
    });
    await createOverlayResource("campaign-lists", {
      campaign_id: createdCampaign.id,
      name: "Tier 1 trade press",
      description: "Starter Phase 3 list"
    });
    await refresh();
  }

  async function addFirstJournalist() {
    if (!list || journalists.length === 0) return;
    await createOverlayResource("campaign-contacts", {
      campaign_list_id: list.id,
      journalist_id: journalists[0].id,
      target_score: 3,
      target_rationale: "Operator rationale scoped to this client.",
      approval_state: "draft",
      narrative_fit_json: {
        version: 1,
        narrative_angle: "Why this journalist fits this campaign.",
        coverage_rationale: "Grounded in prior coverage.",
        evidence_byline_ids: [],
        likely_objections: [],
        competing_narratives: [],
        confidence: "medium",
        source_citations_json: [],
        operator_notes: ""
      }
    });
    await refresh();
  }

  async function saveContact(updates: Record<string, unknown>) {
    if (!selectedContact) return;
    await updateOverlayResource("campaign-contacts", selectedContact.id, updates);
    await refresh();
  }

  async function approveList() {
    if (!list) return;
    await createOverlayResource("client-approvals", {
      client_id: client.id,
      subject_type: "campaign_list",
      subject_id: list.id,
      state: "approved",
      note: "Approved in BroadLister Phase 3 UI."
    });
    await refresh();
  }

  return (
    <section className="campaign-grid">
      <div className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Client overlay</p>
            <h2>{client.display_name} Campaign Workspace</h2>
          </div>
          {!campaign && <button onClick={createStarterWorkspace}>Create starter campaign</button>}
        </div>

        {campaign && (
          <>
            <div className="constraints-card">
              <strong>Campaign constraints</strong>
              <pre>{campaign.constraints_json ? JSON.stringify(JSON.parse(campaign.constraints_json), null, 2) : "No constraints"}</pre>
            </div>
            <div className="actions">
              <button onClick={addFirstJournalist} disabled={!list || journalists.length === 0}>Add first journalist</button>
              <button className="secondary" onClick={approveList} disabled={!list}>Approve list</button>
              {list && <a className="button-link" href={exportUrl(client.id, list.id, "media-list.csv")}>Media CSV</a>}
              {list && <a className="button-link" href={exportUrl(client.id, list.id, "brief.md")}>Brief MD</a>}
              <a className="button-link" href={clientExportUrl(client.id, "source-audit.md")}>Source audit</a>
              <a className="button-link" href={clientExportUrl(client.id, "approval-log.md")}>Approval log</a>
            </div>
          </>
        )}

        {list && (
          <table className="record-table">
            <thead>
              <tr><th>target</th><th>score</th><th>approval</th><th>excluded</th></tr>
            </thead>
            <tbody>
              {list.contacts.map((contact) => (
                <tr className={selectedContact?.id === contact.id ? "selected" : ""} key={contact.id} onClick={() => setSelectedContact(contact)}>
                  <td>{contact.journalist?.display_name ?? contact.outlet?.name ?? "Unnamed"}</td>
                  <td>{contact.target_score ?? "—"}</td>
                  <td>{contact.approval_state}</td>
                  <td>{contact.exclusion_flag ? "yes" : "no"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <aside className="detail-panel">
        <h3>Overlay editor</h3>
        {selectedContact ? (
          <div className="field-list">
            <label>Target rationale<textarea value={selectedContact.target_rationale ?? ""} onChange={(event) => setSelectedContact({ ...selectedContact, target_rationale: event.target.value })} /></label>
            <label>Pitch angle<textarea value={selectedContact.pitch_angle ?? ""} onChange={(event) => setSelectedContact({ ...selectedContact, pitch_angle: event.target.value })} /></label>
            <label>Approval state
              <select value={selectedContact.approval_state} onChange={(event) => setSelectedContact({ ...selectedContact, approval_state: event.target.value })}>
                <option value="draft">draft</option>
                <option value="approved">approved</option>
                <option value="rejected_for_outreach">rejected_for_outreach</option>
              </select>
            </label>
            <label>Narrative angle<textarea value={narrativeAngle(selectedContact)} onChange={(event) => setSelectedContact({ ...selectedContact, narrative_fit_json: narrativeJson(event.target.value) })} /></label>
            <button onClick={() => saveContact({
              target_rationale: selectedContact.target_rationale,
              pitch_angle: selectedContact.pitch_angle,
              approval_state: selectedContact.approval_state,
              narrative_fit_json: selectedContact.narrative_fit_json
            })}>Save overlay</button>
            <p className="guardrail">These fields are client/campaign overlay data and never write to global journalist records.</p>
          </div>
        ) : <p className="muted">Select or add a campaign contact.</p>}
        {message && <p className="error">{message}</p>}
      </aside>
    </section>
  );
}

function narrativeAngle(contact: CampaignContact): string {
  if (!contact.narrative_fit_json) return "";
  try {
    return (JSON.parse(contact.narrative_fit_json) as { narrative_angle?: string }).narrative_angle ?? "";
  } catch {
    return "";
  }
}

function narrativeJson(angle: string): string {
  return JSON.stringify({
    version: 1,
    narrative_angle: angle,
    evidence_byline_ids: [],
    likely_objections: [],
    competing_narratives: [],
    confidence: "medium",
    source_citations_json: []
  });
}
