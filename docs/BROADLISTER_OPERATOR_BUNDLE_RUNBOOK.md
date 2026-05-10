# BroadLister Operator Bundle Runbook

Status: operator handling guidance for local JSON bundle artifacts. This does not authorize Tabulator runtime integration, backend file writing, contact export, or external writes.

## Purpose

BroadLister can produce a local JSON file containing reviewed public media artifacts for future Tabulator import work. The file is a portable artifact, not an automatic integration.

Use it when:

- You want a reviewed public article/outlet/byline/tag/provenance bundle for later Tabulator testing.
- You need a local handoff artifact for offline adapter development.
- You want to inspect which reviewed BroadLister media facts are export-safe.
- You want to run BroadLister's local offline dry-run validator before any future Tabulator-side import work.

Do not use it for:

- Client campaign strategy.
- Pitch angles or narrative fit.
- Contact lists or contact methods.
- Outreach execution.
- Direct Tabulator import before an approved Tabulator-side adapter exists.

## Generate A Bundle

1. Start BroadLister API and web app.
2. Open the web UI.
3. Go to `Exports`.
4. Review the Tabulator preview panel:
   - included article/outlet/byline/tag counts
   - omitted records and reasons
   - provenance coverage
   - safety flags
5. Optionally enter article IDs to scope the preview.
6. Confirm the checkbox:
   - this downloads a local JSON artifact only
   - this does not write to Tabulator
   - this does not call Tabulator
   - this does not include contact methods
   - this does not include client-private overlay fields
7. Click `Download local JSON bundle`.

## Filename

BroadLister generates:

```text
broadlister-tabulator-preview-bundle-YYYYMMDD-HHMMSS.json
```

Keep that name unless adding a short operator suffix. If adding a suffix, keep the timestamp and `.json` extension.

Recommended examples:

```text
broadlister-tabulator-preview-bundle-20260510-110000.json
broadlister-tabulator-preview-bundle-20260510-110000-sevenfold-media-review.json
```

## Where To Save It

Recommended local archive:

```text
/home/bxby/development/BroadLister/data/operator-exports/tabulator/
```

If that folder does not exist, create it manually when needed. Do not commit real exported bundles by default.

Do not save routine bundles into:

- client folders
- Google Drive
- Gmail drafts
- Tabulator data folders
- ProjectReckoner runtime folders
- public repos

Exception: tiny sanitized fixtures may be committed under `docs/sample-artifacts/` for adapter planning/testing.

## Safety Confirmation Meaning

The checkbox is an operator acknowledgement, not a security boundary. It confirms:

- Browser downloads a local file.
- BroadLister does not write a backend file.
- BroadLister does not call Tabulator.
- BroadLister does not call ProjectReckoner.
- Bundle excludes contact methods.
- Bundle excludes client-private overlays.
- Bundle is still operator-controlled after download.

After download, file handling is the operator's responsibility.

## Inspect Before Use

Open the JSON in a local editor and check:

- `schema` is `BroadListerReviewedMediaExportBundle.v1`.
- `export_schema_version` is `v1`.
- `source_system` is `broadlister`.
- `export_scope` is `reviewed_public_media`.
- `summary.article_count` is expected.
- `summary.provenance_packet_count` is greater than zero for useful imports.
- `eligibility_policy.requires_reviewed_records` is `true`.
- `eligibility_policy.requires_provenance` is `true`.
- `eligibility_policy.excludes_client_overlays` is `true`.
- `eligibility_policy.excludes_outreach_fields` is `true`.
- `redaction_report.redacted_field_count` is `0`.
- `omitted` records make sense.

Search the file for forbidden strings before any future import:

```text
contact_method
email
phone
client_id
campaign_id
pitch_angle
narrative_fit
relationship_warmth
exclusion_reason
embargo_note
```

Note: forbidden strings may appear inside `redaction_report.denied_fields_checked` as policy labels. They must not appear as exported artifact fields or values.

## What Not To Do

- Do not upload the bundle to Tabulator manually.
- Do not paste the bundle into an API console.
- Do not write scripts that POST the bundle to Tabulator from BroadLister.
- Do not add contact data to the bundle.
- Do not add client/campaign/private fields to the bundle.
- Do not edit the JSON to bypass omitted-record or provenance checks.
- Do not treat the bundle as a media list for client delivery.
- Do not place real bundles in Git unless Bo explicitly approves and the data is sanitized.

## Future Tabulator Import Relationship

BroadLister now includes a local in-memory dry-run validator for downloaded bundle payloads. It validates schema, forbidden fields, provenance, duplicate/idempotency keys, and the proposed Tabulator mapping plan without writing files or calling Tabulator.

The planned next step is still Tabulator-side offline adapter work:

1. Validate a local BroadLister bundle file.
2. Produce a dry-run operation plan.
3. Show matches, creates, skips, conflicts, and provenance handling.
4. Commit only after operator approval inside Tabulator.

BroadLister remains the bundle producer. Tabulator owns any importer. Direct BroadLister-to-Tabulator runtime integration remains deferred.

## If A Bundle Looks Unsafe

Stop and do not use it. Record:

- file path
- generated timestamp
- preview scope
- suspicious field or value
- BroadLister commit/tag if visible

Then rerun BroadLister verification before generating another bundle:

```bash
pnpm verify
pnpm check:global-models
pnpm check:denylist
pnpm build
pnpm test:e2e
pnpm test:mobile
```
