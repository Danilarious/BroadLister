# BroadLister

Local-first media intelligence and campaign-scoped media-list workspace for Sevenfold.io.

Planning docs start at [docs/README.md](docs/README.md).

## Phase Boundary

Current implementation target: MVP through Phase 3.

- API: Fastify + Prisma + SQLite on `127.0.0.1:3021`
- Web: React + Vite on `127.0.0.1:4100`
- No systemd unit
- No Gmail, email-send, DM, webhook, or outreach automation
- BroadLister runtime remains independent from ProjectReckoner, TaskReckoner, Bucketer, Tabulator, BusyIntern, Hermes, and sevenfold

## Verification

```bash
pnpm verify
pnpm check:global-models
pnpm check:denylist
pnpm build
pnpm test:e2e
pnpm verify:full
```

Browser validation uses Playwright. Screenshots and traces are written under `test-results/` and are ignored by git.
