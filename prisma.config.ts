import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
	// A folder, so Prisma merges prisma/schema.prisma with every model file in prisma/schema/
	schema: "prisma",
	migrations: {
		path: "prisma/migrations",
		seed: "tsx prisma/seed.ts",
	},
	datasource: {
		// Not using `env("DATABASE_URL")`: it throws when unset, which would break `prisma generate`
		// in Docker/CI builds that have no database. Commands that do connect still fail clearly.
		url: process.env.DATABASE_URL ?? "",
	},
});
