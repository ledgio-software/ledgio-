# Contributing to Ledgio

## Branch & PR rules

- **No direct pushes to `main`** — all changes go through a pull request.
- Every PR requires **at least 1 approval** before it can be merged.
- CI must be green (all checks passing) before merge.
- Keep PRs focused: one feature or fix per PR.

## Database migrations

- **Never run `prisma migrate dev` against production.** That command is for local development only — it creates migration files and can reset the DB.
- Use `prisma migrate deploy` for production. It only applies migrations that are not yet in `_prisma_migrations`.
- **Always add nullable columns first.** When adding a NOT NULL column to an existing table:
  1. Add the column as nullable (`TEXT`, not `TEXT NOT NULL`).
  2. Backfill existing rows with the default value in a separate migration.
  3. Add the NOT NULL constraint in a third migration once all rows have a value.
- **Every migration must be reversible.** Document the rollback SQL in a comment at the top of the migration file if it isn't obvious.
- **Test migrations locally** with `npx prisma migrate dev` before opening a PR.

## Secrets & environment variables

- **Never commit secrets** — no API keys, database URLs, JWT secrets, or personal access tokens in any file, including `.env`.
- Use `.env` locally (already in `.gitignore`).
- All production secrets go in **GitHub Secrets** (Actions) or **Render environment variables** — not in code or `render.yaml`.
- If you accidentally commit a secret: rotate it immediately, then remove it from git history with `git filter-repo`.

## Rollback plan

| Layer | How to roll back |
|---|---|
| **Backend code** | Render → service → Deploys → click the last working deploy → **Rollback** |
| **Database** | Render PostgreSQL supports point-in-time recovery (PITR). Open a support ticket with the timestamp to restore to. For Prisma Postgres, use Prisma Console → database → Backups. |
| **Frontend** | Vercel → project → Deployments → find the last working deployment → **Promote to Production** |

## GitHub Secrets to configure

Add these under **repo → Settings → Secrets and variables → Actions**:

| Secret | Where to get it |
|---|---|
| `DATABASE_URL` | Render Postgres → "Connection" tab → "External Database URL" (or Prisma Console → Connect → Pooled URL) |
| `DIRECT_URL` | Prisma Console → Connect → Direct URL (non-pooled) |
| `JWT_SECRET` | Generate: `openssl rand -hex 32` |
| `CREDENTIAL_ENCRYPTION_KEY` | Generate: `openssl rand -hex 32` |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API keys |

## Local development setup

```bash
# Backend
cd backend
cp .env.example .env          # fill in your local values
npm install
npx prisma migrate dev        # applies migrations and generates client
npm run dev                   # starts the API on :3000

# Frontend
cd frontend
npm install
npm run dev                   # starts Vite dev server on :5173
```
