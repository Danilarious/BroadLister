# BroadLister Bucketer Bridge Plan

Status: planning only. No Bucketer integration, BroadLister runtime dependency, schema change, external write, contact export, or ProjectReckoner repo change is implemented here.

Hermes review: `PASS WITH CONDITIONS`.

Conditions:

- File-first before API-backed.
- Review queue before mutation.
- No contact export or outreach leakage.
- No client/campaign overlay leakage.
- No ontology mutation from Bucketer or BroadLister in v1.
- Stable IDs and provenance required from day one.
- Tabulator `validate`/`dry_run` remains the next safety layer before deeper integration.

## Conceptual Relationship

Bucketer and BroadLister should connect as adjacent instruments, not as one runtime system.

- Bucketer is the signal/news monitoring instrument. It watches external sources, scores signals, groups them into Buckets, and produces digests/suggestions.
- BroadLister is the journalist/outlet/media-relationship intelligence instrument. It stores reviewed media authors, outlets, articles, bylines, tags, citations, review decisions, and client overlays.
- Bucketer can nominate public media signals for BroadLister review.
- BroadLister can nominate monitoring intent for Bucketer review.
- Neither system should directly mutate the other system's core records in v1.

Bridge concept:

- Bucketer -> BroadLister: "This monitored signal looks like a public article/byline/outlet worth reviewing for BroadLister."
- BroadLister -> Bucketer: "This reviewed topic/outlet/list suggests a monitoring bucket/source strategy Bucketer may want to track."

## Bucketer Architecture Summary

Read-only inspection path: `/home/bxby/development/reckoner-app/bucketer`.

Relevant Bucketer tables:

- `sources`: source registry with `id`, `name`, `url`, `source_type`, fixture path, enabled flag, health status/error, timestamps.
- `signals`: observed items with `id`, `url`, `title`, `summary`, `source_id`, `source_type`, `published_at`, `score`, `bucket_id`, `tags_json`, `raw_metadata_json`, timestamps.
- `digests`: generated digest payloads with `id`, `bucket_id`, `title`, `payload_json`, `generated_at`.
- `buckets`: monitoring buckets with `id`, `name`, `description`, `keywords_json`, `tags_json`, `config_json`, timestamps.

Relevant Bucketer routes:

- `GET /buckets`, `POST /buckets`, `PATCH /buckets/:id`, `DELETE /buckets/:id`.
- `GET /signals`, `GET /signals/:id`.
- `GET /sources`, `POST /sources`, `DELETE /sources/:id`, `GET /sources/health`.
- `GET /digest`.
- Discovery suggestions are advisory and require approval before auto-add.

Relevant Bucketer adapters:

- RSS, Brave, Exa, F5Bot, Firecrawl, Scrapling.
- Sources fetch signals through an adapter factory.

Relevant behavior:

- Digest generation fetches enabled sources, scores signals, classifies them into buckets by keywords/config aliases, emits `DigestRoundup.v1`, and persists signals.
- Signal IDs are deterministic from URL, published timestamp, and source ID when no explicit ID is provided.
- Discovery can read Tabulator tags read-only if configured, but Bucketer should not mutate ontology in v1.

## Recommended Data Flow: Bucketer To BroadLister

First bridge artifact: `BroadListerReviewCandidate.v1`.

Flow:

1. Bucketer ingests external sources and persists signals.
2. Bucketer scores/classifies a signal into a Bucket.
3. Operator selects a signal or digest section for BroadLister review.
4. Bucketer exports a local JSON/JSONL candidate bundle.
5. BroadLister imports candidates into the Review Queue only.
6. Operator reviews each candidate.
7. Approved candidates may create or match local BroadLister records:
   - `Article`
   - `Outlet`
   - `Byline`
   - `Journalist` public identity proposal only when byline evidence supports it
   - `Tag`
   - `Citation`
   - `ProvenanceLink`
8. Rejected/deferred candidates mutate no global media records.

Candidate shape:

