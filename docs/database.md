# Database

PostgreSQL 18 runs locally in Docker Compose. The app talks to it through **Prisma 7**: you describe tables in `.prisma` files, Prisma generates the SQL migrations and a fully typed client, and you query with methods like `prisma.user.findMany()` instead of writing SQL.

## Local database

| | |
| --- | --- |
| Start / stop | `pnpm db:up` / `pnpm db:down` (your data is kept in a Docker volume) |
| Connection | `postgresql://postgres:postgres@localhost:5432/app` (from `.env`) |
| Port | `POSTGRES_PORT` in `.env` (default `5432`). Change it if that port is taken, and keep the port inside `DATABASE_URL` the same; tests follow `POSTGRES_PORT` automatically |
| Databases | `app` for development, `app_test` for the test suite |
| Browse data | `pnpm db:studio` |

`app_test` is created by `docker/postgres/init/01-create-test-database.sql`. Docker only runs that script the **first time** the data volume is created.

## Coming from MongoDB / Mongoose

| Task | Mongoose | Prisma |
| --- | --- | --- |
| Define a model | `new Schema({...})` + `model("User", schema)` | `model User { ... }` in `prisma/schema/user.prisma` |
| Change the shape of data | Just change the schema | Edit the model, then run `pnpm db:migrate --name <change>` |
| Find many | `User.find({ age: { $gte: 18 } })` | `prisma.user.findMany({ where: { age: { gte: 18 } } })` |
| Find one | `User.findById(id)` | `prisma.user.findUnique({ where: { id } })` |
| Create | `User.create({...})` | `prisma.user.create({ data: {...} })` |
| Update | `User.findByIdAndUpdate(id, {...})` | `prisma.user.update({ where: { id }, data: {...} })` |
| Delete | `User.findByIdAndDelete(id)` | `prisma.user.delete({ where: { id } })` |
| Populate relations | `.populate("posts")` | `include: { posts: true }` |
| Pick fields | `.select("name email")` | `select: { name: true, email: true }` |
| Hide fields | `.select("-passwordHash")` | `omit: { passwordHash: true }` |
| IDs | `ObjectId` strings | Whole numbers (`1`, `2`, ...) in this project |
| GUI | Compass | Prisma Studio (`pnpm db:studio`) |

The one genuinely new concept is **migrations**. PostgreSQL enforces the table structure, so every schema change is recorded as a SQL migration file that Prisma writes for you. Those files are applied, in order, to every database: your laptop, the test database, CI, and production.

## Layout

```text
prisma/
├── schema.prisma      # generator + datasource only
├── schema/
│   └── user.prisma    # one file per model
├── migrations/        # generated SQL, one folder per change
└── seed.ts            # starter data
```

- `prisma.config.ts` points Prisma at the whole `prisma/` folder, and Prisma merges every `.prisma` file inside it into **one** schema. Models in different files can reference each other.
- The folder is `schema/`, singular, on purpose: all the files together form one Prisma schema. Also, in PostgreSQL a "schema" is a namespace inside a database (your tables live in `public`), so `schemas/` would suggest something else.
- It isn't called `models/` because "model" in this codebase means the Zod/TypeScript types in `src/api/<feature>/<feature>Model.ts`.
- Prisma requires every `.prisma` file to live under this one folder, with `migrations/` next to `schema.prisma`. Schema files can't live in feature folders.

## Naming conventions

| Thing | Convention | Example |
| --- | --- | --- |
| Model file | Singular model name, lowercase | `prisma/schema/user.prisma`, `blogPost.prisma` |
| Model | PascalCase, singular | `model User` → `prisma.user` |
| Table | snake_case, plural, via `@@map` | `@@map("users")` |
| Field | camelCase | `createdAt` |
| Column | snake_case, via `@map` on every multi-word field | `createdAt DateTime @map("created_at")` |
| Foreign key field | `<relation>Id` | `authorId Int @map("author_id")` |
| Migration name | Short snake_case description | `add_posts`, `add_user_phone` |

## Standard fields

Every model starts with these:

```prisma
id        Int      @id @default(autoincrement())
createdAt DateTime @default(now()) @map("created_at")
updatedAt DateTime @updatedAt @map("updated_at")
```

- `id` is an auto-incrementing whole number, which matches the API's ID validation (`commonValidations.id`).
- `createdAt` is set by the database. Prisma sets `updatedAt` automatically on every update.
- Add `@@index([field])` for columns you often filter or join on, especially foreign keys.

## Changing the schema

1. Edit or add a model in `prisma/schema/<model>.prisma`.
2. Run `pnpm db:migrate --name <change>`. Prisma writes the SQL into `prisma/migrations/<timestamp>_<change>/`, applies it to your local database, and regenerates the client.
3. Read the generated `migration.sql` to confirm it does what you expect.
4. Update the matching Zod schema in `src/api/<feature>/<feature>Model.ts` if the API shape changed.
5. Commit the model file **and** the new migration folder together.

