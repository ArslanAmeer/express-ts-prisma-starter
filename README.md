# Express + TypeScript + Prisma + PostgreSQL Starter

A production-ready starting point for REST APIs built with **Express 5**, **TypeScript**, **PostgreSQL** and **Prisma**. It gives you a feature-based folder structure, validated config, typed database access, request validation with generated Swagger docs, and a test suite that runs against a real database.

> **Dependencies are up to date as of 12 September 2026.** Every package sits on its current stable release, pinned to an exact version, and [Renovate](.github/renovate.json) opens update PRs automatically.

## Tech stack

| Area | Tools | Version |
| --- | --- | --- |
| Runtime | Node.js LTS, ESM (`"type": "module"`) | 24.21.0 |
| Package manager | pnpm | 10.33.0 |
| Web framework | Express, Helmet, CORS, express-rate-limit | 5.2.1 |
| Database | PostgreSQL (Docker Compose) | 18.6 |
| ORM | Prisma (schema, migrations, typed client, Studio GUI) | 7.10.0 |
| Validation & API docs | Zod, zod-to-openapi, Swagger UI | 4.6.2 |
| Logging | pino, pino-http (pretty output in development) | 10.3.1 |
| Testing | Vitest, Supertest, V8 coverage | 5.0.0 |
| Language & build | TypeScript, tsx (dev server), tsdown (bundler) | 7.0.2 / 0.23.0 |
| Lint & format | Biome | 2.5.13 |
| Delivery | Multi-stage Dockerfile, GitHub Actions CI, Renovate | — |

Prisma stays on the 7.x stable line on purpose: npm's `latest` tag currently points at an 8.0 release candidate.

## Make it yours

These are the tools I reach for: current, fast and actively maintained — pnpm over npm, Biome over ESLint plus Prettier, Vitest over Jest, tsdown over tsup, Prisma for typed database access without hand-written SQL. That's what fits the way I build, not a prescription.

Treat this as a starting point, not a rulebook. Swap the ORM, replace Biome, drop the Docker setup, rename folders, delete the sample `users` module — whatever suits your project. The only convention worth keeping is the layering (**router → controller → service → repository**, with Zod validating the edges), because the guides in [`docs/`](#documentation) describe it; change that and the docs are yours to update too.

Starting a project from here? A few things still carry my details:

1. **`package.json`** — `name`, `description`, `author`, `repository`
2. **`LICENSE`** — the copyright line
3. **This README** — the clone URL above, and this section
4. **`prisma/seed.ts` and `src/api/user/`** — sample data and a sample feature. Keep them as a working reference while you build, then delete them

## Prerequisites

- **Node.js 24.21.0** and **pnpm 10.33.0**. Both are pinned in [`.tool-versions`](.tool-versions), so a version manager like [mise](https://mise.jdx.dev/) or [asdf](https://asdf-vm.com/) picks them up automatically
- **Docker Desktop**, which runs PostgreSQL locally. `pnpm db:up` checks whether Docker is running and starts Docker Desktop for you (macOS and Windows) if it isn't

## Quick start

```bash
git clone https://github.com/ArslanAmeer/express-ts-prisma-starter.git my-api && cd my-api  # or your own repo, if you used "Use this template"
pnpm install                 # also generates the Prisma client
cp .env.template .env        # local settings; the defaults work with Docker Compose
pnpm db:up                   # start PostgreSQL 18 in Docker
pnpm db:migrate              # create the tables
pnpm db:seed                 # add starter data
pnpm start:dev               # http://localhost:8080
```

Open **http://localhost:8080** for Swagger UI. Try `GET /health-check` and `GET /users`.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm start:dev` | Run the API with auto-reload |
| `pnpm build` | Generate the Prisma client, type-check, and bundle to `dist/` |
| `pnpm start:prod` | Run the built app (`dist/index.js`) |
| `pnpm test` / `pnpm test:cov` | Run the tests, optionally with coverage (needs `pnpm db:up`) |
| `pnpm check` | Lint, format and organize imports with Biome (writes fixes) |
| `pnpm db:up` / `pnpm db:down` | Start / stop the local PostgreSQL container |
| `pnpm db:migrate --name <change>` | Create and apply a migration after editing a model |
| `pnpm db:deploy` | Apply existing migrations without creating new ones (CI, production) |
| `pnpm db:seed` | Insert starter data |
| `pnpm db:reset` | Drop the database, re-apply all migrations and re-seed |
| `pnpm db:studio` | Browse and edit data in the browser |

## Project structure

```text
.
├── .github/                 # CI workflow, shared setup action, Renovate config
├── docker/postgres/init/    # SQL run on the database's first start (creates app_test)
├── docs/                    # Development standards and guides
├── prisma/
│   ├── schema.prisma        # Generator + database connection only
│   ├── schema/              # One file per model (user.prisma, ...)
│   ├── migrations/          # Generated SQL migrations (commit these)
│   └── seed.ts              # Starter data
├── src/
│   ├── api/                 # Feature modules: router → controller → service → repository
│   │   ├── healthCheck/
│   │   └── user/
│   ├── api-docs/            # OpenAPI document + Swagger UI
│   ├── common/
│   │   ├── db/prisma.ts     # Shared Prisma client
│   │   ├── middleware/      # Error handler, rate limiter, request logger
│   │   ├── models/          # ServiceResponse envelope
│   │   └── utils/           # Env config, validation helpers
│   ├── generated/prisma/    # Generated Prisma client (gitignored)
│   ├── index.ts             # Entry point: starts the server, graceful shutdown
│   └── server.ts            # Express app and middleware
├── docker-compose.yml       # Local PostgreSQL
├── Dockerfile               # Production image
├── prisma.config.ts         # Prisma CLI config
└── vite.config.mts          # Vitest config
```

## Documentation

| Guide | Read it when you... |
| --- | --- |
| [Architecture](docs/architecture.md) | want to understand how a request flows through the app |
| [Database](docs/database.md) | work with Prisma, migrations, or PostgreSQL (includes a Mongoose → Prisma cheat sheet) |
| [Adding a feature](docs/adding-a-feature.md) | build a new resource end to end (worked example: posts) |
| [Testing](docs/testing.md) | write or run tests |
| [Coding standards](docs/coding-standards.md) | want the naming, style and API conventions |
| [Deployment](docs/deployment.md) | build the Docker image, run CI, or deploy |

## Credits and license

Originally based on [edwinhern/express-typescript](https://github.com/edwinhern/express-typescript). Released under the [MIT License](LICENSE).
