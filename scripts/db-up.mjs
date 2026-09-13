#!/usr/bin/env node
// Starts the local PostgreSQL container (docker-compose.yml).
// Checks that Docker is installed and running first, and tries to start Docker Desktop
// on macOS/Windows when it isn't. Run it with `pnpm db:up`.
import { spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import "dotenv/config";

const DAEMON_WAIT_SECONDS = 120;
// Matches the port docker-compose.yml publishes, so the message reports the real one
const POSTGRES_PORT = process.env.POSTGRES_PORT ?? "5432";

const run = (command, args, options = {}) => spawnSync(command, args, { encoding: "utf8", ...options });
const quiet = { stdio: "ignore" };

const dockerInstalled = () => run("docker", ["--version"], quiet).status === 0;
const dockerRunning = () => run("docker", ["info"], quiet).status === 0;

// Docker Compose v2 is a docker subcommand; fall back to the standalone v1 binary.
function composeCommand() {
	if (run("docker", ["compose", "version"], quiet).status === 0) return ["docker", ["compose"]];
	if (run("docker-compose", ["version"], quiet).status === 0) return ["docker-compose", []];
	return null;
}

function installHint() {
	if (process.platform === "linux") return "Install Docker Engine: https://docs.docker.com/engine/install/";
	return "Install Docker Desktop: https://www.docker.com/products/docker-desktop/";
}

function tryStartDocker() {
	if (process.platform === "darwin") {
		console.log("Docker is not running. Starting Docker Desktop...");
		return run("open", ["-a", "Docker"], quiet).status === 0;
	}
	if (process.platform === "win32") {
		console.log("Docker is not running. Starting Docker Desktop...");
		const exe = `${process.env.ProgramFiles ?? "C:\\Program Files"}\\Docker\\Docker\\Docker Desktop.exe`;
		return run("cmd", ["/c", "start", "", exe], quiet).status === 0;
	}
	console.error("Docker is installed but not running. Start it with: sudo systemctl start docker");
	return false;
}

async function waitForDocker() {
	process.stdout.write("Waiting for Docker to be ready");
	for (let elapsed = 0; elapsed < DAEMON_WAIT_SECONDS; elapsed += 2) {
		if (dockerRunning()) {
			process.stdout.write("\n");
			return true;
		}
		process.stdout.write(".");
		await sleep(2000);
	}
	process.stdout.write("\n");
	return false;
}

function fail(message) {
	console.error(`\n${message}`);
	process.exit(1);
}

if (!dockerInstalled()) {
	fail(`Docker is not installed (or not on your PATH).\n${installHint()}`);
}

if (!dockerRunning()) {
	tryStartDocker();
	if (!(await waitForDocker())) {
		fail(
			`Docker did not become ready within ${DAEMON_WAIT_SECONDS}s. Start Docker manually, then re-run 'pnpm db:up'.`,
		);
	}
}

const compose = composeCommand();
if (!compose) {
	fail(`Docker Compose is not available.\n${installHint()}`);
}

const [command, baseArgs] = compose;
console.log("Starting PostgreSQL...");
const result = run(command, [...baseArgs, "up", "-d", "--wait"], { stdio: "inherit" });

if (result.status !== 0) {
	fail("Could not start PostgreSQL. See the Docker output above.");
}

console.log(`\nPostgreSQL is ready on localhost:${POSTGRES_PORT} (databases: app, app_test).`);
console.log("Next: pnpm db:migrate && pnpm db:seed, then pnpm start:dev");
