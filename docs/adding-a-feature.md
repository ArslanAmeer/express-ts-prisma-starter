# Adding a feature

This guide adds a `posts` resource, where each post belongs to a user. Follow the same steps for any new resource. `src/api/user/` is the reference implementation to compare against.

**Checklist**

1. Model file in `prisma/schema/` → migration
2. `src/api/post/`: model (Zod), repository, service, controller, router
3. Mount the router in `src/server.ts`
4. Register the OpenAPI registry in `src/api-docs/openAPIDocumentGenerator.ts`
5. Tests
6. `pnpm check && pnpm test && pnpm build`

## 1. Database model

Create `prisma/schema/post.prisma`:

```prisma
model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  authorId  Int      @map("author_id")
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([authorId])
  @@map("posts")
}
```

Add the other side of the relation to `prisma/schema/user.prisma`:

```prisma
model User {
  // ...existing fields
  posts     Post[]
}
```

Then create and apply the migration:

```bash
pnpm db:migrate --name add_posts
```

Check the generated `prisma/migrations/<timestamp>_add_posts/migration.sql`, and commit it together with the model files.

## 2. Zod model: `src/api/post/postModel.ts`

This defines the API shape, which is separate from the database model. See [Database → Layout](database.md#layout).

```ts
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import { commonValidations } from "@/common/utils/commonValidation";

extendZodWithOpenApi(z);

export type Post = z.infer<typeof PostSchema>;
export const PostSchema = z.object({
	id: z.number(),
	title: z.string(),
	content: z.string().nullable(),
	authorId: z.number(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

// Input validation for 'GET /posts/:id'
export const GetPostSchema = z.object({
	params: z.object({ id: commonValidations.id }),
});

// Input validation for 'POST /posts'
export type CreatePostInput = z.infer<typeof CreatePostSchema>["body"];
export const CreatePostSchema = z.object({
	body: z.object({
		title: z.string().min(1).max(200),
		content: z.string().optional(),
		authorId: z.number().int().positive(),
	}),
});
```

## 3. Repository: `src/api/post/postRepository.ts`

The only file in the feature that touches the database:

```ts
import type { CreatePostInput, Post } from "@/api/post/postModel";
import { prisma } from "@/common/db/prisma";

export class PostRepository {
	async findAllAsync(): Promise<Post[]> {
		return prisma.post.findMany({ orderBy: { id: "asc" } });
	}

	async findByIdAsync(id: number): Promise<Post | null> {
		return prisma.post.findUnique({ where: { id } });
	}

	async createAsync(data: CreatePostInput): Promise<Post> {
		return prisma.post.create({ data });
	}
}
```

## 4. Service: `src/api/post/postService.ts`

Returns a `ServiceResponse` for every outcome, and turns known database errors into proper status codes:

```ts
import { StatusCodes } from "http-status-codes";

import type { CreatePostInput, Post } from "@/api/post/postModel";
import { PostRepository } from "@/api/post/postRepository";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { Prisma } from "@/generated/prisma/client";
import { logger } from "@/server";

export class PostService {
	private postRepository: PostRepository;

	constructor(repository: PostRepository = new PostRepository()) {
		this.postRepository = repository;
	}

	async findById(id: number): Promise<ServiceResponse<Post | null>> {
		try {
			const post = await this.postRepository.findByIdAsync(id);
			if (!post) {
				return ServiceResponse.failure("Post not found", null, StatusCodes.NOT_FOUND);
			}
			return ServiceResponse.success<Post>("Post found", post);
		} catch (ex) {
			logger.error(`Error finding post with id ${id}: ${(ex as Error).message}`);
			return ServiceResponse.failure("An error occurred while finding post.", null, StatusCodes.INTERNAL_SERVER_ERROR);
		}
	}

	async create(input: CreatePostInput): Promise<ServiceResponse<Post | null>> {
		try {
			const post = await this.postRepository.createAsync(input);
			return ServiceResponse.success<Post>("Post created", post, StatusCodes.CREATED);
		} catch (ex) {
			// P2003 = foreign key failed: the author doesn't exist
			if (ex instanceof Prisma.PrismaClientKnownRequestError && ex.code === "P2003") {
				return ServiceResponse.failure("Author not found", null, StatusCodes.BAD_REQUEST);
			}
			logger.error(`Error creating post: ${(ex as Error).message}`);
			return ServiceResponse.failure("An error occurred while creating post.", null, StatusCodes.INTERNAL_SERVER_ERROR);
		}
	}
}

export const postService = new PostService();
```

## 5. Controller: `src/api/post/postController.ts`

```ts
import type { Request, RequestHandler, Response } from "express";

import { postService } from "@/api/post/postService";

class PostController {
	public getPost: RequestHandler = async (req: Request, res: Response) => {
		const id = Number.parseInt(req.params.id as string, 10);
		const serviceResponse = await postService.findById(id);
		res.status(serviceResponse.statusCode).send(serviceResponse);
	};

	public createPost: RequestHandler = async (req: Request, res: Response) => {
		const serviceResponse = await postService.create(req.body);
		res.status(serviceResponse.statusCode).send(serviceResponse);
	};
}

export const postController = new PostController();
```

## 6. Router: `src/api/post/postRouter.ts`

Every route gets an OpenAPI registration and request validation:

```ts
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Router } from "express";
import { StatusCodes } from "http-status-codes";

import { CreatePostSchema, GetPostSchema, PostSchema } from "@/api/post/postModel";
import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { validateRequest } from "@/common/utils/httpHandlers";
import { postController } from "./postController";

export const postRegistry = new OpenAPIRegistry();
export const postRouter: Router = express.Router();

postRegistry.register("Post", PostSchema);

postRegistry.registerPath({
	method: "get",
	path: "/posts/{id}",
	tags: ["Post"],
	request: { params: GetPostSchema.shape.params },
	responses: createApiResponse(PostSchema, "Success"),
});

postRouter.get("/:id", validateRequest(GetPostSchema), postController.getPost);

postRegistry.registerPath({
	method: "post",
	path: "/posts",
	tags: ["Post"],
	request: { body: { content: { "application/json": { schema: CreatePostSchema.shape.body } } } },
	responses: createApiResponse(PostSchema, "Created", StatusCodes.CREATED),
});

postRouter.post("/", validateRequest(CreatePostSchema), postController.createPost);
```

## 7. Wire it into the app

In `src/server.ts`, mount the router next to the others, **before** the Swagger router:

```ts
import { postRouter } from "@/api/post/postRouter";

app.use("/posts", postRouter);
```

In `src/api-docs/openAPIDocumentGenerator.ts`, add the registry. If you skip this, the endpoint works but is missing from Swagger:

```ts
import { postRegistry } from "@/api/post/postRouter";

const registry = new OpenAPIRegistry([healthCheckRegistry, userRegistry, postRegistry]);
```

## 8. Tests

Add `src/api/post/__tests__/postRouter.test.ts` (real database) and `postService.test.ts` (mocked repository). Follow the user tests and [Testing](testing.md). Because posts need an author, seed a user first:

```ts
beforeAll(async () => {
	await prisma.post.deleteMany();
	const author = await prisma.user.upsert({
		where: { email: "author@example.com" },
		update: {},
		create: { name: "Author", email: "author@example.com", age: 30 },
	});
	authorId = author.id;
});
```

## 9. Verify

```bash
pnpm check    # lint + format
pnpm test     # needs pnpm db:up
pnpm build
```

Then open http://localhost:8080/docs and try the new endpoints in Swagger UI.
