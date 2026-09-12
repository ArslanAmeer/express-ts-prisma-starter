# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Human-facing development standards live in `docs/` (architecture, database, adding-a-feature, testing, coding-standards, deployment). When you change a convention, update the matching doc in the same change.

## Commands

Package manager is **pnpm** (version pinned in `package.json` / `.tool-versions`, alongside Node 24.21.0).

- `pnpm start:dev` — run `src/index.ts` with `tsx` in watch mode
- `pnpm build` — `prisma generate`, `tsc --noEmit` (type check), then `tsdown` (bundles ESM into `dist/index.js`; config is the `tsdown` field in `package.json`)
- `pnpm start:prod` — run `dist/index.js`
- `pnpm check` — Biome format + lint + organize imports, **writes fixes**. CI runs the non-writing `biome ci .`
- `pnpm test` — Vitest, single run. `pnpm test:cov` for coverage
- Single test file: `pnpm vitest run src/api/user/__tests__/userRouter.test.ts`
- Single test by name: `pnpm vitest run -t "should return a user for a valid ID"`

Copy `.env.template` to `.env` before running.

`pnpm install` prints `Ignored build scripts: @scarf/scarf, esbuild`. That is expected — pnpm blocks install scripts by default, `pnpm-workspace.yaml` allows only Prisma's (needed for migrations), and pnpm 10.33 has no setting that hides the notice. Don't try to silence it.

Database (PostgreSQL 18 via `docker-compose.yml`, Prisma 7):
- `pnpm db:up` / `pnpm db:down` — start/stop Postgres. First start creates two databases: `app` (dev) and `app_test` (tests). `db:up` runs `scripts/db-up.mjs`, which checks Docker and starts Docker Desktop (macOS/Windows) when it isn't running
- `pnpm db:migrate --name <change>` — after editing a model, creates and applies a migration; commit the new `prisma/migrations/*` folder
- `pnpm db:deploy` — apply existing migrations only (CI, tests, production)
- `pnpm db:seed`, `pnpm db:reset`, `pnpm db:studio` (browser GUI for the data)
- The Prisma client is generated into `src/generated/prisma` (gitignored) by `postinstall` and `build`; run `pnpm exec prisma generate` after pulling schema changes
- **Tests need Postgres running.** `vitest.global-setup.ts` runs `prisma migrate deploy` against `app_test` (override with `TEST_DATABASE_URL`). Router tests hit the real database; service tests mock the repository

CI (`.github/workflows/ci.yml`) runs Biome, build, and tests (with a Postgres service container), then builds and pushes a Docker image to GHCR.

## Commits and branches

Commit messages **always** start with a gitmoji and a capitalised label: `✨ Add:` (new feature or file), `♻️ Update:` (change existing behaviour, refactor, rename), `🛠️ Fix:` (bug fix), `🔥 Remove:` (delete code or dependencies), `⬆️ Upgrade:` (dependency bumps, releases), `🧪 Test:` (tests only). Example: `✨ Add: posts endpoint`.

`main` is protected: no direct pushes, even for the owner. Work on a branch, open a PR, let CI pass, then squash merge. Details in `docs/coding-standards.md`.

## Architecture

Express 5 + TypeScript REST API (ESM, `"type": "module"`) backed by PostgreSQL through Prisma. `src/server.ts` builds and exports the `app` (plus a shared pino `logger`) without listening. `src/index.ts` is the entrypoint that calls `listen` and handles graceful shutdown (closes the server, then `prisma.$disconnect()`). Tests import `app` from `@/server` and drive it with Supertest.

Imports use the `@/*` alias, which maps to `src/*` (`tsconfig.json` paths, mirrored by `resolve.alias` in `vite.config.mts` for tests — keep the two in sync). Vitest globals (`describe`, `it`, `expect`, `vi`) are enabled, so tests don't import them.

### Feature modules (`src/api/<feature>/`)

Each feature is layered as **Router → Controller → Service → Repository**, with Zod schemas in `<feature>Model.ts`. `user` is the reference implementation; `docs/adding-a-feature.md` walks through a full example.

- **Model**: Zod schemas are the single source of truth for API types (`z.infer`), request validation, and OpenAPI docs. Call `extendZodWithOpenApi(z)` in model files.
- **Router**: creates both an Express `Router` and an `OpenAPIRegistry`. Each route has a `registry.registerPath(...)` call next to it, using `createApiResponse()` from `@/api-docs/openAPIResponseBuilders`. Request validation is done with `validateRequest(schema)` from `@/common/utils/httpHandlers`. The schema has the shape `{ params?, query?, body? }`.
- **Controller**: thin. Calls the service and replies with `res.status(serviceResponse.statusCode).send(serviceResponse)`. `validateRequest` only validates and does **not** write transformed values back to `req`, so controllers still parse params themselves (e.g. `Number.parseInt(req.params.id)`).
- **Service**: returns `ServiceResponse` in every case, success or failure, and never throws to the controller. It catches errors, logs them, and returns `ServiceResponse.failure(...)`. The service takes its repository through the constructor so tests can inject mocks.
- **Repository**: the only layer that talks to the database, through the shared Prisma client in `@/common/db/prisma`.

