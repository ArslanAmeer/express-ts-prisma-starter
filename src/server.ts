import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { pino } from "pino";
import { healthCheckRouter } from "@/api/healthCheck/healthCheckRouter";
import { userRouter } from "@/api/user/userRouter";
import { openAPIRouter } from "@/api-docs/openAPIRouter";
import errorHandler from "@/common/middleware/errorHandler";
import rateLimiter from "@/common/middleware/rateLimiter";
import requestLogger from "@/common/middleware/requestLogger";
import { DEFAULT_CORS_ORIGIN, env } from "@/common/utils/envConfig";

const logger = pino({ name: "server start" });

// Deploying without setting CORS_ORIGIN silently blocks the real frontend, so say so loudly.
// Logged through pino rather than console so production output stays parseable JSON.
if (env.isProduction && env.CORS_ORIGIN === DEFAULT_CORS_ORIGIN) {
	logger.warn(`CORS_ORIGIN is still ${DEFAULT_CORS_ORIGIN} in production; browser requests will be blocked`);
}
const app: Express = express();

// Set the application to trust the reverse proxy
// Number of reverse proxies in front of the app, so req.ip is the real client IP.
// `true` would trust any X-Forwarded-For header, letting anyone spoof their IP past the
// rate limiter. Raise this if you add another proxy layer (CDN in front of a load balancer).
app.set("trust proxy", 1);

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(helmet());
app.use(rateLimiter);

// Request logging
app.use(requestLogger);

// Routes
app.use("/health-check", healthCheckRouter);
app.use("/users", userRouter);

// Swagger UI
app.use(openAPIRouter);

// Error handlers
app.use(errorHandler());

export { app, logger };
