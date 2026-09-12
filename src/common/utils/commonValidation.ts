import { z } from "zod";

// Largest value a PostgreSQL `integer` column (Prisma `Int`) can hold
const MAX_INT32 = 2_147_483_647;

export const commonValidations = {
	id: z.coerce
		.number({ error: "ID must be a numeric value" })
		.int("ID must be an integer")
		.positive("ID must be a positive number")
		.max(MAX_INT32, "ID is out of range"),
	// ... other common validations
};