Rules:

- **Never edit or delete a migration that has been committed or applied.** To change something, make a new migration.
- `pnpm db:migrate` (`prisma migrate dev`) is for your machine only. It can create migrations and may offer to reset the database.
- CI, the test suite and production use `pnpm db:deploy` (`prisma migrate deploy`), which only applies existing migrations.
- After pulling someone else's schema changes, run `pnpm db:migrate`. It applies their migrations and regenerates the client.
- Renaming a field or table can make Prisma generate a drop-and-recreate, which loses data. Check the SQL and edit the migration **before** applying it if needed (`pnpm db:migrate --create-only --name <change>` creates it without applying).

## Querying

All database access goes through the shared client in `src/common/db/prisma.ts`, and **only repositories import it**. Never create another `new PrismaClient()`: every instance opens its own connection pool.

```ts
// Filter, sort, paginate
await prisma.user.findMany({
	where: { age: { gte: 18 }, email: { endsWith: "@example.com" } },
	orderBy: { createdAt: "desc" },
	skip: 20,
	take: 10,
});

// Relations (like populate)
await prisma.user.findUnique({ where: { id }, include: { posts: true } });

// Several writes that must all succeed or all fail
await prisma.$transaction([
	prisma.post.deleteMany({ where: { authorId: id } }),
	prisma.user.delete({ where: { id } }),
]);
```

### Keep sensitive fields out of responses

Repositories return whole rows by default, and services send them straight to the client. If a model has a field the API must never expose (a password hash or internal token), exclude it in the repository:

```ts
prisma.user.findUnique({ where: { id }, omit: { passwordHash: true } });
```

### Handling database errors

Prisma throws `Prisma.PrismaClientKnownRequestError` with a `code` for expected database failures. Catch the ones your feature can cause in the service and return a meaningful status instead of `500`:

| Code | Meaning | Typical response |
| --- | --- | --- |
| `P2002` | Unique constraint failed (for example a duplicate email) | `409 Conflict` |
| `P2003` | Foreign key constraint failed (the related record doesn't exist) | `400 Bad Request` |
| `P2025` | Record to update or delete was not found | `404 Not Found` |

```ts
import { Prisma } from "@/generated/prisma/client";

if (ex instanceof Prisma.PrismaClientKnownRequestError && ex.code === "P2002") {
	return ServiceResponse.failure("Email already in use", null, StatusCodes.CONFLICT);
}
```

## Seeding

`prisma/seed.ts` inserts starter data (`pnpm db:seed`). Keep it safe to run repeatedly by using `upsert` keyed on a unique field:

```ts
await prisma.user.upsert({ where: { email: user.email }, update: {}, create: user });
```

## Test database

The test suite never touches your development data:

- `vite.config.mts` points tests at `app_test`. Override it with the `TEST_DATABASE_URL` environment variable.
- `vitest.global-setup.ts` runs `prisma migrate deploy` against it before any test runs.
- Router tests clear and seed the tables they need. See [Testing](testing.md).

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `Invalid environment variables ... DATABASE_URL` | Copy `.env.template` to `.env` |
| `Can't reach database server at localhost:5432` | Start Docker Desktop, then `pnpm db:up` |
| `pnpm db:up` fails with `Bind for 0.0.0.0:5432 failed: port is already allocated` | Another PostgreSQL already owns that port — a Homebrew install, Postgres.app, or another project's containers. Either stop it (`brew services stop postgresql@18`, quit Postgres.app, or `docker compose down` in the other project), or set `POSTGRES_PORT=5433` in `.env` and change the port inside `DATABASE_URL` to match |
| Tests fail with `database "app_test" does not exist` | The volume was created before the init script existed. Run `docker compose down -v && pnpm db:up`. **This deletes all local data.** Then re-run `pnpm db:migrate` and `pnpm db:seed` |
| TypeScript can't find `@/generated/prisma/client`, or the types are outdated | `pnpm exec prisma generate` |
| `pnpm db:migrate` reports drift and wants to reset | Someone changed the database outside of migrations. Locally it's safe to accept. Never do this against shared databases |
| Start completely fresh | `pnpm db:reset`: drops the database, re-applies all migrations and re-seeds |

## Switching databases later

Only `prisma/schema/`, `src/common/db/prisma.ts` and the repositories know about the database. Routes, controllers and services don't.

- **Another SQL database** (MySQL, SQL Server, SQLite): change `provider` in `schema.prisma`, swap `@prisma/adapter-pg` for that database's adapter, and recreate the migrations, since migration SQL is database-specific. Queries stay the same.
- **MongoDB**: Prisma 7 does not support MongoDB yet. Beyond that, IDs would become ObjectId strings, which changes validation and routes. Treat it as a significant change.
