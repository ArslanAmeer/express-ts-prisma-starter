import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Request, type Response, type Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { prisma } from "@/common/db/prisma";
import { ServiceResponse } from "@/common/models/serviceResponse";

export const healthCheckRegistry = new OpenAPIRegistry();
export const healthCheckRouter: Router = express.Router();

healthCheckRegistry.registerPath({
	method: "get",
	path: "/health-check",
	tags: ["Health Check"],
	responses: {
		...createApiResponse(z.null(), "Success"),
		...createApiResponse(z.null(), "Database is unreachable", StatusCodes.SERVICE_UNAVAILABLE),
	},
});

healthCheckRouter.get("/", async (_req: Request, res: Response) => {
	try {
		await prisma.$queryRaw`SELECT 1`;
		const serviceResponse = ServiceResponse.success("Service is healthy", null);
		res.status(serviceResponse.statusCode).send(serviceResponse);
	} catch {
		const serviceResponse = ServiceResponse.failure("Database is unreachable", null, StatusCodes.SERVICE_UNAVAILABLE);
		res.status(serviceResponse.statusCode).send(serviceResponse);
	}
});
