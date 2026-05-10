# BroadLister Implementation Log

## Phase Index

- Phase 0 closeout: in progress
- Phase 1 data model and importer: planned, blocked on explicit `git init` approval
- Phase 2 UI for contacts/outlets/articles/tags: not started
- Phase 3 campaign overlays and list builder: not started
- MVP boundary: stop after Phase 3 exit
- Phase 3 UI polish: in progress on `phase-3-ui-polish`

---

## 2026-05-08T12:21:19-07:00 — Phase 0 Closeout

### Action

Read the required BroadLister planning documents, machine architecture context, and sevenfold profile context. Confirmed repository state and wrote the mandatory implementation boundary confirmations before code work.

### Boundary Confirmations

- Repository state matches the expected state: the repo is currently not a git repository and contains `docs/` only.
- I will not modify ProjectReckoner, BusyIntern, Hermes, agent-os, sevenfold, systemd, Google credentials, Gmail, Drive, Calendar, Contacts, or client folders under `sevenfold/clients/<slug>/`.
- I will not initialize a systemd unit or always-on service.

### Operational Model Confirmations

1. Global vs overlay separation is binding. Global tables never carry `client_id`. Subjective relationship judgments are overlay-scoped only.
2. Lean v1 status fields are binding: `Journalist.merge_status`, `ContactMethod.verification_state`, `Journalist.global_status_flags_json` with citation-required entries, `OutreachStatus.state` plus `relationship_warmth`, and `CampaignContact.exclusion_flag` plus `exclusion_reason` plus `approval_state`. There will be no global `Journalist.status` enum and no global `do_not_contact` flag.
3. Narrative fit is `CampaignContact.narrative_fit_json` only in v1. No separate narrative-fit join table in v1.
4. Campaign constraints are `Campaign.constraints_json`, `Campaign.embargo_until`, and `Campaign.constraints_required` only in v1.
5. v1 deferrals are binding: no automated outreach, no Gmail send, no autonomous scoring, no large-scale scraping, no social-graph inference, no sentiment analysis, no multi-user sync, no agent-owned campaign execution, and no automatic follow-up scheduling.
6. Cross-client leakage test posture is binding: placeholder in Phase 1; real integration test gating Phase 3 exit. Failing tests block the build.
7. Dependency deny-list test is required in Phase 1 and must fail the build if `nodemailer`, `@sendgrid/mail`, `mailgun.js`, `@aws-sdk/client-ses`, or equivalent send-side dependencies are present in the resolved tree.

### Files Changed

- `docs/IMPLEMENTATION_LOG.md`

### Commands Run

- `sed -n ...` over required BroadLister docs, agent-os docs, and sevenfold context docs: exit 0
- `find . -maxdepth 3 -type f | sort`: exit 0
- `git rev-parse --is-inside-work-tree && git status --short --branch`: exit 128, expected because git is not initialized
- `date '+%Y-%m-%dT%H:%M:%S%z'`: exit 0

### Tests Run

- Not applicable. Phase 0 closeout only; no application code exists yet.

### Review Prompts

- Hermes architecture review prompt drafted: not required by the user-provided review criteria because Phase 1 follows Fastify + Prisma + SQLite, keeps proposed ports API `3021` and web `4100`, adds no external integration, adds no runtime dependency on ProjectReckoner/TaskReckoner/Bucketer/Tabulator/BusyIntern, and does not promote BroadLister to systemd.
- sevenfold domain review prompt drafted: not required by the user-provided review criteria because Phase 1 does not change campaign workspace shape, alter export shape, relax cross-client safety guards, or ship outreach-related functionality.

### Blockers / Stopping Conditions

- Phase 1 implementation cannot start until Bo explicitly approves `git init`, because the repo is not currently initialized and the bootstrap instructions say to ask Bo at Phase 1 entrance before initializing git.

### Rollback Notes

- Remove `docs/IMPLEMENTATION_LOG.md` to revert this log-only Phase 0 closeout entry.

### Next Recommended Action

- Bo should explicitly approve or reject initializing git for this repo. If approved, initialize git, create the Phase 1 branch, then implement Phase 1 in small commits.

---

## 2026-05-08T12:21:19-07:00 — Phase 1 Plan

### Action

Drafted Phase 1 plan after boundary confirmations. Phase 1 approval is present in the bootstrap prompt, but implementation remains blocked on explicit `git init` approval.

### Files And Directories Phase 1 Will Create

- `.gitignore`
- `README.md`
- `package.json`
- `pnpm-workspace.yaml`
- `tsconfig.base.json`
- `apps/api/package.json`
- `apps/api/tsconfig.json`
- `apps/api/tsup.config.ts`
- `apps/api/vitest.config.ts`
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/`
- `apps/api/src/server.ts`
- `apps/api/src/app.ts`
- `apps/api/src/config.ts`
- `apps/api/src/db/prisma.ts`
- `apps/api/src/core/validation/`
- `apps/api/src/core/invariants/`
- `apps/api/src/services/`
- `apps/api/src/routes/`
- `apps/api/src/adapters/csv-import/`
- `apps/api/src/adapters/url/`
- `apps/api/src/review-queue/`
- `apps/api/src/provenance/`
- `apps/api/src/scripts/backup-db.ts`
- `apps/api/src/scripts/check-global-models.ts`
- `apps/api/src/scripts/check-dependency-denylist.ts`
- `apps/api/src/scripts/dev.ts`
- `apps/api/test/`
- `apps/api/test/fixtures/`
- `apps/api/test/integration/cross-client-leakage.placeholder.test.ts`
- `apps/web/package.json`
- `apps/web/index.html`
- `apps/web/tsconfig.json`
- `apps/web/vite.config.ts`
- `apps/web/src/main.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `data/.gitkeep`
- `data/backups/.gitkeep`
- `data/cache/.gitkeep`
- `data/mapping-templates/.gitkeep`
- `logs/.gitkeep`

### Runtime Dependencies

- `fastify ^5.x` — HTTP framework for API on localhost.
- `@fastify/cors ^10.x` — local dev web/API access.
- `@fastify/multipart ^9.x` — CSV upload handling.
- `@prisma/client ^5.x` — Prisma runtime client.
- `prisma ^5.x` — schema, migration, and client generation tooling.
- `zod ^3.x` — request and JSON-column validation.
- `pino ^9.x` — structured local logging.
- `csv-parse ^5.x` — deterministic CSV parsing.
- `tsx ^4.x` — TypeScript dev runner/scripts.
- `tsup ^8.x` — API build bundling.
- `typescript ^5.x` — type checking.
- `vitest ^2.x` — unit and integration tests.
- `eslint ^9.x` plus TypeScript ESLint — linting.
- `vite ^6.x`, `react ^19.x`, `react-dom ^19.x`, `@vitejs/plugin-react ^5.x` — minimal Phase 1 SPA/admin shell and Phase 2 foundation.

### Phase 1 Confirmations

- API will use port `3021`; web will use port `4100`.
- No systemd unit will be created.
- No global environment writes will be made.
- CI/script guard will prevent `client_id` on global Prisma models.
- A backup-before-migration script will be added.
- A dependency deny-list test will be added and will fail on `nodemailer`, `@sendgrid/mail`, `mailgun.js`, `@aws-sdk/client-ses`, and equivalent send-side packages.
- Cross-client leakage test placeholder will be added in Phase 1 and promoted to a real integration test in Phase 3.
- BroadLister will remain operationally independent from ProjectReckoner, TaskReckoner, Bucketer, Tabulator, BusyIntern, Hermes, and sevenfold at runtime.

### Rollback Plan

- If git is initialized: revert Phase 1 by switching off the Phase 1 branch or reverting the Phase 1 commits.
- If git is not initialized: remove the created Phase 1 scaffold paths listed above and restore from any file backups made before destructive operations.
- Database rollback: stop API if running, replace `data/broadlister.sqlite` with the most recent file in `data/backups/`, or delete the DB if no data was imported.
- Dependency rollback: remove `node_modules/`, lockfile, and generated Prisma client artifacts.

### Files Changed

- `docs/IMPLEMENTATION_LOG.md`

### Commands Run

- None beyond Phase 0 context reads and timestamp capture.

### Tests Run

- Not applicable. Plan only.

### Blockers / Stopping Conditions

- Explicit Bo approval is required before `git init`; Phase 1 implementation is paused until that approval is provided.

### Next Recommended Action

- If Bo approves `git init`, proceed with repository initialization, create branch `phase-1-data-model`, implement the scaffold, then commit and verify in small checkpoints.

---

## 2026-05-08T12:25:07-07:00 — Phase 1 Implementation Start

### Action

Bo approved `git init`. Initialized git, created branch `phase-1-data-model`, and began Phase 1 scaffold.

### Files Changed

- `.git/`
- `.gitignore`
- `README.md`
- `package.json`
- `pnpm-workspace.yaml`
- `tsconfig.base.json`
- `eslint.config.js`
- `apps/api/package.json`
- `apps/api/tsconfig.json`
- `apps/api/tsup.config.ts`
- `apps/api/vitest.config.ts`
- `apps/api/prisma/schema.prisma`
- `data/.gitkeep`
- `data/backups/.gitkeep`
- `data/cache/.gitkeep`
- `data/mapping-templates/.gitkeep`
- `logs/.gitkeep`

### Commands Run

- `git init`: exit 0
- `git checkout -b phase-1-data-model`: exit 0
- `node --version`: exit 0 (`v22.22.2`)
- `pnpm --version`: exit 0 (`11.0.8`)

### Tests Run

- Not yet. Scaffold in progress.

### Rollback Notes

- Before first commit, remove the created scaffold files/directories or delete `.git/` if Bo wants to return to docs-only state.

### Next Recommended Action

- Finish API/web scaffold, install dependencies, generate Prisma client, run static guards and tests, then commit checkpoint 1.

---

## 2026-05-08T12:26:59-07:00 — GitHub Remote Added

### Action

Bo provided GitHub repository `https://github.com/Danilarious/BroadLister.git`. Added it as `origin`.

### Files Changed

- `.git/config`

### Commands Run

- `git remote add origin https://github.com/Danilarious/BroadLister.git`: exit 0

### Tests Run

- Not applicable.

### Rollback Notes

- Remove remote with `git remote remove origin` if needed.

### Next Recommended Action

- Continue local Phase 1 implementation. Push only after a verified checkpoint commit.

---

## 2026-05-08T12:32:01-07:00 — Phase 1 Checkpoint 1 Verification

### Action

Completed initial monorepo scaffold, Prisma schema, migration, API health/CRUD/import/review route skeletons, JSON validators, backup script, dependency deny-list guard, global-model scope guard, Phase 1 cross-client placeholder test, and minimal web shell.

### Files Changed

- `.gitignore`
- `README.md`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `tsconfig.base.json`
- `eslint.config.js`
- `apps/api/package.json`
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20260508193129_init/migration.sql`
- `apps/api/src/`
- `apps/api/test/`
- `apps/web/package.json`
- `apps/web/src/`
- `data/.gitkeep`
- `data/backups/.gitkeep`
- `data/cache/.gitkeep`
- `data/mapping-templates/.gitkeep`
- `logs/.gitkeep`

### Commands Run

- `pnpm install`: exit 1 initially due pnpm 11 build-script approval gate
- `pnpm approve-builds`: exit 0; approved only `@prisma/client`, `@prisma/engines`, `esbuild`, `prisma`
- `pnpm --filter @broadlister/api prisma generate`: exit 0
- `pnpm --filter @broadlister/api backup:db`: exit 0; no DB existed, skipped cleanly
- `pnpm --filter @broadlister/api prisma migrate dev --name init`: exit 0
- `pnpm check:global-models`: exit 0
- `pnpm check:denylist`: exit 0
- `pnpm typecheck`: exit 0
- `pnpm lint`: exit 0
- `pnpm test`: exit 0
- `pnpm build`: exit 0

### Tests Run

- API unit/invariant tests: 4 passed, 1 todo placeholder.
- Web tests: no files found, exited 0 via `--passWithNoTests`.
- Global model scope guard: passed.
- Dependency deny-list guard: passed.

### Review Prompts

- Hermes review: not required; implementation stayed within approved stack, ports, and runtime boundaries.
- sevenfold review: not required; no export shape, campaign workspace shape, cross-client guard relaxation, or outreach feature shipped.

### Blockers / Stopping Conditions

- None.

### Rollback Notes

- Revert the upcoming checkpoint commit to remove the scaffold. If needed, restore DB state by deleting `data/broadlister.sqlite` and rerunning migrations after revert.

### Next Recommended Action

- Commit checkpoint 1, rerun verification after commit, then continue filling Phase 1 service behavior and smoke flows.

---

## 2026-05-08T12:32:46-07:00 — Phase 1 Checkpoint 1 Committed

### Action

Committed initial Phase 1 scaffold as `c448cc6 chore: scaffold phase 1 workspace`. Reran required verification after commit.

### Files Changed

- `docs/IMPLEMENTATION_LOG.md`

### Commands Run

- `git add . && git commit -m "chore: scaffold phase 1 workspace"`: exit 0
- `pnpm check:global-models`: exit 0
- `pnpm check:denylist`: exit 0
- `pnpm typecheck`: exit 0
- `pnpm lint`: exit 0
- `pnpm test`: exit 0
- `pnpm build`: exit 0

### Tests Run

- API unit/invariant tests: 4 passed, 1 todo placeholder.
- Web tests: no files found, exited 0 via `--passWithNoTests`.
- Global model scope guard: passed.
- Dependency deny-list guard: passed.

### Blockers / Stopping Conditions

- None.

### Rollback Notes

- Revert commit `c448cc6` to remove checkpoint 1 scaffold.

### Next Recommended Action

- Commit this log update, push `phase-1-data-model` to GitHub, then continue Phase 1 service implementation.

---

## 2026-05-08T12:33:17-07:00 — Stopping Condition: GitHub Push Permission

### Action

Committed log update as `803ea32 docs: record phase 1 scaffold checkpoint`. Reran verification successfully. Attempted to push `phase-1-data-model` to GitHub remote `https://github.com/Danilarious/BroadLister.git`.

### Files Changed

- `docs/IMPLEMENTATION_LOG.md`

### Commands Run

- `git add docs/IMPLEMENTATION_LOG.md && git commit -m "docs: record phase 1 scaffold checkpoint"`: exit 0
- `pnpm verify && pnpm check:global-models && pnpm check:denylist`: exit 0
- `git push -u origin phase-1-data-model`: exit 128

### Tests Run

- Typecheck: passed.
- Lint: passed.
- API tests: 4 passed, 1 todo placeholder.
- Web tests: no files found, exited 0 via `--passWithNoTests`.
- Global model scope guard: passed.
- Dependency deny-list guard: passed.

### Blockers / Stopping Conditions

- GitHub push failed: `remote: Permission to Danilarious/BroadLister.git denied to bxb0xbxb.` This is a missing/incorrect credential or repository access issue for the requested GitHub integration.

### Rollback Notes

- Local branch remains valid and verified. Remove remote with `git remote remove origin` or replace it with an authorized URL if needed.

### Next Recommended Action

- Bo should grant the current GitHub identity access to `Danilarious/BroadLister`, provide an authorized remote URL, or request local-only continuation without pushing.

---

## 2026-05-08T12:43:52-07:00 — GitHub Push Recovered

### Action

Bo confirmed repository invitation/access for `bxb0xbxb`. Retried push and successfully published branch `phase-1-data-model` to `origin`.

### Files Changed

- `docs/IMPLEMENTATION_LOG.md`

### Commands Run

- `git status --short --branch`: exit 0
- `git push -u origin phase-1-data-model`: exit 0

### Tests Run

- Not rerun for this log-only remote-access retry. Previous verification on commit `803ea32` passed.

### Blockers / Stopping Conditions

- GitHub remote access blocker resolved.

### Rollback Notes

- Remote branch can be deleted with `git push origin --delete phase-1-data-model` if Bo wants to unpublish this checkpoint.

### Next Recommended Action

- Commit this log update, push it, then continue Phase 1 implementation.

---

## 2026-05-08T12:45:51-07:00 — Phase 1 Checkpoint 2 URL Ingest Slice

### Action

Added deterministic single-URL ingest proposal support using operator-provided HTML snapshots, not live crawling. Added route `/imports/url`, metadata extraction helper, blocked review behavior for article proposals that require outlet approval first, and API smoke tests for health and review application.

### Files Changed

- `apps/api/src/app.ts`
- `apps/api/src/adapters/url/extract.ts`
- `apps/api/src/routes/url-ingest.ts`
- `apps/api/src/services/review.ts`
- `apps/api/test/api-smoke.test.ts`
- `apps/api/test/url-extract.test.ts`

### Commands Run

- `pnpm verify && pnpm check:global-models && pnpm check:denylist && pnpm build`: exit 0

### Tests Run

- API tests: 7 passed, 1 todo placeholder.
- Web tests: no files found, exited 0 via `--passWithNoTests`.
- Typecheck: passed.
- Lint: passed.
- Global model scope guard: passed.
- Dependency deny-list guard: passed.
- Build: passed.

### Review Prompts

- Hermes review: not required; no new service boundary, port, external integration, runtime coupling, or systemd posture change.
- sevenfold review: not required; no campaign workspace/export shape/cross-client relaxation/outreach functionality.

### Blockers / Stopping Conditions

- None.

### Rollback Notes

- Revert the upcoming checkpoint commit to remove URL ingest proposal support.

### Next Recommended Action

- Commit checkpoint 2 and push branch.

---

## 2026-05-08T12:48:21-07:00 — Phase 1 Checkpoint 3 CRUD Validation Slice

### Action

Added explicit Zod request schemas for Phase 1 CRUD routes, normalized JSON-shaped fields, enforced contact-method subject scope, normalized validation errors to HTTP 400, and added smoke coverage for invalid contact scope.

### Files Changed

- `apps/api/src/app.ts`
- `apps/api/src/core/validation/requests.ts`
- `apps/api/src/routes/crud.ts`
- `apps/api/test/api-smoke.test.ts`

### Commands Run

- `pnpm verify && pnpm check:global-models && pnpm check:denylist && pnpm build`: exit 0

### Tests Run

- API tests: 8 passed, 1 todo placeholder.
- Web tests: no files found, exited 0 via `--passWithNoTests`.
- Typecheck: passed.
- Lint: passed.
- Global model scope guard: passed.
- Dependency deny-list guard: passed.
- Build: passed.

### Blockers / Stopping Conditions

- None.

### Rollback Notes

- Revert the upcoming checkpoint commit to remove explicit CRUD request validation changes.

### Next Recommended Action

- Commit checkpoint 3 and push branch.

---

## 2026-05-08T12:51:01-07:00 — Phase 1 Exit Verification

### Action

Completed Phase 1 exit verification. Found and corrected SQLite path ambiguity: Prisma first created `apps/data/broadlister.sqlite` because the DB URL was relative to the Prisma schema path. Backed up the misplaced DB, switched scripts/config to the intended repo-local SQLite path, migrated the intended DB, and captured an exit backup.

### Files Changed

- `apps/api/package.json`
- `apps/api/src/config.ts`

### Commands Run

- `pnpm --filter @broadlister/api prisma migrate dev`: exit 0
- `pnpm backup:db`: exit 0; wrote `data/backups/broadlister-2026-05-08T19-50-34-245Z.sqlite`
- `find /home/bxby/development/BroadLister -name 'broadlister.sqlite*' -o -name '*.sqlite'`: exit 0
- `pnpm verify && pnpm check:global-models && pnpm check:denylist && pnpm build`: exit 0

### Tests Run

- API tests: 9 passed, 1 todo placeholder.
- Web tests: no files found, exited 0 via `--passWithNoTests`.
- Typecheck: passed.
- Lint: passed.
- Global model scope guard: passed.
- Dependency deny-list guard: passed.
- Build: passed.

### Self-Verification

- Dependency deny-list test passes.
- Cross-client leakage placeholder exists for Phase 1.
- Backup snapshot captured at `data/backups/broadlister-2026-05-08T19-50-34-245Z.sqlite`.
- Misplaced DB backup captured at `data/backups/misplaced-apps-data-broadlister-20260508T124925.sqlite`.
- Operational invariant spot-check passed: global Prisma models do not contain `client_id`.
- No ProjectReckoner, BusyIntern, Hermes, agent-os, sevenfold, systemd, Google credential, Gmail, Drive, Calendar, Contacts, or client-folder files were modified.
- No send-side dependency is present in the resolved tree.

### Phase 1 Summary

Phase 1 implemented the local data model foundation, initial SQLite migration, Fastify API, CRUD/search route skeletons, CSV import to review queue, single-URL ingest proposals using operator-provided HTML snapshots, review approve/reject flow, JSON validators for global sourced preferences/campaign constraints/narrative fit, backup script, dependency deny-list guard, global `client_id` static guard, and a minimal web shell.

### Blockers / Stopping Conditions

- None.

### Rollback Notes

- Revert Phase 1 commits through this checkpoint. Remove `data/broadlister.sqlite` and restore from `data/backups/broadlister-2026-05-08T19-50-34-245Z.sqlite` if DB rollback is needed.

### Next Recommended Action

- Commit the DB-path correction and Phase 1 exit log, push, tag `phase-1-complete`, then proceed to Phase 2 plan and implementation.

---

## 2026-05-08T12:51:52-07:00 — Phase 2 Plan

### Action

Started branch `phase-2-ui` from Phase 1 completion. Re-read the UI/workflow model for Phase 2 scope.

### Plan

Build the operator-facing SPA over the existing Phase 1 API:

- Global navigation and always-visible client switcher.
- Dashboard attention widgets using review queue and global record counts.
- Journalist, outlet, article, and tag directory screens with search/filter, table views, selected detail panels, and provenance pop-out affordance.
- Review queue UI with approve/reject actions.
- CSV import wizard with inline mapping and post-import review scope.
- Single-URL ingest form using operator-provided HTML snapshots.
- Empty states, validation error rendering, keyboard shortcuts for review queue actions.

### Files Expected To Change

- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/api.ts`
- `apps/web/src/types.ts`
- `apps/web/src/components/`
- `apps/web/src/screens/`
- `apps/web/src/utils/`
- `apps/web/test/`

### Dependencies

- No new runtime dependency planned. Use built-in `fetch`, React state, and existing Vite/React stack.

### Ports / Boundaries

- Web remains on port `4100`.
- API remains on port `3021`.
- No systemd.
- No global env writes.
- No outbound messaging, Gmail, webhook, or external outreach code.
- No runtime dependency on ProjectReckoner, TaskReckoner, Bucketer, Tabulator, BusyIntern, Hermes, or sevenfold.

### Review Prompts

- Hermes review: not required; no port, stack, service boundary, external integration, runtime coupling, or systemd change.
- sevenfold review: not required; Phase 2 does not alter campaign workspace shape, export shape, cross-client safety guards, or ship outreach functionality.

### Rollback Notes

- Revert Phase 2 commits on branch `phase-2-ui`. Phase 1 tag remains available as `phase-1-complete`.

### Next Recommended Action

- Implement Phase 2 UI in small checkpoints, verify, push, then tag `phase-2-complete`.

---

## 2026-05-08T12:54:56-07:00 — Phase 2 UI Checkpoint

### Action

Implemented the Phase 2 operator UI over the Phase 1 API: global directories for journalists/outlets/articles/tags, detail panels with provenance-pop-out affordance, review queue with approve/reject actions and keyboard shortcuts, CSV import wizard, single-URL HTML snapshot ingest, dashboard metrics, active client selector, and explicit safety guardrail copy.

### Files Changed

- `apps/web/src/App.tsx`
- `apps/web/src/api.ts`
- `apps/web/src/components/DetailPanel.tsx`
- `apps/web/src/components/RecordTable.tsx`
- `apps/web/src/components/ReviewQueue.tsx`
- `apps/web/src/screens/DirectoryScreen.tsx`
- `apps/web/src/screens/ImportScreen.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/types.ts`
- `apps/web/src/utils/format.ts`

### Commands Run

- `pnpm verify && pnpm check:global-models && pnpm check:denylist && pnpm build`: exit 0

### Tests Run

- API tests: 9 passed, 1 todo placeholder.
- Web tests: no files found, exited 0 via `--passWithNoTests`.
- Typecheck: passed.
- Lint: passed.
- Global model scope guard: passed.
- Dependency deny-list guard: passed.
- Build: passed.

### Blockers / Stopping Conditions

- None.

### Rollback Notes

- Revert the upcoming Phase 2 UI commit to return to the Phase 1 web shell.

### Next Recommended Action

- Commit and push Phase 2 UI checkpoint, capture Phase 2 backup, tag `phase-2-complete`, then proceed to Phase 3 plan and implementation.

---

## 2026-05-08T12:55:25-07:00 — Phase 2 Exit

### Action

Committed Phase 2 UI checkpoint as `863078a feat: build phase 2 operator ui`, reran verification, pushed branch `phase-2-ui`, and captured Phase 2 DB backup.

### Files Changed

- `docs/IMPLEMENTATION_LOG.md`

### Commands Run

- `git add . && git commit -m "feat: build phase 2 operator ui"`: exit 0
- `pnpm verify && pnpm check:global-models && pnpm check:denylist`: exit 0
- `git push -u origin phase-2-ui`: exit 0
- `pnpm backup:db`: exit 0; wrote `data/backups/broadlister-2026-05-08T19-55-26-174Z.sqlite`

### Tests Run

- API tests: 9 passed, 1 todo placeholder.
- Web tests: no files found, exited 0 via `--passWithNoTests`.
- Typecheck: passed.
- Lint: passed.
- Global model scope guard: passed.
- Dependency deny-list guard: passed.

### Self-Verification

- Dependency deny-list test passes.
- Cross-client leakage placeholder remains present for Phase 2.
- Backup snapshot captured at `data/backups/broadlister-2026-05-08T19-55-26-174Z.sqlite`.
- Operational invariant spot-check passed: global Prisma models do not contain `client_id`.
- No send-side dependencies, outbound messaging, Gmail, systemd, or external runtime coupling introduced.

### Phase 2 Summary

Phase 2 added a functional operator SPA for global record browsing/editing workflows, review queue approval/rejection, CSV imports, single-URL ingest proposals, active client selector, dashboard attention widgets, and provenance/safety affordances. Campaign overlay workspace and exports remain Phase 3 scope.

### Blockers / Stopping Conditions

- None.

### Rollback Notes

- Revert commit `863078a` or return to tag `phase-1-complete` to remove Phase 2 UI changes.

### Next Recommended Action

- Commit this exit log, tag `phase-2-complete`, push tag, then proceed to Phase 3 plan and implementation.

---

## 2026-05-08T12:56:05-07:00 — Phase 3 Plan

### Action

Started branch `phase-3-overlays` from Phase 2 completion and re-read the roadmap Phase 3 scope.

### Plan

Add first-class campaign overlays and exports:

- API scoped campaign workspace route that always filters by `client_id`.
- Campaign/list/contact overlay helpers for list building.
- Campaign constraints structured UI over `Campaign.constraints_json`.
- CampaignContact overlay editor with target score, rationale, pitch angle, exclusion, approval state, and narrative fit fields.
- Relationship/status panel for active client on journalist detail.
- ClientApproval workflow and readiness chips.
- Export routes for media-list CSV, markdown brief, source audit, and approval log.
- Replace Phase 1 cross-client placeholder with a real integration test that inserts two clients and fails if scoped workspace/export routes leak the other client's overlay fields.

### Files Expected To Change

- `apps/api/src/routes/campaign-workspace.ts`
- `apps/api/src/routes/exports.ts`
- `apps/api/src/services/exports.ts`
- `apps/api/test/cross-client-leakage.test.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/api.ts`
- `apps/web/src/screens/CampaignScreen.tsx`
- `apps/web/src/styles.css`

### Dependencies

- No new runtime dependency planned.

### Ports / Boundaries

- API remains `3021`; web remains `4100`.
- No systemd.
- No global env writes.
- No outbound messaging, Gmail, webhook, notification, send queue, scheduler, or automation.
- No runtime dependency on ProjectReckoner, TaskReckoner, Bucketer, Tabulator, BusyIntern, Hermes, or sevenfold.

### Review Prompts

- Hermes review: not required; no stack, port, service-boundary, external integration, runtime coupling, or systemd change.
- sevenfold review prompt drafted: not required by the current gate criteria because export shapes follow the planning docs and do not alter Sevenfold folder conventions. If Bo wants explicit domain signoff, pause before MVP declaration.

### Rollback Notes

- Revert Phase 3 commits on branch `phase-3-overlays`. Phase 2 tag remains available as `phase-2-complete`.

### Next Recommended Action

- Implement Phase 3 overlays, exports, and real cross-client leakage test, verify, push, tag `phase-3-complete`, then stop at MVP boundary and report.

---

## 2026-05-08T13:00:12-07:00 — Phase 3 Overlay/Export Checkpoint

### Action

Implemented scoped campaign workspace API, export routes, export service, real cross-client leakage integration test, campaign workspace UI, overlay editor, campaign constraints view, ClientApproval creation, and export links for media CSV, brief markdown, source audit, and approval log.

### Files Changed

- `apps/api/src/app.ts`
- `apps/api/src/routes/campaign-workspace.ts`
- `apps/api/src/routes/exports.ts`
- `apps/api/src/services/exports.ts`
- `apps/api/test/cross-client-leakage.test.ts`
- `apps/api/test/cross-client-leakage.placeholder.test.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/api.ts`
- `apps/web/src/screens/CampaignScreen.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/types.ts`

### Commands Run

- `pnpm verify && pnpm check:global-models && pnpm check:denylist && pnpm build`: exit 0

### Tests Run

- API tests: 10 passed, including real cross-client leakage integration test.
- Web tests: no files found, exited 0 via `--passWithNoTests`.
- Typecheck: passed.
- Lint: passed.
- Global model scope guard: passed.
- Dependency deny-list guard: passed.
- Build: passed.

### Self-Verification

- Cross-client leakage test is now real and passing.
- Dependency deny-list guard passes.
- Global Prisma model `client_id` guard passes.
- Export routes are scoped by `client_id`; trying to export Client B's list through Client A returns 404 without leaking Client B private overlay text.
- No outbound outreach, Gmail, webhook, send queue, scheduler, or notification code added.

### Rollback Notes

- Revert the upcoming Phase 3 checkpoint commit to remove campaign workspace, exports, and real leakage test.

### Next Recommended Action

- Commit/push checkpoint, capture Phase 3 exit backup, rerun final verification, tag `phase-3-complete`, then stop at MVP boundary.

---

## 2026-05-08T13:01:02-07:00 — Phase 3 Exit / MVP Boundary

### Action

Committed Phase 3 checkpoint as `201149d feat: add campaign overlays and scoped exports`, pushed branch `phase-3-overlays`, captured MVP boundary backup, and reran final verification.

### Files Changed

- `docs/IMPLEMENTATION_LOG.md`

### Commands Run

- `git add . && git commit -m "feat: add campaign overlays and scoped exports"`: exit 0
- `pnpm verify && pnpm check:global-models && pnpm check:denylist`: exit 0
- `git push -u origin phase-3-overlays`: exit 0
- `pnpm backup:db`: exit 0; wrote `data/backups/broadlister-2026-05-08T20-00-43-278Z.sqlite`
- `pnpm verify && pnpm check:global-models && pnpm check:denylist && pnpm build`: exit 0

### Tests Run

- API tests: 10 passed, including real cross-client leakage integration test.
- Web tests: no files found, exited 0 via `--passWithNoTests`.
- Typecheck: passed.
- Lint: passed.
- Global model scope guard: passed.
- Dependency deny-list guard: passed.
- Build: passed.

### Self-Verification

- Cross-client leakage integration test passes and gates Phase 3 exit.
- Dependency deny-list test passes.
- Backup snapshot captured at `data/backups/broadlister-2026-05-08T20-00-43-278Z.sqlite`.
- Operational invariant spot-check passed: global Prisma models do not contain `client_id`.
- Campaign overlay data remains scoped through workspace/export APIs.
- No outbound outreach, Gmail, webhook, notification, send queue, scheduler, systemd, or external runtime coupling introduced.

### Phase 3 Summary

Phase 3 added campaign workspace APIs, client-scoped overlay UI, list building, structured campaign constraints storage/display, campaign contact overlay editing, narrative fit editor, ClientApproval creation, media-list CSV export, markdown brief export, source-audit export, approval-log export, and a real cross-client leakage integration test.

### Blockers / Stopping Conditions

- MVP boundary reached. Phase 4 and Phase 5 are not pre-approved and require a fresh planning pass.

### Rollback Notes

- Revert Phase 3 commits or return to tag `phase-2-complete`. Restore DB from `data/backups/broadlister-2026-05-08T20-00-43-278Z.sqlite` if needed.

### Next Recommended Action

- Commit this MVP boundary log, tag `phase-3-complete`, push tag, and stop for Bo's review.

---

## 2026-05-09T18:54:46-07:00 — Phase 3 UI Polish

### Action

Started post-MVP UI polish from tag `phase-3-complete` on branch `phase-3-ui-polish`. Loaded the globally installed `impeccable` skill and used it as the UI rubric. Added product/design context files, refined the React UI for hierarchy, responsive layout, labeled forms, mobile-safe tables, loading/disabled states, and clearer no-outreach copy. Added BroadLister operator/Hermes/sevenfold/next-phase docs. Verified `context-mode` global skill and installed the remaining skills from `mksglu/context-mode`.

### Files Changed

- `PRODUCT.md`
- `DESIGN.md`
- `apps/web/src/App.tsx`
- `apps/web/src/components/RecordTable.tsx`
- `apps/web/src/components/ReviewQueue.tsx`
- `apps/web/src/screens/CampaignScreen.tsx`
- `apps/web/src/screens/DirectoryScreen.tsx`
- `apps/web/src/screens/ImportScreen.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/utils/format.ts`
- `apps/web/src/utils/format.test.ts`
- `docs/BROADLISTER_OPERATOR_RUNBOOK.md`
- `docs/BROADLISTER_SEVENFOLD_AGENT_BRIEF.md`
- `docs/BROADLISTER_HERMES_HANDOFF.md`
- `docs/BROADLISTER_NEXT_DEVELOPMENT_PLAN.md`
- `docs/BROADLISTER_TAGGING_AND_ONTOLOGY_MODEL.md`
- `docs/IMPLEMENTATION_LOG.md`

### Commands Run

- `node /home/bxby/.codex/skills/impeccable/scripts/load-context.mjs`: exit 0
- `pnpm verify`: exit 0 after fixing one test import extension
- `pnpm check:global-models`: exit 0
- `pnpm check:denylist`: exit 0
- `pnpm build`: exit 0
- `pnpm dev`: smoke start, ports bound to `127.0.0.1:3021` and `127.0.0.1:4100`; stopped with SIGINT
- `hermes -z ...`: exit 0, returned `PASS`
- `python .../install-skill-from-github.py --repo mksglu/context-mode ...`: exit 0
- `pnpm backup:db`: exit 0; wrote `data/backups/broadlister-2026-05-10T01-56-16-705Z.sqlite`

### Tests Run

- `pnpm verify`: pass
- API tests: 5 files, 10 tests passed, including real cross-client leakage integration test
- Web tests: 1 file, 3 tests passed
- Global model scope guard: pass
- Dependency deny-list guard: pass
- Build: pass
- Phase-exit backup: `data/backups/broadlister-2026-05-10T01-56-16-705Z.sqlite`

### Hermes / sevenfold Review

- Hermes General/default handoff prompt sent directly via `hermes -z`.
- Hermes returned `PASS`.
- Hermes briefed sevenfold profile; sevenfold session `20260509_185143_9caa3c` returned `PASS with conditions`.
- Conditions are documented in `docs/BROADLISTER_HERMES_HANDOFF.md` and preserve existing no-outreach, local-first, client-isolation, provenance, proposal-review, approval-gate, and no-runtime-coupling rules.

### Blockers / Stopping Conditions

- None. No destructive migrations, credentials, outbound communication paths, systemd changes, or runtime coupling introduced.

### Rollback Notes

- Revert the forthcoming UI polish commits on `phase-3-ui-polish`.
- No schema migration was added.
- No database mutation was required.
- Context-mode skill install can be removed from `/home/bxby/.codex/skills/<skill-name>` if Bo wants to undo global skill installation.

### Next Recommended Action

- Run final verification after this log entry, commit the UI/docs pass, tag `phase-3-ui-polish-complete`, and push branch/tag.

---

## 2026-05-09T19:25:23-07:00 — Browser Validation And Hardening

### Action

Started branch `phase-3-hardening-browser` from `phase-3-ui-polish-complete`. Started API localhost-only and web bound to the ThinkPad Tailscale IP for iPhone access. Installed Playwright browser validation, added desktop/mobile smoke tests, added API hardening tests, created a generic global Codex browser validation skill, and updated runbook/README/next-plan docs. Ontology alignment remains planning-only and is not implemented in this pass.

### Files Changed

- `.gitignore`
- `README.md`
- `package.json`
- `pnpm-lock.yaml`
- `playwright.config.ts`
- `e2e/broadlister-smoke.spec.ts`
- `apps/api/test/hardening.test.ts`
- `docs/BROADLISTER_OPERATOR_RUNBOOK.md`
- `docs/BROADLISTER_NEXT_DEVELOPMENT_PLAN.md`
- `docs/IMPLEMENTATION_LOG.md`
- `e2e/broadlister-smoke.spec.ts`
- `/home/bxby/.codex/skills/browser-ui-validation/SKILL.md`

### Commands Run

- `tailscale ip -4`: exit 0; `100.109.2.15`
- `tailscale status --json`: exit 0; MagicDNS `bxby-thinkpad.tail54427b.ts.net`
- `pnpm --filter @broadlister/api dev`: running; API bound `127.0.0.1:3021`
- `pnpm --filter @broadlister/web exec vite --host 100.109.2.15 --port 4100`: running; web bound `100.109.2.15:4100`
- `pnpm add -D @playwright/test -w`: exit 0
- `pnpm exec playwright install chromium`: exit 0
- `pnpm verify`: exit 0 after correcting one hardening assertion
- `pnpm check:global-models`: exit 0
- `pnpm check:denylist`: exit 0
- `pnpm build`: exit 0
- `pnpm test:e2e`: exit 0 after pinning mobile project to Chromium and explicit screen assertions
- `pnpm test:mobile`: exit 0
- `pnpm screenshots`: exit 0
- `pnpm verify:full`: exit 0
- `pnpm backup:db`: exit 0; wrote `data/backups/broadlister-2026-05-10T02-26-09-527Z.sqlite`

### Tests Run

- API tests: 6 files, 15 tests passed, including real cross-client leakage and new hardening tests.
- Web tests: 1 file, 3 tests passed.
- Playwright: 6 tests passed across desktop Chromium and mobile Chromium.
- Mobile-only Playwright: 3 tests passed.
- Screenshot-marked Playwright tests: 4 tests passed.
- Global model scope guard: pass.
- Dependency deny-list guard: pass.
- Build: pass.
- Phase backup: `data/backups/broadlister-2026-05-10T02-26-09-527Z.sqlite`

### Runtime Access

- iPhone URL: `http://100.109.2.15:4100/`
- MagicDNS URL: `http://bxby-thinkpad.tail54427b.ts.net:4100/`
- API remains localhost-only behind Vite proxy.
- Mac fallback: `ssh -L 4100:127.0.0.1:4100 -L 3021:127.0.0.1:3021 bxby@bxby-thinkpad`

### Artifacts

- Screenshots: `test-results/screenshots/`
- Playwright traces/reports on failure: `test-results/playwright/`, `playwright-report/`
- Artifacts are ignored by git.

### Blockers / Stopping Conditions

- None. No public tunnel, credentials, outbound messaging path, destructive migration, systemd change, or runtime coupling introduced.

### Rollback Notes

- Revert the forthcoming branch commits to remove repo changes.
- Remove `/home/bxby/.codex/skills/browser-ui-validation/` to undo the global skill.
- Stop dev servers with SIGINT in their terminal sessions when iPhone testing is complete.

### Next Recommended Action

- Run `pnpm verify:full`, back up the DB, commit, tag, push, then proceed only to ontology-core/Tabulator alignment planning if Bo approves.

---

## 2026-05-09T20:22:47-07:00 — Import And Article Ingestion

### Action

Started branch `phase-4-import-ingestion` from `phase-3-hardening-browser-complete`. Implemented a clearer Imports workflow, CSV file selection with preview/commit, deterministic article URL ingestion with optional pasted HTML fallback, review-gated article/outlet/journalist/byline/tag/client-relevance proposals, and bridge/ingestion contract docs. Tested the CoinDesk Trace Finance URL: live fetch returned HTTP 403, and pasted JSON-LD HTML produced review proposals.

### Files Changed

- `apps/api/src/adapters/url/extract.ts`
- `apps/api/src/routes/imports.ts`
- `apps/api/src/routes/url-ingest.ts`
- `apps/api/src/services/review.ts`
- `apps/api/test/import-ingestion.test.ts`
- `apps/api/test/hardening.test.ts`
- `apps/api/test/url-extract.test.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/api.ts`
- `apps/web/src/screens/ImportScreen.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/types.ts`
- `e2e/broadlister-smoke.spec.ts`
- `docs/BROADLISTER_IMPORT_INGESTION_CONTRACT.md`
- `docs/BROADLISTER_PROJECTRECKONER_BRIDGE_PLAN.md`
- `docs/BROADLISTER_NEXT_DEVELOPMENT_PLAN.md`
- `docs/IMPLEMENTATION_LOG.md`

### Commands Run

- `hermes -z ...`: exit 0; returned `PASS WITH CONDITIONS`
- CoinDesk live URL ingest smoke: exit 0; API returned HTTP 400 `html_unavailable` with HTTP 403 fetch reason
- CoinDesk pasted JSON-LD ingest smoke: exit 0; API returned HTTP 201 with 15 review proposals
- `pnpm verify`: exit 0
- `pnpm check:global-models`: exit 0
- `pnpm check:denylist`: exit 0
- `pnpm build`: exit 0
- `pnpm test:e2e`: exit 0
- `pnpm test:mobile`: exit 0 when run sequentially
- `pnpm screenshots`: exit 0 when run sequentially
- `pnpm verify:full`: exit 0
- `pnpm backup:db`: exit 0; wrote `data/backups/broadlister-2026-05-10T03-22-47-431Z.sqlite`

### Tests Run

- API tests: 7 files, 22 tests passed.
- Web tests: 1 file, 3 tests passed.
- Playwright E2E: 8 tests passed across desktop and mobile Chromium.
- Mobile-only Playwright: 4 tests passed.
- Screenshot-marked Playwright tests: 4 tests passed.
- Cross-client leakage integration test: pass.
- Global model scope guard: pass.
- Dependency deny-list guard: pass.
- Build: pass.

### Hermes / ProjectReckoner Guidance

- Hermes returned `PASS WITH CONDITIONS`.
- Guidance: BroadLister should own a local deterministic article ingestion adapter now; align with Tabulator/Bucketer by documented contract later; do not import or call Tabulator/Bucketer/ontology-core at runtime; keep LLM assistance out of this implementation or proposal-only later.
- Conditions preserve standalone local-first operation, review gates, no outreach, no Gmail, no hidden integrations, and no direct ontology mutation.

### Blockers / Stopping Conditions

- None. No runtime coupling, external credentials, public tunnel, destructive migration, outbound communication, or schema change introduced.

### Rollback Notes

- Revert the forthcoming branch commits to remove import-ingestion changes.
- No migration was added.
- Restore DB from `data/backups/broadlister-2026-05-10T03-22-47-431Z.sqlite` if test import data should be reset.

### Next Recommended Action

- Commit, tag, and push this phase. Next development should continue with import reconciliation polish or ontology/Tabulator alignment planning, not runtime integration.

---

## 2026-05-09T20:42:11-07:00 — Import Reconciliation And Review Approval

### Action

Started branch `phase-4-reconciliation-review` from `phase-4-import-ingestion-complete`. Implemented deterministic reconciliation context, match-or-create approval behavior, linked approval resolution for article/byline/article-tag/client relevance proposals, review item defer action, URL import batch tracking, and a clearer Review Queue UI with proposal summaries, match warnings, dependency status, batch filter, kind filter, and mobile-safe controls.

### Files Changed

- `apps/api/src/routes/imports.ts`
- `apps/api/src/routes/review.ts`
- `apps/api/src/routes/url-ingest.ts`
- `apps/api/src/services/review.ts`
- `apps/api/test/import-ingestion.test.ts`
- `apps/api/test/reconciliation-review.test.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/api.ts`
- `apps/web/src/components/ReviewQueue.tsx`
- `apps/web/src/screens/ImportScreen.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/types.ts`
- `e2e/broadlister-smoke.spec.ts`
- `docs/BROADLISTER_IMPORT_INGESTION_CONTRACT.md`
- `docs/BROADLISTER_OPERATOR_RUNBOOK.md`
- `docs/BROADLISTER_NEXT_DEVELOPMENT_PLAN.md`
- `docs/IMPLEMENTATION_LOG.md`

### Commands Run

- `node /home/bxby/.codex/skills/impeccable/scripts/load-context.mjs`: exit 0
- `pnpm --filter @broadlister/api typecheck && pnpm --filter @broadlister/web typecheck`: exit 2, fixed Prisma create input types
- `pnpm --filter @broadlister/api typecheck && pnpm --filter @broadlister/web typecheck`: exit 0
- `pnpm --filter @broadlister/api test -- reconciliation-review.test.ts`: exit 0; vitest ran all API tests
- `pnpm verify`: exit 0
- `pnpm check:global-models && pnpm check:denylist && pnpm build`: exit 0
- `pnpm test:e2e`: exit 0
- `pnpm test:mobile`: exit 0
- `pnpm screenshots`: exit 0
- `pnpm verify:full`: exit 0
- `pnpm backup:db`: exit 0; wrote `data/backups/broadlister-2026-05-10T03-43-56-903Z.sqlite`

### Tests Run

- API tests: 8 files, 27 tests passed.
- Web tests: 1 file, 3 tests passed.
- Playwright E2E: 8 tests passed across desktop and mobile Chromium.
- Mobile-only Playwright: 4 tests passed.
- Screenshot-marked Playwright tests: 4 tests passed.
- New reconciliation tests cover duplicate matching, linked approval resolution, contact method defaults, reject/defer non-mutation, import batch grouping, and review filter by batch/kind.
- Cross-client leakage integration test: pass.
- Global model scope guard: pass.
- Dependency deny-list guard: pass.
- Build: pass.

### Hermes / Sevenfold

- No Hermes or sevenfold review gate triggered. This pass did not alter campaign workspace shape, export folder conventions, architecture stack, ports, integrations, or runtime coupling boundaries.

### Blockers / Stopping Conditions

- None so far. No outbound messaging path, credential dependency, destructive migration, systemd change, or runtime coupling introduced.

### Rollback Notes

- Revert the forthcoming branch commit to remove this reconciliation/review-approval pass.
- No migration was added.
- Restore from the latest `data/backups/` snapshot if operator test imports should be reset.

### Next Recommended Action

- Commit, tag, and push `phase-4-reconciliation-review-complete`, then stop at the phase boundary for Bo review.

---

## 2026-05-09T20:53:26-07:00 — Ontology / Tabulator / Bucketer Alignment Planning

### Action

Started branch `phase-4-ontology-alignment-planning` from `phase-4-reconciliation-review-complete`. Inspected BroadLister docs/schema plus read-only ProjectReckoner ontology-core, Tabulator, and Bucketer docs/code. Drafted planning-only bridge contracts for ontology mapping, Tabulator link/artifact exchange, and Bucketer signal/monitoring hint exchange. No runtime integration or schema migration was added.

### Files Changed

- `docs/BROADLISTER_BUCKETER_BRIDGE_CONTRACT.md`
- `docs/BROADLISTER_ONTOLOGY_ALIGNMENT_PLAN.md`
- `docs/BROADLISTER_PROJECTRECKONER_BRIDGE_PLAN.md`
- `docs/BROADLISTER_TABULATOR_BRIDGE_CONTRACT.md`
- `docs/BROADLISTER_NEXT_DEVELOPMENT_PLAN.md`
- `docs/IMPLEMENTATION_LOG.md`
- `.hermes/plans/2026-05-09_205308-broadlister-ontology-alignment-architecture-review.md`

### Commands Run

- `git checkout -b phase-4-ontology-alignment-planning`: exit 0
- Read-only inspection of BroadLister docs/schema and ProjectReckoner ontology-core/Tabulator/Bucketer docs/code: exit 0
- `hermes -z <architecture review prompt>`: exit 0; returned PASS with conditions and wrote `.hermes/plans/2026-05-09_205308-broadlister-ontology-alignment-architecture-review.md`
- `pnpm verify`: exit 0
- `pnpm check:global-models && pnpm check:denylist && pnpm build`: exit 0

### Tests Run

- API tests: 8 files, 27 tests passed.
- Web tests: 1 file, 3 tests passed.
- Global model scope guard: pass.
- Dependency deny-list guard: pass.
- Build: pass.

### Planning Conclusions

