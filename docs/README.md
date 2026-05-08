# BroadLister — Planning Docs Index

Status: **Phase -1 (planning only)** — 2026-05-08
Phase boundary: **No application code, no scaffolding, no installs.** This directory contains the architecture, schema, workflow, and execution plans Codex will use to manage the build through Hermes General → sevenfold profile.

The repository is currently:

```
~/development/BroadLister/
└── docs/
    ├── README.md                                      ← this file
    ├── BROADLISTER_PRODUCT_BRIEF.md
    ├── BROADLISTER_OPERATIONAL_MODEL_AND_BOUNDARIES.md  ← MUST READ before implementation
    ├── BROADLISTER_ARCHITECTURE.md
    ├── BROADLISTER_ENTITY_MODEL.md
    ├── BROADLISTER_SCHEMA_DRAFT.md
    ├── BROADLISTER_TAGGING_AND_ONTOLOGY_MODEL.md
    ├── BROADLISTER_PROVENANCE_AND_VERIFICATION.md
    ├── BROADLISTER_INGESTION_AND_ENRICHMENT_PLAN.md
    ├── BROADLISTER_UI_AND_WORKFLOW_MODEL.md
    ├── BROADLISTER_IMPLEMENTATION_ROADMAP.md
    ├── BROADLISTER_AGENTIC_EXECUTION_PLAN.md
    ├── BROADLISTER_CODEX_BOOTSTRAP_PROMPT.md
    ├── BROADLISTER_OPEN_QUESTIONS.md
    ├── BROADLISTER_GLOSSARY.md
    └── research/
        ├── broadlister-reference-research-v0.md       ← input research
        └── BROADLISTER_RESEARCH_SYNTHESIS.md
```

## Reading order

If you are picking this up cold, read in this order:

1. `BROADLISTER_PRODUCT_BRIEF.md` — what we are and are not building.
2. `BROADLISTER_OPERATIONAL_MODEL_AND_BOUNDARIES.md` — **mandatory read before implementation.** PR-operations realism, global-vs-overlay boundaries, journalist status nuance, narrative fit, campaign constraints, deferrals.
3. `BROADLISTER_ARCHITECTURE.md` — recommended posture and boundaries.
4. `BROADLISTER_ENTITY_MODEL.md` — global vs client-scoped objects.
5. `BROADLISTER_SCHEMA_DRAFT.md` — concrete schema sketch.
6. `BROADLISTER_TAGGING_AND_ONTOLOGY_MODEL.md` — how tags/beats/topics work.
7. `BROADLISTER_PROVENANCE_AND_VERIFICATION.md` — citation, freshness, lawful-storage rules.
8. `BROADLISTER_INGESTION_AND_ENRICHMENT_PLAN.md` — CSV / Sheets / Bucketer / article extraction.
9. `BROADLISTER_UI_AND_WORKFLOW_MODEL.md` — screens, gates, queues.
10. `BROADLISTER_IMPLEMENTATION_ROADMAP.md` — phased build plan + MVP boundary.
11. `BROADLISTER_AGENTIC_EXECUTION_PLAN.md` — how Codex/Hermes/sevenfold collaborate.
12. `BROADLISTER_CODEX_BOOTSTRAP_PROMPT.md` — paste-ready prompt for the next phase.
13. `BROADLISTER_OPEN_QUESTIONS.md` — unresolved decisions for Bo.
14. `BROADLISTER_GLOSSARY.md` — shared term definitions; consult when an entry feels overloaded.
15. `research/BROADLISTER_RESEARCH_SYNTHESIS.md` — distilled view of the reference research.

## Authority model

- **agent-os** (`~/agent-os`) is the canonical machine architecture. BroadLister does not redefine machine boundaries.
- **Hermes** is a runtime harness. It does not own architecture.
- **ProjectReckoner** (`~/development/reckoner-app`) is the control plane. BroadLister is a *new* sibling product, not a sub-module of ProjectReckoner.
- **TaskReckoner / Bucketer / Tabulator / ontology-core** are referenced for patterns and future bridges, not absorbed.
- **BusyIntern** (`~/development/busyintern`, port 3001) stays separate.
- **sevenfold** Hermes profile provides domain review, not architecture or implementation ownership.

## What changes when

- **Phase -1 (now):** docs only.
- **Phase 0:** Codex + Hermes review these docs and produce an implementation plan, then Bo approves.
- **Phase 1+:** code begins under the roadmap in `BROADLISTER_IMPLEMENTATION_ROADMAP.md`.

## Naming

Repo and project name remains **BroadLister** for now. The user-facing product label may eventually become *Sevenfold MediaDesk*; do not rename the repo until Bo says so.
