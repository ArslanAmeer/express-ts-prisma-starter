import express, { type Request, type Response, type Router } from "express";
import swaggerUi from "swagger-ui-express";

import { generateOpenAPIDocument } from "@/api-docs/openAPIDocumentGenerator";

export const openAPIRouter: Router = express.Router();
const openAPIDocument = generateOpenAPIDocument();

openAPIRouter.get("/swagger.json", (_req: Request, res: Response) => {
	res.setHeader("Content-Type", "application/json");
	res.send(openAPIDocument);
});

// Swagger UI lives under /docs. Mounting it at "/" made it answer every unknown GET with
// the UI page and a 200, so the 404 handler never ran.
openAPIRouter.use("/docs", swaggerUi.serve, swaggerUi.setup(openAPIDocument));

// Only the exact root redirects, anything else unmatched falls through to the 404 handler
openAPIRouter.get("/", (_req: Request, res: Response) => res.redirect("/docs"));
