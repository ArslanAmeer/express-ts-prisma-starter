import { StatusCodes } from "http-status-codes";
import request from "supertest";

import type { User } from "@/api/user/userModel";
import { prisma } from "@/common/db/prisma";
import type { ServiceResponse } from "@/common/models/serviceResponse";
import { app } from "@/server";

// These tests run against the real test database (see vite.config.mts)
let seededUsers: User[];

beforeAll(async () => {
	await prisma.user.deleteMany();
	await prisma.user.createMany({
		data: [
			{ name: "Alice", email: "alice@example.com", age: 42 },
			{ name: "Robert", email: "robert@example.com", age: 21 },
		],
	});
	seededUsers = await prisma.user.findMany({ orderBy: { id: "asc" } });
});

afterAll(async () => {
	await prisma.$disconnect();
});

describe("User API Endpoints", () => {
	describe("GET /users", () => {
		it("should return a list of users", async () => {
			// Act
			const response = await request(app).get("/users");
			const responseBody: ServiceResponse<User[]> = response.body;

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.OK);
			expect(responseBody.success).toBeTruthy();
			expect(responseBody.message).toContain("Users found");
			expect(responseBody.data.length).toEqual(seededUsers.length);
			responseBody.data.forEach((user, index) => {
				compareUsers(seededUsers[index] as User, user);
			});
		});
	});

	describe("GET /users/:id", () => {
		it("should return a user for a valid ID", async () => {
			// Arrange
			const expectedUser = seededUsers[0] as User;

			// Act
			const response = await request(app).get(`/users/${expectedUser.id}`);
			const responseBody: ServiceResponse<User> = response.body;

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.OK);
			expect(responseBody.success).toBeTruthy();
			expect(responseBody.message).toContain("User found");
			compareUsers(expectedUser, responseBody.data);
		});

		it("should return a not found error for non-existent ID", async () => {
			// Arrange: the largest valid ID, which the test data never reaches
			const testId = 2_147_483_647;

			// Act
			const response = await request(app).get(`/users/${testId}`);
			const responseBody: ServiceResponse = response.body;

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
			expect(responseBody.success).toBeFalsy();
			expect(responseBody.message).toContain("User not found");
			expect(responseBody.data).toBeNull();
		});

		it.each([
			["non-numeric", "abc"],
			["decimal", "1.5"],
			["out of range", String(Number.MAX_SAFE_INTEGER)],
		])("should return a bad request for a %s ID", async (_label, invalidInput) => {
			// Act
			const response = await request(app).get(`/users/${invalidInput}`);
			const responseBody: ServiceResponse = response.body;

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
			expect(responseBody.success).toBeFalsy();
			expect(responseBody.message).toContain("Invalid input");
			expect(responseBody.data).toBeNull();
		});
	});
});

function compareUsers(mockUser: User, responseUser: User) {
	if (!mockUser || !responseUser) {
		throw new Error("Invalid test data: mockUser or responseUser is undefined");
	}

	expect(responseUser.id).toEqual(mockUser.id);
	expect(responseUser.name).toEqual(mockUser.name);
	expect(responseUser.email).toEqual(mockUser.email);
	expect(responseUser.age).toEqual(mockUser.age);
	expect(new Date(responseUser.createdAt)).toEqual(mockUser.createdAt);
	expect(new Date(responseUser.updatedAt)).toEqual(mockUser.updatedAt);
}