```ts
interface BroadListerReviewCandidateV1 {
  schema: "BroadListerReviewCandidate.v1";
  source_system: "bucketer";
  candidate_id: string;
  generated_at: string;
  bucketer: {
    signal_id: string;
    bucket_id?: string;
    bucket_name?: string;
    source_id?: string;
    source_name?: string;
    source_type?: string;
    score?: number;
    tags?: string[];
    rationale?: string;
  };
  public_media_signal: {
    canonical_url: string;
    original_url?: string;
    url_hash: string;
    title: string;
    summary?: string;
    published_at?: string;
    detected_outlet_name?: string;
    detected_author_or_byline?: string;
    source_url?: string;
  };
  provenance: {
    observed_at: string;
    captured_by: "bucketer";
    source_url: string;
    source_type: string;
    raw_metadata_pointer?: string;
    payload_hash?: string;
  };
}
```

Boundary:

- Bucketer should not create BroadLister journalists, outlets, articles, or campaign overlays directly.
- BroadLister should treat inbound authors as proposals until reviewed.
- BroadLister should treat outlet names as match candidates, not verified outlets.

## Reverse Flow: BroadLister To Bucketer

First reverse artifact: `BucketerBucketSuggestion.v1`.

Flow:

1. Operator selects a reviewed BroadLister topic, outlet set, campaign list, or global media list.
2. BroadLister generates a local bucket suggestion artifact.
3. Bucketer validates and previews the suggestion.
4. Operator reviews proposed bucket/source/keyword changes inside Bucketer.
5. Only approved suggestions create or update Bucketer buckets/sources.

Suggestion shape:

```ts
interface BucketerBucketSuggestionV1 {
  schema: "BucketerBucketSuggestion.v1";
  source_system: "broadlister";
  suggestion_id: string;
  generated_at: string;
  source_scope: "global_topic" | "outlet_set" | "campaign_list" | "media_list";
  broadlister_refs: {
    topic_ids?: string[];
    outlet_ids?: string[];
    campaign_list_id?: string;
    tag_ids?: string[];
  };
  suggested_bucket: {
    id_hint: string;
    name: string;
    description?: string;
    keywords: string[];
    aliases: string[];
    negative_keywords?: string[];
    tags: string[];
    candidate_source_urls?: string[];
  };
  rationale: string;
  confidence: "low" | "medium" | "high";
  provenance: Array<{
    citation_id?: string;
    source_url?: string;
    observed_at: string;
    target_kind: "topic" | "outlet" | "tag" | "campaign_list";
    target_id: string;
  }>;
}
```

Boundary:

- BroadLister should not create Bucketer buckets automatically.
- Campaign-list-derived suggestions must be clearly scoped and must not leak private client notes, pitch angles, relationship warmth, exclusions, or outreach status.
- Bucketer owns monitoring source configuration.

## File-First Vs API-Backed

Recommendation: start file-first and review-gated.

Use local files first because:

- Bucketer and BroadLister remain operationally independent.
- Operators can inspect bridge artifacts before import.
- Stable IDs, provenance, and duplicate handling can be tested without live coupling.
- Rollback is simpler when imports land in review/staging queues.

API-backed bridge may be considered later only after:

- schema contracts stabilize
- idempotency keys are proven
- review UI is acceptable
- forbidden-field filtering is tested
- rollback behavior is documented and tested
- Bo approves runtime coupling

API transport must replace file movement only. It must not bypass preview/review gates.

## Provenance

Every bridge artifact should include:

- source system
- source system record ID
- generated timestamp
- importer timestamp
- URL and canonical URL hash
- source adapter/type
- source URL
- bucket/list/tag context
- payload hash
- review item ID after BroadLister import
- review decision, reviewer, and reviewed timestamp after operator action

BroadLister should create `Citation` and `ProvenanceLink` records only after review approves or links the candidate.

## Client Isolation

Default bridge artifacts should be global/public only.

Rules:

