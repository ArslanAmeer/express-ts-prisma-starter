import { StatusCodes } from "http-status-codes";
import request from "supertest";

import { prisma } from "@/common/db/prisma";
import type { ServiceResponse } from "@/common/models/serviceResponse";
import { app } from "@/server";

describe("Health Check API endpoints", () => {
	afterAll(async () => {
		await prisma.$disconnect();
	});

	it("GET / - success", async () => {
		const response = await request(app).get("/health-check");
		const result: ServiceResponse = response.body;

		expect(response.statusCode).toEqual(StatusCodes.OK);
		expect(result.success).toBeTruthy();
		expect(result.data).toBeNull();
		expect(result.message).toEqual("Service is healthy");
	});

	it("GET / - service unavailable when the database is unreachable", async () => {
		vi.spyOn(prisma, "$queryRaw").mockRejectedValueOnce(new Error("connection refused"));

		const response = await request(app).get("/health-check");
		const result: ServiceResponse = response.body;

		expect(response.statusCode).toEqual(StatusCodes.SERVICE_UNAVAILABLE);
		expect(result.success).toBeFalsy();
		expect(result.data).toBeNull();
		expect(result.message).toEqual("Database is unreachable");
	});
});
