# BroadLister Bucketer Entity Mapping

Status: planning only. This maps future bridge concepts; it does not change schemas or implement integration.

## Mapping Summary

| Bucketer concept | Bucketer fields | BroadLister target | Bridge behavior |
| --- | --- | --- | --- |
| `Bucket` | `id`, `name`, `description`, `keywords_json`, `tags_json`, `config_json` | `Tag`, `CampaignList`, review metadata | Use as monitoring context. Do not create client campaign lists automatically. |
| `Signal` | `id`, `url`, `title`, `summary`, `published_at`, `score`, `bucket_id`, `tags_json`, `raw_metadata_json` | `ReviewItem`, then possible `Article` | Import as review candidate only. |
| `Source` | `id`, `name`, `url`, `source_type`, health fields | `Citation`, `ImportBatch`, source metadata | Preserve as provenance; do not create outreach sources. |
| `Topic` | bucket tags/keywords/config aliases | `Tag` | Map to global tags/topics only after review. |
| `Outlet` | detected domain/source/outlet label | `Outlet` | Resolve by normalized name/home URL; propose if uncertain. |
| `Article` | signal URL/title/summary/published date | `Article` | Match by canonical URL; create only after review approval. |
| `Digest` | `DigestRoundup.v1` sections/items | `ImportBatch`, grouped review candidates | Treat digest as batch/provenance context. |
| Adapter result | source-specific raw metadata | `Citation` / `ProvenanceLink` | Store compact provenance pointers; do not dump raw unsafe metadata. |

## Bucketer Bucket To BroadLister

Bucketer Buckets are monitoring containers, not relationship objects.

Mapping guidance:

- Bucket `id` -> BroadLister inbound candidate `source_context.bucket_id`.
- Bucket `name` -> review display label.
- Bucket `keywords`/`aliases` -> suggested global `Tag` matches.
- Bucket `tags` -> suggested global `Tag` matches.
- Bucket `config` -> provenance/rationale only, after allowlist filtering.

Do not map Bucket directly to:

- `Campaign`
- `CampaignList`
- `Client`
- `OutreachStatus`
- relationship warmth

If a Bucket is client-inspired, keep that fact out of generic Bucketer-to-BroadLister candidates unless a future client-scoped bridge is approved.

## Bucketer Signal To BroadLister ReviewItem

Recommended review item payload:

```ts
interface BucketerSignalReviewItemPayloadV1 {
  schema: "BucketerSignalReviewItemPayload.v1";
  source_system: "bucketer";
  bucketer_signal_id: string;
  bucketer_bucket_id?: string;
  bucketer_source_id?: string;
  source_type?: string;
  canonical_url: string;
  url_hash: string;
  title: string;
  summary?: string;
  published_at?: string;
  detected_outlet_name?: string;
  detected_author_or_byline?: string;
  tags: string[];
  score?: number;
  rationale?: string;
  provenance: {
    source_url: string;
    observed_at: string;
    captured_by: "bucketer";
    payload_hash?: string;
  };
}
```

Review item kind should be future-specific, for example:

- `bucketer_signal_candidate`
- `bucketer_article_candidate`
- `bucketer_byline_candidate`

BroadLister should not mark the article, outlet, byline, or journalist as verified until the operator approves or merges.

## Inbound Authors

Author/byline handling rules:

- Treat inbound author text as public byline text.
- Do not infer contactability.
- Do not create a contact method.
- Do not create a verified journalist solely from a name string.
- Match existing journalist candidates by normalized display name plus outlet/article context.
- If ambiguous, create a byline/journalist proposal requiring manual review.
- Preserve Bucketer signal and source provenance.

Recommended states:

- `matched_existing_journalist`
- `propose_new_journalist`
- `ambiguous_author_name`
- `byline_only_no_journalist_record`

## Outlet Resolution

Resolution signals:

- canonical URL host
- source URL host
- detected outlet name
- existing BroadLister outlet slug/name_norm
- existing outlet home URL host

Rules:

- Exact home URL host match is strongest.
- Normalized outlet name match is useful but not sufficient alone when common.
- Unknown outlet creates an outlet proposal, not a verified outlet.
- Conflicts require manual review.

Recommended states:

- `matched_existing_outlet`
- `propose_new_outlet`
- `ambiguous_outlet`
- `source_only_no_outlet_record`

