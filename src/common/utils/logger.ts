import { createRequire } from "node:module";
import pino from "pino";

import { env } from "@/common/utils/envConfig";

// pino-pretty is a devDependency, so it is absent from the production image. Resolve it
// before use: setting NODE_ENV=development in a container would otherwise crash on startup.
const prettyTransport = () => {
	if (env.isProduction) return undefined;
	try {
		createRequire(import.meta.url).resolve("pino-pretty");
		return {
			target: "pino-pretty",
			// One readable line per entry. The request details are already in the message,
			// so the structured req/res fields are hidden here but kept in production JSON.
			options: {
				singleLine: true,
				translateTime: "SYS:HH:MM:ss.l",
				ignore: "pid,hostname,req,res,responseTime",
			},
		};
	} catch {
		return undefined;
	}
};

// The one logger for the whole app: pretty and debug-level locally, info-level JSON in production.
export const logger = pino({
	level: env.isProduction ? "info" : "debug",
	transport: prettyTransport(),
});
