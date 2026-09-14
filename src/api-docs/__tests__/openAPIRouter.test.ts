import { StatusCodes } from "http-status-codes";
import request from "supertest";

import { app } from "@/server";

import { generateOpenAPIDocument } from "../openAPIDocumentGenerator";

describe("OpenAPI Router", () => {
	describe("Swagger JSON route", () => {
		it("should return Swagger JSON content", async () => {
			// Arrange
			const expectedResponse = generateOpenAPIDocument();

			// Act
			const response = await request(app).get("/swagger.json");

			// Assert
			expect(response.status).toBe(StatusCodes.OK);
			expect(response.type).toBe("application/json");
			expect(response.body).toEqual(expectedResponse);
		});

		it("should serve the Swagger UI at /docs", async () => {
			// Act
			const response = await request(app).get("/docs/");

			// Assert
			expect(response.status).toBe(StatusCodes.OK);
			expect(response.text).toContain("swagger-ui");
		});

		it("should redirect the root to /docs", async () => {
			// Act
			const response = await request(app).get("/");

			// Assert
			expect(response.status).toBe(StatusCodes.MOVED_TEMPORARILY);
			expect(response.headers.location).toBe("/docs");
		});

		it("should not swallow unknown routes", async () => {
			// Act
			const response = await request(app).get("/this-route-does-not-exist");

			// Assert
			expect(response.status).toBe(StatusCodes.NOT_FOUND);
		});
	});
});
