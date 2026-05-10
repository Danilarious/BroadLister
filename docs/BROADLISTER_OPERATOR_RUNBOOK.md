# BroadLister Operator Runbook

## Purpose

BroadLister is a local-first Sevenfold media intelligence workspace. It stores reusable global media records separately from client-specific campaign overlays, approvals, and exports. It does not send email, sync Gmail, schedule outreach, or run as an always-on service.

## Local Ports

- API: `http://127.0.0.1:3021`
- Web: `http://127.0.0.1:4100`
- Default database: `data/broadlister.sqlite`

## Start The App

From `/home/bxby/development/BroadLister`:

```bash
pnpm install
pnpm db:generate
pnpm dev
```

Open `http://127.0.0.1:4100` on the ThinkPad.

## Tailscale Access From iPhone

Prefer Tailscale-only access over LAN-wide or public tunnels.

Current ThinkPad Tailscale identity:

- IPv4: `100.109.2.15`
- MagicDNS: `bxby-thinkpad.tail54427b.ts.net`

Start API localhost-only:

```bash
pnpm --filter @broadlister/api dev
```

Start the web app bound only to the ThinkPad Tailscale IP:

```bash
pnpm --filter @broadlister/web exec vite --host 100.109.2.15 --port 4100
```

Open one of these on the iPhone while connected to the same Tailscale tailnet:

```text
http://100.109.2.15:4100/
http://bxby-thinkpad.tail54427b.ts.net:4100/
```

This keeps the API bound to `127.0.0.1:3021`; the Vite dev server proxies `/api` locally from the ThinkPad. Do not create Cloudflare tunnels or public exposure for BroadLister.

## Common Commands

```bash
pnpm verify
pnpm check:global-models
pnpm check:denylist
pnpm build
pnpm backup:db
```

Use `pnpm verify` before committing changes. Use `pnpm backup:db` before migrations, import experiments, or broad data edits.

## Import Review Workflow

1. Open `Imports`.
2. Preview CSV rows or submit an article URL/pasted HTML snapshot.
3. Use `Open Review Queue` after import. The queue opens filtered to that import batch when a batch id exists.
4. Inspect the proposal summary, likely matches, and dependencies.
5. Approve or match only when the proposed action is clear.
6. Defer ambiguous or dependency-blocked proposals.
7. Reject bad extraction or irrelevant records.

Review shortcuts:

- `a`: approve or match selected proposal.
- `d`: defer selected proposal.
- `r`: reject selected proposal.

Safety behavior:

- Imports create review items first, not canonical records.
- Approval uses deterministic matching before creating records.
- Contact methods default to `verification_state=unverified` and `lawful_to_store=false`.
- Client relevance applies only as client-scoped notes.
- BroadLister still does not send outreach or sync Gmail.

## Ontology Snapshot Import

Use this only for static local JSON snapshots. BroadLister does not call ontology-core, Tabulator, Bucketer, ProjectReckoner, Hermes, or sevenfold.

Workflow:

1. Open `Imports`.
2. Use `Static ontology snapshot`.
3. Upload a `.json` file or paste JSON text.
4. Click `Preview ontology`.
5. Inspect source system, source version, concept kind, external ID, suggested BroadLister tag match, confidence, reason, mapping status, field changes, external IDs, and provenance.
6. Click `Create mapping review items`.
7. Open Review Queue filtered to the import batch.
8. Approve only mappings that should update local tag external references.

API:

```bash
POST /api/imports/ontology/preview
POST /api/imports/ontology
```

Fixture:

```text
docs/fixtures/ontology-snapshot.v1.example.json
```

Approval behavior:

- Creates or matches a local `Tag` by slug/name.
- Updates only `Tag.external_ids_json`.
- Stores snapshot/source metadata, import batch row id, approval timestamp, and mapping rationale in `Tag.external_ids_json`.
- Does not write external systems.
- Does not create client tags, campaign narrative fields, outreach status, or client notes.
- Reject/defer mutates no tags.

Mapping statuses:

- `create_new`: approval creates a local global tag and stores external references.
- `match_existing`: approval updates the matched local tag's external references.
- `already_mapped`: preview found the external ID on an existing tag; approval should be idempotent.
- `conflict`: existing local mapping differs from the incoming external ID or kind; reject or defer.
- `duplicate_in_snapshot`: same source ID appears twice in one snapshot; reject or defer duplicates.

Repeated import behavior:

- Re-importing the same `source_system` + `source_version` + `source_record_id` reuses an existing pending ontology review item instead of creating uncontrolled duplicates.
- Preview still shows already mapped concepts so the operator can see why no new tag mutation is needed.

## Access From Mac

Safest default access is an SSH tunnel from the Mac to the ThinkPad:

```bash
ssh -L 4100:127.0.0.1:4100 -L 3021:127.0.0.1:3021 bxby@bxby-thinkpad
```

Then open `http://127.0.0.1:4100` on the Mac. This keeps BroadLister bound to localhost on the ThinkPad.

## Access From Phone

Phone access requires an intentional temporary network path. Preferred options:

- Use a trusted private tunnel/VPN to the ThinkPad, then open the forwarded web port.
- Temporarily bind only the Vite web server to Tailscale or a trusted LAN and rely on its local API proxy:

```bash
pnpm --filter @broadlister/api dev
pnpm --filter @broadlister/web exec vite --host <tailscale-or-lan-ip> --port 4100
```

Find the ThinkPad LAN address with:

```bash
hostname -I
```

Open `http://<thinkpad-ip>:4100` from the phone while both devices are on the trusted network. Stop the dev server after use. Do not expose BroadLister to the public internet.

## Browser Validation

Install Playwright browsers once on the ThinkPad:

```bash
pnpm exec playwright install chromium
```

Run browser smoke tests:

```bash
pnpm test:e2e
pnpm test:mobile
pnpm screenshots
```

Useful modes:

- `pnpm test:e2e`: desktop and mobile browser smoke suite.
- `pnpm test:mobile`: mobile viewport only.
- `pnpm test:ui`: interactive Playwright UI.
- `pnpm screenshots`: captures screenshot-marked flows.

Artifacts are ignored by git:

- `test-results/`
- `playwright-report/`

## Backup And Restore

Create a backup:

```bash
pnpm backup:db
```

Backups are stored in `data/backups/`.

Restore manually while the API is stopped:

```bash
cp data/backups/<backup-file>.sqlite data/broadlister.sqlite
```

Known MVP boundary backup:

```text
data/backups/broadlister-2026-05-08T20-00-43-278Z.sqlite
```

## Verification Checklist

Run before tagging or handing off:

```bash
pnpm verify
pnpm check:global-models
pnpm check:denylist
pnpm build
pnpm test:e2e
pnpm verify:full
```

Expected safeguards:

- API and web type checks pass.
- Lint passes.
- API tests pass, including the real cross-client leakage integration test.
- Web tests pass.
- Dependency deny-list blocks send-side mail packages.
- Global Prisma models do not carry `client_id`.
- Playwright browser smoke tests pass on desktop and mobile viewports.

## Operator Safety Rules

- No autonomous outreach.
- No Gmail send or sync flow.
- No hidden outbound messaging.
- No systemd unit.
- No remote logging or cloud database.
- Client strategy, narrative fit, warmth, approval, and exclusions stay overlay-scoped.
