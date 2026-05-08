# BroadLister — Schema Draft (Prisma-style, SQLite target)

**Status:** planning, 2026-05-08
**Target DB:** SQLite (single file). Prisma's SQLite provider has matured enough to handle the relations and JSON-as-text patterns below. If we later decide to move to Postgres for a shared-service mode, the model is portable.

This is a **draft**. Field names, indexes, and constraints will be refined during Phase 0 implementation planning by Codex with Hermes review.

> SQLite-specific note: Prisma stores `Json` as TEXT on SQLite. Functional indexes (e.g. lower(name)) are not supported via Prisma; we use `@@index` over normalized columns and add raw migrations for partial / expression indexes only when justified.

```prisma
// schema.prisma — DRAFT, not for runtime

datasource db {
  provider = "sqlite"
  url      = env("BROADLISTER_DB")  // file:./data/broadlister.sqlite
}

generator client {
  provider = "prisma-client-js"
}

// =====================================================================
// ENUMS (modeled as string + check; Prisma SQLite has no native enums)
// =====================================================================
// We use string fields with documented allowed values; validation in code.
// Listed as comments so future readers see the intent.

// MergeStatus:        active | merged_into | deprecated
// VerificationState:  unverified | proposed | verified | revoked | known_invalid
// CampaignState:      draft | active | paused | closed
// CampaignContactApproval: draft | approved | rejected_for_outreach
// OutreachState:      none | planned | approved | contacted | replied | declined | hold | blacklisted_for_client
// OutreachEventKind:  note | planned | approved_for_outreach | contacted | replied | declined | meeting_held | coverage_published | retracted
// OutreachChannel:    email | call | event | dm | other
// SourceType:         url | csv_import | bucketer_signal | tabulator_artifact | manual_entry | sheet_row | api
// AssertionKind:      supports | contradicts | proposes
// Confidence:         high | medium | low
// ContactMethodKind:  email | phone | dm_handle | tipline | form_url | mail
// OutletType:         newspaper | magazine | digital | newsletter | podcast | tv | radio | wire | trade | blog | substack | youtube | other
// AffiliationRole:    staff | contributor | freelance | columnist | editor | host | producer | guest | other
// TagKind:            beat | topic | format | region | language | broad | specific | client_only_disallowed
// ReviewKind:         new_journalist | new_outlet | new_article | new_byline | new_contact | enrichment | merge | bulk_import_row | tag_proposal
// ReviewStatus:       pending | approved | rejected | superseded
// ApprovalSubject:    campaign | campaign_list | campaign_contact | message_draft | other

// =====================================================================
// GLOBAL MEDIA GRAPH
// =====================================================================

model Journalist {
  id                     String   @id @default(uuid())
  display_name           String
  display_name_norm      String   // lowercased, accent-folded; for search/dedupe
  name_variants_json     String   // JSON array
  primary_affiliation_id String?  // → Affiliation.id (nullable)
  bio_short              String?
  home_country           String?
  home_region            String?
  languages_json         String?  // JSON array
  external_handles_json  String?  // { twitter_x, linkedin, mastodon, bluesky, threads, personal_site }
  global_status_flags_json String? // JSON array of public, sourced preference flags only.
                                   // EVERY entry must have a citation; service layer rejects otherwise.
                                   // Examples: ["prefers_email_for_pitches"] when stated in a public bio.
                                   // NOT a place for "do not pitch" / relationship warmth / exclusion.
  merge_status           String   @default("active")
  merged_into_id         String?
  freshness_signal       DateTime?
  confidence_score       String?  // high | medium | low (derived)
  created_at             DateTime @default(now())
  updated_at             DateTime @updatedAt

  primary_affiliation    Affiliation? @relation("PrimaryAffiliation", fields: [primary_affiliation_id], references: [id])
  affiliations           Affiliation[] @relation("JournalistAffiliations")
  bylines                Byline[]
  contact_methods        ContactMethod[] @relation("JournalistContacts")
  campaign_contacts      CampaignContact[]
  outreach_events        OutreachEvent[]
  outreach_statuses      OutreachStatus[]
  client_notes           ClientNote[]
  tag_links              JournalistTag[]

  @@index([display_name_norm])
  @@index([merge_status])
  @@index([freshness_signal])
}

model Outlet {
  id              String   @id @default(uuid())
  name            String
  name_norm       String
  slug            String   @unique
  parent_outlet_id String?
  outlet_type     String
  home_url        String?
  home_url_host   String?  // normalized host for dedupe
  rss_feeds_json  String?  // JSON array
  region          String?
  country         String?
  languages_json  String?  // JSON array
  notes_public    String?
  merge_status    String   @default("active")
  merged_into_id  String?
  freshness_signal DateTime?
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  parent_outlet   Outlet?  @relation("OutletParent", fields: [parent_outlet_id], references: [id])
  children        Outlet[] @relation("OutletParent")
  affiliations    Affiliation[]
  articles        Article[]
  contact_methods ContactMethod[] @relation("OutletContacts")
  campaign_contacts CampaignContact[]
  client_notes    ClientNote[]
  tag_links       OutletTag[]

  @@index([name_norm])
  @@index([home_url_host])
  @@index([merge_status])
}

model Affiliation {
  id            String   @id @default(uuid())
  journalist_id String
  outlet_id     String
  role          String
  start_date    DateTime?
  end_date      DateTime?
  is_current    Boolean  @default(true)
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt

  journalist           Journalist @relation("JournalistAffiliations", fields: [journalist_id], references: [id])
  outlet               Outlet     @relation(fields: [outlet_id], references: [id])
  primary_for          Journalist[] @relation("PrimaryAffiliation")

  @@index([journalist_id, is_current])
  @@index([outlet_id, is_current])
  @@unique([journalist_id, outlet_id, role, start_date])
}

model Article {
  id             String   @id @default(uuid())
  url            String
  url_canonical  String   @unique  // normalized; primary dedupe key
  title          String
  published_at   DateTime?
  outlet_id      String
  byline_text    String?
  language       String?
  excerpt        String?
  fetched_at     DateTime?
  fetch_etag     String?
  fetch_hash     String?
  created_at     DateTime @default(now())
  updated_at     DateTime @updatedAt

  outlet     Outlet  @relation(fields: [outlet_id], references: [id])
  bylines    Byline[]
  tag_links  ArticleTag[]

  @@index([outlet_id, published_at])
  @@index([published_at])
}

model Byline {
  id            String  @id @default(uuid())
  article_id    String
  journalist_id String
  position      Int     @default(0)
  confidence    String  @default("medium")
  created_at    DateTime @default(now())

  article    Article    @relation(fields: [article_id], references: [id])
  journalist Journalist @relation(fields: [journalist_id], references: [id])

  @@unique([article_id, journalist_id])
  @@index([journalist_id])
}

model Tag {
  id            String  @id @default(uuid())
  name          String
  slug          String  @unique
  kind          String  // beat | topic | format | region | language | broad | specific
  description   String?
  external_ids_json String? // future Tabulator UUID, ontology-core slug, etc.
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt

  journalist_links JournalistTag[]
  outlet_links     OutletTag[]
  article_links    ArticleTag[]

  @@index([kind])
  @@index([name])
}

// M2M with confidence/source/scope, modeled as join tables (not implicit M2M)
// because we need fields per link.

model JournalistTag {
  id            String  @id @default(uuid())
  journalist_id String
  tag_id        String
  confidence    String  @default("medium")
  scope         String  @default("global")  // global only on global side
  citation_id   String?
  created_at    DateTime @default(now())

  journalist Journalist @relation(fields: [journalist_id], references: [id])
  tag        Tag        @relation(fields: [tag_id], references: [id])

  @@unique([journalist_id, tag_id])
  @@index([tag_id])
}

model OutletTag {
  id         String  @id @default(uuid())
  outlet_id  String
  tag_id     String
  confidence String  @default("medium")
  citation_id String?
  created_at DateTime @default(now())

  outlet Outlet @relation(fields: [outlet_id], references: [id])
  tag    Tag    @relation(fields: [tag_id], references: [id])

  @@unique([outlet_id, tag_id])
  @@index([tag_id])
}

model ArticleTag {
  id         String  @id @default(uuid())
  article_id String
  tag_id     String
  confidence String  @default("medium")
  created_at DateTime @default(now())

  article Article @relation(fields: [article_id], references: [id])
  tag     Tag     @relation(fields: [tag_id], references: [id])

  @@unique([article_id, tag_id])
  @@index([tag_id])
}

model ContactMethod {
  id                    String   @id @default(uuid())
  subject_type          String   // journalist | outlet
  journalist_id         String?
  outlet_id             String?
  kind                  String
  value                 String
  value_norm            String
  value_hash            String   // sha256 of value_norm — for dedupe without indexing PII
  verification_state    String   @default("unverified")
  lawful_to_store       Boolean  @default(false)
  is_primary            Boolean  @default(false)
  verified_at           DateTime?
  verified_via_citation_id String?
  notes                 String?
  created_at            DateTime @default(now())
  updated_at            DateTime @updatedAt

  journalist Journalist? @relation("JournalistContacts", fields: [journalist_id], references: [id])
  outlet     Outlet?     @relation("OutletContacts",     fields: [outlet_id],     references: [id])

  @@index([value_hash])
  @@index([journalist_id, kind, is_primary])
  @@index([outlet_id, kind, is_primary])
  // CHECK: exactly one of journalist_id / outlet_id is non-null (enforced in app).
}

// =====================================================================
// PROVENANCE
// =====================================================================

model Citation {
  id            String   @id @default(uuid())
  source_type   String
  source_url    String?
  source_local_path String?  // for local artifacts
  observed_at   DateTime
  captured_by   String?     // operator id
  notes         String?
  payload_hash  String?     // SHA256 of cached snapshot for offline reproducibility
  created_at    DateTime @default(now())

  links ProvenanceLink[]

  @@index([source_type])
  @@index([observed_at])
}

model ProvenanceLink {
  id            String  @id @default(uuid())
  citation_id   String
  target_type   String  // 'Journalist' | 'Outlet' | 'Article' | 'Byline' | 'Affiliation' | 'ContactMethod' | ...
  target_id     String
  target_field  String? // e.g. 'bio_short'; null = whole record
  assertion_kind String @default("supports")
  confidence    String  @default("medium")
  created_at    DateTime @default(now())

  citation Citation @relation(fields: [citation_id], references: [id])

  @@index([target_type, target_id])
  @@index([citation_id])
}

// =====================================================================
// REVIEW QUEUE & MERGES
// =====================================================================

model ReviewItem {
  id              String   @id @default(uuid())
  kind            String
  status          String   @default("pending")
  proposal_payload_json String  // diff to apply
  current_payload_json  String? // snapshot of current relevant state
  source_citation_id String?
  source_import_batch_id String?
  created_at      DateTime @default(now())
  decided_at      DateTime?
  decided_by      String?
  decision_note   String?

  @@index([status, kind])
  @@index([source_import_batch_id])
}

model MergeEvent {
  id              String   @id @default(uuid())
  entity_type     String
  merged_from_id  String
  merged_into_id  String
  merge_strategy  String
  field_resolutions_json String
  reversible_until DateTime?
  created_at      DateTime @default(now())
  created_by      String?

  @@index([entity_type, merged_into_id])
  @@index([entity_type, merged_from_id])
}

// =====================================================================
// IMPORT BATCHES
// =====================================================================

model ImportBatch {
  id          String   @id @default(uuid())
  source_type String   // csv | sheet | bucketer | url
  label       String
  state       String   @default("uploaded")  // uploaded | mapping | previewing | committing | committed | aborted
  row_count   Int      @default(0)
  started_at  DateTime @default(now())
  finished_at DateTime?
  notes       String?

  rows ImportBatchRow[]

  @@index([state])
}

model ImportBatchRow {
  id        String  @id @default(uuid())
  batch_id  String
  row_index Int
  raw_json  String   // exact original row
  mapped_json String? // normalized record proposal
  decision  String   @default("pending")  // pending | approved | rejected | merged
  decided_at DateTime?
  decision_note String?

  batch ImportBatch @relation(fields: [batch_id], references: [id])

  @@unique([batch_id, row_index])
}

// =====================================================================
// CLIENT OVERLAY  (every table carries client_id)
// =====================================================================

model Client {
  id           String   @id @default(uuid())
  slug         String   @unique  // matches sevenfold/clients/<slug>
  display_name String
  archived_at  DateTime?
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt

  campaigns         Campaign[]
  outreach_statuses OutreachStatus[]
  outreach_events   OutreachEvent[]
  client_notes      ClientNote[]
  client_tags       ClientTag[]
  approvals         ClientApproval[]
}

model Campaign {
  id              String   @id @default(uuid())
  client_id       String
  name            String
  slug            String
  objective_short String?
  embargo_until   DateTime?
  state           String   @default("draft")
  start_date      DateTime?
  target_end_date DateTime?
  lead_operator   String?
  // Versioned JSON: approved_messaging, approved_claims, forbidden_claims, legal_caveats,
  // embargo_kind, exclusivity_plan, tiering_and_sequencing, outreach_windows,
  // spokesperson_availability, geographic_constraints, sensitive_topics,
  // competitor_conflicts, approval_requirements, source_fact_check_requirements.
  // Validated by Zod in the service layer.
  constraints_json String?
  // When true, exports require the constraints panel filled before generating an
  // outreach-ready brief. Draft exports are still allowed.
  constraints_required Boolean @default(false)
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  client Client @relation(fields: [client_id], references: [id])
  lists  CampaignList[]
  events OutreachEvent[]

  @@unique([client_id, slug])
  @@index([client_id, state])
}

model CampaignList {
  id          String   @id @default(uuid())
  campaign_id String
  name        String
  description String?
  state       String   @default("draft")
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  campaign Campaign @relation(fields: [campaign_id], references: [id])
  contacts CampaignContact[]

  @@index([campaign_id])
}

model CampaignContact {
  id              String   @id @default(uuid())
  campaign_list_id String
  journalist_id   String?
  outlet_id       String?
  target_score    Int?     // 1..5
  target_rationale String?  // CLIENT-PRIVATE
  pitch_angle     String?  // CLIENT-PRIVATE
  suitability_note String? // CLIENT-PRIVATE
  exclusion_flag  Boolean  @default(false)
  exclusion_reason String?
  embargo_note    String?
  approval_state  String   @default("draft")
  // Versioned JSON: narrative_angle, coverage_rationale, evidence_byline_ids[],
  // likely_objections, preferred_framing, competing_narratives, confidence (low|medium|high),
  // source_citations_json (citation ids), operator_notes, exclusivity_window?
  // Validated by Zod in service layer. v1 keeps this as JSON; promote columns in v1.1
  // only if a field becomes query-relevant.
  narrative_fit_json String?
  added_at        DateTime @default(now())
  added_by        String?

  campaign_list CampaignList @relation(fields: [campaign_list_id], references: [id])
  journalist    Journalist?  @relation(fields: [journalist_id], references: [id])
  outlet        Outlet?      @relation(fields: [outlet_id],     references: [id])

  @@unique([campaign_list_id, journalist_id, outlet_id])
  @@index([campaign_list_id])
  @@index([journalist_id])
  @@index([outlet_id])
  // CHECK: at least one of journalist_id / outlet_id is non-null (enforced in app).
}

model OutreachStatus {
  id            String   @id @default(uuid())
  client_id     String
  journalist_id String
  state         String   @default("none")
  // unknown | cold | neutral | warm | hot. Operator-set in v1; v1.1 may add a
  // derived suggestion, but operator value always wins.
  relationship_warmth String @default("unknown")
  last_event_at DateTime?
  // Home for soft signals not yet warranting structured fields:
  // cooldown timing, intro path notes, follow-up fatigue, etc.
  notes_private String?
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt

  client     Client     @relation(fields: [client_id], references: [id])
  journalist Journalist @relation(fields: [journalist_id], references: [id])

  @@unique([client_id, journalist_id])
  @@index([client_id, state])
}

model OutreachEvent {
  id            String   @id @default(uuid())
  client_id     String
  journalist_id String
  campaign_id   String?
  kind          String
  channel       String?
  summary_private String?
  external_ref  String?
  created_at    DateTime @default(now())
  created_by    String?

  client     Client     @relation(fields: [client_id], references: [id])
  journalist Journalist @relation(fields: [journalist_id], references: [id])
  campaign   Campaign?  @relation(fields: [campaign_id], references: [id])

  @@index([client_id, journalist_id, created_at])
  @@index([campaign_id])
}

model ClientNote {
  id            String   @id @default(uuid())
  client_id     String
  journalist_id String?
  outlet_id     String?
  campaign_id   String?
  body_md       String
  created_at    DateTime @default(now())
  created_by    String?

  client     Client      @relation(fields: [client_id], references: [id])
  journalist Journalist? @relation(fields: [journalist_id], references: [id])
  outlet     Outlet?     @relation(fields: [outlet_id], references: [id])

  @@index([client_id])
  @@index([client_id, journalist_id])
  @@index([client_id, outlet_id])
  @@index([client_id, campaign_id])
}

model ClientTag {
  id        String  @id @default(uuid())
  client_id String
  name      String
  kind      String
  created_at DateTime @default(now())

  client Client @relation(fields: [client_id], references: [id])

  @@unique([client_id, name])
}

model ClientApproval {
  id           String   @id @default(uuid())
  client_id    String
  subject_type String   // 'campaign' | 'campaign_list' | 'campaign_contact' | 'message_draft' | ...
  subject_id   String
  state        String   @default("pending")
  decided_by   String?
  decided_at   DateTime?
  note         String?
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt

  client Client @relation(fields: [client_id], references: [id])

  @@index([client_id, subject_type, subject_id])
}
```

