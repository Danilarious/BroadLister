# BroadLister — UI & Workflow Model

**Status:** planning, 2026-05-08

This document describes the operator-facing UI: the screens, the navigation model, and where the approval gates live. The visual design is deferred; this is structure and flow.

## Operating posture

- One operator (Bo) on a local browser at `https://localhost:4100` (mirroring the `reckoner-app` mkcert pattern).
- Active client is **selected**, not implicit; switching client changes overlay views without leaking data.
- Keyboard-first: list views support arrow + enter + standard verbs (`a`/`r`/`m`/`s` in queues).
- No notifications, no chat, no real-time. Refresh-on-demand for ingest panels.

## Top-level navigation

```
┌──────────────────────────────────────────────────────────────────┐
│  BroadLister                          [Client: Trace Finance ▾] │
├──────────────────────────────────────────────────────────────────┤
│  Dashboard │ Journalists │ Outlets │ Articles │ Tags │           │
│  Campaigns │ Imports │ Review Queue │ Adapters │ Settings        │
└──────────────────────────────────────────────────────────────────┘
```

- The **client switcher** is global and prominent. When *no* client is selected, overlay views show empty states; global views (Journalists, Outlets, Articles, Tags) are always available regardless of selection.
- Settings includes: data file location, mapping templates, recipe library, adapter health, backup/export.

## Core screens

### Dashboard

- "What needs your attention" widgets:
  - `ReviewItem` count by kind.
  - Recent imports.
  - Stale verifications (verified contact methods older than threshold).
  - Active campaigns (overlay-scoped) with list-readiness summary.
- Quick actions: "Paste an article URL", "Start CSV import", "New campaign".

### Journalist directory

- Table with: display name, primary outlet, beat tags, region, freshness signal, confidence chip.
- Filters: tag (multi), outlet, region, freshness window, has-verified-email, merge status.
- Search: name, name variants, current outlet.
- Row click → Journalist detail.
- Bulk actions (in v1.1): tag, add to current campaign list.

### Journalist detail

Sections:

1. **Header.** Name, primary affiliation, freshness signal, overall confidence chip.
2. **Bio panel.** Editable fields with provenance pop-out (per-field citations + confidence).
3. **Affiliations.** Time-bounded list. Operator can add or close.
4. **Bylines.** Articles attributed to this journalist. Sortable by published_at.
5. **Beats / topics / tags.** Tag chips with confidence; per-link citation peek.
6. **Contact methods.** Each row shows kind, value, verification state, lawful-to-store flag, last verification date, and the citation that supports it.
7. **Public preferences panel (v1).** Renders `global_status_flags_json` entries. Each entry shows the citation. UI rejects "Add flag" without a citation. **Empty-state copy is important here** — it should remind the operator that opinion-shaped notes belong on the client overlay.
8. **Cross-client view (operator-only, non-aggregated).** Shows the *journalist's existence* on each client's lists where applicable, but **does not** show another client's private rationale, pitch angle, or notes. By default this section shows just "in N campaigns across M clients" without naming clients beyond the current one.
9. **Current-client overlay.** Visible only when a client is selected. Shows:
   - **Relationship/status panel (v1).** `OutreachStatus.state` + `relationship_warmth` (operator-set, labeled as opinion). `notes_private` for soft signals. Recent `OutreachEvent` ledger entries.
   - **Narrative fit panel (v1).** Reads from the operator's *current campaign* context (when one is selected); otherwise hidden. Shows `narrative_angle`, `coverage_rationale`, `evidence_byline_ids` (with links to bylines), `likely_objections`, `preferred_framing`, `competing_narratives`, `confidence`, `operator_notes`. Editable in-place; saves to `CampaignContact.narrative_fit_json` for the selected campaign.
   - **Approval/fact-check readiness panel (v1).** Computed: contact-readiness chip, citation-coverage summary, ClientApproval state for any list this contact is on.

Every panel from item 9 is overlay data and **never** renders fields belonging to a different client. A red "overlay visibility" banner shows above the overlay sections so the operator never confuses which client they are looking at.

### Outlet directory & detail

Same shape as journalist directory + detail, with:

- Staff (current + historical, via affiliations).
- Articles indexed.
- Beat / format / region tags.
- Contact methods (tip line, masthead links).
- Per-client overlay panel (for current client).

### Article / byline feed

- A chronological feed of articles in the system, filterable by outlet, beat, region, language.
- Each row links to the article detail (excerpt, byline links, tag chips, citations) and back to outlet / journalist.
- Per-journalist and per-outlet views are filtered slices of this feed.

### Tags directory

- All tags grouped by `kind` (beat / topic / format / region / broad / specific).
- Counts of links to journalists / outlets / articles.
- Tag detail: linked entities, recent uses, hygiene flags (orphans, frequent typos).
- Edit / merge / retire (v1.1).

### Campaign workspace (per client, per campaign)

```
Campaign: Trace Finance / Q3 2026 launch              [State: draft]
─────────────────────────────────────────────────────────────────
Constraints panel  [Approved messaging | Forbidden claims | Embargo |
                    Exclusivity & sequencing | Outreach windows |
                    Spokespeople | Geography | Sensitive topics |
                    Competitor conflicts | Approval requirements |
                    Source/fact-check requirements ]    [edit]
─────────────────────────────────────────────────────────────────
Lists                                          [+ New list]
  ▸ Tier 1 trade press            (24 contacts, 3 approved)
  ▸ Crypto generalists            (41 contacts, 0 approved)
  ▸ Founder-friendly podcasts     (8 contacts, 6 approved)
─────────────────────────────────────────────────────────────────
Approvals       Outreach status      Briefs (export)
```

The **Campaign constraints panel (v1)** is a structured form over `Campaign.constraints_json`. It is visible whenever the campaign is open. When `Campaign.constraints_required = true`, the panel displays a red banner if any required constraint is empty, and outreach-ready exports are blocked.

A **list view** within a campaign:

- Table of `CampaignContact` rows.
- Columns: journalist (display name + primary outlet), tag chips, target score, narrative-fit confidence chip, suitability note, exclusion flag, approval state, contact-readiness chip, last outreach event.
- Side panel with the focused row: editable overlay fields (rationale, pitch angle, suitability, exclusion reason, embargo note) plus the **narrative fit editor** (reads/writes `narrative_fit_json`).
- "Add contacts" → opens journalist directory in a picker mode, scoped by suggested filters (e.g. matching beat tags).
- Bulk actions: approve / reject for outreach, set target score, attach client tag.

**Narrative fit editor:**

- Inline structured form over `narrative_fit_json` (no JSON editor exposed to the operator).
- Fields: narrative angle, coverage rationale, evidence bylines (picker over global `Byline`s), likely objections, preferred framing, competing narratives, confidence (`low|medium|high`), operator notes.
- Read-only "evidence summary" cell on the row reflects the chosen bylines.

### Review queue

- Inbox-style list of `ReviewItem`s.
- Filters: kind, source batch, conflict-only, confidence band, target client (for overlay items).
- Detail panel shows the proposed change vs. current state side-by-side, with the source citation and any conflicting facts.
- Verbs: approve, reject, merge into existing (with picker), defer (returns to queue with note).
- Bulk verbs: approve-all-no-conflict-high-confidence (with confirmation modal).

### Import wizard

- Steps: upload → preview → map columns → validate → preview merges → commit.
- Progress visible at each step; back-navigation safe.
- Mapping step uses templates; saves a new template if mapping doesn't match a known one.
- Preview-merges step shows a sample of proposed merges and lets operator inspect/override.
- Commit step creates `ImportBatchRow` rows + `ReviewItem` rows; user is dropped into the review queue scoped to this batch.

### Saved segments (v1.1)

- A saved filter on the journalist or outlet directory: "AI-policy + region:eu + freshness < 90d".
- Used for fast list assembly and as the source of "match suggestions" when adding to campaigns.
- Stored as JSON queries; not materialized views.

### Adapters health

- Per-adapter state: last run, last error, queue depth, rate-limit posture.
- Manual run button per adapter.

### Settings

- Data file path, cache path, backup options.
- Active client management (create, archive, slug binding).
- Mapping templates CRUD.
- Per-host fetch recipes list (read-only for operator; recipe code stays in repo).

## Operator approval gates

The system enforces approval-gating in these places (matches the operational-model §8 list):

