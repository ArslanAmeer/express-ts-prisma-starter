// Inserts starter data. Runs via `pnpm db:seed` (and automatically after `prisma migrate reset`).
import { prisma } from "../src/common/db/prisma";

const users = [
	{ name: "Alice", email: "alice@example.com", age: 42 },
	{ name: "Robert", email: "robert@example.com", age: 21 },
];

async function main() {
	for (const user of users) {
		// upsert keeps the seed safe to run more than once
		await prisma.user.upsert({ where: { email: user.email }, update: {}, create: user });
	}
	console.log(`Seeded ${users.length} users`);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());