## Notes per model

- **`Journalist`** — `display_name_norm` is the canonical search/dedupe key (lower + Unicode-fold + collapse spaces). The merge pointer `merged_into_id` lets queries transparently follow redirects.
- **`Outlet`** — `home_url_host` is normalized (strip scheme, www, trailing slash, lowercase) so URL-based dedupe is cheap.
- **`Affiliation`** — modeled as time-bounded so a journalist can have history. `is_current` is denormalized for fast filtering.
- **`Article` / `Byline`** — `url_canonical` is the primary dedupe key. Bylines are an explicit join with `position` and `confidence` because byline parsing is noisy.
- **`Tag` + per-target join tables** — explicit join tables (not Prisma implicit M2M) so we can attach per-link confidence, scope, citation. Three join tables (Journalist, Outlet, Article) keep type safety obvious.
- **`ContactMethod`** — polymorphic by `subject_type` + nullable FKs. `lawful_to_store` defaults `false`. `value_hash` lets us dedupe and check existence without indexing raw email addresses; `value_norm` is still stored in cleartext for display, but only the hashed form is indexed.
- **`Citation` / `ProvenanceLink`** — citations are stand-alone; links are polymorphic over target via `target_type + target_id + target_field`. This generality is required so a single citation can support multiple facts.
- **`ReviewItem`** — universal pending-change record. `proposal_payload_json` carries the exact diff to apply. Approval triggers a service-layer applier that writes the change.
- **`MergeEvent`** — append-only history. `field_resolutions_json` records per-field decisions for audit.
- **`ImportBatch` / `ImportBatchRow`** — every row is a candidate `ReviewItem` after mapping. The batch is the operator's UI handle.
- **Client overlay tables** — every table carries `client_id` directly. No transitive client_id; we don't want the schema to allow joins that "find" client_id via FK chains and forget to filter.