Wiring up a new feature takes **two** registrations:
1. Mount the router in `src/server.ts`.
2. Add its registry to the `OpenAPIRegistry([...])` list in `src/api-docs/openAPIDocumentGenerator.ts`. If you skip this step, the endpoint works but is missing from Swagger.

### Response envelope

Every JSON response uses `ServiceResponse` (`src/common/models/serviceResponse.ts`): `{ success, message, data, statusCode }`. Build one with `ServiceResponse.success(...)` or `ServiceResponse.failure(...)`, since the constructor is private. `ServiceResponseSchema(schema)` is the matching Zod wrapper used for OpenAPI response docs.

### Middleware order (`src/server.ts`)

json/urlencoded → CORS → helmet → rate limiter → request logger → feature routes → `openAPIRouter` (Swagger UI at `/`, raw spec at `/swagger.json`) → `errorHandler()` (404 fallback + error capture for pino-http).

Because Swagger UI is mounted at `/`, feature routes must be mounted before it.

### Config

`src/common/utils/envConfig.ts` validates `process.env` with Zod **at import time** and throws on invalid values. Add new env vars to both the schema and `.env.template`. `DATABASE_URL` is required and has no default. `NODE_ENV` defaults to `production` if unset. The `env` object also exposes `isDevelopment`, `isProduction`, and `isTest`. Non-production environments get debug-level `pino-pretty` logs and response-body capture.

The rate limiter's actual window is `15 * 60 * COMMON_RATE_LIMIT_WINDOW_MS`, so the default of `1000` works out to 15 minutes, not 1 second.

## Database conventions

Full details: `docs/database.md`.

- **Layout**: `prisma.config.ts` points Prisma at the whole `prisma/` folder, and every `.prisma` file under it merges into one schema. `prisma/schema.prisma` holds only the generator + datasource; each model gets its own file, `prisma/schema/<model>.prisma` (singular, e.g. `user.prisma`). Prisma requires all schema files under this one folder, with `migrations/` beside `schema.prisma`, so schema files can't live in feature folders.
- **Folder name is `schema/`, deliberately singular.** The files form one Prisma schema, and "schemas" would suggest PostgreSQL schemas (namespaces like `public`). It isn't `models/` because "model" in this codebase means the Zod/TS types in `src/api/<feature>/<feature>Model.ts`. Don't rename it.
- **Two sources of truth**: `prisma/schema/<model>.prisma` defines the tables; the Zod schemas in `<feature>Model.ts` define the API. Keep them in step when fields change. The repository's return type (the Zod type) catches Zod-only fields at compile time, but a column added only in Prisma is silently returned to clients, so keep sensitive columns out with `omit`/`select` in the repository.
- **Naming**: models PascalCase singular (`User` → `prisma.user`); tables snake_case plural via `@@map("users")`; fields camelCase, with every multi-word field mapped to snake_case via `@map("created_at")`; foreign keys `<relation>Id` + `@map("<relation>_id")` + `@@index`.
- **Standard fields on every model**: `id Int @id @default(autoincrement())`, `createdAt DateTime @default(now()) @map("created_at")`, `updatedAt DateTime @updatedAt @map("updated_at")`. `commonValidations.id` enforces positive integers ≤ 2,147,483,647 (Postgres `integer`).
- **Migrations**: named in short snake_case (`add_posts`). Never edit or delete a committed migration; add a new one. `migrate dev` (`db:migrate`) is local-only; everything else uses `migrate deploy` (`db:deploy`).
- **Client**: import `PrismaClient`/`Prisma` from `@/generated/prisma/client` (Prisma 7 path), never `@prisma/client`. Never instantiate another `PrismaClient`; use `@/common/db/prisma`.
- **Errors**: services map `Prisma.PrismaClientKnownRequestError` codes to statuses: `P2002` → 409, `P2003` → 400, `P2025` → 404.
- **Seeds** (`prisma/seed.ts`) must be re-runnable: `upsert` on a unique field.
- **Prisma config** uses `process.env.DATABASE_URL ?? ""` rather than `env()` on purpose, so `prisma generate` works in Docker/CI builds without a database.

## Style

Biome is configured with tabs, a 120-character line width, and the recommended lint rules. Tests go in a `__tests__/` folder next to the code they cover. Naming and API conventions: `docs/coding-standards.md`.
