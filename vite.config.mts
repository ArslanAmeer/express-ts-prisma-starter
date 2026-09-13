import { fileURLToPath } from "node:url";
import "dotenv/config";
import { configDefaults, defineConfig } from "vitest/config";

// Tests use their own database (created by docker-compose) so they never touch development data.
// The port follows POSTGRES_PORT from .env, so changing the port there is enough.
const postgresPort = process.env.POSTGRES_PORT ?? "5432";
const testDatabaseUrl =
	process.env.TEST_DATABASE_URL ?? `postgresql://postgres:postgres@localhost:${postgresPort}/app_test`;

export default defineConfig({
	resolve: {
		// Mirrors the "@/*" path in tsconfig.json
		alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
	},
	test: {
		env: { DATABASE_URL: testDatabaseUrl },
		globalSetup: ["./vitest.global-setup.ts"],
		exclude: [...configDefaults.exclude, "dist/**"],
		coverage: {
			exclude: ["**/node_modules/**", "**/index.ts", "vite.config.mts", "src/generated/**"],
		},
		globals: true,
		restoreMocks: true,
	},
});
