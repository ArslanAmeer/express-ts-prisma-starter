import { execSync } from "node:child_process";
import type { TestProject } from "vitest/node";

// Brings the test database schema up to date before any test file runs
export default function setup(project: TestProject) {
	execSync("pnpm exec prisma migrate deploy", {
		stdio: "inherit",
		env: { ...process.env, DATABASE_URL: project.config.env.DATABASE_URL },
	});
}