## Indexes & query considerations

- Search-heavy paths:
  - Journalist by `display_name_norm` (prefix/contains via FTS5 in v1.1+; LIKE in v1).
  - Outlet by `home_url_host`.
  - Article by `outlet_id, published_at desc`.
  - Tag rollups: `JournalistTag.tag_id`, `OutletTag.tag_id`, `ArticleTag.tag_id`.
- Provenance lookup is always `target_type + target_id` indexed.
- Review queue is `status + kind` indexed for the reviewer dashboard.
- Outreach status is keyed `(client_id, journalist_id)`.

### FTS5

SQLite's FTS5 is well-suited for search across `Journalist.display_name`, `Outlet.name`, `Article.title`, and `ClientNote.body_md`. Decision: ship without FTS5 in v1 (use simple LIKE + normalized columns) and add FTS5 virtual tables in v1.1 once the data shapes stabilize. We'll keep the FTS layer in raw SQL migrations, not Prisma models.

### Cross-cutting derived fields

`Journalist.confidence_score` and `Journalist.freshness_signal` are derived on write. We compute them in the service layer on any mutation that touches the underlying provenance / byline / contact data. We do *not* try to compute them via DB triggers in v1.

## Migration risks

1. **Polymorphism on SQLite.** `ContactMethod.subject_type` and `ProvenanceLink.target_type` are stringly-typed. We mitigate with strict service-layer validators and integration tests. Long-term, if we move to Postgres, we may move to dedicated tables per target type. Keep the service interface narrow so that swap is mechanical.
2. **JSON-as-text.** Prisma's `String` for JSON-shaped fields means we lose schema validation at the DB layer. We'll write Zod schemas next to the Prisma model and never hand-roll parsing.
3. **Soft merges create legacy ids in queries.** Always resolve `merged_into_id` in the data-access layer so callers don't accidentally surface a deprecated journalist. Add a `Journalist.findActive(id)` helper that follows the chain.
4. **`url_canonical` collision risk.** URL canonicalization is hard. Document the exact normalization rules in `services/url/canonicalize.ts` and version them. If rules change, write a one-shot migration to recanonicalize and report collisions to the review queue.
5. **`value_hash` salting.** The hash is unsalted by design (it's a dedupe key, not a password). Document this; do not export the hash table. Salt would prevent dedupe.
6. **Index bloat from per-link confidence.** If `JournalistTag` rows grow large (10k+ journalists × many tags), revisit whether `confidence` should live there or be derived at read-time. Acceptable for v1.
7. **No client_id on global tables.** Enforce via schema review and a static check in CI (search global tables' generated types for `client`, fail if found).
8. **Reversible migrations.** Bo's pattern (per ProjectReckoner) is: down-migrations exist for every up-migration *or* there is a documented one-way cutover. We follow that here.

## Future schema bridges

- `Tag.external_ids_json` reserves space for `{ tabulator_id, ontology_core_slug }` so the Tabulator bridge can map without schema change.
- `Citation.source_type = 'tabulator_artifact'` and `'bucketer_signal'` are reserved so Bucketer / Tabulator imports can land in the existing provenance flow.
- `OutreachEvent` is shaped so it can be mirrored to TaskReckoner's actor/assignment/run ledger as one row per event.
- `ImportBatch.source_type = 'sheet'` is reserved for the v1.1 Sheets adapter.

## Out of scope for this draft

- Authentication / users beyond `created_by` strings (single operator in v1).
- Soft-delete strategy beyond merges (v1 hard-deletes are restricted to `ImportBatchRow` and `ReviewItem` rows that are fully resolved).
- Audit log of operator actions (we'll add a generic `OperatorEvent` table in v1.1 if it's clearly missed).

## Deferred (do not add in v1)

These were considered and intentionally excluded from the v1 schema. See `BROADLISTER_OPERATIONAL_MODEL_AND_BOUNDARIES.md` for the reasoning.

- A global `Journalist.status` enum. Forbidden — it invites cross-client opinion onto a shared row.
- A global `Journalist.do_not_contact` flag. Use `CampaignContact.exclusion_flag` per client.
- A separate `NarrativeFitEvidence` join table. v1 keeps evidence ids inside `narrative_fit_json.evidence_byline_ids`; promote in v1.1 only if querying-by-evidence becomes a real workflow.
- Structured columns for individual `Campaign.constraints_json` fields. JSON until v1 use shows the shape is stable.
- A computed engagement score on `Journalist`. v1 surfaces raw `OutreachEvent` history; no scoring.
- Auto-derived `relationship_warmth`. v1 is operator-set only.
- Multi-axis preference matrix (channel × timing × topic). Stored in `OutreachStatus.notes_private` until shape is real.
- A `Journalist.relationship_status` field. **Forbidden** — relationship status is per-client, lives on `OutreachStatus` only.
- Send-side dependencies of any kind (`nodemailer`, `@sendgrid/mail`, `mailgun.js`, `@aws-sdk/client-ses`, equivalents). The build deny-list test fails if any are reachable.
