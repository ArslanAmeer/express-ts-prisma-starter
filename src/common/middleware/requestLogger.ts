import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import pinoHttp from "pino-http";

import { logger } from "@/common/utils/logger";

// Requests that would drown out real traffic: the Docker HEALTHCHECK polls every 30s,
// and opening Swagger UI at /docs pulls several static assets. They are still logged when they fail.
const isNoise = (url: string) => /^\/(health-check|docs|favicon)(\/|\?|\.|$)/.test(url);

// Express rewrites req.url inside mounted routers, so use the original URL for logs
const urlOf = (req: IncomingMessage) => (req as Request).originalUrl ?? req.url;

export const getLogLevel = (req: IncomingMessage, res: ServerResponse, err?: Error) => {
	if (err || res.statusCode >= StatusCodes.INTERNAL_SERVER_ERROR) return "error";
	if (res.statusCode >= StatusCodes.BAD_REQUEST) return "warn";
	if (isNoise(urlOf(req))) return "silent";
	return "info";
};

const addRequestId = (req: Request, res: Response, next: NextFunction) => {
	const existingId = req.headers["x-request-id"] as string;
	const requestId = existingId || randomUUID();

	// Set for downstream use
	req.headers["x-request-id"] = requestId;
	res.setHeader("X-Request-Id", requestId);

	next();
};

const httpLogger = pinoHttp({
	logger,
	genReqId: (req) => req.headers["x-request-id"] as string,
	customLogLevel: getLogLevel,
	customSuccessMessage: (req, res, responseTime) =>
		`${req.method} ${urlOf(req)} ${res.statusCode} ${Math.round(responseTime)}ms`,
	customErrorMessage: (req, res, err) => `${req.method} ${urlOf(req)} ${res.statusCode} ${err.message}`,
	// Keep request logs small: pino-http's defaults include every request and response header
	serializers: {
		req: (req) => ({ id: req.id, method: req.method, url: req.url }),
		res: (res) => ({ statusCode: res.statusCode }),
	},
});

export default [addRequestId, httpLogger];
