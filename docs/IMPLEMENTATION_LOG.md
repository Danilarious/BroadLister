# BroadLister Implementation Log

## Phase Index

- Phase 0 closeout: in progress
- Phase 1 data model and importer: planned, blocked on explicit `git init` approval
- Phase 2 UI for contacts/outlets/articles/tags: not started
- Phase 3 campaign overlays and list builder: not started
- MVP boundary: stop after Phase 3 exit

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