- Recommended sequence: docs-only contract package first, then read-only ontology/tag mapping snapshot import into BroadLister review queue.
- Do not start Tabulator export, Bucketer signal import, or BroadLister monitoring hints until mapping semantics and leakage tests exist.
- Use file/snapshot contracts before any API integration.
- Store external references locally as JSON metadata or a future local mapping table; no hard foreign keys to external systems.

### Hermes / Reckoner-Dev / Sevenfold

- Hermes General/default returned PASS with conditions.
- Hermes reported a read-only reckoner-dev-style consultation and did not contact sevenfold.
- Key conditions: keep bridges contract/file/snapshot based, no runtime dependency, no direct external writes, all imports through `ReviewItem`, all exports operator-triggered and scoped, client/campaign overlays separate from global graph facts, citations travel with all bridge payloads, external IDs remain JSON references.
- Recommended order: docs-only now, read-only ontology import/reference first, reviewed BroadLister artifact export to Tabulator second, Bucketer-to-BroadLister article candidates later, BroadLister-to-Bucketer monitoring hints last.

### Blockers / Stopping Conditions

- None. This phase is docs-only and does not touch external repos, credentials, services, databases, systemd, Gmail, or outreach paths.

### Rollback Notes

- Revert the forthcoming planning-doc commit to remove this phase.
- No database backup required for docs-only changes; no data mutation occurred.

### Next Recommended Action

- Incorporate Hermes review response, run docs/git verification, commit, tag, and push the planning package.

---

## 2026-05-09T21:02:24-07:00 — Bridge A Ontology Snapshot Import

### Action

Started branch `phase-4-ontology-snapshot-import` from `phase-4-ontology-alignment-planning-complete`. Implemented static local JSON ontology snapshot preview/import. Preview shows source system/version, concept name/kind, external ID, suggested local BroadLister tag match, confidence, and reason. Commit creates `ImportBatch(source_type='ontology_snapshot')`, `ImportBatchRow`, and `ReviewItem(kind='ontology_mapping_candidate')` only. Approval creates or matches a local `Tag` and updates only `Tag.external_ids_json`. Reject/defer mutates no tags.

### Files Changed

- `apps/api/src/routes/imports.ts`
- `apps/api/src/services/ontology-snapshot.ts`
- `apps/api/src/services/review.ts`
- `apps/api/test/ontology-snapshot.test.ts`
- `apps/web/src/api.ts`
- `apps/web/src/components/ReviewQueue.tsx`
- `apps/web/src/screens/ImportScreen.tsx`
- `apps/web/src/types.ts`
- `docs/fixtures/ontology-snapshot.v1.example.json`
- `docs/BROADLISTER_ONTOLOGY_ALIGNMENT_PLAN.md`
- `docs/BROADLISTER_PROJECTRECKONER_BRIDGE_PLAN.md`
- `docs/BROADLISTER_OPERATOR_RUNBOOK.md`
- `docs/BROADLISTER_NEXT_DEVELOPMENT_PLAN.md`
- `docs/IMPLEMENTATION_LOG.md`

### Commands Run

- `git checkout -b phase-4-ontology-snapshot-import`: exit 0
- `pnpm --filter @broadlister/api test -- ontology-snapshot.test.ts`: exit 1; fixed fixture parse assertion
- `pnpm --filter @broadlister/api typecheck && pnpm --filter @broadlister/api test -- ontology-snapshot.test.ts`: exit 0

### Tests Run

- API tests: 9 files, 34 tests passed.
- New ontology snapshot tests cover parse, preview, review item creation, approval updating `Tag.external_ids_json`, reject/defer non-mutation, malformed snapshot errors, and no network calls.
- Cross-client leakage integration test: pass.

### Hermes / Sevenfold

- No new Hermes/sevenfold gate triggered. Implementation follows the prior Hermes PASS conditions: static snapshot/file route, no runtime coupling, no external writes, review-gated only.

### Blockers / Stopping Conditions

- None. No network calls, external writes, credentials, schema migration, systemd change, outreach behavior, or client-overlay promotion introduced.

### Rollback Notes

- Revert the forthcoming branch commit to remove Bridge A.
- No migration was added.
- Approved test mappings affect only local `Tag.external_ids_json`; restore from latest backup if test data cleanup is needed.

### Next Recommended Action

- Run full verification stack, backup DB, commit, tag, push, then stop for Bo review.

---

## 2026-05-10T10:36:20-07:00 — Tabulator Export Preview UI

### Action

Started branch `phase-4-tabulator-export-preview-ui` from the clean preview-route checkpoint. Added an operator-facing `Exports` screen that calls `GET /tabulator/export/preview` and displays the in-memory bundle preview only.

### Files Changed

- `apps/web/src/App.tsx`
- `apps/web/src/api.ts`
- `apps/web/src/screens/TabulatorPreviewScreen.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/types.ts`
- `apps/web/src/utils/tabulatorPreview.ts`
- `apps/web/src/utils/tabulatorPreview.test.ts`
- `e2e/broadlister-smoke.spec.ts`
- `docs/BROADLISTER_TABULATOR_BRIDGE_CONTRACT.md`
- `docs/IMPLEMENTATION_LOG.md`

### Commands Run

- `git status --short --branch`: exit 0
- `pnpm --filter @broadlister/web typecheck`: exit 0
- `pnpm --filter @broadlister/web test`: exit 0
- `pnpm verify`: exit 0
- `pnpm check:global-models`: exit 0
- `pnpm check:denylist`: exit 0
- `pnpm build`: exit 0
- `pnpm --filter @broadlister/api test -- tabulator-export-preview.test.ts`: exit 0
- `pnpm --filter @broadlister/api test -- tabulator-export-preview-route.test.ts`: exit 0
- `pnpm --filter @broadlister/api test -- cross-client-leakage.test.ts`: exit 0
- `pnpm test:e2e`: exit 1 initially; local Playwright Chromium cache missing
- `pnpm test:mobile`: exit 1 initially; local Playwright Chromium cache missing
- `pnpm exec playwright install chromium`: exit 0; installed local Playwright browser cache only
- `pnpm test:e2e`: exit 0
- `pnpm test:mobile`: exit 1 during concurrent e2e run; one timeout in import flow
- `pnpm test:mobile`: exit 0 when rerun alone
- `pnpm test:e2e`: exit 0 after adding the Tabulator preview UI smoke test
- `pnpm check:global-models`: exit 0 after e2e update
- `pnpm check:denylist`: exit 0 after e2e update
- `pnpm build`: exit 0 after e2e update
- `pnpm test:mobile`: exit 0 after e2e update

### Tests Run

- Web typecheck/lint/unit: pass.
- Web unit tests: 2 files, 5 tests passed.
- API tests through `pnpm verify`: 12 files, 60 tests passed.
- Targeted API Tabulator preview, preview route, and cross-client leakage suites: pass.
- Playwright E2E desktop/mobile: 10 tests passed after adding the preview UI coverage.
- Playwright mobile-only: 5 tests passed.

### Hermes / Sevenfold

- No new review gate triggered. This slice adds a BroadLister-local preview UI only and does not change export shape, add runtime coupling, or create external writes.

### Blockers / Stopping Conditions

- None.

### Rollback Notes

- Revert the forthcoming commit. No schema migration, route mutation, file writer, JSON download, Tabulator dependency, or external write was added.

### Next Recommended Action

- Run the full required verification stack. If green, commit, tag `phase-4-tabulator-export-preview-ui-complete`, and push branch/tag.

---

## 2026-05-09T21:19:40-07:00 — Ontology Review Refinement Final Verification

### Action

Completed full verification and backup for ontology review refinement.

### Files Changed

- `docs/IMPLEMENTATION_LOG.md`

### Commands Run

- `pnpm verify`: exit 0
- `pnpm check:global-models && pnpm check:denylist && pnpm build`: exit 0
- `pnpm test:e2e`: exit 0
- `pnpm test:mobile`: exit 0
- `pnpm verify:full`: exit 0
- `pnpm backup:db`: exit 0

### Tests Run

- API tests: 9 files, 42 tests passed.
- Web unit tests: 1 file, 3 tests passed.
- Playwright E2E: 8 tests passed.
- Mobile Playwright: 4 tests passed.
- Global-model guard: pass.
- Dependency deny-list guard: pass.
- Cross-client leakage integration test: pass.

### Backup

- `/home/bxby/development/BroadLister/data/backups/broadlister-2026-05-10T04-19-40-279Z.sqlite`

### Hermes / Sevenfold

- No new review gate triggered.

### Blockers / Stopping Conditions

- None.

### Rollback Notes

- Revert the forthcoming commit and restore the backup above if local test data needs rollback.

### Next Recommended Action

- Commit and tag `phase-4-ontology-review-refinement-complete`.

---

## 2026-05-09T21:40:08-07:00 — Tabulator Export Planning

### Action

Started branch `phase-4-tabulator-export-planning` from `phase-4-ontology-review-refinement-complete`. Completed docs-only planning for future BroadLister reviewed-media local JSON export to Tabulator. No export implementation, network calls, external writes, schema changes, or runtime coupling added.

### Files Changed

- `docs/BROADLISTER_TABULATOR_BRIDGE_CONTRACT.md`
- `docs/BROADLISTER_PROJECTRECKONER_BRIDGE_PLAN.md`
- `docs/BROADLISTER_NEXT_DEVELOPMENT_PLAN.md`
- `docs/IMPLEMENTATION_LOG.md`

### Commands Run

- `git checkout -b phase-4-tabulator-export-planning`: exit 0
- Read-only Tabulator inspection: `sed` over Tabulator docs and Prisma schema, exit 0
- Hermes architecture review via `/home/bxby/.local/bin/hermes -z ...`: exit 0

### Tests Run

- Docs-only phase. No application tests required before docs commit.
- No code, package, schema, DB, or runtime behavior changed.

### Hermes / Reckoner-Dev / Sevenfold

