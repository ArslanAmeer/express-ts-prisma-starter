# Deployment

## Running a production build locally

```bash
pnpm build        # prisma generate → type-check → bundle to dist/index.js
pnpm start:prod   # node dist/index.js
```

`NODE_ENV` defaults to `production` when unset. That gives info-level JSON logs and no response-body capture.

## Docker image

The `Dockerfile` is a multi-stage build:

1. **prod-deps** installs only production dependencies.
2. **build** installs everything, generates the Prisma client and runs `pnpm run build`.
3. **runner** (`node:24-alpine`) copies in `node_modules`, `dist/` and `package.json`, and runs `node dist/index.js` as the unprivileged `node` user on port `8080`.

`.dockerignore` keeps `.env`, `node_modules`, `dist` and generated files out of the build context, so your local secrets never end up in an image.

```bash
docker build -t my-api .
docker run --rm -p 8080:8080 \
  -e DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB" \
  -e CORS_ORIGIN="https://your-frontend.example.com" \
  my-api
```

To reach the Docker Compose database on your Mac from inside a container, use `host.docker.internal` as the host.

## Database migrations in production

The runtime image contains **no Prisma CLI and no migration files**, so it can't migrate the database itself. Apply migrations as a separate step **before** starting the new version, from any environment that has the repository and the production `DATABASE_URL` (a CI job, a release step, or a one-off task):

```bash
pnpm install --frozen-lockfile
DATABASE_URL="postgresql://..." pnpm db:deploy
```

`db:deploy` (`prisma migrate deploy`) only applies migrations that haven't run yet. It never creates migrations or resets data, so it's safe to run on every deploy. Never run `pnpm db:migrate` or `pnpm db:reset` against a shared database.

## Environment variables

All variables are validated at startup. See [Architecture → Configuration](architecture.md#configuration). For production, set at least:

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Hosted PostgreSQL providers usually require SSL: append `?sslmode=require` |
| `CORS_ORIGIN` | The origin of your frontend |
| `PORT` | If your platform assigns one |
| `COMMON_RATE_LIMIT_MAX_REQUESTS`, `COMMON_RATE_LIMIT_WINDOW_MS` | Tune for your traffic (the window value is multiplied by `15 * 60`) |

## Before going live

- **Trust proxy:** `src/server.ts` sets `app.set("trust proxy", true)`, which trusts every `X-Forwarded-For` header. Anyone can then fake their IP and get around the rate limiter, and express-rate-limit logs an `ERR_ERL_PERMISSIVE_TRUST_PROXY` warning at startup. Set it to the number of proxies in front of the app (usually `1`) for your hosting setup.
- Point load balancer or container health checks at `GET /health-check`. It returns `503` when the database is unreachable.
- The app handles `SIGTERM`/`SIGINT`: it stops accepting connections, closes the database pool and exits, or force-exits after 10 seconds.

## CI

`.github/workflows/ci.yml` runs on pushes to `main` and on pull requests:

| Job | What it checks |
| --- | --- |
| Code Quality | `biome ci .` with the Biome version pinned in the lockfile |
| Build | `pnpm build` (Prisma client generation, type-check, bundle) |
| Test | `pnpm test` against a PostgreSQL 18 service container (`app_test`) |
| Docker Build and Push | **Optional, skipped by default.** Builds the image and, on pushes to `main`, publishes it to GitHub Container Registry tagged with the commit SHA and `latest` |

The shared `.github/actions/setup-pnpm` action installs the Node and pnpm versions from `.tool-versions` and restores the pnpm cache. Third-party actions are pinned to commit SHAs, and Renovate keeps them updated.

### Publishing an image is opt-in

The Docker job only runs when the repository variable `ENABLE_DOCKER_PUBLISH` is set to `true` (Settings → Secrets and variables → Actions → Variables). Turn it on when something pulls the image from a registry — a server running `docker run`, Kubernetes, or another machine.

Leave it off when your platform builds from the repository itself. **Coolify, Railway, Render and Fly.io** clone the repo and build the `Dockerfile` on their side, so publishing to GHCR would just duplicate that work.

### Deploying from a git push

With a platform that redeploys whenever `main` changes:

1. Set the environment variables from [Environment variables](#environment-variables) in the platform's dashboard, `DATABASE_URL` first.
2. Run migrations before the new version serves traffic. If the platform has a pre-deploy or release command, put `pnpm db:deploy` there; otherwise run it yourself against the production database before promoting the release.
3. Point the platform's health check at `/health-check`.

The app listens on `PORT` (default `8080`) and logs JSON to stdout, which these platforms collect automatically.

## Upgrading Node.js

The Node version lives in two places. Change both together:

- `.tool-versions`, used locally and by CI
- the two `FROM node:<version>` lines in `Dockerfile`
