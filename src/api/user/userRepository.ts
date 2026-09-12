import type { User } from "@/api/user/userModel";
import { prisma } from "@/common/db/prisma";

export class UserRepository {
	async findAllAsync(): Promise<User[]> {
		return prisma.user.findMany({ orderBy: { id: "asc" } });
	}

	async findByIdAsync(id: number): Promise<User | null> {
		return prisma.user.findUnique({ where: { id } });
	}
}