- Hermes General/default returned `PASS WITH CONDITIONS`.
- Hermes confirmed file-first BroadLister export fits Tabulator architecture better than direct POST.
- Hermes guidance: BroadLister should export a neutral local source bundle; future Tabulator importer owns mapping into `Link`, `ExternalSourceRecord`, `Tag`, `LinkTag`, and optional `ResearchArtifact`.
- Conditions: allowlist serialization only; explicit forbidden-field tests; provenance required; stable idempotency keys; preview-first behavior; no network calls; no external writes; no Tabulator runtime dependency.
- Hermes said sevenfold review is not required for this architecture-only planning pass if the contract remains reviewed public media plus provenance/redaction. Sevenfold review should happen before implementation/export-shape approval if client workflow, client-folder conventions, approvals, or scoped client exports are affected.

### Blockers / Stopping Conditions

- None. Planning remains local docs-only.

### Rollback Notes

- Revert the forthcoming docs commit to remove this planning package.
- No database backup required because no data mutation occurred.

### Next Recommended Action

- Commit and tag `phase-4-tabulator-export-planning-complete`.

---

## 2026-05-10T10:08:48-07:00 — Tabulator Export Test Scaffold

### Action

Started branch `phase-4-tabulator-export-tests` from `phase-4-tabulator-export-planning-complete`. Added a pure in-memory `BroadListerReviewedMediaExportBundle.v1` contract helper and safety tests. No API route, UI, DB query, file writer, Tabulator POST/import integration, network behavior, external write, schema change, or user-facing export behavior was added.

### Files Changed

- `apps/api/src/services/tabulator-export-contract.ts`
- `apps/api/test/tabulator-export-contract.test.ts`
- `docs/BROADLISTER_TABULATOR_BRIDGE_CONTRACT.md`
- `docs/BROADLISTER_PROJECTRECKONER_BRIDGE_PLAN.md`
- `docs/BROADLISTER_NEXT_DEVELOPMENT_PLAN.md`
- `docs/IMPLEMENTATION_LOG.md`

### Commands Run

- `git checkout -b phase-4-tabulator-export-tests`: exit 0
- `pnpm --filter @broadlister/api typecheck && pnpm --filter @broadlister/api test -- tabulator-export-contract.test.ts`: exit 1; tightened forbidden-field path matching and test volatility handling
- `pnpm --filter @broadlister/api typecheck && pnpm --filter @broadlister/api test -- tabulator-export-contract.test.ts`: exit 0
- `pnpm verify`: exit 0
- `pnpm check:global-models && pnpm check:denylist && pnpm build && pnpm --filter @broadlister/api test -- cross-client-leakage.test.ts`: exit 0

### Tests Run

- API targeted suite: 10 files, 50 tests passed.
- Full `pnpm verify`: API 10 files / 50 tests passed; web 1 file / 3 tests passed; typecheck and lint passed.
- Global-model guard: pass.
- Dependency deny-list guard: pass.
- Build: pass.
- New Tabulator export contract tests cover forbidden-field denylist, client overlay leakage detection, reviewed-only export, provenance-required omission, deterministic bundle shape, repeat-export idempotency, no network calls, no external writes, and no Tabulator runtime dependency.
- Cross-client leakage integration test: pass in targeted API suite.

### Hermes / Sevenfold

- No new review gate triggered. This slice implements Hermes PASS WITH CONDITIONS safety scaffolding only and does not implement an export feature.

### Blockers / Stopping Conditions

- None.

### Rollback Notes

- Revert the forthcoming branch commit. No database, schema, dependency, or runtime behavior changed.

### Next Recommended Action

- Commit, tag `phase-4-tabulator-export-tests-complete`, and report that export implementation remains deferred.

---

## 2026-05-10T10:24:51-07:00 — Tabulator Export Preview Service

### Action

Started branch `phase-4-tabulator-export-preview` from `phase-4-tabulator-export-tests-complete`. Added a DB-backed, service-only Tabulator export preview that reads approved/provenance-backed public BroadLister media records, maps only allowlisted fields into the existing `BroadListerReviewedMediaExportBundle.v1` helper, and returns an in-memory bundle plus preview metadata/omission reasons. No route, UI, JSON download, file writer, Tabulator API call, network behavior, contact-method export, schema change, or runtime dependency was added.

### Files Changed

- `apps/api/src/services/tabulator-export-preview.ts`
- `apps/api/test/tabulator-export-preview.test.ts`
- `docs/BROADLISTER_TABULATOR_BRIDGE_CONTRACT.md`
- `docs/IMPLEMENTATION_LOG.md`

### Commands Run

- `git checkout -b phase-4-tabulator-export-preview`: exit 0
- `pnpm --filter @broadlister/api typecheck && pnpm --filter @broadlister/api test -- tabulator-export-preview.test.ts`: exit 2; fixed preview service type narrowing
- `pnpm --filter @broadlister/api typecheck && pnpm --filter @broadlister/api test -- tabulator-export-preview.test.ts`: exit 1; fixed test string assertion and file-write assertion strategy
- `pnpm --filter @broadlister/api typecheck && pnpm --filter @broadlister/api test -- tabulator-export-preview.test.ts`: exit 0
- `git diff --check && pnpm verify`: exit 0
- `pnpm check:global-models && pnpm check:denylist && pnpm build && pnpm --filter @broadlister/api test -- tabulator-export-preview.test.ts && pnpm --filter @broadlister/api test -- cross-client-leakage.test.ts`: exit 1; deterministic preview test was reading concurrent test-created rows from the shared SQLite DB
- `pnpm --filter @broadlister/api typecheck && pnpm --filter @broadlister/api test -- tabulator-export-preview.test.ts`: exit 0 after adding optional selected article-id scope
- `pnpm check:global-models && pnpm check:denylist && pnpm build && pnpm --filter @broadlister/api test -- cross-client-leakage.test.ts`: exit 0

### Tests Run

- API targeted suite: 11 files, 55 tests passed.
- Full `pnpm verify`: API 11 files / 55 tests passed; web 1 file / 3 tests passed; typecheck and lint passed.
- Global-model guard: pass.
- Dependency deny-list guard: pass.
- Build: pass.
- New preview tests cover reviewed public record inclusion, unapproved omission, missing-provenance omission, client-overlay exclusion, contact-method exclusion, deterministic output, no network calls, no file writer imports, and cross-client isolation in the generic preview.
- Cross-client leakage integration test: pass in targeted API suite.

### Hermes / Sevenfold

- No review gate triggered. This slice stays within the approved service-only local preview scope and does not add runtime integration, export route shape, Sevenfold export-folder behavior, or outreach behavior.

### Blockers / Stopping Conditions

- None.

### Rollback Notes

- Revert the forthcoming branch commit. No database schema, route, dependency, external integration, or file output changed.

### Next Recommended Action

- Run full verification stack, commit, tag `phase-4-tabulator-export-preview-complete`, push branch/tag, then report that routes/UI/download/Tabulator integration remain deferred.

---

## 2026-05-10T10:30:24-07:00 — Tabulator Export Preview Route

### Action

Started branch `phase-4-tabulator-export-preview-route` from `phase-4-tabulator-export-preview-complete`. Added read-only `GET /tabulator/export/preview`, wired to the existing DB-backed preview service. The route returns the in-memory bundle and omission metadata, accepts deterministic preview query parameters, and supports optional comma-separated `article_ids` scoping. No UI, JSON download, file writer, Tabulator API call, network behavior beyond the local API request, contact-method export, schema change, external write, or runtime dependency was added.

### Files Changed

- `apps/api/src/app.ts`
- `apps/api/src/routes/tabulator-export.ts`
- `apps/api/test/tabulator-export-preview-route.test.ts`
- `docs/BROADLISTER_TABULATOR_BRIDGE_CONTRACT.md`
- `docs/IMPLEMENTATION_LOG.md`

### Commands Run

- `git checkout -b phase-4-tabulator-export-preview-route`: exit 0
- `pnpm --filter @broadlister/api typecheck && pnpm --filter @broadlister/api test -- tabulator-export-preview-route.test.ts`: exit 0
- `git diff --check && pnpm verify`: exit 0
- `pnpm check:global-models && pnpm check:denylist && pnpm build && pnpm --filter @broadlister/api test -- tabulator-export-preview.test.ts && pnpm --filter @broadlister/api test -- tabulator-export-preview-route.test.ts && pnpm --filter @broadlister/api test -- cross-client-leakage.test.ts`: exit 0

### Tests Run

- API targeted suite: 12 files, 60 tests passed.
- Full `pnpm verify`: API 12 files / 60 tests passed; web 1 file / 3 tests passed; typecheck and lint passed.
- Global-model guard: pass.
- Dependency deny-list guard: pass.
- Build: pass.
- New route tests cover preview bundle response, omission metadata for unapproved and missing-provenance articles, client-private field exclusion, contact-method exclusion, selected article-id scoping, no network calls, no file writer imports, no Tabulator runtime dependency, and generic cross-client isolation.
- Cross-client leakage integration test: pass in targeted API suite.

### Hermes / Sevenfold

- No review gate triggered. This is a read-only local API preview route and does not add a Tabulator integration, export file shape, UI workflow, Sevenfold client-folder export behavior, or outreach behavior.

### Blockers / Stopping Conditions

- None.

### Rollback Notes

- Revert the forthcoming branch commit. No database schema, file output, dependency, external integration, or UI behavior changed.

### Next Recommended Action

- Commit, tag `phase-4-tabulator-export-preview-route-complete`, push branch/tag, then report that UI/download/Tabulator integration remain deferred.

---

## 2026-05-09T21:05:15-07:00 — Bridge A Final Verification

### Action

Completed full Bridge A verification and backup. Fixed one E2E selector ambiguity after adding ontology import controls; no product behavior change.

### Files Changed

- `docs/IMPLEMENTATION_LOG.md`
- `e2e/broadlister-smoke.spec.ts`

### Commands Run

- `pnpm verify`: exit 0
- `pnpm check:global-models && pnpm check:denylist && pnpm build`: exit 0
- `pnpm test:e2e`: exit 1; strict locator ambiguity for `Snapshot JSON` label
- `pnpm test:e2e`: exit 0 after selector fix
- `pnpm test:mobile`: exit 0
- `pnpm verify:full`: exit 0
- `pnpm backup:db`: exit 0