- Bucketer-to-BroadLister candidates are global media facts only.
- BroadLister-to-Bucketer suggestions derived from client/campaign lists must be explicitly marked as scoped suggestions.
- Client-private rationale must not cross.
- Campaign overlays must never be serialized into generic Bucketer buckets.
- BroadLister review items must not inherit a client ID unless a later, explicitly approved client-scoped bridge exists.

## Safe Fields

Safe Bucketer-to-BroadLister fields:

- public URL
- canonical URL
- title
- public summary/snippet
- published date
- source name/type
- public outlet name
- public byline text
- bucket ID/name
- tags/topics
- score/confidence
- rationale
- provenance pointers

Safe BroadLister-to-Bucketer fields:

- reviewed topic/list/outlet names
- public outlet URLs
- public RSS/homepage/search URLs
- global tags/topics
- suggested keywords/aliases
- negative keywords/exclusions for monitoring only
- bucket description
- rationale
- confidence
- reviewed provenance

## Forbidden Fields

Never cross this bridge:

- contact methods
- emails
- phone numbers
- social handles intended for outreach
- outreach status
- pitch notes
- private relationship notes
- client-private notes
- narrative fit
- campaign strategy
- campaign constraints
- embargo notes
- relationship warmth
- exclusions and exclusion reasons
- approval rationale for client campaigns
- raw scraper payloads with private/hidden fields
- cookies, sessions, auth headers, API keys, or credentials
- unreviewed ontology mutation directives

## Review Gates

Bucketer-to-BroadLister:

- validate schema
- scan forbidden fields
- detect duplicate canonical URL/signal ID
- preview candidate list
- import to BroadLister Review Queue only
- operator approve/reject/defer/merge
- create/link records only after approval

BroadLister-to-Bucketer:

- validate schema
- scan forbidden fields
- preview bucket/source changes
- detect duplicate bucket ID/source URL
- operator approve/reject/defer
- create/update Bucketer records only after approval inside Bucketer

## Failure Modes And Rollback

Failure modes:

- duplicate article URLs with conflicting byline/outlet data
- weak author/outlet matching by name
- stale Bucketer source metadata
- Bucketer raw metadata containing unsafe fields
- client-specific BroadLister context leaking into bucket suggestions
- ontology/tag drift between systems
- operator confusion between signal score and verified media fact

Rollback:

- every import gets a `bundle_id` or `import_run_id`
- pending review items can be removed by import run before approval
- rejected/deferred items remain auditable but inactive
- promoted records retain source provenance and should be unlinked/deactivated, not blindly deleted
- Bucketer bucket/source commits should be transactional when implemented
- generated bridge artifacts are local files and can be deleted without changing either DB

## MVP Bridge Proposal

MVP A: Bucketer-to-BroadLister candidate intake.

- Bucketer exports selected signals as `BroadListerReviewCandidate.v1` JSON/JSONL.
- BroadLister preview validates and displays title, URL, outlet, byline, bucket, tags, score, rationale, and provenance.
- BroadLister commit creates review items only.
- Approval creates/matches Article, Outlet, Byline, Tag, Citation, and ProvenanceLink.
- Reject/defer mutates no global records.

MVP B: BroadLister-to-Bucketer bucket suggestion.

- BroadLister exports selected global topic/outlet/list as `BucketerBucketSuggestion.v1`.
- Bucketer validates and previews the suggested bucket/source/keyword plan.
- Bucketer operator approves before bucket/source creation.

## Deferred Features

- live API bridge
- automatic bucket creation
- automatic BroadLister entity creation
- contact enrichment
- outreach workflows
- client overlay syncing
- bidirectional real-time sync
- ontology writes
- automatic follow-up scheduling
- full Tabulator-backed artifact lifecycle beyond validate/dry-run
- complex entity resolution beyond URL/hash/name-assisted review

## Recommended Sequence

1. Complete this planning package.
2. Keep Tabulator-side offline `validate`/`dry_run` as the next implementation safety layer.
3. After that, implement Bucketer-to-BroadLister file candidate contract and tests.
4. Add BroadLister Review Queue import for Bucketer candidates.
5. Add BroadLister-to-Bucketer bucket suggestion contract and Bucketer-side preview later.
