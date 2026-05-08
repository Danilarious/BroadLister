# BroadLister — Open Questions for Bo

**Status:** planning, 2026-05-08

These are the unresolved decisions and tradeoffs flagged during this planning pass. Each item lists the recommendation, the alternative(s), and what triggers a re-decision.

## 1. Repo name & eventual rename

- **Question:** Stick with `BroadLister` indefinitely, or plan a rename to `Sevenfold MediaDesk` later?
- **Recommendation:** Keep `BroadLister` until v1 ships. Rename is cheap once the schema is stable and ports are documented. No rename in this planning pass.
- **Trigger to revisit:** Bo decides on a public-facing name, or sevenfold profile asks.

## 2. Git initialization

- **Question:** Should the repo be a git repository now, or after the implementation plan is approved?
- **Recommendation:** Initialize git **after** Phase 0 closes and before Phase 1 begins, with Bo's explicit go-ahead. The current empty state is fine for planning.
- **Trigger to revisit:** When Codex's Phase 1 plan is approved.

## 3. Database choice — SQLite vs PGlite vs Postgres

- **Question:** Local single-file SQLite vs PGlite (in-process Postgres) vs a small local Postgres service.
- **Recommendation:** **SQLite via Prisma**, mirroring TaskReckoner / Tabulator / Bucketer. Strong local guarantees, single-file backup, same Prisma tooling.
- **Alternative — PGlite:** if Bo wants closer Postgres compatibility for future migration, PGlite is a reasonable swap; trade-off is younger ecosystem and slower bulk operations.
- **Alternative — Postgres service:** ruled out for v1; reintroduce only if multi-machine sync becomes real.
- **Trigger to revisit:** sync requirement appears, or Prisma SQLite hits a real limitation we can't work around.

## 4. Ports

- **Question:** Confirm `API 3021` and `web 4100` are free.
- **Recommendation:** Use them. They sit cleanly outside the ProjectReckoner range (3001 / 3002 / 3003 / 3011 / 4000 / 5173).
- **Trigger to revisit:** Conflict with anything Bo runs locally.

## 5. Storage location for `data/`

- **Question:** Repo-local (`./data/`) vs `XDG_DATA_HOME/broadlister/`.
- **Recommendation:** Default to repo-local for v1 — easy to inspect, easy to back up. Add an `BROADLISTER_DATA_DIR` env var for override.
- **Trigger to revisit:** Multi-machine setup, or Bo's preference for centralized data.

## 6. Single-operator vs minimal auth

- **Question:** Add a stub auth layer in v1, or pure single-operator?
- **Recommendation:** Pure single-operator in v1. Add `created_by`/`decided_by` string fields so a future auth layer plugs in cleanly.
- **Trigger to revisit:** A second operator joins.

## 7. Tag taxonomy seed list

- **Question:** Who finalizes the starter beat taxonomy? Codex via sevenfold review, or Bo directly?
- **Recommendation:** Codex drafts based on the starter list in `BROADLISTER_TAGGING_AND_ONTOLOGY_MODEL.md`; sevenfold reviews; Bo signs off in Phase 1.
- **Trigger to revisit:** Any beat that catches operator confusion in Phase 2 use.

## 8. Per-host article extraction recipe priority

- **Question:** Which outlets do we add recipes for first?
- **Recommendation:** Decide at Phase 4 entrance based on the active client's most-frequented outlets. Don't speculatively build recipes.
- **Trigger to revisit:** Phase 4 planning.

## 9. Tabulator coupling intensity in v1.3

- **Question:** Does v1.3 just *read* Tabulator tags, or also *write back* mappings?
- **Recommendation:** Read only. Operator can manually write back later. Schema reserves `Tag.external_ids_json` for the bridge regardless.
- **Trigger to revisit:** Operator pain from divergent tag stores.

## 10. TaskReckoner ledger mirroring

- **Question:** Does v1.3 actively post to TaskReckoner, or just *prepare* the events for posting later?
- **Recommendation:** Default off in v1.3; Bo flips it on per environment when the ledger schemas align.
- **Trigger to revisit:** TaskReckoner actor/assignment/run-ledger spec changes.

## 11. Sheets adapter feasibility without new credentials