### Tests Run

- API tests: 9 files, 34 tests passed.
- Web unit tests: 1 file, 3 tests passed.
- Playwright E2E: 8 tests passed.
- Mobile Playwright: 4 tests passed.
- Global-model guard: pass.
- Dependency deny-list guard: pass.
- Cross-client leakage integration test: pass.

### Backup

- `/home/bxby/development/BroadLister/data/backups/broadlister-2026-05-10T04-05-15-398Z.sqlite`

### Hermes / Sevenfold

- No new review gate triggered. Bridge remains local, static, review-gated, and docs/API/UI only inside BroadLister.

### Blockers / Stopping Conditions

- None.

### Rollback Notes

- Revert the forthcoming commit and restore the backup above if local test data needs rollback.

### Next Recommended Action

- Commit and tag `phase-4-ontology-snapshot-import-complete`.

---

## 2026-05-09T21:17:57-07:00 — Ontology Review Refinement

### Action

Started branch `phase-4-ontology-review-refinement` from `phase-4-ontology-snapshot-import-complete`. Refined local ontology snapshot import/review only. Added field-level preview payloads, mapping statuses, conflict reasons, external IDs to add, snapshot provenance, repeated-import pending review reuse, and approval blocking for conflict/duplicate source ID rows.

### Files Changed

- `apps/api/src/routes/imports.ts`
- `apps/api/src/services/ontology-snapshot.ts`
- `apps/api/src/services/review.ts`
- `apps/api/test/ontology-snapshot.test.ts`
- `apps/web/src/components/ReviewQueue.tsx`
- `apps/web/src/screens/ImportScreen.tsx`
- `apps/web/src/types.ts`
- `docs/BROADLISTER_NEXT_DEVELOPMENT_PLAN.md`
- `docs/BROADLISTER_ONTOLOGY_ALIGNMENT_PLAN.md`
- `docs/BROADLISTER_OPERATOR_RUNBOOK.md`
- `docs/BROADLISTER_PROJECTRECKONER_BRIDGE_PLAN.md`
- `docs/fixtures/ontology-snapshot.v1.example.json`
- `docs/IMPLEMENTATION_LOG.md`

### Commands Run

- `git checkout -b phase-4-ontology-review-refinement`: exit 0
- `pnpm --filter @broadlister/api typecheck && pnpm --filter @broadlister/api test -- ontology-snapshot.test.ts`: exit 1; conflict detection was too broad
- `pnpm --filter @broadlister/api test -- ontology-snapshot.test.ts`: exit 0 after narrowing conflict detection

### Tests Run

- API targeted suite: 9 files, 42 tests passed.
- New/expanded ontology tests cover field-level preview payload, repeated import reuse, duplicate source IDs, external ID conflict blocking, normalized label/kind matching, same-label different-kind handling, idempotent already-mapped approval, malformed partial concepts, no network calls, and reject/defer non-mutation.
- Cross-client leakage integration test: pass in targeted API suite.

### Hermes / Sevenfold

- No new review gate triggered. This is a local BroadLister refinement with no runtime dependency, external write, outreach behavior, schema migration, or export-shape change.

### Blockers / Stopping Conditions

- None.

### Rollback Notes

- Revert the forthcoming branch commit. No schema migration was added.
- Approval continues to touch only local `Tag.external_ids_json`; restore from latest DB backup if local test data cleanup is required.

### Next Recommended Action

- Run full verification stack, backup DB, commit, tag, push, then stop for Bo review.

---

## 2026-05-10T10:41:53-07:00 — Tabulator Export Preview UI Closeout

### Action

Completed the preview UI slice on `phase-4-tabulator-export-preview-ui`. Added the `Exports` nav screen, preview-only Tabulator bundle panel, optional article ID scoping controls, omission/provenance/safety display, responsive styles, web utility tests, and Playwright coverage for the new UI.

### Files Changed

- `apps/web/src/App.tsx`
- `apps/web/src/api.ts`
- `apps/web/src/screens/TabulatorPreviewScreen.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/types.ts`
- `apps/web/src/utils/tabulatorPreview.ts`
- `apps/web/src/utils/tabulatorPreview.test.ts`
- `e2e/broadlister-smoke.spec.ts`
- `docs/BROADLISTER_TABULATOR_BRIDGE_CONTRACT.md`
- `docs/IMPLEMENTATION_LOG.md`

### Commands Run

- `pnpm verify`: exit 0
- `pnpm check:global-models`: exit 0
- `pnpm check:denylist`: exit 0
- `pnpm build`: exit 0
- `pnpm --filter @broadlister/api test -- tabulator-export-preview.test.ts`: exit 0
- `pnpm --filter @broadlister/api test -- tabulator-export-preview-route.test.ts`: exit 0
- `pnpm --filter @broadlister/api test -- cross-client-leakage.test.ts`: exit 0
- `pnpm exec playwright install chromium`: exit 0; local tool cache only, needed because browser binary was missing
- `pnpm test:e2e`: exit 0
- `pnpm test:mobile`: exit 0

### Tests Run

- Full verify: pass.
- Global-model guard: pass.
- Dependency deny-list guard: pass.
- Build: pass.
- API tests: 12 files, 60 tests passed.
- Web unit tests: 2 files, 5 tests passed.
- Playwright E2E: 10 tests passed.
- Playwright mobile-only: 5 tests passed.

### Hermes / Sevenfold

- No review gate triggered. UI is preview-only inside BroadLister; no export shape change, runtime coupling, JSON download, file writer, Tabulator API call, external write, contact export, or schema change.

### Blockers / Stopping Conditions

- None.

### Rollback Notes

- Revert the forthcoming commit. Remove the local Playwright Chromium cache only if reclaiming disk space is desired; it is not part of the repo.

### Next Recommended Action

- Commit, tag `phase-4-tabulator-export-preview-ui-complete`, push branch/tag. Next product slice should be operator-confirmed local JSON download/export planning or implementation, only if Bo approves.

---

## 2026-05-10T10:56:21-07:00 — Tabulator Export JSON Download

### Action

Started branch `phase-4-tabulator-export-json-download` from `phase-4-tabulator-export-preview-ui-complete`. Added an operator-confirmed browser download flow for the existing allowlisted Tabulator preview bundle. The flow validates bundle version, safety flags, and forbidden contact/client-private field fragments before creating a local browser download.

### Files Changed

- `apps/web/src/screens/TabulatorPreviewScreen.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/utils/tabulatorPreview.ts`
- `apps/web/src/utils/tabulatorPreview.test.ts`
- `e2e/broadlister-smoke.spec.ts`
- `docs/BROADLISTER_TABULATOR_BRIDGE_CONTRACT.md`
- `docs/IMPLEMENTATION_LOG.md`

### Commands Run

- `git checkout -b phase-4-tabulator-export-json-download`: exit 0
- `pnpm --filter @broadlister/web typecheck`: exit 0
- `pnpm --filter @broadlister/web test`: exit 0

### Tests Run

- Web typecheck: pass.
- Web unit tests: 2 files, 9 tests passed.

### Hermes / Sevenfold

- No review gate triggered. This is a BroadLister-local browser download of the existing reviewed-media bundle; it adds no Tabulator runtime dependency, external write, schema change, contact export, or outreach behavior.

### Blockers / Stopping Conditions

- None.

### Rollback Notes

- Revert the forthcoming commit. No schema migration, backend writer, Tabulator dependency, or external write was added.

### Next Recommended Action

- Run full verification stack. If green, commit, tag `phase-4-tabulator-export-json-download-complete`, and push branch/tag.

---

## 2026-05-10T11:01:59-07:00 — Tabulator Export JSON Download Closeout

### Action

Completed the operator-confirmed local JSON download flow. Download remains browser-local and uses only the allowlisted `BroadListerReviewedMediaExportBundle.v1` payload returned by the existing preview route.

### Files Changed

- `apps/web/src/screens/TabulatorPreviewScreen.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/utils/tabulatorPreview.ts`
- `apps/web/src/utils/tabulatorPreview.test.ts`
- `e2e/broadlister-smoke.spec.ts`
- `docs/BROADLISTER_TABULATOR_BRIDGE_CONTRACT.md`
- `docs/IMPLEMENTATION_LOG.md`

### Commands Run

- `pnpm --filter @broadlister/web typecheck`: exit 0
- `pnpm --filter @broadlister/web test`: exit 0
- `pnpm verify`: exit 0
- `pnpm check:global-models`: exit 0
- `pnpm check:denylist`: exit 0
- `pnpm build`: exit 0
- `pnpm --filter @broadlister/api test -- tabulator-export-preview.test.ts`: exit 0
- `pnpm --filter @broadlister/api test -- tabulator-export-preview-route.test.ts`: exit 0
- `pnpm --filter @broadlister/api test -- cross-client-leakage.test.ts`: exit 0
- `pnpm test:e2e`: exit 0
- `pnpm test:mobile`: exit 0

### Tests Run

- Full verify: pass.
- Global-model guard: pass.
- Dependency deny-list guard: pass.
- Build: pass.
- API tests: 12 files, 60 tests passed.
- Web unit tests: 2 files, 9 tests passed.
- Playwright E2E: 12 tests passed.
- Playwright mobile-only: 6 tests passed.

### Hermes / Sevenfold

- No review gate triggered. No Tabulator runtime/API integration, external write, backend file writer, contact export, schema change, or outreach behavior was added.

### Blockers / Stopping Conditions

- None. An early concurrent Playwright run exposed a checkbox touch-target issue and an overly broad raw-string denylist assertion; both were fixed and sequential verification passed.

### Rollback Notes

- Revert the forthcoming commit. No database migration, backend file writer, external dependency, or external write was introduced.

### Next Recommended Action

- Commit, tag `phase-4-tabulator-export-json-download-complete`, and push branch/tag. Next slice should be Tabulator-side offline import adapter planning or a narrower operator runbook for handling downloaded bundles; direct Tabulator runtime integration remains deferred.
