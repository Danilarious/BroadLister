# BroadLister Sevenfold Agent Brief

## When To Use BroadLister

Use BroadLister when Sevenfold needs to build, review, or export sourced media intelligence:

- Import journalist, outlet, article, contact, and tag records.
- Review proposed global records before accepting them.
- Build client-specific campaign lists from the global media graph.
- Record campaign narrative fit, constraints, approvals, exclusions, and relationship status.
- Export scoped media lists, markdown briefs, and source audits for operator review.

BroadLister is not a CRM, outreach automation tool, email sender, client project manager, or replacement for Sevenfold client folders.

## Workflow Mapping

- `06_media_lists/`: use exported campaign media list CSVs and markdown briefs after operator approval.
- `02_source_audit/`: use BroadLister source audit exports to support claims, provenance, and verification.
- `09_approvals/`: use approval notes and exported briefs as inputs for Bo/operator approval records.

BroadLister keeps global records reusable. Client-specific judgment belongs only in overlays: campaign contacts, campaign lists, approval records, outreach status, narrative fit, exclusions, and constraints.

## What Sevenfold Can Do

- Recommend records for operator review.
- Ask for exports after a campaign list is approved.
- Use source audit material to support client-facing media planning.
- Flag suspected duplicate journalists or weak provenance for review.
- Ask Codex or an operator to improve import mappings or UI affordances.

## What Sevenfold Cannot Do

- Send email, DMs, webhooks, or outreach from BroadLister.
- Queue, schedule, or automate follow-ups.
- Relax approval gates.
- Move client strategy into global records.
- Merge clients, campaigns, or overlays across scopes.
- Treat warmth, narrative fit, exclusions, or pitch angles as global journalist facts.
- Add runtime dependencies on Hermes, ProjectReckoner, Tabulator, TaskReckoner, Bucketer, or BusyIntern.

## Client Isolation Rules

- Global tables never carry `client_id`.
- Overlay tables must be scoped through client/campaign ownership.
- Exports must be requested through the owning client scope.
- Cross-client leakage test failures block release.
- If a field might contain client strategy, keep it out of global records.

## Approval Rules

Bo/operator approval is required before:

- Client-facing use of a media list export.
- Treating import proposals as accepted global records.
- Marking campaign list approval.
- Changing campaign constraints.
- Any new external integration.
- Any action that could send or schedule external communication.

If uncertain, stop and ask Bo. Do not infer approval from context.

## Export Acceptance Checklist

Before Sevenfold uses a BroadLister export for client work, confirm:

- Client scope is correct.
- Campaign scope is correct.
- Source audit is present.
- Review queue approvals are complete.
- `ClientApproval` is complete for the exported list or brief.
- Cross-client leakage test is passing in the current verified build.
- No outbound communication was triggered or queued.
