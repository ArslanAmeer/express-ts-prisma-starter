# Coding standards

## Tooling

- **Biome** handles linting, formatting and import ordering (`biome.json`): tabs, 120-character lines, recommended rules.
- Run `pnpm check` before committing. It fixes what it can and reports the rest. CI runs the read-only `biome ci .` and fails on any issue.
- In VS Code, install the recommended **Biome** extension (`.vscode/extensions.json`). The workspace settings format and organize imports on save.
- **TypeScript** runs in `strict` mode. `pnpm build` type-checks with `tsc --noEmit` before bundling.

## Before you push

```bash
pnpm check   # lint + format
pnpm test    # needs pnpm db:up
pnpm build   # type-check + bundle
```

These are the same checks CI runs. See [Deployment → CI](deployment.md#ci).

## Commits and branches

Every commit message starts with a gitmoji followed by a capitalised label and a short, imperative summary:

| Prefix | Use it for |
| --- | --- |
| `✨ Add:` | A new feature, file or capability |
| `♻️ Update:` | Changing existing behaviour, refactoring, renaming |
| `🛠️ Fix:` | Fixing a bug |
| `🔥 Remove:` | Deleting code, files or dependencies |
| `⬆️ Upgrade:` | Dependency bumps and releases |
| `🧪 Test:` | Changes that are only tests |

```text
✨ Add: posts endpoint
🛠️ Fix: reject decimal ids before they reach the database
⬆️ Upgrade: Prisma to 7.11.0
```

Keep the summary under ~72 characters and put the reasoning in the commit body. One logical change per commit: tooling, database, application code and docs belong in separate commits.

`main` is protected — nobody, including the owner, pushes to it directly. The workflow is:

```bash
git checkout -b <short-branch-name>
# ...changes, then pnpm check && pnpm test && pnpm build
git push -u origin <short-branch-name>
gh pr create --fill
gh pr merge --squash      # once Code Quality, Build and Test pass
```

Merges are **squash only** (merge commits are disabled, and protection requires linear history), so each PR lands as one commit on `main` — give it a gitmoji message too. Merged branches are deleted automatically.

## Naming

| Thing | Convention | Example |
| --- | --- | --- |
| Feature folder | camelCase, singular | `src/api/user/`, `src/api/healthCheck/` |
| Feature files | `<feature><Layer>.ts` | `userRouter.ts`, `userService.ts`, `userRepository.ts` |
| Test files | `<file>.test.ts` in `__tests__/` | `__tests__/userRouter.test.ts` |
| Classes | PascalCase | `UserService`, `UserRepository` |
| Exported singletons | camelCase | `userService`, `userController`, `userRouter`, `userRegistry` |
| Zod schemas | PascalCase ending in `Schema` | `UserSchema`, `GetUserSchema`, `CreatePostSchema` |
| Types from Zod | Same name without `Schema` | `type User = z.infer<typeof UserSchema>` |
| Repository methods | Verb + `Async` | `findAllAsync`, `findByIdAsync`, `createAsync` |
| Env variables | UPPER_SNAKE_CASE | `DATABASE_URL`, `CORS_ORIGIN` |
| Prisma models, tables, columns | See [Database → Naming](database.md#naming-conventions) | `model User` → table `users` |

## TypeScript and imports

- The project is ESM (`"type": "module"`). Use `import`/`export`, never `require`.
- Import from `src` with the `@/` alias (`@/common/utils/envConfig`), not long relative paths. A sibling file in the same feature folder may use `./`.
- Use `import type { ... }` for type-only imports.
- Avoid `any`. Use the types Zod and Prisma generate for you.
- Don't edit anything in `src/generated/`. It's regenerated from the Prisma schema.

## API conventions

- **Every response** goes through `ServiceResponse` (`{ success, message, data, statusCode }`). See [Architecture → Response envelope](architecture.md#response-envelope).
- **Status codes** come from `StatusCodes` (`http-status-codes`), for example `StatusCodes.NOT_FOUND`, not raw numbers.
- **Validate every input** (`params`, `query`, `body`) with a Zod schema through `validateRequest(...)` in the router.
- **Document every route** with `registry.registerPath(...)`, and add the feature's registry to `openAPIDocumentGenerator.ts`.
- **Controllers stay thin**: call the service, send its response.
- **Services never throw**: catch errors, log them, and return `ServiceResponse.failure(...)` with a user-safe message. Map known database errors to proper codes ([Database → Handling database errors](database.md#handling-database-errors)).
- **Only repositories use Prisma.** Keep sensitive columns out of responses with `omit`/`select` in the repository.
- Resource paths are plural nouns: `/users`, `/users/:id`, `/posts`.

## Logging and config

- Log with the pino `logger` from `@/server`, not `console.log`. (Standalone scripts like `prisma/seed.ts` may use `console`.)
- Never log secrets, passwords or full request bodies in production.
- Read configuration from the validated `env` object (`@/common/utils/envConfig`), not `process.env`. New variables go into both the Zod schema and `.env.template`.

## Dependencies

- Versions are pinned exactly (no `^`), and **Renovate** opens update PRs. Minor and patch updates are grouped and auto-merge when CI passes. Prisma packages are grouped so they always share one version.
- Add runtime packages with `pnpm add -E <pkg>` and dev tools with `pnpm add -D -E <pkg>`.
- If a dependency needs to run an install script, allow it in `pnpm-workspace.yaml` under `allowBuilds` (Prisma's are allowed there). pnpm blocks every other install script and prints `Ignored build scripts: @scarf/scarf, esbuild` on each install. **That notice is expected and safe to ignore**: esbuild ships its binary as a platform package so its script is redundant, and `@scarf/scarf` (via `swagger-ui-dist`) is telemetry. pnpm 10.33 has no setting to hide the notice.
