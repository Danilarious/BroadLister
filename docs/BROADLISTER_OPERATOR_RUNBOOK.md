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

## Common Commands

```bash
pnpm verify
pnpm check:global-models
pnpm check:denylist
pnpm build
pnpm backup:db
```

Use `pnpm verify` before committing changes. Use `pnpm backup:db` before migrations, import experiments, or broad data edits.

## Access From Mac

Safest default access is an SSH tunnel from the Mac to the ThinkPad:

```bash
ssh -L 4100:127.0.0.1:4100 -L 3021:127.0.0.1:3021 bxby@bxby-thinkpad
```

Then open `http://127.0.0.1:4100` on the Mac. This keeps BroadLister bound to localhost on the ThinkPad.

## Access From Phone

Phone access requires an intentional temporary network path. Preferred options:

- Use a trusted private tunnel/VPN to the ThinkPad, then open the forwarded web port.
- Temporarily bind only the Vite web server to the LAN and rely on its local API proxy:

```bash
pnpm --filter @broadlister/api dev
pnpm --filter @broadlister/web dev -- --host 0.0.0.0
```

Find the ThinkPad LAN address with:

```bash
hostname -I
```

Open `http://<thinkpad-lan-ip>:4100` from the phone while both devices are on the trusted LAN. Stop the dev server after use. Do not expose BroadLister to the public internet.

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
```

Expected safeguards:

- API and web type checks pass.
- Lint passes.
- API tests pass, including the real cross-client leakage integration test.
- Web tests pass.
- Dependency deny-list blocks send-side mail packages.
- Global Prisma models do not carry `client_id`.

## Operator Safety Rules

- No autonomous outreach.
- No Gmail send or sync flow.
- No hidden outbound messaging.
- No systemd unit.
- No remote logging or cloud database.
- Client strategy, narrative fit, warmth, approval, and exclusions stay overlay-scoped.
