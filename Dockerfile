# Base stage with pnpm setup
FROM node:24.21.0-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Corepack is no longer bundled with Node 25+, so install it explicitly
RUN npm install -g corepack@latest && corepack enable
WORKDIR /app

# Production dependencies stage
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Install only production dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile --ignore-scripts

# Build stage - install all dependencies and build
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Install all dependencies (including dev dependencies)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --ignore-scripts
COPY . .
RUN pnpm run build

# Final stage - combine production dependencies and build output
FROM node:24.21.0-alpine AS runner
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
# package.json's "type": "module" tells Node that dist/*.js is ESM
COPY --chown=node:node package.json ./

# Use the node user from the image
USER node

# Expose port 8080
EXPOSE 8080

# Start the server
CMD ["node", "dist/index.js"]
