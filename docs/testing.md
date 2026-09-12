# Testing

Tests use **Vitest** and **Supertest**. HTTP-level tests run against a real PostgreSQL test database, so start it first:

```bash
pnpm db:up
pnpm test
```

## Commands

| Command | What it does |
| --- | --- |
| `pnpm test` | Run all tests once |
| `pnpm vitest` | Watch mode: re-runs affected tests on save |
| `pnpm vitest run src/api/user/__tests__/userRouter.test.ts` | One file |
| `pnpm vitest run -t "should return a user for a valid ID"` | Tests whose name matches |
| `pnpm test:cov` | Coverage report in `coverage/` |

## How the test database works

- Tests connect to `app_test`, never to your development database `app`. The URL is set in `vite.config.mts`; override it with `TEST_DATABASE_URL`.
- Before any test runs, `vitest.global-setup.ts` applies all migrations to `app_test` with `prisma migrate deploy`.
- Each test file creates the data it needs. Don't rely on the seed script or on other test files.
- In CI, a PostgreSQL service container provides the same `app_test` database.

## Kinds of tests

| Kind | File | Database | Use it for |
| --- | --- | --- | --- |
| Router (integration) | `<feature>Router.test.ts` | Real `app_test` | HTTP behaviour end to end: status codes, validation, response shape, real queries |
| Service (unit) | `<feature>Service.test.ts` | None; the repository is mocked | Business logic and error branches that are hard to trigger for real |
| Common | `src/common/__tests__/` | None | Middleware and helpers |

### Router test pattern

```ts
import { prisma } from "@/common/db/prisma";
import { app } from "@/server";

let seededUsers: User[];

beforeAll(async () => {
	await prisma.user.deleteMany();
	await prisma.user.createMany({ data: [{ name: "Alice", email: "alice@example.com", age: 42 }] });
	seededUsers = await prisma.user.findMany({ orderBy: { id: "asc" } });
});

afterAll(async () => {
	await prisma.$disconnect();
});

it("should return a user for a valid ID", async () => {
	const response = await request(app).get(`/users/${seededUsers[0]?.id}`);
	expect(response.statusCode).toEqual(StatusCodes.OK);
});
```

- Clean up with `deleteMany()` in `beforeAll`, then create the rows you need.
- Read IDs back from the database. Don't hard-code `1`, because auto-increment IDs keep growing across runs.
- Use the largest valid ID (`2_147_483_647`) for "not found" cases.
- Any file that uses `prisma` directly calls `prisma.$disconnect()` in `afterAll`.

### Service test pattern

```ts
vi.mock("@/api/user/userRepository");

beforeEach(() => {
	userRepositoryInstance = new UserRepository();
	userServiceInstance = new UserService(userRepositoryInstance);
});

it("handles errors for findAllAsync", async () => {
	(userRepositoryInstance.findAllAsync as Mock).mockRejectedValue(new Error("Database error"));
	const result = await userServiceInstance.findAll();
	expect(result.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
});
```

To simulate a database failure in a router test, spy on the shared client. The spy is restored automatically after each test (`restoreMocks: true`):

```ts
vi.spyOn(prisma, "$queryRaw").mockRejectedValueOnce(new Error("connection refused"));
```

## Conventions

- Tests live in a `__tests__/` folder next to the code, named `<file>.test.ts`.
- Structure each test as **Arrange / Act / Assert**, with those comments when the test is longer than a few lines.
- Name tests by behaviour: `"should return a not found error for non-existent ID"`.
- `describe`, `it`, `expect`, `vi`, `beforeAll` and the rest are globals, so don't import them.
- Every endpoint needs router tests for the success case, validation failures (`400`) and not-found (`404`) where it applies.
- The `Error: failed with status code 500` lines in the output are expected logs from tests that deliberately trigger errors.
