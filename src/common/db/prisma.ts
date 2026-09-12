import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "@/common/utils/envConfig";
import { PrismaClient } from "@/generated/prisma/client";

// Single shared client for the whole app. It opens connections lazily, on the first query.
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });
