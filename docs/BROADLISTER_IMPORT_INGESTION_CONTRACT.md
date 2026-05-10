# BroadLister Import And Ingestion Contract

## CSV Contact Imports

BroadLister accepts pasted CSV rows or a local `.csv` file selected in the browser. The browser reads the file locally and sends CSV text to the API.

Supported aliases:

- `name`, `full name`, `journalist`, `author` → `display_name`
- `outlet`, `publication`, `company` → `outlet_name`
- `role`, `title`, `job title` → `role_title`
- `email` → `email`
- `beat`, `topic`, `topics` → `tag`
- `location`, `region` → `location_region`
- `profile url`, `linkedin`, `x`, `twitter` → `profile_url`
- `notes` → `notes`

Workflow:

1. Operator uploads or pastes CSV.
2. API previews row count, detected fields, and sample mapped rows.
3. Operator commits the batch.
4. API creates `ImportBatch`, `ImportBatchRow`, and `ReviewItem` records.
5. No journalist, outlet, tag, or contact method becomes canonical until review.

Review item kinds:

- `bulk_import_row` for journalist/outlet candidates.
- `contact_method_candidate` for email candidates.
- `tag_candidate` for topic/beat candidates.

Contact method candidates carry `verification_state: "unverified"` and `lawful_to_store: false`.

XLSX is deferred. Reason: CSV covers the immediate workflow without adding binary parsing risk. Add XLSX later behind the same preview/commit contract if operators need spreadsheet-native intake.

## Article URL Ingestion

Input:

- `url`: required normal article URL.
- `html`: optional pasted HTML for local/offline extraction testing or blocked sites.

Live fetch behavior:

- Server-side bounded fetch.
- 10 second timeout.
- HTML content type only.
- 2 MB response limit.
- Operator-visible error if fetch is blocked.

Extraction precedence:

1. JSON-LD `NewsArticle`, `Article`, `ReportageNewsArticle`, or `BlogPosting`.
2. Canonical link, OpenGraph, Twitter, and standard meta tags.
3. HTML title and URL/domain fallback.

Extracted fields:

- canonical URL
- title
- outlet name/domain
- author/byline
- published date
- language
- description/excerpt
- deterministic candidate tags
- Trace Finance relevance candidate when terms match

Review item kinds:

- `outlet_candidate`
- `article_candidate`
- `journalist_candidate`
- `byline_candidate`
- `tag_candidate`
- `article_tag_candidate`
- `client_relevance_candidate`

Byline, article-tag, and client-relevance proposals are advisory until required linked records exist and an operator applies them in the proper scope.

## Trace Finance Relevance Rules

Current deterministic trigger:

- `stablecoin` or `stablecoins`, and
- one of payments/settlement/cross-border terms, or
- one of policy/regulation/central-bank/ban terms.

The result is a review-gated `client_relevance_candidate`, not a global fact and not an outreach action.

LLM assistance is deferred. Future LLM output may draft advisory relevance explanations, suggested pitch angles, or tag proposals, but must never directly mutate canonical records.