- **Question:** Can v1.1 ship Sheets I/O without creating new Google credentials posture?
- **Recommendation:** Defer until Bo confirms credential approach. Ship CSV import in v1; Sheets only when credentials are settled.
- **Trigger to revisit:** Operator regularly hand-converting Sheets to CSV.

## 12. LLM-assisted enrichment opt-in

- **Question:** Which model and provider, and what cost ceiling?
- **Recommendation:** Defer to Phase 5 entrance. Modeled on Bucketer's `<$50 LLM credits` constraint posture; cap enforced in code.
- **Trigger to revisit:** Phase 5 planning.

## 13. Snapshot caching for citations — terms-of-service nuance

- **Question:** Which sources are OK to cache locally vs URL-only?
- **Recommendation:** Default cache on; per-host opt-out list. Operator-visible setting.
- **Trigger to revisit:** Outlet ToS objection or legal review.

## 14. `lawful_to_store` jurisdiction model

- **Question:** Is the boolean enough, or do we need region-specific flags (e.g. EU GDPR special-category)?
- **Recommendation:** Boolean for v1. Add a free-text `notes` field next to it. If multi-jurisdiction enforcement becomes a real workflow, escalate to a structured field.
- **Trigger to revisit:** Adding an EU-based client where compliance is operator-led.

## 15. Multi-machine sync direction

- **Question:** Will BroadLister ever sync between Bo's ThinkPad and another machine?
- **Recommendation:** Not in v1. The single-file SQLite + Syncthing path is *workable* but lossy on concurrent edits. If sync is real, reconsider PGlite + Electric in a focused spike.
- **Trigger to revisit:** A second operator or a second machine.

## 16. Repository topology — monorepo vs two repos

- **Question:** Single repo with `apps/api` + `apps/web` (pnpm workspace), or two repos?
- **Recommendation:** Single repo, pnpm workspace, mirroring `reckoner-app`'s shape. Two repos would fragment review and slow Codex's iteration loop.
- **Trigger to revisit:** Web team grows or web lifecycle diverges materially from API's.

## 17. CI / pre-commit hooks

- **Question:** Adopt the same pre-commit + lint/test hook pattern as ProjectReckoner?
- **Recommendation:** Yes. Replicate exactly so the operator's muscle memory is portable across repos.
- **Trigger to revisit:** Hook costs become prohibitive on slow runs (unlikely at this scale).

## 18. Soul / profile guidance for sevenfold review of BroadLister

- **Question:** Does sevenfold need a small addendum doc explaining BroadLister's role so its reviews don't drift into architecture territory?
- **Recommendation:** Yes — a short *advisory* note added to the sevenfold profile context (under `sevenfold-client-comms-os/_HOW_TO_USE_WITH_HERMES.md` or a sibling) stating sevenfold's BroadLister scope. This is **not** done in this planning pass; it's a small follow-up Bo or Hermes can author.
- **Trigger to revisit:** sevenfold accidentally weighs in on stack/architecture concerns.

## 19. Retention & backups for `data/broadlister.sqlite`

- **Question:** Default retention policy for backups (`data/backups/<UTC-timestamp>.sqlite`)?
- **Recommendation:** Keep last 7 daily + last 4 weekly. Old backups pruned by a script; never auto-deleted without operator config.
- **Trigger to revisit:** Disk pressure or operator preference.

## 20. UI fidelity — how polished does v1 look?

- **Question:** Is the v1 UI a working operator tool (functional, plain) or polished (design system, animations)?
- **Recommendation:** Functional and plain. Design refinement is Phase 3.5 / v1.1 if Bo wants. Don't burn cycles on polish before the cross-client safety tests pass.
- **Trigger to revisit:** Operator requests, demo audience, or sevenfold profile feedback.

---

## Questions raised by the operational model closeout

## 21. Which journalist relationship statuses should be first-class enums in v1?