## Article Dedupe And Idempotency

Primary key:

- canonical URL hash.

Secondary signals:

- Bucketer signal ID.
- source ID.
- published date.
- normalized title.

Rules:

- Existing article by canonical URL should match.
- Existing review item by `source_system + bucketer_signal_id` should update or be reported as already imported.
- Same URL with different title/summary should create a conflict note, not duplicate article.
- Same author name across different outlets is not a journalist identity match by itself.

Suggested external source IDs:

```ts
type BroadListerBucketerExternalIds = {
  bucketer_signal_id?: string;
  bucketer_source_id?: string;
  bucketer_bucket_id?: string;
  bucketer_digest_id?: string;
  bucketer_candidate_key?: string;
};
```

Candidate key:

```text
sha256("bucketer|BroadListerReviewCandidate.v1|<canonical_url>|<published_at>|<source_id>")
```

## BroadLister To Bucketer Mapping

| BroadLister concept | Safe Bucketer target | Notes |
| --- | --- | --- |
| global `Tag` topic/beat | Bucket keyword/tag suggestion | Use global/reviewed tags only. |
| `Outlet` | source URL suggestion | Use public homepage/RSS/search URLs only. |
| `Article` cluster | bucket example/rationale | Use public article URLs only. |
| `CampaignList` | bucket suggestion source scope | Do not export client-private fields. |
| `Journalist` public byline context | source discovery hint only | Do not export contact methods or relationship status. |
| `Citation` / `ProvenanceLink` | suggestion provenance | Required for reviewed-source suggestions. |

BroadLister should generate a suggestion artifact. Bucketer should own create/update of `buckets` and `sources`.

## Topic And Ontology Alignment

Use ontology-core/Tabulator alignment as advisory metadata, not runtime coupling.

Recommended flow:

1. BroadLister tags retain local identity and optional external IDs.
2. Bucketer suggestions include tag names/slugs and optional ontology IDs when already approved locally.
3. Bucketer uses those tags for classification/suggestions only.
4. Neither Bucketer nor BroadLister writes ontology-core directly in v1.
5. Tabulator can later validate shared artifact contracts and provenance.

Do not:

- auto-merge tags across systems
- create ontology concepts from Bucketer signals
- rewrite BroadLister tags based on Bucketer scoring
- treat Bucketer score as semantic truth

## Provenance Mapping

Bucketer to BroadLister:

- `sources.id` -> citation source metadata.
- `sources.url` -> citation source URL.
- `signals.id` -> external source record ID.
- `signals.raw_metadata_json` -> raw metadata pointer or allowlisted summary only.
- `digests.id` -> import batch context if candidate came from a digest.
- adapter name/source type -> citation source type.

BroadLister to Bucketer:

- `Citation.id` -> suggestion provenance citation ID.
- `ProvenanceLink.id` -> suggestion support packet.
- `Tag.id`, `Outlet.id`, `CampaignList.id` -> local source refs only.
- source URLs -> candidate source URLs when public.

## Stable IDs

Bucketer-side candidate identity:

```text
bucketer_signal_id = existing Bucketer signal id
candidate_id = sha256("bucketer|candidate|<signal_id>|<canonical_url>")
url_hash = sha256(canonical_url)
```

BroadLister-side suggestion identity:

```text
suggestion_id = sha256("broadlister|bucket-suggestion|<source_scope>|<source_ids>|<version>")
```

Import run identity:

```text
import_run_id = sha256("<schema>|<bundle_sha256>|<imported_at>|<operator>")
```

## What Must Stay Proposal-Only

- inbound journalists
- inbound outlets without strong URL match
- new global tags/topics
- bucket creation from BroadLister
- source creation from BroadLister
- any campaign-list-derived monitoring hint

## Tests Required Before Implementation

- Bucketer candidate schema validation.
- Forbidden-field denylist scan.
- Contact-method absence.
- Client-overlay absence.
- Duplicate signal import idempotency.
- Canonical URL article matching.
- Ambiguous author remains proposal-only.
- Ambiguous outlet remains proposal-only.
- Reject/defer mutates no global records.
- Approval creates only expected BroadLister records.
- Bucketer suggestion export excludes client-private fields.
- No network calls in file import/export tests.
- No runtime dependency between BroadLister and Bucketer.
- Cross-client leakage test remains green.