1. **Review queue.** Imports/extractions never apply without operator approval.
2. **Merge events.** Operator initiates and approves; system never auto-merges.
3. **Contact verification.** A `ContactMethod` only flips to `verified` after operator action with a citation.
4. **Lawful-to-store.** Defaults `false`; operator must explicitly flip with confirmation.
5. **Campaign list export.** Each list has a `ClientApproval` requirement before "outreach-ready" export. Draft exports are always allowed but clearly labeled.
6. **Relationship-state escalation.** Moving `OutreachStatus.state` from `none` / `planned` to anything stronger surfaces a confirmation step.
7. **Campaign constraints completeness.** When `constraints_required = true`, the constraints panel must be filled before outreach-ready export.

UI surfaces missing approvals as a banner; gated buttons are disabled with a hover hint identifying the missing piece.

The UI surfaces a banner whenever an approval is missing (e.g. "Add citation before marking verified" or "ClientApproval required to export this list as outreach-ready").

## Cross-client safety in UI

- Client switcher must always be visible.
- Overlay panels render an explicit `[Client: <name>]` header so the operator never confuses overlays.
- "Cross-client view" on journalists is opt-in (a tab, not a default panel) and never names other clients' notes/strategy.
- The export pipeline strictly excludes overlay fields not belonging to the active client.

## Empty states & first-run

- First boot offers: import a CSV, add Trace Finance as the first client (or create a new client by slug), or paste an article URL.
- Empty journalist directory shows a brief "What is BroadLister?" card linking to the planning docs (read-only) and the import wizard.

## Accessibility & ergonomics

- Keyboard navigation across tables and queues.
- Visible focus states.
- Clear error states on failed validation.
- No modal traps; modals always have an explicit close + escape.

## Out-of-scope screens for v1

- Outreach composer / message drafting (we record events, we don't author messages).
- In-product messaging templates.
- Real-time collaboration / presence.
- Mobile responsive layouts (desktop only in v1).
- Public-facing journalist profile pages (BroadLister is internal-only).

## Worked end-to-end scenarios

### Scenario A: Build a Tier-1 trade-press list for Trace Finance

1. Operator selects client `Trace Finance` from switcher.
2. Creates `Campaign: Q3 launch`, sets embargo, state `draft`.
3. Creates list `Tier 1 trade press`.
4. Filters Journalist directory by `beat:fintech-policy + beat:crypto-policy + region:us + freshness < 180d`.
5. Adds rows to the list. For each row, attaches `target_rationale`, `pitch_angle`, `suitability_note`.
6. Reviews each row's contact-readiness chip. Where unverified, opens the journalist detail and uses "Cite from URL" to upgrade contact methods.
7. Marks rows `approved` for outreach.
8. Submits the list for `ClientApproval`.
9. After approval, exports as a markdown brief + CSV. The export carries provenance and `email_safe` flags.

### Scenario B: Inbound article via Bucketer (v1.2)

1. Bucketer adapter pulls a weekly digest. Two articles match the configured tag slice.
2. Each article URL is fetched. Article + outlet + byline proposals land in review queue with `Citation(source_type='bucketer_signal')`.
3. Operator opens review queue scoped to the batch.
4. For one article, the journalist already exists → review item is "merge into existing journalist", operator approves with one keystroke.
5. For the other, a new journalist is proposed; operator confirms.
6. Tag proposals from the article extraction (e.g. `topic:rwa-tokenization`) are queued separately; operator reviews and approves the relevant ones.
7. Operator may then add the new journalist to the active campaign list with a target rationale referencing the article.

### Scenario C: Conflict resolution

1. CSV import row claims journalist `Jane Doe` works at `Bloomberg`. Existing record has `Jane Doe` at `The Information` with `verified` affiliation, current.
2. Service layer detects conflict, creates `ReviewItem(kind='conflict')` rather than merging.
3. Operator opens the conflict view. Both citations side-by-side. Operator decides:
   - Bloomberg is current → close the Information affiliation with `end_date=today`, open new Bloomberg affiliation, mark new as primary.
   - Or, the import row was wrong → mark the import-row provenance link as `contradicts`, reject the proposal.
4. Resolution recorded.