- **Question:** The operational model lists ~22 candidate concepts (active, monitor, do_not_pitch, cooldown, embargo_safe, hostile_or_sensitive, previously_responsive, prefers_exclusives, etc.). Which deserve structured enum slots in v1, and which stay as `OutreachStatus.notes_private` text or `ClientTag` rows?
- **Recommendation:** v1 ships:
  - `OutreachStatus.state` (existing 8-value enum).
  - `OutreachStatus.relationship_warmth` (`unknown | cold | neutral | warm | hot`) — new in this closeout.
  - `CampaignContact.exclusion_flag` + `exclusion_reason` for "do not pitch".
  - Everything else as `notes_private` text or `ClientTag` rows until v1 use shows real query needs.
- **Trigger to revisit:** sevenfold review during Phase 0 closeout; operator pain at Phase 3 entrance.

## 22. Should narrative fit be a table or JSON field in v1?

- **Question:** Single `narrative_fit_json` column on `CampaignContact`, or a structured `NarrativeFit` table with rows + a `NarrativeFitEvidence` join?
- **Recommendation:** **JSON in v1.** Promote to a table only in v1.1 if querying-by-evidence becomes a real workflow. The shape is still moving; JSON lets us iterate without migration churn.
- **Trigger to revisit:** Operators want to query "all journalists with narrative-fit confidence ≥ medium across all campaigns".

## 23. Should campaign constraints be structured fields or markdown/JSON initially?

- **Question:** Promote any of the constraint categories (approved_messaging, forbidden_claims, embargo_kind, exclusivity_plan, sensitive_topics, etc.) to columns in v1?
- **Recommendation:** **JSON in v1.** Only `embargo_until` (existing) and `constraints_required` (new) are columns. Everything else lives in `Campaign.constraints_json` until shape is real.
- **Trigger to revisit:** Operators want to filter campaigns by constraint values, or sevenfold needs richer querying for compliance review.

## 24. What is the minimum export shape Sevenfold needs first?

- **Question:** Of the six export shapes listed in the operational model (media list CSV, source audit, campaign targeting sheet, briefing packet, approval log, outreach-prep export), which must ship in Phase 3 vs later?
- **Recommendation:** Phase 3 ships **media list CSV + markdown brief** (with provenance + email_safe), plus a **source audit export** mapped to the existing `02_source_audit/` shape. The other four are v1.1 and v1.2.
- **Trigger to revisit:** sevenfold review of the Phase 3 plan.

## 25. What contact verification threshold makes a journalist outreach-ready?

- **Question:** The operational model says outreach-safe = `verified` + `lawful_to_store` + `verified_via_citation_id`. Should there be additional thresholds (e.g. citation must be ≤ N months old)?
- **Recommendation:** v1 uses the three-condition rule only. Freshness is informational. Add a freshness threshold to the `email_safe` rollup only if operators report stale emails as a real problem.
- **Trigger to revisit:** Bounce rate or operator-reported stale-contact incidents.

## 26. Public preference flags allow-list

- **Question:** Should `Journalist.global_status_flags_json` accept arbitrary string values, or a documented allow-list?
- **Recommendation:** **Allow-list.** Initial set: `prefers_email_for_pitches`, `prefers_dm_for_pitches`, `no_unsolicited_pitches`, `no_crypto_pitches`, `no_ai_pitches`, `prefers_exclusives`, `prefers_data_driven_angles`. New values require a docs change, not a one-off insert. Codifies the line between sourced public fact and operator inference.
- **Trigger to revisit:** A real public statement doesn't fit any existing flag.

## 27. Should the operational-model doc be added to the sevenfold profile context?

- **Question:** Should sevenfold get a copy or pointer to `BROADLISTER_OPERATIONAL_MODEL_AND_BOUNDARIES.md` in its profile context so its reviews start from the same definitions?
- **Recommendation:** **Yes, as a pointer (not a copy).** Add a one-line reference to BroadLister's operational model in `sevenfold-client-comms-os/_HOW_TO_USE_WITH_HERMES.md` or a sibling. **Not done in this planning pass** — Bo or Hermes adds it later.
- **Trigger to revisit:** sevenfold drifts on cross-client safety or relationship-status conventions during a review.

---

## How to use this document

- Each unresolved item gets resolved at the phase entrance where it bites.
- When resolved, **edit this doc** to note the decision and the date, then carry the decision into the implementation plan (or relevant doc).
- Don't accumulate stale "open questions" — close them or move them to a `decisions/` folder once locked.
